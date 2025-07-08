export interface SearchResult {
  id: string;
  title: string;
  popularity: number;
  distance: number;
  relevanceScore?: number;
}

export function clusterResults(results: SearchResult[]): SearchResult[] {
  return results;
}
