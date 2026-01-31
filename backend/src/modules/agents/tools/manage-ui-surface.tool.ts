import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { UISurfaceService } from '../services/ui-surface.service';
import { A2UICatalogService } from '../services/a2ui-catalog.service';
import {
  ManageUISurfaceToolSchema,
  ManageUISurfaceInput,
  A2UIComponent,
} from '../types/a2ui.types';

@Injectable()
export class ManageUISurfaceTool extends DynamicStructuredTool {
  private readonly logger = new Logger(ManageUISurfaceTool.name);

  constructor(
    private readonly uiSurfaceService: UISurfaceService,
    private readonly catalogService: A2UICatalogService,
  ) {
    super({
      name: 'manage_ui_surface',
      description: `Create or update a UI surface to display interactive components.
            
COMPONENTS:
- Text: { "component": "Text", "props": { "text": string, "variant": "h1"|"h2"|"body"|"caption" } }
- Chart: { "component": "Chart", "props": { "type": "line"|"bar"|"pie", "title": string }, "bindings": { "series": "/path" } }
- Button: { "component": "Button", "props": { "label": string, "action": string, "context": object } }

PROCESS:
1. Call this tool to get a 'surfaceId'.
2. Embed <a2ui-surface id="ID" /> in your final response.`,
      schema: ManageUISurfaceToolSchema,
      func: async (input: ManageUISurfaceInput, _runManager, config) => {
        try {
          this.logger.log(`Executing manage_ui_surface: ${input.action}`);

          const userId = config?.configurable?.userId as string;
          const threadId = config?.configurable?.thread_id as string;

          if (!userId || !threadId) {
            throw new Error(
              'User ID and Thread ID are required for UI surface management',
            );
          }

          const { components, dataModel } = this.parseInputs(input);

          if (input.action === 'create') {
            return await this.validateAndCreate(
              userId,
              threadId,
              components,
              dataModel,
            );
          }

          if (input.action === 'update') {
            return await this.validateAndUpdate(
              input.surfaceId,
              components,
              dataModel,
            );
          }

          return JSON.stringify({ status: 'error', message: 'Invalid action' });
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Error in manage_ui_surface: ${errorMessage}`);
          return JSON.stringify({ status: 'error', message: errorMessage });
        }
      },
    });
  }

  /**
   * Parse and validate raw JSON inputs from the tool
   */
  private parseInputs(input: ManageUISurfaceInput): {
    components: A2UIComponent[];
    dataModel: Record<string, any>;
  } {
    let components: A2UIComponent[] = [];
    if (input.components) {
      try {
        components = JSON.parse(input.components) as A2UIComponent[];
      } catch {
        throw new Error('components must be a valid JSON string array');
      }
    }

    let dataModel: Record<string, any> = {};
    if (input.dataModel) {
      try {
        dataModel = JSON.parse(input.dataModel) as Record<string, any>;
      } catch {
        throw new Error('dataModel must be a valid JSON string object');
      }
    }

    return { components, dataModel };
  }

  /**
   * Validate components and create a new surface
   */
  private async validateAndCreate(
    userId: string,
    threadId: string,
    components: A2UIComponent[],
    dataModel: Record<string, any>,
  ): Promise<string> {
    if (components.length > 0) {
      this.catalogService.validateComponents(components);
    }

    const surface = await this.uiSurfaceService.createSurface(
      userId,
      threadId,
      components,
      dataModel,
    );

    return JSON.stringify({
      status: 'success',
      surfaceId: surface.id,
      message: `Surface created. Embed <a2ui-surface id="${surface.id}" /> in your response.`,
    });
  }

  /**
   * Validate components and update an existing surface
   */
  private async validateAndUpdate(
    surfaceId: string | undefined,
    components: A2UIComponent[],
    dataModel: Record<string, any>,
  ): Promise<string> {
    if (!surfaceId) {
      throw new Error('surfaceId is required for update action');
    }

    if (components.length > 0) {
      this.catalogService.validateComponents(components);
    }

    const surface = await this.uiSurfaceService.updateSurface(
      surfaceId,
      components,
      dataModel,
    );

    return JSON.stringify({
      status: 'success',
      surfaceId: surface.id,
      message: 'Surface updated successfully.',
    });
  }
}
