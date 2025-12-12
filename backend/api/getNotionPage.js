// backend/api/getNotionPage.js
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  try {
    const { date, type } = req.query;
    console.log("Incoming request:", { date, type });

    // Query by Name property
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Name",
        title: { equals: date }
      }
    });

    console.log("Query results raw:", JSON.stringify(response.results, null, 2));

    if (response.results.length > 0) {
      const foundPage = response.results[0];
      console.log("Found existing page:", foundPage.url);
      res.status(200).json({ url: foundPage.url });
    } else {
      console.log("No page found, creating new:", { date, type });

      // Build properties object
      const properties = {
        Name: { title: [{ text: { content: date } }] },
        "Journal Entry Type": type ? { select: { name: type } } : undefined
      };

      // Only add Date if it's a valid ISO date string
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) || /^\d{4}-\d{2}$/.test(date)) {
        properties.Date = { date: { start: date } };
      }

      const newPage = await notion.pages.create({
        parent: { database_id: databaseId },
        properties
      });

      console.log("New page created:", newPage.url);
      res.status(200).json({ url: newPage.url });
    }
  } catch (error) {
    console.error("Error in getNotionPage:", error);
    res.status(500).json({ error: error.message });
  }
}
