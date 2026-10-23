document.getElementById('pinpad').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') document.getElementById('pin').value += e.target.textContent;
});
