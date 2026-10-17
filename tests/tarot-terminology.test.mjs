import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ptSource = load('js/cards.js');
const enSource = load('js/cards.en.js');
const workerSource = load('cloudflare-worker.js');
const app = load('js/app.js');

function parseDeck(source) {
    return JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1));
}

function workerDeck() {
    const anchor = 'const CANONICAL_CARDS = ';
    const begin = workerSource.indexOf(anchor);
    assert.ok(begin >= 0, 'Canonical Worker deck should be present');
    const start = begin + anchor.length;
    const end = workerSource.indexOf(';\n', start);
    assert.ok(end > start, 'Canonical Worker deck should terminate');
    return JSON.parse(workerSource.slice(start, end));
}

const pt = parseDeck(ptSource);
const en = parseDeck(enSource);
const worker = workerDeck();
const mappings = [
    { pt: 'Paus', en: 'Wands', elementPT: 'Fogo', elementEN: 'Fire' },
    { pt: 'Copas', en: 'Cups', elementPT: 'Água', elementEN: 'Water' },
    { pt: 'Espadas', en: 'Swords', elementPT: 'Ar', elementEN: 'Air' },
    { pt: 'Ouros', en: 'Pentacles', elementPT: 'Terra', elementEN: 'Earth' }
];
const ptRanks = ['Ás', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis',
    'Sete', 'Oito', 'Nove', 'Dez', 'Pajem', 'Cavaleiro', 'Rainha', 'Rei'];
const enRanks = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];

test('the 78 cards have canonical, unambiguous suit names in PT and EN', () => {
    assert.equal(pt.length, 78);
    assert.equal(en.length, 78);
    assert.equal(worker.pt.length, 78);
    assert.equal(worker.en.length, 78);

    for (let i = 0; i < 22; i++) {
        assert.equal(pt[i].naipe, 'Arcanos Maiores');
        assert.equal(en[i].naipe, 'Major Arcana');
        assert.equal(pt[i].numero, i);
        assert.equal(en[i].numero, i);
    }

    mappings.forEach(({pt: suitPT, en: suitEN, elementPT, elementEN}, suitIndex) => {
        for (let i = 0; i < 14; i++) {
            const index = 22 + suitIndex * 14 + i;
            assert.equal(pt[index].nome, ptRanks[i] + ' de ' + suitPT);
            assert.equal(en[index].nome, enRanks[i] + ' of ' + suitEN);
            assert.equal(pt[index].naipe, suitPT);
            assert.equal(en[index].naipe, suitEN);
            assert.equal(pt[index].elemento, elementPT);
            assert.equal(en[index].elemento, elementEN);
            assert.equal(pt[index].numero, i + 1);
            assert.equal(en[index].numero, i + 1);
            assert.equal(pt[index].imagem, en[index].imagem);
        }
    });
});

test('neither static deck contains mistranslated Cups/Xícaras labels', () => {
    const wrongPortuguese = /\bxícaras?\b|\bxicaras?\b|\bcups?\b/i;
    for (const card of pt) {
        assert.doesNotMatch(card.nome, wrongPortuguese, card.nome);
        assert.doesNotMatch(card.naipe, wrongPortuguese, card.nome);
        for (const key of ['descricao', 'interpretacao_imagem']) {
            assert.doesNotMatch(card[key], wrongPortuguese, card.nome + '/' + key);
        }
    }
    for (const card of en) {
        assert.doesNotMatch(card.nome + ' ' + card.naipe, /\bCopas\b|\bxícaras?\b/i);
    }
    assert.equal(pt[44].descricao.includes("O Nove de Copas é conhecido"), true);
});

test('Worker canonical card names, suits and descriptions match the frontend', () => {
    for (const [language, cards] of [['pt', pt], ['en', en]]) {
        for (let i = 0; i < 78; i++) {
            const browser = cards[i];
            const server = worker[language][i];
            for (const key of ['nome', 'naipe', 'elemento', 'descricao']) {
                assert.equal(server[key], browser[key], language + ' ' + browser.nome + ' / ' + key);
            }
            assert.equal(server.interpretacaoImagem, browser.interpretacao_imagem);
            assert.equal(Number(server.numero), browser.numero);
        }
    }
});

test('both Worker prompts use precise names for Rider-Waite suits', () => {
    assert.match(workerSource, /Preserve os nomes dos naipes desta aplicação: Paus, Copas, Espadas e Ouros/);
    assert.match(workerSource, /não traduza Copas como "xícaras", "copos" ou "taças"/);
    assert.match(workerSource, /Wands, Cups, Swords, and Pentacles/);
    assert.match(workerSource, /Always use the supplied canonical card names/);
});

test('the gallery and AI reading protect localized card names against auto-translation', () => {
    assert.match(app, /item\.setAttribute\('translate', 'no'\)/);
    assert.match(app, /<h2 translate="no" class="font-playfair/);
    assert.match(app, /name\.setAttribute\('translate', 'no'\)/);
});
