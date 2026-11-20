import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpEventType,
  HttpParams,
} from '@angular/common/http';
import { ErrorHandler, inject, Service } from '@angular/core';
import { type AnyEndpoint, type ResponseKind, toUrl } from '@lms/contracts';
import { map, Observable } from 'rxjs';
import type { z } from 'zod';
import { APP_CONFIG } from '../config/app-config';
import { ContractError } from './contract-error';

/** The endpoint a request belongs to; the dev mock API answers by it. */
export const ENDPOINT = new HttpContextToken<AnyEndpoint | null>(() => null);

/** An endpoint `call` can send: everything except an `ndjson` one, which only `stream` reads. */
export type CallableEndpoint = AnyEndpoint & {
  readonly responseType?: Exclude<ResponseKind, 'ndjson'>;
};

/** An endpoint `stream` can read: one that declares `responseType: 'ndjson'`. */
export type StreamEndpoint = AnyEndpoint & {
  readonly responseType?: 'ndjson';
};

export interface SocketEndpoint {
  readonly path: string;
  readonly request: z.ZodType;
  readonly response: z.ZodType;
}

export interface SocketConnection<Request> {
  send(command: Request, maxBufferedBytes?: number): void;
  close(): void;
}

export interface SocketObserver<Response> {
  opened(): void;
  message(event: Response): void;
  closed(code: number): void;
}

// Browsers may send 1000 or an application close code, but reject close(1002).
export const SOCKET_INVALID_RESPONSE = 4002;

type Declared<S> = [S] extends [undefined] ? false : true;

type Part<K extends string, S> = [S] extends [undefined]
  ? { [P in K]?: never }
  : S extends z.ZodType
    ? { [P in K]: z.input<S> }
    : { [P in K]?: never };

/**
 * `params`, `query`, `body` and `headers`: each required when the endpoint declares it, forbidden
 * otherwise.
 */
export type CallInput<E extends AnyEndpoint> = Part<'params', E['params']> &
  Part<'query', E['query']> &
  Part<'body', E['body']> &
  Part<'headers', E['headers']>;

/** The arguments after the endpoint: none when the endpoint declares no input. */
export type CallArgs<E extends AnyEndpoint> = true extends
  | Declared<E['params']>
  | Declared<E['query']>
  | Declared<E['body']>
  | Declared<E['headers']>
  ? [input: CallInput<E>]
  : [];

/** The headers of a call: required exactly when the endpoint declares them, sent as given. */
function toHeaders(
  endpoint: AnyEndpoint,
  headers: Record<string, unknown> | undefined,
): Record<string, string> {
  if ((endpoint.headers === undefined) !== (headers === undefined)) {
    throw new Error(
      endpoint.headers === undefined
        ? `${endpoint.path} declares no headers.`
        : `${endpoint.path} needs its declared headers.`,
    );
  }
  return Object.fromEntries(
    Object.entries(headers ?? {}).flatMap(([name, value]) =>
      value === null || value === undefined ? [] : [[name, String(value)]],
    ),
  );
}

/** The body of a `binary` endpoint is one `Blob`; anything else is a client bug. */
function toBinary(body: unknown): Blob {
  if (!(body instanceof Blob)) {
    throw new Error('A binary body must be a Blob.');
  }
  return body;
}

function toHttpParams(query: Record<string, unknown> | undefined): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === null || item === undefined) continue;
      params = params.append(key, String(item));
    }
  }
  return params;
}

type FormValue = string | number | boolean | File | Blob;

function isFormValue(value: unknown): value is FormValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Blob
  );
}

/**
 * Turns a flat body into `FormData`: arrays repeat the key, numbers and booleans become strings,
 * `null`/`undefined` are skipped. A nested object throws: its encoding is a guess the backend
 * may not read, so the store must flatten it.
 */
function toFormData(body: unknown): FormData {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('A multipart body must be a flat object.');
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === null || item === undefined) continue;
      if (!isFormValue(item)) {
        throw new Error(
          `Multipart field "${key}" must be a string, number, boolean, File or Blob (or an array of them), not a nested object.`,
        );
      }
      form.append(key, item instanceof Blob ? item : String(item));
    }
  }
  return form;
}

/**
 * The one way the app calls the backend: verb, URL and response schema come from the endpoint
 * definition, so a store writes `client.call(courseEndpoints.getCourse, { params })`.
 * The body is sent as passed (JSON), as `FormData` for a `multipart` endpoint, or as one `Blob`
 * (`application/octet-stream`) for a `binary` one; the headers an endpoint declares come from
 * `input.headers`. A `blob` endpoint answers a `Blob` and an `ndjson` one is read with `stream`. The response is parsed with `endpoint.response`, and a mismatch
 * is reported to `ErrorHandler` (with the zod issues) before the stream errors with it.
 */
