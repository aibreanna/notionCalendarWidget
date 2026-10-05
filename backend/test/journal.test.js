import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEntry, createHandler, TEMPLATE_IDS } from '../journal.js';

function fixture(existing) {
  const queries = [], creates = [];
  const client = {
    dataSources: { query: async args => {
      queries.push(args);
      return { results: existing ? [{ url: existing }] : [] };
    } },
    pages: { create: async args => {
      creates.push(args);
      return { url: 'https://www.notion.so/new-entry' };
    } }
  };
  return { handler: createHandler(client, 'journal-source'), queries, creates };
}
async function request(f, method, date, extra = {}) {
  const res = {
    headers: {}, code: null, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
  await f.handler({ method, query: { date, ...extra }, body: { date, ...extra } }, res);
  return res;
}

for (const [name, type, start] of [
  ['2026-10-05', 'Daily', '2026-10-05'],
  ['2026-W41', 'Weekly', '2026-10-05'],
  ['2026-10', 'Monthly', '2026-10-01'],
  ['2026-W1', 'Weekly', '2025-12-29'],
  ['2026-W53', 'Weekly', '2026-12-28']
]) {
  test(`${name} creates one ${type} page with the correct template and date`, async () => {
    const f = fixture();
    const res = await request(f, 'POST', name);
    assert.equal(res.code, 201);
    assert.equal(f.creates.length, 1);
    const payload = f.creates[0];
    assert.equal(payload.template.template_id, TEMPLATE_IDS[type]);
    assert.equal(payload.template.timezone, 'America/Toronto');
    assert.equal(payload.properties.Date.date.start, start);
    assert.equal(payload.properties['Journal Entry Type'].select.name, type);
    assert.equal(payload.properties.Name.title[0].text.content, name);
    assert.deepEqual(payload.parent, { type: 'data_source_id', data_source_id: 'journal-source' });
    assert.equal('children' in payload, false);
  });
}

test('existing pages are returned without modification', async () => {
  const f = fixture('https://www.notion.so/existing');
  const res = await request(f, 'POST', '2026-10-05');
  assert.equal(res.code, 200);
  assert.equal(res.body.created, false);
  assert.equal(res.body.url, 'https://www.notion.so/existing');
  assert.equal(f.creates.length, 0);
});

test('GET never creates a missing page (including requests from the old widget)', async () => {
  for (const date of ['2026-10-05', '2026-W41', '2026-10']) {
    const f = fixture();
    const res = await request(f, 'GET', date);
    assert.equal(res.code, 404);
    assert.equal(f.creates.length, 0);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('GET can retrieve existing pages without writes', async () => {
  const f = fixture('https://www.notion.so/existing');
  assert.equal((await request(f, 'GET', '2026-10-05')).code, 200);
  assert.equal(f.creates.length, 0);
});

test('invalid dates and type mismatches are rejected before contacting Notion', async () => {
  for (const date of ['2026-02-30', '2025-02-29', '2026-00', '2026-13', '2025-W53', '2026-W0', '2026-W54', '', undefined, ['2026-10-05']]) {
    const f = fixture();
    assert.equal((await request(f, 'POST', date)).code, 400);
    assert.equal(f.queries.length, 0);
    assert.equal(f.creates.length, 0);
  }
  const f = fixture();
  assert.equal((await request(f, 'POST', '2026-10-05', { type: 'Monthly' })).code, 400);
  assert.equal(f.queries.length, 0);
  assert.deepEqual(classifyEntry('2024-02-29'), { type: 'Daily', start: '2024-02-29' });
});

test('preflight and unsupported methods perform no Notion operations', async () => {
  const f = fixture();
  assert.equal((await request(f, 'OPTIONS')).code, 204);
  assert.equal((await request(f, 'DELETE', '2026-10-05')).code, 405);
  assert.equal(f.queries.length, 0);
});

test('concurrent clicks for the same name are coalesced in one server instance', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 5 }, () => request(f, 'POST', '2026-10-05')));
  assert.equal(f.creates.length, 1);
  assert.equal(f.queries.length, 1);
  assert.ok(results.every(res => res.code === 201));
});

test('failure clears the in-flight entry and allows a retry', async () => {
  let attempts = 0;
  const client = {
    dataSources: { query: async () => ({ results: [] }) },
    pages: { create: async () => {
      if (++attempts === 1) throw new Error('mock failure');
      return { url: 'https://www.notion.so/retry' };
    } }
  };
  const f = { handler: createHandler(client, 'journal-source') };
  const original = console.error;
  try {
    console.error = () => {};
    assert.equal((await request(f, 'POST', '2026-10-05')).code, 500);
    assert.equal((await request(f, 'POST', '2026-10-05')).code, 201);
  } finally { console.error = original; }
});
