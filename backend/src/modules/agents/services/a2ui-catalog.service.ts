import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { A2UIComponentSchema } from '../types/a2ui.types';
import { normalizeComponentName, ensureComponentId } from '../utils/a2ui.utils';

/**
 * A2UI Component Catalog Service
 *
 * Defines the schema for allowed UI components and provides validation.
 * Ensures the agent can only generate safe, pre-approved components.
 */
@Injectable()
export class A2UICatalogService {
  private readonly logger = new Logger(A2UICatalogService.name);

  /**
   * Validates a single component definition.
   */
  validateComponent(component: Record<string, unknown>) {
    try {
      // Auto-correction
      if (typeof component['component'] === 'string') {
        component['component'] = normalizeComponentName(component['component']);
      }
      component['id'] = ensureComponentId(
        component['id'] as string | undefined,
      );

      return A2UIComponentSchema.parse(component);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        this.logger.error(
          `A2UI Component Validation Failed: ${JSON.stringify(error.issues)}`,
        );
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`A2UI Component Validation Failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Validates a list of components.
   */
  validateComponents(components: any[]) {
    return components.map((c) =>
      this.validateComponent(c as Record<string, unknown>),
    );
  }
}
