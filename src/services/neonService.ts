// Client helper for Neon PostgreSQL storage via Express API

export interface NeonDbStatus {
  status: 'connected' | 'disconnected' | 'error';
  message: string;
  hasDatabaseUrl: boolean;
}

export async function checkNeonStatus(): Promise<NeonDbStatus> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { status: 'disconnected', message: 'Server API unreachable', hasDatabaseUrl: false };
    }
    const data = await res.json();
    return data.database || { status: 'disconnected', message: 'Unknown status', hasDatabaseUrl: false };
  } catch (err: any) {
    return { status: 'disconnected', message: err.message || 'Cannot reach API', hasDatabaseUrl: false };
  }
}

export async function saveNeonConnectionString(connectionString: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/config/database-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan konfigurasi Neon');
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Terjadi kesalahan saat menghubungi server' };
  }
}

export async function fetchSopsFromNeon(userId: string = 'guest'): Promise<any[]> {
  try {
    const res = await fetch(`/api/sops?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.sops || [];
  } catch (err) {
    console.warn('[Neon Service] Error fetching SOPs:', err);
    throw err;
  }
}

export async function saveSopToNeon(sopData: any, userId: string = 'guest'): Promise<{ id: string; message: string }> {
  const payload = {
    ...sopData,
    userId,
  };

  const res = await fetch('/api/sops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan SOP ke Neon');
  }

  return { id: data.id, message: data.message };
}

export async function deleteSopFromNeon(sopId: string): Promise<void> {
  const res = await fetch(`/api/sops/${encodeURIComponent(sopId)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal menghapus SOP dari Neon');
  }
}
