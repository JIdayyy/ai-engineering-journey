import "dotenv/config";
import { embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { sql } from "./database/db.js";

type SearchResult = {
  id: number;
  source_url: string;
  source_title: string;
  content: string;
  chunk_index: number;
  similarity: number;
};

const system = `Tu es un assistant technique qui répond aux questions en t'appuyant UNIQUEMENT sur les sources fournies.

Règles strictes :
1. Utilise UNIQUEMENT les informations des sources fournies
2. Cite tes sources en fin de réponse avec le format [Source N]
3. Si les sources ne contiennent pas assez d'info pour répondre, dis-le clairement
4. N'invente JAMAIS d'information qui n'est pas dans les sources
5. Si tu utilises du code, prends-le directement des exemples des sources`;

async function findRelevantChunks(
  query: string,
  topK = 5,
): Promise<SearchResult[]> {
  const embededQuery = await embed({
    value: query,
    model: openai.embeddingModel("text-embedding-3-small"),
  });

  const vectorString = `[${embededQuery.embedding.join(",")}]`;

  const result = await sql<SearchResult[]>`
    SELECT 
      id,
      source_url,
      source_title,
      content,
      chunk_index,
      1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM chunks
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${topK}
  `;

  return result;
}

async function askWithRAG(question: string): Promise<void> {
  console.log(`\n🔍 Question: "${question}"`);
  console.log("─".repeat(80));

  const chunks = await findRelevantChunks(question, 5);

  console.log(`\n📚 Found ${chunks.length} relevant chunks:`);
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — score: ${Number(c.similarity).toFixed(3)}`,
    );
  });

  const context = chunks
    .map((c, i) => {
      return `[Source ${i}] ${c.source_title} - ${c.source_url} \n\n ${c.content}`;
    })
    .join("\n\n");

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    system, // À TOI
    prompt: context + `[Question utilisateur]: ${question}`, // À TOI
  });

  console.log("\n💬 Réponse:");
  console.log(text);
}

async function main() {
  const queries = [
    "How do I stream text with the Vercel AI SDK?",
    "What's the difference between generateText and streamText?",
    "How do I use tools with structured outputs?",
  ];

  for (const query of queries) {
    await askWithRAG(query);
    console.log("\n" + "═".repeat(80));
  }

  await sql.end();
}

main().catch(console.error);
