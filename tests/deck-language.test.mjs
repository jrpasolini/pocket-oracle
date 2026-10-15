import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const portuguese = read('js/cards.js');
const english = read('js/cards.en.js');
const i18n = read('js/i18n.js');
const workerSource = read('cloudflare-worker.js')
  .replace('export default {', 'const __worker = {');
const meaningFields = [
  'nome', 'descricao', 'interpretacao_imagem', 'palavras_chave',
  'palavras_chave_invertido', 'resposta_rapida', 'justificativa_resposta'
];

function frontend(storedLanguage = null) {
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
  // Classic scripts share a global lexical environment. Top-level const
  // bindings must remain distinct from properties of window.
  sandbox.window = sandbox;
  const context = createContext(sandbox);
  runInContext(portuguese, context);
  runInContext(english, context);
  runInContext(i18n, context);
  return { context, window: sandbox, api: sandbox.I18N };
}

function worker() {
  const context = createContext({});
  runInContext(workerSource, context);
  return runInContext('({ validatePayload })', context);
}

test('default English uses all translated names and meanings without window exports', () => {
  const { context, window, api } = frontend();
  assert.equal(window.cardDatabase, undefined);
  assert.equal(window.cardDatabaseEN, undefined);
  assert.equal(api.lang, 'en');
  const deck = api.cards();
  assert.ok(Array.isArray(deck), 'English deck must be available to the frontend');
  assert.equal(deck.length, 78);
  assert.equal(deck[0].nome, 'The Fool');
  assert.equal(deck[77].nome, 'King of Pentacles');
  const original = runInContext('cardDatabase', context);
  for (const [index, card] of deck.entries()) {
    for (const field of meaningFields) {
      const value = card[field];
      assert.ok(typeof value === 'string' ? value.trim().length : Array.isArray(value) && value.length,
        'Missing translation: card ' + index + ', field ' + field);
      assert.notEqual(JSON.stringify(value), JSON.stringify(original[index][field]),
        'Untranslated value: card ' + index + ', field ' + field);
    }
  }
});

test('saved Portuguese uses all 78 original cards', () => {
  const { api } = frontend('pt');
  assert.equal(api.lang, 'pt');
  assert.ok(Array.isArray(api.cards()));
  assert.equal(api.cards().length, 78);
  assert.equal(api.cards()[0].nome, 'O Louco');
  assert.equal(api.cards()[77].nome, 'Rei de Ouros');
});

test('switching EN to PT and back preserves all card identities and updates listeners', () => {
  const { api } = frontend();
  const original = api.cards();
  assert.ok(Array.isArray(original));
  const changes = [];
  api.onChange(language => changes.push(language));
  api.setLang('pt');
  const translated = api.cards();
  assert.ok(Array.isArray(translated));
  for (let index = 0; index < 78; index++) {
    assert.equal(translated[index].numero, original[index].numero);
    assert.equal(translated[index].imagem, original[index].imagem);
    assert.notEqual(translated[index].nome, original[index].nome);
  }
  api.setLang('en');
  assert.equal(api.cards(), original);
  assert.deepEqual(changes, ['pt', 'en']);
});

for (const language of ['en', 'pt']) {
  test(language + ': every displayed card passes Worker validation in one- and three-card spreads', () => {
    const { api } = frontend(language);
    const server = worker();
    const deck = api.cards();
    assert.ok(Array.isArray(deck));
    assert.equal(deck.length, 78);
    for (let index = 0; index < deck.length; index++) {
      for (const count of [1, 3]) {
        const drawn = Array.from({ length: count }, (_, offset) => deck[(index + offset) % deck.length]);
        const input = {
          tipo: count === 1 ? 'uma_carta' : 'tres_cartas',
          idioma: api.lang,
          pergunta: language === 'en' ? 'What should I reflect on?' : 'Sobre o que devo refletir?',
          cartas: drawn.map(card => ({ nome: card.nome }))
        };
        const validated = server.validatePayload(input);
        assert.equal(validated.idioma, language);
        assert.equal(validated.cartas.length, count);
        validated.cartas.forEach((card, offset) => {
          assert.equal(card.nome, drawn[offset].nome);
          assert.equal(card.descricao, drawn[offset].descricao);
          assert.equal(card.interpretacaoImagem, drawn[offset].interpretacao_imagem);
        });
      }
    }
  });
}
