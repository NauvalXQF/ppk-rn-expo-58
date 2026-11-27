import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvalidEnvironmentError, parseEnv } from '../src/config/env.ts';

const firebaseProjectId = 'fixture-project';

test('defaults to loopback port 3000 and accepts ADC without a credential path', () => {
  assert.deepEqual(parseEnv({ FIREBASE_PROJECT_ID: firebaseProjectId }), {
    nodeEnv: 'development', host: '127.0.0.1', port: 3000, firebaseProjectId, allowCreate: false, corsAllowedOrigins: [],
  });
});

test('accepts a LAN bind override and an explicit Sandbox configuration', () => {
  assert.deepEqual(parseEnv({
    FIREBASE_PROJECT_ID: firebaseProjectId,
    GOOGLE_APPLICATION_CREDENTIALS: 'external-test-fixture.json',
    MIDTRANS_IS_PRODUCTION: 'false',
    HOST: '0.0.0.0',
    PORT: '3100',
    PROVISIONING_ALLOW_CREATE: 'true',
    CORS_ALLOWED_ORIGINS: 'http://localhost:8081, https://web.example.test',
  }), { nodeEnv: 'development', host: '0.0.0.0', port: 3100, firebaseProjectId,
    allowCreate: true, corsAllowedOrigins: ['http://localhost:8081', 'https://web.example.test'] });
});

test('rejects Production and unexpected Midtrans mode values', () => {
  for (const mode of ['true', '1', 'TRUE', 'production', '']) {
    assert.throws(
      () => parseEnv({ FIREBASE_PROJECT_ID: firebaseProjectId, MIDTRANS_IS_PRODUCTION: mode }),
      { name: 'Error', message: 'Invalid or missing backend environment variable: MIDTRANS_IS_PRODUCTION' },
    );
  }
});

test('reports invalid variable names without echoing their values', () => {
  for (const [variable, value] of [
    ['NODE_ENV', 'unexpected-fixture-value'], ['HOST', 'bad host'],
    ['PORT', '65536'], ['PORT', '3e3'], ['FIREBASE_PROJECT_ID', ''],
    ['PROVISIONING_ALLOW_CREATE', 'yes'], ['CORS_ALLOWED_ORIGINS', '*'],
    ['CORS_ALLOWED_ORIGINS', 'https://web.example.test/path'],
  ]) {
    assert.throws(
      () => parseEnv({ FIREBASE_PROJECT_ID: firebaseProjectId, [variable]: value }),
      (error) => error instanceof InvalidEnvironmentError
        && error.message === 'Invalid or missing backend environment variable: ' + variable,
    );
  }
});
