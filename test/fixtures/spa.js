// Client-side "navigation" the way some frameworks do it: replace the whole
// <body>, or even every child of <html>.
window.spa = {
  replaceBody() {
    const body = document.createElement('body');
    const h1 = document.createElement('h1');
    h1.textContent = 'Settings';
    const label = document.createElement('label');
    label.textContent = 'Name ';
    const input = document.createElement('input');
    input.id = 'name';
    label.append(input);
    body.append(h1, label);
    document.body.replaceWith(body);
    history.pushState({}, '', '/spa.html#settings');
  },

  replaceDocument() {
    const html = document.documentElement;
    while (html.firstChild) html.firstChild.remove();
    const head = document.createElement('head');
    const body = document.createElement('body');
    const input = document.createElement('input');
    input.id = 'name';
    body.append(input);
    html.append(head, body);
  },
};

document.getElementById('go').addEventListener('click', () => window.spa.replaceBody());
