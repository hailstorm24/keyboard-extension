# Chrome Web Store submission

Text to paste into the Developer Dashboard, tab by tab. Anything in `[brackets]` is yours to fill in.

Before uploading, run `npm run package`. It runs every check, refuses uncommitted changes, and writes `key-overlay-<version>.zip`. Keep the `content.js sha256` it prints, to compare against the next upload.

---

## Store listing tab

**Name** (from the manifest)

```
Key Overlay
```

**Summary** (132 characters max; this one is 122)

```
Show keys you press and clicks you make as floating keycaps for demos, recordings, and testing. Nothing is stored or sent.
```

**Description**

```
Key Overlay shows the keys you press and the clicks you make, right on the page, so viewers of your screen recordings, demos, tutorials, and bug reports can follow along.

Turn it on for one tab at a time from the toolbar button or with Alt+Shift+K (⌥⇧K on Mac). Each key floats up as a keycap and fades away. Shortcuts show as one keycap, like ⌘+K. Clicks show a ripple at the cursor, with different styles for left, right, and middle clicks.

BUILT FOR PRIVACY
• Keys are only drawn on your screen. They are never stored, logged, or sent anywhere. The extension makes no network requests at all.
• Passwords, card numbers, one-time codes, and other sensitive fields show only •.
• Embedded forms from other sites, like payment fields, are masked by default.
• Clicks near masked fields, such as on-screen PIN pads, show no ripple.
• It runs only in tabs you turn on. Other tabs are never touched.

STAYS OUT OF THE WAY
• The overlay never blocks a click and never changes how the page behaves.
• Move it anywhere: click "Move overlay", drag, and press Esc.
• Choose a corner, and adjust size, speed, and spacing.
• Works in fullscreen video and with reduced-motion settings.

A NOTE ON SCREEN SHARING
Anything the overlay shows is visible to whoever sees your screen. Masking covers fields that identify themselves as sensitive, but not, for example, a PIN typed into an ordinary text box. Turn the overlay off before typing anything secret while recording.

Key Overlay is open source: [repository URL]
```

**Category:** Developer Tools

**Language:** English

**Graphic assets**

| Asset | Size | File | Shows |
|---|---|---|---|
| Store icon | 128×128 | `icons/icon-128.png` | Already has the required 16px padding |
| Screenshot 1 (required) | 1280×800 | `docs/store/screenshots/1-masking.png` | A sign-up form mid-typing: email letters and ⇥, then `•` for the password |
| Screenshot 2 | 1280×800 | `docs/store/screenshots/2-settings.png` | The popup next to the page, with its settings |
| Screenshot 3 | 1280×800 | `docs/store/screenshots/3-shortcuts-and-clicks.png` | A `⌘+K` keycap opening an app's command palette, and a click ripple |
| Small promo tile (if asked) | 440×280 | `docs/store/screenshots/promo-small-440x280.png` | The icon and "Key Overlay" |

All four images come from the real extension, captured by `npm run screenshots` on made-up demo pages in `scripts/screenshots/`. Run it again after any visual change. The popup in screenshot 2 is rendered separately and placed where Chrome shows it, because Chrome draws the real popup outside the page.

**Official URL / homepage:** [repository or project page URL]

**Support URL:** [repository issues URL, or a contact page]

---

## Privacy tab

**Single purpose**

```
Show the keys the user presses and the clicks they make as an on-screen overlay, in browser tabs the user turns it on for, so screen recordings and demos are easier to follow.
```

**Permission justifications**

`activeTab`

```
When the user clicks the toolbar button or presses the shortcut, the overlay is added to that tab only. activeTab gives access to just the tab the user chose, at the moment they choose it.
```

`scripting`

```
Used to inject the overlay script (content.js, packaged with the extension) into the tab the user turned on. No code is fetched or run from anywhere else.
```

`storage`

```
Saves the user's display settings (position, size, speed, spacing, and which masking options are on) and the list of tabs the overlay is on. Keys and clicks are never stored.
```

Host permission `<all_urls>` (optional, requested at runtime)

```
Optional. Requested when the user first turns the overlay on, so it can come back automatically after that tab navigates to another site. Without it, the overlay still works on the current page. The extension only ever runs in tabs the user has turned on, never in other tabs.
```

**Are you using remote code?** No

```
All code is packaged in the extension. There are no remote scripts, no eval, and no dynamic imports.
```

**Data usage**

Keys are read in the page and drawn on screen, but never leave the device. Google's form asks what you "collect", and this is a judgment call.

- **Recommended: tick "User activity"** (its examples include keystroke logging), and explain local-only handling in the justification below and in the privacy policy. Over-declaring is safer than a reviewer deciding you under-declared.
- **Alternative:** tick nothing, if you read "collect" as "transmit or store". Expect the reviewer to check the code to confirm.

Justification, if a field asks for one:

```
The extension reads key presses and clicks in tabs the user has turned it on for, only to draw them on screen. They are never stored, logged, sold, or transmitted. The extension makes no network requests.
```

**Certifications:** tick all three. They're true for this extension:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** host `docs/PRIVACY.md` publicly (for example with GitHub Pages) and paste the link here.

---

## Distribution tab

- **Payments:** Free
- **Visibility:** **Unlisted** for the first submission: only people with the link can install it. Install it from the store yourself, run the manual checks from `docs/TRUST.md`, then switch to Public.
- **Regions:** all regions

---

## Test instructions tab (notes for the reviewer)

If the dashboard has a test instructions field, paste this. No account or login is needed.

```
No account or login is needed.

To try it:
1. Open any normal website (for example, a site with a sign-up form).
2. Click the Key Overlay toolbar button and turn on the switch. (Or press Alt+Shift+K.) Chrome may ask for access to all sites; this is optional and only lets the overlay come back after the tab navigates to another site.
3. Type in a text field: each key floats up as a keycap in the bottom-right corner. Click anywhere to see a click ripple.
4. Type in a password field: only • appears.
5. In the popup, click "Move overlay", drag the bar, and press Esc to finish.

Privacy design, for review:
- The overlay runs only in tabs the user turns on (tracked in chrome.storage.session).
- Keys are drawn inside a closed shadow root and are never stored or transmitted. The code contains no fetch, XMLHttpRequest, WebSocket, sendBeacon, or other network APIs, and no remote code.
- chrome.storage.sync holds only display settings; chrome.storage.local is unused.
- Sensitive fields (password, credit card, and one-time-code autocomplete types) and other sites' iframes are masked by default.
- content.js is bundled with esbuild and not minified, so it is readable as submitted.
```

---

## Before each update

1. Bump `version` in `manifest.json`. The store rejects a version it has seen.
2. Commit, then run `npm run package`.
3. Compare the printed `content.js sha256` with the last upload. If it changed, review `git diff` for the release.
4. Upload the new zip under **Package**, then **Submit for review**.
