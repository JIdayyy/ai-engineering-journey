import "dotenv/config";
import { embed, generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { sql } from "./database/db.js";
import z from "zod";

// ============================================
// Types
// ============================================

type SearchResult = {
  id: number;
  source_url: string;
  source_title: string;
  content: string;
  chunk_index: number;
  similarity: number;
};

type SearchFilters = {
  sourceTitle?: string | null;
};

// ============================================
// Retrieval with optional filters
// ============================================

async function findRelevantChunks(
  query: string,
  filters: SearchFilters = {},
  topK = 5,
): Promise<SearchResult[]> {
  // 1. Embed the query
  const embededQuery = await embed({
    value: query,
    model: openai.embeddingModel("text-embedding-3-small"),
  });

  const vectorString = `[${embededQuery.embedding.join(",")}]`;

  const whereClause = filters.sourceTitle
    ? sql`WHERE source_title =  ${filters.sourceTitle}`
    : sql``;

  const result = await sql<
    SearchResult[]
  >`SELECT id, source_url, source_title, content, chunk_index, 1 - (embedding <=> ${vectorString}::vector) AS similarity FROM chunks ${whereClause} ORDER BY embedding <=> ${vectorString}::vector LIMIT ${topK}`;

  return result;
}

// ============================================
// Query classification : let an LLM pick the source
// ============================================

const ClassifiedQueryOutputSchema = z.object({
  source_title: z
    .string()
    .describe(
      "The title of the source to query, return null if nothing relevant is found",
    )
    .nullable(),
});

async function classifyQuery(question: string): Promise<string | null> {
  // First, get the list of available source titles from DB
  const titles = await sql<{ source_title: string }[]>`
    SELECT DISTINCT source_title FROM chunks WHERE source_title IS NOT NULL
  `;

  const availableSources = titles.map((t) => "- " + t.source_title).join("\n");

  // YOUR TURN: use generateText with structured output OR a simple prompt
  // to classify the question into one of the available sources, or "none"
  const result = await generateText({
    model: anthropic.languageModel("claude-sonnet-4-5"),
    system:
      "You are a query router. Your job is to pick the most relevant documentation source for a user question. You MUST return either an exact source title from the provided list, or null. NEVER invent a new title.",
    prompt:
      "Given these sources, which one is most relevant for this question?" +
      "\n\n" +
      availableSources +
      "\n\n" +
      `
      [Question]: "${question}"

  
      
      Return the exact source title, or null if no source is clearly relevant.
      `,
    output: Output.object({ schema: ClassifiedQueryOutputSchema }),
  });

  console.log(
    `   🎯 Classified "${question}" → ${result.output.source_title ?? "none"}`,
  );

  return result.output.source_title;
}

// ============================================
// RAG: retrieval + generation
// ============================================

async function askWithRAG(
  question: string,
  filters: SearchFilters = {},
): Promise<void> {
  console.log(`\n🔍 Question: "${question}"`);
  if (filters.sourceTitle) {
    console.log(`   📌 Filter: source_title = "${filters.sourceTitle}"`);
  }
  console.log("─".repeat(80));

  const chunks = await findRelevantChunks(question, filters, 5);

  if (chunks.length === 0) {
    console.log("\n💬 No relevant chunks found.");
    return;
  }

  console.log(`\n📚 Found ${chunks.length} chunks:`);
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — score: ${Number(c.similarity).toFixed(3)}`,
    );
  });

  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] ${c.source_title}\nURL: ${c.source_url}\n\n${c.content}`,
    )
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    system: `You are a technical assistant that answers questions based STRICTLY on the provided sources.

Strict rules:
1. Use ONLY the information from the provided sources
2. Cite your sources using the format [Source N]
3. If the sources do not contain enough information, say so clearly
4. NEVER invent information that is not in the sources
5. Reply in the same language as the user's question`,
    prompt: `Sources:

${context}

---

Question: ${question}`,
  });

  console.log("\n💬 Answer:");
  console.log(text);
}

// ============================================
// Main: hybrid search tests
// ============================================

async function main() {
  const query = "How do I use this with structured outputs?";

  // Test 1: no filter, search everywhere
  console.log("\n" + "═".repeat(80));
  console.log("TEST 1: No filter");
  console.log("═".repeat(80));
  let chunks = await findRelevantChunks(query);
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — ${c.similarity.toFixed(3)}`,
    );
  });

  // Test 2: filtered on "Tool Calling"
  console.log("\n" + "═".repeat(80));
  console.log("TEST 2: Filtered on 'Tool Calling'");
  console.log("═".repeat(80));
  chunks = await findRelevantChunks(query, { sourceTitle: "Tool Calling" });
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — ${c.similarity.toFixed(3)}`,
    );
  });

  // Test 3: filtered on "Generating Structured Data"
  console.log("\n" + "═".repeat(80));
  console.log("TEST 3: Filtered on 'Generating Structured Data'");
  console.log("═".repeat(80));
  chunks = await findRelevantChunks(query, {
    sourceTitle: "Generating Structured Data",
  });
  chunks.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — ${c.similarity.toFixed(3)}`,
    );
  });

  // Test 4: filtered on a non-existing source
  console.log("\n" + "═".repeat(80));
  console.log("TEST 4: Filtered on 'Inexistant'");
  console.log("═".repeat(80));
  chunks = await findRelevantChunks(query, { sourceTitle: "Inexistant" });
  console.log(`  ${chunks.length} chunks found`);

  // Bonus: full RAG with filter
  console.log("\n" + "═".repeat(80));
  console.log("TEST 5: Full RAG with filter on 'Tool Calling'");
  console.log("═".repeat(80));
  await askWithRAG("How do I define and use tools?", {
    sourceTitle: "Tool Calling",
  });

  // Test 6: Test with classified query
  const routingTests = [
    "How do I stream a response?", // → Streaming
    "What's an embedding?", // → Embeddings
    "How to use tools with my agent?", // → Tool Calling
    "What's the weather like today?", // → null (off-topic)
  ];

  console.log("\n" + "═".repeat(80));
  console.log("TEST 6: Auto-routing with classifyQuery");
  console.log("═".repeat(80));

  for (const q of routingTests) {
    const classified = await classifyQuery(q);
    console.log(
      `Q: "${q}"\n   → Routed to: ${classified ?? "none (no filter)"}\n`,
    );
  }

  await sql.end();
}

main().catch(console.error);
