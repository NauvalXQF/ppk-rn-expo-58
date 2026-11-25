import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/ui/AppIcon';
import { useApp } from '@/store/app-context';
import {
  getPraktikanClassIds,
  selectJadwalUntukPengguna,
  selectRekapSesi,
  selectSesiUntukPengguna,
} from '@/store/selectors';
import { isStaffUser } from '@/types/models';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
} from '@/constants/theme';
import { formatJam, formatTanggal, formatWaktuPresensi } from '@/utils/date';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SessionCard } from '@/components/domain/SessionCard';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { PracticumCrudSection } from '@/features/practicum/PracticumCrudSection';

export function JadwalScreen() {
  const router = useRouter();
  const { state, loading, error } = useApp();
  const user = state.currentUser;
  const isAsisten = isStaffUser(user);

  const [filterKey, setFilterKey] = useState<string>('semua');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const jadwalList = selectJadwalUntukPengguna(state);
  const sesiList = selectSesiUntukPengguna(state);

  const filterOptions = useMemo(() => {
    if (isAsisten) {
      const kelasChips = state.kelas.map((k) => ({
        key: `kelas:${k.id}`,
        label: k.nama,
      }));
      return [
        { key: 'semua', label: 'Semua' },
        ...kelasChips,
        { key: 'status:dibuka', label: 'Dibuka' },
      ];
    }
    return [
      { key: 'semua', label: 'Semua' },
      { key: 'status:dibuka', label: 'Dibuka' },
      { key: 'status:dijadwalkan', label: 'Dijadwalkan' },
      { key: 'status:ditutup', label: 'Ditutup' },
    ];
  }, [isAsisten, state.kelas]);

  const filteredSesi = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sesiList.filter((sesi) => {
      if (filterKey.startsWith('status:')) {
        const statusTarget = filterKey.replace('status:', '');
        if (sesi.status !== statusTarget) return false;
      } else if (filterKey.startsWith('kelas:')) {
        const kelasTarget = filterKey.replace('kelas:', '');
        if (sesi.kelasId !== kelasTarget) return false;
      }

      if (!q) return true;
      const kelasNama =
        state.kelas.find((k) => k.id === sesi.kelasId)?.nama ?? '';
      return (
        sesi.topik.toLowerCase().includes(q) ||
        sesi.ruang.toLowerCase().includes(q) ||
        kelasNama.toLowerCase().includes(q)
      );
    });
  }, [filterKey, searchQuery, sesiList, state.kelas]);

  return (
    <ScreenContainer variant="gradient">
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>
          {isAsisten ? 'Jadwal Asisten' : 'Jadwal'}
        </Text>
        <View style={styles.headerActions}>
          <NotificationBell />
          <IconButton
            accessibilityLabel="Cari jadwal sesi"
            onPress={() => {
              setSearchOpen((prev) => !prev);
              if (searchOpen) setSearchQuery('');
            }}
          >
            <AppIcon
              name={searchOpen ? 'x' : 'search'}
              size={19}
              color={Colors.text}
            />
          </IconButton>
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchBox}>
          <AppIcon name="search" size={16} color={Colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari topik, kelas, atau ruang lab..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoFocus
          />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filterOptions.map((opt) => (
          <FilterChip
            key={opt.key}
            label={opt.label}
            active={filterKey === opt.key}
            onPress={() => setFilterKey(opt.key)}
          />
        ))}
      </ScrollView>

      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Memproses sinkronisasi data...</Text>
        </View>
      ) : null}

      {isAsisten ? <PracticumCrudSection /> : null}

      {filteredSesi.length === 0 ? (
        <EmptyState
          title="Belum ada jadwal"
          description={
            user?.peran === 'praktikan'
              ? getPraktikanClassIds(user).length === 0
                ? 'Akun Anda belum terdaftar di kelas praktikum mana pun. Tambahkan akun ini lewat menu Peserta pada akun Asisten.'
                : 'Tidak ada jadwal/sesi praktikum yang sesuai filter saat ini.'
              : 'Belum ada sesi praktikum yang terdaftar.'
          }
        />
      ) : (
        <View style={styles.list}>
          {filteredSesi.map((sesi, index) => {
            const praktikum = state.praktikum.find(
              (p) => p.id === sesi.praktikumId,
            );
            const kelas = state.kelas.find((k) => k.id === sesi.kelasId);

            let metaText = '';
            let metaTone: 'default' | 'success' | 'warning' | 'danger' =
              'default';

            if (isAsisten) {
              const rekap = selectRekapSesi(state, sesi.id);
              metaText = `${rekap.jumlahHadir}/${rekap.totalPraktikan} hadir`;
              metaTone = 'default';
            } else if (user?.peran === 'praktikan') {
              const presensi = state.presensi.find(
                (p) => p.sesiId === sesi.id && p.praktikanId === user.id,
              );

              if (presensi) {
                metaText = `Hadir ${formatWaktuPresensi(presensi.waktuPresensi)}`;
                metaTone = 'success';
              } else if (sesi.status === 'dibuka') {
                metaText = `${sesi.ruang} · ${formatJam(sesi.jamMulai)}`;
                metaTone = 'warning';
              } else {
                metaText = `${sesi.ruang} · ${formatJam(sesi.jamMulai)}`;
                metaTone = 'default';
              }
            }

            const formattedTanggal = formatTanggal(sesi.tanggal);
            const formattedWaktu = `${formatJam(sesi.jamMulai)}–${formatJam(sesi.jamSelesai)}`;

            return (
              <SessionCard
                key={sesi.id}
                index={index}
                praktikum={praktikum?.nama ?? 'Praktikum'}
                kelas={kelas?.nama ?? sesi.kelasId}
                topik={sesi.topik}
                tanggal={formattedTanggal}
                waktu={formattedWaktu}
                ruang={sesi.ruang}
                status={sesi.status}
                meta={metaText}
                metaTone={metaTone}
                onPress={() => router.push(`/sesi/${sesi.id}`)}
              />
            );
          })}
        </View>
      )}

      {jadwalList.length > 0 ? (
        <View style={styles.scheduleSection}>
          <SectionHeader
            title="Jadwal Reguler"
            rightText={`${jadwalList.length} jadwal`}
          />
          <View style={styles.scheduleList}>
            {jadwalList.map((j) => {
              const kelas = state.kelas.find((k) => k.id === j.kelasId);
              return (
                <AppCard
                  key={j.id}
                  variant="solid"
                  style={styles.scheduleCard}
                >
                  <Text style={styles.scheduleTitle}>
                    Jadwal Reguler · {kelas?.nama ?? j.kelasId}
                  </Text>
                  <Text style={styles.scheduleMeta}>
                    {j.hari}, {formatJam(j.jamMulai)}–{formatJam(j.jamSelesai)}{' '}
                    WIB · {j.ruang} · {j.topik}
                  </Text>
                </AppCard>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  list: {
    gap: 12,
  },
  scheduleSection: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  scheduleList: {
    gap: Spacing.sm,
  },
  scheduleCard: {
    borderRadius: Radius.md,
    gap: 2,
    paddingVertical: 14,
  },
  scheduleTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  scheduleMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
