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

type Declared<S> = [S] extends [undefined] ? false : true;

type Part<K extends string, S> = [S] extends [undefined]
  ? { [P in K]?: never }
  : S extends z.ZodType
    ? { [P in K]: z.input<S> }
    : { [P in K]?: never };

/** `params`, `query` and `body`: each required when the endpoint declares it, forbidden otherwise. */
export type CallInput<E extends AnyEndpoint> = Part<'params', E['params']> &
  Part<'query', E['query']> &
  Part<'body', E['body']>;

/** The arguments after the endpoint: none when the endpoint declares no input. */
export type CallArgs<E extends AnyEndpoint> =
  Declared<E['params']> extends false
    ? Declared<E['query']> extends false
      ? Declared<E['body']> extends false
        ? []
        : [input: CallInput<E>]
      : [input: CallInput<E>]
    : [input: CallInput<E>];

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
 * The body is sent as passed (JSON), or as `FormData` for a `multipart` endpoint; a `blob`
 * endpoint answers a `Blob` and an `ndjson` one is read with `stream`. The response is parsed with `endpoint.response`, and a mismatch
 * is reported to `ErrorHandler` (with the zod issues) before the stream errors with it.
 */
@Service()
export class EndpointClient {
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
          headers: { Accept: 'application/x-ndjson, application/json' },
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
  } {
    const { params, query, body } = (input ?? {}) as {
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
    };
    return {
      url: (toUrl as (e: AnyEndpoint, p?: unknown) => string)(endpoint, params),
      body:
        endpoint.encoding === 'multipart' && body !== undefined
          ? toFormData(body)
          : body,
      params: toHttpParams(query),
      context: new HttpContext().set(ENDPOINT, endpoint),
    };
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
