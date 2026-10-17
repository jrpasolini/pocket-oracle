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


function zodiacOptions(view, language) {
  const menu = view.elements.get('explore-menu').firstElementChild.children;
  const label = language === 'pt' ? 'Signo' : 'Sign';
  const start = menu.findIndex(item => item.textContent === label);
  assert.ok(start >= 0, 'Missing zodiac menu heading: ' + label);
  const end = menu.findIndex((item, index) =>
    index > start && item.className === 'border-amber-900/10');
  assert.ok(end > start, 'Missing zodiac menu divider');
  return menu.slice(start + 1, end);
}

const zodiacNames = {
  pt: ['Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem',
    'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes'],
  en: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
};

function zodiacTerms(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(/[^a-z]+/);
}

test('zodiac filter lists exactly 12 individual signs in both languages', () => {
  const view = frontend('pt');
  for (const lang of ['pt', 'en']) {
    if (view.api.lang !== lang) view.api.setLang(lang);
    const options = zodiacOptions(view, lang);
    assert.equal(options.length, 12, '12 options in ' + lang);
    const shown = options.map(option => option.textContent);
    assert.deepEqual(new Set(shown), new Set(zodiacNames[lang]));
    assert.ok(shown.every(value => !/[\/,()]/.test(value)),
      'No compound entries or parenthetical metadata');
    assert.ok(!shown.includes(lang === 'pt' ? 'Júpiter' : 'Jupiter'),
      'A planet is not a zodiac sign');
  }
});

test('all zodiac filters match individual tokens in compound metadata, never the entire string', () => {
  for (const lang of ['pt', 'en']) {
    const view = frontend(lang);
    const deck = view.api.cards();
    const options = zodiacOptions(view, lang);

    for (const option of options) {
      const sign = option.textContent;
      option.listeners.click();
      const found = cards(view).map(card => card.image);
      // Convert VM-realm deck array to a host-realm array before strict comparison.
      const expected = Array.from(deck).filter(card =>
        zodiacTerms(card.signo).includes(zodiacTerms(sign)[0]))
        .map(card => card.imagem);
      assert.deepEqual(found, expected, lang + '/' + sign);
      assert.ok(found.length > 0, 'At least one card should belong to ' + sign);
    }

    // Includes parenthesized entries such as "Fogo (Áries, Leão, Sagitário)"
    // and English "Fire (Aries, Leo, Sagittarius)" without rewriting data.
    const multizodiac = lang === 'pt'
      ? { name: 'Pajem de Paus', signs: ['Áries', 'Leão', 'Sagitário'] }
      : { name: 'Page of Wands', signs: ['Aries', 'Leo', 'Sagittarius'] };
    const expectedCard = deck.find(card => card.nome === multizodiac.name);
    assert.ok(expectedCard);
    for (const sign of multizodiac.signs) {
      options.find(option => option.textContent === sign).listeners.click();
      assert.ok(cards(view).some(card => card.image === expectedCard.imagem),
        multizodiac.name + ' should appear under ' + sign);
    }

    const double = lang === 'pt'
      ? { name: 'Cavaleiro de Espadas', signs: ['Aquário', 'Gêmeos'] }
      : { name: 'Knight of Swords', signs: ['Aquarius', 'Gemini'] };
    const doubleCard = deck.find(card => card.nome === double.name);
    for (const sign of double.signs) {
      options.find(option => option.textContent === sign).listeners.click();
      assert.ok(cards(view).some(card => card.image === doubleCard.imagem),
        double.name + ' should appear under ' + sign);
    }
  }
});

test('the separate planet filter still works for planetary-only correspondence cards', () => {
  const view = frontend('pt');
  const menu = view.elements.get('explore-menu').firstElementChild.children;
  const heading = menu.findIndex(item => item.textContent === 'Planeta');
  assert.ok(heading >= 0);
  const planetOption = menu.slice(heading + 1).find(item => item.textContent === 'Mercúrio');
  assert.ok(planetOption);
  planetOption.listeners.click();
  const magician = view.api.cards().find(card => card.nome === 'O Mago');
  assert.ok(cards(view).some(card => card.image === magician.imagem));
});


