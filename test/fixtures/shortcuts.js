window.__pageState = { paletteOpens: 0, helpOpens: 0, escapes: 0 };
const palette = document.getElementById('palette');

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    // The page's own shortcut blocks the browser default; the overlay must not change this.
    e.preventDefault();
    palette.hidden = false;
    document.getElementById('palette-input').focus();
    window.__pageState.paletteOpens++;
  } else if (e.key === 'Escape') {
    // Blur before hiding. Hiding a focused input blurs it at whatever moment
    // Chrome next updates styles, which makes the event order vary run to run.
    document.activeElement?.blur();
    palette.hidden = true;
    window.__pageState.escapes++;
  } else if (e.key === '?' && document.activeElement === document.body) {
    window.__pageState.helpOpens++;
  }
});
