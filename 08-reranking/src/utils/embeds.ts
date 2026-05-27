import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

type ChunkEmbed = {
  id: number;
  chunk: string;
  embedding: number[];
};

export async function buildEmbeddings(chunks: string[]): Promise<ChunkEmbed[]> {
  const indexed = chunks.map((chunk, index) => ({
    id: index,
    chunk,
  }));

  const { embeddings } = await embedMany({
    model: openai.embeddingModel("text-embedding-3-small"),
    values: indexed.map((i) => i.chunk),
  });

  const result = new Map<number, ChunkEmbed>();

  indexed.forEach((item, i) => {
    if (!embeddings[i]) {
      return null;
    }
    result.set(item.id, { ...item, embedding: embeddings[i] });
  });

  return Array.from(result.values());
}
