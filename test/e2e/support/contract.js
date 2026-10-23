// What the e2e tests expect the extension to expose. The extension doesn't
// exist yet; these are the hooks it must provide. See test/README.md.

export const ORIGINS = { top: 'http://localhost:3000', other: 'http://127.0.0.1:3001' };

// Must match src/shared/messages.js (checked by test/unit/messages.test.js).
export const MSG = {
  TEARDOWN: 'key-overlay:teardown',
  ENTER_MOVE_MODE: 'key-overlay:enter-move-mode',
  EXIT_MOVE_MODE: 'key-overlay:exit-move-mode',
  FRAME_KEY: 'key-overlay:frame-key',
  FRAME_CLICK: 'key-overlay:frame-click',
  SET_TAB_ENABLED: 'key-overlay:set-tab-enabled',
};

export const MASK_CHAR = '•';

// Overlay DOM, inside the closed shadow root of <key-overlay-host>.
export const HOST_TAG = 'KEY-OVERLAY-HOST';
export const SEL = {
  keyArea: 'key-area',     // class of the positioned box keycaps float in
  keycap: 'keycap',        // class of each keycap; its text is the label
  clickLayer: 'click-layer',
  ripple: 'ripple',        // class of each ripple; data-kind = left|middle|right|touch|pen
  grip: 'grip',            // only present in move mode
};

// CSS custom properties set on .key-area from settings.
export const VARS = { size: '--key-size', speed: '--key-speed', spacing: '--key-spacing' };

// Keycap animation names.
export const ANIMATION = { float: 'keycap-float', fade: 'keycap-fade' };

// chrome.storage layout.
export const STORAGE = { settingsKey: 'settings', enabledTabsKey: 'enabledTabs' };

// Popup control ids.
export const POPUP = {
  enabled: '#enabled',
  size: '#size',
  speed: '#speed',
  spacing: '#spacing',
  maskSensitive: '#mask-sensitive',
  maskFrames: '#mask-frames',
  groupCombos: '#group-combos',
  showClicks: '#show-clicks',
  move: '#move',
  corners: { tl: '#corner-tl', tr: '#corner-tr', bl: '#corner-bl', br: '#corner-br' },
};
