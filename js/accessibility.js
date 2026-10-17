/* Pocket Oracle — optional local browser speech and visual theme.
 * No microphone, external TTS or telemetry.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'pocket-oracle-theme';
    const root = document.documentElement;
    const switchTheme = document.getElementById('theme-toggle');
    const speechButton = document.getElementById('site-read-toggle');
    const cardButton = document.getElementById('read-card-button');
    const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    let activeSpeech = false;
    let utteranceId = 0;

    function tr(key) {
        return window.I18N ? window.I18N.t(key) : key;
    }

    function storedTheme() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
        } catch {
            return 'light';
        }
    }

    function updateThemeButton() {
        if (!switchTheme) return;
        const dark = root.dataset.theme === 'dark';
        switchTheme.setAttribute('aria-pressed', String(dark));
        switchTheme.setAttribute('aria-label', tr(dark ? 'theme_to_light' : 'theme_to_dark'));
        switchTheme.setAttribute('title', tr(dark ? 'theme_to_light' : 'theme_to_dark'));
        const icon = switchTheme.querySelector('[aria-hidden]');
        if (icon) icon.textContent = dark ? '☀' : '☾';
    }

    function setTheme(theme) {
        const value = theme === 'dark' ? 'dark' : 'light';
        root.dataset.theme = value;
        root.style.colorScheme = value;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = value === 'dark' ? '#161923' : '#6b3f2a';
        try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode */ }
        updateThemeButton();
    }

    function updateSpeechButtons() {
        if (speechButton) {
            speechButton.disabled = !speechSupported;
            speechButton.setAttribute('aria-pressed', String(activeSpeech));
            const label = !speechSupported ? tr('speech_unavailable')
                : activeSpeech ? tr('speech_stop') : tr('speech_start');
            speechButton.setAttribute('aria-label', label);
            speechButton.setAttribute('title', label);
            const icon = speechButton.querySelector('[aria-hidden]');
            if (icon) icon.textContent = activeSpeech ? '■' : '🔊';
        }
        if (cardButton) {
            cardButton.disabled = !speechSupported;
            cardButton.textContent = !speechSupported ? tr('speech_unavailable')
                : activeSpeech ? tr('speech_stop') : tr('speech_card');
            cardButton.setAttribute('aria-pressed', String(activeSpeech));
        }
    }

    function stop() {
        utteranceId += 1;
        activeSpeech = false;
        if (speechSupported) window.speechSynthesis.cancel();
        updateSpeechButtons();
    }

    function visibleView() {
        return ['home-view', 'card-detail-view', 'random-draw-view']
            .map(id => document.getElementById(id))
            .find(element => element && !element.classList.contains('hidden'));
    }

    function readableText(scope) {
        if (!scope) return '';
        const copy = scope.cloneNode(true);
        copy.querySelectorAll('button, input, textarea, audio, script, .hidden, [aria-hidden="true"], [data-no-read]')
            .forEach(element => element.remove());
        return (copy.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
    }

    function contentToRead() {
        const view = visibleView();
        if (!view) return '';

        // Respect a deliberate text selection within the visible view.
        // Private questions and AI results are excluded from native read-aloud.
        const selection = window.getSelection && window.getSelection();
        if (selection && selection.rangeCount && selection.toString().trim()
            && view.contains(selection.anchorNode) && view.contains(selection.focusNode)) {
            const ancestor = selection.getRangeAt(0).commonAncestorContainer;
            const element = ancestor.nodeType === 1 ? ancestor : ancestor.parentElement;
            if (element && !element.closest('textarea, input, #ai-reading-result')) {
                return selection.toString().trim().slice(0, 6000);
            }
        }

        if (view.id === 'card-detail-view') {
            return readableText(document.getElementById('card-detail-content'));
        }
        if (view.id === 'home-view') {
            return readableText(view.querySelector('.section-heading'));
        }
        // The draw introduction, not the visitor's personal question.
        return readableText(view.querySelector('.max-w-3xl'));
    }

    function read(text) {
        if (!speechSupported) return false;
        stop();
        if (!text || !text.trim()) return false;

        // Do not play local speech over ElevenLabs narration.
        document.querySelectorAll('.ai-reading-audio').forEach(player => player.pause());

        const currentId = ++utteranceId;
        const utterance = new window.SpeechSynthesisUtterance(text.trim());
        utterance.lang = window.I18N?.lang === 'pt' ? 'pt-BR' : 'en-US';
        utterance.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const locale = utterance.lang.toLowerCase();
        utterance.voice = voices.find(voice => voice.lang.toLowerCase() === locale)
            || voices.find(voice => voice.lang.toLowerCase().startsWith(locale.slice(0, 2)))
            || null;
        const finished = () => {
            if (currentId !== utteranceId) return;
            activeSpeech = false;
            updateSpeechButtons();
        };
        utterance.onend = finished;
        utterance.onerror = finished;
        activeSpeech = true;
        updateSpeechButtons();
        window.speechSynthesis.speak(utterance);
        return true;
    }

    if (switchTheme) {
        switchTheme.addEventListener('click', () => {
            setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        });
    }
    if (speechButton) {
        speechButton.addEventListener('click', () => {
            if (activeSpeech) stop();
            else read(contentToRead());
        });
    }
    if (cardButton) {
        cardButton.addEventListener('click', () => {
            if (activeSpeech) stop();
            else read(readableText(document.getElementById('card-detail-content')));
        });
    }

    // Preserve the established parchment palette for new visitors.
    setTheme(storedTheme());
    updateSpeechButtons();
    if (window.I18N) {
        window.I18N.onChange(() => {
            stop();
            updateThemeButton();
            updateSpeechButtons();
        });
    }

    window.PocketAccessibility = { stop, read, setTheme, contentToRead };
})();
