import http from 'node:http';
import https from 'node:https';
import { once } from 'node:events';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

const launchPath = /^\/api\/v1\/scorm\/packages\/[1-9]\d*\/launch$/;
const playerPath =
  /^\/scorm-player\/[A-Za-z0-9_-]{43}\/(launch|runtime|runtime\.js|files\/.+)$/;
const maxJson = 128 * 1024;
const maxHtml = 2 * 1024 * 1024;

function origin(value, loopback = false) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (loopback &&
      (url.protocol !== 'http:' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  ) {
    throw new Error(
      'SCORM dev proxy requires HTTP(S) origins; the local LMS must use HTTP loopback.',
    );
  }
  return url;
}

async function readBody(stream, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit)
      throw new Error('SCORM dev proxy response limit exceeded.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function decode(buffer, encoding, limit) {
  const options = { maxOutputLength: limit };
  if (encoding === 'gzip') return gunzipSync(buffer, options);
  if (encoding === 'br') return brotliDecompressSync(buffer, options);
  if (encoding === 'deflate') return inflateSync(buffer, options);
  if (encoding && encoding !== 'identity')
    throw new Error('Unsupported upstream encoding.');
  return buffer;
}

function csp(policy, parent) {
  const directives = String(
    policy ||
      "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'",
  )
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^frame-ancestors\b/i.test(part));
  return [...directives, `frame-ancestors ${parent} 'self'`].join('; ');
}

function respondError(response, status = 502) {
  if (response.headersSent) return response.destroy();
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(
    'SCORM dev proxy: request unavailable. Check the configured upstream and restart the lesson.',
  );
}

