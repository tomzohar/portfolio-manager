import { ApexOptions } from 'apexcharts';
import { ChartConfig } from '../../types';
import { ChartTransformer } from './chart-transformer';

/**
 * Transformer for radial charts: Pie and Donut.
 */
export class RadialTransformer implements ChartTransformer {
    transform(config: ChartConfig): ApexOptions {
        const { series, options = {} } = config;

        const labels: string[] = [];
        const data: number[] = [];

        // Handle extraction logic independently from Cartesian assumptions
        if (series.length === 1 && Array.isArray(series[0].data)) {
            this.extractFromSingleSeries(series[0].data, data, labels);
        } else {
            this.extractFromMultiSeries(series, data, labels);
        }

        const finalLabels = this.resolveLabels(labels, data, options);

        return {
            series: data,
            labels: finalLabels,
            plotOptions: {
                pie: {
                    expandOnClick: true,
                    donut: {
                        size: '70%',
                    },
                },
            },
            dataLabels: {
                enabled: true,
            },
        };
    }

    private extractFromSingleSeries(items: any[], data: number[], labels: string[]): void {
        items.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                const label = String(item['label'] || item['x'] || '');
                if (label) labels.push(label);
                data.push(Number(item['value'] || item['y'] || 0));
            } else if (typeof item === 'number') {
                data.push(item);
            }
        });
    }

    private extractFromMultiSeries(series: any[], data: number[], labels: string[]): void {
        series.forEach(s => {
            if (s.name && s.name !== 'Series') labels.push(s.name);

            if (typeof s.data === 'number') {
                data.push(s.data);
            } else if (Array.isArray(s.data)) {
                const firstPoint = s.data[0] as any;
                if (typeof firstPoint === 'number') {
                    data.push(firstPoint);
                } else if (typeof firstPoint === 'object' && firstPoint !== null) {
                    data.push(Number(firstPoint['value'] || firstPoint['y'] || 0));
                    const lbl = String(firstPoint['label'] || firstPoint['x'] || '');
                    if (lbl && labels.length < data.length) labels.push(lbl);
                }
            }
        });
    }

    private resolveLabels(labels: string[], data: number[], options: any): string[] {
        // Priority: 1. Clean explicit labels, 2. xAxis categories, 3. Fallback to "Slice N"
        const cleanLabels = labels.filter(l => l && l !== 'Series');
        const categoryLabels = options.xAxis?.categories || [];

        if (cleanLabels.length === data.length) return cleanLabels;
        if (categoryLabels.length === data.length) return categoryLabels;

        return data.map((_, i) => `Slice ${i + 1}`);
    }
}
