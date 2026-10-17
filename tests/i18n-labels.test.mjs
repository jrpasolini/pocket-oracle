import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const i18n = read('js/i18n.js');
const app = read('js/app.js');

const LABELS = {
  results_one: ['card', 'carta'],
  results_many: ['cards', 'cartas'],
  open_card: ['Open', 'Abrir'],
  card_element: ['Element', 'Elemento'],
  card_suit: ['Suit', 'Naipe'],
  card_planet: ['Planet', 'Planeta'],
  card_sign: ['Sign', 'Signo'],
  card_drawn: ['Card drawn', 'Carta sorteada']
};

function frontend(storedLanguage) {
  const storage = new Map();
  if (storedLanguage) storage.set('pocket-oracle-lang', storedLanguage);
  const sandbox = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      documentElement: {}
    }
  };
  sandbox.window = sandbox;
  runInContext(i18n, createContext(sandbox));
  return sandbox.I18N;
}

test('os rótulos de interface existem nos dois idiomas', () => {
  const en = frontend('en');
  const pt = frontend('pt');
  for (const [key, [english, portuguese]] of Object.entries(LABELS)) {
    assert.equal(en.t(key), english, key + ' (en)');
    assert.equal(pt.t(key), portuguese, key + ' (pt)');
  }
});

test('js/app.js não carrega mais rótulos fixos em português', () => {
  const leftovers = [
    "'carta' : 'cartas'",
    'Abrir ${',
    '🔥 Elemento:',
    '🃏 Naipe:',
    '🪐 Planeta:',
    '✨ Signo:',
    "'Carta sorteada'"
  ];
  for (const literal of leftovers) {
    assert.equal(app.includes(literal), false, 'ainda contém: ' + literal);
  }
  assert.ok(
    app.includes("t(visible.length === 1 ? 'results_one' : 'results_many')"),
    'a contagem de resultados não usa as chaves de plural'
  );
  for (const key of ['open_card', 'card_element', 'card_suit', 'card_planet', 'card_sign', 'card_drawn']) {
    assert.ok(app.includes(`t('${key}')`), `não usa t('${key}')`);
  }
});
