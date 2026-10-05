# Notion Calendar Widget

A calendar embedded in Notion with links to Daily, Weekly, and Monthly Journal entries. The existing calendar appearance is preserved.

## Click-only journal creation

- Loading the widget, browsing months, and pressing Today create **no pages** and make no API requests.
- Clicking a day opens an existing entry or creates one using the Daily template.
- Clicking `W#` uses the Weekly template; clicking the month heading uses the Month template.
- Existing entries are matched by their exact `Name` and opened without changing their content or properties, including existing blank entries.
- New entries use the clicked date, week Monday, or first day of the month for `Date`, plus the matching `Journal Entry Type`.
- Notion applies templates asynchronously. A newly opened page may be briefly blank while its template is populated. No manual template selection should be needed.
- Template variables resolve in `America/Toronto`. The explicit entry date still reflects the calendar link clicked.

## Configuration

Frontend: `index.html`, served by GitHub Pages. The backend endpoint remains:
`https://notion-calendar-widget-eight.vercel.app/api/getNotionPage`

Backend: Vercel project with root directory `backend` and a modern Node.js runtime (Node 22 or newer recommended).

Environment variables in Vercel:
- `NOTION_TOKEN`: the existing Notion integration credential. Never put it in frontend code or commit it.
- `NOTION_DATA_SOURCE_ID`: optional; defaults to the Journal data source `1a406955-d946-80a8-8597-000be076389f`.

`NOTION_DATABASE_ID` is no longer used. Data-source APIs use a data source ID, not a database/view ID. The SDK dependency is upgraded to `@notionhq/client` 5.3.0 or newer, with Notion API version `2026-03-11`, to support template creation.

The three existing template IDs are configured in `backend/journal.js`. The Notion integration must have access to the Journal and its templates, as well as permissions to read content and insert pages.

## Deployment order

1. Deploy the changed `backend` to Vercel, including the SDK update and new `journal.js` module.
2. Publish the changed `index.html` through GitHub Pages.
3. Reload the dashboard widget to replace any cached frontend code.

Deploying the backend first is important: old widget GET requests become read-only and return 404 for missing entries. They cannot create unwanted blank pages, but missing links on the old frontend may temporarily show a warning until the frontend is updated. The new frontend requires POST support in the new backend.

## Request behavior

- `POST /api/getNotionPage` with JSON `{ "date": "2026-10-05" }`: find or create a Daily entry.
- `{ "date": "2026-W41" }`: Weekly entry.
- `{ "date": "2026-10" }`: Monthly entry.
- `GET /api/getNotionPage?date=...`: lookup only; never creates a page.
- `OPTIONS`: CORS preflight; never accesses Notion.

The backend infers the template from the date format and rejects malformed dates. Repeated clicks are suppressed in the widget and coalesced in each server instance. There is no distributed uniqueness lock, so simultaneous clicks from different browsers/server instances could still race. Reuse of existing entries relies on exact names, following the original widget behavior.

The endpoint remains public, as in the original design. CORS is not authentication: someone who knows the endpoint can call it outside the widget. Authentication or a rate limit would be separate hardening work, not part of this change.

## Testing

```bash
cd backend
npm install
npm test
```

Tests mock Notion and the frontend DOM. They cover zero requests during rendering/navigation, day/week/month click payloads, template selection, existing-page preservation, read-only GETs, validation, rapid clicks, failures/retries, popup fallback, and calendar rollover. Tests do not create real Journal entries or verify live integration permissions.

After deployment, manually verify:
1. Loading and navigating the widget creates no entries.
2. Click an existing day and confirm it opens unchanged.
3. Click one missing day, week, and month and confirm each has its corresponding template and clicked date.
4. Click each again and confirm no additional entry is created.
5. If the browser blocks the new tab, use the displayed "open your entry" fallback link.

No existing entries are deleted, backfilled, or modified by this change.
