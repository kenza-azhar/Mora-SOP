import React from 'react';
import { 
  X, 
  AlertCircle, 
  ExternalLink, 
  CheckCircle2, 
  ShieldAlert, 
  Globe, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { getEffectiveFirebaseConfig } from '../firebase';

interface AuthHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest?: () => void;
}

export const AuthHelpModal: React.FC<AuthHelpModalProps> = ({
  isOpen,
  onClose,
  onContinueAsGuest
}) => {
  if (!isOpen) return null;

  const config = getEffectiveFirebaseConfig();
  const projectId = config.projectId || 'gen-lang-client-0942631481';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  const consoleDomainUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-indigo-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 text-amber-200 flex items-center justify-center border border-white/20">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Aktivasi Email/Password Firebase</h3>
              <p className="text-xs text-amber-100/80">Proyek ID: <span className="font-mono font-semibold">{projectId}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-slate-700">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-950">Penyebab Muncul Notifikasi Error:</p>
              <p className="mt-1 leading-relaxed">
                Di Firebase Authentication, metode pendaftaran <strong>Email/Kata Sandi</strong> secara bawaan berstatus <em>Nonaktif (Disabled)</em> sampai diaktifkan secara manual di Firebase Console.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Langkah 1 Menit untuk Mengaktifkannya:
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                <div>
                  <p className="font-bold text-slate-900">Buka Menu Sign-in Method di Firebase</p>
                  <p className="text-slate-600 mt-0.5">
                    Klik tombol di bawah untuk membuka halaman penyedia login proyek Anda.
                  </p>
                  <a 
                    href={consoleAuthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition border border-indigo-200"
                  >
                    Buka Tab Sign-in Providers <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                <div>
                  <p className="font-bold text-slate-900">Aktifkan "Email/Password"</p>
                  <p className="text-slate-600 mt-0.5">
                    Klik baris <strong>Email/Password</strong> &gt; Geser sakelar <strong>Enable (Aktifkan)</strong> ke posisi AKTIF &gt; Klik <strong>Save (Simpan)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                <div>
                  <p className="font-bold text-slate-900">Izinkan Domain Hosting (Khusus Vercel)</p>
                  <p className="text-slate-600 mt-0.5">
                    Di tab <strong>Settings</strong> &gt; <strong>Authorized domains</strong>, klik <strong>Add domain</strong> lalu masukkan: <code className="bg-slate-200 font-mono px-1 py-0.5 rounded font-bold text-slate-800">mora-sop-s7ul.vercel.app</code> atau <code className="bg-slate-200 font-mono px-1 py-0.5 rounded font-bold text-slate-800">vercel.app</code>.
                  </p>
                  <a 
                    href={consoleDomainUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition border border-indigo-200"
                  >
                    Buka Pengaturan Domain Resmi <Globe size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Option */}
          {onContinueAsGuest && (
            <div className="pt-2 border-t border-slate-100">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600" /> Ingin Langsung Menggunakan Aplikasi Sekarang?
                  </p>
                  <p className="text-emerald-700 mt-0.5">
                    Anda bisa masuk dalam <strong>Mode Tamu</strong> untuk membuat SOP, mencetak, dan menyimpan ke Neon Database tanpa akun.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onContinueAsGuest();
                  }}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex-shrink-0 shadow-sm flex items-center gap-1"
                >
                  Gunakan Mode Tamu <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
            >
              Tutup Panduan
            </button>
            <a
              href={consoleAuthUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-2 shadow-md shadow-indigo-600/30"
            >
              <ExternalLink size={14} /> Buka Firebase Console Sekarang
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