@Service()
export class EndpointClient {
  /** A same-origin socket authenticated by a short-lived, single-use ticket, never by a JWT URL. */
  connect<E extends SocketEndpoint>(
    endpoint: E,
    ticket: string,
    observer: SocketObserver<z.output<E['response']>>,
  ): SocketConnection<z.input<E['request']>> {
    const url = new URL(endpoint.path, location.origin);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('ticket', ticket);
    const socket = new WebSocket(url);
    let invalidResponse = false;
    socket.onopen = () => observer.opened();
    socket.onmessage = ({ data }: MessageEvent<unknown>) => {
      let decoded: unknown;
      try {
        decoded = typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        invalidResponse = true;
        socket.close(SOCKET_INVALID_RESPONSE);
        this.errorHandler.handleError(
          new Error('Invalid WebSocket JSON response'),
        );
        return;
      }
      const parsed = endpoint.response.safeParse(decoded);
      if (!parsed.success) {
        invalidResponse = true;
        socket.close(SOCKET_INVALID_RESPONSE);
        this.errorHandler.handleError(new ContractError(parsed.error.issues));
        return;
      }
      observer.message(parsed.data as z.output<E['response']>);
    };
    socket.onerror = () => socket.close();
    socket.onclose = ({ code }) =>
      observer.closed(invalidResponse ? SOCKET_INVALID_RESPONSE : code);
    return {
      send: (command, maxBufferedBytes) => {
        if (
          socket.readyState === WebSocket.OPEN &&
          (maxBufferedBytes === undefined ||
            socket.bufferedAmount <= maxBufferedBytes)
        )
          socket.send(JSON.stringify(endpoint.request.parse(command)));
      },
      close: () => {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      },
    };
  }

  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly config = inject(APP_CONFIG);

  /**
   * Whether this build can answer the endpoint: always for a backend one, only while the mock API
   * is on for a `served: 'mock'` one. Stores and menus ask this instead of reading the flag.
   */
  isServed(endpoint: AnyEndpoint): boolean {
    return endpoint.served !== 'mock' || this.config.mockApi;
  }

  call<E extends CallableEndpoint>(
    endpoint: E,
    ...args: CallArgs<E>
  ): Observable<z.output<E['response']>> {
    const request = this.prepare(endpoint, args[0]);
    return this.http
      .request<unknown>(endpoint.method, request.url, {
        body: request.body,
        params: request.params,
        context: request.context,
        headers: request.headers,
        responseType: (endpoint.responseType ?? 'json') as 'json',
      })
      .pipe(map((body) => this.parse(endpoint, body)));
  }

  /**
   * Reads an `ndjson` endpoint as its events arrive: every complete line of the growing body is
   * parsed with the endpoint's schema and emitted, a mismatch errors the stream with a
   * `ContractError`, and the last line needs no trailing newline. Unsubscribing aborts the
   * request. A refusal sent before the stream starts is an ordinary envelope (`ApiError`).
   */
  stream<E extends StreamEndpoint>(
    endpoint: E,
    ...args: CallArgs<E>
  ): Observable<z.output<E['response']>> {
    const request = this.prepare(endpoint, args[0]);
    return new Observable<z.output<E['response']>>((subscriber) => {
      let consumed = 0;
      const emit = (text: string, final: boolean): void => {
        for (;;) {
          const end = text.indexOf('\n', consumed);
          if (end === -1) break;
          const line = text.slice(consumed, end).trim();
          consumed = end + 1;
          if (line) subscriber.next(this.parseLine(endpoint, line));
        }
        if (final && consumed < text.length) {
          const line = text.slice(consumed).trim();
          consumed = text.length;
          if (line) subscriber.next(this.parseLine(endpoint, line));
        }
      };
      const subscription = this.http
        .request(endpoint.method, request.url, {
          body: request.body,
          params: request.params,
          context: request.context,
          headers: {
            ...request.headers,
            Accept: 'application/x-ndjson, application/json',
          },
          observe: 'events',
          reportProgress: true,
          responseType: 'text',
        })
        .subscribe({
          next: (event) => {
            try {
              if (event.type === HttpEventType.DownloadProgress) {
                emit(event.partialText ?? '', false);
              } else if (event.type === HttpEventType.Response) {
                emit(event.body ?? '', true);
              }
            } catch (error) {
              subscription.unsubscribe();
              subscriber.error(error);
            }
          },
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      return () => subscription.unsubscribe();
    });
  }

  private prepare(
    endpoint: AnyEndpoint,
    input: unknown,
  ): {
    url: string;
    body: unknown;
    params: HttpParams;
    context: HttpContext;
    headers: Record<string, string>;
  } {
    const { params, query, body, headers } = (input ?? {}) as {
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<string, unknown>;
    };
    return {
      url: (toUrl as (e: AnyEndpoint, p?: unknown) => string)(endpoint, params),
      body: this.encode(endpoint, body),
      params: toHttpParams(query),
      context: new HttpContext().set(ENDPOINT, endpoint),
      headers: {
        ...toHeaders(endpoint, headers),
        ...(endpoint.encoding === 'binary'
          ? { 'Content-Type': 'application/octet-stream' }
          : {}),
      },
    };
  }

  private encode(endpoint: AnyEndpoint, body: unknown): unknown {
    if (body === undefined) return body;
    switch (endpoint.encoding) {
      case 'multipart':
        return toFormData(body);
      case 'binary':
        return toBinary(body);
      default:
        return body;
    }
  }

  private parseLine<E extends AnyEndpoint>(
    endpoint: E,
    line: string,
  ): z.output<E['response']> {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      value = line;
    }
    return this.parse(endpoint, value);
  }

  private parse<E extends AnyEndpoint>(
    endpoint: E,
    body: unknown,
  ): z.output<E['response']> {
    const result = endpoint.response.safeParse(body);
    if (!result.success) {
      const error = new ContractError(result.error.issues);
      this.errorHandler.handleError(error);
      throw error;
    }
    return result.data as z.output<E['response']>;
  }
}
