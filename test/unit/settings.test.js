import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, LIMITS, SETTINGS_KEY, normalize, cornerPosition } from '../../src/shared/settings.js';

describe('DEFAULTS', () => {
  test('match the table in DESIGN.md', () => {
    assert.deepEqual(DEFAULTS, {
      position: { x: 0.92, y: 0.85 },
      size: 1,
      speed: 2.2,
      spacing: 8,
      maskSensitive: true,
      maskCrossOriginFrames: true,
      groupCombos: true,
      showClicks: true,
      clickColor: 'accent',
    });
  });

  test('are frozen', () => {
    assert.equal(Object.isFrozen(DEFAULTS), true);
    assert.equal(Object.isFrozen(DEFAULTS.position), true);
  });

  test('limits match the table in DESIGN.md', () => {
    assert.deepEqual(LIMITS, {
      size: [0.7, 1.5],
      speed: [1, 4],
      spacing: [0, 32],
    });
  });

  test('settings are stored under one key', () => {
    assert.equal(SETTINGS_KEY, 'settings');
  });
});

describe('normalize', () => {
  test('nothing stored gives the defaults', () => {
    assert.deepEqual(normalize(undefined), DEFAULTS);
    assert.deepEqual(normalize(null), DEFAULTS);
    assert.deepEqual(normalize({}), DEFAULTS);
    assert.deepEqual(normalize('garbage'), DEFAULTS);
  });

  test('valid values are kept', () => {
    const s = normalize({ size: 1.3, speed: 3, spacing: 20, groupCombos: false, clickColor: '#ff0088' });
    assert.equal(s.size, 1.3);
    assert.equal(s.speed, 3);
    assert.equal(s.spacing, 20);
    assert.equal(s.groupCombos, false);
    assert.equal(s.clickColor, '#ff0088');
  });

  test('numbers are clamped to their limits', () => {
    const low = normalize({ size: 0.1, speed: 0, spacing: -5 });
    assert.equal(low.size, 0.7);
    assert.equal(low.speed, 1);
    assert.equal(low.spacing, 0);
    const high = normalize({ size: 9, speed: 99, spacing: 1000 });
    assert.equal(high.size, 1.5);
    assert.equal(high.speed, 4);
    assert.equal(high.spacing, 32);
  });

  test('wrong types fall back to the default', () => {
    const s = normalize({ size: '1.2', speed: NaN, spacing: Infinity, showClicks: 'yes', groupCombos: 1 });
    assert.equal(s.size, DEFAULTS.size);
    assert.equal(s.speed, DEFAULTS.speed);
    assert.equal(s.spacing, DEFAULTS.spacing);
    assert.equal(s.showClicks, DEFAULTS.showClicks);
    assert.equal(s.groupCombos, DEFAULTS.groupCombos);
  });

  test('masking settings only accept real booleans', () => {
    assert.equal(normalize({ maskSensitive: 'false' }).maskSensitive, true);
    assert.equal(normalize({ maskCrossOriginFrames: 0 }).maskCrossOriginFrames, true);
    assert.equal(normalize({ maskSensitive: false }).maskSensitive, false);
    assert.equal(normalize({ maskCrossOriginFrames: false }).maskCrossOriginFrames, false);
  });

  test('position is clamped to the viewport fractions', () => {
    assert.deepEqual(normalize({ position: { x: -1, y: 2 } }).position, { x: 0, y: 1 });
    assert.deepEqual(normalize({ position: { x: 0.5, y: 0.25 } }).position, { x: 0.5, y: 0.25 });
  });

  test('broken positions fall back to the default', () => {
    assert.deepEqual(normalize({ position: 'top' }).position, DEFAULTS.position);
    assert.deepEqual(normalize({ position: { x: 'a', y: 0.5 } }).position, DEFAULTS.position);
    assert.deepEqual(normalize({ position: null }).position, DEFAULTS.position);
  });

  test('click color must be "accent" or a #rrggbb hex', () => {
    assert.equal(normalize({ clickColor: 'accent' }).clickColor, 'accent');
    assert.equal(normalize({ clickColor: '#ABCDEF' }).clickColor, '#ABCDEF');
    assert.equal(normalize({ clickColor: 'red' }).clickColor, 'accent');
    assert.equal(normalize({ clickColor: 'url(javascript:alert(1))' }).clickColor, 'accent');
    assert.equal(normalize({ clickColor: '#fff; background: red' }).clickColor, 'accent');
  });

  test('unknown keys are dropped', () => {
    const s = normalize({ keystrokes: 'hunter2', __proto__: { evil: true }, extra: 1 });
    assert.deepEqual(Object.keys(s).sort(), Object.keys(DEFAULTS).sort());
    assert.equal('keystrokes' in s, false);
  });

  test('returns a new object, not the defaults', () => {
    const s = normalize({});
    assert.notEqual(s, DEFAULTS);
    assert.notEqual(s.position, DEFAULTS.position);
  });
});

describe('cornerPosition', () => {
  test('bottom right is the default position', () => {
    assert.deepEqual(cornerPosition('br'), DEFAULTS.position);
  });

  test('every corner is inside the viewport and on the right side', () => {
    for (const c of ['tl', 'tr', 'bl', 'br']) {
      const p = cornerPosition(c);
      assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, c);
      assert.equal(p.x < 0.5, c[1] === 'l', `${c} horizontal side`);
      assert.equal(p.y < 0.5, c[0] === 't', `${c} vertical side`);
    }
  });

  test('unknown corner throws', () => {
    assert.throws(() => cornerPosition('middle'));
  });
});
