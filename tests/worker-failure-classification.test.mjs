import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;

// Relógio congelado: as fatias e o orçamento do Worker ficam determinísticos.
let clock = Date.parse('2026-10-16T12:00:00Z');
class TestDate extends Date {
  static now() { return clock; }
}

const source = readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8')
  .replace('export default {', 'const __worker = {');

const sandbox = {
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  btoa,
  atob,
  Date: TestDate,
  Response,
  Request,
  URL,
  AbortSignal,
  setTimeout: realSetTimeout,
  clearTimeout: realClearTimeout,
  fetch: async () => { throw new Error('fetch não deveria ser chamado neste teste'); },
  console: { log() {}, info() {}, warn() {}, error() {} }
};

runInNewContext(source + `
;globalThis.testAPI = {
  worker: __worker,
  ReadingError,
  WORKERS_AI_ERRORS,
  workersAiErrorCode,
  describeFailure,
  withTimeout,
  extractReading,
  validatePayload,
  validateReading,
  interpret,
  MODEL_CHAIN
};`, sandbox);
const api = sandbox.testAPI;

const GEMMA = api.MODEL_CHAIN[0].id;
const LLAMA = api.MODEL_CHAIN[1].id;
const ORIGIN = 'https://jrpasolini.github.io';
const QUESTION = 'pergunta-secreta-do-consulente-1234';

function payloadBody() {
  return {
    tipo: 'uma_carta',
    idioma: 'pt',
    pergunta: QUESTION,
    cartas: [{ nome: 'O Louco' }]
  };
}

function interpretRequest() {
  return new Request('https://example.com/interpretar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(payloadBody())
  });
}

function reading() {
  return {
    titulo: 'Um começo',
    abertura: 'Releia o caminho com calma.',
    resposta: 'Siga em frente.',
    orientacao: 'Considere as opções.',
    carta: { nome: 'ignorado pelo servidor', interpretacao: 'Novas possibilidades.' }
  };
}

function providerError(code, text = 'texto interno do provedor') {
  const error = new Error(`AiError: ${code}: ${text}`);
  error.code = code;
  return error;
}

// `run` responde por modelo; '*' é o curinga.
function mockEnv(map) {
  return {
    'tarot-ai': {
      run: async (modelId) => {
        const next = map[modelId] ?? map['*'];
        if (typeof next === 'function') return next(modelId);
        if (next instanceof Error) throw next;
        return next;
      }
    }
  };
}

function captureLogs() {
  const lines = [];
  const previous = sandbox.console;
  sandbox.console = {
    log() {}, info() {}, warn() {},
    error: (...args) => lines.push(args.map(value => String(value)).join(' '))
  };
  return { lines, restore: () => { sandbox.console = previous; } };
}

// --- ETAPA D: classificação das falhas ---------------------------------------

test('documented Workers AI codes map to distinct reasons', () => {
  assert.equal(api.WORKERS_AI_ERRORS.get(3036).reason, 'account_limited');
  assert.equal(api.WORKERS_AI_ERRORS.get(3040).reason, 'out_of_capacity');
  assert.equal(api.WORKERS_AI_ERRORS.get(5035).reason, 'paid_plan_required');
  assert.equal(api.WORKERS_AI_ERRORS.size, 3);
});

test('provider errors are classified by the internal code', () => {
  for (const [code, reason] of [[3036, 'account_limited'], [3040, 'out_of_capacity'], [5035, 'paid_plan_required']]) {
    const failure = api.describeFailure(providerError(code), { id: GEMMA }, 60_000);
    assert.equal(failure.kind, 'provider');
    assert.equal(failure.code, code);
    assert.equal(failure.reason, reason);
    assert.equal(failure.model, GEMMA);
  }
});

test('the code is also read from the provider message, and never logged with it', () => {
  const onlyMessage = new Error('AiError: 3040: Capacity temporarily exceeded, please try again.');
  assert.equal(api.workersAiErrorCode(onlyMessage), 3040);

  const failure = api.describeFailure(providerError(3036, QUESTION), { id: GEMMA }, 60_000);
  // O texto do provedor pode repetir o conteúdo do consulente: ele não entra no log.
  assert.equal(JSON.stringify(failure).includes(QUESTION), false);
  assert.equal(JSON.stringify(failure).includes('AiError'), false);
});

test('an unknown failure stays a generic provider failure, without inventing codes', () => {
  const failure = api.describeFailure(new TypeError('falha inesperada'), { id: LLAMA }, 60_000);
  assert.equal(failure.kind, 'provider');
  assert.equal(failure.reason, 'provider_error');
  assert.equal(failure.code, undefined);
  assert.equal(JSON.stringify(failure).includes('falha inesperada'), false);
});

