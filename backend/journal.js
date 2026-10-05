// Infer the entry type server-side: callers cannot choose a mismatched template.
export const TEMPLATE_IDS = Object.freeze({
  Daily: '1a406955-d946-804f-8eb8-fff08c684751',
  Weekly: '1a406955-d946-8039-b6d1-d16cf1830d48',
  Monthly: '1a406955-d946-80ee-bfb7-fa1afecd7e75'
});

export function classifyEntry(name) {
  if (typeof name !== 'string') throw new Error('A journal date is required.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
    const parsed = new Date(`${name}T00:00:00Z`);
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== name)
      throw new Error('Invalid daily date.');
    return { type: 'Daily', start: name };
  }
  if (/^\d{4}-\d{2}$/.test(name)) {
    const month = Number(name.slice(5));
    if (month < 1 || month > 12) throw new Error('Invalid month.');
    return { type: 'Monthly', start: `${name}-01` };
  }
  const match = /^(\d{4})-W(\d{1,2})$/.exec(name);
  if (match) {
    const year = Number(match[1]);
    const week = Number(match[2]);
    const monday = new Date(`${match[1]}-01-04T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (week - 1) * 7);
    const thursday = new Date(monday);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    if (week < 1 || week > 53 || thursday.getUTCFullYear() !== year)
      throw new Error('Invalid ISO week.');
    return { type: 'Weekly', start: monday.toISOString().slice(0, 10) };
  }
  throw new Error('Use YYYY-MM-DD, YYYY-W#, or YYYY-MM.');
}

export function createHandler(notion, dataSourceId) {
  // Coalesce repeated clicks within this server instance. This is not a
  // distributed lock across separate Vercel instances.
  const pendingCreates = new Map();

  async function findPage(name) {
    const result = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: 'Name', title: { equals: name } },
      page_size: 1
    });
    return result.results[0];
  }

  async function findOrCreate(name, entry) {
    const existing = await findPage(name);
    if (existing) return { url: existing.url, created: false };
    const page = await notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties: {
        Name: { title: [{ text: { content: name } }] },
        'Journal Entry Type': { select: { name: entry.type } },
        Date: { date: { start: entry.start } }
      },
      template: {
        type: 'template_id',
        template_id: TEMPLATE_IDS[entry.type],
        timezone: 'America/Toronto'
      }
    });
    return { url: page.url, created: true };
  }

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://aibreanna.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET,POST,OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    let name, entry;
    try {
      const input = req.method === 'GET' ? req.query :
        (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
      name = input?.date;
      entry = classifyEntry(name);
      if (input.type && input.type !== entry.type)
        throw new Error('Entry type does not match the date.');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    try {
      // Old frontend GET requests must never create entries either.
      if (req.method === 'GET') {
        const page = await findPage(name);
        return page ? res.status(200).json({ url: page.url, created: false }) :
          res.status(404).json({ error: 'No journal entry exists yet.' });
      }
      if (!pendingCreates.has(name)) {
        const task = findOrCreate(name, entry).finally(() => pendingCreates.delete(name));
        pendingCreates.set(name, task);
      }
      const result = await pendingCreates.get(name);
      return res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      console.error('Journal request failed:', error);
      return res.status(500).json({ error: 'Unable to open the journal entry. Please try again.' });
    }
  };
}
