// User settings: defaults, limits, and normalize(), which turns whatever is in
// storage into a complete, safe settings object. Everything that reads
// settings goes through normalize().

export const SETTINGS_KEY = 'settings';

export const LIMITS = Object.freeze({
  size: [0.7, 1.5],
  speed: [1, 4],
  spacing: [0, 32],
});

const CORNERS = {
  tl: { x: 0.08, y: 0.15 },
  tr: { x: 0.92, y: 0.15 },
  bl: { x: 0.08, y: 0.85 },
  br: { x: 0.92, y: 0.85 },
};

export const DEFAULTS = Object.freeze({
  position: Object.freeze({ ...CORNERS.br }),
  size: 1,
  speed: 2.2,
  spacing: 8,
  maskSensitive: true,
  maskCrossOriginFrames: true,
  groupCombos: true,
  showClicks: true,
  clickColor: 'accent',
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function num(v, [lo, hi], fallback) {
  return isNum(v) ? clamp(v, lo, hi) : fallback;
}

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

function position(v) {
  if (v && typeof v === 'object' && isNum(v.x) && isNum(v.y)) {
    return { x: clamp(v.x, 0, 1), y: clamp(v.y, 0, 1) };
  }
  return { ...DEFAULTS.position };
}

function color(v) {
  return v === 'accent' || (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) ? v : DEFAULTS.clickColor;
}

export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  // Only own properties, so nothing comes in through the prototype.
  const get = (k) => (Object.hasOwn(r, k) ? r[k] : undefined);
  return {
    position: position(get('position')),
    size: num(get('size'), LIMITS.size, DEFAULTS.size),
    speed: num(get('speed'), LIMITS.speed, DEFAULTS.speed),
    spacing: num(get('spacing'), LIMITS.spacing, DEFAULTS.spacing),
    maskSensitive: bool(get('maskSensitive'), DEFAULTS.maskSensitive),
    maskCrossOriginFrames: bool(get('maskCrossOriginFrames'), DEFAULTS.maskCrossOriginFrames),
    groupCombos: bool(get('groupCombos'), DEFAULTS.groupCombos),
    showClicks: bool(get('showClicks'), DEFAULTS.showClicks),
    clickColor: color(get('clickColor')),
  };
}

export function cornerPosition(corner) {
  if (!Object.hasOwn(CORNERS, corner)) throw new Error(`unknown corner: ${corner}`);
  return { ...CORNERS[corner] };
}
