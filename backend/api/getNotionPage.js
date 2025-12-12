// backend/api/getNotionPage.js
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  try {
    const { date, type } = req.query;

    // Query the database for a matching entry
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: "Date", date: { equals: date } },
          { property: "Journal Entry Type", select: { equals: type } }
        ]
      }
    });

    if (response.results.length > 0) {
      // Found an existing page
      res.status(200).json({ url: response.results[0].url });
    } else {
      // Create a new page with naming convention: YYYY-MM-DD, YYYY-W##, or YYYY-MM
      const newPage = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: date } }] }, // <-- only the date string
          Date: { date: { start: date } },
          "Journal Entry Type": { select: { name: type } }
        }
      });

      res.status(200).json({ url: newPage.url });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
