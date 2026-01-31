import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UISurface } from '../entities/ui-surface.entity';
import { A2UICatalogService } from './a2ui-catalog.service';
import { DataNormalizationService } from './data-normalization.service';

/**
 * UISurfaceService
 *
 * Logic for managing A2UI surfaces, their components, and data models.
 * Handles persistence and triggers real-time updates via SSE (EventEmitter).
 */
@Injectable()
export class UISurfaceService {
  private readonly logger = new Logger(UISurfaceService.name);

  constructor(
    @InjectRepository(UISurface)
    private readonly surfaceRepository: Repository<UISurface>,
    private readonly catalogService: A2UICatalogService,
    private readonly normalizationService: DataNormalizationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new A2UI surface.
   */
  async createSurface(
    userId: string,
    threadId: string,
    components: any[] = [],
    dataModel: Record<string, any> = {},
  ): Promise<UISurface> {
    // Normalize data model based on components
    const normalizedDataModel = this.normalizationService.normalizeDataModel(
      components,
      dataModel,
    );

    const surface = this.surfaceRepository.create({
      userId,
      threadId,
      components,
      dataModel: normalizedDataModel,
    });

    const saved = await this.surfaceRepository.save(surface);

    // Emit event for real-time streaming
    this.eventEmitter.emit('a2ui.surface.create', {
      threadId,
      userId,
      surfaceId: saved.id,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  /**
   * Gets a surface by ID with security check.
   */
  async getSurfaceOrFail(id: string, userId: string): Promise<UISurface> {
    const surface = await this.surfaceRepository.findOne({ where: { id } });

    if (!surface) {
      throw new NotFoundException(`UI Surface ${id} not found`);
    }

    if (surface.userId !== userId) {
      throw new ForbiddenException('Cannot access other users UI surfaces');
    }

    return surface;
  }

  /**
   * Updates components for a specific surface.
   * Performs validation against the catalog.
   */
  async updateComponents(
    id: string,
    userId: string,
    components: any[],
  ): Promise<UISurface> {
    const surface = await this.getSurfaceOrFail(id, userId);

    // Validate against catalog
    const validatedComponents =
      this.catalogService.validateComponents(components);

    // Re-normalize data model with new component definitions
    surface.dataModel = this.normalizationService.normalizeDataModel(
      validatedComponents,
      surface.dataModel,
    );

    // Update state
    surface.components = validatedComponents;
    const saved = await this.surfaceRepository.save(surface);

    // Emit live update
    this.eventEmitter.emit('a2ui.surface.updateComponents', {
      threadId: surface.threadId,
      userId: surface.userId,
      surfaceId: surface.id,
      components: validatedComponents,
      dataModel: surface.dataModel, // Include updated data model if normalization changed it
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  /**
   * Updates the data model for a surface.
   */
  async updateDataModel(
    id: string,
    userId: string,
    data: Record<string, any>,
  ): Promise<UISurface> {
    const surface = await this.getSurfaceOrFail(id, userId);

    // Merge and Normalize
    const mergedData = { ...surface.dataModel, ...data };
    surface.dataModel = this.normalizationService.normalizeDataModel(
      surface.components,
      mergedData,
    );

    const saved = await this.surfaceRepository.save(surface);

    // Emit live update
    this.eventEmitter.emit('a2ui.surface.updateDataModel', {
      threadId: surface.threadId,
      userId: surface.userId,
      surfaceId: surface.id,
      dataModel: surface.dataModel,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async updateSurface(
    id: string,
    components?: any[],
    dataModel?: Record<string, any>,
  ): Promise<UISurface> {
    const surface = await this.surfaceRepository.findOne({ where: { id } });

    if (!surface) {
      throw new NotFoundException(`UI Surface ${id} not found`);
    }

    if (components) {
      surface.components = components;
    }

    if (dataModel) {
      surface.dataModel = { ...surface.dataModel, ...dataModel };
    }

    // Normalize after merge
    surface.dataModel = this.normalizationService.normalizeDataModel(
      surface.components,
      surface.dataModel,
    );

    if (components) {
      this.eventEmitter.emit('a2ui.surface.update_components', {
        surfaceId: id,
        components: surface.components,
        dataModel: surface.dataModel,
        timestamp: new Date(),
      });
    } else if (dataModel) {
      this.eventEmitter.emit('a2ui.surface.update_data_model', {
        surfaceId: id,
        dataModel: surface.dataModel,
        timestamp: new Date(),
      });
    }

    return this.surfaceRepository.save(surface);
  }
}
