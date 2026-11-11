import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/store/app-context';
import {
  selectJadwalUntukPengguna,
  selectPesertaPraktikum,
  selectTotalPraktikan,
} from '@/store/selectors';
import type { Jadwal, Kelas, Praktikan, Sesi } from '@/types/models';

type CrudTab = 'sesi' | 'jadwal' | 'kelas' | 'peserta';

export function PracticumCrudSection() {
  const {
    state,
    loading,
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
  const [feedback, setFeedback] = useState<string | null>(null);

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
  const [ruangJadwal, setRuangJadwal] = useState('Lab 3');
  const [topikJadwal, setTopikJadwal] = useState('');

  // State form Sesi
  const [editSesiId, setEditSesiId] = useState<string | undefined>();
  const [kelasSesi, setKelasSesi] = useState(state.kelas[0]?.id ?? 'kelas-a');
  const [topikSesi, setTopikSesi] = useState('');
  const [ruangSesi, setRuangSesi] = useState('Lab 3');
  const [tanggalSesi, setTanggalSesi] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [mulaiSesi, setMulaiSesi] = useState('10:00');
  const [selesaiSesi, setSelesaiSesi] = useState('12:00');

  if (state.currentUser?.peran !== 'asisten') return null;

  const pesertaList = selectPesertaPraktikum(state);
  const jadwalList = selectJadwalUntukPengguna(state);

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
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
  };

  const resetSesiForm = () => {
    setEditSesiId(undefined);
    setTopikSesi('');
  };

  const handleSaveKelas = async () => {
    try {
      await simpanKelas({ id: editKelasId, nama: namaKelas });
      showSuccess(
        editKelasId ? 'Data kelas diperbarui.' : 'Kelas baru ditambahkan.',
      );
      resetKelasForm();
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
        kelasId: kelasPeserta,
      });
      showSuccess(
        editPesertaId
          ? 'Data peserta diperbarui.'
          : 'Peserta kelas ditambahkan.',
      );
      resetPesertaForm();
    } catch {
      // Error ditangani di context
    }
  };

  const handleSaveJadwal = async () => {
    try {
      await simpanJadwal({
        id: editJadwalId,
        kelasId: kelasJadwal,
        hari: hariJadwal,
        jamMulai: mulaiJadwal,
        jamSelesai: selesaiJadwal,
        ruang: ruangJadwal,
        topik: topikJadwal,
      });
      showSuccess(
        editJadwalId ? 'Jadwal diperbarui.' : 'Jadwal baru ditambahkan.',
      );
      resetJadwalForm();
    } catch {
      // Error ditangani di context
    }
  };

  const handleSaveSesi = async () => {
    try {
      const existing = state.sesi.find((s) => s.id === editSesiId);
      await simpanSesi({
        id: editSesiId,
        kelasId: kelasSesi,
        topik: topikSesi,
        ruang: ruangSesi,
        tanggal: tanggalSesi,
        jamMulai: mulaiSesi,
        jamSelesai: selesaiSesi,
        status: existing?.status ?? 'dijadwalkan',
      });
      showSuccess(editSesiId ? 'Sesi diperbarui.' : 'Sesi baru ditambahkan.');
      resetSesiForm();
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

  return (
    <AppCard style={styles.card}>
      <View style={styles.topHeader}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Kelola Data Praktikum</Text>
          <Text style={styles.subtitle}>
            {isRemote
              ? 'Terhubung ke Cloud Firestore (Real-time)'
              : 'Mode Lokal (isi EXPO_PUBLIC_FIREBASE_* untuk sinkronisasi cloud)'}
          </Text>
        </View>
        <AppButton
          label={expanded ? 'Tutup' : 'Kelola CRUD'}
          variant={expanded ? 'secondary' : 'primary'}
          onPress={() => setExpanded((prev) => !prev)}
        />
      </View>

      {feedback ? <InfoBanner tone="success" message={feedback} /> : null}

      {expanded && (
        <View style={styles.body}>
          {/* Tab Pemilih Entitas CRUD */}
          <View style={styles.tabRow}>
            {(
              [
                ['sesi', 'Sesi'],
                ['jadwal', 'Jadwal'],
                ['kelas', 'Kelas'],
                ['peserta', 'Peserta'],
              ] as const
            ).map(([key, label]) => {
              const active = activeTab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setActiveTab(key)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 1. TAB SESI */}
          {activeTab === 'sesi' && (
            <View style={styles.section}>
              <SectionHeader
                title={editSesiId ? 'Ubah Sesi' : 'Tambah Sesi Praktikum'}
              />
              <Text style={styles.fieldLabel}>Pilih Kelas</Text>
              {renderKelasSelector(kelasSesi, setKelasSesi)}
              <FormField
                label="Topik Sesi"
                placeholder="Mis. Integrasi Firebase & Firestore"
                value={topikSesi}
                onChangeText={setTopikSesi}
              />
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormField
                    label="Tanggal (YYYY-MM-DD)"
                    placeholder="2026-11-11"
                    value={tanggalSesi}
                    onChangeText={setTanggalSesi}
                  />
                </View>
                <View style={styles.col}>
                  <FormField
                    label="Ruang"
                    placeholder="Lab 3"
                    value={ruangSesi}
                    onChangeText={setRuangSesi}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormField
                    label="Jam Mulai (HH:mm)"
                    placeholder="10:00"
                    value={mulaiSesi}
                    onChangeText={setMulaiSesi}
                  />
                </View>
                <View style={styles.col}>
                  <FormField
                    label="Jam Selesai (HH:mm)"
                    placeholder="12:00"
                    value={selesaiSesi}
                    onChangeText={setSelesaiSesi}
                  />
                </View>
              </View>
              <View style={styles.actionRow}>
                {editSesiId ? (
                  <AppButton
                    label="Batal"
                    variant="secondary"
                    onPress={resetSesiForm}
                  />
                ) : null}
                <AppButton
                  label={editSesiId ? 'Simpan Perubahan' : 'Tambah Sesi'}
                  onPress={handleSaveSesi}
                  loading={loading}
                />
              </View>

              <SectionHeader
                title="Daftar Sesi"
                rightText={`${state.sesi.length} sesi`}
              />
              {state.sesi.map((s: Sesi) => {
                const k = state.kelas.find((item) => item.id === s.kelasId);
                return (
                  <View key={s.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>
                        {k?.nama ?? s.kelasId} · {s.topik}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {s.tanggal} · {s.jamMulai}–{s.jamSelesai} · {s.ruang} (
                        {s.status})
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        onPress={() => {
                          setEditSesiId(s.id);
                          setKelasSesi(s.kelasId);
                          setTopikSesi(s.topik);
                          setRuangSesi(s.ruang);
                          setTanggalSesi(s.tanggal);
                          setMulaiSesi(s.jamMulai);
                          setSelesaiSesi(s.jamSelesai);
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnEdit}>Ubah</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          hapusSesi(s.id).catch(() => {});
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnDelete}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 2. TAB JADWAL */}
          {activeTab === 'jadwal' && (
            <View style={styles.section}>
              <SectionHeader
                title={editJadwalId ? 'Ubah Jadwal' : 'Tambah Jadwal Praktikum'}
              />
              <Text style={styles.fieldLabel}>Pilih Kelas</Text>
              {renderKelasSelector(kelasJadwal, setKelasJadwal)}
              <FormField
                label="Informasi / Topik Jadwal"
                placeholder="Mis. Praktikum Reguler PPK"
                value={topikJadwal}
                onChangeText={setTopikJadwal}
              />
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormField
                    label="Hari"
                    placeholder="Rabu"
                    value={hariJadwal}
                    onChangeText={setHariJadwal}
                  />
                </View>
                <View style={styles.col}>
                  <FormField
                    label="Ruang"
                    placeholder="Lab 3"
                    value={ruangJadwal}
                    onChangeText={setRuangJadwal}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <FormField
                    label="Jam Mulai (HH:mm)"
                    placeholder="10:00"
                    value={mulaiJadwal}
                    onChangeText={setMulaiJadwal}
                  />
                </View>
                <View style={styles.col}>
                  <FormField
                    label="Jam Selesai (HH:mm)"
                    placeholder="12:00"
                    value={selesaiJadwal}
                    onChangeText={setSelesaiJadwal}
                  />
                </View>
              </View>
              <View style={styles.actionRow}>
                {editJadwalId ? (
                  <AppButton
                    label="Batal"
                    variant="secondary"
                    onPress={resetJadwalForm}
                  />
                ) : null}
                <AppButton
                  label={editJadwalId ? 'Simpan Jadwal' : 'Tambah Jadwal'}
                  onPress={handleSaveJadwal}
                  loading={loading}
                />
              </View>

              <SectionHeader
                title="Daftar Jadwal"
                rightText={`${jadwalList.length} jadwal`}
              />
              {jadwalList.map((j: Jadwal) => {
                const k = state.kelas.find((item) => item.id === j.kelasId);
                return (
                  <View key={j.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>
                        {k?.nama ?? j.kelasId} · {j.topik}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {j.hari}, {j.jamMulai}–{j.jamSelesai} · {j.ruang}
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
                          setRuangJadwal(j.ruang);
                          setTopikJadwal(j.topik);
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnEdit}>Ubah</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          hapusJadwal(j.id).catch(() => {});
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnDelete}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 3. TAB KELAS */}
          {activeTab === 'kelas' && (
            <View style={styles.section}>
              <SectionHeader
                title={editKelasId ? 'Ubah Kelas' : 'Tambah Kelas Praktikum'}
              />
              <FormField
                label="Nama Kelas"
                placeholder="Mis. PPK D"
                value={namaKelas}
                onChangeText={setNamaKelas}
              />
              <View style={styles.actionRow}>
                {editKelasId ? (
                  <AppButton
                    label="Batal"
                    variant="secondary"
                    onPress={resetKelasForm}
                  />
                ) : null}
                <AppButton
                  label={editKelasId ? 'Simpan Kelas' : 'Tambah Kelas'}
                  onPress={handleSaveKelas}
                  loading={loading}
                />
              </View>

              <SectionHeader
                title="Daftar Kelas"
                rightText={`${state.kelas.length} kelas`}
              />
              {state.kelas.map((k: Kelas) => (
                <View key={k.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{k.nama}</Text>
                    <Text style={styles.itemMeta}>
                      ID: {k.id} · {selectTotalPraktikan(state, k.id)} peserta
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      onPress={() => {
                        setEditKelasId(k.id);
                        setNamaKelas(k.nama);
                      }}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnEdit}>Ubah</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapusKelas(k.id).catch(() => {});
                      }}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnDelete}>Hapus</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 4. TAB PESERTA */}
          {activeTab === 'peserta' && (
            <View style={styles.section}>
              <SectionHeader
                title={
                  editPesertaId ? 'Ubah Peserta' : 'Tambah Peserta ke Kelas'
                }
              />
              <FormField
                label="UID Firebase Praktikan (opsional)"
                placeholder="Kosongkan untuk otomatis, atau isi UID Auth"
                value={uidPeserta}
                onChangeText={setUidPeserta}
                editable={!editPesertaId}
              />
              <FormField
                label="Nama Praktikan"
                placeholder="Mis. Andi Wijaya"
                value={namaPeserta}
                onChangeText={setNamaPeserta}
              />
              <FormField
                label="NIM"
                placeholder="Mis. 2310511005"
                value={nimPeserta}
                onChangeText={setNimPeserta}
              />
              <Text style={styles.fieldLabel}>Pilih Kelas</Text>
              {renderKelasSelector(kelasPeserta, setKelasPeserta)}

              <View style={styles.actionRow}>
                {editPesertaId ? (
                  <AppButton
                    label="Batal"
                    variant="secondary"
                    onPress={resetPesertaForm}
                  />
                ) : null}
                <AppButton
                  label={editPesertaId ? 'Simpan Peserta' : 'Tambah Peserta'}
                  onPress={handleSavePeserta}
                  loading={loading}
                />
              </View>

              <SectionHeader
                title="Daftar Peserta"
                rightText={`${pesertaList.length} praktikan`}
              />
              {pesertaList.map((p: Praktikan) => {
                const k = state.kelas.find((item) => item.id === p.kelasId);
                return (
                  <View key={p.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{p.nama}</Text>
                      <Text style={styles.itemMeta}>
                        {p.nim} · {k?.nama ?? p.kelasId} (UID: {p.id})
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
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnEdit}>Ubah</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          hapusPeserta(p.id).catch(() => {});
                        }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnDelete}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {isRemote ? (
            <View style={styles.seedSection}>
              <AppButton
                label="Sinkronisasi / Seed Data Awal ke Firestore"
                variant="ghost"
                loading={loading}
                onPress={() => {
                  seedDataAwal()
                    .then(() =>
                      showSuccess('Data awal berhasil disinkronkan ke Firestore.'),
                    )
                    .catch(() => {});
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
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
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  body: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.neutralSoft,
    padding: 4,
    borderRadius: Radius.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  miniBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniBtnEdit: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  miniBtnDelete: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.danger,
  },
  seedSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
});
