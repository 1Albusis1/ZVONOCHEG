import { strict as assert } from 'node:assert';
import * as opaque from '@serenity-kit/opaque';

const context = new TextEncoder();
const algorithm = 'AES-GCM';

export async function wrappingKey(exportKey, salt) {
  const material = await crypto.subtle.importKey(
    'raw', Buffer.from(exportKey, 'base64url'),
    'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: context.encode('zvonocheg/account-vault/v1') },
    material, { name: algorithm, length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function registerAccount(userIdentifier, password) {
  await opaque.ready;
  const serverSetup = opaque.server.createSetup();
  const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup, userIdentifier, registrationRequest,
  });
  const { registrationRecord, exportKey } = opaque.client.finishRegistration({
    clientRegistrationState, registrationResponse, password,
  });

  return { serverSetup, registrationRecord, exportKey };
}

export function login({ serverSetup, userIdentifier, registrationRecord }, candidate) {
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
