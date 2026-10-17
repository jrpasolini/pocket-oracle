import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const source = readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8')
  .replace('export default {', 'const __worker = {');
const sandbox = {
  crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob,
  Date, Request, Response, URL, AbortSignal, setTimeout, clearTimeout,
  console: { log() {}, info() {}, warn() {}, error() {} }
};
runInNewContext(source +
  '\n;globalThis.api = { interpret, validatePayload, buildMessages, MODEL_CHAIN };', sandbox);
const { interpret, validatePayload, buildMessages, MODEL_CHAIN } = sandbox.api;

function request(language, question, cardName) {
  return new Request('https://example.com/interpretar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'uma_carta', idioma: language,
      pergunta: question, cartas: [{ nome: cardName }]
    })
  });
}
function reading(language, prose) {
  return {
    titulo: language === 'pt' ? 'Uma reflexão' : 'Reflection',
    abertura: prose,
    carta: { nome: 'ignored: Worker restores the canonical card name', interpretacao: prose },
    resposta: prose,
    orientacao: prose
  };
}
function aiEnvironment(readingPayload, preferredModel = MODEL_CHAIN[0].id) {
  const calls = [];
  const env = { AI: { async run(id, options) {
    calls.push({ id, options });
    if (id !== preferredModel) throw new Error('Expected only the first model');
    return { response: JSON.stringify(readingPayload) };
  } } };
  return { env, calls };
}

test('a Portuguese question is carried intact even when the interface is English', () => {
  const payload = validatePayload({
    tipo: 'uma_carta', idioma: 'en',
    pergunta: 'Como posso melhorar minha comunicação?',
    cartas: [{ nome: 'The Fool' }]
  });
  const messages = buildMessages(payload, MODEL_CHAIN[0]);
  assert.equal(payload.idioma, 'en');
  assert.match(messages[1].content, /Como posso melhorar minha comunicação/);
  assert.match(messages[0].content, /Wands, Cups, Swords, and Pentacles/);
  assert.doesNotMatch(source, /function verifyReadingLanguage/);
  assert.doesNotMatch(source, /OUTPUT LANGUAGE: English only/);
});

test('English interface accepts a valid interpretation written in Portuguese', async () => {
  const text = 'Esta leitura convida você a refletir sobre as possibilidades e decidir com autonomia.';
  const mock = aiEnvironment(reading('pt', text));
  const response = await interpret(
    request('en', 'Como posso melhorar minha comunicação?', 'The Fool'),
    mock.env, null, false, 'multiPT'
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.model, MODEL_CHAIN[0].id);
  assert.equal(data.fallbacksUsed, 0);
  assert.equal(data.interpretacao.abertura, text);
  assert.equal(data.interpretacao.carta.nome, 'The Fool');
  assert.equal(mock.calls.length, 1, 'Do not spend a second model call due to response language');
});

test('Portuguese interface accepts a valid interpretation in English', async () => {
  const text = 'The card encourages reflection and practical action without promising a fixed future.';
  const mock = aiEnvironment(reading('en', text));
  const response = await interpret(
    request('pt', 'What could I do next?', 'O Louco'),
    mock.env, null, false, 'multiEN'
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.fallbacksUsed, 0);
  assert.equal(data.interpretacao.abertura, text);
  assert.equal(data.interpretacao.carta.nome, 'O Louco');
  assert.equal(mock.calls.length, 1);
});

test('neither interface locale blocks a valid Spanish interpretation', async () => {
  const text = 'Esta lectura propone considerar tus opciones con calma y confiar en tu criterio.';
  for (const [language, card] of [['pt', 'O Louco'], ['en', 'The Fool']]) {
    const mock = aiEnvironment(reading('en', text));
    const response = await interpret(
      request(language, '¿Qué debería considerar antes de decidir?', card),
      mock.env, null, false, 'multiES'
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.interpretacao.abertura, text);
    assert.equal(data.fallbacksUsed, 0);
    assert.equal(mock.calls.length, 1);
  }
});

test('normal structural validation still applies to multilingual responses', async () => {
  const broken = reading('pt', '');
  const mock = { AI: { async run() { return { response: JSON.stringify(broken) }; } } };
  await assert.rejects(
    interpret(request('en', 'O que fazer?', 'The Fool'), mock, null, false, 'invalid'),
    err => err.name === 'RequestError' && err.status === 502
  );
});