test('the slice timeout is its own class, not a provider error', async () => {
  const error = await api.withTimeout(new Promise(() => {}), 5, GEMMA).then(() => null, caught => caught);
  assert.equal(error.name, 'TimeoutError');
  assert.equal(error.sliceMs, 5);

  const failure = api.describeFailure(error, { id: GEMMA }, 5);
  assert.equal(failure.kind, 'timeout');
  assert.equal(failure.reason, 'slice_timeout');
  assert.equal(failure.sliceMs, 5);
  assert.equal(failure.code, undefined);
});

test('invalid model output is classified as an invalid response, never as a provider error', () => {
  const empty = (() => {
    try { api.extractReading({ response: '' }); return null; } catch (error) { return error; }
  })();
  assert.equal(empty.name, 'ReadingError');

  const broken = (() => {
    try { api.extractReading({ response: `não é JSON ${QUESTION}` }); return null; } catch (error) { return error; }
  })();
  const failure = api.describeFailure(broken, { id: GEMMA }, 60_000);
  assert.equal(failure.kind, 'invalid_response');
  assert.equal(failure.reason, 'invalid_reading');
  assert.equal(failure.code, undefined);
  // A mensagem crua do JSON.parse (que traz a saída do modelo) é descartada.
  assert.equal(broken.message.includes(QUESTION), false);

  const wrongShape = (() => {
    try { api.validateReading({ ola: 'mundo' }, 'uma_carta', api.validatePayload(payloadBody())); return null; } catch (error) { return error; }
  })();
  assert.equal(api.describeFailure(wrongShape, { id: GEMMA }, 60_000).kind, 'invalid_response');
});

test('a transient 3040 capacity failure on the first model hands over to the next one', async () => {
  const env = mockEnv({
    [GEMMA]: providerError(3040),
    [LLAMA]: { response: JSON.stringify(reading()) }
  });
  const logs = captureLogs();
  try {
    const response = await api.interpret(interpretRequest(), env, ORIGIN, false, 'rid00001');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.model, LLAMA);
    assert.equal(body.fallbacksUsed, 1);

    const logged = logs.lines.join('\n');
    assert.match(logged, /\[interpretar rid00001\]/);
    assert.match(logged, /kind=provider/);
    assert.match(logged, /reason=out_of_capacity/);
    assert.match(logged, /code=3040/);
    assert.equal(logged.includes(QUESTION), false);
    assert.equal(logged.includes('Um começo'), false);
    assert.equal(logged.includes('AiError'), false);
  } finally {
    logs.restore();
  }
});

test('3036 daily account quota stops the cascade without calling the backup model', async () => {
  const calls = [];
  const env = {
    'tarot-ai': {
      run: async modelId => {
        calls.push(modelId);
        throw providerError(3036, QUESTION);
      }
    }
  };
  const logs = captureLogs();
  try {
    const response = await api.worker.fetch(interpretRequest(), env);
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.match(body.details, /cota diária/i);
    assert.deepEqual(calls, [GEMMA], 'Llama must not run after the account quota is exhausted');
    assert.equal(typeof body.requestId, 'string');
    assert.equal(body.requestId.length, 8);
    assert.equal(JSON.stringify(body).includes(QUESTION), false);
    const logged = logs.lines.join('\n');
    assert.match(logged, /reason=account_limited/);
    assert.match(logged, /code=3036/);
    assert.equal(logged.includes(QUESTION), false);
  } finally {
    logs.restore();
  }
});

test('a 5035 paid-plan restriction on Gemma can fall back to the independent free model', async () => {
  const calls = [];
  const env = {
    'tarot-ai': {
      run: async modelId => {
        calls.push(modelId);
        if (modelId === GEMMA) throw providerError(5035);
        return { response: JSON.stringify(reading()) };
      }
    }
  };
  const logs = captureLogs();
  try {
    const response = await api.interpret(interpretRequest(), env, ORIGIN, false, 'rid5035');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [GEMMA, LLAMA]);
    const body = await response.json();
    assert.equal(body.model, LLAMA);
    assert.equal(body.fallbacksUsed, 1);
    assert.match(logs.lines.join('\n'), /reason=paid_plan_required/);
  } finally {
    logs.restore();
  }
});

test('an invalid response on the first model also hands over to the next one', async () => {
  const env = mockEnv({
    [GEMMA]: { response: `isto não é JSON: ${QUESTION}` },
    [LLAMA]: { response: JSON.stringify(reading()) }
  });
  const logs = captureLogs();
  try {
    const response = await api.interpret(interpretRequest(), env, ORIGIN, false, 'rid00002');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.model, LLAMA);
    assert.equal(body.fallbacksUsed, 1);

    const logged = logs.lines.join('\n');
    assert.match(logged, /kind=invalid_response/);
    assert.match(logged, /reason=invalid_reading/);
    assert.equal(logged.includes(QUESTION), false);
  } finally {
    logs.restore();
  }
});

