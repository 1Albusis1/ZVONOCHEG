import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { login, registerAccount, wrappingKey } from './opaque-fixture.js';

test('password change rewraps the vault under the new OPAQUE export key', async () => {
  const userIdentifier = 'rotation-test';
  const oldPassword = crypto.randomUUID();
  const newPassword = crypto.randomUUID();
  const oldRegistration = await registerAccount(userIdentifier, oldPassword);
  const oldAccount = { ...oldRegistration, userIdentifier };
  const newRegistration = await registerAccount(userIdentifier, newPassword, oldAccount.serverSetup);
  const { exportKey: newExportKey, ...serverAccount } = newRegistration;
  const newAccount = { ...serverAccount, userIdentifier };
  const secret = crypto.getRandomValues(new Uint8Array(32));

  async function seal(exportKey, bytes) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const params = { name: 'AES-GCM', iv };
    const ciphertext = await crypto.subtle.encrypt(params, await wrappingKey(exportKey, salt), bytes);
    return { salt, params, ciphertext };
  }

  async function open(exportKey, { salt, params, ciphertext }) {
    return new Uint8Array(await crypto.subtle.decrypt(params, await wrappingKey(exportKey, salt), ciphertext));
  }

  const original = await seal(oldRegistration.exportKey, secret);
  const oldLogin = login(oldAccount, oldPassword);
  assert.ok(oldLogin);
  const rewrapped = await seal(newExportKey, await open(oldLogin.exportKey, original));
  assert.equal(login(newAccount, oldPassword), null);
  const snapshot = {
    account: newAccount,
    salt: Array.from(rewrapped.salt),
    iv: Array.from(rewrapped.params.iv),
    ciphertext: Array.from(new Uint8Array(rewrapped.ciphertext)),
  };
  const persisted = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(Object.keys(persisted.account).sort(), [
    'registrationRecord', 'serverSetup', 'userIdentifier',
  ]);
  await assert.rejects(open(crypto.randomUUID().replaceAll('-', ''), rewrapped), {
    name: 'OperationError',
  });
  const newLogin = login(persisted.account, newPassword);
  assert.ok(newLogin);
  assert.deepEqual(await open(newLogin.exportKey, rewrapped), secret);
  await assert.rejects(open(oldLogin.exportKey, rewrapped), { name: 'OperationError' });
});
