import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  Database, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  RotateCcw,
  Copy,
  ClipboardCheck
} from 'lucide-react';
import { 
  getEffectiveFirebaseConfig, 
  saveCustomFirebaseConfig, 
  clearCustomFirebaseConfig, 
  hasCustomFirebaseConfig,
  FirebaseAppConfig 
} from '../firebase';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  initialMessage
}) => {
  const currentConfig = getEffectiveFirebaseConfig();
  const [pasteSnippet, setPasteSnippet] = useState('');
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');
  const [firestoreDatabaseId, setFirestoreDatabaseId] = useState(currentConfig.firestoreDatabaseId || '(default)');
  const [activeTab, setActiveTab] = useState<'paste' | 'manual' | 'guide'>('paste');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleParseSnippet = (snippet: string) => {
    setPasteSnippet(snippet);
    if (!snippet.trim()) return;

    try {
      // Try parsing direct JSON
      const json = JSON.parse(snippet);
      if (json.apiKey) setApiKey(json.apiKey);
      if (json.authDomain) setAuthDomain(json.authDomain);
      if (json.projectId) setProjectId(json.projectId);
      if (json.storageBucket) setStorageBucket(json.storageBucket);
      if (json.messagingSenderId) setMessagingSenderId(json.messagingSenderId);
      if (json.appId) setAppId(json.appId);
      if (json.firestoreDatabaseId) setFirestoreDatabaseId(json.firestoreDatabaseId);
      return;
    } catch {
      // Parse JS object style: apiKey: "...", or apiKey: '...'
      const extract = (key: string) => {
        const match = snippet.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
        return match ? match[1] : '';
      };

      const extractedApiKey = extract('apiKey');
      const extractedAuthDomain = extract('authDomain');
      const extractedProjectId = extract('projectId');
      const extractedStorageBucket = extract('storageBucket');
      const extractedSenderId = extract('messagingSenderId');
      const extractedAppId = extract('appId');

      if (extractedApiKey) setApiKey(extractedApiKey);
      if (extractedAuthDomain) setAuthDomain(extractedAuthDomain);
      if (extractedProjectId) setProjectId(extractedProjectId);
      if (extractedStorageBucket) setStorageBucket(extractedStorageBucket);
      if (extractedSenderId) setMessagingSenderId(extractedSenderId);
      if (extractedAppId) setAppId(extractedAppId);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim() || !projectId.trim()) {
      alert("Harap masukkan setidaknya API Key dan Project ID Firebase.");
      return;
    }

    const newConfig: FirebaseAppConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim() || `${projectId.trim()}.firebasestorage.app`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
      firestoreDatabaseId: firestoreDatabaseId.trim() || '(default)'
    };

    saveCustomFirebaseConfig(newConfig);
    alert("Konfigurasi Firebase berhasil disimpan! Halaman akan dimuat ulang untuk menerapkan konfigurasi baru.");
    window.location.reload();
  };

  const handleReset = () => {
    if (confirm("Reset konfigurasi kustom dan kembali ke konfigurasi bawaan?")) {
      clearCustomFirebaseConfig();
      window.location.reload();
    }
  };

  const isCustom = hasCustomFirebaseConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-indigo-950 p-6 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Settings className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Pengaturan Konfigurasi Firebase</h2>
              <p className="text-xs text-indigo-300">Solusi untuk hosting mandiri (Vercel, Netlify, atau Custom Domain)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-indigo-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors relative z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notice if opened due to error */}
        {initialMessage && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-900">
              <p className="font-bold">Perhatian Masalah Autentikasi / API Key:</p>
              <p className="mt-0.5">{initialMessage}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition-all ${
              activeTab === 'paste' 
                ? 'bg-white text-indigo-950 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tempel Kode Config (Cepat)
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition-all ${
              activeTab === 'manual' 
                ? 'bg-white text-indigo-950 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Input Manual
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition-all ${
              activeTab === 'guide' 
                ? 'bg-white text-indigo-950 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Panduan Firebase Console
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-slate-700">
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900">
                <p className="font-bold flex items-center gap-1.5 mb-1 text-blue-950">
                  <Database size={15} /> Cara Cepat:
                </p>
                Salin objek <code>firebaseConfig</code> dari Firebase Console proyek Anda, lalu tempelkan di kotak bawah ini. Sistem akan otomatis mengisi parameter yang dibutuhkan.
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Tempel Objek JavaScript / JSON Firebase Config di Sini:
                </label>
                <textarea
                  rows={6}
                  value={pasteSnippet}
                  onChange={(e) => handleParseSnippet(e.target.value)}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "mora-sop-xyz.firebaseapp.com",\n  projectId: "mora-sop-xyz",\n  ...\n};`}
                  className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Parsed Preview */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-1.5">
                <p className="font-bold text-slate-700 mb-2">Hasil Pembacaan Konfigurasi:</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">API Key:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">
                      {apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : '(kosong)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Project ID:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">{projectId || '(kosong)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Auth Domain:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">{authDomain || '(kosong)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">App ID:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">
                      {appId ? `${appId.slice(0, 12)}...` : '(kosong)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Key size={14} className="text-indigo-600" /> Firebase API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Project ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="nama-project-anda"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Auth Domain</label>
                  <input
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="nama-project.firebaseapp.com"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Storage Bucket</label>
                  <input
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="nama-project.firebasestorage.app"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">App ID</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:123456:web:abcdef..."
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={messagingSenderId}
                    onChange={(e) => setMessagingSenderId(e.target.value)}
                    placeholder="1234567890"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Firestore Database ID</label>
                  <input
                    type="text"
                    value={firestoreDatabaseId}
                    onChange={(e) => setFirestoreDatabaseId(e.target.value)}
                    placeholder="(default)"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-950">
                <p className="font-bold text-sm mb-1">Langkah Menyiapkan Firebase Gratis untuk Web Vercel:</p>
                <ol className="list-decimal pl-4 space-y-2 mt-2">
                  <li>
                    Buka{' '}
                    <a 
                      href="https://console.firebase.google.com" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-indigo-600 font-bold underline inline-flex items-center gap-1"
                    >
                      console.firebase.google.com <ExternalLink size={12} />
                    </a>{' '}
                    dan login dengan akun Google Anda.
                  </li>
                  <li>
                    Klik <b>Add project</b> (atau gunakan project yang ada), beri nama (misalnya: <code>mora-sop</code>).
                  </li>
                  <li>
                    Masuk ke menu <b>Build &gt; Authentication</b>, klik <i>Get Started</i>, lalu di tab <b>Sign-in method</b> aktifkan <b>Email/Password</b>.
                  </li>
                  <li>
                    Masuk ke tab <b>Settings &gt; Authorized domains</b> di menu Authentication, klik <b>Add domain</b>, lalu masukkan domain hosting Anda:
                    <div className="mt-1 font-mono bg-white p-2 rounded-lg border border-emerald-300 text-emerald-800 font-bold">
                      mora-sop.vercel.app
                    </div>
                  </li>
                  <li>
                    Masuk ke menu <b>Build &gt; Firestore Database</b>, klik <i>Create database</i> (pilih mode <b>Production</b> atau <b>Test</b>).
                  </li>
                  <li>
                    Klik ikon Gear ⚙️ di samping <i>Project Overview</i> &gt; <b>Project settings</b> &gt; tab <b>General</b> &gt; scroll ke bawah ke bagian <b>Your apps</b> &gt; klik ikon <b>Web (&lt;/&gt;)</b>.
                  </li>
                  <li>
                    Salin kode <code>firebaseConfig = &#123; ... &#125;</code> lalu tempelkan di tab <b>Tempel Kode Config</b> di aplikasi ini!
                  </li>
                </ol>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-700">
                <p className="font-bold text-xs mb-1">Opsi Environment Variables di Vercel:</p>
                <p className="text-[11px] text-slate-600 mb-2">
                  Jika Anda ingin konfigurasi ini berlaku permanen untuk seluruh pengunjung di Vercel, tambahkan variabel berikut di <b>Vercel Project &gt; Settings &gt; Environment Variables</b>:
                </p>
                <div className="font-mono text-[10px] bg-white p-3 rounded-xl border border-slate-200 space-y-1 text-slate-800">
                  <p>VITE_FIREBASE_API_KEY=AIzaSy...</p>
                  <p>VITE_FIREBASE_PROJECT_ID=project-anda</p>
                  <p>VITE_FIREBASE_AUTH_DOMAIN=project-anda.firebaseapp.com</p>
                  <p>VITE_FIREBASE_STORAGE_BUCKET=project-anda.firebasestorage.app</p>
                  <p>VITE_FIREBASE_MESSAGING_SENDER_ID=123456789</p>
                  <p>VITE_FIREBASE_APP_ID=1:123456:web:abcdef</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between gap-3">
          <div>
            {isCustom && (
              <button
                onClick={handleReset}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-50 transition-colors"
              >
                <RotateCcw size={14} /> Reset ke Bawaan
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Check size={16} /> Simpan & Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
