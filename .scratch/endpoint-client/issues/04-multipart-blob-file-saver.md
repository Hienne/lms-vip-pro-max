# 04: Multipart, blob and `FileSaver`

**What to build:** Endpoints can opt into `encoding: 'multipart'` and `responseType: 'blob'` (both default `json`). For multipart, the client turns a flat typed body into `FormData`: values are `string | number | boolean | File | Blob` or arrays of them, arrays repeat the key, numbers and booleans become strings, null/undefined are skipped, a nested object throws, and `Content-Type` is never set by hand. File fields use `z.file()`. A blob endpoint declares `response: z.instanceof(Blob)` (enforced by the types) and `call` returns `Observable<Blob>`; it is still parsed, so a mismatch is a `ContractError`. `FileSaver.save(blob, filename)` in `core/files/` saves through a temporary `<a download>` and an object URL that is revoked afterwards. No real endpoint uses these yet. See spec: `docs/specs/endpoint-client.md`, Endpoint definition / `EndpointClient` / `FileSaver`.

**Blocked by:** 01 (client tracer)

**Status:** open

- [ ] `endpoint-client.spec.ts` covers multipart (flat values, arrays, skipped nulls, nested object throws, no manual `Content-Type`) and blob (request type, `Blob` result, mismatch reported), with endpoints declared inside the spec
- [ ] Type test: `responseType: 'blob'` with a non-Blob response schema does not compile
- [ ] `file-saver.spec.ts` with a stub `DOCUMENT`: object URL created, link clicked with the given name, URL revoked
- [ ] `npm run check` green
