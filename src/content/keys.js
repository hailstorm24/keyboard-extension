// Turning keyboard events into keycap labels, and deciding which keys to mask.

export const MASK_CHAR = '•';

const SYMBOLS = {
  ' ': 'Space',
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

const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt']);

// Keys that mean "a character is still being composed": the result shows
// with a later event instead.
const SILENT = new Set(['Dead', 'Process', 'Unidentified']);

const isPrintable = (key) => [...key].length === 1;

// "KeyA" → "A", "Digit2" → "2". Used with ⌥, where e.key is a special character.
function physicalKey(code) {
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code ?? '');
  return m ? m[1] ?? m[2] : null;
}

export function formatKey(e, { groupCombos = true } = {}) {
  if (!e.isTrusted || e.repeat || e.isComposing || SILENT.has(e.key)) return null;
  if (MODIFIERS.has(e.key)) return SYMBOLS[e.key];

  const printable = isPrintable(e.key);
  let label = SYMBOLS[e.key] ?? (printable ? e.key.toUpperCase() : e.key);
  if (e.altKey && printable) label = physicalKey(e.code) ?? label;
  if (!groupCombos) return label;

  const mods = [];
  if (e.ctrlKey) mods.push('⌃');
  if (e.altKey) mods.push('⌥');
  // Shift that only produced a capital or symbol is already in the label.
  if (e.shiftKey && (!printable || e.ctrlKey || e.altKey || e.metaKey)) mods.push('⇧');
  if (e.metaKey) mods.push('⌘');
  return mods.length ? `${mods.join('')}+${label}` : label;
}

// Decides when modifiers show. With grouping, a modifier shows only if it was
// pressed and released without another key; otherwise it's part of a combo.
export function createKeyTracker(options = {}) {
  let groupCombos = options.groupCombos ?? true;
  const pending = new Set();

  return {
    setOptions(o) {
      groupCombos = o.groupCombos ?? true;
      pending.clear();
    },
    down(e) {
      if (!e.isTrusted || e.repeat) return null;
      if (MODIFIERS.has(e.key)) {
        if (!groupCombos) return formatKey(e, { groupCombos });
        pending.add(e.key);
        return null;
      }
      pending.clear();
      return formatKey(e, { groupCombos });
    },
    up(e) {
      if (!e.isTrusted) return null;
      if (groupCombos && pending.has(e.key)) {
        pending.delete(e.key);
        return SYMBOLS[e.key];
      }
      pending.delete(e.key);
      return null;
    },
  };
}

export function formatComposition(e) {
  if (!e.isTrusted || !e.data) return null;
  return e.data;
}

const SENSITIVE_AUTOCOMPLETE = new Set([
  'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-name', 'cc-given-name',
  'cc-additional-name', 'cc-family-name', 'cc-type', 'one-time-code', 'current-password', 'new-password',
]);

export function createMaskPolicy() {
  // Fields that were ever password fields, so "show password" doesn't unmask them.
  const passwords = new WeakSet();

  function isSensitive(el) {
    if (!el || typeof el !== 'object') return false;
    if (el.tagName === 'INPUT' && el.type === 'password') {
      passwords.add(el);
      return true;
    }
    if (passwords.has(el)) return true;
    const ac = el.getAttribute?.('autocomplete');
    return Boolean(ac) && ac.toLowerCase().split(/\s+/).some((t) => SENSITIVE_AUTOCOMPLETE.has(t));
  }

  return {
    shouldMask(el, { settings = {}, crossOriginFrame = false } = {}) {
      // Anything that isn't explicitly false keeps masking on.
      const maskSensitive = settings.maskSensitive !== false;
      const maskFrames = settings.maskCrossOriginFrames !== false;
      const sensitive = isSensitive(el);
      if (crossOriginFrame && maskFrames) return true;
      return maskSensitive && sensitive;
    },
  };
}
