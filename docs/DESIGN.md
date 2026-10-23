# Key Overlay: Design

A Chrome extension for testing and demoing websites. When it's turned on for a tab, each key you press appears as a keycap that floats up and fades out, and each mouse click shows a ripple at the cursor.

See [TRUST.md](TRUST.md) for the privacy and safety promises, and how each stage is checked against them.

## Goals

- Show keys and clicks clearly enough for screen recordings, demos, and bug reports.
- Work on any site without changing how that site behaves.
- Run only in tabs the user turned on.
- Never block a click, and never keep or send what the user types.

## Non-goals

- Recording or exporting keystrokes. The overlay is display-only.
- Working on `chrome://` pages or the Chrome Web Store. Chrome doesn't allow it.

## User-facing behavior

### Turning it on

- Click the toolbar icon to open the popup, then flip the switch. This affects **the current tab only**.
- Shortcut: `⌥⇧K` turns the current tab on or off.
- The toolbar badge shows `ON` for tabs where it's running.
- A tab stays on through reloads and navigation until the user turns it off or closes the tab.

### Keys

- Keycaps appear in the overlay area and rise, then fade out.
- Special keys show as symbols: `⌘ ⌃ ⌥ ⇧ ↵ ⌫ ⇥ ⇪ Esc ↑ ↓ ← →`, `Space`.
- With "Group combos" on, shortcuts show as one keycap (`⌘+K`) instead of separate keys.
- A held key shows once, not once per auto-repeat.
- **Masking.** These show as `•` instead of the real key:
  - password fields (`type="password"`, including after a "show password" toggle turns them into text fields)
  - fields with `autocomplete` of `cc-*`, `one-time-code`, `current-password`, or `new-password`
  - **any iframe from a different origin than the page**, on by default; a setting lets the user turn this off

### Clicks

- Each click shows a ripple at the cursor, styled differently for left, right, and middle buttons.
- No ripple is shown for clicks on or near a masked field, so on-screen PIN pads don't reveal which digits were pressed.

### Moving the overlay

- Normally the whole overlay ignores the mouse, so every click goes to the page.
- The popup's **Move overlay** button starts move mode: a grip and outline appear, and only the grip responds to the mouse.
- Drag the grip to place the overlay. Press **Done**, `Esc`, switch tabs, or navigate to leave move mode.
- The popup's corner picker is a shortcut that sets the same saved position.

### Settings

| Setting | Default | Range / values |
|---|---|---|
| Position | bottom right | saved as a fraction of the viewport, e.g. `{x: 0.92, y: 0.85}` |
| Size | 1.0× | 0.7× – 1.5× |
| Speed (float duration) | 2.2 s | 1 – 4 s |
| Spacing (gap between keycaps / how wide they spread) | 8 px | 0 – 32 px |
| Mask password and payment fields | on | on / off |
| Mask other sites' iframes | on | on / off |
| Group combos | on | on / off |
| Show clicks | on | on / off |
| Click color | accent | color |

Settings are saved in `chrome.storage.sync`, apply to all tabs, and take effect immediately.

## Architecture

### File structure

```
keyboard-extension/
├── manifest.json            # MV3: permissions, service worker, popup, commands
├── src/
│   ├── background.js        # tracks which tabs are on, injects scripts, handles ⌥⇧K
│   ├── content/
│   │   ├── index.js         # entry point: wires capture, overlay, settings together
│   │   ├── overlay.js       # Shadow DOM host, key area, click layer, drag grip
│   │   ├── keys.js          # key event → label ("⌘+K", "⇧", "•" when masked)
│   │   ├── clicks.js        # click → ripple at the cursor
│   │   └── overlay.css      # loaded into the shadow root, not the page
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js         # switch for this tab, settings controls, "Move overlay"
│   │   └── popup.css
│   └── shared/
│       ├── settings.js      # defaults, schema, load/save, change subscription
│       └── messages.js      # message names between popup, background, page
├── test/                    # see TRUST.md
├── docs/
│   ├── DESIGN.md
│   └── TRUST.md
└── icons/                   # 16/32/48/128, plus an "on" toolbar badge
```

