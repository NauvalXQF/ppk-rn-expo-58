import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { unregisterUserDeviceForNotifications } from '@/services/notifications/notificationService';

type StatusAuth = 'memuat' | 'masuk' | 'keluar';

type AuthContextValue = {
  status: StatusAuth;
  pengguna: ProfilPengguna | null;
  error: string | null;
  daftar: (input: { nama: string; nim?: string; email: string; password: string }) => Promise<void>;
  masuk: (input: { email: string; password: string }) => Promise<void>;
  keluar: () => Promise<void>;
  retryProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  // Tanpa konfigurasi Firebase, tidak ada sesi yang bisa dipulihkan.
  const [status, setStatus] = useState<StatusAuth>(
    isFirebaseConfigured ? 'memuat' : 'keluar',
  );
  const [pengguna, setPengguna] = useState<ProfilPengguna | null>(null);
  const [error, setError] = useState<string | null>(null);
  const authSeqRef = useRef(0);
  const unsubProfilRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const loadUserProfile = useCallback(async (user: NonNullable<ReturnType<typeof getFirebaseAuth>['currentUser']>) => {
    const seq = ++authSeqRef.current;
    unsubProfilRef.current?.();
    unsubProfilRef.current = null;

    setStatus('memuat');
    setError(null);
    try {
      const profil = await pastikanProfil(user);
      if (!mountedRef.current || seq !== authSeqRef.current) return;

      setPengguna(profil);
      setStatus('masuk');

      // Perubahan role dari Firestore langsung tercermin tanpa restart.
      unsubProfilRef.current = langgananProfil(
        profil.uid,
        (profilTerbaru) => {
          if (mountedRef.current && seq === authSeqRef.current) {
            setPengguna(profilTerbaru);
          }
        },
        (err) => {
          if (mountedRef.current && seq === authSeqRef.current) {
            setError(pesanErrorAuth(err));
          }
        },
      );
    } catch (err) {
      if (!mountedRef.current || seq !== authSeqRef.current) return;
      setError(pesanErrorAuth(err));
      setPengguna(null);
      setStatus('keluar');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!isFirebaseConfigured) return;

    // Sesi dipulihkan Firebase dari AsyncStorage; listener ini menjadi sumber kebenaran.
    const berhentiAuth = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!mountedRef.current) return;

      if (!user) {
        authSeqRef.current += 1;
        unsubProfilRef.current?.();
        unsubProfilRef.current = null;
        setPengguna(null);
        setStatus('keluar');
        return;
      }

      await loadUserProfile(user);
    });

    return () => {
      mountedRef.current = false;
      authSeqRef.current += 1;
      unsubProfilRef.current?.();
      unsubProfilRef.current = null;
      berhentiAuth();
    };
  }, [loadUserProfile]);

  const retryProfile = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      setError(null);
      setStatus('keluar');
      return;
    }
    await loadUserProfile(currentUser);
  }, [loadUserProfile]);

  const daftar = useCallback(
    async (input: { nama: string; nim?: string; email: string; password: string }) => {
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
    // Cabut token perangkat sebelum sesi Firebase Auth berakhir agar aturan Firestore mengizinkan hapus.
    await unregisterUserDeviceForNotifications(pengguna?.uid).catch(() => {});
    await keluarDariAplikasi();
    authSeqRef.current += 1;
    unsubProfilRef.current?.();
    unsubProfilRef.current = null;
    setPengguna(null);
    setStatus('keluar');
  }, [pengguna?.uid]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, pengguna, error, daftar, masuk, keluar, retryProfile }),
    [status, pengguna, error, daftar, masuk, keluar, retryProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return context;
}
