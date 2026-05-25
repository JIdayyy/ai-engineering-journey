import "dotenv/config";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { sql } from "./database/db.js";

type SearchResult = {
  id: number;
  title: string;
  artist: string;
  description: string;
  similarity: number;
};

async function findSimilarSongs(
  query: string,
  topK = 3,
): Promise<SearchResult[]> {
  const embededQuery = await embed({
    value: query,
    model: openai.embedding("text-embedding-3-small"),
  });

  const vectorString = `[${embededQuery.embedding.join(",")}]`;

  const result = await sql<SearchResult[]>` SELECT 
    id,
    title,
    artist,
    description,
    1 - (embedding <=> ${vectorString}::vector) AS similarity
  FROM songs
  ORDER BY embedding <=> ${vectorString}::vector
  LIMIT ${topK}`;

  return result;
}

async function main() {
  const queries = [
    "Quelque chose de mélancolique avec du piano pour un dimanche pluvieux",
    "Musique énergique pour faire du sport",
    "Du chill électronique pour coder le soir",
    "Quelque chose pour danser en soirée",
    "De la musique triste après une rupture",
  ];

  for (const query of queries) {
    console.log(`\nRequête : "${query}"`);
    const results = await findSimilarSongs(query);
    results.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.title} (${r.artist}) — score: ${Number(r.similarity).toFixed(3)}`,
      );
    });
  }

  await sql.end();
}

main().catch(console.error);
