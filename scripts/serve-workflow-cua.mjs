/** Loopback-only browser fixture. Synthetic identities and isolated data never enter the hosted Site. */
import { createServer } from 'node:http';

export async function serveWorkflowCua({ mf, actorCookies, origin, actionOrigin }) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const requestUrl = new URL(incoming.url ?? '/', 'http://127.0.0.1');
      if (requestUrl.pathname === '/__qa') {
        outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        outgoing.end('<!doctype html><title>WBSCowork synthetic browser fixture</title><h1>합성 브라우저 검증</h1><p>격리된 테스트 자료와 가상 역할만 사용합니다.</p>' + Object.keys(actorCookies).map(actor => `<p><a href="/__qa/actor/${actor}">${actor}</a></p>`).join(''));
        return;
      }
      if (requestUrl.pathname.startsWith('/__qa/actor/')) {
        const actor = requestUrl.pathname.slice('/__qa/actor/'.length);
        if (!Object.hasOwn(actorCookies, actor)) { outgoing.writeHead(404); outgoing.end(); return; }
        outgoing.writeHead(303, { Location: '/my-work', 'Set-Cookie': `qa_actor=${actor}; HttpOnly; SameSite=Strict; Path=/`, 'Cache-Control': 'no-store' });
        outgoing.end(); return;
      }
      const selected = incoming.headers.cookie?.match(/(?:^|;\s*)qa_actor=(guest|member1|member2|admin|superuser)(?:;|$)/)?.[1];
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (!value || ['host', 'cookie', 'connection', 'content-length', 'origin'].includes(key)) continue;
        headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
      if (selected) headers.set('Cookie', actorCookies[selected]);
      if (incoming.headers.origin) headers.set('Origin', actionOrigin);
      const chunks = []; let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 24 * 1024 * 1024) throw new Error('Synthetic fixture body limit');
        chunks.push(chunk);
      }
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const response = await mf.dispatchFetch(origin + requestUrl.pathname + requestUrl.search, { method: incoming.method, headers, body, redirect: 'manual' });
      const resultHeaders = {};
      for (const [key, value] of response.headers) {
        if (['set-cookie', 'content-length', 'content-encoding', 'transfer-encoding'].includes(key)) continue;
        resultHeaders[key] = key === 'location' && value.startsWith(origin) ? value.slice(origin.length) || '/' : value;
      }
      outgoing.writeHead(response.status, resultHeaders);
      if (response.body) for await (const chunk of response.body) outgoing.write(chunk);
      outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain' });
      outgoing.end('Synthetic browser fixture failed.');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  console.log('Cua synthetic fixture ready: http://127.0.0.1:' + server.address().port + '/__qa');
  await new Promise(resolve => {
    const stop = () => server.close(resolve);
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
}