test('a model that never answers loses its slice and the cascade continues', async () => {
  // Acelera só o timer: a fatia de 60 s é preservada no cálculo (é ela que o log reporta).
  sandbox.setTimeout = (fn, ms) => realSetTimeout(fn, Math.min(ms, 10));
  const env = mockEnv({
    [GEMMA]: new Promise(() => {}),
    [LLAMA]: { response: JSON.stringify(reading()) }
  });
  const logs = captureLogs();
  try {
    const response = await api.interpret(interpretRequest(), env, ORIGIN, false, 'rid00003');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.model, LLAMA);
    assert.equal(body.fallbacksUsed, 1);

    const logged = logs.lines.join('\n');
    assert.match(logged, /kind=timeout/);
    assert.match(logged, /reason=slice_timeout/);
    assert.match(logged, /slice=60000ms/);
    assert.equal(/kind=provider/.test(logged), false);
  } finally {
    logs.restore();
    sandbox.setTimeout = realSetTimeout;
  }
});

test('when every model fails the user gets a generic, code-free error', async () => {
  const env = mockEnv({ '*': providerError(5035, QUESTION) });
  const logs = captureLogs();
  try {
    const error = await api.interpret(interpretRequest(), env, ORIGIN, false, 'rid00004')
      .then(() => null, caught => caught);
    assert.equal(error.name, 'RequestError');
    assert.equal(error.status, 502);
    assert.match(error.message, /Nenhum modelo conseguiu concluir a leitura agora\./);
    assert.equal(error.message.includes('5035'), false);
    assert.equal(error.message.includes(QUESTION), false);

    const logged = logs.lines.join('\n');
    assert.match(logged, /reason=paid_plan_required/);
    assert.match(logged, /code=5035/);
    assert.match(logged, /cascata falhou por completo/);
    assert.equal(logged.includes(QUESTION), false);
  } finally {
    logs.restore();
  }
});

test('the HTTP error body stays generic and carries the requestId', async () => {
  const request = interpretRequest();
  const response = await api.worker.fetch(request, mockEnv({ '*': providerError(3040) }));
  assert.equal(response.status, 502);

  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /Não foi possível realizar a interpretação\./);
  assert.match(body.details, /Nenhum modelo conseguiu concluir a leitura agora\./);
  assert.equal(typeof body.requestId, 'string');
  assert.equal(body.requestId.length, 8);

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('3040'), false);
  assert.equal(serialized.includes(QUESTION), false);
});

// --- ETAPA E: /health honesto ------------------------------------------------

const API_KEY = 'elevenlabs-api-key-for-tests-only';
const SIGNING_KEY = 'narration-signing-key-with-32-characters';

async function health(env) {
  const response = await api.worker.fetch(new Request('https://example.com/health', {
    headers: { Origin: ORIGIN }
  }), env);
  return { status: response.status, text: await response.text() };
}

test('/health reports narration only when BOTH keys are present', async () => {
  const complete = await health({ ELEVENLABS_API_KEY: API_KEY, NARRATION_SIGNING_KEY: SIGNING_KEY });
  assert.equal(complete.status, 200);
  assert.equal(JSON.parse(complete.text).narration, true);

  const incomplete = [
    { ELEVENLABS_API_KEY: API_KEY },
    { NARRATION_SIGNING_KEY: SIGNING_KEY },
    {},
    { ELEVENLABS_API_KEY: API_KEY, NARRATION_SIGNING_KEY: 'too-short' },
    { ELEVENLABS_API_KEY: '', NARRATION_SIGNING_KEY: SIGNING_KEY }
  ];
  for (const env of incomplete) {
    const result = await health(env);
    assert.equal(JSON.parse(result.text).narration, false);
  }
});

test('/health exposes no secret and no variable value, only booleans and counts', async () => {
  const { status, text } = await health({
    ELEVENLABS_API_KEY: API_KEY,
    NARRATION_SIGNING_KEY: SIGNING_KEY,
    DEBUG_TOKEN: 'debug-token-for-tests',
    ALLOWED_ORIGINS: 'https://example.org',
    ELEVENLABS_VOICE_ID: 'voice-id-for-tests'
  });
  assert.equal(status, 200);

  for (const secret of [API_KEY, SIGNING_KEY, 'debug-token-for-tests', 'voice-id-for-tests', 'https://example.org']) {
    assert.equal(text.includes(secret), false, `o /health não deve expor ${secret}`);
  }

  const body = JSON.parse(text);
  assert.equal(typeof body.narration, 'boolean');
  assert.equal(typeof body.allowedOrigins, 'number');
  assert.equal(body.allowedOrigins > 0, true);

  // `allowedOrigins` é a contagem esperada; o que não pode existir é qualquer
  // chave de configuração carregando valor.
  const suspicious = Object.keys(body).filter(key => /KEY|SECRET|TOKEN|VOICE/i.test(key));
  assert.deepEqual(suspicious, []);
});
