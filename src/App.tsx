/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Database, 
  FileText, 
  Download, 
  Printer, 
  Copy, 
  Zap, 
  ChevronRight, 
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Loader2,
  Building2,
  User,
  Hash,
  Calendar,
  Upload,
  Edit2,
  Check,
  X,
  Save,
  LogIn,
  Lock,
  ShieldCheck,
  LogOut,
  UserPlus,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  handleFirestoreError, 
  OperationType, 
  testConnection 
} from './services/firebaseService';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType,
  VerticalAlign,
  TextDirection,
  ImageRun
} from "docx";
import { saveAs } from "file-saver";
import * as XLSX from 'xlsx';
import { auth, db, hasCustomFirebaseConfig } from './firebase';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { NeonConfigModal } from './components/NeonConfigModal';
import { 
  checkNeonStatus, 
  fetchSopsFromNeon, 
  saveSopToNeon, 
  deleteSopFromNeon, 
  NeonDbStatus 
} from './services/neonService';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';

// Types
interface Aktivitas {
  nomor: number | string;
  aktivitas: string;
  pelaksana: string;
  simbol: 'Terminator' | 'Process' | 'Decision' | 'Connector';
  mutuBaku: {
    persyaratan: string;
    waktu: string;
    output: string;
  };
}

interface SopData {
  // Menu 1: Pengaturan
  satker1: string;
  satker2: string;
  madrasah: string;
  alamatMadrasah: string;
  namaKepala: string;
  nipKepala: string;
  logoUrl: string;
  // Menu 2: Entry Data
  nomorSop: string;
  tglPembuatan: string;
  tglRevisi: string;
  tglEfektif: string;
  judulSop: string;
  // Menu 3: AI Generated
  dasarHukum: string[];
  kualifikasiPelaksana: string[];
  keterkaitan: string[];
  peralatanPerlengkapan: string[];
  peringatan: string[];
  pencatatanPendataan: string[];
  prosedur: Aktivitas[];
}

const INITIAL_SOP_DATA: SopData = {
  satker1: 'KEMENTERIAN AGAMA RI',
  satker2: 'KANTOR KEMENTERIAN AGAMA KABUPATEN CIAMIS',
  madrasah: 'MADRASAH IBTIDAIYAH NEGERI 1 CIAMIS',
  alamatMadrasah: 'Jl. Raya Ciamis No. 123, Kabupaten Ciamis, Jawa Barat',
  namaKepala: 'IIM SITI HALIMAH, S.Ag., M.Pd.',
  nipKepala: '197206051997032003',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Logo_Kementerian_Agama.png',
  nomorSop: '06/Mi.10.21/04/2026/MORA.06.02.CFM.05.SOP.09',
  tglPembuatan: '23 April 2026',
  tglRevisi: '-',
  tglEfektif: '01 Mei 2026',
  judulSop: '',
  dasarHukum: [],
  kualifikasiPelaksana: [],
  keterkaitan: [],
  peralatanPerlengkapan: [],
  peringatan: [],
  pencatatanPendataan: [],
  prosedur: [
    { nomor: 1, aktivitas: 'Mulai', pelaksana: 'Kepala Madrasah', simbol: 'Terminator', mutuBaku: { persyaratan: 'Draft', waktu: '5 Menit', output: 'Draft Disetujui' } },
    { nomor: 2, aktivitas: 'Memeriksa Berkas', pelaksana: 'Kepala Madrasah', simbol: 'Process', mutuBaku: { persyaratan: 'Berkas', waktu: '10 Menit', output: 'Hasil Periksa' } },
    { nomor: 3, aktivitas: 'Menyetujui?', pelaksana: 'Kepala Madrasah', simbol: 'Decision', mutuBaku: { persyaratan: 'Hasil Periksa', waktu: '5 Menit', output: 'SK/Status' } },
    { nomor: 4, aktivitas: 'Input Data', pelaksana: 'Operator', simbol: 'Process', mutuBaku: { persyaratan: 'SK', waktu: '30 Menit', output: 'Data Terinput' } },
    { nomor: 5, aktivitas: 'Selesai', pelaksana: 'Operator', simbol: 'Terminator', mutuBaku: { persyaratan: 'Draft', waktu: '5 Menit', output: 'SOP Selesai' } }
  ]
};

