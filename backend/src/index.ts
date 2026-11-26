import { createApp } from './app.ts';
import { InvalidEnvironmentError, parseEnv } from './config/env.ts';
import { initializeFirebaseAdmin } from './config/firebaseAdmin.ts';
import { firebaseProvisioningStore, registerProvisioning } from './provisioning.ts';
import { registerPayments } from './payments.ts';
import { sandboxGateway } from './midtrans.ts';
import { expoTransport, notificationWorker } from './notificationWorker.ts';

function start() {
  const { host, port, firebaseProjectId } = parseEnv(process.env);
  const firebase = initializeFirebaseAdmin(firebaseProjectId);
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const signatureSecret = process.env.MIDTRANS_SIGNATURE_SECRET_KEY?.trim();
  const worker = process.env.PAYMENT_NOTIFICATION_WORKER === 'true'
    ? notificationWorker(firebase.firestore, expoTransport(fetch, process.env.EXPO_PUSH_ACCESS_TOKEN?.trim())) : undefined;
  const server = createApp((api) => {
    registerProvisioning(api, firebase.identity, firebaseProvisioningStore(firebase.auth, firebase.firestore));
    registerPayments(api, firebase.identity, firebase.firestore, serverKey ? sandboxGateway(serverKey) : undefined, signatureSecret);
  }).listen(port, host, () => {
    console.info('Backend HTTP listening on %s port %d.', host, port);
    worker?.start();
  });

  server.once('error', () => {
    console.error('Backend HTTP server failed. Check the bind address and port.');
    process.exitCode = 1;
    void firebase.close().catch(() => console.error('Firebase Admin cleanup failed.'));
  });

  function shutdown() {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    const deadline = setTimeout(() => {
      console.error('Backend shutdown timed out.');
      server.closeAllConnections();
      process.exit(1);
    }, 10_000);
    deadline.unref();

    server.close(async (error) => {
      try {
        await worker?.stop();
        await firebase.close();
      } catch {
        console.error('Firebase Admin cleanup failed.');
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
      if (error) process.exitCode = 1;
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  start();
} catch (error) {
  console.error(error instanceof InvalidEnvironmentError ? error.message : 'Backend startup failed.');
  process.exitCode = 1;
}
