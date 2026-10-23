// Scripted sessions replayed with the overlay off and on.

export async function formSession(page) {
  await page.locator('#email').click();
  await page.keyboard.type('hello@test.io');
  await page.keyboard.press('Tab');
  await page.keyboard.type('pw123');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Backspace');
  await page.locator('#notes').click();
  await page.keyboard.type('line one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('line two');
  await page.keyboard.press('ArrowUp');
  await page.locator('#agree').click();
  await page.locator('#plan').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#link').click();
  await page.keyboard.press('Escape');
}

export async function selectionSession(page) {
  const box = await page.locator('#para').boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.locator('#para').dblclick();
}

export async function shortcutsSession(page) {
  await page.locator('#editor').click();
  await page.keyboard.type('abc');
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('open');
  await page.keyboard.press('Escape');
  await page.locator('h1').click();
  await page.keyboard.press('Shift+Slash');
  await page.keyboard.press('ControlOrMeta+a');
}

export async function editorsSession(page) {
  await page.locator('#rich').click();
  await page.keyboard.type('Rich text ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('bold');
  await page.locator('#plain').click();
  await page.keyboard.type('plain text');
  await page.keyboard.press('ControlOrMeta+z');
  await selectionSession(page);

  const c = await page.locator('#canvas').boundingBox();
  await page.mouse.move(c.x + 20, c.y + 20);
  await page.mouse.down();
  await page.mouse.move(c.x + 200, c.y + 150, { steps: 12 });
  await page.mouse.up();

  await page.locator('#drag').dragTo(page.locator('#drop'));
  await page.locator('#menu-target').click({ button: 'right' });
  await page.locator('#menu-target').click({ button: 'middle' });
}

// Clicks every point of a 10×10 grid inside `box`.
export function gridPoints(box, n = 10) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pts.push([box.x + ((i + 0.5) * box.width) / n, box.y + ((j + 0.5) * box.height) / n]);
    }
  }
  return pts;
}
