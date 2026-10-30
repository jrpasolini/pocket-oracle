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


test('language picker follows Moon theme with readable selected state and unchanged flag artwork', () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');

  // Light theme keeps its original parchment container and gold selected state.
  assert.match(css, /\.language-selector\s*\{[^}]*background:\s*rgba\(255,\s*250,\s*239,\s*\.82\)/);
  assert.match(css, /\.language-option\[aria-pressed="true"\]\s*\{/);

  const rules = selector => {
    const start = css.lastIndexOf(selector + ' {');
    assert.ok(start >= 0, 'Missing selector: ' + selector);
    return css.slice(start, css.indexOf('}', start));
  };
  const container = rules('html[data-theme="dark"] .language-selector');
  const idle = rules('html[data-theme="dark"] .language-selector .language-option');
  const selected = rules('html[data-theme="dark"] .language-selector .language-option[aria-pressed="true"]');
  const focus = rules('html[data-theme="dark"] .language-selector .language-option:focus-visible');
  assert.match(container, /background:\s*#[a-f\d]{6}/i);
  assert.match(idle, /background:\s*transparent/);
  assert.match(selected, /background:\s*#[a-f\d]{6}/i);
  assert.match(selected, /box-shadow:\s*inset/);
  assert.match(focus, /outline:\s*3px solid/);

  const hex = (rule, key) => {
    const match = rule.match(new RegExp('(?:^|\\n)\\s*' + key + ':\\s*#([a-f0-9]{6})\\s*;', 'i'));
    assert.ok(match, 'Missing ' + key);
    return match[1];
  };
  const luminance = color => {
    const components = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return components[0] * .2126 + components[1] * .7152 + components[2] * .0722;
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  };
  assert.ok(ratio(hex(selected, 'border-color'), hex(selected, 'background')) >= 3,
    'The selected-language outline must be distinguishable');
  assert.ok(ratio(hex(idle, 'color'), hex(container, 'background')) >= 4.5,
    'Any visible text/indicators must remain readable');

  // Both flag SVGs are fixed artwork, and language selection is unrelated to theme.
  const options = html.match(/class="toolbar-button language-option"/g) || [];
  assert.equal(options.length, 2);
  assert.match(html, /data-lang-select="pt"/);
  assert.match(html, /data-lang-select="en"/);
  assert.match(html, /class="language-flag"/);
  assert.match(html, /aria-pressed="true"/);
});

test('offline cache installs required assets and retires only older Pocket Oracle caches', async () => {
  const listeners = {};
  const opened = [];
  const deleted = [];
  let installedAssets;
  let skippedWaiting = false;
  let claimedClients = false;
  const unrelatedCache = 'another-app-v1';
  let activeCache;
  runInNewContext(serviceWorker, {
    self: {
      addEventListener(type, listener) { listeners[type] = listener; },
      skipWaiting() { skippedWaiting = true; },
      clients: { claim() { claimedClients = true; } }
    },
    caches: {
      async open(name) {
        opened.push(name);
        activeCache = name;
        return { async addAll(assets) { installedAssets = Array.from(assets); } };
      },
      async keys() { return [activeCache, 'pocket-oracle-obsolete-cache', unrelatedCache]; },
      async delete(name) { deleted.push(name); return true; }
    }
  });
  let installation;
  listeners.install({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.equal(opened.length, 1);
  assert.match(activeCache, /^pocket-oracle-.+/);
  for (const asset of ['./index.html', './manifest.json', './css/styles.css',
    './js/cards.js', './js/cards.en.js', './js/i18n.js', './js/app.js', './js/accessibility.js']) {
    assert.ok(installedAssets.includes(asset), asset + ' must be available offline');
  }
  assert.equal(installedAssets.filter(asset => asset.startsWith('./images/cards/')).length, 78);
  assert.equal(skippedWaiting, true);
  let activation;
  listeners.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['pocket-oracle-obsolete-cache']);
  assert.equal(claimedClients, true);
});
