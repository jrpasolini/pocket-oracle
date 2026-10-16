import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function translations() {
  const context = {
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      documentElement: {}
    },
    window: { localStorage: { getItem: () => null, setItem() {} } }
  };
  runInNewContext(read('js/i18n.js'), context);
  return context.window.I18N;
}

test('privacy message explains local draw and explicit Cloudflare AI transfer in both languages', () => {
  const i18n = translations();
  for (const [lang, expected] of [
    ['en', 'Your draw stays in the browser. If you use AI, your question and the names of the cards are sent to Cloudflare.'],
    ['pt', 'Sua tiragem fica no navegador. Se usar a IA, sua pergunta e os nomes das cartas são enviados à Cloudflare.']
  ]) {
    i18n.setLang(lang);
    const notice = i18n.t('question_note');
    assert.equal(notice, expected);
    assert.ok(notice.length < 125, `Privacy notice is too long in ${lang}`);
  }
  const html = read('index.html');
  assert.match(html, /data-i18n="question_note"/);
  assert.match(html, /If you use AI, your question and the names of the cards are sent to Cloudflare\./);
});

test('honest 30–100-second estimate appears before and during AI interpretation in both locales', () => {
  const i18n = translations();
  for (const lang of ['en', 'pt']) {
    i18n.setLang(lang);
    for (const key of ['hint_ready', 'loading_desc']) {
      assert.match(i18n.t(key), /30/);
      assert.match(i18n.t(key), /100/);
      if (key === 'loading_desc') assert.ok(i18n.t(key).length < 80, `Loading message too long in ${lang}`);
    }
  }
  const html = read('index.html');
  assert.match(html, /data-i18n="loading_desc"/);
  assert.match(html, /AI is interpreting your spread\. This may take 30 to 100 seconds\./);
});

test('unused standalone card prototypes are absent from the deployed app', () => {
  for (const file of [
    'cartas/olouco-base64.html', 'cartas/olouco.html', 'cartas/omago.html',
    'cartas/asarcedotisa.html', 'cartas/aimperatriz.html', 'cartas/oimperador.html'
  ]) {
    assert.equal(existsSync(new URL('../' + file, import.meta.url)), false, file);
  }
  assert.doesNotMatch(read('README.md'), /`cartas\/`/);
  assert.doesNotMatch(read('README.pt-BR.md'), /`cartas\/`/);
});
