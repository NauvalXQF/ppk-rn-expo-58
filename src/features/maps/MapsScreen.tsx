import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useIsFocused, useSitemap, type Href, type SitemapType } from 'expo-router';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import type { ProfilPengguna } from '@/services/authService';
import { activeLaboratories, selectLaboratories } from '@/services/maps/laboratories';
import { LabActivitySheet } from './LabActivitySheet';
import { LabManagementModal } from './LabManagementModal';
import LaboratoryMap from './LaboratoryMap';
import { MapAttribution } from './MapFrame';
import type { LaboratoryMapHandle } from './mapTypes';
import { simulatedLaboratories } from './simulatedLaboratories';
import { useLaboratoryData, useMapsActivity } from './useMapsData';
import { useUserLocation } from './useUserLocation';

const ATTENDANCE_PATH = '/presensi/[sesiId]';
const EMPTY_LABORATORIES: readonly never[] = [];
const EMPTY_LAB_IDS: ReadonlySet<string> = new Set();

function hasAttendanceRoute(route: SitemapType | null): boolean {
  return Boolean(route && (route.href === ATTENDANCE_PATH || route.children.some(hasAttendanceRoute)));
}

export function MapsScreen({ actor }: { actor: ProfilPengguna }) {
  const focused = useIsFocused();
  const sitemap = useSitemap();
  const isAssistant = actor.role === 'asisten' || actor.role === 'asprak' || actor.role === 'aslab';
  const canManageLab = actor.role === 'aslab' || actor.role === 'asisten';
  const laboratories = useLaboratoryData(focused);
  const activity = useMapsActivity(actor.uid, isAssistant, focused);
  const { state: location, retry: retryLocation } = useUserLocation(focused);
  const point = focused && location.status === 'located' ? location.point : undefined;
  const [selectedId, setSelectedId] = useState<string>();
  const [managementVisible, setManagementVisible] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const map = useRef<LaboratoryMapHandle>(null);

  const remoteLabs = laboratories.snapshot?.laboratories ?? EMPTY_LABORATORIES;
  const shouldOfferSimulation = __DEV__ &&
    Boolean(laboratories.error || laboratories.snapshot?.fromCache === false);
  const available = selectLaboratories(
    laboratories.snapshot?.documentCount ?? 0,
    remoteLabs,
    shouldOfferSimulation ? simulatedLaboratories : EMPTY_LABORATORIES,
  );
  const simulated = available === simulatedLaboratories;
  const active = useMemo(() => activeLaboratories(available), [available]);
  const activeSessionLabIds = useMemo(() => new Set(
    [...activity.activities].filter(([, item]) => item.ongoing).map(([id]) => id),
  ), [activity.activities]);
  const selectedLab = active.find((lab) => lab.id === selectedId);
  if (selectedId !== undefined && !selectedLab) setSelectedId(undefined);
  const selectedActivity = selectedLab && !simulated ? activity.activities.get(selectedLab.id) : undefined;
  const ongoing = selectedActivity?.ongoing;
  // The activity listener for a praktikan only receives their active classes.
  const attendance = !isAssistant && !activity.cached &&
    ongoing?.status === 'dibuka' && hasAttendanceRoute(sitemap)
    ? ongoing : undefined;

  const selectLab = useCallback((id: string) => {
    if (focused && !managementVisible && active.some((lab) => lab.id === id)) setSelectedId(id);
  }, [active, focused, managementVisible]);

  function openSettings() {
    setSettingsError(false);
    void Linking.openSettings().catch(() => setSettingsError(true));
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.canvas}>
        <MapAttribution />
        <View style={styles.controls}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Peta laboratorium</Text>
            <Text style={styles.detail}>
              {simulated ? 'Data simulasi pengembangan' : `${active.length} laboratorium aktif`}
            </Text>
          </View>
          {laboratories.error ? (
            <View style={styles.notice}>
              <InfoBanner tone="warning" message={laboratories.error} />
              <AppButton label="Muat ulang data lab" onPress={laboratories.retry} variant="secondary" />
            </View>
          ) : !laboratories.snapshot ? (
            <View style={[styles.heading, styles.locationNotice]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.detail}>Memuat laboratorium…</Text>
            </View>
          ) : laboratories.snapshot.documentCount > remoteLabs.length ? (
            <InfoBanner tone="warning" message="Beberapa data lab tidak sesuai kontrak dan tidak ditampilkan." />
          ) : laboratories.snapshot.fromCache ? (
            <InfoBanner tone="neutral" message="Menunggu Firestore. Data lokal mungkin belum terbaru." />
          ) : null}
        </View>
        <LaboratoryMap
          ref={map}
          laboratories={active}
          activeLabIds={simulated ? EMPTY_LAB_IDS : activeSessionLabIds}
          selectedLabId={selectedLab?.id}
          userLocation={point}
          isAssistant={isAssistant}
          focused={focused}
          onSelect={selectLab}
        />
        <View style={[styles.controls, styles.bottomControls]}>
            <View style={styles.notice}>
              {location.status === 'denied' ? (
                <>
                  <InfoBanner tone="warning" message={Platform.OS === 'web'
                    ? 'Izin lokasi ditolak. Izinkan lokasi di pengaturan situs browser, lalu coba lagi.'
                    : 'Izin lokasi ditolak. Izinkan akses untuk menampilkan posisi kamu.'} />
                  <AppButton label={location.canAskAgain ? 'Izinkan lokasi' : 'Buka pengaturan aplikasi'}
                    variant="secondary" onPress={location.canAskAgain ? retryLocation : openSettings} />
                  {settingsError ? <InfoBanner tone="warning" message="Buka pengaturan ponsel dan izinkan lokasi untuk aplikasi ini." /> : null}
                </>
              ) : location.status === 'gps-off' ? (
                <>
                  <InfoBanner tone="warning" message="GPS nonaktif. Nyalakan lokasi di pengaturan cepat perangkat." />
                  <AppButton label="Cek kembali GPS" variant="secondary" onPress={retryLocation} />
                </>
              ) : location.status === 'unavailable' ? (
                <>
                  <InfoBanner tone="warning" message="Lokasi belum tersedia. Coba dari area dengan sinyal lebih baik." />
                  <AppButton label="Segarkan lokasi" variant="secondary" onPress={retryLocation} />
                </>
              ) : location.status === 'unsupported' ? (
                <InfoBanner tone="neutral" message="Lokasi browser hanya tersedia pada situs aman dengan dukungan geolokasi." />
              ) : location.status === 'searching' ? (
                <View style={[styles.heading, styles.locationNotice]}>
                  <ActivityIndicator size="small" color={Colors.warning} />
                  <Text style={styles.detail}>Mencari lokasi…</Text>
                </View>
              ) : point && (point.accuracy == null || point.accuracy > 50) ? (
                <>
                  <View style={[styles.heading, styles.locationNotice]}>
                    <ActivityIndicator size="small" color={Colors.warning} />
                    <Text style={styles.detail}>Sinyal GPS lemah. Mencari posisi yang lebih akurat…</Text>
                  </View>
                  <AppButton label="Segarkan lokasi" variant="secondary" onPress={retryLocation} />
                </>
              ) : null}
            </View>
          <View style={styles.actions}>
            {canManageLab ? (
              <AppButton label="Kelola lab" variant="secondary"
                onPress={() => { setSelectedId(undefined); setManagementVisible(true); }} />
            ) : null}
            {point ? <AppButton label="Pusatkan ke saya" onPress={() => map.current?.recenter(point)} /> : null}
          </View>
        </View>
      </View>
      {selectedLab && !managementVisible ? (
        <LabActivitySheet
          lab={selectedLab}
          activity={selectedActivity}
          classes={activity.classes}
          simulated={simulated}
          loading={activity.loading}
          error={activity.error}
          cached={activity.cached}
          onRetry={activity.retry}
          onClose={() => setSelectedId(undefined)}
          onAttendance={attendance ? () => {
            setSelectedId(undefined);
            const href = `/presensi/${encodeURIComponent(attendance.id)}`;
            router.push(href as Href);
          } : undefined}
        />
      ) : null}
      {canManageLab ? (
        <LabManagementModal
          visible={managementVisible}
          actor={actor}
          laboratories={remoteLabs}
          location={point}
          writable={focused && laboratories.snapshot?.fromCache === false}
          onClose={() => setManagementVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  canvas: { flex: 1 },
  controls: { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bottomControls: { paddingBottom: 92 },
  heading: {
    alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: Colors.glassStrong,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderColor: Colors.glassBorder, borderWidth: 1, ...Shadow.card,
  },
  title: { fontSize: FontSize.lg, fontFamily: FontFamily.medium, color: Colors.text },
  detail: { fontSize: FontSize.xs, fontFamily: FontFamily.regular, color: Colors.textMuted, flexShrink: 1 },
  notice: { gap: Spacing.xs },
  locationNotice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: Spacing.sm },
});
