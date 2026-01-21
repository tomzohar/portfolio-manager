/**
 * Generic chart configuration interface.
 * Designed to be serializable (JSON) for AI generation.
 */

export type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'candlestick';

export interface ChartSeries {
  name: string;
  data: number[] | { x: string | number; y: number }[];
  color?: string;
  type?: ChartType; // For mixed charts
}

export interface ChartAxisConfig {
  show?: boolean;
  title?: string;
  labels?: {
    formatter?: (value: number | string) => string;
    style?: {
      colors?: string;
      fontSize?: string;
    };
  };
  grid?: {
    show?: boolean;
    color?: string;
  };
}

export interface ChartLegendConfig {
  show?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  fontSize?: string;
  fontFamily?: string;
  colors?: string[];
}

export interface ChartTooltipConfig {
  enabled?: boolean;
  theme?: 'light' | 'dark';
  backgroundColor?: string;
  borderColor?: string;
  formatter?: (value: number, opts?: any) => string;
}

export interface ChartOptions {
  theme?: 'light' | 'dark';
  height?: number | string;
  width?: number | string;
  animations?: boolean;
  toolbar?: {
    show?: boolean;
    tools?: {
      download?: boolean;
      zoom?: boolean;
    };
  };
  xAxis?: ChartAxisConfig;
  yAxis?: ChartAxisConfig;
  legend?: ChartLegendConfig;
  tooltip?: ChartTooltipConfig;
  responsive?: Array<{
    breakpoint: number;
    options: Partial<ChartOptions>;
  }>;
}

export interface ChartMetadata {
  title?: string;
  description?: string;
  insights?: string[]; // AI-generated insights
  tags?: string[];
  createdBy?: 'user' | 'ai';
  createdAt?: Date;
}

export interface ChartConfig {
  type: ChartType;
  series: ChartSeries[];
  options?: ChartOptions;
  metadata?: ChartMetadata;
}

export interface ChartInstance {
  id: string;
  config: ChartConfig;
  // Internal reference to ApexCharts instance (opaque)
  _internalChart?: any;
}

