import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return pool;
}

export async function initNeonDatabase(): Promise<boolean> {
  const db = getDbPool();
  if (!db) {
    console.log('[Neon] No DATABASE_URL provided. Neon storage routes will wait for connection string.');
    return false;
  }

  try {
    const client = await db.connect();
    try {
      // Create tables for SOP documents and user profiles
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255),
          name VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sops (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL,
          judul_sop VARCHAR(500) NOT NULL,
          nomor_sop VARCHAR(255),
          madrasah VARCHAR(255),
          satker1 VARCHAR(255),
          satker2 VARCHAR(255),
          alamat_madrasah TEXT,
          nama_kepala VARCHAR(255),
          nip_kepala VARCHAR(100),
          logo_url TEXT,
          tgl_pembuatan VARCHAR(100),
          tgl_revisi VARCHAR(100),
          tgl_efektif VARCHAR(100),
          dasar_hukum JSONB DEFAULT '[]'::jsonb,
          kualifikasi_pelaksana JSONB DEFAULT '[]'::jsonb,
          keterkaitan JSONB DEFAULT '[]'::jsonb,
          peralatan_perlengkapan JSONB DEFAULT '[]'::jsonb,
          peringatan JSONB DEFAULT '[]'::jsonb,
          pencatatan_pendataan JSONB DEFAULT '[]'::jsonb,
          prosedur JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sops_user_id ON sops(user_id);
        CREATE INDEX IF NOT EXISTS idx_sops_created_at ON sops(created_at DESC);
      `);
      console.log('[Neon] Neon PostgreSQL schema initialized successfully.');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Neon] Failed to connect/initialize Neon database:', error);
    return false;
  }
}
