import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fixture({ popupBlocked = false, fail = false } = {}) {
  class Element {
    constructor() { this.children = []; this.attributes = {}; this.classList = { add: () => {} }; }
    set innerHTML(value) { this.children = []; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text; }
    appendChild(child) { this.children.push(child); }
    setAttribute(k, v) { this.attributes[k] = v; }
    removeAttribute(k) { delete this.attributes[k]; }
  }
  const elements = Object.fromEntries(['calendar', 'month-link', 'loading'].map(k => [k, new Element()]));
  const calls = [], destinations = [];
  const context = vm.createContext({
    Date, URL, Map, Set, console: { error() {} },
    document: { getElementById: id => elements[id], createElement: () => new Element() },
    window: { open: () => popupBlocked ? null : {
      closed: false, document: { body: {} },
      location: { replace: url => destinations.push(url) }, close() { this.closed = true; }
    } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: !fail, json: async () => fail ? { error: 'Test error' } : { url: 'https://www.notion.so/test-entry' } };
    }
  });
  vm.runInContext(script, context);
  return { context, elements, calls, destinations };
}
const click = link => link.onclick({ preventDefault() {} });

test('initial render and month navigation issue zero API calls', () => {
  const f = fixture();
  vm.runInContext('prevMonth(); nextMonth(); goToday();', f.context);
  assert.equal(f.calls.length, 0);
});

test('day, week, and month clicks send only the selected journal key', async () => {
  const f = fixture();
  vm.runInContext('currentDate = new Date(2026, 9, 5); renderCalendar(currentDate);', f.context);
  const cells = f.elements.calendar.children;
  const day5 = cells.find(cell => cell.className.startsWith('day ') && cell.children[0]?.textContent === '5').children[0];
  const week41 = cells.find(cell => cell.className === 'weeknum' && cell.children[0]?.textContent === 'W41').children[0];
  await click(day5); await click(week41); await click(f.elements['month-link']);
  assert.deepEqual(f.calls.map(call => JSON.parse(call.options.body).date), ['2026-10-05', '2026-W41', '2026-10']);
  assert.ok(f.calls.every(call => call.options.method === 'POST'));
  assert.equal(f.destinations.length, 3);
  await click(day5);
  assert.equal(f.calls.length, 3, 'repeat click uses the known page URL');
});

test('rapid repeated clicks send just one POST', async () => {
  const f = fixture();
  await Promise.all([click(f.elements['month-link']), click(f.elements['month-link'])]);
  assert.equal(f.calls.length, 1);
});

test('blocked popups get a usable manual link', async () => {
  const f = fixture({ popupBlocked: true });
  await click(f.elements['month-link']);
  assert.equal(f.elements.loading.children[0].href, 'https://www.notion.so/test-entry');
});

test('errors are shown and allow retries', async () => {
  const f = fixture({ fail: true });
  await click(f.elements['month-link']);
  assert.match(f.elements.loading.textContent, /Click the link again to retry/);
  await click(f.elements['month-link']);
  assert.equal(f.calls.length, 2);
});

test('ISO rollover and month-end navigation remain correct', () => {
  const f = fixture();
  const week = vm.runInContext('getISOWeekYearAndNumber(new Date(2025, 11, 29))', f.context);
  assert.equal(week.weekYear, 2026); assert.equal(week.weekNumber, 1);
  vm.runInContext('currentDate = new Date(2026, 0, 31); nextMonth();', f.context);
  assert.equal(f.elements['month-link'].textContent, 'February 2026');
  assert.equal(f.calls.length, 0);
});
