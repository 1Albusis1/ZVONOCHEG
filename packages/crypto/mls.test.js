import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { verifyRecovery } from './recovery-probe.js';

test('restores read and offline history after a fresh login', () => verifyRecovery(assert));
