import http from 'node:http';
import https from 'node:https';

/**
 * Dev-server proxy: the app calls `/api/` on its own origin and this forwards it to the shared
 * backend (`corebanking-academy`). To use a backend on this machine, start the server with
 * `LMS_API_TARGET=http://localhost:8019 npm start`.
 */
const target = process.env.LMS_API_TARGET ?? 'http://103.121.90.119:8019';

/**
 * Node ignores `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` by default, so behind a corporate proxy
 * the dev server cannot reach the backend (`connect ETIMEDOUT`) while `curl` can. The agent below
 * honours them (and `NO_PROXY`, so `localhost` stays direct). Needs Node 24.5+ (`.nvmrc` is 24).
 */
const Agent = target.startsWith('https:') ? https.Agent : http.Agent;

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    agent: new Agent({ proxyEnv: process.env }),
  },
};
