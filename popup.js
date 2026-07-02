// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md

import * as common from './common.js';
import * as pix from './pix.js';

const L = common.label;

// --------------------------------------------------------------- DOM helpers
const $ = sel => document.querySelector(sel);

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') node.className = v;
        else if (k === 'html') { if (v) node.append(parseSvg(v)); }
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
}

// Parse trusted static SVG markup (the generated QR) into a DOM node, avoiding
// innerHTML (and the addons-linter UNSAFE_VAR_ASSIGNMENT warning). Parse as
// text/html (not image/svg+xml): the HTML parser puts <svg> in the SVG
// namespace even without an xmlns attribute, so the inline SVG actually
// renders; image/svg+xml would drop it into the null namespace, invisible.
function parseSvg(markup) {
    return new DOMParser().parseFromString(markup, 'text/html').body.firstElementChild;
}

const getStorage = keys => new Promise(res => chrome.storage.local.get(keys, res));

/**
 * Wire ARIA radiogroup keyboard behavior: one tab-stop for the group (roving
 * tabindex) plus arrow/Home/End navigation that also activates the option.
 * @param {HTMLElement} container - The radiogroup element; receives the keydown listener.
 * @param {HTMLElement[]} items - Ordered radio elements.
 * @param {(index: number) => void} activate - Selects the item at `index`.
 * @returns {(index: number) => void} `roving(index)` - keeps the single tab-stop on the selected item when it changes externally (e.g. after a refresh).
 */
function wireRadiogroup(container, items, activate) {
    const roving = i => items.forEach((el, j) => { el.tabIndex = j === i ? 0 : -1; });
    roving(0);
    items.forEach((el, i) => el.addEventListener('click', () => roving(i)));
    container.addEventListener('keydown', e => {
        const cur = items.indexOf(document.activeElement);
        if (cur === -1) return;
        const last = items.length - 1;
        let next;
        switch (e.key) {
            case 'ArrowRight': case 'ArrowDown': next = cur >= last ? 0 : cur + 1; break;
            case 'ArrowLeft': case 'ArrowUp': next = cur <= 0 ? last : cur - 1; break;
            case 'Home': next = 0; break;
            case 'End': next = last; break;
            default: return;
        }
        e.preventDefault();
        roving(next);
        items[next].focus();
        activate(next);
    });
    return roving;
}

// --------------------------------------------------------------- State
let state = {};
const updaters = [];          // fn() -> sync a control's display
const modeCards = {};         // mode name -> card element
let rovingModes = null;       // wireRadiogroup roving-tabindex setter for modes

function setOne(key, val) {
    state[key] = val;
    chrome.storage.local.set({ [key]: val });
    refresh();
}

function applyPreset(name) {
    const preset = common.presets[name];
    chrome.storage.local.set(preset);
    Object.assign(state, preset);
    refresh();
}

// --------------------------------------------------------------- Render
function renderStatic() {
    $('#brand-name').textContent = L.appName;
    $('#brand-tagline').textContent = L.tagline;
    $('#modes-title').textContent = L.sectionMode;
    $('#advanced-label').textContent = L.sectionIndicators;
    $('#reset-label').textContent = L.reset;
    $('#reset').title = L.resetHint;
}

function renderModes() {
    const seg = $('#mode-seg');
    for (const name of common.modeOrder) {
        const meta = common.modeMeta[name];
        const btn = el('button', {
            class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': 'false',
        }, meta.title);
        btn.addEventListener('click', () => applyPreset(name));
        modeCards[name] = btn;
        seg.append(btn);
    }
    const items = common.modeOrder.map(n => modeCards[n]);
    rovingModes = wireRadiogroup(seg, items, idx => applyPreset(common.modeOrder[idx]));
}

// A labelled row: text on the left, control on the right.
function buildRow({ label, control }) {
    return el('div', { class: 'row' },
        el('div', { class: 'row-main' }, el('span', { class: 'row-label', text: label })),
        el('div', { class: 'row-control' }, control),
    );
}

// A toggle switch bound to a boolean storage key. Registers an updater so the
// checkbox reflects `state[key]` on every refresh().
function buildToggle(key) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!state[key];
    input.addEventListener('change', () => setOne(key, input.checked));
    updaters.push(() => { input.checked = !!state[key]; });
    return el('label', { class: 'switch' },
        input,
        el('span', { class: 'track', 'aria-hidden': 'true' }),
        el('span', { class: 'thumb', 'aria-hidden': 'true' }),
    );
}

function renderIndicators() {
    const rows = $('#indicator-rows');
    const defs = [
        { key: 'showPlaybackRate', label: L.showPlaybackRate },
        { key: 'showLatency', label: L.showLatency },
        { key: 'showHealth', label: L.showHealth },
        { key: 'showPinned', label: L.showPinned },
    ];
    for (const d of defs) {
        rows.append(buildRow({ label: d.label, control: buildToggle(d.key) }));
    }
}

function renderAdvancedToggle() {
    const toggle = $('#advanced-toggle');
    const panel = $('#advanced-panel');
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
    });
}

