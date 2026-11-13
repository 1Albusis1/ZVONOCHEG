import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as opaque from '@serenity-kit/opaque';

const context = new TextEncoder();
const algorithm = 'AES-GCM';

async function wrappingKey(exportKey, salt) {
  const material = await crypto.subtle.importKey(
    'raw', Buffer.from(exportKey, 'base64url'),
    'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: context.encode('zvonocheg/account-vault/v1') },
    material, { name: algorithm, length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

test('a new OPAQUE login unlocks the account vault only with the correct password', async () => {
  await opaque.ready;
  const serverSetup = opaque.server.createSetup();
  const userIdentifier = 'z02-test-account';
  const password = crypto.randomUUID();
  const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup, userIdentifier, registrationRequest,
  });
  const { registrationRecord, exportKey } = opaque.client.finishRegistration({
    clientRegistrationState, registrationResponse, password,
  });

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params = { name: algorithm, iv, additionalData: context.encode(userIdentifier) };
  const accountKey = crypto.getRandomValues(new Uint8Array(32));
  const ciphertext = await crypto.subtle.encrypt(params, await wrappingKey(exportKey, salt), accountKey);

  function login(candidate) {
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password: candidate });
    const { serverLoginState, loginResponse } = opaque.server.startLogin({
      serverSetup, userIdentifier, registrationRecord, startLoginRequest,
    });
    const result = opaque.client.finishLogin({ clientLoginState, loginResponse, password: candidate });
    if (!result) return null;
    const server = opaque.server.finishLogin({
      serverLoginState, finishLoginRequest: result.finishLoginRequest,
    });
    assert.equal(server.sessionKey, result.sessionKey);
    return result;
  }

  assert.equal(login('incorrect-password'), null);
  const recovered = login(password);
  assert.ok(recovered);
  const key = await wrappingKey(recovered.exportKey, salt);
  assert.deepEqual(new Uint8Array(await crypto.subtle.decrypt(params, key, ciphertext)), accountKey);

  const modified = new Uint8Array(ciphertext.slice(0));
  modified[0] ^= 1;
  await assert.rejects(crypto.subtle.decrypt(params, key, modified), { name: 'OperationError' });
});
