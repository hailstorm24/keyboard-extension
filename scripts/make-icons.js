// Renders icons/icon.svg to the PNG sizes Chrome and the Web Store need,
// using the Chromium that Playwright already installs for the tests.
// Run after editing the SVG: node scripts/make-icons.js
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ICON_SIZES = [16, 32, 48, 128];

const dir = fileURLToPath(new URL('../icons/', import.meta.url));
const svg = await readFile(`${dir}icon.svg`, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

// The Web Store wants the 128px icon's artwork at 96×96 with 16px of
// transparent padding; the small toolbar sizes use the full square.
const PADDING = { 128: 16 };

for (const size of ICON_SIZES) {
  const pad = PADDING[size] ?? 0;
  const art = size - 2 * pad;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;margin:${pad}px;width:${art}px;height:${art}px}</style>${svg}`,
  );
  await page.screenshot({ path: `${dir}icon-${size}.png`, omitBackground: true });
}

await browser.close();
process.stdout.write(`wrote ${ICON_SIZES.map((s) => `icon-${s}.png`).join(', ')}\n`);
