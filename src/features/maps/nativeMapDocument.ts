import { createLeafletMap } from './leafletMap';
import { encodeMapMessage, readMapCommand, type MapEvent } from './mapProtocol';

type MapWindow = Window & {
  L: typeof import('leaflet');
  ReactNativeWebView: { postMessage: (message: string) => void };
};

export function startNativeMap(browser: MapWindow, container: HTMLDivElement) {
  const document = container.ownerDocument;
  const instance = container.dataset.instance ?? '';
  const preview = container.dataset.preview === 'true';
  let incoming = 0;
  let outgoing = 0;
  let tilesFailed = false;
  function post(message: MapEvent) {
    const encoded = encodeMapMessage(message, instance, ++outgoing);
    if (encoded) browser.ReactNativeWebView.postMessage(encoded);
  }

  try {
    const map = createLeafletMap(browser.L, container, {
      preview,
      onSelect: (id) => post({ type: 'labSelected', id }),
      onTileStatus: (failed) => {
        if (failed === tilesFailed) return;
        tilesFailed = failed;
        post(failed ? { type: 'mapError', code: 'tiles' } : { type: 'ready' });
      },
    });
    const receive = (event: Event) => {
      if (!('data' in event)) return;
      const message = readMapCommand(event.data, instance, incoming);
      if (!message) return;
      incoming = message.sequence;
      try {
        map.apply(message);
      } catch {
        post({ type: 'mapError', code: 'renderer' });
      }
    };

    // Android dispatches on document. iOS dispatches on window.
    document.addEventListener('message', receive);
    browser.addEventListener('message', receive);
    browser.addEventListener('pagehide', () => {
      document.removeEventListener('message', receive);
      browser.removeEventListener('message', receive);
      map.dispose();
    }, { once: true });
    post({ type: 'ready' });
  } catch {
    post({ type: 'mapError', code: 'renderer' });
  }
}
