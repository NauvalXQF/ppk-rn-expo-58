import { isIP } from 'node:net';

export class InvalidEnvironmentError extends Error {
  constructor(variable: string) {
    super('Invalid or missing backend environment variable: ' + variable);
  }
}

export function parseEnv(env: NodeJS.ProcessEnv) {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new InvalidEnvironmentError('NODE_ENV');
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  if (!isIP(host)) {
    throw new InvalidEnvironmentError('HOST');
  }

  const portValue = env.PORT?.trim() || '3000';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidEnvironmentError('PORT');
  }

  const firebaseProjectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!firebaseProjectId || /\s/.test(firebaseProjectId)) {
    throw new InvalidEnvironmentError('FIREBASE_PROJECT_ID');
  }

  if (env.MIDTRANS_IS_PRODUCTION !== undefined && env.MIDTRANS_IS_PRODUCTION.trim() !== 'false') {
    throw new InvalidEnvironmentError('MIDTRANS_IS_PRODUCTION');
  }

  return { nodeEnv, host, port, firebaseProjectId };
}
