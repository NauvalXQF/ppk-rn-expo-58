import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { PraktikanFinesScreen } from '@/features/payments/PraktikanFinesScreen';

export default function DendaRoute() {
  const { status, pengguna } = useAuth();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  if (status === 'memuat') return null;
  if (status !== 'masuk' || pengguna?.role !== 'praktikan') return <Redirect href="/" />;
  const initialTab = tab === 'riwayat' ? 'riwayat' : 'aktif';
  return <PraktikanFinesScreen key={pengguna.uid + ':' + initialTab} uid={pengguna.uid} initialTab={initialTab} />;
}
