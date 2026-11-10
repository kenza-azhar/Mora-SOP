export interface SopTemplateResult {
  dasarHukum: string[];
  kualifikasiPelaksana: string[];
  keterkaitan: string[];
  peralatanPerlengkapan: string[];
  peringatan: string[];
  pencatatanPendataan: string[];
  prosedur: Array<{
    nomor: number;
    aktivitas: string;
    pelaksana: string;
    simbol: string;
    mutuBaku: {
      persyaratan: string;
      waktu: string;
      output: string;
    };
  }>;
}

export function generateKemenagSopTemplate(judul: string): SopTemplateResult {
  const judulClean = judul.trim();
  const judulLower = judulClean.toLowerCase();

  // Dasar hukum standar Kemenag & Madrasah
  const dasarHukum = [
    "Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional",
    "Peraturan Pemerintah Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan",
    "Peraturan Menteri Agama Nomor 90 Tahun 2013 tentang Penyelenggaraan Pendidikan Madrasah",
    "Peraturan Menteri Agama Nomor 19 Tahun 2019 tentang Organisasi dan Tata Kerja Kementerian Agama",
    "Peraturan Menteri Agama Nomor 6 Tahun 2022 tentang Perubahan atas PMA No. 19 Tahun 2019",
    "Keputusan Menteri Agama (KMA) terkait Petunjuk Teknis Tata Kelola dan Kurikulum Madrasah"
  ];

  const kualifikasiPelaksana = [
    "Memahami regulasi dan peraturan perundang-undangan di lingkungan Kementerian Agama",
    "Memahami alur dan tata kelola administrasi pendidikan madrasah",
    "Mampu mengoperasikan perangkat komputer, aplikasi perkantoran, dan internet",
    "Memiliki ketelitian, kedisiplinan, dan integritas dalam pelayanan madrasah"
  ];

  const keterkaitan = [
    "SOP Pengelolaan Tata Persuratan dan Kearsipan Madrasah",
    "SOP Layanan Terpadu Satu Pintu (PTSP) Madrasah",
    "SOP Pengelolaan Keuangan dan Pertanggungjawaban Madrasah",
    "SOP Penjaminan Mutu dan Pengawasan Internal Madrasah"
  ];

  const peralatanPerlengkapan = [
    "Perangkat Komputer / Laptop dan Jaringan Internet",
    "Printer, Scanner, dan Stempel Resmi Madrasah",
    "Buku Register / Lembar Disposisi / Buku Kendali Pelayanan",
    "Format Blanko / Formulir Pengajuan Dokumen",
    "Alat Tulis Kantor (ATK) dan Map Penyimpanan Berkas"
  ];

  const peringatan = [
    "Apabila SOP ini tidak dilaksanakan, alur administrasi dan pelayanan madrasah menjadi terhambat serta berpotensi menimbulkan ketidakpuasan publik.",
    "Setiap berkas harus diperiksa keabsahan dan kelengkapannya untuk mencegah kesalahan administratif dan hukum.",
    "Seluruh proses pelayanan harus menjunjung tinggi prinsip akuntabilitas, transparansi, dan bebas gratifikasi."
  ];

  const pencatatanPendataan = [
    "Buku Register Penerimaan dan Penyerahan Berkas",
    "Buku Agenda Disposisi Kepala Madrasah",
    "Arsip Dokumen Fisik dan File Digital pada Tata Usaha Madrasah"
  ];

  // Buat prosedur alur berdasarkan konteks
  const prosedur = [
    {
      nomor: 1,
      aktivitas: `Pemohon mengajukan permohonan/berkas terkait ${judulClean} melalui loket pelayanan atau petugas tata usaha`,
      pelaksana: "Pemohon / Siswa / Guru",
      simbol: "Terminator",
      mutuBaku: {
        persyaratan: "Berkas permohonan lengkap dan identitas sah",
        waktu: "15 Menit",
        output: "Tanda terima berkas permohonan"
      }
    },
    {
      nomor: 2,
      aktivitas: "Petugas Tata Usaha menerima, mencatat dalam buku register, serta memverifikasi kelengkapan dan keabsahan berkas",
      pelaksana: "Staf Tata Usaha",
      simbol: "Process",
      mutuBaku: {
        persyaratan: "Checklist kelengkapan persyaratan",
        waktu: "30 Menit",
        output: "Berkas terverifikasi & teragendakan"
      }
    },
    {
      nomor: 3,
      aktivitas: "Pemeriksaan validitas berkas: Apakah berkas lengkap dan memenuhi persyaratan yang ditentukan?",
      pelaksana: "Kepala Tata Usaha / Tim Verifikasi",
      simbol: "Decision",
      mutuBaku: {
        persyaratan: "Hasil verifikasi administrasi & teknis",
        waktu: "30 Menit",
        output: "Jika lengkap diteruskan; jika belum dikembalikan untuk dilengkapi"
      }
    },
    {
      nomor: 4,
      aktivitas: `Penyusunan draf dokumen/tindak lanjut pelaksanaan ${judulClean} sesuai ketentuan yang berlaku`,
      pelaksana: "Staf Tata Usaha / Tim Pelaksana",
      simbol: "Process",
      mutuBaku: {
        persyaratan: "Draf dokumen/surat/laporan",
        waktu: "60 Menit",
        output: "Draf dokumen siap diajukan untuk disetujui"
      }
    },
    {
      nomor: 5,
      aktivitas: "Kepala Madrasah menelaah dan memberikan persetujuan / pengesahan / tanda tangan resmi",
      pelaksana: "Kepala Madrasah",
      simbol: "Decision",
      mutuBaku: {
        persyaratan: "Draf dokumen terverifikasi & lembar disposisi",
        waktu: "45 Menit",
        output: "Dokumen resmi telah ditandatangani"
      }
    },
    {
      nomor: 6,
      aktivitas: `Penomoran, pembubuhan stempel resmi madrasah, pengarsipan, serta penyerahan hasil ${judulClean} kepada pemohon/pihak terkait`,
      pelaksana: "Staf Tata Usaha",
      simbol: "Terminator",
      mutuBaku: {
        persyaratan: "Buku register penyerahan dokumen",
        waktu: "20 Menit",
        output: "Dokumen resmi diserahkan & arsip tersimpan"
      }
    }
  ];

  return {
    dasarHukum,
    kualifikasiPelaksana,
    keterkaitan,
    peralatanPerlengkapan,
    peringatan,
    pencatatanPendataan,
    prosedur
  };
}
