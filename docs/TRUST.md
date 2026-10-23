# Key Overlay: Trust validation

This extension sees every key pressed in the tabs where it's on. That's the same access a keylogger has, so it's only trustworthy if the promises below hold, and each one needs a test that would catch it breaking.

See [DESIGN.md](DESIGN.md) for how the extension is built.

## The five promises

| Promise | What it means | Main way to check it |
|---|---|---|
| **Private** | Keys are only drawn on screen. They're never sent anywhere, saved, logged, or exposed to another site. Sensitive fields and other sites' iframes are masked by default. | Canary audit, network-silence test, lint rules |
| **Doesn't interfere** | Pages behave exactly the same with the overlay on as with it off. | Off-vs-on comparison |
| **Stays in its tab** | It runs only in tabs the user turned on, and "off" removes it completely. | Automated tests across several tabs |
| **Can't be tampered with** | The page can't read the overlay, fake keys in it, or take over its controls. | Hostile test pages |
| **Minimal** | The fewest permissions, no code loaded from the internet, no third-party runtime libraries. | Permissions allowlist check in CI |

## Checks reused at every stage

### 1. Off-vs-on comparison

A test page records everything it receives:

- every event: type, key, target, order, and whether the default action was blocked
- every DOM change
- computed styles of key elements

Playwright (loaded with the extension) replays the same scripted typing and clicking twice: once with the extension off, once on. **The two recordings must match exactly**, apart from our one `<key-overlay-host>` element.

### 2. Canary audit

Type a unique string such as `CANARY-7Q2X` (in plain fields, masked fields, and iframes), then search for it in:

- all `chrome.storage` areas (`local`, `sync`, `session`)
- console output from the page, the content scripts, the service worker, and the popup
- the page's DOM outside our shadow root
- `message` events and anything else the page or another frame can read

**It must not appear anywhere.** In masked fields and other sites' iframes, it must not appear on screen either.

### 3. Network silence

Record every request made by the service worker, content scripts, and popup during a full session. **The expected count is zero**; any request fails the test.

### 4. Static rules

- ESLint bans `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, `eval`, `new Function`, `innerHTML`/`outerHTML`/`insertAdjacentHTML`, and `window.postMessage`.
- The same text search runs on a fresh build, so code added by the build tools (a compromised esbuild, or a dependency bundled by accident) is caught too. It also bans other ways to reach the network: WebRTC, WebTransport, setting `src`/`href` or URL attributes, `new Image()`, and CSS `url()`/`@import`. A test plants each kind of call in the bundle to prove the scan catches it.
- Keycap text is set only with `textContent`.
- `console.*` calls are banned outside a debug flag that's off in release builds.
- A CI script compares `manifest.json` permissions to a committed allowlist and fails on any difference.
- `package.json` has no runtime `dependencies` (dev tools only).

### 5. Unit tests

For pure logic: key labels, combos, held keys, the masking decision, IME handling, and the settings schema.

### 6. Manual site checks

Before each release, on: Gmail, Google Docs, YouTube fullscreen, a React app, Stripe's test checkout, and GitHub.

## Test fixtures

Local pages under `test/fixtures/`, served on two origins (`localhost:3000` and `127.0.0.1:3001`) so cross-site iframe tests work offline. Most of them load `recorder.js`, which records every event, DOM change, `message` event, and key computed styles the page can see.

| Fixture | Purpose |
|---|---|
| `recorder.html`, `page2.html` | A sign-up form for the off-vs-on comparison and navigation tests |
| `hostile-css.html` | `* { all: unset !important }`, `div { display: none !important }`, `transform` on `<html>`, zoom, rules targeting our element |
| `hostile-js.html` | Removes our element, reads `host.shadowRoot`, dispatches fake key and click events, posts fake extension messages |
| `sensitive-fields.html` | Password, show-password toggle, `cc-*`, `one-time-code`, on-screen PIN pad |
| `payment-frame.html` | Top page embedding a same-site iframe (`same-frame.html`) and a card form from the other origin (`card-form.html`) |
| `shortcuts.html` | Page that uses its own ⌘K command bar and other shortcuts |
| `editors.html` | `contenteditable`, `<textarea>`, `<canvas>` drawing, drag-and-drop, right-click menu |
| `strict-csp.html` | `Content-Security-Policy: default-src 'none'` |
| `spa.html` | Replaces `<body>`, or every child of `<html>`, on navigation |
| `fullscreen.html` | An element that goes fullscreen |

How to run the tests, and the names the extension must provide for them, are in [test/README.md](../test/README.md).

## Stage by stage

### Stage 1: Per-tab switch

**Scenarios**
- Turn it on in tab A; tab B stays unaffected.
- Reload, navigate within the site, navigate to another site, close the tab.
- Chrome stops the service worker while the tab is on; the tab stays on.
- Incognito windows (off unless the user allows the extension there).
- `chrome://` and Web Store pages: the popup explains they can't be used.

