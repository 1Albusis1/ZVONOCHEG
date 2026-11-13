import { verifyRecovery } from '../recovery-probe.js';

const assert = {
  equal(actual, expected) {
    if (actual !== expected) throw new Error('Values differ');
  },
  deepEqual(actual, expected, message = 'Values differ') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
  },
  ok(value) {
    if (!value) throw new Error('Missing expected value');
  },
  throws(action, expected) {
    try {
      action();
    } catch (error) {
      if (expected.test(error.message)) return;
      throw error;
    }
    throw new Error('Expected an error');
  },
};

const result = document.querySelector('#result');
try {
  await verifyRecovery(assert);
  result.dataset.status = 'passed';
  result.textContent = 'Восстановление истории прошло';
} catch (error) {
  result.dataset.status = 'failed';
  result.textContent = error.message;
}
