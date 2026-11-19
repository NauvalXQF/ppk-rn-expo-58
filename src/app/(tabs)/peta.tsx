import { useAuth } from '@/contexts/AuthContext';
import { MapsScreen } from '@/features/maps/MapsScreen';

export default function PetaRoute() {
  const { pengguna } = useAuth();
  return pengguna ? <MapsScreen key={`${pengguna.uid}:${pengguna.role}`} actor={pengguna} /> : null;
}
