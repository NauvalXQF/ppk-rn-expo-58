import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { FilterChip } from '@/components/ui/FilterChip';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { NotificationBell } from '@/features/notifications/NotificationBell';
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
  actor?: ProfilPengguna;
  metrics: DashboardMetrics;
  period: PeriodFilter;
  onChangePeriod: (period: PeriodFilter) => void;
  referenceDate?: Date;
}

interface KpiCardProps {
  icon: AppIconName;
  label: string;
  value: number | string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
}

function KpiCard({
  icon,
  label,
  value,
  badgeText,
  badgeBg,
  badgeColor,
}: KpiCardProps) {
  return (
    <AppCard variant="glass" style={styles.statTile}>
      <View style={styles.kpiTopRow}>
        <AppIcon name={icon} size={17} color={Colors.text} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.kpiBottomRow}>
        <Text style={styles.statValue}>{value}</Text>
        <View style={[styles.kpiBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.kpiBadgeText, { color: badgeColor }]} numberOfLines={1}>
            {badgeText}
          </Text>
        </View>
      </View>
    </AppCard>
  );
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
  const totalBilledAndWaived =
    metrics.fineTotalPaid + metrics.fineTotalUnpaid + metrics.fineTotalWaived;
  const hasFines = metrics.fineTotalPaid + metrics.fineTotalUnpaid > 0;
  const barColor = !hasFines
    ? Colors.textMuted
    : percentCollected >= 80
      ? Colors.success
      : percentCollected >= 40
        ? Colors.warning
        : Colors.danger;
  const barBadgeBg = !hasFines
    ? Colors.neutralSoft
    : percentCollected >= 80
      ? Colors.successSoft
      : percentCollected >= 40
        ? Colors.warningSoft
        : Colors.dangerSoft;

  const paidFlex = totalBilledAndWaived > 0 ? metrics.fineTotalPaid : 0;
  const unpaidFlex = totalBilledAndWaived > 0 ? metrics.fineTotalUnpaid : 0;
  const waivedFlex = totalBilledAndWaived > 0 ? metrics.fineTotalWaived : 0;

  // Mini bar chart values
  const chartBars = [
    { label: 'Aktif', count: metrics.ongoingSessions.length, color: Colors.success },
    { label: 'Jadwal', count: metrics.upcomingSessions.length, color: Colors.accentBlue },
    { label: 'Selesai', count: metrics.completedSessions.length, color: Colors.primary },
    { label: 'Denda', count: metrics.finesList.length, color: Colors.danger },
  ];
  const maxBarCount = Math.max(1, ...chartBars.map((b) => b.count));

  return (
    <View style={styles.content}>
      {/* 0. Profile Header + Role Pill + NotificationBell */}
      {actor ? (
        <View style={styles.profileHeader}>
          <View style={styles.profileLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {actor.nama ? actor.nama.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
            <View style={styles.profileTextCol}>
              <Text style={styles.profileName} numberOfLines={1}>
                {actor.nama}
              </Text>
              <Text style={styles.profileSub} numberOfLines={1}>
                Aslab · Asisten Laboratorium
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>Aslab</Text>
            </View>
            <NotificationBell />
          </View>
        </View>
      ) : null}

      {/* 1. Header Title & Period Filter */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Dashboard</Text>
          <Text style={styles.rangeLabel}>{dateRange.label}</Text>
        </View>

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
          <FilterChip
            label="Semua"
            active={period === 'semua'}
            onPress={() => onChangePeriod('semua')}
          />
        </View>
      </View>

      {/* 2. KPI 2x2 Grid (Orbix Style) */}
      <View style={styles.statsGrid}>
        <KpiCard
          icon="layers"
          label="Laboratorium"
          value={metrics.totalLabs}
          badgeText="Aktif"
          badgeBg={Colors.neutralSoft}
          badgeColor={Colors.textMuted}
        />
        <KpiCard
          icon="users"
          label="Praktikan"
          value={metrics.totalPraktikan}
          badgeText="Terdaftar"
          badgeBg={Colors.successSoft}
          badgeColor={Colors.success}
        />
        <KpiCard
          icon="clock"
          label="Berlangsung"
          value={metrics.ongoingSessions.length}
          badgeText={`${metrics.upcomingSessions.length} Jadwal`}
          badgeBg={Colors.warningSoft}
          badgeColor={Colors.warning}
        />
        <KpiCard
          icon="check-circle"
          label="Sesi Selesai"
          value={metrics.completedSessions.length}
          badgeText={period === 'semua' ? 'Semua' : period}
          badgeBg={Colors.primarySoft}
          badgeColor={Colors.primary}
        />
      </View>

      {/* 3. Arus Kas Denda Praktikum (Segmented Bar) */}
      <AppCard variant="glass" style={styles.financialCard}>
        <View style={styles.financialHeader}>
          <View style={styles.financialTitleRow}>
            <AppIcon name="credit-card" size={17} color={Colors.text} />
            <Text style={styles.financialTitle}>Arus Kas Denda Praktikum</Text>
          </View>
          <View style={[styles.ratioPill, { backgroundColor: barBadgeBg }]}>
            <Text style={[styles.ratioText, { color: barColor }]}>
              {hasFines ? `${percentCollected}% Lunas` : 'Belum Ada Tagihan'}
            </Text>
          </View>
        </View>

        {/* Segmented Proportion Bar */}
        <View style={styles.progressBarTrack}>
          {totalBilledAndWaived > 0 ? (
            <>
              {paidFlex > 0 ? (
                <View style={{ flex: paidFlex, height: '100%', backgroundColor: barColor }} />
              ) : null}
              {unpaidFlex > 0 ? (
                <View style={{ flex: unpaidFlex, height: '100%', backgroundColor: Colors.danger }} />
              ) : null}
              {waivedFlex > 0 ? (
                <View style={{ flex: waivedFlex, height: '100%', backgroundColor: Colors.textMuted }} />
              ) : null}
            </>
          ) : (
            <View style={{ width: '0%', height: '100%' }} />
          )}
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
            <Text style={[styles.amountValue, { color: Colors.danger }]}>
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

      {/* 4. Ringkasan Aktivitas (Mini Bar Chart - Orbix Analytics Style) */}
      <AppCard variant="glass" style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Ringkasan Aktivitas</Text>
          <Text style={styles.chartSub}>{dateRange.label}</Text>
        </View>
        <View style={styles.barsRow}>
          {chartBars.map((item) => {
            const barHeight = item.count > 0 ? Math.max(12, Math.round((item.count / maxBarCount) * 56)) : 6;
            return (
              <View key={item.label} style={styles.barCol}>
                <Text style={styles.barCount}>{item.count}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: barHeight,
                        backgroundColor: item.count > 0 ? item.color : Colors.border,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </AppCard>

      {/* 5. Status Operasional Tiap Lab */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Operasional Tiap Lab</Text>
        <View style={styles.labStatusList}>
          {metrics.labStatuses.map(({ lab, statusText, statusTone, totalPraktikan, totalAsprak }) => {
            const isOngoing = statusTone === 'success';
            const isScheduled = statusTone === 'warning';

            return (
              <AppCard key={lab.id} variant="glass" style={styles.labStatusCard}>
                <View style={styles.labStatusHeader}>
                  <View style={styles.labTitleGroup}>
                    <View style={styles.labIconBox}>
                      <AppIcon name="layers" size={16} color={Colors.text} />
                    </View>
                    <View style={styles.labNameCol}>
                      <Text style={styles.labStatusName}>{lab.nama}</Text>
                      <Text style={styles.labStatusGedung}>
                        {lab.gedung || 'Lokasi belum diatur'}
                      </Text>
                    </View>
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
                  <View style={styles.labDetailRow}>
                    <Text style={styles.labDetailKey}>Anggota Lab</Text>
                    <Text style={styles.labDetailVal}>
                      {totalPraktikan} Praktikan · {totalAsprak} Asprak
                    </Text>
                  </View>
                  <View style={styles.labDetailRow}>
                    <Text style={styles.labDetailKey}>Aturan & Denda</Text>
                    <Text style={styles.labDetailVal}>
                      Radius {lab.radiusMeters}m · {lab.gracePeriodMinutes ?? 15} mnt · Rp
                      {(lab.lateFineAmount ?? 10000).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              </AppCard>
            );
          })}
        </View>
      </View>

      {/* 6. Sub-Tab: Riwayat Sesi (HopOn Timeline) vs Riwayat Keuangan */}
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
            <AppCard variant="glass" style={styles.timelineCard}>
              {metrics.completedSessions.map((session, idx) => {
                const isLast = idx === metrics.completedSessions.length - 1;
                return (
                  <View key={session.id} style={styles.timelineItem}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {!isLast ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={[styles.timelineBody, !isLast && styles.timelineBodyBorder]}>
                      <View style={styles.timelineTextCol}>
                        <Text style={styles.historyTopik}>{session.topik}</Text>
                        <Text style={styles.historySub}>{session.ruang}</Text>
                      </View>
                      <View style={styles.timelineTimeCol}>
                        <Text style={styles.timelineTime}>{session.jamMulai} WIB</Text>
                        <Text style={styles.historyDate}>{session.tanggal}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </AppCard>
          )
        ) : metrics.finesList.length === 0 ? (
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
                      <Text
                        style={[
                          styles.fineAmount,
                          !isPaid && !isPending && !isWaived && { color: Colors.danger },
                        ]}
                      >
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
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  profileTextCol: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  profileSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rolePill: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rolePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  header: {
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
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
    flexBasis: '47%',
    flexGrow: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.md,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  kpiBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  kpiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  kpiBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
  },
  financialCard: {
    padding: Spacing.md + 2,
    gap: Spacing.md,
    borderRadius: Radius.lg,
  },
  financialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  financialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flex: 1,
  },
  financialTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  ratioPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  ratioText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
  },
  progressBarTrack: {
    flexDirection: 'row',
    height: 9,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    overflow: 'hidden',
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
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  amountValue: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
  },
  chartCard: {
    padding: Spacing.md + 2,
    gap: Spacing.md,
    borderRadius: Radius.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chartTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  chartSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  barTrack: {
    width: 24,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neutralSoft,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: Radius.sm,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
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
    gap: Spacing.sm,
  },
  labStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  labTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  labIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs + 2,
    gap: 4,
  },
  labDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  labDetailKey: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  labDetailVal: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  timelineCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
  },
  timelineRail: {
    alignItems: 'center',
    width: 14,
    paddingTop: 14,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.accentBlue,
    backgroundColor: Colors.surface,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  timelineBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  timelineBodyBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timelineTextCol: {
    flex: 1,
    gap: 2,
  },
  timelineTimeCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timelineTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  historyList: {
    gap: Spacing.xs + 2,
  },
  historyItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  historyTopik: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  historyDate: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  historySub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  fineStudentInfo: {
    flex: 1,
    gap: 2,
  },
  fineStudentName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  fineTopik: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  fineRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fineAmount: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  fineStatusBadge: {
    paddingHorizontal: 8,
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
    fontSize: 10,
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
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
