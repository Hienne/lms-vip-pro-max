import type { z } from 'zod';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** How the request body travels: JSON (default) or multipart form data for file uploads. */
export type BodyEncoding = 'json' | 'multipart';

/** What the response carries: JSON (default) or a file, received as a `Blob`. */
export type ResponseKind = 'json' | 'blob';

/** The response schema an endpoint may declare: a `Blob` one when `responseType` is `'blob'`. */
export type ResponseSchemaFor<R extends ResponseKind> = R extends 'blob'
  ? z.ZodType<Blob>
  : z.ZodType;

/**
 * Who answers an endpoint: the real backend, or the in-app mock API because the backend does not
 * have it yet. Moving an endpoint across this line is a one-word edit on its definition.
 */
export type Served = 'backend' | 'mock';

export interface EndpointDefinition<
  Path extends string = string,
  Params extends z.ZodObject | undefined = z.ZodObject | undefined,
  Query extends z.ZodObject | undefined = z.ZodObject | undefined,
  Body extends z.ZodType | undefined = z.ZodType | undefined,
  Response extends z.ZodType = z.ZodType,
> {
  readonly method: HttpMethod;
  /** Always starts with `/api/`; `{name}` segments are filled from `params`. */
  readonly path: Path;
  readonly params: Params;
  readonly query: Query;
  readonly body: Body;
  readonly response: Response;
  /** `'multipart'` sends a flat body as `FormData`; defaults to `'json'`. */
  readonly encoding?: BodyEncoding;
  /** `'blob'` receives a file (declare `response: z.instanceof(Blob)`); defaults to `'json'`. */
  readonly responseType?: ResponseKind;
  /** Who answers it; defaults to `'backend'`. A `'mock'` endpoint only exists while `mockApi` is on. */
  readonly served?: Served;
}

/** What `defineEndpoint` accepts: params, query and body are optional. */
export type EndpointInput<
  Path extends string,
  Params extends z.ZodObject | undefined,
  Query extends z.ZodObject | undefined,
  Body extends z.ZodType | undefined,
  Response extends z.ZodType,
  Kind extends ResponseKind = ResponseKind,
> = Omit<
  EndpointDefinition<Path, Params, Query, Body, Response>,
  'params' | 'query' | 'body' | 'responseType'
> & {
  params?: Params;
  query?: Query;
  body?: Body;
  responseType?: Kind;
};

export type AnyEndpoint = EndpointDefinition<
  string,
  z.ZodObject | undefined,
  z.ZodObject | undefined,
  z.ZodType | undefined,
  z.ZodType
>;

export function defineEndpoint<
  const Path extends `/api/${string}`,
  Params extends z.ZodObject | undefined = undefined,
  Query extends z.ZodObject | undefined = undefined,
  Body extends z.ZodType | undefined = undefined,
  const Kind extends ResponseKind = 'json',
  Response extends ResponseSchemaFor<Kind> = ResponseSchemaFor<Kind>,
>(
  endpoint: EndpointInput<Path, Params, Query, Body, Response, Kind>,
): EndpointDefinition<Path, Params, Query, Body, Response> {
  return endpoint as EndpointDefinition<Path, Params, Query, Body, Response>;
}

type ParamsArgs<E extends AnyEndpoint> = E['params'] extends z.ZodObject
  ? [params: z.input<E['params']>]
  : [];

/** Fills `{name}` path segments. Params are required at type level when declared. */
export function toUrl<E extends AnyEndpoint>(
  endpoint: E,
  ...args: ParamsArgs<E>
): string {
  const values = (args[0] ?? {}) as Record<string, unknown>;
  return endpoint.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing path param "${name}" for ${endpoint.path}`);
    }
    return encodeURIComponent(String(value));
  });
}
