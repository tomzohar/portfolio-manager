import { ApexOptions } from 'apexcharts';
import { ChartConfig, ChartType } from '../../types';
import { ChartTransformer } from './chart-transformer';

/**
 * Transformer for Cartesian-style charts: Line, Bar, Area.
 */
export class CartesianTransformer implements ChartTransformer {
    transform(config: ChartConfig): ApexOptions {
        const { type, series, options = {} } = config;

        return {
            series: (series || []).map(s => ({
                name: s?.name || 'Series',
                data: s?.data || [],
                color: s?.color,
                type: s?.type,
            })),
            xaxis: {
                type: options.xAxis?.show === false ? undefined : 'category',
                categories: options.xAxis?.categories,
                labels: {
                    style: {
                        colors: options.xAxis?.labels?.style?.colors || '#9e9e9e',
                        fontSize: options.xAxis?.labels?.style?.fontSize || '10px',
                    },
                    formatter: options.xAxis?.labels?.formatter as any,
                    rotate: -45,
                    rotateAlways: false,
                    hideOverlappingLabels: true,
                    trim: true,
                },
                tickAmount: 8,
                axisBorder: {
                    show: false,
                },
                axisTicks: {
                    show: false,
                },
            },
            yaxis: {
                labels: {
                    style: {
                        colors: options.yAxis?.labels?.style?.colors || '#71717b',
                        fontSize: options.yAxis?.labels?.style?.fontSize || '11px',
                    },
                    formatter: options.yAxis?.labels?.formatter as any,
                },
            },
            grid: {
                borderColor: options.xAxis?.grid?.color || '#27272a',
                strokeDashArray: 0,
            },
            stroke: {
                curve: type === 'bar' ? 'straight' : 'smooth',
                width: type === 'bar' ? 0 : 2,
            },
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: false,
                    columnWidth: '55%',
                },
            },
        };
    }
}
