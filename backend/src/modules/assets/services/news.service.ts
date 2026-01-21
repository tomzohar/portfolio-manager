import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, throwError } from 'rxjs';
import { SerpApiNewsResponse, NewsArticle } from '../types/news-api.types';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly baseUrl = 'https://serpapi.com/search';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('SERPAPI_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('SERPAPI_KEY not configured');
    }
  }

  /**
   * Search for news articles related to a ticker or query
   * @param ticker - The ticker symbol or search query
   * @returns Observable of news articles
   */
  searchNews(ticker: string): Observable<NewsArticle[]> {
    this.logger.log(`Searching news for: ${ticker}`);

    const params = {
      engine: 'google',
      tbm: 'nws', // Google News search
      q: ticker,
      api_key: this.apiKey,
    };

    return this.httpService
      .get<SerpApiNewsResponse>(this.baseUrl, { params })
      .pipe(
        map((response) => {
          const count = response.data.news_results?.length ?? 0;
          this.logger.log(
            `Successfully fetched ${count} news articles for ${ticker}`,
          );
          return this.mapToNewsArticles(response.data);
        }),
        catchError((error: Error) => {
          this.logger.error(
            `SerpAPI error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return throwError(
            () => new Error('Failed to fetch news from SerpAPI'),
          );
        }),
      );
  }

  /**
   * Maps SerpAPI response to standardized NewsArticle array
   * @param data - Raw SerpAPI response
   * @returns Array of NewsArticle
   */
  private mapToNewsArticles(data: SerpApiNewsResponse): NewsArticle[] {
    if (!data.news_results || data.news_results.length === 0) {
      return [];
    }

    return data.news_results.map((result) => ({
      title: result.title,
      snippet: result.snippet ?? '',
      link: result.link,
      publishedDate: result.date,
    }));
  }
}
