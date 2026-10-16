import type { z } from 'zod';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

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
}

/** What `defineEndpoint` accepts: params, query and body are optional. */
export type EndpointInput<
  Path extends string,
  Params extends z.ZodObject | undefined,
  Query extends z.ZodObject | undefined,
  Body extends z.ZodType | undefined,
  Response extends z.ZodType,
> = Omit<
  EndpointDefinition<Path, Params, Query, Body, Response>,
  'params' | 'query' | 'body'
> & { params?: Params; query?: Query; body?: Body };

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
  Response extends z.ZodType = z.ZodType,
>(
  endpoint: EndpointInput<Path, Params, Query, Body, Response>,
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
