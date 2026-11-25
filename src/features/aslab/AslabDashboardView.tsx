import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
} from '@/constants/theme';
import type { ProfilPengguna } from '@/services/authService';
import {
  getDateRange,
  type DashboardMetrics,
  type PeriodFilter,
} from '@/services/aslab/dashboardService';

export interface AslabDashboardViewProps {
  actor: ProfilPengguna;
  metrics: DashboardMetrics;
  period: PeriodFilter;
  onChangePeriod: (period: PeriodFilter) => void;
  referenceDate?: Date;
}

export function AslabDashboardView({
  actor,
  metrics,
  period,
  onChangePeriod,
  referenceDate = new Date(),
}: AslabDashboardViewProps) {
  const [subTab, setSubTab] = useState<'kegiatan' | 'keuangan'>('kegiatan');
  const dateRange = getDateRange(period, referenceDate);

  const percentCollected = Math.round(metrics.paymentRatio * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Profile & Period Filter */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {actor.nama ? actor.nama.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{actor.nama}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Aslab · Dashboard Pemantauan</Text>
            </View>
          </View>
        </View>

        {/* Period Filter Chips */}
        <View style={styles.filterRow}>
          <FilterChip
            label="Hari Ini"
            active={period === 'hari'}
            onPress={() => onChangePeriod('hari')}
          />
          <FilterChip
            label="Minggu Ini"
            active={period === 'minggu'}
            onPress={() => onChangePeriod('minggu')}
          />
          <FilterChip
            label="Bulan Ini"
            active={period === 'bulan'}
            onPress={() => onChangePeriod('bulan')}
          />
        </View>
        <Text style={styles.rangeLabel}>{dateRange.label}</Text>
      </View>

      {/* 2. Grid StatTiles (2 Kolom) */}
      <View style={styles.statsGrid}>
        <AppCard variant="glass" style={styles.statTile}>
          <View style={styles.statIconBox}>
            <AppIcon name="layers" size={18} color={Colors.accentBlue} />
          </View>
          <Text style={styles.statValue}>{metrics.totalLabs}</Text>
          <Text style={styles.statLabel}>Laboratorium Aktif</Text>
        </AppCard>

        <AppCard variant="glass" style={styles.statTile}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.successSoft }]}>
            <AppIcon name="users" size={18} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{metrics.totalPraktikan}</Text>
          <Text style={styles.statLabel}>Praktikan Terdaftar</Text>
        </AppCard>

        <AppCard variant="glass" style={styles.statTile}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.warningSoft }]}>
            <AppIcon name="clock" size={18} color={Colors.warning} />
          </View>
          <Text style={styles.statValue}>
            {metrics.ongoingSessions.length} Berlangsung
          </Text>
          <Text style={styles.statLabel}>
            {metrics.upcomingSessions.length} Jadwal Mendatang
          </Text>
        </AppCard>

        <AppCard variant="glass" style={styles.statTile}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.primarySoft }]}>
            <AppIcon name="check-circle" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.statValue}>{metrics.completedSessions.length}</Text>
          <Text style={styles.statLabel}>Sesi Selesai ({period})</Text>
        </AppCard>
      </View>

      {/* 3. Ringkasan Kas & Denda (Glass Card) */}
      <AppCard variant="glass" style={styles.financialCard}>
        <View style={styles.financialHeader}>
          <View style={styles.financialTitleRow}>
            <AppIcon name="credit-card" size={18} color={Colors.primary} />
            <Text style={styles.financialTitle}>Arus Kas Denda Praktikum</Text>
          </View>
          <Text style={styles.ratioText}>{percentCollected}% Lunas</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, percentCollected))}%` },
            ]}
          />
        </View>

        <View style={styles.financialAmountsRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Total Lunas</Text>
            <Text style={[styles.amountValue, { color: Colors.success }]}>
              Rp{metrics.fineTotalPaid.toLocaleString('id-ID')}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Tertunggak / Belum Lunas</Text>
            <Text style={[styles.amountValue, { color: Colors.warning }]}>
              Rp{metrics.fineTotalUnpaid.toLocaleString('id-ID')}
            </Text>
          </View>
          {metrics.fineTotalWaived > 0 ? (
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>Dibebaskan (Izin)</Text>
              <Text style={[styles.amountValue, { color: Colors.textMuted }]}>
                Rp{metrics.fineTotalWaived.toLocaleString('id-ID')}
              </Text>
            </View>
          ) : null}
        </View>
      </AppCard>

      {/* 4. Status Tiap Laboratorium */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Operasional Tiap Lab</Text>
        <View style={styles.labStatusList}>
          {metrics.labStatuses.map(({ lab, statusText, statusTone, totalPraktikan, totalAsprak }) => {
            const isOngoing = statusTone === 'success';
            const isScheduled = statusTone === 'warning';

            return (
              <AppCard key={lab.id} variant="glass" style={styles.labStatusCard}>
                <View style={styles.labStatusHeader}>
                  <View style={styles.labNameCol}>
                    <Text style={styles.labStatusName}>{lab.nama}</Text>
                    <Text style={styles.labStatusGedung}>{lab.gedung} · {lab.kode}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isOngoing && styles.statusPillSuccess,
                      isScheduled && styles.statusPillWarning,
                      !isOngoing && !isScheduled && styles.statusPillNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isOngoing && styles.statusTextSuccess,
                        isScheduled && styles.statusTextWarning,
                        !isOngoing && !isScheduled && styles.statusTextNeutral,
                      ]}
                    >
                      {statusText}
                    </Text>
                  </View>
                </View>

                <View style={styles.labStatusDetails}>
                  <Text style={styles.labDetailText}>
                    👥 {totalPraktikan} praktikan · 🧑‍🏫 {totalAsprak} asprak · Radius {lab.radiusMeters}m
                  </Text>
                  <Text style={styles.labDetailText}>
                    ⏱️ Toleransi {lab.gracePeriodMinutes ?? 15} mnt · Denda Rp{(lab.lateFineAmount ?? 10000).toLocaleString('id-ID')}
                  </Text>
                </View>
              </AppCard>
            );
          })}
        </View>
      </View>

      {/* 5. Sub-Tab: Riwayat Sesi vs Riwayat Keuangan */}
      <View style={styles.section}>
        <View style={styles.subTabRow}>
          <FilterChip
            label="Riwayat Kegiatan Lab"
            active={subTab === 'kegiatan'}
            onPress={() => setSubTab('kegiatan')}
          />
          <FilterChip
            label="Riwayat Keuangan Denda"
            active={subTab === 'keuangan'}
            onPress={() => setSubTab('keuangan')}
          />
        </View>

        {subTab === 'kegiatan' ? (
          metrics.completedSessions.length === 0 ? (
            <InfoBanner tone="neutral" message="Belum ada sesi selesai pada periode ini." />
          ) : (
            <View style={styles.historyList}>
              {metrics.completedSessions.map((session) => (
                <AppCard key={session.id} variant="glass" style={styles.historyItemCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTopik}>{session.topik}</Text>
                    <Text style={styles.historyDate}>{session.tanggal}</Text>
                  </View>
                  <Text style={styles.historySub}>
                    {session.ruang} · {session.jamMulai} - {session.jamSelesai} WIB
                  </Text>
                </AppCard>
              ))}
            </View>
          )
        ) : (
          metrics.finesList.length === 0 ? (
            <InfoBanner tone="neutral" message="Belum ada catatan tagihan denda pada periode ini." />
          ) : (
            <View style={styles.historyList}>
              {metrics.finesList.map((fine) => {
                const isPaid = fine.status === 'paid';
                const isWaived = fine.status === 'waived';
                const isPending = fine.status === 'pending_payment';

                return (
                  <AppCard key={fine.id} variant="glass" style={styles.historyItemCard}>
                    <View style={styles.historyHeader}>
                      <View style={styles.fineStudentInfo}>
                        <Text style={styles.fineStudentName}>{fine.praktikanNama}</Text>
                        <Text style={styles.fineTopik}>
                          {fine.labNama} · {fine.sessionTopik}
                        </Text>
                      </View>
                      <View style={styles.fineRightCol}>
                        <Text style={styles.fineAmount}>
                          Rp{fine.amount.toLocaleString('id-ID')}
                        </Text>
                        <View
                          style={[
                            styles.fineStatusBadge,
                            isPaid && styles.fineStatusPaid,
                            isPending && styles.fineStatusPending,
                            isWaived && styles.fineStatusWaived,
                            !isPaid && !isPending && !isWaived && styles.fineStatusUnpaid,
                          ]}
                        >
                          <Text
                            style={[
                              styles.fineStatusText,
                              isPaid && styles.fineStatusTextPaid,
                              isPending && styles.fineStatusTextPending,
                              isWaived && styles.fineStatusTextWaived,
                              !isPaid && !isPending && !isWaived && styles.fineStatusTextUnpaid,
                            ]}
                          >
                            {isPaid
                              ? 'Lunas'
                              : isPending
                                ? 'Menunggu'
                                : isWaived
                                  ? 'Dibebaskan'
                                  : 'Belum Lunas'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.fineDetailDate}>
                      Terlambat {fine.lateMinutes} mnt · {fine.sessionTanggal}
                    </Text>
                  </AppCard>
                );
              })}
            </View>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  roleBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  rangeLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statTile: {
    width: '48%',
    padding: Spacing.md,
    gap: 4,
    borderRadius: Radius.md,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(123, 184, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  financialCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
    borderRadius: Radius.lg,
  },
  financialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  financialTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  ratioText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentPink,
  },
  financialAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  amountCol: {
    gap: 2,
  },
  amountLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  amountValue: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  labStatusList: {
    gap: Spacing.sm,
  },
  labStatusCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs + 2,
  },
  labStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labNameCol: {
    flex: 1,
  },
  labStatusName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  labStatusGedung: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusPillSuccess: {
    backgroundColor: Colors.successSoft,
  },
  statusPillWarning: {
    backgroundColor: Colors.warningSoft,
  },
  statusPillNeutral: {
    backgroundColor: Colors.neutralSoft,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
  },
  statusTextSuccess: {
    color: Colors.success,
  },
  statusTextWarning: {
    color: Colors.warning,
  },
  statusTextNeutral: {
    color: Colors.textMuted,
  },
  labStatusDetails: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  labDetailText: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  historyList: {
    gap: Spacing.xs + 2,
  },
  historyItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyTopik: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
    flex: 1,
  },
  historyDate: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  historySub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  fineStudentInfo: {
    flex: 1,
  },
  fineStudentName: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  fineTopik: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  fineRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fineAmount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  fineStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  fineStatusPaid: {
    backgroundColor: Colors.successSoft,
  },
  fineStatusPending: {
    backgroundColor: Colors.warningSoft,
  },
  fineStatusWaived: {
    backgroundColor: Colors.neutralSoft,
  },
  fineStatusUnpaid: {
    backgroundColor: Colors.dangerSoft,
  },
  fineStatusText: {
    fontSize: 9,
    fontFamily: FontFamily.semibold,
  },
  fineStatusTextPaid: {
    color: Colors.success,
  },
  fineStatusTextPending: {
    color: Colors.warning,
  },
  fineStatusTextWaived: {
    color: Colors.textMuted,
  },
  fineStatusTextUnpaid: {
    color: Colors.danger,
  },
  fineDetailDate: {
    fontSize: 9,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
