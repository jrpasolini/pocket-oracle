import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

test('base href is in the head before any relative asset URL', () => {
  const baseAt = html.indexOf('<base href="/pocket-oracle/">');
  const manifestAt = html.indexOf('<link rel="manifest" href="manifest.json">');
  const cssAt = html.indexOf('<link rel="stylesheet" href="css/styles.css">');
  const scriptAt = html.indexOf('<script src="js/tailwindcss.js">');
  assert.ok(baseAt > 0, 'published index needs <base href="/pocket-oracle/">');
  assert.ok(baseAt < manifestAt && baseAt < cssAt && baseAt < scriptAt);
});

test('base tag is removed when the page is not served under /pocket-oracle', () => {
  const guardAt = html.indexOf("path === '/pocket-oracle'");
  const baseAt = html.indexOf('<base href="/pocket-oracle/">');
  const manifestAt = html.indexOf('<link rel="manifest" href="manifest.json">');
  assert.ok(guardAt > baseAt && guardAt < manifestAt);
  assert.match(html, /path\.indexOf\('\/pocket-oracle\/'\) === 0/);
  assert.match(html, /base\.remove\(\)/);
});

test('fragment URLs stay on this document when the base tag is active', () => {
  assert.match(html, /href="#main-content"/);
  assert.match(html, /a\[href\^="#"\], use\[href\^="#"\]/);
  assert.match(html, /location\.pathname \+ location\.search/);
  const fixerAt = html.indexOf('a[href^="#"], use[href^="#"]');
  const flagAt = html.indexOf('id="language-us-star"');
  assert.ok(flagAt > 0 && fixerAt > flagAt, 'SVG <use href="#..."> must be rewritten after it is parsed');
});

test('manifest and service worker keep paths relative to their own URLs', () => {
  assert.match(manifest, /"start_url": "\.\/index\.html"/);
  assert.match(manifest, /"src": "icons\/icon-192\.png"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(app, /const API_BASE = 'https:\/\/api\.jrpasolini\.tech'/);
  assert.doesNotMatch(app, /fetch\(\s*['"](?!https:)/);
});
