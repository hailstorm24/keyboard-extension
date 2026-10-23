import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rippleFor, isNearRect, isNearAny } from '../../src/content/clicks.js';
import { pointer } from './helpers.js';

const show = { showClicks: true };

describe('rippleFor', () => {
  test('left, middle, and right mouse buttons', () => {
    assert.deepEqual(rippleFor(pointer({ button: 0 }), show), { x: 100, y: 200, kind: 'left' });
    assert.deepEqual(rippleFor(pointer({ button: 1 }), show), { x: 100, y: 200, kind: 'middle' });
    assert.deepEqual(rippleFor(pointer({ button: 2 }), show), { x: 100, y: 200, kind: 'right' });
  });

  test('back/forward mouse buttons show nothing', () => {
    assert.equal(rippleFor(pointer({ button: 3 }), show), null);
    assert.equal(rippleFor(pointer({ button: 4 }), show), null);
  });

  test('touch and pen', () => {
    assert.equal(rippleFor(pointer({ pointerType: 'touch' }), show).kind, 'touch');
    assert.equal(rippleFor(pointer({ pointerType: 'pen' }), show).kind, 'pen');
  });

  test('uses viewport coordinates', () => {
    const r = rippleFor(pointer({ clientX: 5, clientY: 7 }), show);
    assert.equal(r.x, 5);
    assert.equal(r.y, 7);
  });

  test('untrusted (page-generated) clicks show nothing', () => {
    assert.equal(rippleFor(pointer({ isTrusted: false }), show), null);
  });

  test('turning clicks off shows nothing', () => {
    assert.equal(rippleFor(pointer(), { showClicks: false }), null);
  });
});

describe('isNearRect / isNearAny', () => {
  const rect = { left: 100, top: 100, right: 200, bottom: 140 };

  test('inside the rect', () => {
    assert.equal(isNearRect({ x: 150, y: 120 }, rect), true);
  });

  test('within the default 48px margin', () => {
    assert.equal(isNearRect({ x: 248, y: 120 }, rect), true);
    assert.equal(isNearRect({ x: 150, y: 188 }, rect), true);
  });

  test('outside the margin', () => {
    assert.equal(isNearRect({ x: 249, y: 120 }, rect), false);
    assert.equal(isNearRect({ x: 150, y: 189 }, rect), false);
  });

  test('custom margin', () => {
    assert.equal(isNearRect({ x: 210, y: 120 }, rect, 5), false);
    assert.equal(isNearRect({ x: 205, y: 120 }, rect, 5), true);
  });

  test('isNearAny checks every rect', () => {
    const far = { left: 1000, top: 1000, right: 1010, bottom: 1010 };
    assert.equal(isNearAny({ x: 150, y: 120 }, [far, rect]), true);
    assert.equal(isNearAny({ x: 500, y: 500 }, [far, rect]), false);
    assert.equal(isNearAny({ x: 500, y: 500 }, []), false);
  });
});
