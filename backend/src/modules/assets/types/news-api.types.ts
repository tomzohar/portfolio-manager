export interface SerpApiNewsResponse {
  search_metadata?: {
    id: string;
    status: string;
    created_at: string;
    processed_at: string;
    google_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters?: {
    engine: string;
    q: string;
    google_domain: string;
    tbm: string;
  };
  search_information?: {
    query_displayed: string;
    total_results: number;
    time_taken_displayed: number;
    organic_results_state: string;
  };
  news_results?: Array<{
    position?: number;
    title: string;
    link: string;
    source: string;
    date: string;
    snippet?: string;
    thumbnail?: string;
  }>;
}

export interface NewsArticle {
  title: string;
  snippet: string;
  link: string;
  publishedDate: string;
}
