import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatKey, formatComposition, createKeyTracker, createMaskPolicy, MASK_CHAR } from '../../src/content/keys.js';
import { key, input, element } from './helpers.js';

const grouped = { groupCombos: true };
const ungrouped = { groupCombos: false };

describe('formatKey: plain keys', () => {
  test('letters show uppercase', () => {
    assert.equal(formatKey(key('a'), grouped), 'A');
    assert.equal(formatKey(key('Z', { shiftKey: true }), grouped), 'Z');
  });

  test('digits and punctuation show as typed', () => {
    assert.equal(formatKey(key('7'), grouped), '7');
    assert.equal(formatKey(key('@', { shiftKey: true, code: 'Digit2' }), grouped), '@');
    assert.equal(formatKey(key('.', { code: 'Period' }), grouped), '.');
  });

  test('space shows as a word', () => {
    assert.equal(formatKey(key(' ', { code: 'Space' }), grouped), 'Space');
  });

  const symbols = {
    Enter: '↵',
    Backspace: '⌫',
    Delete: '⌦',
    Tab: '⇥',
    Escape: 'Esc',
    CapsLock: '⇪',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Shift: '⇧',
    Meta: '⌘',
    Control: '⌃',
    Alt: '⌥',
  };
  for (const [k, label] of Object.entries(symbols)) {
    test(`${k} shows as ${label}`, () => {
      const mods = { Shift: 'shiftKey', Meta: 'metaKey', Control: 'ctrlKey', Alt: 'altKey' };
      const ev = key(k, mods[k] ? { [mods[k]]: true } : {});
      assert.equal(formatKey(ev, grouped), label);
    });
  }

  test('other named keys show their name', () => {
    assert.equal(formatKey(key('F5'), grouped), 'F5');
    assert.equal(formatKey(key('Home'), grouped), 'Home');
  });
});

describe('formatKey: combos', () => {
  test('meta+letter is one keycap when grouping', () => {
    assert.equal(formatKey(key('k', { metaKey: true }), grouped), '⌘+K');
  });

  test('modifiers are listed in macOS order ⌃⌥⇧⌘', () => {
    const ev = key('k', { metaKey: true, ctrlKey: true, altKey: true, shiftKey: true, code: 'KeyK' });
    assert.equal(formatKey(ev, grouped), '⌃⌥⇧⌘+K');
  });

  test('shift alone with a printable key is just the typed character', () => {
    assert.equal(formatKey(key('A', { shiftKey: true }), grouped), 'A');
    assert.equal(formatKey(key('?', { shiftKey: true, code: 'Slash' }), grouped), '?');
  });

  test('shift with a named key is a combo', () => {
    assert.equal(formatKey(key('Tab', { shiftKey: true }), grouped), '⇧+⇥');
  });

  test('alt uses the physical key, not the special character it produced', () => {
    assert.equal(formatKey(key('å', { altKey: true, code: 'KeyA' }), grouped), '⌥+A');
    assert.equal(formatKey(key('™', { altKey: true, code: 'Digit2' }), grouped), '⌥+2');
  });

  test('without grouping, only the key itself is shown', () => {
    assert.equal(formatKey(key('k', { metaKey: true }), ungrouped), 'K');
    assert.equal(formatKey(key('å', { altKey: true, code: 'KeyA' }), ungrouped), 'A');
  });

  test('a modifier pressed while another is held shows only itself', () => {
    assert.equal(formatKey(key('Shift', { shiftKey: true, metaKey: true }), grouped), '⇧');
  });
});

describe('formatKey: events that show nothing', () => {
  test('untrusted (page-generated) events', () => {
    assert.equal(formatKey(key('a', { isTrusted: false }), grouped), null);
  });

  test('auto-repeat from a held key', () => {
    assert.equal(formatKey(key('a', { repeat: true }), grouped), null);
  });

  test('IME composition in progress', () => {
    assert.equal(formatKey(key('a', { isComposing: true }), grouped), null);
    assert.equal(formatKey(key('Process'), grouped), null);
  });

  test('dead keys (the accent shows with the next key)', () => {
    assert.equal(formatKey(key('Dead', { code: 'Quote' }), grouped), null);
  });

  test('Unidentified keys', () => {
    assert.equal(formatKey(key('Unidentified'), grouped), null);
  });
});

describe('formatKey: other layouts', () => {
  test('AZERTY: the label follows the character typed, not the US key position', () => {
    assert.equal(formatKey(key('a', { code: 'KeyQ' }), grouped), 'A');
    assert.equal(formatKey(key('&', { code: 'Digit1' }), grouped), '&');
  });

  test('accented characters produced by a dead key', () => {
    assert.equal(formatKey(key('é', { code: 'KeyE' }), grouped), 'É');
  });
});

