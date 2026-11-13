import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createApplicationMessage, createCommit, createGroup, defaultCapabilities,
  defaultLifetime, emptyPskIndex, generateKeyPackage, getCiphersuiteFromName,
  getCiphersuiteImpl, joinGroup, processPrivateMessage, zeroOutUint8Array,
} from 'ts-mls';

const encoder = new TextEncoder();

function verifyDevice(keyPackage, expectedId, trustedSignatureKey) {
  const { credential, signaturePublicKey } = keyPackage.leafNode;
  assert.equal(credential.credentialType, 'basic');
  assert.deepEqual(credential.identity, encoder.encode(expectedId));
  assert.deepEqual(signaturePublicKey, trustedSignatureKey, 'Изменился ключ устройства');
}

test('MLS delivers group messages and detects replacement of an independently verified device key', async () => {
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
    () => verifyDevice(replacement.publicPackage, 'bob-device', trustedKey),
    /Изменился ключ устройства/,
  );
  verifyDevice(bob.publicPackage, 'bob-device', trustedKey);

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
  const plaintext = encoder.encode('Проверка группового сообщения');
  const outgoing = await createApplicationMessage(commit.newState, plaintext, impl);
  outgoing.consumed.forEach(zeroOutUint8Array);
  const incoming = await processPrivateMessage(
    bobGroup, outgoing.privateMessage, emptyPskIndex, impl,
  );
  incoming.consumed.forEach(zeroOutUint8Array);
  assert.deepEqual(incoming.message, plaintext);
});
