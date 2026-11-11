import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { getFirebaseAuth, isFirebaseConfigured } from '@/config/firebase';
import {
  daftarPraktikan,
  keluarDariAplikasi,
  langgananProfil,
  masukDenganEmail,
  pastikanProfil,
  pesanErrorAuth,
  type ProfilPengguna,
} from '@/services/authService';

type StatusAuth = 'memuat' | 'masuk' | 'keluar';

type AuthContextValue = {
  status: StatusAuth;
  pengguna: ProfilPengguna | null;
  error: string | null;
  daftar: (input: { nama: string; email: string; password: string }) => Promise<void>;
  masuk: (input: { email: string; password: string }) => Promise<void>;
  keluar: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  // Tanpa konfigurasi Firebase, tidak ada sesi yang bisa dipulihkan.
  const [status, setStatus] = useState<StatusAuth>(
    isFirebaseConfigured ? 'memuat' : 'keluar',
  );
  const [pengguna, setPengguna] = useState<ProfilPengguna | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    let aktif = true;
    let berhentiLangganan: (() => void) | null = null;

    // Sesi dipulihkan Firebase dari AsyncStorage; listener ini menjadi sumber kebenaran.
    const berhentiAuth = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!aktif) return;

      berhentiLangganan?.();
      berhentiLangganan = null;

      if (!user) {
        setPengguna(null);
        setStatus('keluar');
        return;
      }

      setStatus('memuat');
      try {
        const profil = await pastikanProfil(user);
        if (!aktif) return;

        setPengguna(profil);
        setStatus('masuk');

        // Perubahan role dari Firestore langsung tercermin tanpa restart.
        berhentiLangganan = langgananProfil(
          profil.uid,
          (profilTerbaru) => {
            if (aktif) setPengguna(profilTerbaru);
          },
          (err) => {
            if (aktif) setError(pesanErrorAuth(err));
          },
        );
      } catch (err) {
        if (!aktif) return;
        setError(pesanErrorAuth(err));
        setStatus('keluar');
      }
    });

    return () => {
      aktif = false;
      berhentiLangganan?.();
      berhentiAuth();
    };
  }, []);

  const daftar = useCallback(
    async (input: { nama: string; email: string; password: string }) => {
      setError(null);
      await daftarPraktikan(input);
    },
    [],
  );

  const masuk = useCallback(async (input: { email: string; password: string }) => {
    setError(null);
    await masukDenganEmail(input);
  }, []);

  const keluar = useCallback(async () => {
    setError(null);
    await keluarDariAplikasi();
    setPengguna(null);
    setStatus('keluar');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, pengguna, error, daftar, masuk, keluar }),
    [status, pengguna, error, daftar, masuk, keluar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return context;
}
