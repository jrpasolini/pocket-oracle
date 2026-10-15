/* Pocket Oracle — camada de idioma.
 * Inglês é o padrão; português é opção. Script clássico (sem módulos):
 * expõe window.I18N para o app.js.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'pocket-oracle-lang';
    const DEFAULT_LANG = 'en';

    const TEXTS = {
        en: {
            doc_title: 'Pocket Oracle — Rider-Waite Tarot',
            doc_description: 'Pocket Oracle: a bilingual Rider-Waite Tarot grimoire with Gemma AI readings and optional ElevenLabs narration.',

            hero_kicker: 'Rider-Waite • Study • Reading',
            hero_title: 'Pocket Oracle',
            hero_subtitle: 'The symbols of the classic Rider-Waite gathered into an interactive grimoire for study, contemplation and intuitive draws.',
            chip_cards: '78 cards',
            chip_major: '22 Major Arcana',
            chip_minor: '56 Minor Arcana',

            nav_all: 'All cards',
            nav_draw: 'Draw the cards',
            nav_explore: 'Explore by…',
            search_label: 'Search cards',
            search_placeholder: 'Search by name, symbol, keyword…',

            home_kicker: 'Complete grimoire',
            home_title: 'The 78 Tarot Cards',
            home_desc: 'Explore the Major and Minor Arcana — their imagery, correspondences, keywords and meanings.',

            back_to_draw: '← Back to the draw',
            back_to_gallery: '← Back to all cards',

            draw_kicker: 'Intuitive reading',
            draw_title: 'The Draw Ritual',
            draw_desc: 'Focus on your question, take a deep breath and choose a spread. The cards are revealed one by one.',
            question_label: 'Your question to the Tarot',
            question_placeholder: 'Write your question here. The draw works even without AI; the question is only sent if you ask for an interpretation.',
            question_note: 'The question is only sent when you ask for the AI interpretation.',

            draw_one: 'Draw one card',
            draw_one_new: 'Draw another card',
            reveal_card: 'Reveal',
            draw_three: 'Draw three cards',
            draw_three_new: 'New three-card draw',
            draw_hint: 'Tap a revealed card to see its details. For a reading of the whole spread, use the AI interpretation.',

            interpret_btn: 'Interpret this spread with AI',
            hint_need_question: 'Write a question and draw a spread to unlock the interpretation.',
            hint_question_only: 'Write your question above to unlock the AI interpretation.',
            hint_ready: 'The AI is only called when you press the button. The draw keeps working without it.',

            loading_title: 'Consulting the Tarot…',
            loading_desc: 'The reading is being woven from your question and the cards drawn.',

            reading_kicker: '✦ Tarot reading',
            reading_fallback_title: 'Interpretation of the spread',
            section_synthesis: 'Synthesis of the spread',
            section_answer: 'Answer to your question',
            section_guidance: 'Guidance',
            disclaimer: 'This is a symbolic, reflective interpretation of the Rider-Waite Tarot — not a certainty about future events.',

            narrate_btn: 'Listen to the reading',
            narrate_loading: 'Weaving the voice…',
            narrate_again: '↻ Listen again',
            narrate_failed: 'The voice did not answer — tap to try again',

            detail_essence: 'Essence and meanings',
            detail_image: 'Image interpretation',
            detail_magical: 'Magical affinities',
            detail_cabalistic: 'Cabbalistic references',

            prop_naipe: 'Suit',
            prop_elemento: 'Element',
            prop_signo: 'Sign',
            prop_planeta: 'Planet',

            rank_ace: 'Ace',
            rank_page: 'Page',
            rank_knight: 'Knight',
            rank_queen: 'Queen',
            rank_king: 'King',

            unavailable_title: 'Interpretation unavailable',
            offline_msg: 'You are offline. The draw works normally; connect to the internet when you want to ask for the AI reading.',
            error_empty: 'The interpretation came back empty.',
            error_failed: 'The interpretation could not be completed.',
            error_slow: 'The request took longer than expected. Your cards are still here; try again in a moment.',
            error_generic: 'The AI interpretation is temporarily unavailable. Your cards stay open for consultation, and you can try again later.',
            no_answer_title: 'The Tarot did not answer this time',

            lang_toggle: 'PT',
            lang_toggle_aria: 'Mudar para português',

            footer_brand: 'Pocket Oracle',
            footer_copyright: '© 2026 Antonio Pasolini and Melissa Pasolini',

            filter_results: 'Results for',
            clear_filter: 'Clear filter',
            no_cards: 'No card found.',
            detail_keywords: 'Keywords',
            detail_reversed: 'When reversed',
            detail_quick_answer: 'Quick answer',
            detail_correspondences: 'Correspondences',
            shuffling: 'Shuffling…',

            position_past: 'Past',
            position_present: 'Present',
            position_future: 'Future',
            position_main: 'Main card'
        },
        pt: {
            doc_title: 'Pocket Oracle — Tarô Rider-Waite',
            doc_description: 'Pocket Oracle: grimório bilíngue de Tarô Rider-Waite com leituras pela Gemma e narração opcional pela ElevenLabs.',

            hero_kicker: 'Rider-Waite • Estudo • Consulta',
            hero_title: 'Pocket Oracle',
            hero_subtitle: 'Os símbolos do clássico Rider-Waite reunidos em um grimório interativo para estudo, contemplação e tiragens intuitivas.',
            chip_cards: '78 cartas',
            chip_major: '22 Arcanos Maiores',
            chip_minor: '56 Arcanos Menores',

            nav_all: 'Todas as cartas',
            nav_draw: 'Consultar as cartas',
            nav_explore: 'Explorar por…',
            search_label: 'Pesquisar cartas',
            search_placeholder: 'Pesquisar por nome, símbolo, palavra-chave…',

            home_kicker: 'Grimório completo',
            home_title: 'As 78 Cartas do Tarot',
            home_desc: 'Explore os Arcanos Maiores e Menores, suas imagens, correspondências, palavras-chave e significados.',

            back_to_draw: '← Retornar à tiragem',
            back_to_gallery: '← Voltar para todas as cartas',

            draw_kicker: 'Consulta intuitiva',
            draw_title: 'Ritual de Tiragem',
            draw_desc: 'Concentre-se em sua pergunta, respire fundo e escolha uma tiragem. As cartas serão reveladas uma a uma.',
            question_label: 'Sua pergunta ao Tarot',
            question_placeholder: 'Escreva sua pergunta aqui. A tiragem funciona mesmo sem IA; a pergunta só será enviada se você solicitar uma interpretação.',
            question_note: 'A pergunta só é enviada quando você pede a interpretação com IA.',

            draw_one: 'Tirar uma carta',
            draw_one_new: 'Tirar outra carta',
            reveal_card: 'Revelar',
            draw_three: 'Tirar três cartas',
            draw_three_new: 'Nova tiragem de três cartas',
            draw_hint: 'Clique em uma carta revelada para consultar seus detalhes. Se quiser uma leitura conjunta, use a interpretação com IA.',

            interpret_btn: 'Interpretar esta tiragem com IA',
            hint_need_question: 'Escreva uma pergunta e faça uma tiragem para liberar a interpretação.',
            hint_question_only: 'Escreva sua pergunta acima para liberar a interpretação com IA.',
            hint_ready: 'A IA só será chamada quando você apertar o botão. A tiragem continua funcionando sem ela.',

            loading_title: 'Consultando o Tarot…',
            loading_desc: 'A leitura está sendo construída a partir da sua pergunta e das cartas sorteadas.',

            reading_kicker: '✦ Leitura do Tarot',
            reading_fallback_title: 'Interpretação da tiragem',
            section_synthesis: 'Síntese da tiragem',
            section_answer: 'Resposta à sua pergunta',
            section_guidance: 'Orientação',
            disclaimer: 'Esta é uma interpretação simbólica e reflexiva do Tarot Rider-Waite, não uma certeza sobre acontecimentos futuros.',

            narrate_btn: 'Ouvir a leitura',
            narrate_loading: 'Tecendo a voz…',
            narrate_again: '↻ Ouvir novamente',
            narrate_failed: 'A voz não respondeu — toque para tentar de novo',

            detail_essence: 'Essência e significados',
            detail_image: 'Interpretação da imagem',
            detail_magical: 'Afinidades mágicas',
            detail_cabalistic: 'Referências cabalísticas',

            prop_naipe: 'Naipe',
            prop_elemento: 'Elemento',
            prop_signo: 'Signo',
            prop_planeta: 'Planeta',

            rank_ace: 'Ás',
            rank_page: 'Pajem',
            rank_knight: 'Cavaleiro',
            rank_queen: 'Rainha',
            rank_king: 'Rei',

            unavailable_title: 'Interpretação indisponível',
            offline_msg: 'Você está offline. A tiragem continua disponível normalmente; conecte-se à internet quando quiser solicitar a leitura com IA.',
            error_empty: 'A interpretação veio vazia.',
            error_failed: 'A interpretação não pôde ser concluída.',
            error_slow: 'A consulta demorou mais que o esperado. Suas cartas continuam aqui; tente novamente em alguns instantes.',
            error_generic: 'A interpretação com IA está temporariamente indisponível. Suas cartas continuam abertas para consulta e você pode tentar novamente depois.',
            no_answer_title: 'O Tarot não respondeu desta vez',

            lang_toggle: 'EN',
            lang_toggle_aria: 'Switch to English',

            footer_brand: 'Pocket Oracle',
            footer_copyright: '© 2026 Antonio Pasolini e Melissa Pasolini',

            filter_results: 'Resultados para',
            clear_filter: 'Limpar filtro',
            no_cards: 'Nenhuma carta encontrada.',
            detail_keywords: 'Palavras-chave',
            detail_reversed: 'Quando invertida',
            detail_quick_answer: 'Resposta rápida',
            detail_correspondences: 'Correspondências',
            shuffling: 'Embaralhando…',

            position_past: 'Passado',
            position_present: 'Presente',
            position_future: 'Futuro',
            position_main: 'Carta principal'
        }
    };

    function normalize(lang) {
        return lang === 'pt' ? 'pt' : 'en';
    }

    let stored = null;
    try {
        stored = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        stored = null;
    }

    let current = normalize(stored || DEFAULT_LANG);

    function t(key) {
        const table = TEXTS[current] || TEXTS[DEFAULT_LANG];
        return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
    }

    function apply(root) {
        const scope = root || document;

        scope.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = t(element.dataset.i18n);
        });

        scope.querySelectorAll('[data-i18n-ph]').forEach(element => {
            element.setAttribute('placeholder', t(element.dataset.i18nPh));
        });

        scope.querySelectorAll('[data-i18n-aria]').forEach(element => {
            element.setAttribute('aria-label', t(element.dataset.i18nAria));
        });

        document.title = t('doc_title');

        const description = document.querySelector('meta[name="description"]');
        if (description) description.setAttribute('content', t('doc_description'));

        const html = document.documentElement;
        html.lang = current === 'pt' ? 'pt-BR' : 'en';

        const toggles = document.querySelectorAll('[data-lang-toggle]');
        toggles.forEach(toggle => {
            toggle.textContent = t('lang_toggle');
            toggle.setAttribute('aria-label', t('lang_toggle_aria'));
        });
    }

    function cards() {
        if (current === 'en' && Array.isArray(window.cardDatabaseEN) && window.cardDatabaseEN.length) {
            return window.cardDatabaseEN;
        }
        return window.cardDatabase;
    }

    const listeners = [];

    function onChange(handler) {
        listeners.push(handler);
    }

    function setLang(lang, options = {}) {
        const next = normalize(lang);
        if (next === current && !options.force) return;

        current = next;
        try {
            window.localStorage.setItem(STORAGE_KEY, current);
        } catch (error) {
            /* modo privado: segue sem persistir */
        }

        apply();
        listeners.forEach(handler => handler(current));
    }

    function boot() {
        apply();

        document.querySelectorAll('[data-lang-toggle]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                setLang(current === 'pt' ? 'en' : 'pt');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.I18N = {
        t,
        apply,
        cards,
        onChange,
        setLang,
        get lang() {
            return current;
        }
    };
})();
