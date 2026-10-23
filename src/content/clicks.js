// Turning pointer events into ripples, and the geometry for hiding ripples
// near masked fields.

const BUTTONS = { 0: 'left', 1: 'middle', 2: 'right' };

export function rippleFor(e, { showClicks = true } = {}) {
  if (!e.isTrusted || !showClicks) return null;
  const kind = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : BUTTONS[e.button];
  if (!kind) return null;
  return { x: e.clientX, y: e.clientY, kind };
}

export function isNearRect(point, rect, margin = 48) {
  return (
    point.x >= rect.left - margin &&
    point.x <= rect.right + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.bottom + margin
  );
}

export function isNearAny(point, rects, margin) {
  return rects.some((r) => isNearRect(point, r, margin));
}
