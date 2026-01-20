import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '../src/app.module';
import { TestDatabaseManager } from './helpers/test-database-manager';
import { App } from 'supertest/types';

/**
 * Global Test Context
 *
 * Provides a single NestJS application instance shared across ALL e2e tests.
 * This significantly improves test performance by:
 * - Initializing the app only once (instead of 13+ times)
 * - Reusing database connections
 * - Avoiding repeated module compilation
 *
 * Since Jest is configured with maxWorkers: 1, tests run sequentially
 * in the same process, making it safe to share the app instance.
 *
 * Trade-offs:
 * - PROS: Much faster test execution, simpler test code
 * - CONS: Tests must properly clean up their data (via TestDatabaseManager)
 *
 * Usage in test files:
 * ```typescript
 * import { getTestApp, getTestDataSource } from './global-test-context';
 *
 * describe('My Test Suite', () => {
 *   let app: INestApplication;
 *
 *   beforeAll(async () => {
 *     app = await getTestApp();
 *   });
 * });
 * ```
 */

let globalApp: INestApplication | null = null;
let globalDataSource: DataSource | null = null;
let globalDbManager: TestDatabaseManager | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the global test app
 * Only initializes once, subsequent calls return the existing instance
 */
async function initializeGlobalApp(): Promise<void> {
  if (globalApp) {
    return; // Already initialized
  }

  console.log('🚀 Initializing global test app (one-time setup)...');

  // Create test module
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Create and initialize app
  globalApp = moduleFixture.createNestApplication();
  globalApp.useGlobalPipes(new ZodValidationPipe());
  await globalApp.init();

  // Wait for async module initialization (LangGraph checkpoint tables)
  // Longer delay in CI environments
  const initDelay = process.env.CI ? 3000 : 1000;
  console.log(
    `⏳ Waiting ${initDelay}ms for async module initialization (checkpoint tables)...`,
  );
  await new Promise((resolve) => setTimeout(resolve, initDelay));

  // Get DataSource and create database manager
  globalDataSource = moduleFixture.get<DataSource>(DataSource);
  globalDbManager = new TestDatabaseManager(globalDataSource);

  console.log('✅ Global test app initialized successfully\n');
}

/**
 * Get the global test app instance
 * Initializes on first call, returns existing instance on subsequent calls
 *
 * @returns Promise<INestApplication> The shared app instance
 */
export async function getTestApp(): Promise<INestApplication<App>> {
  // Ensure initialization happens only once, even if called concurrently
  if (!initializationPromise) {
    initializationPromise = initializeGlobalApp();
  }

  await initializationPromise;

  if (!globalApp) {
    throw new Error('Global test app failed to initialize');
  }

  return globalApp;
}

/**
 * Get the global DataSource instance
 *
 * @returns DataSource The shared database connection
 */
export function getTestDataSource(): DataSource {
  if (!globalDataSource) {
    throw new Error(
      'Global DataSource not initialized. Call getTestApp() first.',
    );
  }
  return globalDataSource;
}

/**
 * Get the global database manager
 *
 * @returns TestDatabaseManager The shared database cleanup utility
 */
export function getTestDbManager(): TestDatabaseManager {
  if (!globalDbManager) {
    throw new Error(
      'Global DbManager not initialized. Call getTestApp() first.',
    );
  }
  return globalDbManager;
}

/**
 * Cleanup the global test app
 * Called from global teardown
 */
export async function cleanupGlobalApp(): Promise<void> {
  if (globalApp) {
    console.log('🧹 Closing global test app...');
    await globalApp.close();
    globalApp = null;
    globalDataSource = null;
    globalDbManager = null;
    initializationPromise = null;
    console.log('✅ Global test app closed\n');
  }
}
