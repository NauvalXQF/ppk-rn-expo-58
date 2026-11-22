import type { Circle, Marker } from 'leaflet';
import { TILE_URL, isMapPoint, type MapCommand, type MapState } from './mapProtocol';
import type { LaboratoryCoordinates } from '@/types/laboratory';

type Leaflet = typeof import('leaflet');
type Lab = MapState['labs'][number];

export function createLeafletMap(
  L: Leaflet,
  container: HTMLDivElement,
  options: { preview: boolean; onSelect: (id: string) => void; onTileStatus: (failed: boolean) => void },
) {
  const { preview, onSelect, onTileStatus } = options;
  const map = L.map(container, {
    attributionControl: false,
    zoomControl: !preview,
    dragging: !preview,
    touchZoom: !preview,
    doubleClickZoom: !preview,
    scrollWheelZoom: !preview,
    boxZoom: !preview,
    keyboard: !preview,
  });
  const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, updateWhenIdle: true });
  const layers = new Map<string, { marker: Marker; circle: Circle; lab: Lab }>();
  let selection: string | null = null;
  let user: Marker | undefined;
  let framed = false;
  let centeredOnLocation = false;
  let previewFramePending = false;
  let tileFailed = false;
  let tileLoaded = false;
  let reportedTileFailure = false;
  let disposed = false;

  const resetTileBatch = () => { tileFailed = false; tileLoaded = false; };
  function reportTileFailure(failed: boolean) {
    if (failed === reportedTileFailure) return;
    reportedTileFailure = failed;
    onTileStatus(failed);
  }
  tiles.on('loading', resetTileBatch);
  tiles.on('tileerror', () => { tileFailed = true; });
  tiles.on('tileload', () => { tileLoaded = true; reportTileFailure(false); });
  tiles.on('load', () => reportTileFailure(tileFailed && !tileLoaded));
  // Use a campus-area viewport until a lab or GPS fix is available.
  map.setView([-7.052, 110.44], 14);

  function point({ latitude, longitude }: LaboratoryCoordinates): [number, number] {
    return [latitude, longitude];
  }

  function labIcon(lab: Lab) {
    const badge = container.ownerDocument.createElement('span');
    badge.className = 'ppk-lab-marker';
    badge.classList.toggle('ppk-lab-ongoing', lab.ongoing);
    badge.classList.toggle('ppk-lab-selected', lab.id === selection);
    badge.textContent = lab.kode;
    return L.divIcon({ className: 'ppk-map-icon', html: badge, iconSize: [44, 44], iconAnchor: [22, 38] });
  }

  function labelMarker(marker: Marker, lab: Lab) {
    const element = marker.getElement();
    if (element) {
      const label = lab.ongoing ? `${lab.nama}, sedang berlangsung` : lab.nama;
      element.setAttribute('aria-label', label);
      if (!preview) element.setAttribute('aria-pressed', String(lab.id === selection));
      element.title = label;
    }
  }

  function popup(lab: Lab) {
    const label = container.ownerDocument.createElement('div');
    label.textContent = lab.gedung ? `${lab.nama} · ${lab.gedung}` : lab.nama;
    return label;
  }

  function frameLabs() {
    if ((!preview && framed) || (preview && !previewFramePending) ||
      !container.clientWidth || !container.clientHeight || layers.size === 0) return;
    const bounds = L.latLngBounds([]);
    for (const { circle } of layers.values()) bounds.extend(circle.getBounds());
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
    framed = true;
    previewFramePending = false;
  }

  function setLabs(labs: MapState['labs']) {
    const ids = new Set(labs.map(({ id }) => id));
    for (const [id, layer] of layers) {
      if (ids.has(id)) continue;
      layer.marker.remove();
      layer.circle.remove();
      layers.delete(id);
    }
    for (const lab of labs) {
      const layer = layers.get(lab.id);
      if (layer) {
        const moved = lab.latitude !== layer.lab.latitude || lab.longitude !== layer.lab.longitude;
        if (moved) {
          layer.marker.setLatLng(point(lab));
          layer.circle.setLatLng(point(lab));
        }
        const resized = lab.radiusMeters !== layer.lab.radiusMeters;
        if (resized) layer.circle.setRadius(lab.radiusMeters);
        if (preview && (moved || resized)) previewFramePending = true;
        if (lab.kode !== layer.lab.kode || lab.ongoing !== layer.lab.ongoing) layer.marker.setIcon(labIcon(lab));
        if (!preview && (lab.nama !== layer.lab.nama || lab.gedung !== layer.lab.gedung)) {
          layer.marker.setPopupContent(popup(lab));
        }
        labelMarker(layer.marker, lab);
        layer.lab = lab;
        continue;
      }
      const circle = L.circle(point(lab), {
        radius: lab.radiusMeters, color: '#067647', fillOpacity: 0.15, weight: 1, interactive: false,
      }).addTo(map);
      const marker = L.marker(point(lab), {
        icon: labIcon(lab), interactive: !preview, keyboard: !preview, riseOnHover: !preview,
      }).addTo(map);
      labelMarker(marker, lab);
      if (!preview) {
        marker.bindPopup(popup(lab), { autoPan: false });
        marker.on('click', () => onSelect(lab.id));
      }
      layers.set(lab.id, { circle, marker, lab });
      if (preview) previewFramePending = true;
    }
    frameLabs();
  }

  function setLocation(location: MapState['location']) {
    if (!location) {
      user?.remove();
      user = undefined;
      return;
    }
    const dot = container.ownerDocument.createElement('span');
    dot.className = location.assistant ? 'ppk-user-marker ppk-user-assistant' : 'ppk-user-marker';
    if (location.heading !== null) {
      const arrow = container.ownerDocument.createElement('span');
      arrow.className = 'ppk-user-heading';
      arrow.style.transform = `rotate(${location.heading}deg)`;
      dot.append(arrow);
    }
    const icon = L.divIcon({ className: 'ppk-map-icon', html: dot, iconSize: [24, 24], iconAnchor: [12, 12] });
    if (user) {
      user.setLatLng(point(location));
      user.setIcon(icon);
    } else {
      user = L.marker(point(location), { icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
    }
    user.getElement()?.setAttribute('aria-label', 'Lokasi kamu');
    if (!framed && !centeredOnLocation && layers.size === 0) {
      centeredOnLocation = true;
      map.setView(point(location), 17, { animate: false });
    }
  }

  function setSelection(next: string | null) {
    if (next === selection) return;
    const previous = selection;
    selection = next;
    if (previous) layers.get(previous)?.marker.closePopup();
    for (const id of [previous, next]) {
      const layer = id && layers.get(id);
      if (layer) {
        layer.marker.setIcon(labIcon(layer.lab));
        labelMarker(layer.marker, layer.lab);
      }
    }
  }

  function recenter(next: LaboratoryCoordinates) {
    if (!isMapPoint(next) || preview) return;
    framed = true;
    if (container.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      map.setView(point(next), 17, { animate: false });
    } else {
      map.flyTo(point(next), 17, { duration: 0.35 });
    }
  }

  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    map.invalidateSize({ pan: false, debounceMoveend: true });
    frameLabs();
  }

  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  observer?.observe(container);
  return {
    apply(message: MapCommand) {
      switch (message.type) {
        case 'snapshot':
          setLabs(message.data.labs);
          setSelection(message.data.selection);
          setLocation(message.data.location);
          if (!map.hasLayer(tiles)) tiles.addTo(map);
          break;
        case 'labs':
          setLabs(message.data);
          break;
        case 'location':
          setLocation(message.data);
          break;
        case 'selection':
          setSelection(message.data);
          break;
        case 'recenter':
          recenter(message.data);
          break;
      }
    },
    resize,
    retryTiles: () => tiles.redraw(),
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      tiles.off();
      map.remove();
    },
  };
}
