import express from 'express';
import path from 'path';
import { getDbPool, initNeonDatabase } from './src/server/db.js';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// 1. Health check & database status endpoint
app.get('/api/health', async (req, res) => {
  const pool = getDbPool();
  let dbStatus = 'disconnected';
  let message = 'DATABASE_URL not set';

  if (pool) {
    try {
      const result = await pool.query('SELECT NOW() as now, version() as version');
      dbStatus = 'connected';
      message = `Connected to Neon PostgreSQL (${result.rows[0].version.split(' ')[0]})`;
    } catch (err: any) {
      dbStatus = 'error';
      message = err.message || 'Database query error';
    }
  }

  res.json({
    status: 'ok',
    storage: 'neon_postgres',
    database: {
      status: dbStatus,
      message,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
    }
  });
});

// 2. Test/Save Neon Connection String dynamically (e.g. from UI modal if user enters it)
app.post('/api/config/database-url', async (req, res) => {
  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'Connection string is required' });
  }

  // Set environment variable in memory
  process.env.DATABASE_URL = connectionString;
  const initialized = await initNeonDatabase();
  
  if (initialized) {
    return res.json({ success: true, message: 'Berhasil terhubung ke Neon PostgreSQL!' });
  } else {
    return res.status(400).json({ error: 'Gagal menghubungkan ke Neon. Periksa format URL koneksi Anda.' });
  }
});

// 3. GET all SOPs for a user
app.get('/api/sops', async (req, res) => {
  const userId = (req.query.userId as string) || 'guest';
  const pool = getDbPool();

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_URL Neon belum diatur. Harap masukkan Connection String Neon.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM sops WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    const sops = result.rows.map((row) => ({
      id: row.id,
      satker1: row.satker1,
      satker2: row.satker2,
      madrasah: row.madrasah,
      alamatMadrasah: row.alamat_madrasah,
      namaKepala: row.nama_kepala,
      nipKepala: row.nip_kepala,
      logoUrl: row.logo_url,
      nomorSop: row.nomor_sop,
      tglPembuatan: row.tgl_pembuatan,
      tglRevisi: row.tgl_revisi,
      tglEfektif: row.tgl_efektif,
      judulSop: row.judul_sop,
      dasarHukum: row.dasar_hukum || [],
      kualifikasiPelaksana: row.kualifikasi_pelaksana || [],
      keterkaitan: row.keterkaitan || [],
      peralatanPerlengkapan: row.peralatan_perlengkapan || [],
      peringatan: row.peringatan || [],
      pencatatanPendataan: row.pencatatan_pendataan || [],
      prosedur: row.prosedur || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, sops });
  } catch (error: any) {
    console.error('[API] Error fetching SOPs:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat daftar SOP dari Neon' });
  }
});

// 4. SAVE / CREATE or UPDATE SOP in Neon
app.post('/api/sops', async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_URL Neon belum diatur. Harap masukkan Connection String Neon.'
    });
  }

  const {
    id,
    userId = 'guest',
    judulSop,
    nomorSop = '',
    madrasah = '',
    satker1 = '',
    satker2 = '',
    alamatMadrasah = '',
    namaKepala = '',
    nipKepala = '',
    logoUrl = '',
    tglPembuatan = '',
    tglRevisi = '',
    tglEfektif = '',
    dasarHukum = [],
    kualifikasiPelaksana = [],
    keterkaitan = [],
    peralatanPerlengkapan = [],
    peringatan = [],
    pencatatanPendataan = [],
    prosedur = []
  } = req.body;

  if (!judulSop) {
    return res.status(400).json({ error: 'Judul SOP wajib diisi' });
  }

  const sopId = id || `sop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Upsert into Neon PostgreSQL
    const queryText = `
      INSERT INTO sops (
        id, user_id, judul_sop, nomor_sop, madrasah, satker1, satker2,
        alamat_madrasah, nama_kepala, nip_kepala, logo_url,
        tgl_pembuatan, tgl_revisi, tgl_efektif,
        dasar_hukum, kualifikasi_pelaksana, keterkaitan, peralatan_perlengkapan,
        peringatan, pencatatan_pendataan, prosedur, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        judul_sop = EXCLUDED.judul_sop,
        nomor_sop = EXCLUDED.nomor_sop,
        madrasah = EXCLUDED.madrasah,
        satker1 = EXCLUDED.satker1,
        satker2 = EXCLUDED.satker2,
        alamat_madrasah = EXCLUDED.alamat_madrasah,
        nama_kepala = EXCLUDED.nama_kepala,
        nip_kepala = EXCLUDED.nip_kepala,
        logo_url = EXCLUDED.logo_url,
        tgl_pembuatan = EXCLUDED.tgl_pembuatan,
        tgl_revisi = EXCLUDED.tgl_revisi,
        tgl_efektif = EXCLUDED.tgl_efektif,
        dasar_hukum = EXCLUDED.dasar_hukum,
        kualifikasi_pelaksana = EXCLUDED.kualifikasi_pelaksana,
        keterkaitan = EXCLUDED.keterkaitan,
        peralatan_perlengkapan = EXCLUDED.peralatan_perlengkapan,
        peringatan = EXCLUDED.peringatan,
        pencatatan_pendataan = EXCLUDED.pencatatan_pendataan,
        prosedur = EXCLUDED.prosedur,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      sopId,
      userId,
      judulSop,
      nomorSop,
      madrasah,
      satker1,
      satker2,
      alamatMadrasah,
      namaKepala,
      nipKepala,
      logoUrl,
      tglPembuatan,
      tglRevisi,
      tglEfektif,
      JSON.stringify(dasarHukum),
      JSON.stringify(kualifikasiPelaksana),
      JSON.stringify(keterkaitan),
      JSON.stringify(peralatanPerlengkapan),
      JSON.stringify(peringatan),
      JSON.stringify(pencatatanPendataan),
      JSON.stringify(prosedur),
    ];

    const result = await pool.query(queryText, values);
    res.json({
      success: true,
      message: 'SOP Berhasil Disimpan ke Neon Database!',
      id: result.rows[0].id,
      updatedAt: result.rows[0].updated_at
    });
  } catch (error: any) {
    console.error('[API] Error saving SOP to Neon:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan SOP ke Neon' });
  }
});

// 5. DELETE SOP from Neon
app.delete('/api/sops/:id', async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_URL Neon belum diatur.'
    });
  }

  const { id } = req.params;
  try {
    await pool.query('DELETE FROM sops WHERE id = $1', [id]);
    res.json({ success: true, message: 'SOP berhasil dihapus dari Neon' });
  } catch (error: any) {
    console.error('[API] Error deleting SOP:', error);
    res.status(500).json({ error: error.message || 'Gagal menghapus SOP dari Neon' });
  }
});

// Mount Vite middleware in development or serve dist in production
async function startServer() {
  await initNeonDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Aplikasi MORA & SOP Full-Stack berjalan di port ${PORT}`);
  });
}

startServer();
