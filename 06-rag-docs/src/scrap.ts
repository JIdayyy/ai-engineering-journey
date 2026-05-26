import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export type ScrapedPage = {
  url: string;
  title: string;
  content: string;
};

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LearningBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const content = await response.text();

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1]?.trim() : "Untitled";

  if (!content || !title) {
    throw new Error("Title or content are missing");
  }

  return { url, title, content };
}
