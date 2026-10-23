import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MSG, isFromExtension } from '../../src/shared/messages.js';

describe('MSG', () => {
  test('has exactly the messages the e2e tests send', () => {
    // test/e2e/support/contract.js hardcodes these values.
    assert.deepEqual({ ...MSG }, {
      TEARDOWN: 'key-overlay:teardown',
      ENTER_MOVE_MODE: 'key-overlay:enter-move-mode',
      EXIT_MOVE_MODE: 'key-overlay:exit-move-mode',
      FRAME_KEY: 'key-overlay:frame-key',
      FRAME_CLICK: 'key-overlay:frame-click',
      SET_TAB_ENABLED: 'key-overlay:set-tab-enabled',
    });
  });

  test('values are unique and namespaced', () => {
    const values = Object.values(MSG);
    assert.equal(new Set(values).size, values.length);
    for (const v of values) assert.match(v, /^key-overlay:/);
  });

  test('is frozen', () => {
    assert.equal(Object.isFrozen(MSG), true);
  });
});

describe('isFromExtension', () => {
  const id = 'abcdefghijklmnopabcdefghijklmnop';

  test('accepts messages from this extension', () => {
    assert.equal(isFromExtension({ id }, id), true);
    assert.equal(isFromExtension({ id, tab: { id: 3 }, frameId: 2 }, id), true);
  });

  test('rejects other extensions and missing senders', () => {
    assert.equal(isFromExtension({ id: 'someoneelse' }, id), false);
    assert.equal(isFromExtension({}, id), false);
    assert.equal(isFromExtension(undefined, id), false);
    assert.equal(isFromExtension({ id: undefined }, undefined), false);
  });
});
