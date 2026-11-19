import { memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { SymbolView } from 'expo-symbols';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Laboratory, LaboratoryCoordinates } from '@/types/laboratory';
import type { LaboratoryMapProps, LabPreviewProps } from './LaboratoryMap';
import { SIMULATED_CAMPUS_CENTER } from './simulatedLaboratories';

const circleStyle = {
  fillColor: 'rgba(6, 118, 71, 0.15)',
  strokeColor: Colors.success,
  strokeWidth: 1,
};

function regionAround(point: LaboratoryCoordinates, delta: number) {
  return {
    latitude: point.latitude, longitude: point.longitude,
    latitudeDelta: delta, longitudeDelta: delta,
  };
}

const LabMarker = memo(function LabMarker({ lab, ongoing, onSelect }: {
  lab: Laboratory;
  ongoing: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <Circle center={lab} radius={lab.radiusMeters} {...circleStyle} />
      <Marker
        coordinate={lab}
        anchor={{ x: 0.5, y: 1 }}
        accessibilityLabel={lab.nama}
        title={lab.nama}
        description={lab.gedung || undefined}
        stopPropagation
        onPress={() => onSelect(lab.id)}
      >
        <View style={[styles.pin, ongoing && styles.ongoingPin]}>
          <SymbolView name={{ ios: 'desktopcomputer', android: 'computer' }} tintColor={Colors.surface} size={14} />
          <Text style={styles.pinText}>{lab.kode}</Text>
        </View>
      </Marker>
    </>
  );
});

export default function LaboratoryMap({
  ref, laboratories, activeLabIds, userLocation, isAssistant, allowSimulation, onSelect,
}: LaboratoryMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const centered = useRef(false);
  const firstPoint = laboratories[0] ?? (allowSimulation ? SIMULATED_CAMPUS_CENTER : userLocation);

  useImperativeHandle(ref, () => ({
    recenter: (point) => map.current?.animateToRegion(regionAround(point, 0.004), 350),
  }), []);

  useEffect(() => {
    if (!ready || !laidOut || centered.current || laboratories.length === 0) return;
    centered.current = true;
    if (laboratories.length === 1) {
      map.current?.animateToRegion(regionAround(laboratories[0], 0.004), 350);
    } else {
      map.current?.fitToCoordinates([...laboratories], {
        edgePadding: { top: 100, right: 64, bottom: 100, left: 64 },
        animated: true,
      });
    }
  }, [ready, laidOut, laboratories]);

  if (!firstPoint && !ready) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.message}>Peta akan tampil saat koordinat lab atau lokasi kamu tersedia.</Text>
      </View>
    );
  }

  const heading = userLocation?.heading;
  const hasHeading = heading != null && Number.isFinite(heading) && heading >= 0;
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={firstPoint ? regionAround(firstPoint, 0.006) : undefined}
      onMapReady={() => setReady(true)}
      onLayout={() => setLaidOut(true)}
      toolbarEnabled={false}
      showsMyLocationButton={false}
    >
      {laboratories.map((lab) => (
        <LabMarker key={lab.id} lab={lab} ongoing={activeLabIds.has(lab.id)} onSelect={onSelect} />
      ))}
      {userLocation ? (
        <Marker
          coordinate={userLocation}
          title="Lokasi kamu"
          anchor={{ x: 0.5, y: 0.5 }}
          flat
          rotation={hasHeading ? heading : 0}
          zIndex={2}
        >
          <View style={[styles.userHalo, isAssistant && styles.assistantHalo]}>
            <View style={[styles.userDot, isAssistant && styles.assistantDot]}>
              {hasHeading ? <Text style={styles.heading}>▲</Text> : null}
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

export function LabPreview({ point, radius }: LabPreviewProps) {
  const delta = Math.max(0.003, (radius / 111000) * 3.5);
  return (
    <MapView
      style={styles.preview}
      region={regionAround(point, delta)}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      <Marker coordinate={point} />
      <Circle center={point} radius={radius} {...circleStyle} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  message: { color: Colors.textMuted, textAlign: 'center' },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.textMuted,
    borderColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  ongoingPin: { backgroundColor: Colors.success },
  pinText: { color: Colors.surface, fontSize: 11, fontWeight: '700' },
  userHalo: { padding: 4, borderRadius: Radius.pill, backgroundColor: Colors.primarySoft },
  assistantHalo: { backgroundColor: Colors.successSoft },
  userDot: {
    width: 20, height: 20, borderRadius: Radius.pill, borderColor: Colors.surface, borderWidth: 2,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  assistantDot: { backgroundColor: Colors.success },
  heading: { color: Colors.surface, fontSize: 9 },
  preview: { height: 160, borderRadius: Radius.md },
});
