import { AppButton } from '@/components/ui/AppButton';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { LabActivity, ScheduledActivity } from '@/services/maps/labActivity';
import type { LabClass } from '@/services/maps/labActivityService';
import type { Laboratory } from '@/types/laboratory';
import { LABEL_STATUS } from '@/types/models';
import { StyleSheet, Text, View } from 'react-native';
import { MapSheet } from './MapSheet';

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short', day: 'numeric', month: 'short',
});
const timeFormat = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function ActivityDetails({ activity, labClass }: { activity: ScheduledActivity; labClass?: LabClass }) {
  return (
    <>
      <Text style={styles.title}>{labClass?.course ?? activity.topic ?? 'Praktikum'}</Text>
      <Text style={styles.text}>{labClass?.name ?? activity.classId}</Text>
      {labClass?.course && activity.topic ? <Text style={styles.text}>{activity.topic}</Text> : null}
      <Text style={styles.text}>
        {dateFormat.format(activity.start)} · {timeFormat.format(activity.start)}–{timeFormat.format(activity.end)}
      </Text>
    </>
  );
}

export function LabActivitySheet({
  lab, activity, classes, simulated, loading, error, cached, viewerRole, onRetry, onClose, onAttendance,
}: {
  lab: Laboratory;
  activity?: LabActivity;
  classes: ReadonlyMap<string, LabClass>;
  simulated: boolean;
  loading: boolean;
  error?: string;
  cached?: boolean;
  viewerRole?: string;
  onRetry: () => void;
  onClose: () => void;
  onAttendance?: () => void;
}) {
  const ongoing = activity?.ongoing;
  const lastCompleted = activity?.lastCompleted;
  return (
    <MapSheet title={lab.nama} onClose={onClose}>
      <View style={styles.details}>
        <Text style={styles.title}>{lab.kode}</Text>
        {lab.gedung ? <Text style={styles.text}>{lab.gedung}</Text> : null}
        <Text style={styles.text}>
          {lab.kapasitas > 0 ? `Kapasitas ${lab.kapasitas} orang · ` : ''}Radius {lab.radiusMeters} m
        </Text>
      </View>
      {simulated ? <InfoBanner tone="warning" message="Laboratorium simulasi"
        description="Data ini hanya untuk pengembangan peta. Aktivitas praktikum tidak ditautkan ke lab simulasi." /> : (
        <>
          {error ? (
            <View style={styles.details}>
              <InfoBanner tone="warning" message={error} />
              <AppButton label="Muat ulang aktivitas" variant="secondary" onPress={onRetry} />
            </View>
          ) : cached ? <InfoBanner tone="neutral" message="Menunggu konfirmasi Firestore. Data aktivitas mungkin belum tersedia atau belum terbaru." /> : null}
          <Text style={styles.section}>Praktikum berlangsung</Text>
          {ongoing ? (
            <View style={[styles.details, styles.ongoing]}>
              <Text style={styles.ongoingLabel}>Sedang berlangsung · {LABEL_STATUS[ongoing.status]}</Text>
              <ActivityDetails activity={ongoing} labClass={classes.get(ongoing.classId)} />
              {ongoing.assistant ? <Text style={styles.text}>Asisten {ongoing.assistant}</Text> : null}
              {onAttendance ? <AppButton label="Masuk halaman presensi" onPress={onAttendance} /> : null}
            </View>
          ) : (
            <Text style={styles.text}>
              {loading ? 'Memuat aktivitas…' : error ? 'Data aktivitas belum tersedia.' : 'Tidak ada praktikum aktif saat ini.'}
            </Text>
          )}
          {!ongoing && lastCompleted ? (
            <View style={[styles.details, styles.upcoming]}>
              <Text style={styles.title}>Selesai</Text>
              <ActivityDetails activity={lastCompleted} labClass={classes.get(lastCompleted.classId)} />
              {lastCompleted.assistant ? <Text style={styles.text}>Asisten {lastCompleted.assistant}</Text> : null}
            </View>
          ) : null}
          <Text style={styles.section}>Jadwal berikutnya</Text>
          {activity?.upcoming.length ? activity.upcoming.map((item) => (
            <View key={`${item.id}:${item.start}`} style={[styles.details, styles.upcoming]}>
              <ActivityDetails activity={item} labClass={classes.get(item.classId)} />
            </View>
          )) : (
            <Text style={styles.text}>
              {loading
                ? 'Memuat jadwal…'
                : error
                  ? 'Data jadwal belum tersedia.'
                  : viewerRole === 'praktikan'
                    ? 'Tidak ada jadwal praktikum Anda di lab ini.'
                    : 'Tidak ada jadwal lagi hari ini atau besok.'}
            </Text>
          )}
        </>
      )}
    </MapSheet>
  );
}

const styles = StyleSheet.create({
  details: { gap: Spacing.xs },
  section: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  title: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  text: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  ongoing: { backgroundColor: Colors.successSoft, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  ongoingLabel: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '700' },
  upcoming: { borderLeftColor: Colors.border, borderLeftWidth: 2, paddingLeft: Spacing.md },
});
