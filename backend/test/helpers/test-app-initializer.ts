import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '../../src/app.module';
import { TestDatabaseManager } from './test-database-manager';

/**
 * Test App Initializer
 *
 * Centralizes the initialization logic for e2e tests to ensure:
 * 1. App is properly initialized
 * 2. Async module initialization (LangGraph checkpoint tables) completes
 * 3. Database is ready for tests
 *
 * This prevents race conditions where tests start before database tables are created.
 */

export interface InitializedTestApp {
  app: INestApplication;
  dataSource: DataSource;
  dbManager: TestDatabaseManager;
}

/**
 * Initialize a NestJS application for e2e testing
 *
 * @param options - Optional configuration
 * @param options.initDelayMs - Custom initialization delay (defaults to 1s local, 3s CI)
 * @returns Initialized app, dataSource, and database manager
 */
export async function initializeTestApp(options?: {
  initDelayMs?: number;
}): Promise<InitializedTestApp> {
  // Create test module
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Create and initialize app
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();

  // Wait for async module initialization to complete (LangGraph checkpoint tables)
  // Longer delay in CI environments which can be slower
  const defaultDelay = process.env.CI ? 3000 : 1000;
  const initDelay = options?.initDelayMs ?? defaultDelay;
  await new Promise((resolve) => setTimeout(resolve, initDelay));

  // Get DataSource and create database manager
  const dataSource = moduleFixture.get<DataSource>(DataSource);
  const dbManager = new TestDatabaseManager(dataSource);

  return {
    app,
    dataSource,
    dbManager,
  };
}

/**
 * Cleanup test app and database
 *
 * @param app - NestJS application to close
 * @param dbManager - Database manager for cleanup
 */
export async function cleanupTestApp(
  app: INestApplication,
  dbManager: TestDatabaseManager,
): Promise<void> {
  await dbManager.truncateAll();
  await app.close();
}
