import { CohereClient } from "cohere-ai";
import type { SearchResult } from "../types.js";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

export async function rerank(
  query: string,
  candidates: SearchResult[],
  topK = 5,
): Promise<SearchResult[]> {
  // 1. Préparer les documents (juste le contenu textuel)
  const documents = candidates.map((c) => c.content);

  // 2. Appeler Cohere Rerank
  const response = await cohere.rerank({
    model: "rerank-v3.5", // le modèle le plus récent
    query: query,
    documents: documents,
    topN: topK,
  });

  // 3. Mapper les résultats reranked sur tes candidates
  // Cohere retourne des indices vers le tableau initial
  return response.results.map((r) => ({
    ...candidates[r.index],
    rerank_score: r.relevanceScore,
  })) as (SearchResult & { rerank_score: number })[];
}