/** Loopback-only development relay. Imported course content stays off the Angular origin. */
export async function startScormDevProxy({
  apiTarget,
  playerTarget,
  lmsOrigin = 'http://localhost:4200',
  port = 8020,
}) {
  const api = origin(apiTarget);
  const player = origin(playerTarget);
  const lms = origin(lmsOrigin, true);
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    (port && port < 1024)
  ) {
    throw new Error(
      'LMS_SCORM_DEV_PORT must be a free port between 1024 and 65535.',
    );
  }
  if (port && Number(lms.port || 80) === port)
    throw new Error('SCORM needs a different port from the LMS.');
  const agents = new Map(
    [...new Map([api, player].map((url) => [url.origin, url])).values()].map(
      (url) => [
        url.origin,
        new (url.protocol === 'https:' ? https.Agent : http.Agent)({
          proxyEnv: process.env,
        }),
      ],
    ),
  );
  const server = http.createServer(async (request, response) => {
    try {
      if (request.headers.host !== localPlayer.host)
        return respondError(response, 403);
      if (!request.url.startsWith('/') || request.url.startsWith('//'))
        return respondError(response, 400);
      const path = new URL(request.url, localPlayer).pathname;
      const isLaunch = launchPath.test(path);
      const match = playerPath.exec(path);
      if (!isLaunch && !match) return respondError(response, 404);
      const isRuntime = match?.[1] === 'runtime';
      if (
        isLaunch || isRuntime
          ? request.method !== 'POST'
          : !['GET', 'HEAD'].includes(request.method)
      ) {
        return respondError(response, 405);
      }
      if (isLaunch || isRuntime) {
        const expected = isLaunch ? lms.origin : localPlayer.origin;
        if (
          request.headers.origin !== expected ||
          !/^application\/json\b/i.test(request.headers['content-type'] || '')
        ) {
          return respondError(response, 403);
        }
      }
      const upstream = isLaunch ? api : player;
      const headers = {
        accept: request.headers.accept || '*/*',
        'accept-encoding': 'identity',
      };
      if (!isLaunch) headers.origin = player.origin;
      for (const key of ['content-type', 'range', 'if-range']) {
        if (request.headers[key]) headers[key] = request.headers[key];
      }
      // Only the launch API receives a bearer token. Package files/runtime never receive LMS credentials.
      if (isLaunch && request.headers.authorization)
        headers.authorization = request.headers.authorization;
      const body =
        request.method === 'POST'
          ? await readBody(request, maxJson)
          : undefined;
      if (body) headers['content-length'] = String(body.length);
      const remote = (upstream.protocol === 'https:' ? https : http).request(
        new URL(request.url, upstream),
        {
          method: request.method,
          headers,
          agent: agents.get(upstream.origin),
          timeout: 30_000,
        },
      );
      remote.on('timeout', () => remote.destroy());
      remote.on('error', () => respondError(response));
      response.once('close', () => {
        if (!response.writableFinished) remote.destroy();
      });
      remote.on('response', async (incoming) => {
        try {
          if (incoming.statusCode >= 300 && incoming.statusCode < 400) {
            incoming.resume();
            return respondError(response);
          }
          const copied = { ...incoming.headers, 'cache-control': 'no-store' };
          for (const key of [
            'connection',
            'transfer-encoding',
            'set-cookie',
            'access-control-allow-origin',
            'access-control-allow-credentials',
            'x-frame-options',
          ])
            delete copied[key];
          if (!isLaunch)
            copied['content-security-policy'] = csp(
              copied['content-security-policy'],
              lms.origin,
            );
          const rewriteHtml =
            match?.[1] === 'launch' &&
            incoming.statusCode === 200 &&
            request.method !== 'HEAD';
          if (isLaunch || rewriteHtml) {
            const limit = isLaunch ? maxJson : maxHtml;
            const raw = decode(
              await readBody(incoming, limit),
              incoming.headers['content-encoding'],
              limit,
            );
            let text = raw.toString('utf8');
            if (isLaunch) {
              const envelope = JSON.parse(text);
              if (envelope.status === 'SUCCESS') {
                const launch = new URL(envelope.data.launchUrl);
                if (
                  launch.origin !== player.origin ||
                  !/^\/scorm-player\/[A-Za-z0-9_-]{43}\/launch$/.test(
                    launch.pathname,
                  ) ||
                  launch.username ||
                  launch.password ||
                  launch.search ||
                  launch.hash
                )
                  throw new Error('Unexpected launch target.');
                envelope.data.launchUrl = localPlayer.origin + launch.pathname;
              }
              text = JSON.stringify(envelope);
            } else {
              let rewritten = false;
              text = text.replace(
                /window\.SCORM_BOOTSTRAP=(\{[^\r\n]*\});/,
                (_, json) => {
                  const bootstrap = JSON.parse(json);
                  bootstrap.origin = lms.origin;
                  rewritten = true;
                  return (
                    'window.SCORM_BOOTSTRAP=' +
                    JSON.stringify(bootstrap).replace(/</g, '\\u003c') +
                    ';'
                  );
                },
              );
              if (!rewritten) throw new Error('Unexpected player bootstrap.');
            }
            for (const key of [
              'content-length',
              'content-encoding',
              'etag',
              'last-modified',
            ])
              delete copied[key];
            response.writeHead(incoming.statusCode, copied);
            response.end(text);
          } else {
            response.writeHead(incoming.statusCode, copied);
            incoming.on('error', () => response.destroy());
            incoming.pipe(response);
          }
        } catch {
          respondError(response);
        }
      });
      remote.end(body);
    } catch {
      respondError(response);
    }
  });
  server.requestTimeout = 35_000;
  server.listen(port, '127.0.0.1');
  try {
    await once(server, 'listening');
  } catch {
    agents.forEach((agent) => agent.destroy());
    throw new Error(
      'Cannot start SCORM dev proxy. Free the port or set LMS_SCORM_DEV_PORT to another port.',
    );
  }
  const localPlayer = new URL(`http://127.0.0.1:${server.address().port}`);
  server.unref();
  return {
    origin: localPlayer.origin,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      agents.forEach((agent) => agent.destroy());
    },
  };
}
