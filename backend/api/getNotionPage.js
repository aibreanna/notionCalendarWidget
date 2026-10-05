import { Client } from '@notionhq/client';
import { createHandler } from '../journal.js';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2026-03-11'
});

// The data source (not a database/view ID) containing the Journal templates.
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID ||
  '1a406955-d946-80a8-8597-000be076389f';

export default createHandler(notion, dataSourceId);
