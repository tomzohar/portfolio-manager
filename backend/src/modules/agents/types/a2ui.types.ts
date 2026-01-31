import { z } from 'zod';

/**
 * A2UI Component Types and Schemas
 */

// --- Base Component ---
export const BaseComponentSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .describe('Unique identifier for the component (generated if missing)'),
  weight: z.number().optional().describe('Flex weight for layout'),
  bindings: z
    .record(z.string(), z.string())
    .optional()
    .describe('JSON Pointer data bindings'),
});

export type BaseComponent = z.infer<typeof BaseComponentSchema>;

// --- Text Component ---
export const TextComponentSchema = BaseComponentSchema.extend({
  component: z.literal('Text'),
  props: z.object({
    text: z.string().describe('Text content to display'),
    variant: z
      .enum(['body', 'h1', 'h2', 'caption'])
      .default('body')
      .describe('Typography variant'),
  }),
});

export type TextComponent = z.infer<typeof TextComponentSchema>;

// --- Button Component ---
export const ButtonComponentSchema = BaseComponentSchema.extend({
  component: z.literal('Button'),
  props: z.object({
    label: z.string().describe('Button label text'),
    action: z.string().describe('Action name to trigger on click'),
    variant: z
      .enum(['filled', 'stroked', 'text'])
      .default('filled')
      .describe('Button visual variant'),
    color: z
      .enum(['primary', 'accent', 'warn'])
      .default('primary')
      .describe('Button color theme'),
    context: z
      .record(z.string(), z.any())
      .optional()
      .describe('Optional context data for the action'),
  }),
});

export type ButtonComponent = z.infer<typeof ButtonComponentSchema>;

// --- Chart Component ---
export const ChartComponentSchema = BaseComponentSchema.extend({
  component: z.literal('Chart'),
  props: z.object({
    type: z
      .enum(['line', 'bar', 'pie', 'area'])
      .describe('Type of chart to render'),
    title: z.string().optional().describe('Optional title for the chart'),
    height: z
      .number()
      .default(300)
      .describe('Fixed height of the chart in pixels'),
    xKey: z
      .string()
      .optional()
      .describe('Optional key for X axis if data is flat'),
    yKey: z
      .string()
      .optional()
      .describe('Optional key for Y axis if data is flat'),
    options: z
      .record(z.string(), z.any())
      .optional()
      .describe('Advanced ApexCharts options'),
  }),
  bindings: z.object({
    series: z
      .string()
      .describe('JSON Pointer path to the data series in the data model'),
  }),
});

export type ChartComponent = z.infer<typeof ChartComponentSchema>;

// --- Container Component ---
export const ContainerComponentSchema = BaseComponentSchema.extend({
  component: z.enum(['Row', 'Column']),
  props: z.object({
    children: z
      .array(z.string())
      .describe('Array of component IDs representing child elements'),
    gap: z.number().optional().describe('Spacing between children in pixels'),
  }),
});

export type ContainerComponent = z.infer<typeof ContainerComponentSchema>;

// --- Combined Catalog ---
export const A2UIComponentSchema = z.discriminatedUnion('component', [
  TextComponentSchema,
  ButtonComponentSchema,
  ChartComponentSchema,
  ContainerComponentSchema,
]);

export type A2UIComponent = z.infer<typeof A2UIComponentSchema>;

/**
 * Surface Management Schemas
 */
export const ManageUISurfaceToolSchema = z.object({
  action: z.enum(['create', 'update']).describe('Action to perform'),
  surfaceId: z
    .string()
    .uuid()
    .optional()
    .describe('Required for update action'),
  type: z
    .enum(['dashboard', 'component'])
    .default('component')
    .describe('Type of surface'),
  components: z
    .string()
    .optional()
    .describe(
      'JSON-encoded string array of components to render (e.g. "[{\\"component\\": \\"Text\\", \\"props\\": {\\"text\\": \\"Hello\\", \\"variant\\": \\"h1\\"}}]")',
    ),
  dataModel: z
    .string()
    .optional()
    .describe(
      'JSON-encoded string object for initial data model (e.g. "{\\"ticker\\": \\"NVDA\\", \\"price\\": 500}")',
    ),
});

export type ManageUISurfaceInput = z.infer<typeof ManageUISurfaceToolSchema>;
