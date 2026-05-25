import "dotenv/config";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { songs, type Song } from "./data/songs.js";
import { sql } from "./database/db.js";

type SongWithEmbedding = Song & {
  embedding: number[];
};

async function buildEmbeddings(
  songs: Song[],
): Promise<Map<string, SongWithEmbedding>> {
  const indexed = songs.map((song) => ({
    id: `${song.title}::${song.artist}`,
    text: song.description,
    ...song,
  }));

  const { embeddings } = await embedMany({
    model: openai.embeddingModel("text-embedding-3-small"),
    values: indexed.map((i) => i.text),
  });

  const result = new Map<string, SongWithEmbedding>();

  indexed.forEach((item, i) => {
    if (!embeddings[i]) {
      return null;
    }
    result.set(item.id, { ...item, embedding: embeddings[i] });
  });

  return result;
}

async function main() {
  console.log("Génération des embeddings...");

  const embeddings = await buildEmbeddings(songs);

  console.log(`${embeddings.size} embeddings générés.`);

  console.log("Insertion en base...");

  const songsArray = Array.from(embeddings.values());

  for (const song of songsArray) {
    const vectorString = `[${song.embedding.join(",")}]`;
    await sql`INSERT INTO songs (title, artist, description, embedding) VALUES (${song.title}, ${song.artist}, ${song.description}, ${vectorString}::vector)`;
  }

  console.log("Terminé.");
  await sql.end();
}

main().catch(console.error);
