import { Type } from '@angular/core';
import { A2UITextComponent } from './a2ui-text.component';
import { A2UIButtonComponent } from './a2ui-button.component';
import { A2UIChartComponent } from './a2ui-chart.component';

/**
 * Registry of available A2UI components and their Angular implementations.
 */
export const A2UI_COMPONENT_REGISTRY: Record<string, Type<any>> = {
    'Text': A2UITextComponent,
    'Button': A2UIButtonComponent,
    'Chart': A2UIChartComponent,
};

/**
 * Fallback component for unknown types.
 */
export const A2UI_DEFAULT_COMPONENT = A2UITextComponent;
