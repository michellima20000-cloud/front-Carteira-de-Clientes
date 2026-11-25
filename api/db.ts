import { Pool } from 'pg';

// Connection string from Render PostgreSQL
// Format: postgresql://user:password@host/database
const connectionString = process.env.DATABASE_URL!;

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Necessário para Render
  },
  // Connection pool configuration
  max: 20, // máximo de conexões simultâneas
  idleTimeoutMillis: 30000, // tempo que um cliente pode ficar ocioso
  connectionTimeoutMillis: 2000, // tempo máximo para estabelecer conexão
});
