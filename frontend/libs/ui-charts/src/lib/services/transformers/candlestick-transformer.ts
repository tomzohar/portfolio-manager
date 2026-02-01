import { ApexOptions } from 'apexcharts';
import { ChartConfig } from '../../types';
import { ChartTransformer } from './chart-transformer';

/**
 * Transformer for financial candlestick charts.
 */
export class CandlestickTransformer implements ChartTransformer {
    transform(config: ChartConfig): ApexOptions {
        const { series, options = {} } = config;

        return {
            series: (series || []).map(s => ({
                name: s?.name || 'Candlestick',
                data: s?.data || [],
            })),
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: options.xAxis?.labels?.style?.colors || '#9e9e9e',
                        fontSize: '10px',
                    },
                },
            },
            yaxis: {
                tooltip: {
                    enabled: true,
                },
                labels: {
                    style: {
                        colors: options.yAxis?.labels?.style?.colors || '#71717b',
                        fontSize: '11px',
                    },
                },
            },
            grid: {
                borderColor: '#27272a',
            },
        };
    }
}
