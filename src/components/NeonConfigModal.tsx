import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, X, Key, ExternalLink } from 'lucide-react';
import { checkNeonStatus, saveNeonConnectionString, NeonDbStatus } from '../services/neonService';

interface NeonConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const NeonConfigModal: React.FC<NeonConfigModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [connectionString, setConnectionString] = useState('');
  const [status, setStatus] = useState<NeonDbStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const res = await checkNeonStatus();
      setStatus(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionString.trim()) {
      setErrorMsg('Masukkan Connection String dari console.neon.tech');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await saveNeonConnectionString(connectionString.trim());
      if (res.success) {
        setSuccessMsg('Koneksi ke Neon PostgreSQL berhasil dihubungkan!');
        loadStatus();
        if (onConnected) onConnected();
      } else {
        setErrorMsg(res.message || 'Gagal menghubungkan ke Neon');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Konfigurasi Penyimpanan Neon PostgreSQL</h3>
              <p className="text-xs text-slate-400">console.neon.tech Serverless Database</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            status?.status === 'connected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : status?.status === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {status?.status === 'connected' ? (
              <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-bold text-sm">
                Status Neon: {status?.status === 'connected' ? 'Terhubung (Aktif)' : 'Belum Terhubung'}
              </p>
              <p className="mt-0.5 opacity-90">{status?.message || 'Memeriksa status...'}</p>
            </div>
            <button 
              onClick={loadStatus}
              disabled={isLoading}
              className="p-1.5 hover:bg-black/5 rounded-lg text-slate-600 transition"
              title="Perbarui Status"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Guide Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
            <p className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Cara Mendapatkan Connection String Neon:</span>
              <a 
                href="https://console.neon.tech" 
                target="_blank" 
                rel="noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-normal"
              >
                Buka neon.tech <ExternalLink size={12} />
              </a>
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600">
              <li>Masuk ke <strong className="text-slate-800">console.neon.tech</strong> & buat proyek baru (gratis).</li>
              <li>Di halaman Dashboard proyek, cari panel <strong className="text-slate-800">Connection Details</strong>.</li>
              <li>Pilih opsi <strong className="text-slate-800">Connection string</strong> lalu salin URL yang dimulai dengan <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900">postgresql://...</code></li>
              <li>Tempelkan ke kolom input di bawah ini.</li>
            </ol>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Key size={14} className="text-indigo-600" /> Connection String Neon (PostgreSQL):
              </label>
              <textarea
                rows={3}
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="postgresql://neondb_owner:password@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 size={15} /> {successMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 disabled:opacity-60"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
                {isLoading ? 'Menyambungkan...' : 'Simpan & Hubungkan ke Neon'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
