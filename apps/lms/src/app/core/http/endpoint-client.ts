import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpParams,
} from '@angular/common/http';
import { ErrorHandler, inject, Service } from '@angular/core';
import { type AnyEndpoint, toUrl } from '@lms/contracts';
import { map, type Observable } from 'rxjs';
import type { z } from 'zod';
import { ContractError } from './contract-error';

/** The endpoint a request belongs to; the dev mock API answers by it. */
export const ENDPOINT = new HttpContextToken<AnyEndpoint | null>(() => null);

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

/**
 * The one way the app calls the backend: verb, URL and response schema come from the endpoint
 * definition, so a store writes `client.call(courseEndpoints.getCourse, { params })`.
 * The body is sent as passed; the response is parsed with `endpoint.response`, and a mismatch
 * is reported to `ErrorHandler` (with the zod issues) before the stream errors with it.
 */
@Service()
export class EndpointClient {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandler);

  call<E extends AnyEndpoint>(
    endpoint: E,
    ...args: CallArgs<E>
  ): Observable<z.output<E['response']>> {
    const input = (args[0] ?? {}) as {
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
    };
    const url = (toUrl as (e: AnyEndpoint, p?: unknown) => string)(
      endpoint,
      input.params,
    );
    return this.http
      .request<unknown>(endpoint.method, url, {
        body: input.body,
        params: toHttpParams(input.query),
        context: new HttpContext().set(ENDPOINT, endpoint),
      })
      .pipe(map((body) => this.parse(endpoint, body)));
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
