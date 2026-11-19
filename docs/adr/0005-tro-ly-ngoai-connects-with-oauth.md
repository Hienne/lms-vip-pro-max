# 0005. A Trợ lý ngoài connects with OAuth through a minimal in-app authorisation server

Date: 2026-11-19 · Status: accepted · Amends the Reach and Permission points of ADR 0004

## Context

ADR 0004 connects a Trợ lý ngoài with a pasted `chan_ext_` token and supports Claude Code only. Authors
want to connect the way public MCP servers do: paste one URL into Claude App or Claude Code, sign in in the
browser, done. Those clients find the server through OAuth discovery (`/.well-known/oauth-*`), register
themselves (dynamic client registration) and use the authorisation-code flow with PKCE. The backend has
no OAuth server; the app signs users in with its own stateless HS256 JWT held by the Angular app.

## Decision

The backend becomes a minimal OAuth 2.1 authorisation server for the MCP endpoint only, and the
**Cho phép kết nối** step is an Angular page that uses the existing sign-in.

- `/oauth/authorize` redirects to the Angular page; the user (signed in as today) presses Cho phép, the
  page calls the backend with its JWT, and the backend redirects to the client with a code. No server
  session or second login form.
- Every grant is a **Kết nối trợ lý ngoài**: rate limit, audit and revoke stay keyed by connection.
  Access tokens last 1 hour; refresh tokens last 30 days, rotate on use, and reuse revokes the connection.
  A user holds at most 10 live connections.
- Dynamic registration is open, but only Claude's callback URLs and loopback redirects are accepted.
- The OAuth endpoints get their own security chain; the app's sign-in and API are unchanged. The web
  nginx forwards `/.well-known/oauth-*` to the backend (a manual server change).
- Claude App now reaches the endpoint from Anthropic's servers, so the endpoint is public, which ADR 0004
  had left out of scope.
- New `chan_ext_` tokens stop once OAuth works in production; existing ones run until they expire.

## Considered options

- **Spring Authorization Server:** brings its own form login and HTTP session, a second sign-in beside the
  JWT one, and far more surface than one resource needs.
- **An outside identity provider (Keycloak and similar):** a new service to run and a migration of the
  app's sign-in, for one feature.
- **Keep pasted tokens:** Claude App connectors cannot use them, which is what authors asked for.
