// Content script entry point, injected into every frame of a tab that's on.
// The top frame draws the overlay; child frames send what they see to it
// through the background script.
//
// Listeners are passive and in the capture phase, and never change the event,
// so the page behaves exactly as it would without the overlay.
import { createKeyTracker, formatComposition, createMaskPolicy, MASK_CHAR } from './keys.js';
import { rippleFor, isNearAny } from './clicks.js';
import { createOverlay } from './overlay.js';
import { normalize, SETTINGS_KEY } from '../shared/settings.js';
import { MSG, isFromExtension } from '../shared/messages.js';

if (!globalThis.__keyOverlay) start();

function start() {
  const isTop = window === window.top;
  const crossOriginFrame = isCrossOriginFrame();
  let settings = normalize(undefined);
  const tracker = createKeyTracker(settings);
  const masks = createMaskPolicy();
  const overlay = isTop ? createOverlay({ settings, onPositionChange: savePosition }) : null;

  function savePosition(position) {
    settings = normalize({ ...settings, position });
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }).catch(() => {});
  }

  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

  function targetOf(e) {
    const t = e.composedPath?.()[0] ?? e.target;
    return t && t.nodeType === 1 ? t : null;
  }

  function showKey(label, e) {
    if (!label) return;
    if (masks.shouldMask(targetOf(e), { settings, crossOriginFrame })) label = MASK_CHAR;
    if (overlay) overlay.addKey(label);
    else send({ type: MSG.FRAME_KEY, label });
  }

  function onKeyDown(e) {
    if (e.isTrusted && e.key === 'Escape' && overlay?.isMoving()) overlay.exitMoveMode();
    showKey(tracker.down(e), e);
  }

  function onHidden() {
    if (document.visibilityState === 'hidden') overlay?.exitMoveMode();
  }

  function onKeyUp(e) {
    showKey(tracker.up(e), e);
  }

  // Composed text comes from trusted input events during composition. Some
  // input paths end composition with an untrusted compositionend, so that
  // event only says "done"; a page faking it can't add text of its own.
  let composing = null;

  function onInput(e) {
    if (e.isTrusted && (e.isComposing || e.inputType === 'insertCompositionText')) composing = e.data;
  }

  function onCompositionEnd(e) {
    const text = formatComposition(e) ?? composing;
    composing = null;
    showKey(text, e);
  }

  // No ripple on or near a masked field, or in the same form or fieldset as
  // one, so on-screen PIN pads don't give digits away.
  function nearMaskedField(target, point) {
    if (!settings.maskSensitive) return false;
    const opts = { settings };
    const masked = (f) => masks.shouldMask(f, opts);
    if (target && masked(target)) return true;
    const group = target?.closest('form, fieldset');
    if (group && [...group.querySelectorAll('input, textarea')].some(masked)) return true;
    const rects = [...document.querySelectorAll('input, textarea')].filter(masked).map((f) => f.getBoundingClientRect());
    return isNearAny(point, rects);
  }

  function onPointerDown(e) {
    // The grip's own events.
    if (overlay && e.target === overlay.host) return;
    const ripple = rippleFor(e, settings);
    if (!ripple) return;
    if (crossOriginFrame && settings.maskCrossOriginFrames) return;
    if (nearMaskedField(targetOf(e), ripple)) return;
    if (overlay) overlay.addRipple(ripple);
    else send({ type: MSG.FRAME_CLICK, ...ripple, top: toTopCoords(ripple.x, ripple.y) });
  }

  // Seeing a password field before its type changes keeps it masked after
  // "show password".
  function onFocusIn(e) {
    masks.shouldMask(targetOf(e), { settings });
  }

  function applySettings(s) {
    settings = s;
    tracker.setOptions(s);
    overlay?.apply(s);
  }

  function onStorageChange(changes, area) {
    if (area === 'sync' && changes[SETTINGS_KEY]) applySettings(normalize(changes[SETTINGS_KEY].newValue));
  }

  function onMessage(msg, sender) {
    if (!isFromExtension(sender, chrome.runtime.id) || !msg || typeof msg !== 'object') return;
    if (msg.type === MSG.TEARDOWN) teardown();
    else if (msg.type === MSG.ENTER_MOVE_MODE) overlay?.enterMoveMode();
    else if (msg.type === MSG.EXIT_MOVE_MODE) overlay?.exitMoveMode();
    else if (msg.type === MSG.FRAME_KEY && overlay && typeof msg.label === 'string') overlay.addKey(msg.label);
    else if (msg.type === MSG.FRAME_CLICK && overlay) showFrameClick(msg);
  }

  // A click from a child frame. Same-origin frames send top-frame
  // coordinates; otherwise find the iframe by its URL.
  function showFrameClick({ x, y, kind, top, frameUrl }) {
    if (!['left', 'middle', 'right', 'touch', 'pen'].includes(kind)) return;
    if (top && Number.isFinite(top.x) && Number.isFinite(top.y)) {
      overlay.addRipple({ x: top.x, y: top.y, kind });
      return;
    }
    const frame = [...document.querySelectorAll('iframe')].find((f) => f.src === frameUrl);
    if (!frame || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const r = frame.getBoundingClientRect();
    overlay.addRipple({ x: r.left + frame.clientLeft + x, y: r.top + frame.clientTop + y, kind });
  }

  const listeners = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['input', onInput],
    ['compositionend', onCompositionEnd],
    ['focusin', onFocusIn],
    ['pointerdown', onPointerDown],
  ];
  const opts = { capture: true, passive: true };
  for (const [type, fn] of listeners) addEventListener(type, fn, opts);
  document.addEventListener('visibilitychange', onHidden);
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.onChanged.addListener(onStorageChange);
  chrome.storage.sync.get(SETTINGS_KEY).then((r) => applySettings(normalize(r[SETTINGS_KEY])), () => {});

  function teardown() {
    for (const [type, fn] of listeners) removeEventListener(type, fn, opts);
    document.removeEventListener('visibilitychange', onHidden);
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.storage.onChanged.removeListener(onStorageChange);
    overlay?.destroy();
    delete globalThis.__keyOverlay;
  }

  globalThis.__keyOverlay = { teardown };
}

// Converts a point in this frame to top-frame coordinates, or null if a
// frame in between is from another origin.
function toTopCoords(x, y) {
  let w = window;
  while (w !== w.top) {
    const frame = w.frameElement;
    if (!frame) return null;
    const r = frame.getBoundingClientRect();
    x += r.left + frame.clientLeft;
    y += r.top + frame.clientTop;
    w = w.parent;
  }
  return { x, y };
}

// True if this frame, or any frame between it and the top, is from another
// origin than this frame.
function isCrossOriginFrame() {
  let w = window;
  while (w !== w.top) {
    w = w.parent;
    try {
      if (w.location.origin !== location.origin) return true;
    } catch {
      return true;
    }
  }
  return false;
}
