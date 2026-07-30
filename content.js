// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md

import(chrome.runtime.getURL('common.js')).then(common => {
    if (!common.isLiveChat(location.href)) {
        main(common);
    }
});

let storageListenersAttached = false;

// After the extension reloads/updates, ORPHANED content scripts in already-open
// tabs still hold live listeners/timers; any chrome.* call from them throws
// "Extension context invalidated", spamming the console and leaking the poll
// timer. Gate every chrome.* entry point on this so an orphan quietly no-ops
// until the tab is refreshed. `chrome.runtime.id` goes undefined the moment the
// context dies; the try/catch covers the throw-on-access variant.
const contextValid = () => {
    try {
        return !!(chrome.runtime && chrome.runtime.id);
    } catch {
        return false;
    }
};

function main(common) {
    function loadSettings() {
        if (!contextValid()) return;
        chrome.storage.local.get(common.storage, data => {
            sendLoadSettingsEvent(common.resolveSettings(data));
        });
    }

    function sendLoadSettingsEvent(settings) {
        const detailObject = {
            ...settings,
            copiedLabel: common.label.supportCopied,
            // Localized aria-labels shipped to the engine (page world has no chrome.i18n).
            a11yLabels: {
                playbackRate: common.label.a11yPlaybackRate,
                latency: common.label.a11yLatency,
                health: common.label.a11yHealth,
                estimation: common.label.a11yEstimation,
                current: common.label.a11yCurrent,
            },
        };
        // Firefox: without cloneInto the page world sees `detail` as null (X-ray
        // vision). Feature-detect the function — UA sniffing breaks under
        // privacy.resistFingerprinting or a user-overridden UA.
        const detail = (typeof cloneInto === 'function') ? cloneInto(detailObject, document.defaultView) : detailObject;
        document.dispatchEvent(new CustomEvent('_live_catch_up_load_settings', { detail }));
    }

    let detect_interval;

    // Reload only when an engine setting actually changed — control keys write
    // storage frequently, and re-sending settings on each write is pure churn.
    function onEngineSettingsChanged(changes, area) {
        if (!contextValid()) return;
        if (area === 'local' && common.storage.some(k => k in changes)) loadSettings();
    }

    // Guard against double-registration if the content script re-inits in the
    // same page — listeners would otherwise stack up (PR #17).
    if (!storageListenersAttached) {
        storageListenersAttached = true;
        chrome.storage.onChanged.addListener(onEngineSettingsChanged);
    }

    // Orphan watchdog. Once this content script is orphaned, NOTHING driven by
    // chrome.* runs again (storage.onChanged never fires, the poll is cleared),
    // so we cannot notice it from our own side. The page keeps dispatching
    // `_live_catch_up_active` every ~2s though, and DOM events still reach us,
    // so we borrow that as the heartbeat: the first beat after the context dies
    // tells the engine to stand down instead of running stale settings forever.
    let orphanAnnounced = false;
    document.addEventListener('_live_catch_up_active', () => {
        if (contextValid() || orphanAnnounced) return;
        orphanAnnounced = true;
        clearInterval(detect_interval);
        document.dispatchEvent(new CustomEvent('_live_catch_up_orphaned'));
    });

    // Diagnostic log relay: the engine (page world) emits a JSON STRING; we
    // persist it under diagKey (kept OUT of common.storage, so this write never
    // triggers onEngineSettingsChanged). Nothing leaves the device — the popup
    // reads this key only when the user chooses to copy/download it.
    document.addEventListener('_live_catch_up_diag', e => {
        if (!contextValid()) return;
        if (typeof e.detail !== 'string') return; // X-ray: a primitive crosses worlds cleanly
        chrome.storage.local.set({ [common.diagKey]: e.detail });
    });

    document.addEventListener('_live_catch_up_init', () => {
        clearInterval(detect_interval);
        let my_interval;
        my_interval = detect_interval = setInterval(() => {
            if (!contextValid()) { clearInterval(my_interval); return; }
            const player = document.getElementById("movie_player");
            if (!player) {
                return;
            }

            clearInterval(my_interval);
            if (detect_interval === my_interval) detect_interval = null;

            loadSettings();
        }, 500);
    });

    // Inject the engine modules first, then the wiring. `async = false`
    // preserves execution order for dynamically-inserted scripts, so
    // window.TrueLive is fully populated by the time inject.js runs.
    const injectScript = file => {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(file);
        s.async = false;
        s.onload = () => s.remove();
        (document.head || document.documentElement).append(s);
        return s;
    };
    injectScript('engine/controller.js');
    injectScript('engine/edge.js');
    injectScript('inject.js').id = '_live_catch_up';
}
