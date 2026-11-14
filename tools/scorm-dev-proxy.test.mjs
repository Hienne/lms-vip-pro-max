import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { startScormDevProxy } from './scorm-dev-proxy.mjs';

const capability = 'a'.repeat(43);
const path = `/scorm-player/${capability}`;
const lms = 'http://localhost:4319';

async function fixture(t) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({
      url: req.url,
      headers: req.headers,
      body,
      method: req.method,
    });
    if (req.url === '/api/v1/scorm/packages/42/launch') {
      const request = JSON.parse(body);
      res.setHeader('Content-Type', 'application/json');
      if (request.denied) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            status: 'ERROR',
            messageCode: 'CORE-UNAUTHENTICATED',
            data: null,
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          status: 'SUCCESS',
          responseId: 'fixture',
          data: {
            launchUrl:
              (request.foreign
                ? 'https://foreign.example.test'
                : upstreamOrigin) +
              path +
              '/launch',
            preview: request.preview,
            progress: { lessonStatus: 'incomplete', lessonLocation: 'page-4' },
          },
        }),
      );
    } else if (req.url === path + '/launch') {
      const bootstrap = {
        origin: 'https://chanacademy.io.vn',
        cmi: {
          'cmi.core.lesson_location': 'page-4',
          'cmi.suspend_data': '</script><test>',
        },
        launch: 'files/index.html',
        sequence: 7,
      };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; object-src 'none'; frame-ancestors https://chanacademy.io.vn 'self'",
      );
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.end(
        gzipSync(
          '<script>window.SCORM_BOOTSTRAP=' +
            JSON.stringify(bootstrap).replace(/</g, '\\u003c') +
            ';</script>\n<iframe src="runtime.js"></iframe>',
        ),
      );
    } else if (req.url === path + '/runtime') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'SUCCESS',
          data: {
            sequence: JSON.parse(body).sequence,
            progress: { lessonStatus: 'passed', scoreRaw: 87 },
          },
        }),
      );
    } else {
      res.writeHead(206, {
        'Content-Type': 'application/pdf',
        'Content-Range': 'bytes 1-3/4',
        'Set-Cookie': 'secret=fixture',
      });
      res.end(Buffer.from([1, 2, 3]));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const upstreamOrigin = `http://127.0.0.1:${server.address().port}`;
  const relay = await startScormDevProxy({
    apiTarget: upstreamOrigin,
    playerTarget: upstreamOrigin,
    lmsOrigin: lms,
    port: 0,
  });
  t.after(async () => {
    await relay.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return { ...relay, requests, upstreamOrigin };
}

test('launch keeps the enrollment request and envelope, changing only the player origin', async (t) => {
  const relay = await fixture(t);
  const body = {
    preview: false,
    restart: true,
    enrollmentId: 12,
    lessonId: 25,
  };
  const response = await fetch(
    relay.origin + '/api/v1/scorm/packages/42/launch',
    {
      method: 'POST',
      headers: {
        Origin: lms,
        'Content-Type': 'application/json',
        Authorization: 'Bearer fixture',
        Cookie: 'session=fixture',
      },
      body: JSON.stringify(body),
    },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.launchUrl, relay.origin + path + '/launch');
  assert.equal(result.data.progress.lessonLocation, 'page-4');
  assert.equal(result.responseId, 'fixture');
  assert.deepEqual(JSON.parse(relay.requests[0].body), body);
  assert.equal(relay.requests[0].headers.authorization, 'Bearer fixture');
  assert.equal(relay.requests[0].headers.cookie, undefined);
});

test('player changes the parent origin while preserving resume state, isolation and the rest of CSP', async (t) => {
  const relay = await fixture(t);
  const response = await fetch(relay.origin + path + '/launch', {
    headers: {
      Authorization: 'Bearer must-not-forward',
      Cookie: 'session=must-not-forward',
    },
  });
  const html = await response.text();
  const bootstrap = JSON.parse(
    html.match(/window\.SCORM_BOOTSTRAP=(\{.*\});/)[1],
  );
  assert.equal(bootstrap.origin, lms);
  assert.equal(bootstrap.cmi['cmi.core.lesson_location'], 'page-4');
  assert.equal(bootstrap.cmi['cmi.suspend_data'], '</script><test>');
  assert.equal(bootstrap.sequence, 7);
  assert.equal(bootstrap.launch, 'files/index.html');
  assert.ok(!html.includes('</script><test>'));
  assert.ok(
    response.headers
      .get('content-security-policy')
      .includes(`frame-ancestors ${lms} 'self'`),
  );
  assert.ok(
    response.headers
      .get('content-security-policy')
      .includes("object-src 'none'"),
  );
  assert.equal(response.headers.get('x-frame-options'), null);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(relay.requests[0].headers.origin, relay.upstreamOrigin);
  assert.equal(relay.requests[0].headers.authorization, undefined);
  assert.equal(relay.requests[0].headers.cookie, undefined);
  assert.notEqual(relay.origin, lms);
});

test('runtime preserves the exact SCORM snapshot, sequence and server score', async (t) => {
  const relay = await fixture(t);
  const body = {
    sequence: 8,
    values: {
      'cmi.core.lesson_status': 'passed',
      'cmi.core.lesson_location': 'page-4',
    },
    finished: false,
  };
  const response = await fetch(relay.origin + path + '/runtime', {
    method: 'POST',
    headers: { Origin: relay.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(relay.requests[0].body), body);
  assert.equal(relay.requests[0].headers.origin, relay.upstreamOrigin);
  assert.equal((await response.json()).data.progress.scoreRaw, 87);
});

test('file ranges and bytes stream unchanged without cookies', async (t) => {
  const relay = await fixture(t);
  const response = await fetch(relay.origin + path + '/files/a.pdf?v=1', {
    headers: { Range: 'bytes=1-3' },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 1-3/4');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(relay.requests[0].headers.range, 'bytes=1-3');
  assert.equal(relay.requests[0].url, path + '/files/a.pdf?v=1');
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
});

test('rejects foreign origins, arbitrary API paths, invalid launch targets and wrong methods', async (t) => {
  const relay = await fixture(t);
  for (const endpoint of [
    '/api/v1/scorm/packages/42/launch',
    path + '/runtime',
  ]) {
    const result = await fetch(relay.origin + endpoint, {
      method: 'POST',
      headers: {
        Origin: 'https://foreign.example.test',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(result.status, 403);
  }
  assert.equal((await fetch(relay.origin + '/api/v1/me')).status, 404);
  assert.equal((await fetch(relay.origin + path + '/runtime')).status, 405);
  assert.equal(relay.requests.length, 0);
  const result = await fetch(
    relay.origin + '/api/v1/scorm/packages/42/launch',
    {
      method: 'POST',
      headers: { Origin: lms, 'Content-Type': 'application/json' },
      body: '{"foreign":true}',
    },
  );
  assert.equal(result.status, 502);
  assert.ok(!(await result.text()).includes(capability));
});

test('keeps authentication failures from the backend unchanged', async (t) => {
  const relay = await fixture(t);
  const response = await fetch(
    relay.origin + '/api/v1/scorm/packages/42/launch',
    {
      method: 'POST',
      headers: { Origin: lms, 'Content-Type': 'application/json' },
      body: '{"denied":true}',
    },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    status: 'ERROR',
    messageCode: 'CORE-UNAUTHENTICATED',
    data: null,
  });
});

test('rejects rebound hosts and absolute request URLs without forwarding', async (t) => {
  const relay = await fixture(t);
  async function rawRequest(pathname, host) {
    return new Promise((resolve, reject) => {
      const request = http.request(
        relay.origin,
        { path: pathname, headers: { Host: host } },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        },
      );
      request.on('error', reject);
      request.end();
    });
  }
  assert.equal(await rawRequest(path + '/launch', 'foreign.example.test'), 403);
  assert.equal(
    await rawRequest(
      'http://foreign.example.test' + path + '/launch',
      new URL(relay.origin).host,
    ),
    400,
  );
  assert.equal(relay.requests.length, 0);
});

test('rejects public LMS origins and shared LMS/player ports before binding', async () => {
  const options = {
    apiTarget: 'https://chanacademy.io.vn',
    playerTarget: 'https://chanacademy.io.vn:8020',
  };
  await assert.rejects(
    startScormDevProxy({
      ...options,
      lmsOrigin: 'https://public.example.test',
    }),
  );
  await assert.rejects(
    startScormDevProxy({
      ...options,
      lmsOrigin: 'http://localhost:8020',
      port: 8020,
    }),
  );
});
