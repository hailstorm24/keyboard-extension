// The overlay's position is saved as a fraction of the viewport (where the
// key area's center goes), so it adapts when the window is resized. These
// convert between that and pixel offsets, keeping the box fully on screen.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function toPixels(fraction, box, viewport) {
  return {
    left: clamp(fraction.x * viewport.width - box.width / 2, 0, Math.max(0, viewport.width - box.width)),
    top: clamp(fraction.y * viewport.height - box.height / 2, 0, Math.max(0, viewport.height - box.height)),
  };
}

export function toFraction(pixels, box, viewport) {
  return {
    x: clamp((pixels.left + box.width / 2) / viewport.width, 0, 1),
    y: clamp((pixels.top + box.height / 2) / viewport.height, 0, 1),
  };
}
