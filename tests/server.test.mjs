import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, validateInquiry } from '../server.mjs';

const valid = { name: 'Example User', email: 'example@example.org', organization: 'Example organization', phone: '', interest: 'Payments & collections', message: 'We would like to connect our billing and reporting systems.', consent: 'yes', website: '' };
async function withServer(options, run) {
  const server = createApp({ env: {}, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (url, body, headers = {}) => fetch(url + '/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('validates consent, field limits, email and header injection', () => {
  assert.equal(validateInquiry(valid).email, valid.email);
  assert.equal(validateInquiry({ ...valid, interest: 'Electronic official receipts (EOR)' }).interest, 'Electronic official receipts (EOR)');
  for (const patch of [{ consent: '' }, { email: 'not-email' }, { email: 'person@example.org\r\nBcc: victim@example.org' }, { name: 'X'.repeat(101) }, { message: 'short' }, { interest: 'arbitrary' }, { organization: [] }]) {
    assert.equal(validateInquiry({ ...valid, ...patch }), null);
  }
});
test('only public assets can be served; server, dependencies and secrets stay private', async () => {
  await withServer({ deliver: null }, async url => {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url + '/assets/fintech-devices-v2.webp')).status, 200);
    for (const path of ['/.env', '/.git/config', '/server.mjs', '/node_modules/nodemailer/package.json', '/assets/../package.json']) {
      assert.equal((await fetch(url + path)).status, 404, path);
    }
  });
});
test('unconfigured delivery never reports a sent message', async () => {
  await withServer({ deliver: null }, async url => {
    const response = await post(url, valid);
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /not yet connected/);
  });
});
test('rejects cross-origin, bot and invalid requests before mail delivery', async () => {
  let deliveries = 0;
  await withServer({ deliver: async () => { deliveries++; } }, async url => {
    assert.equal((await post(url, valid, { Origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await post(url, { ...valid, website: 'https://bot.example' })).status, 400);
    assert.equal((await post(url, { ...valid, consent: '' })).status, 400);
    assert.equal((await post(url, { ...valid, message: 'x'.repeat(21000) })).status, 413);
    assert.equal(deliveries, 0);
  });
});
test('success requires completed transport, with per-client rate limiting (mock mail only)', async () => {
  let deliveries = 0;
  await withServer({ deliver: async inquiry => { assert.equal(inquiry.email, valid.email); deliveries++; } }, async url => {
    for (let i = 0; i < 5; i++) {
      const response = await post(url, valid);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).sent, true);
    }
    assert.equal((await post(url, valid)).status, 429);
    assert.equal(deliveries, 5);
  });
});
test('mail failure returns a retry message rather than success (mock mail only)', async () => {
  await withServer({ deliver: async () => { throw new Error('Simulated failure'); } }, async url => {
    const response = await post(url, valid);
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /couldn’t deliver/);
  });
});
