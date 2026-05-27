export type SearchResult = {
  id: number;
  source_url: string;
  source_title: string;
  content: string;
  chunk_index: number;
  similarity: number;
  rerank_score?: number; // Optional, set by Cohere reranker
};
export type SearchFilters = {
  sourceTitle?: string | null;
};