const MENU_ITEMS = [
  { id: 'pengaturan', label: 'PENGATURAN', icon: Settings },
  { id: 'entry', label: 'ENTRY DATA SOP', icon: Database },
  { id: 'history', label: 'RIWAYAT SOP', icon: Calendar },
  { id: 'preview', label: 'PREVIEW & CETAK', icon: FileText },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState('pengaturan');
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalMessage, setConfigModalMessage] = useState('');
  const [isNeonModalOpen, setIsNeonModalOpen] = useState(false);
  const [neonStatus, setNeonStatus] = useState<NeonDbStatus | null>(null);
  
  // Auth input state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [sopData, setSopData] = useState<SopData>(INITIAL_SOP_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [userSops, setUserSops] = useState<(SopData & { id: string })[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [tempAktivitas, setTempAktivitas] = useState('');
  const [tempSimbol, setTempSimbol] = useState<'Terminator' | 'Process' | 'Decision' | 'Connector'>('Process');
  const [tempPelaksana, setTempPelaksana] = useState('');
  const [tempPersyaratan, setTempPersyaratan] = useState('');
  const [tempWaktu, setTempWaktu] = useState('');
  const [tempOutput, setTempOutput] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (field: keyof SopData, value: any) => {
    setSopData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    testConnection();
    checkNeonStatus().then(status => setNeonStatus(status));

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      const uid = u?.uid || 'guest';
      fetchUserSops(uid);
    });

    // Also fetch SOPs immediately on mount (for guest or previous session)
    fetchUserSops('guest');

    return () => unsubscribe();
  }, []);

  const fetchUserSops = async (userId: string) => {
    try {
      const sops = await fetchSopsFromNeon(userId);
      setUserSops(sops);
    } catch (error) {
      console.warn("Could not fetch user sops from Neon:", error);
      // Fallback to Firestore if Neon has not been configured yet
      try {
        const path = 'sops';
        const q = query(
          collection(db, path), 
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fbSops: any[] = [];
        querySnapshot.forEach((doc) => {
          fbSops.push({ id: doc.id, ...doc.data() });
        });
        setUserSops(fbSops);
      } catch (fbErr) {
        console.warn("Firestore fallback also failed:", fbErr);
      }
    }
  };

  const handleAuthError = (error: any, action: 'login' | 'register' | 'reset') => {
    const code = error?.code || '';
    const msg = error?.message || '';
    const isApiKeyErr = code.includes('api-key-not-valid') || msg.includes('api-key-not-valid') || code.includes('invalid-api-key');

    if (isApiKeyErr) {
      setConfigModalMessage(
        "API Key Firebase tidak valid atau proyek Firebase telah kedaluwarsa. Silakan masukkan konfigurasi Firebase proyek Anda dari Firebase Console (console.firebase.google.com) untuk melanjutkan."
      );
      setIsConfigModalOpen(true);
      return;
    }

    if (code === 'auth/operation-not-allowed') {
      alert("Error: Metode 'Email/Password' belum diaktifkan di Firebase Console. Silakan buka Firebase Console > Authentication > Sign-in method dan aktifkan Email/Password.");
    } else if (code === 'auth/invalid-credential') {
      if (action === 'login') {
        alert("Gagal Masuk: Email atau Password salah. Pastikan Anda sudah terdaftar.");
      } else {
        alert("Gagal Registrasi: Kredensial tidak valid. Silakan coba email atau password lain.");
      }
    } else if (code === 'auth/email-already-in-use') {
      alert("Gagal Registrasi: Email sudah terdaftar. Silakan gunakan email lain atau masuk dengan akun tersebut.");
    } else if (code === 'auth/user-not-found') {
      alert("Akun tidak ditemukan. Silakan periksa kembali email Anda atau klik 'Daftar Akun Baru'.");
    } else if (code === 'auth/wrong-password') {
      alert("Kata sandi salah. Silakan coba lagi atau gunakan fitur 'Lupa Kata Sandi?'.");
    } else if (code === 'auth/unauthorized-domain') {
      alert("Domain web ini belum diizinkan di Firebase Authentication. Silakan tambahkan domain hosting Anda (misal: mora-sop.vercel.app) di Firebase Console > Authentication > Settings > Authorized domains.");
    } else {
      alert(`Gagal ${action === 'login' ? 'Masuk' : action === 'register' ? 'Registrasi' : 'Kirim Email'}: ${msg}`);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) return alert("Isi email dan password");
    setIsAuthProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (error: any) {
      handleAuthError(error, 'login');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPass || !regName) return alert("Lengkapi data registrasi");
    setIsAuthProcessing(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPass);
      await updateProfile(userCredential.user, { displayName: regName });
      alert("Registrasi Berhasil!");
    } catch (error: any) {
      handleAuthError(error, 'register');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSopData(INITIAL_SOP_DATA);
      setUserSops([]);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handleResetPassword = async () => {
    if (!loginEmail) return alert("Masukkan email Anda terlebih dahulu untuk mengatur ulang kata sandi.");
    setIsAuthProcessing(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      alert("Email pengaturan ulang kata sandi telah dikirim! Silakan periksa kotak masuk atau folder spam Anda.");
    } catch (error: any) {
      handleAuthError(error, 'reset');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const saveSopData = async () => {
    setIsSaving(true);
    const effectiveUserId = user ? user.uid : 'guest';

    try {
      // 1. Try saving to Neon PostgreSQL backend
      const res = await saveSopToNeon(sopData, effectiveUserId);
      if (res && res.id) {
        setSopData(prev => ({ ...prev, id: res.id } as any));
      }
      setSuccessMsg('SOP Berhasil Disimpan ke Neon PostgreSQL!');
      fetchUserSops(effectiveUserId);
      setTimeout(() => setSuccessMsg(''), 3000);
      setIsSaving(false);
      return;
    } catch (neonErr: any) {
      console.warn("Saving to Neon failed or database not configured:", neonErr);

      // If Neon is not connected, notify and prompt to configure
      const errText = neonErr.message || '';
      if (errText.includes('DATABASE_URL') || errText.includes('503') || errText.includes('belum diatur')) {
        setIsNeonModalOpen(true);
        setIsSaving(false);
        return;
      }

      // Fallback: try Firestore if user is logged in
      if (user) {
        const path = 'sops';
        try {
          const dataToSave = {
            ...sopData,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          };

          if ((sopData as any).id) {
            const docRef = doc(db, path, (sopData as any).id);
            const { id, ...cleanData } = sopData as any;
            await updateDoc(docRef, {
              ...cleanData,
              userId: user.uid,
              updatedAt: serverTimestamp()
            });
            setSuccessMsg('SOP Berhasil Diperbarui di Cloud!');
          } else {
            const docRef = await addDoc(collection(db, path), {
              ...dataToSave,
              createdAt: serverTimestamp()
            });
            setSopData(prev => ({ ...prev, id: docRef.id } as any));
            setSuccessMsg('SOP Berhasil Disimpan ke Cloud!');
          }

          fetchUserSops(user.uid);
          setTimeout(() => setSuccessMsg(''), 3000);
        } catch (fbErr) {
          handleFirestoreError(fbErr, OperationType.WRITE, path);
        }
      } else {
        alert("Gagal menyimpan ke Neon PostgreSQL: " + (neonErr.message || 'Periksa koneksi database Anda'));
        setIsNeonModalOpen(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const generateSopContent = async () => {
    if (!sopData.judulSop) {
      alert("Masukkan Judul SOP terlebih dahulu!");
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      alert("GEMINI_API_KEY belum dikonfigurasi. Pastikan Environment Variable telah diatur di Vercel/Hosting Anda.");
      return;
    }

    setIsGenerating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY tidak ditemukan");
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: `Hasilkan konten lengkap untuk Standar Operasional Prosedur (SOP) di Madrasah Kemenag Indonesia dengan judul: "${sopData.judulSop}".
        Hasilkan data dalam format JSON murni. Pastikan pelaksana adalah jabatan yang ada di Madrasah (misal: Kepala Madrasah, Guru, Tata Usaha, Bendahara, Komite).
        
        {
          "dasarHukum": ["pembukaan...", "..."],
          "kualifikasiPelaksana": ["...", "..."],
          "keterkaitan": ["...", "..."],
          "peralatanPerlengkapan": ["...", "..."],
          "peringatan": ["...", "..."],
          "pencatatanPendataan": ["...", "..."],
          "prosedur": [
            { 
              "nomor": 1, 
              "aktivitas": "...", 
              "pelaksana": "...", 
              "simbol": "Terminator/Process/Decision/Connector",
              "mutuBaku": { "persyaratan": "...", "waktu": "...", "output": "..." } 
            }
          ]
        }
        
        PENTING: Berikan HANYA JSON murni tanpa markdown code blocks.
        
        PENTING untuk field 'simbol':
        1. 'Terminator' untuk aktivitas awal (Mulai) dan akhir (Selesai).
        2. 'Decision' jika aktivitas bersifat pemeriksaan atau butuh persetujuan (pilihan Ya/Tidak).
        3. 'Process' untuk aktivitas pengerjaan rutin.
        4. 'Connector' jika alur melompat atau berlanjut.`
      });

      let text = response.text || '';
      // Clean up markdown if AI still provides it
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const generated = JSON.parse(text || '{}');
      setSopData(prev => ({
        ...prev,
        ...generated
      }));
      setSuccessMsg('SOP Berhasil digenerate!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      let errorMsg = "";
      
      try {
        // Attempt to parse structured error from the response
        if (typeof error.message === 'string' && (error.message.includes('{') || error.message.includes('code'))) {
          // If it looks like JSON or contains common error markers
          const rawMsg = error.message;
          const jsonMatch = rawMsg.match(/\{.*\}/s);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            errorMsg = parsed?.error?.message || rawMsg;
          } else {
            errorMsg = rawMsg;
          }
        } else {
          errorMsg = error.message || "Unknown error";
        }
      } catch (e) {
        errorMsg = error.message || "Error parsing fail response";
      }

      if (errorMsg.includes("API key not valid")) {
        alert("Gagal: API Key Gemini tidak valid. Periksa konfigurasi API Key Anda di Vercel Settings (Environment Variables).");
      } else if (errorMsg.includes("denied access") || errorMsg.includes("403")) {
        alert("Gagal (403): Akses Ditolak. Pastikan API Key Anda aktif dan memiliki akses ke Google AI SDK.");
      } else if (errorMsg.includes("quota")) {
        alert("Gagal: Kuota API Gemini habis.");
      } else {
        alert("Gagal mengenerate SOP: " + errorMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let logoBase64 = "";
    try {
      const response = await fetch(sopData.logoUrl);
      const blob = await response.blob();
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Logo fetch failed", e);
    }

    const headerData = [
      [
        { 
          content: '', 
          styles: { cellWidth: 25, minCellHeight: 35 } 
        },
        { 
          content: 'KEMENTERIAN AGAMA RI\n' + sopData.satker2 + '\n' + sopData.madrasah + '\n' + sopData.alamatMadrasah, 
          styles: { halign: 'center' as const, fontSize: 9, fontStyle: 'bold' as const, cellWidth: 75, minCellHeight: 35 } 
        },
        { 
          content: `Nomor SOP\t: ${sopData.nomorSop}\nTanggal Pembuatan\t: ${sopData.tglPembuatan}\nTanggal Revisi\t: ${sopData.tglRevisi}\nTanggal Efektif\t: ${sopData.tglEfektif}\nDisahkan oleh\t: Kepala ${sopData.madrasah.replace('MADRASAH IBTIDAIYAH NEGERI 1 ', 'MIN 1 ')}\n\n\n${sopData.namaKepala}\nNIP. ${sopData.nipKepala}`, 
          styles: { halign: 'left' as const, fontSize: 7, cellWidth: 'auto', minCellHeight: 35 } 
        }
      ]
    ];

    autoTable(doc, {
      body: headerData as any,
      theme: 'grid' as const,
      styles: { cellPadding: 2, valign: 'middle' as const, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 75 }, 2: { cellWidth: 'auto' } },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.section === 'body' && logoBase64) {
          const pos = data.cell;
          // Center logo in the cell
          const imgSize = 18;
          const x = pos.x + (pos.width - imgSize) / 2;
          const y = pos.y + (pos.height - imgSize) / 2;
          doc.addImage(logoBase64, 'PNG', x, y, imgSize, imgSize);
        }
      }
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(255, 204, 0);
    doc.rect(14, (doc as any).lastAutoTable.finalY + 2, pageWidth - 28, 10, 'F');
    doc.text('SOP', pageWidth / 2, (doc as any).lastAutoTable.finalY + 8, { align: 'center' });
    doc.text(sopData.judulSop.toUpperCase(), pageWidth / 2, (doc as any).lastAutoTable.finalY + 14, { align: 'center' });
    const details = [
      ['Dasar Hukum:', 'Kualifikasi Pelaksana:'],
      [sopData.dasarHukum.map((v, i) => `${i + 1}. ${v}`).join('\n'), sopData.kualifikasiPelaksana.map((v, i) => `${i + 1}. ${v}`).join('\n')],
      ['Keterkaitan:', 'Peralatan/Perlengkapan:'],
      [sopData.keterkaitan.map((v, i) => `${i + 1}. ${v}`).join('\n'), sopData.peralatanPerlengkapan.map((v, i) => `${i + 1}. ${v}`).join('\n')],
      ['Peringatan:', 'Pencatatan dan Pendataan:'],
      [sopData.peringatan.map((v, i) => `${i + 1}. ${v}`).join('\n'), sopData.pencatatanPendataan.map((v, i) => `${i + 1}. ${v}`).join('\n')]
    ];
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 18,
      body: details,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: { 0: { cellWidth: (pageWidth - 28) / 2 }, 1: { cellWidth: (pageWidth - 28) / 2 } },
      headStyles: { fillColor: [240, 240, 240] }
    });
    const uniqueActors = Array.from(new Set(sopData.prosedur.map(p => p.pelaksana))).filter(a => a).slice(0, 5);
    const actorCols = uniqueActors.length > 0 ? uniqueActors : ['Pelaksana 1', 'Pelaksana 2', 'Pelaksana 3'];

    const tableHeaders = [
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'Aktivitas', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        { content: 'Pelaksana', colSpan: actorCols.length, styles: { halign: 'center' as const } },
        { content: 'Mutu Baku', colSpan: 3, styles: { halign: 'center' as const } },
        { content: 'Ket.', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      ],
      [
        ...actorCols.map(actor => ({ content: actor, styles: { halign: 'center' as const, fontSize: 6, minCellHeight: 20 } })),
        { content: 'Kelengkapan', styles: { halign: 'center' as const } },
        { content: 'Waktu', styles: { halign: 'center' as const } },
        { content: 'Output', styles: { halign: 'center' as const } },
      ]
    ];

    const tableData = sopData.prosedur.map(p => {
      const actorCells = actorCols.map(actor => p.pelaksana === actor ? '' : '');
      return [
        p.nomor,
        p.aktivitas,
        ...actorCells,
        p.mutuBaku.persyaratan,
        p.mutuBaku.waktu,
        p.mutuBaku.output,
        ''
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: tableHeaders as any,
      body: tableData,
      theme: 'grid' as const,
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' as const },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' as const },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index >= 2 && data.column.index < 2 + actorCols.length) {
          const rowIndex = data.row.index;
          const colIndex = data.column.index - 2;
          const p = sopData.prosedur[rowIndex];
          const actor = actorCols[colIndex];
          const isCurrentActor = p.pelaksana === actor;

          const centerX = data.cell.x + data.cell.width / 2;
          const centerY = data.cell.y + data.cell.height / 2;
          
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.2);

          // 1. Draw Symbol if this is the actor's cell
          if (isCurrentActor) {
            let fillColor: [number, number, number] = [255, 255, 255];
            if (p.simbol === 'Terminator') fillColor = [144, 173, 92];
            else if (p.simbol === 'Decision') fillColor = [218, 228, 246];
            else {
              const colors: [number, number, number][] = [[218, 228, 246], [254, 233, 195], [226, 239, 219], [252, 228, 236], [232, 245, 233]];
              fillColor = colors[colIndex % 5];
            }
            doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);

            if (p.simbol === 'Terminator') {
              doc.roundedRect(centerX - 4, centerY - 2, 8, 4, 2, 2, 'FD');
            } else if (p.simbol === 'Decision') {
              doc.triangle(centerX, centerY - 3, centerX + 4, centerY, centerX - 4, centerY, 'FD');
              doc.triangle(centerX, centerY + 3, centerX + 4, centerY, centerX - 4, centerY, 'FD');
            } else if (p.simbol === 'Connector') {
              doc.rect(centerX - 3, centerY - 3, 6, 6, 'FD');
            } else {
              doc.rect(centerX - 4, centerY - 2.5, 8, 5, 'FD');
            }
          }

          // 2. Incoming Line (Vertical)
          if (isCurrentActor && rowIndex > 0) {
             const symbolTop = centerY - (p.simbol === 'Decision' ? 3 : 2.5);
             doc.line(centerX, data.cell.y, centerX, symbolTop);
             // Small arrow head pointing to symbol
             doc.line(centerX, symbolTop, centerX - 1, symbolTop - 1.5);
             doc.line(centerX, symbolTop, centerX + 1, symbolTop - 1.5);
          }

          // 3. Outgoing Line (Vertical or Elbow)
          const nextP = sopData.prosedur[rowIndex + 1];
          if (isCurrentActor && nextP) {
            const nextActorIndex = actorCols.indexOf(nextP.pelaksana);
            const symbolBottom = centerY + (p.simbol === 'Decision' ? 3 : 2.5);
            
            if (nextActorIndex === colIndex) {
              doc.line(centerX, symbolBottom, centerX, data.cell.y + data.cell.height);
            } else if (nextActorIndex !== -1) {
              const elbowY = data.cell.y + data.cell.height; 
              const targetX = centerX + (nextActorIndex - colIndex) * data.cell.width;
              doc.line(centerX, symbolBottom, centerX, elbowY); // vertical down
              doc.line(centerX, elbowY, targetX, elbowY); // horizontal on border
            }
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Add Legend (Keterangan) for PDF
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Keterangan:', 14, finalY);
    
    // Draw symbols for legend
    const legendY = finalY + 5;
    const roleColors: [number, number, number][] = [
      [218, 228, 246], // #dae4f6
      [254, 233, 195], // #fee9c3
      [226, 239, 219], // #e2efdb
      [252, 228, 236], // #fce4ec
      [232, 245, 233]  // #e8f5e9
    ];

    // 1. Mulai/Selesai
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(144, 173, 92);
    doc.roundedRect(14, legendY, 10, 5, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('= Mulai / Selesai', 26, legendY + 4);

    // ... continue legend
    doc.setFillColor(roleColors[0][0], roleColors[0][1], roleColors[0][2]);
    doc.rect(45, legendY, 8, 5, 'FD');
    doc.text('= Aktivitas', 55, legendY + 4);

    doc.setFillColor(roleColors[1][0], roleColors[1][1], roleColors[1][2]);
    doc.triangle(80, legendY, 84, legendY + 5, 76, legendY + 5, 'FD');
    doc.text('= Keputusan', 86, legendY + 4);

    // 2. Actors/Roles mapping
    actorCols.forEach((actor, idx) => {
      const col = Math.floor((idx + 1) / 3);
      const subIdx = (idx + 1) % 3;
      const x = 14 + col * 60;
      const y = legendY + subIdx * 8;
      const color = roleColors[idx % roleColors.length];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, y, 10, 5, 'FD');
      doc.text(`= Proses (${actor})`, x + 12, y + 4);
    });

    // 3. Decision (Legend continued)
    const legendDecisionX = 134;
    doc.setFillColor(218, 228, 246);
    doc.triangle(legendDecisionX, legendY + 2.5, legendDecisionX + 5, legendY, legendDecisionX + 5, legendY + 5, 'FD');
    doc.triangle(legendDecisionX + 10, legendY + 2.5, legendDecisionX + 5, legendY, legendDecisionX + 5, legendY + 5, 'FD');
    doc.text('= Hasil / Keputusan', legendDecisionX + 12, legendY + 4);
    
    // 4. Arrow
    doc.line(legendDecisionX, legendY + 12, legendDecisionX + 10, legendY + 12);
    doc.line(legendDecisionX + 10, legendY + 12, legendDecisionX + 8, legendY + 11);
    doc.line(legendDecisionX + 10, legendY + 12, legendDecisionX + 8, legendY + 13);
    doc.text('= Alur Proses', legendDecisionX + 12, legendY + 12);

    doc.save(`SOP_${sopData.judulSop.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Prepare metadata rows
    const metaData = [
      ['SOP MADRASAH'],
      [sopData.judulSop.toUpperCase()],
      [''],
      ['Satker 1', sopData.satker1],
      ['Satker 2', sopData.satker2],
      ['Madrasah', sopData.madrasah],
      ['Alamat', sopData.alamatMadrasah],
      [''],
      ['Nomor SOP', sopData.nomorSop],
      ['Tanggal Pembuatan', sopData.tglPembuatan],
      ['Tanggal Revisi', sopData.tglRevisi],
      ['Tanggal Efektif', sopData.tglEfektif],
      ['Kepala Madrasah', sopData.namaKepala],
      ['NIP', sopData.nipKepala],
      [''],
      ['DASAR HUKUM'],
      ...sopData.dasarHukum.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['KUALIFIKASI PELAKSANA'],
      ...sopData.kualifikasiPelaksana.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['KETERKAITAN'],
      ...sopData.keterkaitan.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['PERALATAN/PERLENGKAPAN'],
      ...sopData.peralatanPerlengkapan.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['PERINGATAN'],
      ...sopData.peringatan.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['PENCATATAN DAN PENDATAAN'],
      ...sopData.pencatatanPendataan.map((v, i) => [`${i + 1}`, v]),
      [''],
      ['PROSEDUR SOP'],
    ];

    // Prepare Procedure Table
    const actorNames = Array.from(new Set(sopData.prosedur.map(p => p.pelaksana))).filter(a => a) as string[];
    const actorCols = actorNames.length > 0 ? actorNames : ['Pelaksana 1'];

    const tableHeader = [
      'No',
      'Aktivitas',
      ...actorCols,
      'Persyaratan',
      'Waktu',
      'Output',
      'Keterangan'
    ];

    const tableData = sopData.prosedur.map(p => {
      const row: any[] = [p.nomor, p.aktivitas];
      actorCols.forEach(actor => {
        row.push(p.pelaksana === actor ? p.simbol : '');
      });
      row.push(p.mutuBaku.persyaratan);
      row.push(p.mutuBaku.waktu);
      row.push(p.mutuBaku.output);
      row.push('');
      return row;
    });

    const worksheetData = [...metaData, tableHeader, ...tableData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Simple column width adjustment
    const wscols = [
      {wch: 5},  // No
      {wch: 40}, // Aktivitas
      ...actorCols.map(() => ({wch: 20})),
      {wch: 30}, // Persyaratan
      {wch: 15}, // Waktu
      {wch: 30}, // Output
      {wch: 15}  // Ket
    ];
    worksheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, "SOP");
    XLSX.writeFile(workbook, `SOP_${sopData.judulSop.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportToWord = async () => {
    let logoBuffer: Uint8Array | null = null;
    try {
      const response = await fetch(sopData.logoUrl);
      const arrayBuffer = await response.arrayBuffer();
      logoBuffer = new Uint8Array(arrayBuffer);
    } catch (e) {
      console.error("Logo fetch failed for word", e);
    }

    const kopTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        children: logoBuffer ? [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new ImageRun({
                                        data: logoBuffer as Uint8Array,
                                        transformation: { width: 80, height: 80 },
                                    } as any),
                                ],
                            }),
                        ] : [],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ 
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: "KEMENTERIAN AGAMA RI", size: 20 })] 
                            }),
                            new Paragraph({ 
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: sopData.satker2, bold: true, size: 24 })] 
                            }),
                            new Paragraph({ 
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: sopData.madrasah, bold: true, size: 20 })] 
                            }),
                            new Paragraph({ 
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: sopData.alamatMadrasah, size: 16 })] 
                            }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({ children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nomor SOP", size: 16 })] })] }), 
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + sopData.nomorSop, size: 16 })] })] })
                                    ] }),
                                    new TableRow({ children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tgl Pembuatan", size: 16 })] })] }), 
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + sopData.tglPembuatan, size: 16 })] })] })
                                    ] }),
                                    new TableRow({ children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tgl Revisi", size: 16 })] })] }), 
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + sopData.tglRevisi, size: 16 })] })] })
                                    ] }),
                                    new TableRow({ children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tgl Efektif", size: 16 })] })] }), 
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + sopData.tglEfektif, size: 16 })] })] })
                                    ] }),
                                    new TableRow({ children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Disahkan Oleh", size: 16 })] })] }), 
                                        new TableCell({ children: [
                                            new Paragraph({ children: [new TextRun({ text: ": Kepala " + sopData.madrasah.replace('MADRASAH IBTIDAIYAH NEGERI 1 ', 'MIN 1 '), size: 16 })] }), 
                                            new Paragraph({ children: [new TextRun({ text: "\n\n" + sopData.namaKepala, bold: true, size: 20, underline: {} })] }), 
                                            new Paragraph({ children: [new TextRun({ text: "NIP. " + sopData.nipKepala, size: 16 })] })
                                        ] })
                                    ] }),
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });

    const actorNames = (Array.from(new Set(sopData.prosedur.map(p => p.pelaksana))).filter(a => a) as string[]).slice(0, 5);
    const actorCols = actorNames.length > 0 ? actorNames : ['Pelaksana 1', 'Pelaksana 2', 'Pelaksana 3'];

    const tableHeader1 = new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No" })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Aktivitas" })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pelaksana" })], alignment: AlignmentType.CENTER })], columnSpan: actorCols.length }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mutu Baku" })], alignment: AlignmentType.CENTER })], columnSpan: 3 }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ket." })], alignment: AlignmentType.CENTER })], rowSpan: 2, verticalAlign: VerticalAlign.CENTER }),
        ],
    });

    const tableHeader2 = new TableRow({
        children: [
            ...actorCols.map(actor => new TableCell({ 
                children: [new Paragraph({ children: [new TextRun({ text: actor })], alignment: AlignmentType.CENTER })],
                textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
                verticalAlign: VerticalAlign.CENTER,
            })),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Persyaratan" })], alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Waktu" })], alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Output" })], alignment: AlignmentType.CENTER })] }),
        ],
    });

    const tableRows = sopData.prosedur.map(p => {
        const actorCells = actorCols.map(actor => {
            if (p.pelaksana === actor) {
                let symbolText: string = "[ ]";
                if (p.simbol === 'Terminator') symbolText = "( )";
                if (p.simbol === 'Decision') symbolText = "< >";
                if (p.simbol === 'Connector') symbolText = "{ }";
                return new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: symbolText, size: 16 })] })] });
            }
            return new TableCell({ children: [] });
        });

        return new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(p.nomor), size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.aktivitas as string, size: 16 })] })] }),
                ...actorCells,
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.mutuBaku.persyaratan as string, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.mutuBaku.waktu as string, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.mutuBaku.output as string, size: 16 })] })] }),
                new TableCell({ children: [] }),
            ],
        });
    });

    const docDoc = new Document({
      sections: [{
        children: [
            kopTable,
            new Paragraph({ text: "", spacing: { after: 200 } }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SOP", bold: true, size: 24 })] })],
                                columnSpan: 2,
                                shading: { fill: "FFBD00" }
                            })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sopData.judulSop.toUpperCase(), bold: true, size: 28 })] })],
                                columnSpan: 2,
                                shading: { fill: "FFBD00" }
                            })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Dasar Hukum:", bold: true, size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kualifikasi Pelaksana:", bold: true, size: 18 })] })] }),
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: sopData.dasarHukum.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                            new TableCell({ children: sopData.kualifikasiPelaksana.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Keterkaitan:", bold: true, size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Peralatan/Perlengkapan:", bold: true, size: 18 })] })] }),
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: sopData.keterkaitan.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                            new TableCell({ children: sopData.peralatanPerlengkapan.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Peringatan:", bold: true, size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pencatatan dan Pendataan:", bold: true, size: 18 })] })] }),
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: sopData.peringatan.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                            new TableCell({ children: sopData.pencatatanPendataan.map((v, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v}`, size: 16 })] })) }),
                        ]
                    }),
                ]
            }),
            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Table({ 
                width: { size: 100, type: WidthType.PERCENTAGE }, 
                rows: [tableHeader1, tableHeader2, ...tableRows] 
            }),
            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({ children: [new TextRun({ text: "Keterangan:", bold: true, underline: {}, size: 16 })] }),
                                    new Paragraph({ children: [
                                        new TextRun({ text: "( ) = Mulai / Selesai    ", size: 14 }),
                                        ...actorCols.map((actor, idx) => new TextRun({ text: `[${idx+1}] = Proses (${actor})    `, size: 14 })),
                                        new TextRun({ text: "< > = Hasil / Keputusan    ", size: 14 }),
                                        new TextRun({ text: "--> = Alur Proses", size: 14 }),
                                    ], spacing: { before: 100 }})
                                ],
                                shading: { fill: "F2F2F2" }
                            })
                        ]
                    })
                ]
            })
        ],
      }],
    });
    Packer.toBlob(docDoc).then(blob => saveAs(blob, `SOP-${sopData.judulSop}.docx`));
  };

  const copyToClipboard = () => {
    const text = `SOP: ${sopData.judulSop}\n\nProsedur:\n` + sopData.prosedur.map(p => `${p.nomor}. ${p.aktivitas} (${p.pelaksana})`).join('\n');
    navigator.clipboard.writeText(text);
    alert('SOP disalin!');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!user && !isGuestMode) {
    if (isRegistering) {
      return (
        <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[100px] opacity-60" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[100px] opacity-60" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-200/50 overflow-hidden border border-slate-100">
              <div className="bg-indigo-950 p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 to-transparent scale-[2]" />
                </div>
                
                <div className="flex justify-center items-center gap-3 mb-4 relative z-10">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, delay: 0.2 }}
                    className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center p-2"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Kementerian_Agama_new_logo.png" 
                      alt="Logo Kemenag" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                </div>
                
                <h1 className="text-white font-black text-2xl uppercase relative z-10">Daftar Akun</h1>
                <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 relative z-10">Gunakan Firebase Auth untuk Login Aman</p>
              </div>

              <div className="p-10 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nama Lengkap</label>
                  <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 outline-none focus:border-indigo-500 font-medium" placeholder="Nama Anda" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 outline-none focus:border-indigo-500 font-medium" placeholder="email@contoh.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kata Sandi</label>
                  <input type="password" value={regPass} onChange={(e) => setRegPass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 outline-none focus:border-indigo-500 font-medium" placeholder="••••••••" />
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isAuthProcessing}
                  onClick={handleRegister}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg mt-4 disabled:opacity-50"
                >
                  {isAuthProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'DAFTAR SEKARANG'}
                </motion.button>

                <button onClick={() => setIsRegistering(false)} className="w-full text-slate-500 text-sm font-bold mt-3">
                  Sudah punya akun? Masuk di sini
                </button>

                <button 
                  onClick={() => {
                    setConfigModalMessage("");
                    setIsConfigModalOpen(true);
                  }}
                  className="w-full mt-3 py-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Settings size={14} /> Atur Konfigurasi Firebase
                </button>
              </div>
            </div>
          </motion.div>

          <FirebaseConfigModal 
            isOpen={isConfigModalOpen} 
            onClose={() => setIsConfigModalOpen(false)} 
            initialMessage={configModalMessage} 
          />

          <NeonConfigModal
            isOpen={isNeonModalOpen}
            onClose={() => setIsNeonModalOpen(false)}
            onConnected={() => {
              checkNeonStatus().then(status => setNeonStatus(status));
              fetchUserSops(user ? user.uid : 'guest');
            }}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Abstract Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[100px] opacity-60" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-200/50 overflow-hidden border border-slate-100">
            <div className="bg-indigo-950 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 to-transparent scale-[2]" />
              </div>
              
              <div className="flex justify-center items-center gap-4 mb-6 relative z-10">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.2 }}
                  className="w-20 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center p-3"
                >
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Kementerian_Agama_new_logo.png" 
                    alt="Logo Kemenag" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </div>
              
              <h1 className="text-white font-black text-2xl tracking-tight leading-tight">
                MORA & SOP
              </h1>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
                Digital Management System
              </p>
            </div>

            <div className="p-10">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-black text-slate-800 leading-tight">
                  SELAMAT DATANG DI APLIKASI MORA & SOP
                </h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">
                  Sistem otomatisasi penyusunan SOP Madrasah berbasis Kecerdasan Buatan.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <User size={18} />
                    </div>
                    <input 
                      type="email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all font-medium text-slate-700" 
                      placeholder="email@contoh.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kata Sandi</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input 
                      type="password" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all font-medium text-slate-700" 
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="flex justify-end mt-1">
                    <button 
                      onClick={handleResetPassword}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Lupa Kata Sandi?
                    </button>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isAuthProcessing}
                  onClick={handleLogin}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-all mt-4 disabled:opacity-50"
                >
                  {isAuthProcessing ? <Loader2 className="animate-spin" /> : <>MASUK SEKARANG <LogIn size={20} /></>}
                </motion.button>

                <button 
                  onClick={() => setIsRegistering(true)}
                  className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 mt-2 transition-all"
                >
                  DAFTAR AKUN BARU <UserPlus size={18} />
                </button>

                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atau Coba Langsung</span>
                </div>

                <button 
                  onClick={() => setIsGuestMode(true)}
                  className="w-full border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-slate-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all text-sm"
                >
                  Lanjutkan Tanpa Login (Mode Tamu) <ArrowRight size={16} />
                </button>

                <button 
                  onClick={() => setIsNeonModalOpen(true)}
                  className="w-full mt-2 py-2.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
                >
                  <Database size={14} /> Atur Penyimpanan Neon PostgreSQL
                </button>

                <button 
                  onClick={() => {
                    setConfigModalMessage("");
                    setIsConfigModalOpen(true);
                  }}
                  className="w-full mt-2 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Settings size={14} /> Konfigurasi Firebase Auth
                </button>
              </div>
              
              <div className="mt-6 text-center border-t border-slate-100 pt-5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                  SOP Terintegrasi Cloud & AI
                </p>
                <p className="text-[8px] text-slate-300 mt-1 uppercase font-bold tracking-tighter">
                  Powered by admin Kurikulum MIN 1 Ciamis
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-center mt-6 text-slate-400 text-xs font-medium">
            &copy; 2026 MORA & SOP Madrasah. Hak Cipta Dilindungi Terbatas.
          </p>
        </motion.div>

        <FirebaseConfigModal 
          isOpen={isConfigModalOpen} 
          onClose={() => setIsConfigModalOpen(false)} 
          initialMessage={configModalMessage} 
        />

        <NeonConfigModal
          isOpen={isNeonModalOpen}
          onClose={() => setIsNeonModalOpen(false)}
          onConnected={() => {
            checkNeonStatus().then(status => setNeonStatus(status));
            fetchUserSops(user ? user.uid : 'guest');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      {/* Bento Sidebar */}
      <aside className="w-64 bg-indigo-950 text-white flex flex-col shadow-xl flex-shrink-0">
        <div className="p-6 border-b border-indigo-900/50">
          <h1 className="text-xl font-bold tracking-tight text-indigo-200">MORA & SOP</h1>
          <p className="text-xs text-indigo-400 mt-1 uppercase font-semibold">Digital Management</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {MENU_ITEMS.map((item) => (
            <button
              id={`nav-${item.id}`}
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full p-3 rounded-lg flex flex-col items-start transition-all duration-200 group ${
                activeMenu === item.id 
                  ? 'bg-indigo-800/40 border-l-4 border-indigo-400' 
                  : 'hover:bg-indigo-900/40 opacity-70 hover:opacity-100'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase mb-1 ${activeMenu === item.id ? 'text-indigo-300' : 'text-indigo-400'}`}>
                {item.label.split(' ')[0]} {item.label.split(' ')[1] || ''}
              </p>
              <div className="flex items-center gap-2">
                <item.icon size={14} className={activeMenu === item.id ? 'text-indigo-200' : 'text-indigo-400'} />
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto space-y-3">
          <button 
            id="btn-save-cloud"
            onClick={saveSopData}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            {isSaving ? 'MENYIMPAN...' : 'Simpan ke Neon'}
          </button>
          
          <button 
            id="btn-generate-main"
            onClick={generateSopContent}
            disabled={isGenerating || !sopData.judulSop}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${
              isGenerating || !sopData.judulSop
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-[#15803d] hover:bg-[#15803d]/90 text-white shadow-green-900/20'
            }`}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
            {isGenerating ? 'GENERATING...' : 'Buat SOP Baru'}
          </button>
 
          <div className="border-t border-indigo-900/50 mt-4 pt-4 px-2 space-y-2">
            {/* Neon Storage Status & Button */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-400 font-bold uppercase">Database:</span>
              <button 
                onClick={() => setIsNeonModalOpen(true)}
                title="Atur Konfigurasi Neon PostgreSQL"
                className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors ${
                  neonStatus?.status === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                <Database size={11} />
                <span>{neonStatus?.status === 'connected' ? 'Neon Terhubung' : 'Atur Neon'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-indigo-400 font-bold uppercase">Status Akun:</p>
              <button 
                onClick={() => {
                  setConfigModalMessage('');
                  setIsConfigModalOpen(true);
                }}
                title="Atur Konfigurasi Firebase"
                className="text-indigo-300 hover:text-white p-1 rounded hover:bg-indigo-900 transition-colors flex items-center gap-1 text-[10px]"
              >
                <Settings size={13} />
              </button>
            </div>
            {user ? (
              <>
                <p className="text-xs text-white font-medium truncate mb-2">{user.displayName || user.email}</p>
                <button 
                  id="btn-logout"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold bg-rose-600/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all active:scale-95 text-xs"
                >
                  <LogOut size={16} /> Keluar
                </button>
              </>
            ) : (
              <>
                <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] px-2.5 py-1.5 rounded-lg mb-2 flex items-center justify-between">
                  <span>Mode Tamu (Offline)</span>
                </div>
                <button 
                  onClick={() => setIsGuestMode(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all text-xs"
                >
                  <LogIn size={14} /> Masuk Akun
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Bento Main Workspace */}
      <main className="flex-1 overflow-y-auto bg-[#f8fafc] custom-scrollbar p-6">
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
          
          {/* Top Section: Form Workspace */}
          <section className="space-y-6">
            <AnimatePresence mode="wait">
              {activeMenu === 'pengaturan' && (
                <motion.div
                  key="group-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200"
                >
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Pengaturan Instansi</h2>
                      <p className="text-xs text-slate-500 font-medium tracking-wide">Lengkapi data satuan kerja dan identitas pimpinan</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                       <BentoInput label="Nama Satker 1" value={sopData.satker1} onChange={(v) => handleInputChange('satker1', v)} />
                    </div>
                    <div className="col-span-2">
                       <BentoInput label="Nama Satker 2" value={sopData.satker2} onChange={(v) => handleInputChange('satker2', v)} />
                    </div>
                    <div className="col-span-1">
                       <BentoInput label="Nama Madrasah" value={sopData.madrasah} onChange={(v) => handleInputChange('madrasah', v)} />
                    </div>
                    <div className="col-span-1">
                       <BentoInput label="Alamat Madrasah" value={sopData.alamatMadrasah} onChange={(v) => handleInputChange('alamatMadrasah', v)} />
                    </div>
                    <div className="col-span-1">
                       <BentoInput label="Nama Kepala" value={sopData.namaKepala} onChange={(v) => handleInputChange('namaKepala', v)} />
                    </div>
                    <div className="col-span-2">
                       <BentoInput label="NIP Kepala" value={sopData.nipKepala} onChange={(v) => handleInputChange('nipKepala', v)} />
                    </div>
                    <div className="col-span-2 mt-4">
                       <label className="text-[11px] uppercase font-bold text-slate-400 block mb-2">Logo Madrasah</label>
                       <div className="flex items-center gap-6 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl">
                         <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-2 overflow-hidden shadow-sm">
                           <img src={sopData.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                         </div>
                         <div className="flex-1 space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              id="logo-upload-main"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    handleInputChange('logoUrl', reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <label htmlFor="logo-upload-main" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-xl cursor-pointer hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                              <Upload size={14} /> GANTI LOGO BARU
                            </label>
                            <p className="text-[10px] text-slate-500 font-medium">Format JPG/PNG transparan (Kemenag atau Madrasah)</p>
                         </div>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeMenu === 'entry' && (
                <motion.div
                  key="group-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Database size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Entry Data SOP</h2>
                        <p className="text-xs text-slate-500 font-medium tracking-wide">Input nomor, tanggal, dan judul prosedur SOP</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                         <BentoInput label="Nomor SOP" value={sopData.nomorSop} onChange={(v) => handleInputChange('nomorSop', v)} />
                      </div>
                      <div className="col-span-1">
                         <BentoInput label="Tanggal Pembuatan" value={sopData.tglPembuatan} onChange={(v) => handleInputChange('tglPembuatan', v)} />
                      </div>
                      <div className="col-span-1">
                         <BentoInput label="Tanggal Revisi" value={sopData.tglRevisi} onChange={(v) => handleInputChange('tglRevisi', v)} />
                      </div>
                      <div className="col-span-1">
                         <BentoInput label="Tanggal Efektif" value={sopData.tglEfektif} onChange={(v) => handleInputChange('tglEfektif', v)} />
                      </div>
                      <div className="col-span-1">
                         <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Disahkan Oleh</label>
                         <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-sm text-emerald-800 font-bold border-l-4 h-[42px] flex items-center overflow-hidden whitespace-nowrap text-ellipsis">
                           {sopData.namaKepala}
                         </div>
                      </div>
                      <div className="col-span-2">
                         <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Judul SOP</label>
                         <textarea
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none min-h-[80px]"
                           value={sopData.judulSop}
                           onChange={(e) => handleInputChange('judulSop', e.target.value)}
                           placeholder="Contoh: Penerimaan Peserta Didik Baru (PPDB)..."
                         />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center text-white">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 uppercase">Detail Kelengkapan Administrasi</h2>
                          <p className="text-[10px] text-slate-500 font-bold">Lengkapi poin-poin pendukung standar operasional</p>
                        </div>
                      </div>
                      <button 
                        onClick={generateSopContent}
                        disabled={isGenerating || !sopData.judulSop}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} fill="currentColor" />}
                        OTOMATIS AI
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <BentoListEdit label="1. DASAR HUKUM" items={sopData.dasarHukum} onUpdate={(v) => handleInputChange('dasarHukum', v)} color="indigo" />
                      <BentoListEdit label="2. KUALIFIKASI PELAKSANA" items={sopData.kualifikasiPelaksana} onUpdate={(v) => handleInputChange('kualifikasiPelaksana', v)} color="indigo" />
                      <BentoListEdit label="3. KETERKAITAN" items={sopData.keterkaitan} onUpdate={(v) => handleInputChange('keterkaitan', v)} color="emerald" />
                      <BentoListEdit label="4. PERALATAN/PERLENGKAPAN" items={sopData.peralatanPerlengkapan} onUpdate={(v) => handleInputChange('peralatanPerlengkapan', v)} color="emerald" />
                      <BentoListEdit label="5. PERINGATAN" items={sopData.peringatan} onUpdate={(v) => handleInputChange('peringatan', v)} color="amber" />
                      <BentoListEdit label="6. PENCATATAN DAN PENDATAAN" items={sopData.pencatatanPendataan} onUpdate={(v) => handleInputChange('pencatatanPendataan', v)} color="amber" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeMenu === 'history' && (
                <motion.div
                  key="group-history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Riwayat Dokumen SOP</h2>
                        <p className="text-xs text-slate-500 font-medium tracking-wide">
                          Tersimpan di Neon PostgreSQL / Cloud Storage
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchUserSops(user ? user.uid : 'guest')}
                      className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} /> Muat Ulang
                    </button>
                  </div>

                  {userSops.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-2xl">
                      <Database size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-medium">Belum ada SOP yang tersimpan.</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Klik tombol 'Simpan ke Neon' pada bilah sisi untuk menyimpan dokumen SOP Anda ke database.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userSops.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="bg-white w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-slate-200 shadow-sm">
                              <span className="text-[10px] font-black text-slate-400">SOP</span>
                              <span className="text-sm font-bold text-indigo-600">{i + 1}</span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 line-clamp-1 uppercase">{v.judulSop || 'Untitled SOP'}</h4>
                              <p className="text-[10px] text-slate-500 font-medium">
                                Nomor: {v.nomorSop || '-'} • {(v.prosedur || []).length} Langkah Prosedur
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => {
                                 setSopData(v);
                                 setActiveMenu('entry');
                                 alert('SOP Berhasil Dimuat!');
                               }}
                               className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
                             >
                               <ChevronRight size={14} /> LIHAT / EDIT
                             </button>
                             <button 
                               onClick={async () => {
                                 if (confirm("Hapus SOP ini?")) {
                                   try {
                                     await deleteSopFromNeon(v.id);
                                     fetchUserSops(user ? user.uid : 'guest');
                                   } catch (err) {
                                     // Fallback delete from firestore
                                     try {
                                       await deleteDoc(doc(db, 'sops', v.id));
                                       fetchUserSops(user ? user.uid : 'guest');
                                     } catch (fbErr) {
                                       console.error("Gagal menghapus SOP:", fbErr);
                                     }
                                   }
                                 }
                               }}
                               className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                               title="Hapus SOP"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {activeMenu === 'preview' && (
                <motion.div
                  key="group-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center space-y-6"
                >
                   <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Printer size={32} />
                   </div>
                   <div className="space-y-2">
                     <h2 className="text-xl font-bold text-slate-900">Siap untuk Dicetak</h2>
                     <p className="text-slate-500 max-w-md mx-auto text-sm">Pratinjau dokumen Anda sudah siap di bawah. Anda bisa langsung mencetak atau menyimpannya dalam format PDF/Word/Excel.</p>
                   </div>
                   <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                     <button 
                       onClick={exportToExcel}
                       className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-emerald-200 transition-all active:scale-95"
                     >
                       <FileText size={18} /> SIMPAN EXCEL
                     </button>
                     <button 
                       onClick={() => window.print()}
                       className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-emerald-200 transition-all active:scale-95"
                     >
                       <Printer size={18} /> CETAK LANGSUNG
                     </button>
                     <button 
                       onClick={exportToPDF}
                       className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 transition-all active:scale-95"
                     >
                       <Download size={18} /> SIMPAN PDF
                     </button>
                     <button 
                       onClick={exportToWord}
                       className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 transition-all active:scale-95"
                     >
                       <FileDown size={18} /> SIMPAN WORD
                     </button>
                     <button 
                       onClick={copyToClipboard}
                       className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-md active:scale-95"
                     >
                       <Copy size={18} /> SALIN TEKS
                     </button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Bottom Section: Preview Pane */}
          {activeMenu !== 'entry' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} /> Pratinjau Dokumen
                </h2>
                <div className="flex gap-2">
                   <button onClick={() => window.print()} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100" title="Cetak SOP">
                     <Printer size={18} />
                   </button>
                   <button onClick={exportToPDF} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Download PDF">
                     <Download size={18} />
                   </button>
                   <button onClick={exportToWord} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Download Word">
                     <FileDown size={18} />
                   </button>
                   <button onClick={exportToExcel} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Download Excel">
                     <FileText size={18} />
                   </button>
                </div>
              </div>

              <div id="sop-document-to-print" className="bg-white rounded-3xl p-12 shadow-2xl border border-slate-200 origin-top transform transition-all flex flex-col min-h-[900px] print:m-0 print:p-0 print:shadow-none print:border-none">
                <div ref={previewRef} className="document-container text-black font-serif print:p-8">
                  {/* Header Logic */}
                  <div className="border-[1.5px] border-black">
                    <div className="grid grid-cols-[140px_1fr_300px]">
                      {/* Left: Logo */}
                      <div className="p-4 border-r-[1.5px] border-black flex items-center justify-center">
                        <img src={sopData.logoUrl} alt="Logo" className="w-[85px] h-[85px] object-contain" referrerPolicy="no-referrer" />
                      </div>
                      
                      {/* Center: Institution Info */}
                      <div className="p-4 border-r-[1.5px] border-black flex flex-col items-center justify-center text-center">
                        <p className="text-[14px] font-bold tracking-wide">KEMENTERIAN AGAMA RI</p>
                        <p className="text-[14px] font-bold tracking-wide leading-tight uppercase">{sopData.satker2}</p>
                        <p className="text-[11px] font-black uppercase text-slate-800">{sopData.madrasah}</p>
                        <p className="text-[9px] mt-1 text-slate-700 leading-snug">{sopData.alamatMadrasah}</p>
                      </div>

                      {/* Right: Meta Info Table */}
                      <div className="text-[10px] leading-tight">
                        <div className="grid grid-cols-[110px_6px_1fr] border-b border-black">
                          <div className="p-1 px-2 font-bold bg-white text-left">Nomor SOP</div>
                          <div className="p-1 font-bold text-center">:</div>
                          <div className="p-1 px-2">{sopData.nomorSop}</div>
                        </div>
                        <div className="grid grid-cols-[110px_6px_1fr] border-b border-black">
                          <div className="p-1 px-2 font-bold bg-white text-left">Tanggal Pembuatan</div>
                          <div className="p-1 font-bold text-center">:</div>
                          <div className="p-1 px-2">{sopData.tglPembuatan}</div>
                        </div>
                        <div className="grid grid-cols-[110px_6px_1fr] border-b border-black">
                          <div className="p-1 px-2 font-bold bg-white text-left">Tanggal Revisi</div>
                          <div className="p-1 font-bold text-center">:</div>
                          <div className="p-1 px-2">{sopData.tglRevisi}</div>
                        </div>
                        <div className="grid grid-cols-[110px_6px_1fr] border-b border-black">
                          <div className="p-1 px-2 font-bold bg-white text-left">Tanggal Efektif</div>
                          <div className="p-1 font-bold text-center">:</div>
                          <div className="p-1 px-2">{sopData.tglEfektif}</div>
                        </div>
                        <div className="grid grid-cols-[110px_6px_1fr] min-h-[50px]">
                          <div className="p-1 px-2 font-bold bg-white text-left">Disahkan oleh</div>
                          <div className="p-1 font-bold text-center">:</div>
                          <div className="p-1 px-2 flex flex-col justify-between">
                             <p className="font-bold">Kepala {sopData.madrasah.replace('MADRASAH IBTIDAIYAH NEGERI 1 ', 'MIN 1 ')}</p>
                             <div className="mt-4">
                               <p className="font-black text-[11px] underline uppercase leading-none">{sopData.namaKepala}</p>
                               <p className="text-[10px] leading-tight">NIP. {sopData.nipKepala}</p>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Title Bar */}
                    <div className="border-t-[1.5px] border-black bg-[#FFBD00] p-1.5 flex flex-col items-center justify-center">
                      <p className="text-[13px] font-bold">SOP</p>
                      <p className="text-[15px] font-black uppercase tracking-tight">{sopData.judulSop || '---'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 border-l border-t border-black">
                    <BentoPreviewSection label="DASAR HUKUM" items={sopData.dasarHukum} />
                    <BentoPreviewSection label="KUALIFIKASI PELAKSANA" items={sopData.kualifikasiPelaksana} />
                    <BentoPreviewSection label="KETERKAITAN" items={sopData.keterkaitan} />
                    <BentoPreviewSection label="PERALATAN/PERLENGKAPAN" items={sopData.peralatanPerlengkapan} />
                    <BentoPreviewSection label="PERINGATAN" items={sopData.peringatan} />
                    <BentoPreviewSection label="PENCATATAN DAN PENDATAAN" items={sopData.pencatatanPendataan} />
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    {(() => {
                      const uniqueActors = Array.from(new Set(sopData.prosedur.map(p => p.pelaksana))).filter(a => a).slice(0, 5);
                      const actorCols = uniqueActors.length > 0 ? uniqueActors : ['Pelaksana 1', 'Pelaksana 2', 'Pelaksana 3'];
                      
                      return (
                        <>
                          <table className="w-full border-collapse border border-black text-[9px]">
                          <thead className="bg-slate-100">
                            <tr>
                              <th rowSpan={2} className="border border-black p-1 w-8">No</th>
                              <th rowSpan={2} className="border border-black p-1 min-w-[150px]">Aktivitas</th>
                              <th colSpan={actorCols.length} className="border border-black p-1 text-center">Pelaksana</th>
                              <th colSpan={3} className="border border-black p-1 text-center">Mutu Baku</th>
                              <th rowSpan={2} className="border border-black p-1 w-12 text-[7px]">Ket.</th>
                            </tr>
                            <tr>
                              {actorCols.map((actor, idx) => (
                                <th key={idx} className="border border-black p-0.5 w-12 text-[8px] h-20">
                                  <div className="flex items-center justify-center h-full">
                                    <span className="block transform rotate-180" style={{ writingMode: 'vertical-rl' }}>{actor}</span>
                                  </div>
                                </th>
                              ))}
                              <th className="border border-black p-1 w-28">Persyaratan</th>
                              <th className="border border-black p-1 w-12 text-center">Waktu</th>
                              <th className="border border-black p-1 w-20">Output</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sopData.prosedur.length > 0 ? (
                              sopData.prosedur.map((p, i) => (
                                <tr key={i} className="group hover:bg-slate-50 transition-colors">
                                  <td className="border border-black p-2 text-center font-bold">{p.nomor}</td>
                                  <td className="border border-black p-2 pl-2 relative group">
                                    {editingIdx === i ? (
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
                                           <span className="text-[7px] font-black text-indigo-500 uppercase tracking-wider">Edit Tahap {p.nomor}</span>
                                           <div className="flex gap-1">
                                              <button 
                                                onClick={() => {
                                                  const newProsedur = [...sopData.prosedur];
                                                  newProsedur[i].aktivitas = tempAktivitas;
                                                  newProsedur[i].simbol = tempSimbol;
                                                  newProsedur[i].pelaksana = tempPelaksana;
                                                  newProsedur[i].mutuBaku = {
                                                    persyaratan: tempPersyaratan,
                                                    waktu: tempWaktu,
                                                    output: tempOutput
                                                  };
                                                  handleInputChange('prosedur', newProsedur);
                                                  setEditingIdx(null);
                                                }} 
                                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded text-[7px] font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                              >
                                                <Check size={8} strokeWidth={3} /> SIMPAN
                                              </button>
                                              <button 
                                                onClick={() => setEditingIdx(null)} 
                                                className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[7px] font-bold hover:bg-slate-200"
                                              >
                                                BATAL
                                              </button>
                                           </div>
                                        </div>
                                        
                                        <textarea 
                                          autoFocus
                                          className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 outline-none text-[9px] font-medium min-h-[50px] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                          value={tempAktivitas}
                                          placeholder="Tulis aktivitas..."
                                          onChange={(e) => setTempAktivitas(e.target.value)}
                                        />
                                        
                                        <div className="grid grid-cols-2 gap-1.5">
                                          <div className="space-y-0.5">
                                            <label className="text-[6px] font-bold text-slate-400 uppercase">Simbol</label>
                                            <select 
                                              className="w-full text-[8px] border border-slate-200 rounded p-1 bg-slate-50 outline-none"
                                              value={tempSimbol}
                                              onChange={(e) => setTempSimbol(e.target.value as any)}
                                            >
                                              <option value="Process">Proses (Kotak)</option>
                                              <option value="Terminator">Mulai/Akhir (Kapsul)</option>
                                              <option value="Decision">Keputusan (Ketupat)</option>
                                              <option value="Connector">Hubungan (Segilima)</option>
                                            </select>
                                          </div>
                                          <div className="space-y-0.5">
                                            <label className="text-[6px] font-bold text-slate-400 uppercase">Pelaksana</label>
                                            <input 
                                              className="w-full text-[8px] border border-slate-200 rounded p-1 bg-slate-50 outline-none"
                                              value={tempPelaksana}
                                              placeholder="Nama aktor..."
                                              onChange={(e) => setTempPelaksana(e.target.value)}
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1">
                                           <div className="space-y-0.5">
                                              <label className="text-[6px] font-bold text-slate-400 uppercase">Kelengkapan</label>
                                              <input 
                                                className="w-full text-[7px] border border-slate-200 rounded p-0.5 bg-slate-50 outline-none"
                                                value={tempPersyaratan}
                                                onChange={(e) => setTempPersyaratan(e.target.value)}
                                              />
                                           </div>
                                           <div className="space-y-0.5">
                                              <label className="text-[6px] font-bold text-slate-400 uppercase">Waktu</label>
                                              <input 
                                                className="w-full text-[7px] border border-slate-200 rounded p-0.5 bg-slate-50 outline-none"
                                                value={tempWaktu}
                                                onChange={(e) => setTempWaktu(e.target.value)}
                                              />
                                           </div>
                                           <div className="space-y-0.5">
                                              <label className="text-[6px] font-bold text-slate-400 uppercase">Output</label>
                                              <input 
                                                className="w-full text-[7px] border border-slate-200 rounded p-0.5 bg-slate-50 outline-none"
                                                value={tempOutput}
                                                onChange={(e) => setTempOutput(e.target.value)}
                                              />
                                           </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="relative min-h-[30px] flex items-center pr-6 cursor-pointer group/cell"
                                        onClick={() => {
                                          setEditingIdx(i);
                                          setTempAktivitas(p.aktivitas);
                                          setTempSimbol(p.simbol || 'Process');
                                          setTempPelaksana(p.pelaksana);
                                          setTempPersyaratan(p.mutuBaku.persyaratan);
                                          setTempWaktu(p.mutuBaku.waktu);
                                          setTempOutput(p.mutuBaku.output);
                                        }}
                                      >
                                        <span className="leading-tight block font-medium group-hover/cell:text-indigo-600 transition-colors">{p.aktivitas}</span>
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-300 group-hover/cell:text-indigo-400 opacity-0 group-hover/cell:opacity-100 transition-all bg-indigo-50 rounded">
                                          <Edit2 size={10} />
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  {actorCols.map((actor, idx) => {
                                    const isActor = p.pelaksana === actor;
                                    const nextStep = sopData.prosedur[i+1];
                                    const isLast = i === sopData.prosedur.length - 1;
                                    
                                    return (
                                      <td key={idx} className="border border-black p-0 relative h-24 w-16 align-middle overflow-visible">
                                        {/* Incoming vertical line from top border to center */}
                                        {isActor && i > 0 && (
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1/2 bg-black z-0 flex flex-col items-center">
                                            <div className="mt-auto border-l-[4px] border-transparent border-r-[4px] border-t-[6px] border-t-black"></div>
                                          </div>
                                        )}
                                        
                                        {/* Outgoing line logic */}
                                        {isActor && !isLast && nextStep && (
                                          (() => {
                                            const nextIdx = actorCols.indexOf(nextStep.pelaksana);
                                            if (nextIdx === -1) return null;
                                            if (nextIdx === idx) {
                                              return <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1/2 bg-black z-0"></div>;
                                            } else {
                                              const diff = nextIdx - idx;
                                              return (
                                                <>
                                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1/2 bg-black z-0"></div>
                                                  <div 
                                                    className="absolute bottom-0 left-1/2 h-[1.5px] bg-black z-10 origin-left"
                                                    style={{ width: `${Math.abs(diff) * 100}%`, transform: `rotate(${diff > 0 ? 0 : 180}deg)` }}
                                                  ></div>
                                                </>
                                              );
                                            }
                                          })()
                                        )}

                                        {isActor && (
                                          <div className="flex flex-col items-center justify-center h-full relative z-20 scale-125">
                                             <FlowchartSymbol 
                                               type={p.simbol || 'Process'} 
                                               color={
                                                 p.simbol === 'Terminator' ? '#90ad5c' : 
                                                 p.simbol === 'Decision' ? '#dae4f6' : 
                                                 ['#dae4f6', '#fee9c3', '#e2efdb', '#fce4ec', '#e8f5e9'][idx % 5]
                                               } 
                                             />
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="border border-black p-2 leading-tight text-[8px]">{p.mutuBaku.persyaratan}</td>
                                  <td className="border border-black p-2 text-center">{p.mutuBaku.waktu}</td>
                                  <td className="border border-black p-2 leading-tight text-[8px]">{p.mutuBaku.output}</td>
                                  <td className="border border-black p-2 text-center"></td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan={actorCols.length + 4} className="h-40 border border-black text-center italic text-lg opacity-20">Gunakan tombol 'OTOMATIS AI' untuk membuat prosedur</td></tr>
                            )}
                          </tbody>
                        </table>

                        <div className="mt-6 border border-black p-4 text-[9px]">
                          <p className="font-bold mb-3 underline uppercase text-[10px]">Keterangan:</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 items-center">
                            <div className="flex items-center gap-2">
                              <div className="scale-75 origin-left h-8 w-8 flex items-center justify-center">
                                <FlowchartSymbol type="Terminator" color="#90ad5c" />
                              </div>
                              <span className="font-bold text-[9px] uppercase">= Mulai / Selesai</span>
                            </div>
                            {actorCols.map((actor, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="scale-75 origin-left h-8 w-8 flex items-center justify-center">
                                  <FlowchartSymbol type="Process" color={['#dae4f6', '#fee9c3', '#e2efdb', '#fce4ec', '#e8f5e9'][idx % 5]} />
                                </div>
                                <span className="font-bold italic text-slate-700 text-[9px] uppercase">= Proses ({actor})</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <div className="scale-75 origin-left h-8 w-8 flex items-center justify-center">
                                <FlowchartSymbol type="Decision" color="#dae4f6" />
                              </div>
                              <span className="font-bold text-[9px] uppercase">= Hasil / Keputusan</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 flex items-center justify-center">
                                <div className="relative w-10 h-[1.5px] bg-black">
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 border-l-[6px] border-transparent border-t-[4px] border-b-[4px] border-l-black"></div>
                                </div>
                              </div>
                              <span className="font-bold text-[9px] uppercase">= Alur Proses</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>
          )}
        </div>
      </main>

      <FirebaseConfigModal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)} 
        initialMessage={configModalMessage} 
      />

      <NeonConfigModal
        isOpen={isNeonModalOpen}
        onClose={() => setIsNeonModalOpen(false)}
        onConnected={() => {
          checkNeonStatus().then(status => setNeonStatus(status));
          fetchUserSops(user ? user.uid : 'guest');
        }}
      />
    </div>
  );
}

// Bento Sub-components
function FlowchartSymbol({ type, color, hasNext }: { type: 'Terminator' | 'Process' | 'Decision' | 'Connector', color?: string, hasNext?: boolean }) {
  const common = "w-10 h-10 flex items-center justify-center relative";
  const fillColor = color || "white";
  return (
    <div className={common}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-sm">
        {type === 'Terminator' && (
          <rect x="5" y="12" width="30" height="16" rx="8" fill={fillColor} stroke="black" strokeWidth="1.5" />
        )}
        {type === 'Process' && (
          <rect x="5" y="10" width="30" height="20" fill={fillColor} stroke="black" strokeWidth="1.5" />
        )}
        {type === 'Decision' && (
          <path d="M20 5 L35 20 L20 35 L5 20 Z" fill={fillColor} stroke="black" strokeWidth="1.5" />
        )}
        {type === 'Connector' && (
          <path d="M10 10 L30 10 L35 20 L30 30 L10 30 Z" fill={fillColor} stroke="black" strokeWidth="1.5" />
        )}
        {/* Draw a small dot in center for connector lines if needed, but usually the line comes to the edge */}
      </svg>
      {hasNext && (
        <div className="absolute top-[35px] left-1/2 -translate-x-1/2 w-[1.5px] h-10 bg-black z-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-black"></div>
        </div>
      )}
    </div>
  );
}

function BentoInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
      />
    </div>
  );
}

function BentoListEdit({ label, items, onUpdate, color }: { label: string, items: string[], onUpdate: (v: string[]) => void, color: 'indigo' | 'emerald' | 'amber' }) {
  const [val, setVal] = useState('');
  const add = () => { if(val.trim()){ onUpdate([...items, val]); setVal(''); } };
  return (
    <div className="space-y-3">
      <p className={`text-[10px] font-black uppercase tracking-widest ${color === 'indigo' ? 'text-indigo-900' : 'text-emerald-900'}`}>{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <div className="flex-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">{i+1}. {item}</div>
            <button onClick={() => onUpdate(items.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="flex gap-2 p-1">
          <input 
            type="text" 
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Tambah baru..."
            className="flex-1 text-[11px] p-2 outline-none border-b border-slate-200 focus:border-indigo-400"
          />
          <button onClick={add} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><Plus size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function BentoPreviewSection({ label, items }: { label: string, items: string[] }) {
  return (
    <div className="p-2 border-r border-b border-black">
      <p className="font-bold underline mb-1 uppercase text-[8px]">{label}:</p>
      <ul className="list-decimal pl-3 space-y-0.5 text-slate-700">
        {items.map((it, i) => <li key={i}>{it}</li>)}
        {items.length === 0 && <li className="italic opacity-30">N/A</li>}
      </ul>
    </div>
  );
}

// Sub-components
function InputField({ label, id, value, onChange, icon }: { label: string, id: string, value: string, onChange: (v: string) => void, icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] uppercase font-bold text-slate-500 tracking-wide block ml-1">{label}</label>
      <div className="relative group">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500">{icon}</div>}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium ${icon ? 'pl-11' : ''}`}
        />
      </div>
    </div>
  );
}

function ListEdit({ label, items, onUpdate }: { label: string, items: string[], onUpdate: (items: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    if (inputValue.trim()) {
      onUpdate([...items, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeItem = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-600 block">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 group">
            <div className="flex-1 bg-slate-50 px-3 py-2 rounded-lg text-xs leading-relaxed border border-slate-100 flex items-center justify-between">
              <span>{i+1}. {item}</span>
              <button 
                onClick={() => removeItem(i)}
                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Tambah baru..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-emerald-500 transition-all"
          />
          <button onClick={addItem} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ label, items }: { label: string, items: string[] }) {
  return (
    <div className="border-r border-b border-black p-2 min-h-[40px]">
      <p className="font-bold underline mb-1">{label} :</p>
      <div className="space-y-0.5">
        {items.length > 0 ? (
          items.map((item, i) => (
            <div key={i} className="flex gap-1">
              <span className="flex-shrink-0 w-3">{i+1}.</span>
              <span>{item}</span>
            </div>
          ))
        ) : (
          <span className="italic opacity-30">Belum diisi...</span>
        )}
      </div>
    </div>
  );
}