describe('createKeyTracker: when modifiers show', () => {
  const up = (k, opts) => ({ ...key(k, opts), type: 'keyup' });

  test('grouped: a modifier used in a combo never shows on its own', () => {
    const t = createKeyTracker(grouped);
    assert.equal(t.down(key('Meta', { metaKey: true })), null);
    assert.equal(t.down(key('k', { metaKey: true })), '⌘+K');
    assert.equal(t.up(up('k', { metaKey: true })), null);
    assert.equal(t.up(up('Meta')), null);
  });

  test('grouped: a modifier pressed and released alone shows on release', () => {
    const t = createKeyTracker(grouped);
    assert.equal(t.down(key('Shift', { shiftKey: true })), null);
    assert.equal(t.up(up('Shift')), '⇧');
  });

  test('grouped: shift used for a capital letter does not show afterwards', () => {
    const t = createKeyTracker(grouped);
    assert.equal(t.down(key('Shift', { shiftKey: true })), null);
    assert.equal(t.down(key('A', { shiftKey: true })), 'A');
    assert.equal(t.up(up('Shift')), null);
  });

  test('grouped: tracking resets between presses', () => {
    const t = createKeyTracker(grouped);
    t.down(key('Meta', { metaKey: true }));
    t.down(key('k', { metaKey: true }));
    t.up(up('Meta'));
    assert.equal(t.down(key('Meta', { metaKey: true })), null);
    assert.equal(t.up(up('Meta')), '⌘');
  });

  test('ungrouped: every key shows on press, nothing on release', () => {
    const t = createKeyTracker(ungrouped);
    assert.equal(t.down(key('Meta', { metaKey: true })), '⌘');
    assert.equal(t.down(key('k', { metaKey: true })), 'K');
    assert.equal(t.up(up('k')), null);
    assert.equal(t.up(up('Meta')), null);
  });

  test('ordinary keys show on press only', () => {
    const t = createKeyTracker(grouped);
    assert.equal(t.down(key('a')), 'A');
    assert.equal(t.up(up('a')), null);
  });

  test('auto-repeat and untrusted events show nothing', () => {
    const t = createKeyTracker(grouped);
    assert.equal(t.down(key('a', { repeat: true })), null);
    assert.equal(t.down(key('a', { isTrusted: false })), null);
    assert.equal(t.down(key('Shift', { shiftKey: true, isTrusted: false })), null);
    assert.equal(t.up(up('Shift', { isTrusted: false })), null);
  });

  test('settings can change while tracking', () => {
    const t = createKeyTracker(grouped);
    t.setOptions(ungrouped);
    assert.equal(t.down(key('Meta', { metaKey: true })), '⌘');
  });
});

describe('formatComposition', () => {
  test('shows the final composed text', () => {
    assert.equal(formatComposition({ type: 'compositionend', data: '日本', isTrusted: true }), '日本');
  });

  test('empty or cancelled composition shows nothing', () => {
    assert.equal(formatComposition({ type: 'compositionend', data: '', isTrusted: true }), null);
  });

  test('untrusted composition shows nothing', () => {
    assert.equal(formatComposition({ type: 'compositionend', data: 'x', isTrusted: false }), null);
  });
});

describe('createMaskPolicy', () => {
  const on = { maskSensitive: true, maskCrossOriginFrames: true };
  const off = { maskSensitive: false, maskCrossOriginFrames: false };

  test('the mask character is a bullet', () => {
    assert.equal(MASK_CHAR, '•');
  });

  test('password fields are masked', () => {
    const policy = createMaskPolicy();
    assert.equal(policy.shouldMask(input({ type: 'password' }), { settings: on }), true);
  });

  test('a password field stays masked after "show password" turns it into a text field', () => {
    const policy = createMaskPolicy();
    const el = input({ type: 'password' });
    assert.equal(policy.shouldMask(el, { settings: on }), true);
    el.type = 'text';
    assert.equal(policy.shouldMask(el, { settings: on }), true);
  });

  const sensitiveTokens = [
    'cc-number',
    'cc-csc',
    'cc-exp',
    'cc-exp-month',
    'cc-name',
    'one-time-code',
    'current-password',
    'new-password',
  ];
  for (const token of sensitiveTokens) {
    test(`autocomplete="${token}" is masked`, () => {
      const policy = createMaskPolicy();
      assert.equal(policy.shouldMask(input({ autocomplete: token }), { settings: on }), true);
    });
  }

  test('autocomplete tokens with section and billing prefixes are masked', () => {
    const policy = createMaskPolicy();
    const el = input({ autocomplete: 'section-pay billing cc-number' });
    assert.equal(policy.shouldMask(el, { settings: on }), true);
  });

  test('ordinary fields are not masked', () => {
    const policy = createMaskPolicy();
    assert.equal(policy.shouldMask(input({ type: 'email', autocomplete: 'email' }), { settings: on }), false);
    assert.equal(policy.shouldMask(element('textarea'), { settings: on }), false);
    assert.equal(policy.shouldMask(null, { settings: on }), false);
  });

  test('turning off sensitive masking shows password fields', () => {
    const policy = createMaskPolicy();
    assert.equal(policy.shouldMask(input({ type: 'password' }), { settings: off }), false);
  });

  test('everything in another site\'s iframe is masked by default', () => {
    const policy = createMaskPolicy();
    assert.equal(policy.shouldMask(input({ type: 'text' }), { settings: on, crossOriginFrame: true }), true);
    assert.equal(policy.shouldMask(null, { settings: on, crossOriginFrame: true }), true);
  });

  test('turning off iframe masking shows ordinary fields in other sites\' iframes', () => {
    const policy = createMaskPolicy();
    const settings = { maskSensitive: true, maskCrossOriginFrames: false };
    assert.equal(policy.shouldMask(input({ type: 'text' }), { settings, crossOriginFrame: true }), false);
  });

  test('sensitive fields in other sites\' iframes stay masked when only iframe masking is off', () => {
    const policy = createMaskPolicy();
    const settings = { maskSensitive: true, maskCrossOriginFrames: false };
    const el = input({ autocomplete: 'cc-number' });
    assert.equal(policy.shouldMask(el, { settings, crossOriginFrame: true }), true);
  });

  test('missing settings fall back to masking', () => {
    const policy = createMaskPolicy();
    assert.equal(policy.shouldMask(input({ type: 'password' }), {}), true);
    assert.equal(policy.shouldMask(input(), { crossOriginFrame: true }), true);
  });
});
