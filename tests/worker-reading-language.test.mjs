import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const workerCode = readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8')
  .replace('export default {', 'const __worker = {');
const sandbox = {
  crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob,
  Date, Response, Request, URL, AbortSignal, setTimeout, clearTimeout,
  console: { log() {}, info() {}, warn() {}, error() {} }
};
runInNewContext(workerCode + '\n;globalThis.api = { verifyReadingLanguage, validateReading, validatePayload, buildMessages, interpret, MODEL_CHAIN, describeFailure };', sandbox);
const api = sandbox.api;
const [GEMMA, LLAMA] = api.MODEL_CHAIN.map(model => model.id);

const portugueseProse =
  'Seja bem-vindo a esta leitura. Ao buscar uma resposta, você encontra uma oportunidade ' +
  'de observar sua situação com mais clareza e calma. A carta sugere que é importante ' +
  'considerar o caminho com atenção, pois a decisão deve ser tomada por você. ' +
  'Ainda que exista uma dúvida, não é necessário agir agora; este momento é para ' +
  'refletir sobre as escolhas, compreender suas emoções e buscar sua própria verdade. ' +
  'Sua resposta está ligada à forma como você observa os fatos e considera as possibilidades.';

const englishProse =
  'Welcome to this reading. The card encourages you to reflect on the choices ' +
  'in front of you and consider the possible paths with care. This is not a fixed ' +
  'prediction about your future. It is an invitation to look at the situation ' +
  'with clarity, to understand what matters most, and to think through the next ' +
  'step. You can take your time before making a decision. The answer to your question ' +
  'depends on your circumstances and the practical choices you make along the way.';

function reading(prose, name = 'The Fool') {
  return {
    titulo: 'A title',
    abertura: prose,
    carta: { nome: name, interpretacao: prose },
    resposta: prose,
    orientacao: prose
  };
}

function englishRequest() {
  return new Request('https://example.com/interpretar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'uma_carta',
      idioma: 'en',
      pergunta: 'Como devo encarar esta mudança?',
      cartas: [{ nome: 'The Fool' }]
    })
  });
}

test('English output is required even when the visitor writes the question in Portuguese', () => {
  const payload = api.validatePayload({
    tipo: 'uma_carta',
    idioma: 'en',
    pergunta: 'Como devo encarar esta mudança?',
    cartas: [{ nome: 'The Fool' }]
  });
  assert.equal(payload.idioma, 'en');
  const messages = api.buildMessages(payload, api.MODEL_CHAIN[0]);
  assert.match(messages[0].content, /regardless of the language of the user's question/i);
  assert.match(messages[1].content, /OUTPUT LANGUAGE: English only/);
  assert.match(messages[1].content, /Como devo encarar esta mudança\?/);
  assert.ok(!messages[1].content.includes('Faça a interpretação'));
});

test('Portuguese output is required even when the visitor writes the question in English', () => {
  const payload = api.validatePayload({
    tipo: 'uma_carta',
    idioma: 'pt',
    pergunta: 'How do I face a change?',
    cartas: [{ nome: 'O Louco' }]
  });
  const messages = api.buildMessages(payload, api.MODEL_CHAIN[0]);
  assert.match(messages[0].content, /IDIOMA OBRIGATÓRIO/);
  assert.match(messages[1].content, /IDIOMA DA RESPOSTA: português brasileiro/);
});

test('confidently wrong narrative language is rejected in either direction', () => {
  assert.throws(() => api.verifyReadingLanguage(reading(portugueseProse), 'en'), /idioma divergente/);
  assert.throws(() => api.verifyReadingLanguage(reading(englishProse, 'O Louco'), 'pt'), /idioma divergente/);
  assert.equal(api.verifyReadingLanguage(reading(englishProse), 'en').abertura, englishProse);
  assert.equal(api.verifyReadingLanguage(reading(portugueseProse, 'O Louco'), 'pt').abertura, portugueseProse);
});

test('one brief Portuguese quotation does not invalidate an otherwise English interpretation', () => {
  const bilingual = englishProse + ' The visitor asked: "Como devo encarar esta mudança?"';
  assert.equal(api.verifyReadingLanguage(reading(bilingual), 'en').abertura, bilingual);
});

test('English visitor with Portuguese question: a wrong-language Gemma output falls back to Llama', async () => {
  const calls = [];
  const env = {
    AI: {
      async run(model, options) {
        calls.push({ model, system: options.messages[0].content });
        return { response: JSON.stringify(model === GEMMA
          ? reading(portugueseProse)
          : reading(englishProse)) };
      }
    }
  };
  const response = await api.interpret(englishRequest(), env, null, true, 'testlang');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.idioma, 'en');
  assert.equal(data.model, LLAMA);
  assert.equal(data.fallbacksUsed, 1);
  assert.equal(data.debug.failures[0].kind, 'invalid_response');
  assert.equal(data.debug.failures[0].reason, 'invalid_reading');
  assert.deepEqual(calls.map(x => x.model), [GEMMA, LLAMA]);
  assert.match(data.interpretacao.abertura, /Welcome to this reading/);
  assert.equal(JSON.stringify(data.debug).includes('Como devo encarar'), false);
});

test('no model returning correct locale gives a clean error, not a mixed-language success', async () => {
  const env = {
    AI: {
      async run() { return { response: JSON.stringify(reading(portugueseProse)) }; }
    }
  };
  await assert.rejects(
    api.interpret(englishRequest(), env, null, false, 'langfail'),
    error => error.name === 'RequestError' && error.status === 502
  );
});
