import express from 'express';
import path from 'path';
import { getDbPool, initNeonDatabase } from './src/server/db.js';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { generateKemenagSopTemplate } from './src/services/sopTemplateGenerator.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini client configured according to standard guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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

// 6. Gemini API Status
app.get('/api/gemini/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: hasKey ? 'configured' : 'missing_key',
    hasApiKey: hasKey,
    model: 'gemini-3.8-flash'
  });
});

// 7. Gemini API - Generate SOP Content
app.post('/api/gemini/generate-sop', async (req, res) => {
  const { judulSop } = req.body;

  if (!judulSop || typeof judulSop !== 'string' || !judulSop.trim()) {
    return res.status(400).json({ error: 'Judul SOP wajib diisi' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi di server. Silakan pastikan API key telah terpasang di Settings > Secrets atau Environment Variables.'
    });
  }

  try {
    const prompt = `Hasilkan konten lengkap untuk Standar Operasional Prosedur (SOP) di Madrasah Kementerian Agama (Kemenag) Republik Indonesia dengan judul: "${judulSop.trim()}".
Pastikan nama jabatan pelaksana adalah jabatan riil yang ada di lingkungan Madrasah (seperti Kepala Madrasah, Guru, Kepala Tata Usaha, Staf Tata Usaha, Bendahara BOS, Komite Madrasah, Siswa, dll).

PENTING untuk field 'simbol' pada prosedur:
1. 'Terminator' untuk aktivitas awal (Mulai) dan akhir (Selesai).
2. 'Decision' jika aktivitas bersifat pemeriksaan, verifikasi, atau butuh persetujuan (pilihan Ya/Tidak).
3. 'Process' untuk aktivitas pengerjaan rutin teknis.
4. 'Connector' jika alur melompat atau berlanjut ke bagian lain.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah pakar penyusun Standar Operasional Prosedur (SOP) resmi Kementerian Agama Republik Indonesia untuk satuan pendidikan Madrasah (MI, MTs, MA, MAK). Hasilkan data yang terstruktur rapi, logis, dan mutlak sesuai format SOP Administrasi Pemerintahan Kemenag RI.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dasarHukum: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Daftar peraturan perundang-undangan, PMA, atau KMA yang relevan',
            },
            kualifikasiPelaksana: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Kualifikasi kompetensi pelaksana',
            },
            keterkaitan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Keterkaitan dengan SOP lainnya',
            },
            peralatanPerlengkapan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Peralatan dan perlengkapan yang dibutuhkan',
            },
            peringatan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Peringatan dampak jika SOP tidak dijalankan',
            },
            pencatatanPendataan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Pencatatan dan pendataan dokumen yang dihasilkan',
            },
            prosedur: {
              type: Type.ARRAY,
              description: 'Langkah-langkah berurutan dari mulai hingga selesai',
              items: {
                type: Type.OBJECT,
                properties: {
                  nomor: { type: Type.INTEGER },
                  aktivitas: { type: Type.STRING },
                  pelaksana: { type: Type.STRING },
                  simbol: { type: Type.STRING, description: 'Terminator | Process | Decision | Connector' },
                  mutuBaku: {
                    type: Type.OBJECT,
                    properties: {
                      persyaratan: { type: Type.STRING },
                      waktu: { type: Type.STRING },
                      output: { type: Type.STRING },
                    },
                    required: ['persyaratan', 'waktu', 'output'],
                  },
                },
                required: ['nomor', 'aktivitas', 'pelaksana', 'simbol', 'mutuBaku'],
              },
            },
          },
          required: [
            'dasarHukum',
            'kualifikasiPelaksana',
            'keterkaitan',
            'peralatanPerlengkapan',
            'peringatan',
            'pencatatanPendataan',
            'prosedur',
          ],
        },
      },
    });

    const rawText = (response.text || '{}').trim();
    // Clean any extra markdown artifacts if present
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanedText);

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[API] Gemini generate-sop error:', error);
    const errMsg = error.message || String(error);

    const isBillingOr403 = error.status === 403 || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403') || errMsg.includes('free tier is not available');
    const isQuotaOr429 = error.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');

    // If Gemini API is blocked by project billing or quota, provide standard Kemenag SOP template
    if (isBillingOr403 || isQuotaOr429) {
      console.warn('[API] Generating standard Kemenag SOP template due to Gemini API limits/billing:', errMsg);
      const fallbackData = generateKemenagSopTemplate(judulSop);
      return res.json({
        success: true,
        isFallback: true,
        notice: isBillingOr403
          ? 'Proyek Google Cloud ini memerlukan aktivasi billing (https://aistudio.google.com/billing) atau pemilihan API key aktif di Settings > Secrets. Konten SOP berhasil disusun menggunakan Struktur Standar SOP Kemenag RI.'
          : 'Kuota Gemini API sedang penuh. Konten SOP berhasil disusun menggunakan Struktur Standar SOP Kemenag RI.',
        data: fallbackData,
      });
    }

    if (error.status === 400 || errMsg.includes('API_KEY_INVALID')) {
      const fallbackData = generateKemenagSopTemplate(judulSop);
      return res.json({
        success: true,
        isFallback: true,
        notice: 'API Key Gemini tidak valid. Konten SOP berhasil disusun menggunakan Struktur Standar SOP Kemenag RI.',
        data: fallbackData,
      });
    }

    res.status(500).json({
      error: `Gagal memproses AI: ${errMsg}`,
    });
  }
});

// 8. Gemini API - General Text Generation
app.post('/api/gemini/generate', async (req, res) => {
  const { contents, systemInstruction } = req.body;

  if (!contents) {
    return res.status(400).json({ error: 'Contents parameter is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi di server. Silakan hubungkan API key di Settings > Secrets.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error('[API] Gemini generate error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Gemini generate error' });
  }
});

// 9. Gemini API - Server-Sent Events (SSE) Streaming
app.post('/api/gemini/stream', async (req, res) => {
  const { contents, systemInstruction } = req.body;

  if (!contents) {
    return res.status(400).json({ error: 'Contents parameter is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi di server. Silakan hubungkan API key di Settings > Secrets.',
    });
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[API] Gemini stream error:', error);
    if (!res.headersSent) {
      res.status(error.status || 500).json({ error: error.message || 'Gemini stream error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
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
