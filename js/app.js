(() => {
    'use strict';

    function buildDeck() {
        const source = window.I18N ? I18N.cards() : cardDatabase;
        return (Array.isArray(source) && source.length ? source : cardDatabase).map((card, id) => ({ ...card, id }));
    }

    let cards = buildDeck();

    const t = key => (window.I18N ? I18N.t(key) : key);
    const cardGrid = document.getElementById('card-grid');
    const searchInput = document.getElementById('search-input');
    const filterInfo = document.getElementById('filter-info');
    const resultsCount = document.getElementById('results-count');
    const exploreMenu = document.getElementById('explore-menu');
    const exploreMenuButton = document.getElementById('explore-menu-button');
    const questionInput = document.getElementById('oracle-question');
    const questionCount = document.getElementById('oracle-question-count');
    const shuffleContainer = document.getElementById('shuffle-animation-container');
    const drawButton = document.getElementById('draw-button');
    const drawThreeButton = document.getElementById('draw-three-button');
    const aiReadingActions = document.getElementById('ai-reading-actions');
    const interpretAiButton = document.getElementById('interpret-ai-button');
    const aiReadingHint = document.getElementById('ai-reading-hint');
    const aiReadingResult = document.getElementById('ai-reading-result');
    const aiReadingLoading = document.getElementById('ai-reading-loading');
    const aiReadingContent = document.getElementById('ai-reading-content');

    // O endereço da API. Fica em UM lugar só: trocar de casa é mudar esta linha.
    // Domínio próprio (`api.jrpasolini.tech`) → é por ele que o tráfego passa
    // pela zona do projeto, o que faz a regra de rate limit valer.
    const API_BASE = 'https://api.jrpasolini.tech';
    const AI_ENDPOINT = API_BASE + '/interpretar';
    const NARRATE_ENDPOINT = API_BASE + '/narrar';
    let lastReading = null;
    let narrationInFlight = false;
    let narrationRequestController = null;
    let narrationRequestId = 0;
    let currentDetailCardId = null;
    let readingRequestController = null;
    let readingRequestId = 0;
    const drawPositions = () => [t('position_past'), t('position_present'), t('position_future')];

    const propertyMap = {
        naipe: 'prop_naipe',
        elemento: 'prop_elemento',
        signo: 'prop_signo',
        planeta: 'prop_planeta'
    };

    const propertyLabel = property => t(propertyMap[property] || property);

    if (window.I18N) {
        I18N.onChange(() => {
            cards = buildDeck();
            currentDraw = currentDraw.map(card => cards[card.id] || card);
            // Localized filter values and search terms must not survive a locale switch.
            currentFilter = { type: null, value: null };
            searchInput.value = '';
            renderCards();
            populateExploreMenu();

            // Trocar o idioma invalida a leitura (e a autorização de voz)
            // anterior; preservamos as cartas sorteadas para nova interpretação.
            clearAiReading();
            shuffleContainer.querySelectorAll('.draw-card-wrap').forEach((wrapper, index) => {
                const card = currentDraw[index];
                if (!card) return;
                const position = wrapper.querySelector('.draw-position-label');
                if (position) {
                    const number = position.querySelector('span');
                    position.replaceChildren(number, document.createTextNode(drawPositions()[index]));
                }
                const label = wrapper.querySelector('.draw-card-label');
                if (label) label.textContent = card.nome;
                const flip = wrapper.querySelector('.card-flip');
                if (flip) flip.setAttribute('aria-label', `${t('reveal_card')} ${card.nome}`);
                const image = wrapper.querySelector('.card-face-front img');
                if (image) image.alt = card.nome;
            });
            updateDrawButtonLabels();
            updateAiAvailability();
            if (currentDetailCardId !== null && !document.getElementById('card-detail-view').classList.contains('hidden')) {
                showCardDetail(currentDetailCardId, currentDetailFromDraw);
            }
        });
    }

    let currentFilter = { type: null, value: null };
    let currentDetailFromDraw = false;
    let currentDraw = [];
    let currentDrawRevealed = false;
    const drawTimers = new Set();
    let aiRequestInFlight = false;

    const escapeHtml = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const normalize = value => String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const list = value => Array.isArray(value) ? value : (value ? [value] : []);
    const joinList = value => list(value).map(escapeHtml).join(', ');

    function cardNumber(card) {
        if (['arcanos maiores', 'major arcana'].includes(normalize(card.naipe))) {
            return String(card.numero).padStart(2, '0');
        }
        const labels = { 1: t('rank_ace'), 11: t('rank_page'), 12: t('rank_knight'), 13: t('rank_queen'), 14: t('rank_king') };
        return labels[card.numero] || card.numero;
    }

    function elementClass(value) {
        // Display names are localized; visual themes use stable Portuguese keys.
        const key = normalize(value).trim();
        const elements = {
            ar: 'ar', air: 'ar',
            agua: 'agua', water: 'agua',
            fogo: 'fogo', fire: 'fogo',
            terra: 'terra', earth: 'terra'
        };
        return elements[key] || key.replace(/[^a-z0-9]+/g, '-');
    }

    function searchableText(card) {
        return normalize([
            card.nome, card.naipe, card.elemento, card.signo, card.planeta,
            card.descricao, card.interpretacao_imagem,
            ...list(card.palavras_chave), ...list(card.palavras_chave_invertido),
            ...list(card.cristais), ...list(card.ervas), ...list(card.aromaterapia)
        ].join(' '));
    }

    function populateExploreMenu() {
        const content = exploreMenu.firstElementChild;
        content.innerHTML = '';

        Object.entries(propertyMap).forEach(([property, labelKey]) => {
            const values = [...new Set(cards.map(card => card[property]).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const heading = document.createElement('p');
            heading.className = 'px-4 py-2 text-sm font-bold text-amber-700';
            heading.textContent = t(labelKey);
            content.appendChild(heading);

            values.forEach(value => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'w-full text-left text-amber-800 block px-4 py-2 text-sm hover:bg-amber-100';
                item.textContent = value;
                item.addEventListener('click', () => {
                    currentFilter = { type: property, value };
                    searchInput.value = '';
                    renderCards();
                    showView('home-view', true);
                    closeExploreMenu();
                });
                content.appendChild(item);
            });

            const divider = document.createElement('hr');
            divider.className = 'border-amber-900/10';
            content.appendChild(divider);
        });

        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'w-full text-left text-red-700 block px-4 py-2 text-sm font-bold hover:bg-red-100';
        clear.textContent = t('clear_filter');
        clear.addEventListener('click', () => {
            currentFilter = { type: null, value: null };
            searchInput.value = '';
            renderCards();
            closeExploreMenu();
        });
        content.appendChild(clear);
    }

    function closeExploreMenu() {
        exploreMenu.classList.add('hidden');
        exploreMenuButton.setAttribute('aria-expanded', 'false');
    }

    function renderCards() {
        const term = normalize(searchInput.value.trim());
        let visible = cards;

        if (term) {
            currentFilter = { type: null, value: null };
            visible = cards.filter(card => searchableText(card).includes(term));
            filterInfo.textContent = `${t('filter_results')} “${searchInput.value.trim()}”`;
            filterInfo.classList.remove('hidden');
        } else if (currentFilter.type && currentFilter.value) {
            visible = cards.filter(card => card[currentFilter.type] === currentFilter.value);
            filterInfo.textContent = `${propertyLabel(currentFilter.type)}: ${currentFilter.value}`;
            filterInfo.classList.remove('hidden');
        } else {
            filterInfo.classList.add('hidden');
        }

        resultsCount.textContent = `${visible.length} ${t(visible.length === 1 ? 'results_one' : 'results_many')}`;
        cardGrid.innerHTML = '';

        if (!visible.length) {
            cardGrid.innerHTML = `<p class="col-span-full text-center text-xl text-amber-800">${t('no_cards')}</p>`;
            return;
        }

        visible.forEach(card => {
            const item = document.createElement('article');
            const cls = elementClass(card.elemento);
            item.className = 'oracle-card text-center cursor-pointer group';
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', `${t('open_card')} ${card.nome}`);
            item.innerHTML = `
                <div class="oracle-card-frame">
                    <img src="${escapeHtml(card.imagem)}" alt="${escapeHtml(card.nome)}" class="w-full h-auto rounded-xl" loading="lazy">
                    <span class="card-number-badge">${escapeHtml(cardNumber(card))}</span>
                    <span class="card-element-label element-label-${cls}"><span aria-hidden="true" class="element-inline-dot element-${cls}"></span>${escapeHtml(card.elemento)}</span>
                </div>
                <div class="pt-3 px-1">
                    <h3 class="font-playfair text-xl card-title-home">${escapeHtml(card.nome)}</h3>
                    <p class="text-[0.72rem] uppercase tracking-[0.18em] opacity-60 mt-1">${escapeHtml(card.naipe)}</p>
                </div>`;

            const open = () => showCardDetail(card.id, false);
            item.addEventListener('click', open);
            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                }
            });
            cardGrid.appendChild(item);
        });
    }

    function showView(viewId, preserveDraw = false) {
        window.PocketAccessibility?.stop();
        ['home-view', 'card-detail-view', 'random-draw-view'].forEach(id => {
            document.getElementById(id).classList.toggle('hidden', id !== viewId);
        });
        document.querySelectorAll('[data-gallery-only]').forEach(node => {
            node.classList.toggle('hidden', viewId !== 'home-view');
        });
        if (viewId !== 'home-view') closeExploreMenu();
        if (viewId === 'random-draw-view' && !preserveDraw) resetDraw();

        // Focus must follow a client-side view change; otherwise keyboard and
        // screen-reader users may remain focused inside a now-hidden section.
        const view = document.getElementById(viewId);
        const heading = view?.querySelector('h2');
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    }

    function detailSection(title, body) {
        if (!body) return '';
        return `<section class="detail-section"><h3 class="font-playfair text-3xl mb-2 border-b-2 border-current/20 pb-2">${title}</h3>${body}</section>`;
    }

    function showCardDetail(id, fromDraw) {
        const card = cards.find(item => item.id === id);
        if (!card) return;
        currentDetailCardId = id;
        currentDetailFromDraw = fromDraw;

        const detailView = document.getElementById('card-detail-view');
        const cls = elementClass(card.elemento);
        const light = ['fogo', 'terra', 'agua'].includes(cls);
        detailView.className = `hidden p-4 md:p-8 oracle-panel element-bg-${cls} ${light ? 'text-light' : 'text-dark'}`;
        document.getElementById('return-draw-button').classList.toggle('hidden', !fromDraw);

        const response = card.resposta_rapida
            ? `<li><strong>❓ ${t('detail_quick_answer')}:</strong> <strong>${escapeHtml(card.resposta_rapida)}</strong>${card.justificativa_resposta ? ` — <em>${escapeHtml(card.justificativa_resposta)}</em>` : ''}</li><hr class="border-current/20 my-2">`
            : '';

        document.getElementById('card-detail-content').innerHTML = `
            <div class="md:col-span-1 flex flex-col items-center gap-5">
                <div class="detail-image-card"><img src="${escapeHtml(card.imagem)}" alt="${escapeHtml(card.nome)}" class="shadow-2xl"></div>
                <div class="w-full max-w-sm correspondence-panel p-5 rounded-[1.4rem]">
                    <h3 class="font-playfair text-2xl mb-4 text-center">${t('detail_correspondences')}</h3>
                    <ul class="space-y-2 text-sm md:text-base">
                        ${response}
                        <li><strong>🔥 ${t('card_element')}:</strong> ${escapeHtml(card.elemento)}</li>
                        <li><strong>🃏 ${t('card_suit')}:</strong> ${escapeHtml(card.naipe)}</li>
                        <li><strong>🪐 ${t('card_planet')}:</strong> ${escapeHtml(card.planeta)}</li>
                        <li><strong>✨ ${t('card_sign')}:</strong> ${escapeHtml(card.signo)}</li>
                    </ul>
                </div>
            </div>
            <div class="md:col-span-2 space-y-5">
                <div>
                    <div class="flex flex-wrap items-center gap-3 mb-3"><span class="element-pill element-${cls}">${escapeHtml(card.elemento)}</span><span class="text-sm opacity-75">${escapeHtml(card.naipe)} • ${escapeHtml(cardNumber(card))}</span></div>
                    <h2 class="font-playfair text-4xl md:text-5xl leading-tight">${escapeHtml(card.nome)}</h2>
                </div>
                ${detailSection(t('detail_keywords'), `<p class="italic">${joinList(card.palavras_chave)}.</p>`)}
                ${detailSection(t('detail_reversed'), `<p class="italic">${joinList(card.palavras_chave_invertido)}.</p>`)}
                ${detailSection(t('detail_essence'), `<p class="whitespace-pre-wrap">${escapeHtml(card.descricao)}</p>`)}
                ${detailSection(t('detail_image'), `<p class="whitespace-pre-wrap">${escapeHtml(card.interpretacao_imagem)}</p>`)}
                ${detailSection(t('detail_magical'), `
                    ${list(card.cristais).length ? `<p><strong>💎 Cristais:</strong> ${joinList(card.cristais)}.</p>` : ''}
                    ${list(card.ervas).length ? `<p><strong>🌿 Ervas:</strong> ${joinList(card.ervas)}.</p>` : ''}
                    ${list(card.aromaterapia).length ? `<p><strong>🌸 Aromaterapia:</strong> ${joinList(card.aromaterapia)}.</p>` : ''}`)}
                ${detailSection(t('detail_cabalistic'), `<p class="whitespace-pre-wrap">${escapeHtml(card.referencias_cabalisticas)}</p>`)}
            </div>`;

        showView('card-detail-view', true);
    }

    function updateDrawButtonLabels() {
        if (!currentDrawRevealed && currentDraw.length) {
            drawButton.textContent = t('shuffling');
            drawThreeButton.textContent = t('shuffling');
            return;
        }
        drawButton.textContent = currentDraw.length === 1 ? t('draw_one_new') : t('draw_one');
        drawThreeButton.textContent = currentDraw.length === 3 ? t('draw_three_new') : t('draw_three');
    }

    function cancelDrawTimers() {
        drawTimers.forEach(timerId => window.clearTimeout(timerId));
        drawTimers.clear();
    }

    function scheduleDrawTimer(callback, delay) {
        const timerId = window.setTimeout(() => {
            drawTimers.delete(timerId);
            callback();
        }, delay);
        drawTimers.add(timerId);
    }

    function resetDraw() {
        cancelDrawTimers();
        currentDraw = [];
        currentDrawRevealed = false;
        shuffleContainer.innerHTML = '';
        shuffleContainer.classList.add('hidden');
        drawButton.disabled = false;
        drawThreeButton.disabled = false;
        drawButton.textContent = t('draw_one');
        drawThreeButton.textContent = t('draw_three');
        clearAiReading();
        updateAiAvailability();
    }

    function drawCards(count) {
        window.PocketAccessibility?.stop();
        cancelDrawTimers();
        drawButton.disabled = true;
        drawThreeButton.disabled = true;
        (count === 1 ? drawButton : drawThreeButton).textContent = t('shuffling');
        shuffleContainer.innerHTML = '';
        shuffleContainer.classList.remove('hidden');

        const pool = [...cards];
        currentDraw = Array.from({ length: count }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        currentDrawRevealed = false;
        clearAiReading();
        updateAiAvailability();

        currentDraw.forEach((card, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'shuffle-container draw-card-wrap flex flex-col items-center';
            wrapper.innerHTML = `
                ${count === 3 ? `<div class="draw-position-label"><span>${index + 1}</span>${drawPositions()[index]}</div>` : ''}
                <div class="card-flip cursor-pointer" role="button" tabindex="0" aria-label="${escapeHtml(t('reveal_card'))} ${escapeHtml(card.nome)}">
                    <div class="card-face card-face-back"><div class="card-back-ornament" aria-hidden="true"><span class="card-back-moon">☾</span><span class="card-back-star">✦</span><span class="card-back-moon">☽</span></div></div>
                    <div class="card-face card-face-front"><img src="${escapeHtml(card.imagem)}" alt="${escapeHtml(card.nome)}" class="w-full h-full object-cover rounded-lg"></div>
                </div>
                <p class="draw-card-label opacity-0 transition-opacity duration-1000 text-center">${escapeHtml(card.nome)}</p>`;
            shuffleContainer.appendChild(wrapper);

            const flip = wrapper.querySelector('.card-flip');
            const label = wrapper.querySelector('.draw-card-label');
            const open = () => flip.classList.contains('is-flipped') && showCardDetail(card.id, true);
            flip.addEventListener('click', open);
            flip.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                }
            });
            scheduleDrawTimer(() => {
                flip.classList.add('is-flipped');
                label.classList.remove('opacity-0');
            }, 500 + index * 900);
        });

        scheduleDrawTimer(() => {
            currentDrawRevealed = true;
            drawButton.disabled = false;
            drawThreeButton.disabled = false;
            updateDrawButtonLabels();
            updateAiAvailability();
        }, 900 + count * 900);
    }

    function clearAiReading() {
        readingRequestId += 1;
        if (readingRequestController) readingRequestController.abort();
        readingRequestController = null;
        narrationRequestId += 1;
        if (narrationRequestController) narrationRequestController.abort();
        narrationRequestController = null;
        narrationInFlight = false;
        aiReadingContent.querySelectorAll('audio').forEach(player => {
            player.pause();
            if (player.dataset.url) URL.revokeObjectURL(player.dataset.url);
            player.removeAttribute('src');
        });
        lastReading = null;
        aiReadingLoading.classList.add('hidden');
        aiReadingContent.innerHTML = '';
        aiReadingResult.classList.add('hidden');
        interpretAiButton.classList.remove('is-loading');
        interpretAiButton.innerHTML = `<span aria-hidden="true">✦</span> ${t('interpret_btn')}`;
        aiRequestInFlight = false;
    }

    function updateAiAvailability() {
        const hasDraw = currentDraw.length > 0 && currentDrawRevealed;
        const hasQuestion = questionInput.value.trim().length > 0;

        aiReadingActions.classList.toggle('hidden', !hasDraw);
        interpretAiButton.disabled = !hasDraw || !hasQuestion || aiRequestInFlight;

        if (!hasQuestion && hasDraw) {
            aiReadingHint.textContent = t('hint_question_only');
        } else if (hasQuestion && hasDraw) {
            aiReadingHint.textContent = t('hint_ready');
        } else {
            aiReadingHint.textContent = t('hint_need_question');
        }
    }

    function buildAiPayload() {
        return {
            tipo: currentDraw.length === 3 ? 'tres_cartas' : 'uma_carta',
            pergunta: questionInput.value.trim(),
            idioma: window.I18N ? I18N.lang : 'en',
            // O Worker recupera todos os significados e metadados de seu baralho canônico.
            cartas: currentDraw.map(card => ({ nome: card.nome }))
        };
    }

    function appendReadingSection(parent, title, content, className = '') {
        if (!content) return;

        const section = document.createElement('section');
        section.className = `ai-reading-section ${className}`.trim();

        const heading = document.createElement('h3');
        heading.className = 'ai-reading-section-title';
        heading.textContent = title;

        const paragraph = document.createElement('p');
        paragraph.className = 'ai-reading-text';
        paragraph.textContent = content;

        section.appendChild(heading);
        section.appendChild(paragraph);
        parent.appendChild(section);
    }

    function renderAiReading(data) {
        const reading = data?.interpretacao;
        if (!reading) throw new Error(t('error_empty'));

        lastReading = data;

        aiReadingContent.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'ai-reading-header';

        const kicker = document.createElement('p');
        kicker.className = 'section-kicker';
        kicker.textContent = t('reading_kicker');

        const title = document.createElement('h2');
        title.className = 'font-playfair text-3xl md:text-4xl';
        title.textContent = reading.titulo || t('reading_fallback_title');

        const question = document.createElement('p');
        question.className = 'ai-reading-question';
        question.textContent = `“${data.pergunta}”`;

        header.appendChild(kicker);
        header.appendChild(title);
        header.appendChild(question);
        aiReadingContent.appendChild(header);

        if (reading.abertura) {
            const opening = document.createElement('p');
            opening.className = 'ai-reading-opening';
            opening.textContent = reading.abertura;
            aiReadingContent.appendChild(opening);
        }

        if (data.tipo === 'tres_cartas' && Array.isArray(reading.cartas)) {
            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'ai-reading-cards-grid';

            reading.cartas.forEach(item => {
                const cardSection = document.createElement('section');
                cardSection.className = 'ai-reading-card';

                const position = document.createElement('p');
                position.className = 'ai-reading-position';
                position.textContent = item.posicao || '';

                const name = document.createElement('h3');
                name.className = 'font-playfair text-2xl';
                name.textContent = item.carta || '';

                const interpretation = document.createElement('p');
                interpretation.className = 'ai-reading-text';
                interpretation.textContent = item.interpretacao || '';

                cardSection.appendChild(position);
                cardSection.appendChild(name);
                cardSection.appendChild(interpretation);
                cardsGrid.appendChild(cardSection);
            });

            aiReadingContent.appendChild(cardsGrid);
            appendReadingSection(aiReadingContent, t('section_synthesis'), reading.sintese, 'ai-reading-highlight');
        } else if (reading.carta) {
            appendReadingSection(
                aiReadingContent,
                reading.carta.nome || currentDraw[0]?.nome || t('card_drawn'),
                reading.carta.interpretacao,
                'ai-reading-highlight'
            );
        }

        appendReadingSection(aiReadingContent, t('section_answer'), reading.resposta, 'ai-reading-answer');
        appendReadingSection(aiReadingContent, t('section_guidance'), reading.orientacao);

        const disclaimer = document.createElement('p');
        disclaimer.className = 'ai-reading-disclaimer';
        disclaimer.textContent = t('disclaimer');
        aiReadingContent.appendChild(disclaimer);

        // Attribution is controlled by the backend response, never by the
        // generated interpretation. Only recognize the actual known model IDs.
        const modelLabels = {
            '@cf/google/gemma-4-26b-a4b-it': 'Gemma 4 26B A4B (Google)',
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Llama 3.3 70B (Meta)'
        };
        const modelCredit = document.createElement('p');
        modelCredit.className = 'ai-reading-model-credit';
        modelCredit.textContent = t('reading_model_credit') + ' ' +
            (modelLabels[data.model] || t('reading_model_unknown')) + '.';
        aiReadingContent.appendChild(modelCredit);

        const narrationRow = document.createElement('div');
        narrationRow.className = 'ai-reading-narration';

        const narrationButton = document.createElement('button');
        narrationButton.type = 'button';
        narrationButton.className = 'toolbar-button toolbar-button-primary';
        narrationButton.innerHTML = `<span aria-hidden="true">🔊</span> ${t('narrate_btn')}`;
        narrationButton.addEventListener('click', () => narrateReading(narrationButton, narrationRow));

        if (data.narrationToken) {
            narrationRow.appendChild(narrationButton);
            const narrationCredit = document.createElement('p');
            narrationCredit.className = 'ai-reading-provider-credit';
            narrationCredit.textContent = t('narration_provider_credit');
            narrationRow.appendChild(narrationCredit);
            aiReadingContent.appendChild(narrationRow);
        }

        aiReadingResult.classList.remove('hidden');
        aiReadingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function narrateReading(button, row) {
        if (narrationInFlight || !lastReading?.narrationToken) return;
        window.PocketAccessibility?.stop();

        narrationInFlight = true;
        const requestId = ++narrationRequestId;
        const controller = new AbortController();
        narrationRequestController = controller;
        button.disabled = true;
        button.textContent = t('narrate_loading');

        try {
            const response = await fetch(NARRATE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ narrationToken: lastReading.narrationToken }),
                signal: controller.signal
            });
            if (requestId !== narrationRequestId) return;

            if (!response.ok) throw new Error(`narration-http-${response.status}`);

            const blob = await response.blob();
            if (requestId !== narrationRequestId) return;
            let player = row.querySelector('audio');

            if (!player) {
                player = document.createElement('audio');
                player.controls = true;
                player.className = 'ai-reading-audio';
                row.appendChild(player);
            }

            if (player.dataset.url) URL.revokeObjectURL(player.dataset.url);
            const url = URL.createObjectURL(blob);
            player.dataset.url = url;
            player.src = url;
            player.play().catch(() => {});

            button.textContent = t('narrate_again');
        } catch (error) {
            if (requestId !== narrationRequestId) return;
            console.error('Falha na narração:', error);
            button.textContent = t('narrate_failed');
        } finally {
            if (requestId === narrationRequestId) {
                narrationRequestController = null;
                narrationInFlight = false;
                button.disabled = false;
            }
        }
    }

    async function requestAiReading() {
        if (aiRequestInFlight || !currentDrawRevealed || currentDraw.length === 0) return;
        window.PocketAccessibility?.stop();

        if (!questionInput.value.trim()) {
            questionInput.focus();
            updateAiAvailability();
            return;
        }

        if (!navigator.onLine) {
            aiReadingResult.classList.remove('hidden');
            aiReadingContent.innerHTML = '';
            appendReadingSection(aiReadingContent, t('unavailable_title'), t('offline_msg'));
            return;
        }

        aiRequestInFlight = true;
        interpretAiButton.disabled = true;
        interpretAiButton.classList.add('is-loading');
        interpretAiButton.textContent = t('loading_title');
        aiReadingResult.classList.remove('hidden');
        aiReadingLoading.classList.remove('hidden');
        aiReadingContent.innerHTML = '';

        const controller = new AbortController();
        const requestId = ++readingRequestId;
        readingRequestController = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), 105000);

        try {
            const response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildAiPayload()),
                signal: controller.signal
            });
            const data = await response.json().catch(() => null);
            if (requestId !== readingRequestId) return;

            if (!response.ok || !data?.ok) {
                throw new Error(data?.details || data?.error || t('error_failed'));
            }

            aiReadingLoading.classList.add('hidden');
            renderAiReading(data);
        } catch (error) {
            if (requestId !== readingRequestId) return;
            aiReadingLoading.classList.add('hidden');
            aiReadingContent.innerHTML = '';
            const message = error.name === 'AbortError'
                ? t('error_slow')
                : t('error_generic');

            appendReadingSection(aiReadingContent, t('no_answer_title'), message);
            aiReadingResult.classList.remove('hidden');
            console.error('Falha na interpretação com IA:', error);
        } finally {
            window.clearTimeout(timeoutId);
            if (requestId === readingRequestId) {
                readingRequestController = null;
                aiRequestInFlight = false;
                interpretAiButton.classList.remove('is-loading');
                interpretAiButton.innerHTML = `<span aria-hidden="true">✦</span> ${t('interpret_btn')}`;
                updateAiAvailability();
            }
        }
    }

    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.view === 'home-view') {
                currentFilter = { type: null, value: null };
                searchInput.value = '';
                renderCards();
            }
            showView(button.dataset.view);
        });
    });
    document.getElementById('return-gallery-button').addEventListener('click', () => {
        if (currentDetailFromDraw) {
            currentFilter = { type: null, value: null };
            searchInput.value = '';
            renderCards();
        }
        showView('home-view', true);
    });
    document.getElementById('return-draw-button').addEventListener('click', () => showView('random-draw-view', true));
    searchInput.addEventListener('input', renderCards);
    questionInput.addEventListener('input', () => {
        questionCount.textContent = `${questionInput.value.length}/800`;
        updateAiAvailability();
    });
    drawButton.addEventListener('click', () => drawCards(1));
    drawThreeButton.addEventListener('click', () => drawCards(3));
    interpretAiButton.addEventListener('click', requestAiReading);
    exploreMenuButton.addEventListener('click', () => {
        const open = exploreMenu.classList.contains('hidden');
        exploreMenu.classList.toggle('hidden');
        exploreMenuButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
        if (!exploreMenu.contains(event.target) && !exploreMenuButton.contains(event.target)) closeExploreMenu();
    });

    populateExploreMenu();
    renderCards();
    updateAiAvailability();
})();
