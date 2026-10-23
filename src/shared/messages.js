// Message types sent between the popup, background, and content scripts.
// Everything goes through chrome.runtime / chrome.tabs messaging, which pages
// can't read or forge.
export const MSG = Object.freeze({
  TEARDOWN: 'key-overlay:teardown',
  ENTER_MOVE_MODE: 'key-overlay:enter-move-mode',
  EXIT_MOVE_MODE: 'key-overlay:exit-move-mode',
  FRAME_KEY: 'key-overlay:frame-key',
  FRAME_CLICK: 'key-overlay:frame-click',
  SET_TAB_ENABLED: 'key-overlay:set-tab-enabled',
});

export function isFromExtension(sender, runtimeId) {
  return Boolean(sender && runtimeId && sender.id === runtimeId);
}
