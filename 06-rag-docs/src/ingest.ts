import "dotenv/config";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { sql } from "./database/db.js";
import { scrapePage } from "./scrap.js";
import { buildEmbeddings } from "./utils/embeds.js";

const URLS_TO_INGEST = [
  "https://ai-sdk.dev/docs/ai-sdk-core/generating-text",
  "https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling",
  "https://ai-sdk.dev/docs/ai-sdk-core/embeddings",
  "https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data",
];

// ============================================
// Helper : découpe un texte en chunks
// ============================================
function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  return chunks;
}

// ============================================
// Process une URL : scrape + chunk + embed + insert
// ============================================
async function processUrl(url: string): Promise<void> {
  console.log(`\n📄 ${url}`);

  // 1. Scrape (déjà fait, importé)
  const page = await scrapePage(url);
  console.log(`  ✓ Scraped: "${page.title}" (${page.content.length} chars)`);

  // 2. Chunk
  // À TOI : appeler chunkText sur page.content
  const chunks = chunkText(page.content);

  // 3. Embed (en batch, une seule API call pour tous les chunks de la page)
  // À TOI : embedMany avec model openai.embeddingModel('text-embedding-3-small') et values = chunks

  const embeds = await buildEmbeddings(chunks);

  console.log(embeds);

  // 4. Supprime les anciens chunks de cette URL pour idempotence
  // À TOI : DELETE FROM chunks WHERE source_url = ${url}

  await sql`DELETE FROM chunks WHERE source_url = ${page.url}`;

  for (const [i, embed] of embeds.entries()) {
    const vectorString = `[${embed.embedding.join(",")}]`;
    await sql`INSERT INTO chunks (source_url, source_title, content, chunk_index, embedding) VALUES (${page.url}, ${page.title}, ${embed.chunk}, ${i}, ${vectorString})`;
  }
}

// ============================================
// Main
// ============================================
async function main() {
  console.log(`Ingestion de ${URLS_TO_INGEST.length} URLs...\n`);

  for (const url of URLS_TO_INGEST) {
    try {
      await processUrl(url);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}`);
    }

    // Politesse : 1s entre les requêtes pour ne pas spam
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Stats finales
  const [stats] = await sql<[{ count: string }]>`SELECT COUNT(*) FROM chunks`;
  console.log(`\n✅ Terminé. ${stats?.count ?? 0} chunks en base.`);

  await sql.end();
}

main().catch(console.error);
