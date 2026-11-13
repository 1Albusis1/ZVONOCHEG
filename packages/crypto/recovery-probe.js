import {
  createApplicationMessage, createCommit, createGroup, defaultCapabilities,
  decodeGroupState, defaultLifetime, emptyPskIndex, encodeGroupState, generateKeyPackage, getCiphersuiteFromName,
  getCiphersuiteImpl, joinGroup, processPrivateMessage, zeroOutUint8Array,
} from 'ts-mls';

import { login, registerAccount, wrappingKey } from './opaque-fixture.js';

const encoder = new TextEncoder();

function verifyDevice(assert, keyPackage, expectedId, trustedSignatureKey) {
  const { credential, signaturePublicKey } = keyPackage.leafNode;
  assert.equal(credential.credentialType, 'basic');
  assert.deepEqual(credential.identity, encoder.encode(expectedId));
  assert.deepEqual(signaturePublicKey, trustedSignatureKey, 'Изменился ключ устройства');
}

export async function verifyRecovery(assert) {
  const suite = getCiphersuiteFromName('MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519');
  const impl = await getCiphersuiteImpl(suite);
  const device = (id) => generateKeyPackage(
    { credentialType: 'basic', identity: encoder.encode(id) },
    defaultCapabilities(), defaultLifetime, [], impl,
  );
  const alice = await device('alice-device');
  const bob = await device('bob-device');
  const trustedKey = bob.publicPackage.leafNode.signaturePublicKey.slice();
  const replacement = await device('bob-device');

  assert.throws(
    () => verifyDevice(assert, replacement.publicPackage, 'bob-device', trustedKey),
    /Изменился ключ устройства/,
  );
  verifyDevice(assert, bob.publicPackage, 'bob-device', trustedKey);

  const initialGroup = await createGroup(
    crypto.getRandomValues(new Uint8Array(32)), alice.publicPackage, alice.privatePackage, [], impl,
  );
  const commit = await createCommit({ state: initialGroup, cipherSuite: impl }, {
    extraProposals: [{ proposalType: 'add', add: { keyPackage: bob.publicPackage } }],
  });
  commit.consumed.forEach(zeroOutUint8Array);
  const bobGroup = await joinGroup(
    commit.welcome, bob.publicPackage, bob.privatePackage, emptyPskIndex,
    impl, commit.newState.ratchetTree,
  );
  const first = await createApplicationMessage(commit.newState, encoder.encode('first'), impl);
  first.consumed.forEach(zeroOutUint8Array);
  const read = await processPrivateMessage(bobGroup, first.privateMessage, emptyPskIndex, impl);
  read.consumed.forEach(zeroOutUint8Array);

  const accountId = 'bob';
  const password = crypto.randomUUID();
  const { exportKey, ...serverAccount } = await registerAccount(accountId, password);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params = { name: 'AES-GCM', iv, additionalData: encoder.encode(accountId) };
  const checkpoint = JSON.stringify({
    state: Array.from(encodeGroupState(read.newState)),
    history: [new TextDecoder().decode(read.message)],
  });
  const archive = await crypto.subtle.encrypt(
    params, await wrappingKey(exportKey, salt), encoder.encode(checkpoint),
  );

  // Bob is offline while Alice sends the next message.
  const second = await createApplicationMessage(first.newState, encoder.encode('second'), impl);
  second.consumed.forEach(zeroOutUint8Array);

  const freshLogin = login({ ...serverAccount, userIdentifier: accountId }, password);
  assert.ok(freshLogin);
  const restored = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(
    params, await wrappingKey(freshLogin.exportKey, salt), archive,
  )));
  assert.deepEqual(restored.history, ['first']);
  const restoredBytes = Uint8Array.from(restored.state);
  const decoded = decodeGroupState(restoredBytes, 0);
  assert.ok(decoded);
  assert.equal(decoded[1], restoredBytes.length);
  const restoredGroup = { ...decoded[0], clientConfig: initialGroup.clientConfig };
  const secondReceived = await processPrivateMessage(
    restoredGroup, second.privateMessage, emptyPskIndex, impl,
  );
  secondReceived.consumed.forEach(zeroOutUint8Array);
  assert.deepEqual(secondReceived.message, encoder.encode('second'));
  const removal = await createCommit({ state: second.newState, cipherSuite: impl }, {
    extraProposals: [{ proposalType: 'remove', remove: { removed: 1 } }],
  });
  removal.consumed.forEach(zeroOutUint8Array);
  const future = await createApplicationMessage(removal.newState, encoder.encode('after removal'), impl);
  future.consumed.forEach(zeroOutUint8Array);
  let decryptedAfterRemoval = false;
  try {
    const result = await processPrivateMessage(secondReceived.newState, future.privateMessage, emptyPskIndex, impl);
    decryptedAfterRemoval = result.kind !== 'newState';
  } catch {
    // The revoked device has no secrets for the new epoch.
  }
  assert.equal(decryptedAfterRemoval, false);
}
