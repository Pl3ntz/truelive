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

// Parse trusted static SVG markup (our own ICONS / generated QR) into a DOM node,
// avoiding innerHTML (and the addons-linter UNSAFE_VAR_ASSIGNMENT warning). Parse
// as text/html (not image/svg+xml): the HTML parser puts <svg> in the SVG
// namespace even without an xmlns attribute, so our inline ICONS actually render;
// image/svg+xml would drop them into the null namespace and they'd stay invisible.
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

// --------------------------------------------------------------- Icons
const ICONS = {
    off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9z"/><path d="M5.5 15l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z"/></svg>',
    edge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 3 6.5 13h4l-1 8 6-10h-4z" fill="currentColor" stroke="none"/><path d="M19 5a12 12 0 0 1 0 8"/><path d="M21.8 3a16 16 0 0 1 0 12" opacity=".5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17l9-10"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5c5.8-5 14.2-5 20 0"/><path d="M5 12c3.8-3.3 10.2-3.3 14 0"/><path d="M8.5 15.5c2-1.7 5-1.7 7 0"/><circle cx="12" cy="19" r="0.6" fill="currentColor"/></svg>',
    gain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>',
};

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
    $('#modes-note').textContent = L.modesNote;
    $('#advanced-label').textContent = L.sectionIndicators;
    $('#reset-label').textContent = L.reset;
    $('#reset').title = L.resetHint;
    $('#go-live-label').textContent = L.goLiveBtn;
}

function renderModes() {
    const container = $('#mode-cards');
    for (const name of common.modeOrder) {
        const meta = common.modeMeta[name];
        const card = el('button', {
            class: 'mode-card', type: 'button', role: 'radio', 'aria-checked': 'false',
            onclick: () => applyPreset(name),
        },
            el('span', { class: 'mode-icon', html: ICONS[name] }),
            el('span', { class: 'mode-body' },
                el('span', { class: 'mode-name', text: meta.title }),
                el('span', { class: 'mode-desc', text: meta.desc }),
                el('span', { class: 'mode-conn' }, el('span', { class: 'conn-icon', html: ICONS.wifi }), el('span', { text: meta.conn })),
                el('span', { class: 'mode-gain' + (name === 'off' ? ' is-none' : '') }, el('span', { class: 'gain-icon', html: ICONS.gain }), el('span', { text: meta.gain })),
            ),
            el('span', { class: 'mode-check', html: ICONS.check }),
        );
        modeCards[name] = card;
        container.append(card);
    }
    const modeItems = common.modeOrder.map(n => modeCards[n]);
    rovingModes = wireRadiogroup(container, modeItems, idx => applyPreset(common.modeOrder[idx]));
}

function buildRow({ label, control }) {
    const main = el('div', { class: 'row-main' }, el('div', { class: 'row-label', text: label }));
    return el('div', { class: 'row' }, main, el('div', { class: 'row-control' }, control));
}

function buildToggle(key) {
    const input = el('input', { type: 'checkbox', onchange: () => setOne(key, input.checked) });
    const sw = el('label', { class: 'switch' }, input, el('span', { class: 'track' }), el('span', { class: 'thumb' }));
    updaters.push(() => { input.checked = !!state[key]; });
    return sw;
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
    for (const value of pix.PIX_AMOUNTS) {
        const chip = el('button', { class: 'support-chip', type: 'button', role: 'radio', 'aria-checked': String(value === amount) }, `R$ ${value}`);
        chip.addEventListener('click', () => {
            amount = value;
            for (const c of chips) c.setAttribute('aria-checked', String(c === chip));
            renderQr();
        });
        chips.push(chip);
        chipsBox.append(chip);
    }
    wireRadiogroup(chipsBox, chips, i => chips[i].click());

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
    for (const u of updaters) u();
}

function renderGoLive() {
    const btn = $('#go-live-action');
    btn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]?.id != null) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'go-live' });
            }
        });
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 500);
    });
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
    renderGoLive();
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
