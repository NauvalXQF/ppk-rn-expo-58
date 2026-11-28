import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function getTodayYmd(): string {
  const now = new Date();
  return formatYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface CalendarPickerModalProps {
  visible: boolean;
  value: string;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

export function CalendarPickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: CalendarPickerModalProps) {
  const todayStr = useMemo(() => getTodayYmd(), []);
  const initialParsed = parseYmd(value) ?? parseYmd(todayStr)!;

  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);

  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(d);
    }
    while (list.length % 7 !== 0) {
      list.push(null);
    }
    return list;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePickToday = () => {
    onSelect(todayStr);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Bulan sebelumnya"
              style={styles.navBtn}
            >
              <AppIcon name="chevron-left" size={18} color={Colors.text} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Bulan berikutnya"
              style={styles.navBtn}
            >
              <AppIcon name="chevron-right" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} style={styles.dayCell}>
                <Text style={styles.weekLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }
              const ymd = formatYmd(viewYear, viewMonth, day);
              const isSelected = ymd === value.trim();
              const isToday = ymd === todayStr;

              return (
                <View key={ymd} style={styles.dayCell}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      onSelect(ymd);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih tanggal ${ymd}`}
                    style={[
                      styles.dayPill,
                      isToday && !isSelected && styles.dayToday,
                      isSelected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTodayText,
                        isSelected && styles.daySelectedText,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={styles.footer}>
            <AppButton
              label="Hari Ini"
              variant="secondary"
              size="sm"
              onPress={handlePickToday}
              style={{ flex: 1 }}
            />
            <AppButton
              label="Tutup"
              variant="ghost"
              size="sm"
              onPress={onClose}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.floating,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayPill: {
    width: '100%',
    height: '100%',
    maxWidth: 38,
    maxHeight: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  daySelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
  dayTodayText: {
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  daySelectedText: {
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
