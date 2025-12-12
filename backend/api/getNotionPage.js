// backend/api/getNotionPage.js
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  // ✅ Allow requests from your GitHub Pages site
  res.setHeader("Access-Control-Allow-Origin", "https://aibreanna.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const { date, type } = req.query;
    console.log("Incoming request:", { date, type });

    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Name",
        title: { equals: date }
      }
    });

    if (response.results.length > 0) {
      res.status(200).json({ url: response.results[0].url });
    } else {
      const properties = {
        Name: { title: [{ text: { content: date } }] },
        ...(type && { "Journal Entry Type": { select: { name: type } } })
      };

      // Only set Date if valid ISO string
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) || /^\d{4}-\d{2}$/.test(date)) {
        properties.Date = { date: { start: date } };
      }

      const newPage = await notion.pages.create({
        parent: { database_id: databaseId },
        properties
      });

      res.status(200).json({ url: newPage.url });
    }
  } catch (error) {
    console.error("Error in getNotionPage:", error);
    res.status(500).json({ error: error.message });
  }
}
