const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

function loadComponent(path, mocks) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  });
  const jsx = (type, props) => ({ type, props });
  new Function('require', 'exports', outputText)((id) =>
    id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : mocks[id], module.exports);
  return module.exports;
}

test('Praktikan has five bottom tabs including a working Denda button, while other roles keep their menus', () => {
  let role = 'praktikan';
  const Tabs = { Screen: 'Tabs.Screen' };
  const { default: TabsLayout } = loadComponent('src/app/(tabs)/_layout.tsx', {
    react: {},
    'react-native': {
      Platform: { OS: 'web' }, StyleSheet: { create: (styles) => styles },
      Pressable: 'Pressable', Text: 'Text', View: 'View',
    },
    'expo-router': { Tabs },
    'expo-blur': {},
    'expo-haptics': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/components/ui/AppIcon': { AppIcon: 'AppIcon' },
    '@/contexts/AuthContext': { useAuth: () => ({ status: 'masuk', pengguna: { role } }) },
    '@/constants/theme': { Colors: {}, FontFamily: {}, Radius: {}, Shadow: {} },
  });

  function getMenu() {
    const layout = TabsLayout();
    const screens = layout.props.children.map((screen) => screen.props);
    // Expo Router SDK 58 excludes screens with href: null from the visible tab state.
    const visible = screens.filter(({ options }) => options.href !== null);
    const routes = visible.map(({ name }) => ({ key: name, name }));
    const navigated = [];
    const bar = layout.props.tabBar({
      state: { index: 0, routes },
      descriptors: Object.fromEntries(visible.map(({ name, options }) => [name, { options }])),
      emitter: { emit: () => ({ defaultPrevented: false }) },
      navigateToTab: (key) => navigated.push(key),
    });
    const pill = bar.type(bar.props).props.children;
    return { buttons: pill.props.children[1], navigated, screenNames: routes.map(({ name }) => name) };
  }

  const praktikan = getMenu();
  const labels = (menu) => menu.buttons.map((button) => button.props.accessibilityLabel);
  assert.deepEqual(labels(praktikan), ['Jadwal', 'Peta', 'Kehadiran', 'Denda', 'Profil']);
  assert.ok(praktikan.screenNames.includes('izin'), 'Izin remains available as a route');
  praktikan.buttons[3].props.onPress();
  assert.deepEqual(praktikan.navigated, ['denda']);

  role = 'asprak';
  assert.deepEqual(labels(getMenu()), ['Sesi', 'Peta', 'Rekap', 'Izin', 'Profil']);
  role = 'aslab';
  assert.deepEqual(labels(getMenu()), ['Dashboard', 'Kelola Lab', 'Jadwal', 'Peta', 'Profil']);
});

test('Denda opens the existing screen for the signed-in Praktikan and redirects other roles', () => {
  const pengguna = { role: 'praktikan', uid: 'student-a' };
  const { default: DendaRoute } = loadComponent('src/app/(tabs)/denda.tsx', {
    'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => ({}) },
    '@/contexts/AuthContext': { useAuth: () => ({ status: 'masuk', pengguna }) },
    '@/features/payments/PraktikanFinesScreen': { PraktikanFinesScreen: 'PraktikanFinesScreen' },
  });
  assert.equal(DendaRoute().type, 'PraktikanFinesScreen');
  assert.equal(DendaRoute().props.uid, 'student-a');
  assert.equal(DendaRoute().props.initialTab, 'aktif');
  pengguna.role = 'asprak';
  assert.equal(DendaRoute().props.href, '/');
  pengguna.role = 'aslab';
  assert.equal(DendaRoute().props.href, '/');
});

test('Denda shows the empty state or the available fine and opens its checkout', () => {
  const state = [];
  const navigated = [];
  const components = Object.fromEntries(
    ['AppButton', 'AppCard', 'AppText', 'EmptyState', 'FilterChip', 'InfoBanner', 'ScreenContainer']
      .map((name) => ['@/components/ui/' + name, { [name]: name }]),
  );
  const { PraktikanFinesScreen } = loadComponent('src/features/payments/PraktikanFinesScreen.tsx', {
    ...components,
    react: {
      useState: (initial) => [state.length ? state.shift() : initial, () => {}],
      useEffect: () => {},
    },
    'react-native': { View: 'View' },
    'expo-router': { router: { push: (path) => navigated.push(path) } },
    '@/constants/theme': { Colors: {}, Spacing: {} },
    '@/store/app-context': { useApp: () => ({ state: { praktikum: [] } }) },
    '@/services/payments/paymentService': {},
    '@/services/payments/paymentData': loadComponent('src/services/payments/paymentData.ts', {}),
    './paymentPresentation': loadComponent('src/features/payments/paymentPresentation.ts', {}),
  });

  function render(fines) {
    state.push('aktif', fines);
    return PraktikanFinesScreen({ uid: 'student-a', initialTab: 'aktif' });
  }

  function* elements(node) {
    if (Array.isArray(node)) {
      for (const child of node) yield* elements(child);
    } else if (node?.props) {
      yield node;
      yield* elements(node.props.children);
    }
  }

  const empty = [...elements(render([]))];
  assert.ok(empty.some(({ type, props }) => type === 'EmptyState' && props.title === 'Tidak ada tagihan aktif'));
  const available = [...elements(render([{
    id: 'session_student-a', status: 'unpaid', amount: 10000,
  }]))];
  assert.ok(available.some(({ type, props }) => type === 'AppText' && /^Rp\s?10\.000$/.test(props.children)));
  assert.ok(available.some(({ type, props }) => type === 'InfoBanner' && props.message === 'Belum dibayar'));
  const checkout = available.find(({ type, props }) => type === 'AppButton' && props.label === 'Bayar Denda');
  assert.ok(checkout);
  checkout.props.onPress();
  assert.deepEqual(navigated, ['/pembayaran/session_student-a']);
});
