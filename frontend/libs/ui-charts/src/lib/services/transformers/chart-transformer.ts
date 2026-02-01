import { ApexOptions } from 'apexcharts';
import { ChartConfig } from '../../types';

/**
 * Strategy interface for transforming generic ChartConfig 
 * into ApexCharts-specific options.
 */
export interface ChartTransformer {
    /**
     * Transforms the generic config into ApexOptions.
     * @param config The generic chart configuration.
     * @returns ApexOptions for chart creation or update.
     */
    transform(config: ChartConfig): ApexOptions;
}
