type E2eDbConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
};

const E2E_DB_CONFIG: E2eDbConfig = {
  host: 'localhost',
  port: '5433',
  username: 'postgres',
  password: 'postgres',
  database: 'stocks_researcher_e2e',
};

export function applyE2eDbEnv(): void {
  // Set e2e DB defaults to avoid touching development data.
  // In CI, environment variables can override these defaults.
  process.env.DB_HOST = process.env.DB_HOST || E2E_DB_CONFIG.host;
  process.env.DB_PORT = process.env.DB_PORT || E2E_DB_CONFIG.port;
  process.env.DB_USERNAME = process.env.DB_USERNAME || E2E_DB_CONFIG.username;
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || E2E_DB_CONFIG.password;
  process.env.DB_DATABASE = process.env.DB_DATABASE || E2E_DB_CONFIG.database;
}
