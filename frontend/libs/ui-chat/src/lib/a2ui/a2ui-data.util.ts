import { resolveJsonPointer } from './json-pointer.util';

/**
 * Interface for the context needed for series formatting
 */
export interface ChartSeriesContext {
    rawData: any;
    dataModel: any;
    isPieChart: boolean;
    defaultTitle?: string;
}

/**
 * Formats raw data into ApexCharts compatible series format,
 * including resolving nested JSON pointers in series data.
 */
export function formatChartSeries(ctx: ChartSeriesContext): any[] {
    const { rawData, dataModel, isPieChart, defaultTitle } = ctx;
    let formattedSeries: any[] = [];

    if (Array.isArray(rawData)) {
        const first = rawData[0];
        const isSeriesArray =
            typeof first === 'object' && first !== null && 'data' in first;

        if (isSeriesArray) {
            // Resolve data pointers in the series
            formattedSeries = rawData.map((s: any) => {
                if (typeof s.data === 'string') {
                    return {
                        ...s,
                        data: resolveJsonPointer(dataModel, s.data) || [],
                    };
                }
                return s;
            });
        } else {
            // Fallback for raw data arrays (e.g., [40, 30, 20])
            formattedSeries = [
                {
                    name: defaultTitle || (isPieChart ? 'Allocation' : 'Series'),
                    data: rawData,
                },
            ];
        }
    }

    return formattedSeries;
}
