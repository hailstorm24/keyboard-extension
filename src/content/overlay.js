// The overlay: one <key-overlay-host> element with a closed shadow root,
// holding the key area and the click layer. Nothing in it takes the mouse
// except the grip in move mode.
import css from './overlay.css';
import { toPixels, toFraction } from '../shared/position.js';

// Inline !important beats any page stylesheet rule aimed at the host.
const HOST_STYLE = [
  'all: initial',
  'display: block',
  'position: fixed',
  'inset: 0',
  'z-index: 2147483647',
  'pointer-events: none',
  'opacity: 1',
  'visibility: visible',
  'transform: none',
  'contain: layout style',
]
  .map((d) => `${d} !important`)
  .join('; ');

const MAX_KEYCAPS = 30;
const KEY_WIDTH = 44;
const COLUMNS = 3;
const AREA_HEIGHT = 250;

function el(tag, className) {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function viewport() {
  const root = document.documentElement;
  return { width: root?.clientWidth || innerWidth, height: root?.clientHeight || innerHeight };
}

export function createOverlay({ settings, onPositionChange }) {
  const host = document.createElement('key-overlay-host');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = HOST_STYLE;
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];

  const clickLayer = el('div', 'click-layer');
  const area = el('div', 'key-area');
  root.append(clickLayer, area);

  let current = settings;
  let column = 0;
  let grip = null;
  let drag = null;

  function areaSize() {
    return {
      width: Math.round(COLUMNS * KEY_WIDTH * current.size + (COLUMNS - 1) * current.spacing),
      height: Math.round(AREA_HEIGHT * current.size),
    };
  }

  function place(pixels) {
    const box = areaSize();
    const vp = viewport();
    const p = pixels ?? toPixels(current.position, box, vp);
    const left = Math.min(Math.max(0, p.left), Math.max(0, vp.width - box.width));
    const top = Math.min(Math.max(0, p.top), Math.max(0, vp.height - box.height));
    area.style.width = `${box.width}px`;
    area.style.height = `${box.height}px`;
    area.style.left = `${left}px`;
    area.style.top = `${top}px`;
    return { left, top };
  }

  function apply(s) {
    current = s;
    area.style.setProperty('--key-size', String(s.size));
    area.style.setProperty('--key-speed', `${s.speed}s`);
    area.style.setProperty('--key-spacing', `${s.spacing}px`);
    if (s.clickColor === 'accent') clickLayer.style.removeProperty('--ripple-color');
    else clickLayer.style.setProperty('--ripple-color', s.clickColor);
    if (!drag) place();
  }

  // Remove an element when its animation ends, with a timer as a backstop
  // for pages where animations don't run.
  function expire(node, ms) {
    const remove = () => node.remove();
    node.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, ms);
  }

  function addKey(label) {
    const caps = area.getElementsByClassName('keycap');
    while (caps.length >= MAX_KEYCAPS) caps[0].remove();
    const cap = el('div', 'keycap');
    cap.textContent = label;
    cap.style.left = `${column * (KEY_WIDTH * current.size + current.spacing)}px`;
    column = (column + 1) % COLUMNS;
    area.append(cap);
    expire(cap, current.speed * 1000 + 500);
  }

  function addRipple({ x, y, kind }) {
    const r = el('div', 'ripple');
    r.dataset.kind = kind;
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    clickLayer.append(r);
    expire(r, 1500);
  }

  // Move mode: a grip appears on the key area and is the only thing that
  // takes the mouse.
  function onGripDown(e) {
    grip.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, left: area.offsetLeft, top: area.offsetTop };
  }

  function onGripMove(e) {
    if (!drag) return;
    place({ left: drag.left + e.clientX - drag.x, top: drag.top + e.clientY - drag.y });
  }

  function onGripUp() {
    if (!drag) return;
    drag = null;
    const fraction = toFraction({ left: area.offsetLeft, top: area.offsetTop }, areaSize(), viewport());
    current = { ...current, position: fraction };
    onPositionChange?.(fraction);
  }

  function enterMoveMode() {
    if (grip) return;
    area.classList.add('moving');
    grip = el('div', 'grip');
    grip.textContent = 'Drag to move · Esc when done';
    grip.addEventListener('pointerdown', onGripDown);
    grip.addEventListener('pointermove', onGripMove);
    grip.addEventListener('pointerup', onGripUp);
    grip.addEventListener('pointercancel', onGripUp);
    area.append(grip);
  }

  function exitMoveMode() {
    if (!grip) return;
    onGripUp();
    grip.remove();
    grip = null;
    area.classList.remove('moving');
  }

  // Keep the host attached: the page may remove it, replace everything under
  // <html>, or put an element in fullscreen (only the fullscreen element's
  // subtree is visible then). Re-adding waits a tick, and backs off if the
  // page keeps fighting, so a page removing it in a loop can't freeze itself.
  const mountTarget = () => document.fullscreenElement ?? document.documentElement;
  let recentMounts = [];
  let mountTimer = null;

  function mount() {
    const target = mountTarget();
    if (target && host.parentNode !== target) target.append(host);
  }

  function scheduleMount() {
    if (mountTimer !== null) return;
    const now = Date.now();
    recentMounts = recentMounts.filter((t) => now - t < 1000);
    recentMounts.push(now);
    mountTimer = setTimeout(() => {
      mountTimer = null;
      mount();
    }, recentMounts.length > 20 ? 500 : 0);
  }

  const observer = new MutationObserver(() => {
    if (host.parentNode !== mountTarget()) scheduleMount();
  });

  const onResize = () => place();
  const onFullscreen = () => mount();

  mount();
  apply(settings);
  observer.observe(document, { childList: true, subtree: true });
  addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFullscreen);

  return {
    host,
    apply,
    addKey,
    addRipple,
    enterMoveMode,
    exitMoveMode,
    isMoving: () => grip !== null,
    destroy() {
      observer.disconnect();
      clearTimeout(mountTimer);
      removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreen);
      host.remove();
    },
  };
}
