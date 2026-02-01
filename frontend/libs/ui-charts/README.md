# Charting Infrastructure

This library provides a modular, strictly typed charting system built on top of **ApexCharts**. It is designed to be easily extensible and to seamlessly integrate with AI-generated UI surfaces.

## Architecture

The system follows a **Strategy Pattern** to decouple the generic chart configuration from the library-specific implementation.

### Core Components

1.  **`ChartService`**: An abstract base class defining the contract for chart lifecycle management (`create`, `update`, `destroy`, `resize`).
2.  **`ApexChartsService`**: A concrete implementation of `ChartService` that acts as a dispatcher. It delegates the transformation of generic configs to specific **Transformers**.
3.  **`ChartTransformer`**: An interface for transformation strategies. Each transformer is responsible for one or more chart "geometries" (e.g., Cartesian, Radial).
4.  **`ChartComponent`**: A generic Angular component that wraps the `ChartService`. It handles lifecycle hooks and re-creates the chart instance if the chart `type` changes to ensure clean rendering.

## Data Flow

The system adheres to a "trust the backend" principle:

1.  **Backend**: Generates a `ChartConfig` or a data model with `bindings`.
2.  **`A2UIChartComponent`**: Resolves data from the model and passes it to the `ui-charts` library.
3.  **`ApexChartsService`**: Selects the appropriate `ChartTransformer` based on the `config.type`.
4.  **Transformer**: Produces library-specific options (`ApexOptions`).

## Adding a New Chart Type

To add support for a new chart type (e.g., `radar` or `heatmap`):

### 1. Create a Transformer

Implement the `ChartTransformer` interface. If the new type shares geometry with an existing one, you might be able to extend an existing transformer.

```typescript
// HeatmapTransformer.ts
export class HeatmapTransformer implements ChartTransformer {
  transform(config: ChartConfig): ApexOptions {
    // Return heatmap-specific ApexOptions
  }
}
```

### 2. Register the Transformer

Update the `transformers` registry in `ApexChartsService`:

```typescript
// apex-charts.service.ts
private readonly transformers: Record<string, ChartTransformer> = {
  // ... existing transformers
  heatmap: new HeatmapTransformer(),
};
```

### 3. Update Types

Add the new type to the `ChartType` union in `chart-config.ts` to ensure full type safety.

## Best Practices

- **Single Responsibility**: Keep transformers focused on geometry-specific logic. Common options (theme, height, tooltip) should remain in the `ApexChartsService` dispatcher.
- **Strict Typing**: Avoid `any`. Use `ApexOptions` and the provided `Chart` interfaces.
- **Trust the Backend**: The frontend should perform minimal data manipulation. If the data structure is complex, the backend should provide it in a way that maps cleanly to `ChartSeries[]`.
- **Instance Re-creation**: If a chart type changes fundamentally (e.g., from `line` to `pie`), always re-create the chart instance to prevent ApexCharts rendering artifacts.
