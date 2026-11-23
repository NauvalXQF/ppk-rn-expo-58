import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './leafletVendor.generated.css';
import './leafletMap.css';
import { MapFrame, type MapStatus } from './MapFrame';
import { createLeafletMap } from './leafletMap';
import { isMapPoint, mapLabs, mapLocation, mapUpdates, previewLabs, type MapState } from './mapProtocol';
import type { LaboratoryMapProps, LabPickerMapProps, LabPreviewProps } from './mapTypes';
import type { LaboratoryCoordinates } from '@/types/laboratory';

type WebMapProps = MapState & Pick<LaboratoryMapProps, 'ref' | 'focused'> & {
  preview?: boolean;
  onSelect?: LaboratoryMapProps['onSelect'];
  onLocationPicked?: LabPickerMapProps['onLocationPicked'];
};

function WebMap({ ref, labs, location, selection, picker, onSelect, onLocationPicked, focused, preview = false }: WebMapProps) {
  const picking = picker !== undefined;
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createLeafletMap>>(null);
  const pendingRecenter = useRef<LaboratoryCoordinates>(null);
  const applied = useRef<MapState>(undefined);
  const current = useRef({ labs, location, selection, picker, onSelect, onLocationPicked, focused });
  const [status, setStatus] = useState<MapStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    current.current = { labs, location, selection, picker, onSelect, onLocationPicked, focused };
    if (!focused) pendingRecenter.current = null;
  }, [labs, location, selection, picker, onSelect, onLocationPicked, focused]);

  useImperativeHandle(ref, () => ({
    recenter(point) {
      if (!focused || !isMapPoint(point)) return;
      if (renderer.current) renderer.current.apply({ type: 'recenter', data: point });
      else pendingRecenter.current = point;
    },
  }), [focused]);

  useEffect(() => {
    let disposed = false;
    let map: ReturnType<typeof createLeafletMap> | undefined;
    const resize = () => map?.resize();
    async function start() {
      try {
        const L = await import('leaflet');
        if (disposed || !container.current) return;
        map = createLeafletMap(L, container.current, {
          preview,
          onSelect: (id) => {
            const state = current.current;
            if (!disposed && state.focused && state.labs.some((lab) => lab.id === id)) state.onSelect?.(id);
          },
          onLocationPicked: picking ? (point) => {
            if (!disposed && current.current.focused) current.current.onLocationPicked?.(point);
          } : undefined,
          onTileStatus: (failed) => {
            if (!disposed) setStatus((status) => status === 'failed' ? status : failed ? 'tiles' : 'ready');
          },
        });
        const { labs, location, selection, picker } = current.current;
        const snapshot = { labs, location, selection, picker };
        map.apply({ type: 'snapshot', data: snapshot });
        applied.current = snapshot;
        renderer.current = map;
        if (pendingRecenter.current && current.current.focused) {
          map.apply({ type: 'recenter', data: pendingRecenter.current });
          pendingRecenter.current = null;
        }
        window.addEventListener('resize', resize);
        setStatus('ready');
      } catch {
        if (!disposed) {
          map?.dispose();
          map = undefined;
          renderer.current = null;
          setStatus('failed');
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      renderer.current = null;
      applied.current = undefined;
      map?.dispose();
    };
  }, [attempt, picking, preview]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      const map = renderer.current;
      if (cancelled || !map) return;
      const next = { labs, location, selection, picker };
      try {
        for (const message of mapUpdates(applied.current, next)) map.apply(message);
        applied.current = next;
      } catch {
        map.dispose();
        renderer.current = null;
        setStatus('failed');
      }
    });
    return () => { cancelled = true; };
  }, [labs, location, selection, picker]);

  useEffect(() => {
    if (focused) renderer.current?.resize();
  }, [focused]);

  function retry() {
    if (status === 'tiles' && renderer.current) {
      renderer.current.retryTiles();
      return;
    }
    setStatus('loading');
    setAttempt((previous) => previous + 1);
  }

  return (
    <MapFrame status={status} preview={preview} picker={picking} labs={labs} onSelect={onSelect} onRetry={retry}>
      <div ref={container} className="ppk-leaflet-map"
        aria-label={picking ? 'Peta pemilihan lokasi' : preview ? 'Pratinjau peta' : 'Peta laboratorium'} />
    </MapFrame>
  );
}

export default function LaboratoryMap({
  ref, laboratories, activeLabIds, selectedLabId, userLocation, isAssistant, focused, onSelect,
}: LaboratoryMapProps) {
  const labs = useMemo(() => mapLabs(laboratories, activeLabIds), [laboratories, activeLabIds]);
  const location = useMemo(() => mapLocation(userLocation, isAssistant), [userLocation, isAssistant]);
  return <WebMap ref={ref} labs={labs} location={location} selection={selectedLabId ?? null} focused={focused} onSelect={onSelect} />;
}

export function LabPreview({ point: { latitude, longitude }, radius }: LabPreviewProps) {
  const labs = useMemo(() => previewLabs({ point: { latitude, longitude }, radius }), [latitude, longitude, radius]);
  return <WebMap labs={labs} location={null} selection={null} focused preview />;
}

const EMPTY_LABS: MapState['labs'] = [];

export function LabPickerMap({ center, point, radius, onLocationPicked }: LabPickerMapProps) {
  const picker = useMemo(() => ({ center, point, radius }), [center, point, radius]);
  return <WebMap labs={EMPTY_LABS} location={null} selection={null} focused picker={picker} onLocationPicked={onLocationPicked} />;
}
