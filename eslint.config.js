// Lint rules that back the "Private" and "Minimal" promises in docs/TRUST.md.
// test/static/banned-apis.test.js re-checks the same list without ESLint, so
// loosening a rule here still fails CI.
import js from '@eslint/js';
import globals from 'globals';

const BANNED_GLOBALS = [
  ['fetch', 'The extension never makes network requests.'],
  ['XMLHttpRequest', 'The extension never makes network requests.'],
  ['WebSocket', 'The extension never makes network requests.'],
  ['EventSource', 'The extension never makes network requests.'],
  ['eval', 'No dynamic code.'],
  ['Function', 'No dynamic code.'],
  ['importScripts', 'No dynamic code.'],
  ['localStorage', 'Only chrome.storage, and only for settings.'],
  ['sessionStorage', 'Only chrome.storage, and only for settings.'],
  ['indexedDB', 'Only chrome.storage, and only for settings.'],
];

const BANNED_PROPERTIES = [
  ['navigator', 'sendBeacon', 'The extension never makes network requests.'],
  ['window', 'postMessage', 'The page can read postMessage. Use chrome.runtime messaging.'],
  ['self', 'postMessage', 'The page can read postMessage. Use chrome.runtime messaging.'],
  [null, 'innerHTML', 'Set keycap text with textContent.'],
  [null, 'outerHTML', 'Set keycap text with textContent.'],
  [null, 'insertAdjacentHTML', 'Set keycap text with textContent.'],
  [null, 'preventDefault', 'The overlay must never change how the page handles input.'],
  [null, 'stopPropagation', 'The overlay must never change how the page handles input.'],
  [null, 'stopImmediatePropagation', 'The overlay must never change how the page handles input.'],
];

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker },
    },
    rules: {
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-globals': ['error', ...BANNED_GLOBALS.map(([name, message]) => ({ name, message }))],
      'no-restricted-properties': [
        'error',
        ...BANNED_PROPERTIES.map(([object, property, message]) =>
          object ? { object, property, message } : { property, message },
        ),
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'No dynamic imports; all code ships in the package.' },
        { selector: "CallExpression[callee.name='postMessage']", message: 'Use chrome.runtime messaging.' },
      ],
    },
  },
];