**How it's checked**
- Playwright tests for each scenario.
- After turning off: our element is gone, and new keys and clicks produce nothing.

**Exit gate**
- Permissions allowlist committed.
- The install warning text has been reviewed by a person.

### Stage 2: Shadow DOM overlay

**Scenarios**
- `hostile-css.html` doesn't change how the overlay looks or where it is.
- The page deletes our element; it's re-added.
- The page reads `host.shadowRoot` and gets `null`.
- Screen readers ignore the overlay.

**How it's checked**
- Click-through grid: click 100 points beneath the overlay; the page receives all 100.
- Off-vs-on comparison on `recorder.html` and `hostile-css.html`.
- Accessibility tree snapshot contains nothing from the overlay.

**Exit gate**
- Comparison matches on both pages; all 100 clicks received.

### Stage 3: Keys (highest risk)

**Scenarios**
- Masking: password fields, a show-password toggle, `cc-*`, `one-time-code`, `current-password`, `new-password`.
- The page dispatches fake key events; they don't appear (`isTrusted` check).
- Page shortcuts (⌘K in `shortcuts.html`) still work.
- Typing in `contenteditable` and `<textarea>`.
- Japanese IME composition, dead keys, AZERTY layout.
- Holding a key down shows it once.
- 10,000 keystrokes in a row: memory stays flat, no dropped frames, never more than ~30 keycaps.

**How it's checked**
- Unit tests for every label and masking rule.
- Canary audit across all fields.
- Off-vs-on comparison, including that page handlers fire in the same order and `defaultPrevented` is unchanged.
- Performance trace for the 10,000-key run.

**Exit gate**
- No canary leaks, no differences in the comparison.

### Stage 4: Clicks

**Scenarios**
- Drag to select text, double-click, right-click menu, drag-and-drop, `<canvas>` drawing.
- Touch and pen input.
- On-screen PIN pad next to a masked field: no ripples shown.

**How it's checked**
- Off-vs-on comparison on `recorder.html` and `editors.html`.
- Screenshot test on the PIN pad shows no ripples.

**Exit gate**
- Comparison matches; PIN pad test passes.

### Stage 5: Settings

**Scenarios**
- Broken, out-of-range, or deliberately bad stored values are clamped to safe values.
- Settings sync between Chrome profiles on different devices.
- Spacing, speed, and size update on screen immediately.
- The masking settings can't be turned off from the page (only from the popup).

**How it's checked**
- Schema unit tests with bad input.
- Storage dump after a long session contains only schema fields, no key data.

**Exit gate**
- Schema tests pass; storage dump is clean.

### Stage 6: Dragging

**Scenarios**
- Move mode starts only from the popup. `hostile-js.html` posts fake messages trying to start it, and they're ignored.
- Move mode ends on `Esc`, Done, switching tabs, and navigation.
- In move mode, clicks outside the grip still reach the page.
- After resizing the window, the overlay stays on screen.

**How it's checked**
- Playwright tests for each scenario, including the fake-message test.
- Click-through grid repeated while in move mode (grip area excluded).

**Exit gate**
- All scenarios pass.

### Stage 7: Iframes and other edge cases

**Scenarios**
- `payment-frame.html`: keys typed in the other site's iframe show as `•` by default. The top page can't observe them by any means (message events, DOM, timing of our element's changes).
- With "Mask other sites' iframes" turned off, keys show, and the top page still can't observe them.
- Same-origin iframes show keys normally (apart from sensitive fields).
- Fullscreen video, `spa.html`, `strict-csp.html`, reduced motion.

**How it's checked**
- Canary audit across both origins, with the top page instrumented to log everything it can see.
- Code review: child frames send data only through `chrome.runtime` messaging.
- Manual site checks (listed above).

**Exit gate**
- Canary audit passes in both masking modes; every manual site checked off.

## Ongoing

- All automated checks run in CI on every change.
- Any change that adds an event listener, message handler, permission, or storage write needs a review that names which of the five promises it touches.
- Before each release: re-run the manual site checks and compare permissions to the last release.
