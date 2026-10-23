# Tests

Written before the extension, from [docs/DESIGN.md](../docs/DESIGN.md) and [docs/TRUST.md](../docs/TRUST.md). Until each stage is built, its tests fail.

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint over `src/`, with the banned-API rules from TRUST.md |
| `npm run test:static` | Manifest permissions vs. the allowlist, no runtime dependencies, banned-API text search |
| `npm run test:unit` | Pure logic in Node: key labels, modifier tracking, masking, clicks, settings, position |
| `npm run test:e2e` | Builds the extension and drives it in Chromium with Playwright |
| `npm test` | All of the above |
| `npm run fixtures` | Serves the fixture pages on their own, for poking at by hand |

## Layout

```
test/
├── unit/                 # node:test, imports src/ modules directly
├── static/               # node:test, reads manifest.json, package.json, src/
│   └── permissions.allowlist.json
├── e2e/
│   ├── stage1-toggle.spec.js … stage7-edge-cases.spec.js
│   ├── privacy.spec.js   # canary audit and network silence over a full session
│   └── support/
│       ├── contract.js   # what the tests expect the extension to expose
│       ├── fixtures.js   # Chromium with the extension, the `ext` driver, console and network capture
│       ├── overlay.js    # reads the closed shadow root over CDP
│       ├── sessions.js   # scripted sessions for the off-vs-on comparison
│       └── global-setup.js
├── fixtures/             # test pages, served on two origins
└── server.js             # http://localhost:3000 and http://127.0.0.1:3001
```

## What the extension must provide

The tests don't use any test-only hooks in the extension. They drive it the same way the popup does and read the overlay through the Chrome DevTools Protocol. They depend on these names, collected in [e2e/support/contract.js](e2e/support/contract.js):

**Modules** (unit tests import these):

| Module | Exports |
|---|---|
| `src/content/keys.js` | `formatKey(event, {groupCombos})`, `createKeyTracker({groupCombos})` → `{down, up, setOptions}`, `formatComposition(event)`, `createMaskPolicy()` → `{shouldMask(el, {settings, crossOriginFrame})}`, `MASK_CHAR` |
| `src/content/clicks.js` | `rippleFor(event, {showClicks})`, `isNearRect(point, rect, margin = 48)`, `isNearAny(point, rects)` |
| `src/shared/settings.js` | `DEFAULTS`, `LIMITS`, `SETTINGS_KEY`, `normalize(raw)`, `cornerPosition('tl' \| 'tr' \| 'bl' \| 'br')` |
| `src/shared/position.js` | `toPixels(fraction, box, viewport)`, `toFraction(pixels, box, viewport)` |
| `src/shared/messages.js` | `MSG`, `isFromExtension(sender, runtimeId)` |

**Messages:** the background answers `{type: 'key-overlay:set-tab-enabled', tabId, enabled}` with `{ok: true}` or `{ok: false, reason: 'restricted'}`. Content scripts handle `key-overlay:enter-move-mode` and `key-overlay:exit-move-mode`.

**Storage:** settings in `chrome.storage.sync` under `settings`; the tabs that are on in `chrome.storage.session` under `enabledTabs` (an array of tab ids). Nothing in `chrome.storage.local`.

**Overlay DOM:** `<key-overlay-host aria-hidden="true">` with a closed shadow root containing:

- `.key-area`: the positioned box, with CSS custom properties `--key-size` (`1`), `--key-speed` (`2.2s`), and `--key-spacing` (`8px`)
- `.keycap`: one per key, text is the label, animation `keycap-float` (or `keycap-fade` with reduced motion), `animation-duration` equal to the speed setting
- `.click-layer` holding `.ripple[data-kind="left|middle|right|touch|pen"]`, centered on the click
- `.grip`: only present in move mode

**Popup ids:** `#enabled`, `#size`, `#speed`, `#spacing`, `#mask-sensitive`, `#mask-frames`, `#group-combos`, `#show-clicks`, `#move`, `#corner-tl`/`-tr`/`-bl`/`-br`.

## How the e2e run works

1. `global-setup.js` builds the extension into `.e2e-extension/` with `scripts/build.js`. It then moves `<all_urls>` from optional to granted, because automation can't click Chrome's permission prompt. The "Stays in its tab" tests are stronger this way: even with the broad permission granted, untouched tabs must stay untouched.
2. Each test gets a fresh Chromium profile with the extension loaded.
3. `ext` (in `fixtures.js`) opens an extension page and calls `chrome.*` from it, which is the same path the popup uses.
4. `overlay.js` uses `DOM.getDocument({pierce: true})` to read the closed shadow root, which page scripts can't do.

## Tests marked `fixme`

These are manual checks that automation can't cover: incognito, the ⌥⇧K shortcut, the install warning text, the popup's message on restricted pages, and the real-site checklist. They show up as skipped in every run so they don't get forgotten.
