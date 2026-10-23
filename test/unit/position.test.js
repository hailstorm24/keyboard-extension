import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toPixels, toFraction } from '../../src/shared/position.js';

const viewport = { width: 1000, height: 800 };
const box = { width: 150, height: 250 };

describe('toPixels', () => {
  test('places the box so its anchor point sits at the fraction', () => {
    // The fraction is where the box's center goes.
    assert.deepEqual(toPixels({ x: 0.5, y: 0.5 }, box, viewport), { left: 425, top: 275 });
  });

  test('keeps the whole box on screen near the edges', () => {
    assert.deepEqual(toPixels({ x: 1, y: 1 }, box, viewport), { left: 850, top: 550 });
    assert.deepEqual(toPixels({ x: 0, y: 0 }, box, viewport), { left: 0, top: 0 });
  });

  test('stays on screen after the window shrinks', () => {
    const small = { width: 400, height: 300 };
    const p = toPixels({ x: 0.92, y: 0.85 }, box, small);
    assert.ok(p.left >= 0 && p.left + box.width <= small.width);
    assert.ok(p.top >= 0 && p.top + box.height <= small.height);
  });

  test('a box bigger than the viewport pins to the top left', () => {
    assert.deepEqual(toPixels({ x: 0.9, y: 0.9 }, { width: 2000, height: 2000 }, viewport), { left: 0, top: 0 });
  });
});

describe('toFraction', () => {
  test('is the inverse of toPixels inside the safe area', () => {
    const frac = { x: 0.3, y: 0.6 };
    const px = toPixels(frac, box, viewport);
    const back = toFraction(px, box, viewport);
    assert.ok(Math.abs(back.x - frac.x) < 1e-9);
    assert.ok(Math.abs(back.y - frac.y) < 1e-9);
  });

  test('is clamped to 0..1', () => {
    const f = toFraction({ left: -500, top: 5000 }, box, viewport);
    assert.deepEqual(f, { x: 0, y: 1 });
  });
});
