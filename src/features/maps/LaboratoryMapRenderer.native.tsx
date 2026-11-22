import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { LaboratoryCoordinates } from '@/types/laboratory';
import html from './leafletHtml.generated';
import { MapFrame, type MapStatus } from './MapFrame';
import {
  encodeMapMessage, isMapPoint, mapLabs, mapLocation, mapUpdates, previewLabs, readMapEvent,
  type MapCommand, type MapState,
} from './mapProtocol';
import type { LaboratoryMapProps, LabPreviewProps } from './mapTypes';

const START_TIMEOUT = 12000;
// Inline HTML requires the wildcard. The navigation callback explicitly denies other documents.
const INLINE_HTML_ORIGINS = ['*'];
let instanceCount = 0;

type NativeMapProps = MapState & Pick<LaboratoryMapProps, 'ref' | 'focused'> & {
  preview?: boolean;
  onSelect?: LaboratoryMapProps['onSelect'];
};

function NativeMap(props: NativeMapProps) {
  const [attempt, setAttempt] = useState(0);
  return <MapDocument key={attempt} {...props} onRetry={() => setAttempt((previous) => previous + 1)} />;
}

function MapDocument({
  ref, labs, location, selection, onSelect, focused, preview = false, onRetry,
}: NativeMapProps & { onRetry: () => void }) {
  const [document] = useState(() => {
    const instance = String(++instanceCount);
    return {
      instance,
      source: { html: html.replace('PPK_MAP_INSTANCE', instance).replace('PPK_MAP_PREVIEW', String(preview)) },
    };
  });
  const [status, setStatus] = useState<MapStatus>('loading');
  const [ready, setReady] = useState(false);
  // The package defaults its additional props to undefined, which narrows JSX props to never.
  const webView = useRef<WebView<unknown>>(null);
  const alive = useRef(false);
  const failed = useRef(false);
  const incoming = useRef(0);
  const outgoing = useRef(0);
  const previous = useRef<MapState>(undefined);
  const pendingRecenter = useRef<LaboratoryCoordinates>(null);

  const fail = useCallback(() => {
    if (!alive.current) return;
    failed.current = true;
    pendingRecenter.current = null;
    setStatus('failed');
  }, []);

  const send = useCallback((command: MapCommand) => {
    if (!alive.current || failed.current || !webView.current) return;
    const encoded = encodeMapMessage(command, document.instance, ++outgoing.current);
    if (encoded) webView.current.postMessage(encoded);
    else fail();
  }, [document.instance, fail]);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pendingRecenter.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(fail, START_TIMEOUT);
    return () => clearTimeout(timer);
  }, [ready, fail]);

  useEffect(() => {
    if (!focused) pendingRecenter.current = null;
    if (!ready || failed.current) return;
    const latest = { labs, location, selection };
    for (const command of mapUpdates(previous.current, latest)) send(command);
    previous.current = latest;
    if (pendingRecenter.current) {
      send({ type: 'recenter', data: pendingRecenter.current });
      pendingRecenter.current = null;
    }
  }, [ready, focused, labs, location, selection, send]);

  useImperativeHandle(ref, () => ({
    recenter(point) {
      if (!focused || !isMapPoint(point) || failed.current) return;
      const data = { latitude: point.latitude, longitude: point.longitude };
      if (ready) send({ type: 'recenter', data });
      else pendingRecenter.current = data;
    },
  }), [focused, ready, send]);

  function receive(event: WebViewMessageEvent) {
    if (!alive.current || failed.current) return;
    const message = readMapEvent(event.nativeEvent.data, document.instance, incoming.current);
    if (!message) return;
    incoming.current = message.sequence;
    switch (message.type) {
      case 'ready':
        setReady(true);
        setStatus('ready');
        break;
      case 'labSelected':
        if (ready && focused && labs.some(({ id }) => id === message.id)) onSelect?.(message.id);
        break;
      case 'mapError':
        if (message.code === 'renderer') fail();
        else setStatus('tiles');
        break;
    }
  }

  return (
    <MapFrame status={status} preview={preview} labs={labs} onSelect={onSelect} onRetry={onRetry}>
      {status === 'failed' ? null : (
        <WebView<unknown>
          ref={webView}
          source={document.source}
          style={styles.map}
          originWhitelist={INLINE_HTML_ORIGINS}
          onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
          onMessage={receive}
          onError={fail}
          onHttpError={({ nativeEvent }) => { if (nativeEvent.url === 'about:blank') fail(); }}
          onContentProcessDidTerminate={fail}
          onRenderProcessGone={fail}
          applicationNameForUserAgent="PPKRNExpo58/1.0"
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          thirdPartyCookiesEnabled={false}
          scrollEnabled={false}
          overScrollMode="never"
        />
      )}
    </MapFrame>
  );
}

export default function LaboratoryMap({
  ref, laboratories, activeLabIds, selectedLabId, userLocation, isAssistant, focused, onSelect,
}: LaboratoryMapProps) {
  const labs = useMemo(() => mapLabs(laboratories, activeLabIds), [laboratories, activeLabIds]);
  const location = useMemo(() => mapLocation(userLocation, isAssistant), [userLocation, isAssistant]);
  return <NativeMap ref={ref} labs={labs} location={location} selection={selectedLabId ?? null} focused={focused} onSelect={onSelect} />;
}

export function LabPreview({ point: { latitude, longitude }, radius }: LabPreviewProps) {
  const labs = useMemo(() => previewLabs({ point: { latitude, longitude }, radius }), [latitude, longitude, radius]);
  return <NativeMap labs={labs} location={null} selection={null} focused preview />;
}

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: 'transparent' } });
