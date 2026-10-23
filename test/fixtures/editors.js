window.__pageState = { strokes: 0, points: 0, drops: 0, contextMenus: 0, dblclicks: 0 };

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  window.__pageState.strokes++;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  window.__pageState.points++;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});
window.addEventListener('pointerup', () => { drawing = false; });

const drop = document.getElementById('drop');
document.getElementById('drag').addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'drag'));
drop.addEventListener('dragover', (e) => e.preventDefault());
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  window.__pageState.drops++;
});

document.getElementById('menu-target').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.__pageState.contextMenus++;
});
document.getElementById('para').addEventListener('dblclick', () => window.__pageState.dblclicks++);
