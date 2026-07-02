// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md


// ---------------------------------------------------------------------------
// Localized labels
// ---------------------------------------------------------------------------
const i18n = (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n : null;
const msg = (key, fallback) => {
    const m = i18n ? i18n.getMessage(key) : '';
    return m || fallback || '';
};

// pt-BR sees PIX; any other browser UI language sees the international donation
// links instead. Decided automatically — there is no manual switcher. Must match
// pt-BR specifically: PIX is Brazil-only, and pt-PT users can't use it.
export const isBrazil = () => /^pt[-_]?br/i.test((i18n ? i18n.getUILanguage() : '') || '');

export const label = {
    // App
    appName: msg('appName', 'TrueLive'),
    tagline: msg('tagline', 'O ao vivo de verdade — menor delay possível'),

    // Modes / presets
    sectionMode: msg('sectionMode', 'Modo'),

    modeOff: msg('modeOff', 'Desligado'),
    modeOffDesc: msg('modeOffDesc', 'Reprodução normal, sem ajustes.'),

    modeAuto: msg('modeAuto', 'Automático'),
    modeAutoDesc: msg('modeAutoDesc', 'Equilibra delay e estabilidade pela sua internet, sozinho.'),

    modeEdge: msg('modeEdge', 'Super Ao Vivo'),
    modeEdgeDesc: msg('modeEdgeDesc', 'O menor delay que sua internet permite — recua sozinho se precisar.'),

    // Player indicators
    sectionIndicators: msg('sectionIndicators', 'Indicadores no player'),
    showPlaybackRate: msg('showPlaybackRate'),
    showLatency: msg('showLatency'),
    showPinned: msg('showPinned', 'Painel fixo de atraso (sempre visível)'),
    showHealth: msg('showHealth'),

    // Reset
    reset: msg('reset', 'Restaurar padrões'),
    resetHint: msg('resetHint', 'Segure por 1 segundo para restaurar.'),

    supportCopied: msg('supportCopied', 'Copiado!'),
    supportToggle: msg('supportToggle', 'Apoiar o projeto'),
    supportTitle2: msg('supportTitle2', 'Me pague um café via PIX'),
    supportScan2: msg('supportScan2', 'Aponte a câmera do app do banco, ou copie o código:'),
    supportCopy2: msg('supportCopy2', 'Copiar código PIX'),
    supportFree: msg('supportFree', 'Livre'),
    supportIntl: msg('supportIntl', 'Doar em US$ (cartão)'),





    // Player-indicator accessibility labels
    a11yPlaybackRate: msg('a11yPlaybackRate', 'Velocidade de reprodução'),
    a11yLatency: msg('a11yLatency', 'Latência ao vivo'),
    a11yHealth: msg('a11yHealth', 'Saúde do buffer'),
    a11yEstimation: msg('a11yEstimation', 'Horário estimado para alcançar o ao vivo'),
    a11yCurrent: msg('a11yCurrent', 'Tempo atual (clique para copiar o link)'),

    // Go-live quick action (popup button) — reuses the shortcut's i18n string.
    goLiveBtn: msg('commandGoLiveDesc', 'Jump to live'),
};

// ---------------------------------------------------------------------------
// Storage keys (DO NOT rename — existing users have data under these keys).
// This includes the "skipThreathold" typo: the key is frozen by user data, so
// identifiers shaped like it stay misspelled on purpose.
// The engine (content.js / inject.js) still reads every key below; the popup
// only writes them through presets. showEstimation / showCurrent stay so the
// engine keeps resolving them (defaulting to off), even though the popup no
// longer exposes a toggle for them.
// ---------------------------------------------------------------------------
export const storage = ['enabled', 'playbackRate', 'showPlaybackRate', 'showLatency', 'showHealth', 'showEstimation', 'showCurrent', 'showPinned', 'bufferTarget', 'auto', 'skip', 'skipThreathold', 'edge'];

// ---------------------------------------------------------------------------
// Control/meta keys, driven by the keyboard shortcuts and the "jump to live"
// chip. Kept out of `storage` (the engine's loadSettings ignores them) and out
// of `donateKeys` ("Restore defaults" leaves them untouched).
// ---------------------------------------------------------------------------

/**
 * One-shot "jump to live" nonce; content.js forwards it to the engine.
 * Legacy/global signal: every open YouTube tab reacts to it, since
 * `chrome.storage.local` has no per-tab scoping. The "go-live" keyboard
 * shortcut no longer writes this key — it targets the active tab directly via
 * `chrome.tabs.sendMessage` (see background.js). Kept for any other caller
 * that still needs an all-tabs signal; do not use it for anything meant to
 * affect only the active tab.
 */
export const goLiveSignalKey = 'goLiveSignal';
/** Mode to restore when the toggle shortcut re-enables playback after Off. */
export const lastModeKey = 'lastMode';

/**
 * Write a one-shot "jump to live" signal to storage.
 * @param {(items: Object) => void} setter - `chrome.storage.local.set`, injected so this stays pure and unit-testable.
 * @param {number} [now] - Nonce value; defaults to `Date.now()`.
 */
export function emitGoLive(setter, now = Date.now()) {
    setter({ [goLiveSignalKey]: now });
}

/**
 * Compute the toggle shortcut's action: flip between Off and the last active mode.
 * @param {Object} data - Resolved settings (as read from storage).
 * @param {string} [lastMode] - Previously remembered mode name.
 * @returns {{apply: Object, remember: (string|undefined)}} `apply` is the preset to write; `remember` is the mode to store when turning Off (undefined leaves `lastMode` untouched).
 */
export function toggleEnabledAction(data, lastMode) {
    // Anything with enabled=false counts as "off" for the toggle — including
    // legacy data written before presets existed (e.g. {enabled:false} with
    // skip left at its default), which deriveMode reports as "custom". Without
    // this, the first key press would rewrite "off" instead of turning back on.
    if (!value(data.enabled, defaultEnabled)) {
        const restore = (lastMode && lastMode !== 'off' && presets[lastMode]) ? lastMode : 'auto';
        return { apply: presets[restore], remember: undefined };
    }
    const mode = deriveMode(data);
    return { apply: presets.off, remember: mode === 'custom' ? undefined : mode };
}


export const defaultEnabled = true;

export const defaultPlaybackRate = 1.25;
export const minPlaybackRate = 1.05;
export const maxPlaybackRate = 16.0;
export const stepPlaybackRate = 0.05;

export const defaultShowPlaybackRate = true;
export const defaultShowLatency = true;
export const defaultShowHealth = true;
export const defaultShowEstimation = false;
export const defaultShowCurrent = false;
export const defaultShowPinned = true;

// Catch-up speed (how fast it accelerates while reducing latency). Validated
// on real streams: a gentle 1.25x reduces latency smoothly without overshoot.
// `bufferTarget` = how many seconds of (smoothed) buffer each mode keeps; less
// buffer means closer to live but needs a better connection. `auto` lets the
// engine pick the target from the measured connection.
export const defaultAuto = true;
export const defaultEdge = false;
export const defaultBufferTarget = 6.0;
export const minBufferTarget = 2.0;
export const maxBufferTarget = 15.0;
export const stepBufferTarget = 0.5;

// Skip-to-live is on by default, 30 s behind.
export const defaultSkip = true;
export const defaultSkipThreathold = 30.0;
export const minSkipThreathold = 1.0;
export const maxSkipThreathold = 999999.0;
export const stepSkipThreathold = 1.0;

// ---------------------------------------------------------------------------
// Presets — every setting is delivered through one of these modes. The popup
// no longer edits primitives directly; clicking a mode writes its primitives,
// and the active mode is derived back from them (see deriveMode).
// ---------------------------------------------------------------------------
export const presets = {
    off: {
        enabled: false,
        skip: false,
    },
    auto: {
        enabled: true,
        playbackRate: 1.25,
        auto: true,
        skip: true,
        skipThreathold: 30.0,
        edge: false,
    },
    // Super Ao Vivo: edge-riding adaptativo (reserva 2.0-4.5s conforme a conexão)
    // com suspensão graciosa para Automático em internet fraca. bufferTarget é o
    // fallback do controller durante a suspensão.
    edge: {
        enabled: true,
        playbackRate: 1.25,
        auto: false,
        bufferTarget: 3.5,
        skip: true,
        skipThreathold: 30.0,
        edge: true,
    },
};

// Order shown in the UI, with display metadata.
export const modeOrder = ['off', 'auto', 'edge'];

export const modeMeta = {
    off: { title: label.modeOff, desc: label.modeOffDesc },
    auto: { title: label.modeAuto, desc: label.modeAutoDesc },
    edge: { title: label.modeEdge, desc: label.modeEdgeDesc },
};

/**
 * Resolve raw storage data into a full settings object: defaults applied,
 * numeric values clamped and snapped. Single source of truth shared by the
 * content script, the popup and deriveMode.
 * @param {Object} d - Raw data as read from `chrome.storage.local`.
 */
export function resolveSettings(d) {
    return {
        enabled: value(d.enabled, defaultEnabled),
        playbackRate: limitValue(d.playbackRate, defaultPlaybackRate, minPlaybackRate, maxPlaybackRate, stepPlaybackRate),
        showPlaybackRate: value(d.showPlaybackRate, defaultShowPlaybackRate),
        showLatency: value(d.showLatency, defaultShowLatency),
        showHealth: value(d.showHealth, defaultShowHealth),
        showEstimation: value(d.showEstimation, defaultShowEstimation),
        showCurrent: value(d.showCurrent, defaultShowCurrent),
        showPinned: value(d.showPinned, defaultShowPinned),
        bufferTarget: limitValue(d.bufferTarget, defaultBufferTarget, minBufferTarget, maxBufferTarget, stepBufferTarget),
        auto: value(d.auto, defaultAuto),
        skip: value(d.skip, defaultSkip),
        skipThreathold: value(d.skipThreathold, defaultSkipThreathold),
        edge: value(d.edge, defaultEdge),
    };
}

// Derive which mode is active from the resolved settings.
export function deriveMode(d) {
    const r = resolveSettings(d);
    const eq = (a, b) => Math.abs(a - b) < 0.001;
    for (const name of modeOrder) {
        const preset = presets[name];
        let ok = true;
        for (const [k, v] of Object.entries(preset)) {
            if (typeof v === 'number') {
                if (!eq(r[k], v)) { ok = false; break; }
            } else if (r[k] !== v) {
                ok = false; break;
            }
        }
        if (ok) return name;
    }
    return 'custom';
}

export function value(v, fallback) {
    return v ?? fallback;
}

export function limitValue(v, fallback, min_value, max_value, step_value) {
    return step(range(normalize(v, fallback), min_value, max_value), step_value);
}

function isNumber(v) {
    return Number.isFinite(parseFloat(v));
}

function normalize(v, fallback) {
    return isNumber(v) ? v : fallback;
}

function range(v, min_value, max_value) {
    return Math.min(Math.max(v, min_value), max_value);
}

function step(v, step_value) {
    const steps_per_unit = 1.0 / step_value;
    return Math.round(v * steps_per_unit) / steps_per_unit;
}

export function isLiveChat(url) {
    return url.startsWith('https://www.youtube.com/live_chat?')
        || url.startsWith('https://www.youtube.com/live_chat_replay?')
        ;
}
