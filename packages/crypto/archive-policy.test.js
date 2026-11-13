import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('archive updates reject stale writers and revoked sessions', () => {
  let archive = { version: 0, ciphertext: 'initial' };
  const sessions = new Set(['first', 'second']);
  function update(session, version, ciphertext) {
    if (!sessions.has(session)) return 403;
    if (version !== archive.version) return 409;
    archive = { version: version + 1, ciphertext };
    return 200;
  }

  assert.equal(update('first', 0, 'committed'), 200);
  assert.equal(update('second', 0, 'stale'), 409);
  sessions.delete('second');
  assert.equal(update('second', 1, 'revoked'), 403);
  assert.deepEqual(archive, { version: 1, ciphertext: 'committed' });
});
