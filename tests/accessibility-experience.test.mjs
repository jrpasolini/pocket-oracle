import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../js/accessibility.js', import.meta.url), 'utf8');
const appScript = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const translations = readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function harness({ initialTheme = null, locale = 'en', speech = true } = {}) {
  const listeners = {};
  const persisted = new Map();
  if (initialTheme) persisted.set('pocket-oracle-theme', initialTheme);
  const attributes = () => ({
    attrs: {},
    span: { textContent: '' },
    disabled: false,
    addEventListener(type, cb) { this.events ||= {}; this.events[type] = cb; },
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector() { return this.span; },
    click() { this.events.click(); }
  });
  const themeButton = attributes();
  const speakButton = attributes();
  const cardButton = attributes();
  const homeHeading = { cloneNode: () => ({ textContent: 'The 78 Tarot Cards. Learn the symbols.', querySelectorAll: () => [] }) };
  const visible = { classList: { contains: () => false }, id: 'home-view', querySelector: () => homeHeading, contains: () => false };
  const hidden = id => ({ id, classList: { contains: () => true } });
  const nodes = {
    'theme-toggle': themeButton,
    'site-read-toggle': speakButton,
    'read-card-button': cardButton,
    'home-view': visible,
    'card-detail-view': hidden('card-detail-view'),
    'random-draw-view': hidden('random-draw-view')
  };
  const root = { dataset: {}, style: {} };
  const meta = { content: '' };
  const document = {
    documentElement: root,
    getElementById: id => nodes[id] || null,
    querySelector: selector => selector === 'meta[name="theme-color"]' ? meta : null,
    querySelectorAll: () => []
  };
  let speaking = null;
  let cancellations = 0;
  const synth = {
    cancel() { cancellations++; },
    getVoices: () => [{ lang: 'en-US', name: 'English' }, { lang: 'pt-BR', name: 'Português' }],
    speak(utterance) { speaking = utterance; }
  };
  class FakeSpeech {
    constructor(text) { this.text = text; }
  }
  const window = {
    I18N: {
      lang: locale,
      t: key => key,
      onChange: cb => { listeners.language = cb; }
    },
    localStorage: {
      getItem: key => persisted.get(key) || null,
      setItem: (key, value) => persisted.set(key, value)
    },
    getSelection: () => null
  };
  if (speech) {
    window.speechSynthesis = synth;
    window.SpeechSynthesisUtterance = FakeSpeech;
  }
  runInNewContext(script, { document, window });
  return {
    root, persisted, themeButton, speakButton, cardButton, meta, window,
    listeners, currentSpeech: () => speaking, cancellations: () => cancellations
  };
}

test('the original parchment theme remains default and is switchable', () => {
  const ui = harness();
  assert.equal(ui.root.dataset.theme, 'light');
  assert.equal(ui.themeButton.attrs['aria-pressed'], 'false');
  ui.themeButton.click();
  assert.equal(ui.root.dataset.theme, 'dark');
  assert.equal(ui.persisted.get('pocket-oracle-theme'), 'dark');
  assert.equal(ui.meta.content, '#161923');
  assert.equal(ui.themeButton.attrs['aria-pressed'], 'true');
  ui.themeButton.click();
  assert.equal(ui.root.dataset.theme, 'light');
});

test('stored dark preference survives reinitialization', () => {
  const ui = harness({ initialTheme: 'dark' });
  assert.equal(ui.root.dataset.theme, 'dark');
  assert.equal(ui.themeButton.span.textContent, '☀︎');
});

test('browser speech is opt-in and uses the selected language', () => {
  const ui = harness({ locale: 'pt' });
  assert.equal(ui.currentSpeech(), null);
  ui.speakButton.click();
  const reading = ui.currentSpeech();
  assert.match(reading.text, /78 Tarot Cards/);
  assert.equal(reading.lang, 'pt-BR');
  assert.equal(ui.speakButton.attrs['aria-pressed'], 'true');
  ui.speakButton.click();
  assert.equal(ui.speakButton.attrs['aria-pressed'], 'false');
  assert.ok(ui.cancellations() >= 2);
});

test('language change stops read-aloud; unsupported browsers disable controls', () => {
  const ui = harness();
  ui.speakButton.click();
  ui.listeners.language();
  assert.equal(ui.speakButton.attrs['aria-pressed'], 'false');
  const unsupported = harness({ speech: false });
  assert.equal(unsupported.speakButton.disabled, true);
  assert.equal(unsupported.cardButton.disabled, true);
});

test('frontend credits only identified backend models; ElevenLabs is an explicit opt-in', () => {
  assert.match(appScript, /modelLabels\[data\.model\]/);
  assert.match(appScript, /'@cf\/google\/gemma-4-26b-a4b-it'/);
  assert.match(appScript, /'@cf\/meta\/llama-3\.3-70b-instruct-fp8-fast'/);
  assert.match(appScript, /if \(data\.narrationToken\)/);
  assert.match(appScript, /narration_provider_credit/);
  assert.match(appScript, /PocketAccessibility\?\.stop\(\)/);
});

test('locale, accessibility controls and offline cache stay integrated', () => {
  assert.match(html, /id="theme-toggle"/);
  assert.match(html, /id="site-read-toggle"/);
  assert.match(html, /id="read-card-button"/);
  assert.ok(html.indexOf('js/i18n.js') < html.indexOf('js/accessibility.js'));
  assert.ok(html.indexOf('js/accessibility.js') < html.indexOf('js/app.js'));
  assert.match(translations, /reading_model_credit: 'Interpretação gerada por'/);
  assert.match(translations, /reading_model_credit: 'Interpretation generated by'/);
  assert.match(serviceWorker, /\.\/js\/accessibility\.js/);
  assert.match(serviceWorker, /pocket-oracle-v26-dark-spread-labels/);
});


test('moving between views focuses new heading and respects reduced motion', () => {
  const from = appScript.indexOf('    function showView(');
  const until = appScript.indexOf('\n    function detailSection', from);
  assert.ok(from >= 0 && until > from, 'showView should be present');
  const focusLog = [];
  const scrollLog = [];
  const views = Object.fromEntries(['home-view', 'card-detail-view', 'random-draw-view'].map(id => {
    const heading = {
      tabIndex: null,
      focus(options) { focusLog.push({ id, preventScroll: options.preventScroll }); }
    };
    return [id, {
      id, heading,
      classList: { toggle() {} },
      querySelector: selector => selector === 'h2' ? heading : null
    }];
  }));
  let stops = 0;
  const sandbox = {
    document: {
      getElementById: id => views[id],
      querySelectorAll: () => []
    },
    window: {
      PocketAccessibility: { stop() { stops++; } },
      matchMedia: () => ({ matches: true }),
      scrollTo: options => scrollLog.push(options)
    },
    closeExploreMenu() {},
    resetDraw() {}
  };
  runInNewContext(appScript.slice(from, until) + '\n;globalThis.navigate = showView;', sandbox);
  sandbox.navigate('card-detail-view', true);
  assert.equal(stops, 1);
  assert.equal(views['card-detail-view'].heading.tabIndex, -1);
  assert.equal(focusLog[0].id, 'card-detail-view');
  assert.equal(focusLog[0].preventScroll, true);
  assert.equal(scrollLog[0].behavior, 'instant');
});