function renderReset() {
    const btn = $('#reset');
    // Keyboard path (review CRITICAL): Enter/Space perform the reset directly —
    // the 1s hold is a pointer affordance, not a security gate.
    btn.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        doReset();
    });
    let timer, armed = false, doneTimer;

    const start = () => {
        clearTimeout(timer);
        clearTimeout(doneTimer);
        btn.classList.remove('done');
        armed = false;
        void btn.offsetWidth; // restart the fill animation
        btn.classList.add('holding');
        timer = setTimeout(() => {
            btn.classList.remove('holding');
            btn.classList.add('done');
            armed = true;
        }, 1000);
    };
    const end = commit => {
        clearTimeout(timer);
        btn.classList.remove('holding');
        if (commit && armed) {
            doReset();
            doneTimer = setTimeout(() => btn.classList.remove('done'), 700);
        } else {
            btn.classList.remove('done');
        }
        armed = false;
    };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', () => end(true));
    btn.addEventListener('mouseleave', () => end(false));
    btn.addEventListener('touchstart', e => { e.preventDefault(); start(); }, { passive: false });
    btn.addEventListener('touchend', e => { e.preventDefault(); end(true); });
    btn.addEventListener('touchcancel', () => end(false));
}

function doReset() {
    // Only clear engine settings — keep the donation opt-out / snooze choices.
    chrome.storage.local.remove(common.storage);
    state = common.resolveSettings({});
    refresh();
}

// --------------------------------------------------------------- Support (PIX)
// Quiet by design: a single ghost button that expands into amount chips + QR +
// copy-paste code. No nudges, no banners, no badges — support is invited, never
// pushed. All generated locally (MV3: no remote code).
function renderSupport() {
    const toggle = $('#support-toggle');
    const panel = $('#support-panel');
    $('#support-toggle-label').textContent = L.supportToggle;
    $('#support-title').textContent = L.supportTitle2;
    $('#support-scan').textContent = L.supportScan2;
    const copyBtn = $('#support-copy');
    copyBtn.setAttribute('aria-live', 'polite');
    copyBtn.textContent = L.supportCopy2;

    let amount = pix.PIX_DEFAULT_AMOUNT;
    let copyTimer;

    function renderQr() {
        const box = $('#support-qr');
        const code = pix.buildPixCode(amount);
        copyBtn.dataset.code = code;
        if (typeof window.qrcode === 'function') {
            try {
                const qr = window.qrcode(0, 'M');
                qr.addData(code);
                qr.make();
                box.textContent = '';
                box.append(parseSvg(qr.createSvgTag({ cellSize: 4, scalable: true })));
            } catch { box.hidden = true; }
        }
    }

    const chipsBox = $('#support-amounts');
    const chips = [];
    // Fixed tiers + a trailing OPEN chip (value 0): the QR carries no amount
    // and the payer types whatever they want in the bank app.
    for (const value of [...pix.PIX_AMOUNTS, 0]) {
        const text = value === 0 ? L.supportFree : `R$ ${value}`;
        const chip = el('button', { class: 'support-chip', type: 'button', role: 'radio', 'aria-checked': String(value === amount) }, text);
        chip.addEventListener('click', () => {
            amount = value;
            for (const c of chips) c.setAttribute('aria-checked', String(c === chip));
            renderQr();
        });
        chips.push(chip);
        chipsBox.append(chip);
    }
    wireRadiogroup(chipsBox, chips, i => chips[i].click());

    // International donations (USD) — non-Brazilians can't pay PIX. A plain
    // link the user clicks; hidden until the page URL is configured.
    if (pix.INTL_DONATE_URL) {
        const intl = el('button', { class: 'support-intl', type: 'button' }, L.supportIntl);
        intl.addEventListener('click', () => chrome.tabs.create({ url: pix.INTL_DONATE_URL }));
        panel.append(intl);
    }

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(copyBtn.dataset.code || pix.buildPixCode(amount));
        copyBtn.textContent = L.supportCopied;
        copyBtn.classList.add('copied');
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { copyBtn.textContent = L.supportCopy2; copyBtn.classList.remove('copied'); }, 2500);
    });

    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
        if (!open) renderQr();
    });
}

// --------------------------------------------------------------- Refresh
function refresh() {
    const mode = common.deriveMode(state);
    let activeIndex = -1;
    common.modeOrder.forEach((name, i) => {
        const on = name === mode;
        modeCards[name].setAttribute('aria-checked', String(on));
        if (on) activeIndex = i;
    });
    // Keep the group's single tab-stop on the selected mode (first card if none).
    if (rovingModes) rovingModes(activeIndex >= 0 ? activeIndex : 0);
    // Progressive disclosure: only the SELECTED mode's one-line description shows.
    $('#mode-desc').textContent = common.modeMeta[mode] ? common.modeMeta[mode].desc : '';
    for (const u of updaters) u();
}

// --------------------------------------------------------------- Init
(async function init() {
    // The markup is language-neutral; reflect the real UI language for
    // screen readers and hyphenation (popup.html can't hardcode one).
    document.documentElement.lang = chrome.i18n.getUILanguage() || 'en';

    const data = await getStorage(common.storage);
    state = common.resolveSettings(data);
    renderStatic();
    renderModes();
    renderIndicators();
    renderAdvancedToggle();
    renderReset();
    renderSupport();
    refresh();

    // Keep the UI in sync with changes made elsewhere while the popup is open
    // (keyboard shortcut, the player's stall offer, another options window).
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !common.storage.some(k => k in changes)) return;
        getStorage(common.storage).then(d => {
            state = common.resolveSettings(d);
            refresh();
        });
    });
})();
