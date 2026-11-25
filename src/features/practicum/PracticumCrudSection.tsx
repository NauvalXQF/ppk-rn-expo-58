import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { activeLaboratories } from '@/services/maps/laboratories';
import { subscribeLaboratories } from '@/services/maps/laboratoryService';
import {
  subscribeRegisteredPraktikanUsers,
  type RegisteredPraktikanAccount,
} from '@/services/practicumService';
import { useApp } from '@/store/app-context';
import {
  selectJadwalUntukPengguna,
  selectPesertaPraktikum,
  selectTotalPraktikan,
} from '@/store/selectors';
import type { Laboratory } from '@/types/laboratory';
import type { Jadwal, Kelas, Praktikan, Sesi } from '@/types/models';
import { LabPickerModal } from './LabPickerModal';

type CrudTab = 'sesi' | 'jadwal' | 'kelas' | 'peserta';
type ModalView = 'list' | 'form' | 'pick-account';
type AccountFilter = 'unassigned' | 'all';

export function PracticumCrudSection() {
  const {
    state,
    loading,
    error,
    isRemote,
    simpanKelas,
    hapusKelas,
    simpanPeserta,
    hapusPeserta,
    simpanJadwal,
    hapusJadwal,
    simpanSesi,
    hapusSesi,
    seedDataAwal,
  } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<CrudTab>('sesi');
  const [viewMode, setViewMode] = useState<ModalView>('list');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Search & filter state (A12 & A14)
  const [pesertaQuery, setPesertaQuery] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountFilter, setAccountFilter] =
    useState<AccountFilter>('unassigned');

  // State form Kelas
  const [editKelasId, setEditKelasId] = useState<string | undefined>();
  const [namaKelas, setNamaKelas] = useState('');

  // State form Peserta
  const [editPesertaId, setEditPesertaId] = useState<string | undefined>();
  const [uidPeserta, setUidPeserta] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [nimPeserta, setNimPeserta] = useState('');
  const [kelasPeserta, setKelasPeserta] = useState(
    state.kelas[0]?.id ?? 'kelas-a',
  );

  // State form Jadwal
  const [editJadwalId, setEditJadwalId] = useState<string | undefined>();
  const [kelasJadwal, setKelasJadwal] = useState(
    state.kelas[0]?.id ?? 'kelas-a',
  );
  const [hariJadwal, setHariJadwal] = useState('Rabu');
  const [mulaiJadwal, setMulaiJadwal] = useState('10:00');
  const [selesaiJadwal, setSelesaiJadwal] = useState('12:00');
  const [labIdJadwal, setLabIdJadwal] = useState<string | undefined>();
  const [ruangJadwal, setRuangJadwal] = useState('Lab 3');
  const [topikJadwal, setTopikJadwal] = useState('');

  // State form Sesi
  const [editSesiId, setEditSesiId] = useState<string | undefined>();
  const [kelasSesi, setKelasSesi] = useState(state.kelas[0]?.id ?? 'kelas-a');
  const [topikSesi, setTopikSesi] = useState('');
  const [labIdSesi, setLabIdSesi] = useState<string | undefined>();
  const [ruangSesi, setRuangSesi] = useState('Lab 3');
  const [tanggalSesi, setTanggalSesi] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [mulaiSesi, setMulaiSesi] = useState('10:00');
  const [selesaiSesi, setSelesaiSesi] = useState('12:00');

  const [registeredAccounts, setRegisteredAccounts] = useState<
    RegisteredPraktikanAccount[]
  >([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [labsLoaded, setLabsLoaded] = useState(false);
  const [labPickerTarget, setLabPickerTarget] = useState<'sesi' | 'jadwal' | null>(null);
  const [manualLabJadwal, setManualLabJadwal] = useState(false);
  const [manualLabSesi, setManualLabSesi] = useState(false);

  const isAsistenUser = state.currentUser?.peran === 'asisten';
  const defaultKelasId = state.kelas[0]?.id ?? '';
  const activeKelasPeserta = state.kelas.some((k) => k.id === kelasPeserta)
    ? kelasPeserta
    : defaultKelasId;
  const activeKelasJadwal = state.kelas.some((k) => k.id === kelasJadwal)
    ? kelasJadwal
    : defaultKelasId;
  const activeKelasSesi = state.kelas.some((k) => k.id === kelasSesi)
    ? kelasSesi
    : defaultKelasId;

  useEffect(() => {
    if (!isRemote || !isAsistenUser || !expanded || activeTab !== 'peserta') {
      return;
    }
    return subscribeRegisteredPraktikanUsers((accounts) => {
      setRegisteredAccounts(accounts);
    });
  }, [activeTab, expanded, isAsistenUser, isRemote]);

  useEffect(() => {
    if (!isRemote || !isAsistenUser || !expanded) {
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeLaboratories(
        (snapshot) => {
          if (!active) return;
          setLaboratories(activeLaboratories(snapshot.laboratories));
          setLabsLoaded(true);
        },
        () => {
          if (active) setLabsLoaded(true);
        },
      );
    } catch {
      queueMicrotask(() => {
        if (active) setLabsLoaded(true);
      });
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [expanded, isAsistenUser, isRemote]);

  const effectiveLabIdJadwal = manualLabJadwal
    ? undefined
    : (labIdJadwal ?? (!editJadwalId ? laboratories[0]?.id : undefined));
  const effectiveLabIdSesi = manualLabSesi
    ? undefined
    : (labIdSesi ?? (!editSesiId ? laboratories[0]?.id : undefined));

  const pesertaList = selectPesertaPraktikum(state);
  const jadwalList = selectJadwalUntukPengguna(state);

  const filteredPeserta = useMemo(() => {
    const q = pesertaQuery.trim().toLowerCase();
    if (!q) return pesertaList;
    return pesertaList.filter((p) => {
      const kelasNama =
        state.kelas.find((k) => k.id === p.kelasId)?.nama ?? '';
      return (
        p.nama.toLowerCase().includes(q) ||
        p.nim.toLowerCase().includes(q) ||
        kelasNama.toLowerCase().includes(q)
      );
    });
  }, [pesertaList, pesertaQuery, state.kelas]);

  const unassignedCount = useMemo(
    () =>
      registeredAccounts.filter(
        (acc) => !pesertaList.some((p) => p.id === acc.uid),
      ).length,
    [pesertaList, registeredAccounts],
  );

  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    return registeredAccounts.filter((acc) => {
      const hasClass = pesertaList.some((p) => p.id === acc.uid);
      if (accountFilter === 'unassigned' && hasClass) return false;
      if (!q) return true;
      return (
        acc.nama.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q)
      );
    });
  }, [accountFilter, accountQuery, pesertaList, registeredAccounts]);

  if (!isAsistenUser) return null;

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const closeModal = () => {
    setExpanded(false);
    setViewMode('list');
    setLabPickerTarget(null);
  };

  const resetKelasForm = () => {
    setEditKelasId(undefined);
    setNamaKelas('');
  };

  const resetPesertaForm = () => {
    setEditPesertaId(undefined);
    setUidPeserta('');
    setNamaPeserta('');
    setNimPeserta('');
  };

  const resetJadwalForm = () => {
    setEditJadwalId(undefined);
    setTopikJadwal('');
    setManualLabJadwal(false);
    if (laboratories.length > 0) {
      setLabIdJadwal(laboratories[0].id);
      setRuangJadwal(laboratories[0].nama);
    } else {
      setLabIdJadwal(undefined);
    }
  };

  const resetSesiForm = () => {
    setEditSesiId(undefined);
    setTopikSesi('');
    setManualLabSesi(false);
    if (laboratories.length > 0) {
      setLabIdSesi(laboratories[0].id);
      setRuangSesi(laboratories[0].nama);
    } else {
      setLabIdSesi(undefined);
    }
  };

  const openNewForm = () => {
    if (activeTab === 'sesi') resetSesiForm();
    else if (activeTab === 'jadwal') resetJadwalForm();
    else if (activeTab === 'kelas') resetKelasForm();
    else if (activeTab === 'peserta') resetPesertaForm();
    setViewMode('form');
  };

  const handleSaveKelas = async () => {
    try {
      await simpanKelas({ id: editKelasId, nama: namaKelas });
      showSuccess(
        editKelasId ? 'Data kelas diperbarui.' : 'Kelas baru ditambahkan.',
      );
      resetKelasForm();
      setViewMode('list');
    } catch {
      // Error sudah ditangani di context
    }
  };

  const handleSavePeserta = async () => {
    try {
      await simpanPeserta({
        id: editPesertaId ?? (uidPeserta.trim() || undefined),
        nama: namaPeserta,
        nim: nimPeserta,
        kelasId: activeKelasPeserta,
      });
      showSuccess(
        editPesertaId
          ? 'Data peserta diperbarui.'
          : 'Peserta kelas ditambahkan.',
      );
      resetPesertaForm();
      setViewMode('list');
    } catch {
      // Error ditangani di context
    }
  };

  const handleSaveJadwal = async () => {
    try {
      const selectedLab = laboratories.find(
        (l) => l.id === effectiveLabIdJadwal,
      );
      await simpanJadwal({
        id: editJadwalId,
        kelasId: activeKelasJadwal,
        hari: hariJadwal,
        jamMulai: mulaiJadwal,
        jamSelesai: selesaiJadwal,
        ruang: selectedLab ? selectedLab.nama : ruangJadwal,
        labId: selectedLab?.id ?? effectiveLabIdJadwal,
        ...(selectedLab
          ? {
              labCoordinates: {
                latitude: selectedLab.latitude,
                longitude: selectedLab.longitude,
              },
              radiusMeters: selectedLab.radiusMeters,
            }
          : {}),
        topik: topikJadwal,
      });
      showSuccess(
        editJadwalId ? 'Jadwal diperbarui.' : 'Jadwal baru ditambahkan.',
      );
      resetJadwalForm();
      setViewMode('list');
    } catch {
      // Error ditangani di context
    }
  };

  const handleSaveSesi = async () => {
    try {
      const selectedLab = laboratories.find((l) => l.id === effectiveLabIdSesi);
      await simpanSesi({
        id: editSesiId,
        kelasId: activeKelasSesi,
        topik: topikSesi,
        ruang: selectedLab ? selectedLab.nama : ruangSesi,
        labId: selectedLab?.id ?? effectiveLabIdSesi,
        ...(selectedLab
          ? {
              labCoordinates: {
                latitude: selectedLab.latitude,
                longitude: selectedLab.longitude,
              },
              radiusMeters: selectedLab.radiusMeters,
            }
          : {}),
        tanggal: tanggalSesi,
        jamMulai: mulaiSesi,
        jamSelesai: selesaiSesi,
      });
      showSuccess(editSesiId ? 'Sesi diperbarui.' : 'Sesi baru ditambahkan.');
      resetSesiForm();
      setViewMode('list');
    } catch {
      // Error ditangani di context
    }
  };

  const renderKelasSelector = (
    selected: string,
    onSelect: (id: string) => void,
  ) => (
    <View style={styles.chipRow}>
      {state.kelas.map((k) => {
        const active = k.id === selected;
        return (
          <Pressable
            key={k.id}
            onPress={() => onSelect(k.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {k.nama}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderLabSelector = (
    target: 'sesi' | 'jadwal',
    selectedLabId: string | undefined,
    ruangValue: string,
    manualMode: boolean,
    onChangeRuangFallback: (text: string) => void,
  ) => {
    if (laboratories.length === 0 || manualMode) {
      return (
        <View style={styles.labSelectorWrap}>
          <FormField
            label="Laboratorium / Ruang"
            placeholder="Lab 3"
            value={ruangValue}
            onChangeText={onChangeRuangFallback}
          />
          {laboratories.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setLabPickerTarget(target)}
              style={styles.labSwitchLink}
            >
              <Text style={styles.labSwitchLinkText}>
                Pilih Laboratorium / Ruang Praktikum ▾
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.labHint}>
              {isRemote && !labsLoaded
                ? 'Memuat daftar laboratorium...'
                : 'Data lab belum tersedia; gunakan input ruang manual.'}
            </Text>
          )}
        </View>
      );
    }

    const boundLab = laboratories.find((l) => l.id === selectedLabId);

    return (
      <View style={styles.labSelectorWrap}>
        <Text style={styles.fieldLabel}>Laboratorium (Geofence)</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLabPickerTarget(target)}
          style={styles.labPickerCard}
        >
          {boundLab ? (
            <>
              <View style={styles.labPickerInfo}>
                <Text style={styles.labPickerName}>{boundLab.nama}</Text>
                <Text style={styles.labPickerMeta}>
                  {boundLab.gedung ? `${boundLab.gedung} · ` : ''}
                  Radius {boundLab.radiusMeters} m
                </Text>
              </View>
              <View style={styles.labChangePill}>
                <Text style={styles.labChangePillText}>Ganti Lab</Text>
              </View>
            </>
          ) : (
            <Text style={styles.labPickerPlaceholder}>
              Pilih Laboratorium / Ruang Praktikum ▾
            </Text>
          )}
        </Pressable>
        {boundLab ? (
          <Text style={styles.labBoundHint}>
            ✓ Tertaut ke Peta & Geofence {boundLab.nama}
            {boundLab.gedung ? ` · ${boundLab.gedung}` : ''} (radius{' '}
            {boundLab.radiusMeters} m)
          </Text>
        ) : ruangValue ? (
          <Text style={styles.labHint}>
            Ruang saat ini: {ruangValue} (ketuk di atas untuk menautkan ke peta
            & geofence)
          </Text>
        ) : null}
      </View>
    );
  };

  const formTitle =
    activeTab === 'sesi'
      ? editSesiId
        ? 'Ubah Sesi Praktikum'
        : 'Tambah Sesi Baru'
      : activeTab === 'jadwal'
        ? editJadwalId
          ? 'Ubah Jadwal Reguler'
          : 'Tambah Jadwal Reguler'
        : activeTab === 'kelas'
          ? editKelasId
            ? 'Ubah Kelas'
            : 'Tambah Kelas Baru'
          : editPesertaId
            ? 'Ubah Peserta'
            : 'Tambah Peserta';

  const selectedAccount = registeredAccounts.find(
    (acc) => acc.uid === uidPeserta,
  );

  return (
    <>
      <AppCard style={styles.card}>
        <Pressable
          onPress={() => {
            setViewMode('list');
            setExpanded(true);
          }}
          style={styles.topHeader}
        >
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Kelola Praktikum & Sesi</Text>
            <Text style={styles.subtitle}>
              {state.kelas.length} kelas · {state.sesi.length} sesi ·{' '}
              {pesertaList.length} peserta
            </Text>
          </View>
          <View style={styles.toggleBtn}>
            <Text style={styles.toggleBtnText}>Kelola</Text>
          </View>
        </Pressable>
      </AppCard>

      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (viewMode === 'pick-account') setViewMode('form');
          else if (viewMode === 'form') setViewMode('list');
          else closeModal();
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropTap} onPress={closeModal} />
          <View style={styles.sheet}>
            <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
              <View style={styles.handle} />

              {/* HEADER: List-First vs Focused Form vs Account Picker */}
              {viewMode === 'list' ? (
                <View style={styles.sheetHeader}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.sheetTitle}>Kelola Praktikum</Text>
                    <Text style={styles.subtitle}>
                      Pilih data yang ingin dikelola
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeModal}
                    style={styles.closeBtn}
                    accessibilityLabel="Tutup menu kelola"
                  >
                    <AppIcon name="x" size={18} color={Colors.text} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.sheetHeader}>
                  <View style={styles.subHeaderLeft}>
                    <Pressable
                      onPress={() =>
                        setViewMode(
                          viewMode === 'pick-account' ? 'form' : 'list',
                        )
                      }
                      style={styles.backBtn}
                      accessibilityLabel="Kembali"
                    >
                      <AppIcon
                        name="chevron-left"
                        size={18}
                        color={Colors.text}
                      />
                    </Pressable>
                    <Text style={styles.sheetTitle}>
                      {viewMode === 'pick-account'
                        ? 'Pilih Akun Praktikan'
                        : formTitle}
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeModal}
                    style={styles.closeBtn}
                    accessibilityLabel="Tutup"
                  >
                    <AppIcon name="x" size={18} color={Colors.text} />
                  </Pressable>
                </View>
              )}

              {/* TABS — hanya tampil di List View (A8, A10, A11, A12) */}
              {viewMode === 'list' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tabScroll}
                  contentContainerStyle={styles.tabRow}
                >
                  {(
                    [
                      { key: 'sesi', label: `Sesi (${state.sesi.length})` },
                      {
                        key: 'jadwal',
                        label: `Jadwal (${jadwalList.length})`,
                      },
                      {
                        key: 'kelas',
                        label: `Kelas (${state.kelas.length})`,
                      },
                      {
                        key: 'peserta',
                        label: `Peserta (${pesertaList.length})`,
                      },
                    ] as const
                  ).map((t) => (
                    <FilterChip
                      key={t.key}
                      label={t.label}
                      active={activeTab === t.key}
                      onPress={() => setActiveTab(t.key)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <ScrollView
                style={styles.sheetBody}
                contentContainerStyle={styles.sheetBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {feedback ? (
                  <InfoBanner tone="success" message={feedback} />
                ) : null}
                {error ? <InfoBanner tone="danger" message={error} /> : null}

                {/* ============ LIST VIEWS (A8, A10, A11, A12) ============ */}
                {viewMode === 'list' && activeTab === 'sesi' ? (
                  <View style={styles.section}>
                    <AppButton
                      label="+ Tambah Sesi Baru"
                      onPress={openNewForm}
                    />
                    {state.sesi.length === 0 ? (
                      <EmptyState
                        title="Belum ada sesi"
                        description="Tambahkan sesi praktikum baru untuk membuka presensi GPS."
                      />
                    ) : (
                      state.sesi.map((s: Sesi) => {
                        const k = state.kelas.find(
                          (item) => item.id === s.kelasId,
                        );
                        return (
                          <View key={s.id} style={styles.listCard}>
                            <View style={styles.listCardTop}>
                              <StatusBadge status={s.status} />
                              <View style={styles.itemActions}>
                                <Pressable
                                  onPress={() => {
                                    setEditSesiId(s.id);
                                    setKelasSesi(s.kelasId);
                                    setTopikSesi(s.topik);
                                    setLabIdSesi(s.labId);
                                    setRuangSesi(s.ruang);
                                    setTanggalSesi(s.tanggal);
                                    setMulaiSesi(s.jamMulai);
                                    setSelesaiSesi(s.jamSelesai);
                                    setViewMode('form');
                                  }}
                                  style={styles.miniBtn}
                                >
                                  <Text style={styles.miniBtnEdit}>Ubah</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => {
                                    hapusSesi(s.id).catch(() => {});
                                  }}
                                  style={[styles.miniBtn, styles.miniBtnDanger]}
                                >
                                  <Text style={styles.miniBtnDelete}>
                                    Hapus
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                            <Text style={styles.itemTitle}>{s.topik}</Text>
                            <Text style={styles.itemMeta}>
                              {k?.nama ?? s.kelasId} · {s.tanggal} ·{' '}
                              {s.jamMulai}–{s.jamSelesai} · {s.ruang}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}

                {viewMode === 'list' && activeTab === 'jadwal' ? (
                  <View style={styles.section}>
                    <AppButton
                      label="+ Tambah Jadwal Reguler"
                      onPress={openNewForm}
                    />
                    {jadwalList.length === 0 ? (
                      <EmptyState
                        title="Belum ada jadwal reguler"
                        description="Tambahkan jadwal mingguan agar praktikan tahu waktu praktikum."
                      />
                    ) : (
                      jadwalList.map((j: Jadwal) => {
                        const k = state.kelas.find(
                          (item) => item.id === j.kelasId,
                        );
                        return (
                          <View key={j.id} style={styles.listCard}>
                            <View style={styles.listCardTop}>
                              <View style={styles.classPill}>
                                <Text style={styles.classPillText}>
                                  {k?.nama ?? j.kelasId}
                                </Text>
                              </View>
                              <View style={styles.itemActions}>
                                <Pressable
                                  onPress={() => {
                                    setEditJadwalId(j.id);
                                    setKelasJadwal(j.kelasId);
                                    setHariJadwal(j.hari);
                                    setMulaiJadwal(j.jamMulai);
                                    setSelesaiJadwal(j.jamSelesai);
                                    setLabIdJadwal(j.labId);
                                    setRuangJadwal(j.ruang);
                                    setTopikJadwal(j.topik);
                                    setViewMode('form');
                                  }}
                                  style={styles.miniBtn}
                                >
                                  <Text style={styles.miniBtnEdit}>Ubah</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => {
                                    hapusJadwal(j.id).catch(() => {});
                                  }}
                                  style={[styles.miniBtn, styles.miniBtnDanger]}
                                >
                                  <Text style={styles.miniBtnDelete}>
                                    Hapus
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                            <Text style={styles.itemTitle}>{j.topik}</Text>
                            <Text style={styles.itemMeta}>
                              {j.hari}, {j.jamMulai}–{j.jamSelesai} WIB ·{' '}
                              {j.ruang}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}

                {viewMode === 'list' && activeTab === 'kelas' ? (
                  <View style={styles.section}>
                    <AppButton
                      label="+ Tambah Kelas Baru"
                      onPress={openNewForm}
                    />
                    {state.kelas.map((k: Kelas) => {
                      const sesiCount = state.sesi.filter(
                        (s) => s.kelasId === k.id,
                      ).length;
                      return (
                        <View key={k.id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>{k.nama}</Text>
                            <Text style={styles.itemMeta}>
                              {selectTotalPraktikan(state, k.id)} peserta ·{' '}
                              {sesiCount} sesi
                            </Text>
                          </View>
                          <View style={styles.itemActions}>
                            <Pressable
                              onPress={() => {
                                setEditKelasId(k.id);
                                setNamaKelas(k.nama);
                                setViewMode('form');
                              }}
                              style={styles.miniBtn}
                            >
                              <Text style={styles.miniBtnEdit}>Ubah</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                hapusKelas(k.id).catch(() => {});
                              }}
                              style={[styles.miniBtn, styles.miniBtnDanger]}
                            >
                              <Text style={styles.miniBtnDelete}>Hapus</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}

                    {isRemote ? (
                      <View style={styles.seedSection}>
                        <AppButton
                          label="Muat Ulang Data Awal Praktikum"
                          variant="secondary"
                          loading={loading}
                          onPress={() => {
                            seedDataAwal()
                              .then(() =>
                                showSuccess(
                                  'Data awal praktikum berhasil dimuat ulang.',
                                ),
                              )
                              .catch(() => {});
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {viewMode === 'list' && activeTab === 'peserta' ? (
                  <View style={styles.section}>
                    <AppButton
                      label="+ Tambah Peserta ke Kelas"
                      onPress={openNewForm}
                    />
                    <View style={styles.searchBox}>
                      <AppIcon
                        name="search"
                        size={15}
                        color={Colors.textMuted}
                      />
                      <TextInput
                        value={pesertaQuery}
                        onChangeText={setPesertaQuery}
                        placeholder="Cari nama atau NIM peserta..."
                        placeholderTextColor={Colors.textMuted}
                        style={styles.searchInput}
                      />
                    </View>
                    {filteredPeserta.length === 0 ? (
                      <EmptyState
                        title="Peserta tidak ditemukan"
                        description="Belum ada peserta yang cocok dengan pencarian."
                      />
                    ) : (
                      filteredPeserta.map((p: Praktikan) => {
                        const k = state.kelas.find(
                          (item) => item.id === p.kelasId,
                        );
                        return (
                          <View
                            key={`${p.kelasId}_${p.id}`}
                            style={styles.itemRow}
                          >
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemTitle}>{p.nama}</Text>
                              <Text style={styles.itemMeta}>
                                {p.nim ? `${p.nim} · ` : ''}
                                {k?.nama ?? p.kelasId}
                              </Text>
                            </View>
                            <View style={styles.itemActions}>
                              <Pressable
                                onPress={() => {
                                  setEditPesertaId(p.id);
                                  setUidPeserta(p.id);
                                  setNamaPeserta(p.nama);
                                  setNimPeserta(p.nim);
                                  setKelasPeserta(p.kelasId);
                                  setViewMode('form');
                                }}
                                style={styles.miniBtn}
                              >
                                <Text style={styles.miniBtnEdit}>Ubah</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  hapusPeserta(p.id).catch(() => {});
                                }}
                                style={[styles.miniBtn, styles.miniBtnDanger]}
                              >
                                <Text style={styles.miniBtnDelete}>Hapus</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}

                {/* ============ FOCUSED FORM VIEWS (A9, A13, dll.) ============ */}
                {viewMode === 'form' && activeTab === 'sesi' ? (
                  <View style={styles.section}>
                    <Text style={styles.fieldLabel}>Kelas Praktikum</Text>
                    {renderKelasSelector(activeKelasSesi, setKelasSesi)}
                    <FormField
                      label="Topik Sesi"
                      placeholder="Mis. Animasi & Gesture"
                      value={topikSesi}
                      onChangeText={setTopikSesi}
                    />
                    <FormField
                      label="Tanggal (YYYY-MM-DD)"
                      placeholder="2026-11-25"
                      value={tanggalSesi}
                      onChangeText={setTanggalSesi}
                    />
                    {renderLabSelector(
                      'sesi',
                      effectiveLabIdSesi,
                      ruangSesi,
                      manualLabSesi,
                      (text) => {
                        setLabIdSesi(undefined);
                        setRuangSesi(text);
                      },
                    )}
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <FormField
                          label="Jam Mulai"
                          placeholder="10:00"
                          value={mulaiSesi}
                          onChangeText={setMulaiSesi}
                        />
                      </View>
                      <View style={styles.col}>
                        <FormField
                          label="Jam Selesai"
                          placeholder="12:00"
                          value={selesaiSesi}
                          onChangeText={setSelesaiSesi}
                        />
                      </View>
                    </View>
                    <View style={styles.formActions}>
                      <View style={styles.col}>
                        <AppButton
                          label="Batal"
                          variant="secondary"
                          onPress={() => {
                            resetSesiForm();
                            setViewMode('list');
                          }}
                        />
                      </View>
                      <View style={styles.col}>
                        <AppButton
                          label="Simpan Sesi"
                          onPress={handleSaveSesi}
                          loading={loading}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                {viewMode === 'form' && activeTab === 'jadwal' ? (
                  <View style={styles.section}>
                    <Text style={styles.fieldLabel}>Kelas Praktikum</Text>
                    {renderKelasSelector(activeKelasJadwal, setKelasJadwal)}
                    <FormField
                      label="Informasi / Topik Jadwal"
                      placeholder="Mis. Praktikum Reguler PPK"
                      value={topikJadwal}
                      onChangeText={setTopikJadwal}
                    />
                    <FormField
                      label="Hari"
                      placeholder="Rabu"
                      value={hariJadwal}
                      onChangeText={setHariJadwal}
                    />
                    {renderLabSelector(
                      'jadwal',
                      effectiveLabIdJadwal,
                      ruangJadwal,
                      manualLabJadwal,
                      (text) => {
                        setLabIdJadwal(undefined);
                        setRuangJadwal(text);
                      },
                    )}
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <FormField
                          label="Jam Mulai"
                          placeholder="10:00"
                          value={mulaiJadwal}
                          onChangeText={setMulaiJadwal}
                        />
                      </View>
                      <View style={styles.col}>
                        <FormField
                          label="Jam Selesai"
                          placeholder="12:00"
                          value={selesaiJadwal}
                          onChangeText={setSelesaiJadwal}
                        />
                      </View>
                    </View>
                    <View style={styles.formActions}>
                      <View style={styles.col}>
                        <AppButton
                          label="Batal"
                          variant="secondary"
                          onPress={() => {
                            resetJadwalForm();
                            setViewMode('list');
                          }}
                        />
                      </View>
                      <View style={styles.col}>
                        <AppButton
                          label="Simpan Jadwal"
                          onPress={handleSaveJadwal}
                          loading={loading}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                {viewMode === 'form' && activeTab === 'kelas' ? (
                  <View style={styles.section}>
                    <FormField
                      label="Nama Kelas"
                      placeholder="Mis. PPK D"
                      value={namaKelas}
                      onChangeText={setNamaKelas}
                    />
                    <View style={styles.formActions}>
                      <View style={styles.col}>
                        <AppButton
                          label="Batal"
                          variant="secondary"
                          onPress={() => {
                            resetKelasForm();
                            setViewMode('list');
                          }}
                        />
                      </View>
                      <View style={styles.col}>
                        <AppButton
                          label="Simpan Kelas"
                          onPress={handleSaveKelas}
                          loading={loading}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                {viewMode === 'form' && activeTab === 'peserta' ? (
                  <View style={styles.section}>
                    {!editPesertaId && registeredAccounts.length > 0 ? (
                      <View style={styles.pickerGroup}>
                        <Text style={styles.fieldLabel}>
                          1. Akun Praktikan (ketuk untuk ganti)
                        </Text>
                        <Pressable
                          onPress={() => setViewMode('pick-account')}
                          style={[
                            styles.accountTrigger,
                            selectedAccount && styles.accountTriggerSelected,
                          ]}
                        >
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>
                              {selectedAccount
                                ? selectedAccount.nama
                                : 'Pilih akun praktikan terdaftar...'}
                            </Text>
                            <Text style={styles.itemMeta}>
                              {selectedAccount
                                ? `${selectedAccount.email} · ${
                                    (() => {
                                      const ex = pesertaList.find(
                                        (p) => p.id === selectedAccount.uid,
                                      );
                                      return ex
                                        ? (state.kelas.find(
                                            (k) => k.id === ex.kelasId,
                                          )?.nama ?? ex.kelasId)
                                        : 'Belum ada kelas';
                                    })()
                                  }`
                                : `${unassignedCount} akun belum masuk kelas`}
                            </Text>
                          </View>
                          <View style={styles.changePill}>
                            <Text style={styles.changePillText}>
                              {selectedAccount ? 'Ganti ▾' : 'Pilih ▾'}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    ) : null}

                    <Text style={styles.fieldLabel}>
                      {!editPesertaId && registeredAccounts.length > 0
                        ? '2. Lengkapi Data & Kelas'
                        : 'Data & Kelas Peserta'}
                    </Text>

                    <FormField
                      label="Nama Praktikan"
                      placeholder="Mis. Andi Wijaya"
                      value={namaPeserta}
                      onChangeText={setNamaPeserta}
                    />
                    <FormField
                      label="NIM (opsional)"
                      placeholder="Kosongkan jika belum ada, atau isi NIM"
                      value={nimPeserta}
                      onChangeText={setNimPeserta}
                    />
                    <Text style={styles.fieldLabel}>Pilih Kelas</Text>
                    {renderKelasSelector(activeKelasPeserta, setKelasPeserta)}

                    {(() => {
                      const targetUid = editPesertaId ?? uidPeserta.trim();
                      if (!targetUid) return null;
                      const existing = pesertaList.find(
                        (p) => p.id === targetUid,
                      );
                      if (!existing || existing.kelasId === activeKelasPeserta) {
                        return null;
                      }
                      const fromKelas =
                        state.kelas.find((k) => k.id === existing.kelasId)
                          ?.nama ?? existing.kelasId;
                      const toKelas =
                        state.kelas.find((k) => k.id === activeKelasPeserta)
                          ?.nama ?? activeKelasPeserta;
                      return (
                        <InfoBanner
                          tone="info"
                          message={`Praktikan akan dipindahkan dari ${fromKelas} ke ${toKelas} (maks. 1 kelas per praktikan).`}
                        />
                      );
                    })()}

                    <View style={styles.formActions}>
                      <View style={styles.col}>
                        <AppButton
                          label="Batal"
                          variant="secondary"
                          onPress={() => {
                            resetPesertaForm();
                            setViewMode('list');
                          }}
                        />
                      </View>
                      <View style={styles.col}>
                        <AppButton
                          label="Simpan Peserta"
                          onPress={handleSavePeserta}
                          loading={loading}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* ============ ACCOUNT PICKER SUB-VIEW (A14) ============ */}
                {viewMode === 'pick-account' ? (
                  <View style={styles.section}>
                    <View style={styles.searchBox}>
                      <AppIcon
                        name="search"
                        size={15}
                        color={Colors.textMuted}
                      />
                      <TextInput
                        value={accountQuery}
                        onChangeText={setAccountQuery}
                        placeholder="Cari nama atau email praktikan..."
                        placeholderTextColor={Colors.textMuted}
                        style={styles.searchInput}
                        autoFocus
                      />
                    </View>

                    <View style={styles.chipRow}>
                      <FilterChip
                        label={`Belum ada kelas (${unassignedCount})`}
                        active={accountFilter === 'unassigned'}
                        onPress={() => setAccountFilter('unassigned')}
                      />
                      <FilterChip
                        label={`Semua (${registeredAccounts.length})`}
                        active={accountFilter === 'all'}
                        onPress={() => setAccountFilter('all')}
                      />
                    </View>

                    {filteredAccounts.length === 0 ? (
                      <EmptyState
                        title="Akun tidak ditemukan"
                        description="Coba ganti filter ke Semua atau gunakan kata kunci lain."
                      />
                    ) : (
                      filteredAccounts.map((acc) => {
                        const isSelected = uidPeserta === acc.uid;
                        const existingMembership = pesertaList.find(
                          (p) => p.id === acc.uid,
                        );
                        const existingClassName = existingMembership
                          ? (state.kelas.find(
                              (k) => k.id === existingMembership.kelasId,
                            )?.nama ?? existingMembership.kelasId)
                          : null;

                        return (
                          <Pressable
                            key={acc.uid}
                            onPress={() => {
                              setUidPeserta(acc.uid);
                              setNamaPeserta(acc.nama);
                              if (acc.nim) setNimPeserta(acc.nim);
                              if (existingMembership) {
                                setKelasPeserta(existingMembership.kelasId);
                              }
                              setViewMode('form');
                            }}
                            style={[
                              styles.accountRow,
                              isSelected && styles.accountRowSelected,
                            ]}
                          >
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemTitle}>{acc.nama}</Text>
                              <Text style={styles.itemMeta}>
                                {acc.email} ·{' '}
                                {existingClassName
                                  ? `Kelas ${existingClassName}`
                                  : 'Belum ada kelas'}
                              </Text>
                            </View>
                            {isSelected ? (
                              <View style={styles.selectedPill}>
                                <Text style={styles.selectedPillText}>
                                  Dipilih
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
      <LabPickerModal
        visible={labPickerTarget !== null}
        laboratories={laboratories}
        selectedLabId={
          labPickerTarget === 'sesi'
            ? effectiveLabIdSesi
            : effectiveLabIdJadwal
        }
        onSelectLab={(lab) => {
          if (labPickerTarget === 'sesi') {
            setManualLabSesi(false);
            setLabIdSesi(lab.id);
            setRuangSesi(lab.nama);
          } else if (labPickerTarget === 'jadwal') {
            setManualLabJadwal(false);
            setLabIdJadwal(lab.id);
            setRuangJadwal(lab.nama);
          }
        }}
        onSelectManual={() => {
          if (labPickerTarget === 'sesi') {
            setManualLabSesi(true);
            setLabIdSesi(undefined);
          } else if (labPickerTarget === 'jadwal') {
            setManualLabJadwal(true);
            setLabIdJadwal(undefined);
          }
        }}
        onClose={() => setLabPickerTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    paddingVertical: 12,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  toggleBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  toggleBtnText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textOnDark,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: Platform.OS === 'web' ? '88%' : '90%',
    ...Shadow.floating,
  },
  sheetSafe: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: 10,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  subHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sheetTitle: {
    fontSize: FontSize.lg + 2,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabScroll: {
    flexGrow: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  sheetBody: {
    maxHeight: 540,
  },
  sheetBodyContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm + 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    paddingVertical: 8,
  },
  listCard: {
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    padding: 14,
    gap: 6,
  },
  listCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  classPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  classPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  labSelectorWrap: {
    gap: Spacing.xs,
  },
  labPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 50,
  },
  labPickerInfo: {
    flex: 1,
    gap: 2,
  },
  labPickerName: {
    fontSize: FontSize.sm + 1,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  labPickerMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  labChangePill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  labChangePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  labPickerPlaceholder: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  labSwitchLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  labSwitchLinkText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  labHint: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  labBoundHint: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.success,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.neutralSoft,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.textOnDark,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  miniBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBtnDanger: {
    backgroundColor: Colors.dangerSoft,
    borderColor: 'transparent',
  },
  miniBtnEdit: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  miniBtnDelete: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.danger,
  },
  pickerGroup: {
    gap: 6,
  },
  accountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutralSoft,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountTriggerSelected: {
    backgroundColor: Colors.unreadSurface,
    borderColor: Colors.accentBlue,
  },
  changePill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutralSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accountRowSelected: {
    backgroundColor: Colors.unreadSurface,
    borderColor: Colors.accentBlue,
  },
  selectedPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  selectedPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textOnDark,
  },
  seedSection: {
    marginTop: Spacing.xs,
  },
});
