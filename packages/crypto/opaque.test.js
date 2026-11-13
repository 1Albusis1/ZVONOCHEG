import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { login, registerAccount, wrappingKey } from './opaque-fixture.js';

const context = new TextEncoder();
const algorithm = 'AES-GCM';

test('a new OPAQUE login unlocks the account vault only with the correct password', async () => {
  const userIdentifier = 'z02-test-account';
  const password = crypto.randomUUID();
  const { exportKey, ...server } = await registerAccount(userIdentifier, password);
  const account = { ...server, userIdentifier };

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params = { name: algorithm, iv, additionalData: context.encode(userIdentifier) };
  const accountKey = crypto.getRandomValues(new Uint8Array(32));
  const ciphertext = await crypto.subtle.encrypt(params, await wrappingKey(exportKey, salt), accountKey);

  assert.equal(login(account, 'incorrect-password'), null);
  const recovered = login(account, password);
  assert.ok(recovered);
  const key = await wrappingKey(recovered.exportKey, salt);
  assert.deepEqual(new Uint8Array(await crypto.subtle.decrypt(params, key, ciphertext)), accountKey);

  const modified = new Uint8Array(ciphertext.slice(0));
  modified[0] ^= 1;
  await assert.rejects(crypto.subtle.decrypt(params, key, modified), { name: 'OperationError' });
});
