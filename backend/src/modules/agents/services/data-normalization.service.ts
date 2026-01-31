import { Injectable, Logger } from '@nestjs/common';
import { ChartComponent } from '../types/a2ui.types';
import { resolveDataPath } from '../utils/a2ui.utils';

@Injectable()
export class DataNormalizationService {
  private readonly logger = new Logger(DataNormalizationService.name);

  /**
   * Normalizes a data model for A2UI components.
   * Specifically handles chart data normalization from "flat" arrays to "series/categories" format.
   */
  normalizeDataModel(
    components: any[],
    dataModel: Record<string, any>,
  ): Record<string, any> {
    let normalizedModel = { ...dataModel };

    for (const comp of components as Array<Record<string, unknown>>) {
      if (comp && typeof comp === 'object' && comp['component'] === 'Chart') {
        normalizedModel = this.normalizeChartData(
          comp as unknown as ChartComponent,
          normalizedModel,
        );
      }
    }

    return normalizedModel;
  }

  private normalizeChartData(
    chart: ChartComponent,
    dataModel: Record<string, any>,
  ): Record<string, any> {
    const path = chart.bindings.series;
    const seriesData = resolveDataPath(dataModel, path) as unknown;

    if (!Array.isArray(seriesData)) {
      return dataModel;
    }

    // Extract key from path for updating the model
    const key = path.startsWith('/')
      ? path.split('/').filter(Boolean)[0]
      : path;

    // If already in series format, skip
    if (
      seriesData.length > 0 &&
      typeof seriesData[0] === 'object' &&
      'data' in seriesData[0]
    ) {
      return dataModel;
    }

    const categories: string[] = [];
    const normalizedData: number[] = [];

    for (const item of seriesData) {
      if (typeof item === 'object' && item !== null) {
        const record = item as Record<string, unknown>;
        // Heuristic for X axis (Time/Date/Name)
        const xKey =
          chart.props.xKey ||
          Object.keys(record).find((k) => /date|time|name|label|x/i.test(k));
        // Heuristic for Y axis (Value/Price/Amount)
        const yKey =
          chart.props.yKey ||
          Object.keys(record).find(
            (k) => /value|price|amount|close|y/i.test(k) && k !== xKey,
          );

        if (xKey && yKey) {
          categories.push(String(record[xKey]));
          const val = parseFloat(String(record[yKey]));
          normalizedData.push(isNaN(val) ? 0 : val);
        } else if (yKey) {
          const val = parseFloat(String(record[yKey]));
          normalizedData.push(isNaN(val) ? 0 : val);
        }
      } else if (typeof item === 'number') {
        normalizedData.push(item);
      } else if (typeof item === 'string') {
        const val = parseFloat(item);
        normalizedData.push(isNaN(val) ? 0 : val);
      }
    }

    // Update the data model with normalized format
    return {
      ...dataModel,
      [key]: [{ name: chart.props.title || 'Series', data: normalizedData }],
      [`${key}_categories`]: categories.length > 0 ? categories : undefined,
    };
  }
}
