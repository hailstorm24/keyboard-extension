// A command palette on ⌘K / Ctrl+K, like many web apps have.
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('main').classList.add('open');
    document.getElementById('palette-input').focus();
  }
});
