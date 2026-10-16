import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const appSource = read('js/app.js');
const css = read('css/styles.css');

function node() {
  const queried = new Map();
  const result = {
    className: 'hidden',
    value: '',
    children: [],
    listeners: {},
    dataset: {},
    _html: '',
    setAttribute() {},
    addEventListener(event, handler) { this.listeners[event] = handler; },
    appendChild(child) { this.children.push(child); },
    querySelector(selector) {
      if (!queried.has(selector)) queried.set(selector, node());
      return queried.get(selector);
    },
    querySelectorAll: () => [],
    contains: () => false
  };
  Object.defineProperty(result, 'innerHTML', {
    get() { return this._html; },
    set(value) { this._html = value; this.children = []; }
  });
  let first;
  Object.defineProperty(result, 'firstElementChild', {
    get() { return this.children[0] || (first ||= node()); }
  });
  result.classList = {
    contains: name => result.className.split(/\s+/).includes(name),
    toggle(name, force) {
      const classes = new Set(result.className.split(/\s+/).filter(Boolean));
      const add = force ?? !classes.has(name);
      if (add) classes.add(name); else classes.delete(name);
      result.className = [...classes].join(' ');
    },
    add(...names) { names.forEach(name => this.toggle(name, true)); },
    remove(...names) { names.forEach(name => this.toggle(name, false)); }
  };
  return result;
}

function frontend(language) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const navDraw = node();
  navDraw.dataset.view = 'random-draw-view';
  let now = 0;
  let nextTimerId = 0;
  const scheduled = new Map();
  const timers = {
    pending: () => scheduled.size,
    advance(ms) {
      const end = now + ms;
      while (true) {
        let next = null;
        for (const [id, entry] of scheduled) {
          if (entry.at <= end && (!next || entry.at < next.at)) next = { id, ...entry };
        }
        if (!next) break;
        scheduled.delete(next.id);
        now = next.at;
        next.callback();
      }
      now = end;
    }
  };
  const context = createContext({
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      scheduled.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { scheduled.delete(id); },
    document: {
      readyState: 'loading',
      documentElement: {},
      getElementById: element,
      createElement: node,
      querySelectorAll: selector => selector === '[data-view]' ? [navDraw] : [],
      querySelector: () => null,
      addEventListener() {}
    },
    localStorage: { getItem: () => language, setItem() {} },
    scrollTo() {}
  });
  runInContext('window = globalThis;', context);
  for (const file of ['js/cards.js', 'js/cards.en.js', 'js/i18n.js']) {
    runInContext(read(file), context);
  }
  runInContext(appSource, context);
  return { elements, api: context.I18N, timers, navDraw };
}

function cards(frontend) {
  return frontend.elements.get('card-grid').children.map(item => ({
    image: item.innerHTML.match(/<img src="([^"]+)"/)[1],
    number: item.innerHTML.match(/class="card-number-badge">([^<]+)</)[1],
    element: item.innerHTML.match(/class="element-inline-dot element-([^"]+)"/)[1]
  }));
}

test('major arcana use Portuguese two-digit numbering in both locales; ranks stay on minor arcana', () => {
  for (const language of ['pt', 'en']) {
    const view = frontend(language);
    const rendered = cards(view);
    assert.equal(rendered.length, 78);
    for (let index = 0; index < 22; index++) {
      assert.equal(rendered[index].number, String(index).padStart(2, '0'));
    }
    assert.equal(rendered[22].number, language === 'pt' ? 'Ás' : 'Ace');
    assert.equal(rendered[32].number, language === 'pt' ? 'Pajem' : 'Page');
  }
});

test('all 78 gallery cards keep their Portuguese order and element dots after switching languages', () => {
  const view = frontend('pt');
  const portuguese = cards(view);
  const expected = { Ar: 'ar', Água: 'agua', Terra: 'terra', Fogo: 'fogo' };
  view.api.cards().forEach((card, index) => {
    assert.equal(portuguese[index].element, expected[card.elemento]);
  });
  view.api.setLang('en');
  const english = cards(view);
  assert.equal(english.length, 78);
  english.forEach((card, index) => {
    assert.equal(card.image, portuguese[index].image);
    assert.equal(card.element, portuguese[index].element);
  });
  view.api.setLang('pt');
  assert.deepEqual(cards(view), portuguese);
});

test('detail views share the Portuguese element theme and readable badge classes in both languages', () => {
  for (const language of ['pt', 'en']) {
    const view = frontend(language);
    const rendered = cards(view);
    for (const element of ['ar', 'agua', 'fogo', 'terra']) {
      const index = rendered.findIndex(card => card.element === element);
      assert.ok(index >= 0);
      view.elements.get('card-grid').children[index].listeners.click();
      assert.ok(view.elements.get('card-detail-view').className.includes('element-bg-' + element));
      assert.ok(view.elements.get('card-detail-content').innerHTML.includes('element-pill element-' + element));
    }
  }
});

function luminance(hex) {
  const rgb = hex.match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('all four gallery and detail labels have at least 4.5:1 text contrast', () => {
  for (const element of ['ar', 'agua', 'fogo', 'terra']) {
    const selector = '.element-pill.element-' + element + ',\n.card-element-label.element-label-' + element;
    const start = css.lastIndexOf(selector);
    assert.ok(start >= 0, 'Missing shared palette for ' + element);
    const rule = css.slice(start, css.indexOf('}', start));
    const background = rule.match(/background:\s*#([a-f\d]{6})/i)[1];
    const foreground = rule.match(/\n\s*color:\s*#([a-f\d]{6})/i)[1];
    const ratio = (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
    assert.ok(ratio >= 4.5, element + ' label contrast is ' + ratio.toFixed(2));
  }
});

test('switching languages clears localized explore filters and search queries', () => {
  const view = frontend('pt');
  const menu = view.elements.get('explore-menu').firstElementChild;
  const majorArcana = menu.children.find(item => item.textContent === 'Arcanos Maiores');
  assert.ok(majorArcana, 'Major Arcana filter must exist in Portuguese');
  majorArcana.listeners.click();
  assert.equal(cards(view).length, 22);

  view.api.setLang('en');
  assert.equal(cards(view).length, 78, 'Stale Portuguese category should be discarded');
  assert.equal(view.elements.get('filter-info').classList.contains('hidden'), true);

  const search = view.elements.get('search-input');
  search.value = 'The Fool';
  search.listeners.input();
  assert.ok(cards(view).length > 0 && cards(view).length < 78,
    'English search should narrow the gallery before the language switch');
  view.api.setLang('pt');
  assert.equal(search.value, '');
  assert.equal(cards(view).length, 78, 'Stale English query should be discarded');
});

test('resetting a draw cancels previous flip and completion timers', () => {
  const view = frontend('en');
  const question = view.elements.get('oracle-question');
  question.value = 'What is next?';
  question.listeners.input();

  view.elements.get('draw-button').listeners.click();
  assert.equal(view.timers.pending(), 2, 'One card needs flip and completion timers');

  view.navDraw.listeners.click();
  assert.equal(view.timers.pending(), 0, 'Reset must clear all pending draw timers');

  view.elements.get('draw-three-button').listeners.click();
  assert.equal(view.timers.pending(), 4, 'Three cards need three flips and completion');
  view.timers.advance(1800);
  assert.equal(view.elements.get('interpret-ai-button').disabled, true,
    'An old completion timer must not enable interpretation early');
  view.timers.advance(1800);
  assert.equal(view.elements.get('interpret-ai-button').disabled, false,
    'Only the current draw completion enables interpretation');
  assert.equal(view.timers.pending(), 0);
});