Plain ES modules, no build step and no third-party runtime dependencies.

### Pieces and how they talk

```
 popup.js ──(toggle, enterMoveMode)──▶ background.js ──(executeScript / tabs.sendMessage)──▶ content (top frame)
                                           ▲                                                      ▲
                                           │ chrome.runtime messages                              │
                                     content (child frames) ──(key/click events, masked)─────────┘
                                     
 settings.js ◀── chrome.storage.sync ──▶ storage.onChanged ──▶ every running content script
```

- **background.js** keeps the set of tabs that are on in `chrome.storage.session`, so it survives the service worker being stopped. It injects the content script when a tab is turned on and again on `tabs.onUpdated` for tabs that are on, and sets the badge.
- **Content scripts** run in every frame of a tab that's on. The top frame draws the overlay. Child frames don't draw anything; they send key labels and click positions to the top frame through the background script (`chrome.runtime` messaging), **never** `window.postMessage`, which the page could read. Masking is decided in the frame where the key was pressed, before anything is sent.
- Every incoming message is checked to come from the extension itself. Anything else is ignored.

### Overlay

- One custom element (`<key-overlay-host>`) added to `document.documentElement`, with inline `all: initial !important`, a very high `z-index`, and `aria-hidden="true"`.
- Closed shadow root. Styles load through `adoptedStyleSheets`, so the page's CSS can't reach them and strict Content Security Policies don't block them.
- Two layers inside, both `pointer-events: none`:
  - **Key area** at the saved position.
  - **Click layer** covering the viewport, for ripples.
- In move mode only the grip has `pointer-events: auto`, and it uses pointer capture while dragging.
- If the page removes our element, a `MutationObserver` re-adds it.
- When an element goes fullscreen, the host moves inside it, and moves back when fullscreen ends.

### Event capture

- `keydown` and `pointerdown` listeners on `window` in the capture phase, `{ passive: true }`.
- Never call `preventDefault`, `stopPropagation`, or change the event.
- Ignore events where `isTrusted` is false, so the page can't put fake keys in the overlay.
- IME composition: show the final composed text, not each intermediate keystroke.

### Rendering

- Keycap text is set only with `textContent`.
- Animations use `transform` and `opacity` only.
- At most ~30 keycaps on screen; the oldest are removed first.
- With `prefers-reduced-motion`, keycaps fade in place instead of floating.

### Permissions

| Permission | Why |
|---|---|
| `activeTab` | Inject into the current tab when the user turns it on |
| `scripting` | `chrome.scripting.executeScript` |
| `storage` | Settings (`sync`) and the set of tabs that are on (`session`) |
| `<all_urls>` (optional) | Re-inject after navigating to another site. Requested the first time it's needed, not at install |

## Build stages

Each stage has exit gates in [TRUST.md](TRUST.md) that must pass before starting the next one.

1. **Skeleton and per-tab switch.** Manifest, background script, popup switch, badge, `⌥⇧K`, injection and teardown, re-injection on navigation.
2. **Shadow DOM overlay.** Host element, closed shadow root, both layers, re-adding when the page removes our element.
3. **Keys.** Capture, labels, combos, held keys, masking rules, keycap limit, animation.
4. **Clicks.** Ripples by mouse button, touch and pen, no ripples near masked fields.
5. **Settings and popup.** Schema with clamping, `storage.sync`, live updates, all controls.
6. **Dragging.** Move mode, grip, pointer capture, positions saved as fractions of the viewport, exiting move mode.
7. **Edge cases and polish.** Iframes (with masking for other sites' iframes), fullscreen, single-page apps, strict-CSP pages, reduced motion, restricted-page message in the popup.

Stages 1–3 give a usable tool, 4–6 add features, and 7 is hardening.
