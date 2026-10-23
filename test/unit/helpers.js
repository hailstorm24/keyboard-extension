// Plain-object stand-ins for DOM events and elements, so the pure logic in
// src/ can be tested in Node without a browser.

export function key(k, opts = {}) {
  return {
    type: 'keydown',
    key: k,
    code: opts.code ?? codeFor(k),
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    isTrusted: true,
    ...opts,
  };
}

function codeFor(k) {
  if (/^[a-z]$/i.test(k)) return `Key${k.toUpperCase()}`;
  if (/^[0-9]$/.test(k)) return `Digit${k}`;
  return k;
}

export function pointer(opts = {}) {
  return {
    type: 'pointerdown',
    pointerType: 'mouse',
    button: 0,
    clientX: 100,
    clientY: 200,
    isTrusted: true,
    ...opts,
  };
}

export function input(attrs = {}) {
  const el = {
    tagName: 'INPUT',
    type: attrs.type ?? 'text',
    getAttribute(name) {
      return name in attrs ? String(attrs[name]) : null;
    },
  };
  return el;
}

export function element(tagName, attrs = {}) {
  return {
    tagName: tagName.toUpperCase(),
    getAttribute(name) {
      return name in attrs ? String(attrs[name]) : null;
    },
  };
}
