import "dotenv/config";
import { embed, generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { sql } from "./database/db.js";
import z from "zod";
import type { SearchFilters, SearchResult } from "./types.js";
import { rerank } from "./utils/cohere.js";

// ============================================
// Retrieval with optional filters
// ============================================

async function findRelevantChunks(
  query: string,
  filters: SearchFilters = {},
  topK = 5,
): Promise<SearchResult[]> {
  const embededQuery = await embed({
    value: query,
    model: openai.embeddingModel("text-embedding-3-small"),
  });

  const vectorString = `[${embededQuery.embedding.join(",")}]`;

  const whereClause = filters.sourceTitle
    ? sql`WHERE source_title = ${filters.sourceTitle}`
    : sql``;

  const result = await sql<SearchResult[]>`
    SELECT 
      id, 
      source_url, 
      source_title, 
      content, 
      chunk_index, 
      1 - (embedding <=> ${vectorString}::vector) AS similarity 
    FROM chunks 
    ${whereClause} 
    ORDER BY embedding <=> ${vectorString}::vector 
    LIMIT ${topK}
  `;

  return result;
}

// ============================================
// Query classification: let an LLM pick the source
// ============================================

const ClassifiedQueryOutputSchema = z.object({
  source_title: z
    .string()
    .nullable()
    .describe(
      "The title of the source to query, return null if nothing relevant is found",
    ),
});

async function classifyQuery(question: string): Promise<string | null> {
  const titles = await sql<{ source_title: string }[]>`
    SELECT DISTINCT source_title FROM chunks WHERE source_title IS NOT NULL
  `;

  const availableSources = titles.map((t) => "- " + t.source_title).join("\n");

  const result = await generateText({
    model: anthropic.languageModel("claude-sonnet-4-5"),
    system:
      "You are a query router. Your job is to pick the most relevant documentation source for a user question. You MUST return either an exact source title from the provided list, or null. NEVER invent a new title.",
    prompt: `Given these sources, which one is most relevant for this question?

${availableSources}

[Question]: "${question}"

Return the exact source title, or null if no source is clearly relevant.`,
    output: Output.object({ schema: ClassifiedQueryOutputSchema }),
  });

  console.log(
    `   🎯 Classified "${question}" → ${result.output.source_title ?? "none"}`,
  );

  return result.output.source_title;
}

// ============================================
// RAG: retrieval + (optional rerank) + generation
// ============================================

type RAGOptions = {
  useRerank?: boolean;
  topK?: number;
};

async function askWithRAG(
  question: string,
  filters: SearchFilters = {},
  options: RAGOptions = { useRerank: true, topK: 5 },
): Promise<void> {
  const useRerank = options.useRerank ?? true;
  const topK = options.topK ?? 5;

  console.log(`\n🔍 Question: "${question}"`);
  if (filters.sourceTitle) {
    console.log(`   📌 Filter: source_title = "${filters.sourceTitle}"`);
  }
  console.log(`   ⚙️  useRerank=${useRerank}, topK=${topK}`);
  console.log("─".repeat(80));

  // Retrieve more candidates if reranking is enabled
  const candidatesCount = useRerank ? 20 : topK;
  const candidates = await findRelevantChunks(
    question,
    filters,
    candidatesCount,
  );

  // Optionally rerank to keep top K most relevant
  const chunks = useRerank
    ? await rerank(question, candidates, topK)
    : candidates;

  if (chunks.length === 0) {
    console.log("\n💬 No relevant chunks found.");
    return;
  }

  console.log(`\n📚 Final ${chunks.length} chunks used:`);
  chunks.forEach((c, i) => {
    const rerankInfo = useRerank
      ? ` — rerank: ${(c as any).rerank_score?.toFixed(3) ?? "N/A"}`
      : "";
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — cosine: ${Number(c.similarity).toFixed(3)}${rerankInfo}`,
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
// Main: reranking tests
// ============================================

async function main() {
  // ============================================
  // TEST 1: Direct comparison — no rerank vs rerank
  // ============================================
  console.log("\n" + "═".repeat(80));
  console.log("TEST 1: Compare retrieval — without vs with reranking");
  console.log("═".repeat(80));

  const compareQuestions = [
    "How do I handle errors when streaming text?",
    "How do I use tools with structured outputs in the same call?",
    "What's the difference between cosineSimilarity and embedMany?",
  ];

  for (const question of compareQuestions) {
    console.log(`\n❓ Question: "${question}"`);
    console.log("─".repeat(80));

    // Retrieve 20 candidates (large net)
    const candidates = await findRelevantChunks(question, {}, 20);

    // Show top 5 by cosine similarity only
    console.log("\n📊 Top 5 by COSINE SIMILARITY only:");
    candidates.slice(0, 5).forEach((c, i) => {
      console.log(
        `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — cosine: ${c.similarity.toFixed(3)}`,
      );
    });

    // Rerank the 20 candidates, keep top 5
    const reranked = await rerank(question, candidates, 5);

    console.log("\n🎯 Top 5 after RERANKING:");
    reranked.forEach((c, i) => {
      console.log(
        `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — rerank: ${(c as any).rerank_score?.toFixed(3) ?? "N/A"}`,
      );
    });

    // Show what changed
    const cosineIds = candidates.slice(0, 5).map((c) => c.id);
    const rerankIds = reranked.map((c) => c.id);
    const removed = cosineIds.filter((id) => !rerankIds.includes(id));
    const added = rerankIds.filter((id) => !cosineIds.includes(id));

    console.log("\n🔀 Changes from reranking:");
    console.log(`   Removed from top 5: ${removed.length} chunks`);
    console.log(`   Added to top 5: ${added.length} chunks`);
  }

  // ============================================
  // TEST 2: Full RAG with vs without reranking
  // ============================================
  console.log("\n" + "═".repeat(80));
  console.log("TEST 2: Full RAG comparison — answer quality");
  console.log("═".repeat(80));

  const ragQuestion =
    "How do I handle errors when streaming and what callbacks are available?";

  console.log(`\n❓ Question: "${ragQuestion}"`);

  // Version A: no rerank, top 5 cosine
  console.log("\n─── VERSION A: Without reranking ───");
  await askWithRAG(ragQuestion, {}, { useRerank: false });

  // Version B: rerank top 20 → top 5
  console.log("\n─── VERSION B: With reranking ───");
  await askWithRAG(ragQuestion, {}, { useRerank: true });

  // ============================================
  // TEST 3: Edge case — does rerank help with a poorly-formulated query?
  // ============================================
  console.log("\n" + "═".repeat(80));
  console.log("TEST 3: Poorly formulated query");
  console.log("═".repeat(80));

  const badQuery = "thing that show response word by word"; // vague, no keywords

  console.log(`\n❓ Vague question: "${badQuery}"`);
  console.log("─".repeat(80));

  const badCandidates = await findRelevantChunks(badQuery, {}, 20);

  console.log("\n📊 Top 5 by COSINE:");
  badCandidates.slice(0, 5).forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — ${c.similarity.toFixed(3)}`,
    );
  });

  const badReranked = await rerank(badQuery, badCandidates, 5);

  console.log("\n🎯 Top 5 after RERANK:");
  badReranked.forEach((c, i) => {
    console.log(
      `  [${i + 1}] ${c.source_title} (chunk #${c.chunk_index}) — ${(c as any).rerank_score?.toFixed(3) ?? "N/A"}`,
    );
  });

  // ============================================
  // Cleanup
  // ============================================
  await sql.end();
}

main().catch(console.error);