test('moon theme draw actions use the same enabled color and a distinct disabled style', () => {
  const html = read('index.html');
  const one = html.match(/<button id="draw-button"[^>]+>/)?.[0];
  const three = html.match(/<button id="draw-three-button"[^>]+>/)?.[0];
  assert.ok(one && three, 'Both draw controls are present');
  assert.doesNotMatch(one, /\sdisabled(?:\s|=|>)/i);
  assert.doesNotMatch(three, /\sdisabled(?:\s|=|>)/i);

  const sharedSelector =
    'html[data-theme="dark"] .draw-button-primary,\n' +
    'html[data-theme="dark"] .draw-button-secondary {';
  const sharedStart = css.lastIndexOf(sharedSelector);
  assert.ok(sharedStart >= 0, 'Both active controls must share one dark-theme declaration');
  const activeRule = css.slice(sharedStart, css.indexOf('}', sharedStart));
  const gradient = activeRule.match(/background:\s*linear-gradient\(135deg,\s*#([a-f\d]{6}),\s*#([a-f\d]{6})\)/i);
  const textColor = activeRule.match(/\bcolor:\s*#([a-f\d]{6})/i);
  assert.ok(gradient && textColor, 'Dark draw buttons need a shared background and text');
  const fg = luminance(textColor[1]);
  for (const bg of [gradient[1], gradient[2]]) {
    const background = luminance(bg);
    const contrast = (Math.max(fg, background) + 0.05) /
      (Math.min(fg, background) + 0.05);
    assert.ok(contrast >= 4.5, 'Active draw-button text contrast: ' + contrast.toFixed(2));
  }

  const disabledSelector = 'html[data-theme="dark"] .draw-button:disabled {';
  const disabledStart = css.lastIndexOf(disabledSelector);
  assert.ok(disabledStart > sharedStart, 'Disabled state should override the shared active appearance');
  const disabledRule = css.slice(disabledStart, css.indexOf('}', disabledStart));
  assert.match(disabledRule, /background:\s*#[a-f\d]{6}/i);
  assert.match(disabledRule, /color:\s*#[a-f\d]{6}/i);
  assert.match(disabledRule, /cursor:\s*not-allowed/);
  assert.match(disabledRule, /opacity:\s*1/);
});


test('moon-theme position chips and all draw card names meet 4.5:1 contrast', () => {
  const captionSelector =
    'html[data-theme="dark"] .draw-position-label,\n' +
    'html[data-theme="dark"] .draw-card-label {';
  const captionStart = css.lastIndexOf(captionSelector);
  assert.ok(captionStart >= 0, 'Both drawing modes should share dark caption styling');
  const captionRule = css.slice(captionStart, css.indexOf('}', captionStart));

  const numberSelector = 'html[data-theme="dark"] .draw-position-label span {';
  const numberStart = css.lastIndexOf(numberSelector);
  assert.ok(numberStart > captionStart, 'Three-card numbered positions need their own dark-mode contrast');
  const numberRule = css.slice(numberStart, css.indexOf('}', numberStart));

  const hexColor = (rule, property) => {
    const match = rule.match(new RegExp('(?:^|\\n)\\s*' + property + ':\\s*#([a-f0-9]{6})\\s*;', 'i'));
    assert.ok(match, 'Missing explicit ' + property + ' in Moon theme rule');
    return match[1];
  };
  const contrast = (fg, bg) => {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const [name, rule] of [['Card names and position labels', captionRule], ['Sequence numbers', numberRule]]) {
    const ratio = contrast(hexColor(rule, 'color'), hexColor(rule, 'background'));
    assert.ok(ratio >= 4.5, name + ' contrast: ' + ratio.toFixed(2));
  }

  // Ensure the shared class is actually rendered in both types of spread.
  for (const [buttonId, count] of [['draw-button', 1], ['draw-three-button', 3]]) {
    const view = frontend('pt');
    view.elements.get(buttonId).listeners.click();
    const drawn = view.elements.get('shuffle-animation-container').children;
    assert.equal(drawn.length, count, buttonId + ' must draw the correct count');
    for (const wrapper of drawn) {
      assert.match(wrapper.innerHTML, /class="draw-card-label\b/);
      if (count === 3) {
        assert.match(wrapper.innerHTML, /class="draw-position-label"/);
      } else {
        assert.doesNotMatch(wrapper.innerHTML, /class="draw-position-label"/);
      }
    }
  }
});
