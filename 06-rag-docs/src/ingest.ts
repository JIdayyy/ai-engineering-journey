import "dotenv/config";
import { sql } from "./database/db.js";
import { scrapePage } from "./scrap.js";
import { buildEmbeddings } from "./utils/embeds.js";

const URLS_TO_INGEST = [
  "https://ai-sdk.dev/docs/ai-sdk-core/generating-text",
  "https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling",
  "https://ai-sdk.dev/docs/ai-sdk-core/embeddings",
  "https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data",
];

function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  return chunks;
}

async function processUrl(url: string): Promise<void> {
  console.log(`\n📄 ${url}`);

  const page = await scrapePage(url);
  console.log(`  ✓ Scraped: "${page.title}" (${page.content.length} chars)`);

  const chunks = chunkText(page.content);

  const embeds = await buildEmbeddings(chunks);

  console.log(embeds);

  await sql`DELETE FROM chunks WHERE source_url = ${page.url}`;

  for (const [i, embed] of embeds.entries()) {
    const vectorString = `[${embed.embedding.join(",")}]`;
    await sql`INSERT INTO chunks (source_url, source_title, content, chunk_index, embedding) VALUES (${page.url}, ${page.title}, ${embed.chunk}, ${i}, ${vectorString})`;
  }
}

async function main() {
  console.log(`Ingestion de ${URLS_TO_INGEST.length} URLs...\n`);

  for (const url of URLS_TO_INGEST) {
    try {
      await processUrl(url);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  const [stats] = await sql<[{ count: string }]>`SELECT COUNT(*) FROM chunks`;
  console.log(`\n✅ Terminé. ${stats?.count ?? 0} chunks en base.`);

  await sql.end();
}

main().catch(console.error);
