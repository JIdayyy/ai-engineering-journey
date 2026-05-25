import "dotenv/config";
import { embed, embedMany, cosineSimilarity, type EmbedManyResult } from "ai";
import { openai } from "@ai-sdk/openai";
import { songs, type Song } from "./data/songs.js";
import { open } from "node:fs";

type SongWithEmbedding = {
  song: Song;
  embedding: number[];
};

async function buildEmbeddings(
  songs: Song[],
): Promise<Map<string, SongWithEmbedding>> {
  // Création d'un ID unique par chanson (titre + artist suffit ici)
  const indexed = songs.map((song) => ({
    id: `${song.title}::${song.artist}`,
    text: song.description,
    song,
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
    result.set(item.id, { song: item.song, embedding: embeddings[i] });
  });

  return result;
}

// ============================================
// À TOI : Fonction qui trouve les chansons les plus proches d'une requête
// ============================================
async function findSimilarSongs(
  query: string,
  songsWithEmbeddings: SongWithEmbeddin[],
  topK = 3,
) {
  // 1. Embed la requête (avec embed cette fois, pas embedMany)
  // 2. Pour chaque chanson, calculer cosineSimilarity entre embedding requête et embedding chanson
  // 3. Trier par similarité décroissante
  // 4. Retourner les topK avec leur score
  const embededquery = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  });

  const results = [];

  for (const songWithEmbedding of songsWithEmbeddings) {
    const similarity = cosineSimilarity(
      songWithEmbedding.embedding,
      embededquery.embedding,
    );
    results.push({ ...songWithEmbedding, similarity });
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, topK);
}

async function main() {
  console.log("Construction de la base...");
  const songsWithEmbeddings = await buildEmbeddings(songs);
  console.log(`${songsWithEmbeddings.size} chansons embeddées.\n`);

  // À TOI : Quelques requêtes de test pour valider que ça marche
  const queries = [
    "Quelque chose de mélancolique avec du piano pour un dimanche pluvieux",
    "Musique énergique pour faire du sport",
    "Du chill électronique pour coder le soir",
    "Quelque chose pour danser en soirée",
    "De la musique triste après une rupture",
  ];

  const embeddings = Array.from(songsWithEmbeddings.values());

  for (const query of queries) {
    console.log(`Requête : "${query}"`);
    const results = await findSimilarSongs(query, embeddings);
    console.log("Top 3 :");
    results.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.song.title} (${r.song.artist}) — score: ${r.similarity}`,
      );
    });
    console.log();
  }
}

main();
