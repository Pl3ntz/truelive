// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md

import(chrome.runtime.getURL('common.js')).then(common => {
    if (!common.isLiveChat(location.href)) {
        main(common);
    }
});

let storageListenersAttached = false;

function main(common) {
    function loadSettings() {
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
        if (area === 'local' && common.storage.some(k => k in changes)) loadSettings();
    }

    /** Tell the engine (inject.js) to jump to the live edge now. */
    function dispatchGoLive() {
        document.dispatchEvent(new CustomEvent('_live_catch_up_go_live'));
    }

    // Legacy/global signal: still forwarded for compatibility, but the "go-live"
    // shortcut no longer writes it (see background.js) — every tab reacting to
    // this key is exactly the behavior that shortcut was moved away from (PR #16).
    function onGoLiveSignalChanged(changes, area) {
        if (area === 'local' && changes[common.goLiveSignalKey]) dispatchGoLive();
    }

    // Active-tab-only path: background.js sends this directly to the tab the
    // "go-live" shortcut was pressed on (PR #16).
    function onRuntimeMessage(msg) {
        if (msg?.type === 'go-live') dispatchGoLive();
    }

    // Guard against double-registration if the content script re-inits in the
    // same page — listeners would otherwise stack up (PR #17).
    if (!storageListenersAttached) {
        storageListenersAttached = true;
        chrome.storage.onChanged.addListener(onEngineSettingsChanged);
        chrome.storage.onChanged.addListener(onGoLiveSignalChanged);
        chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }

    document.addEventListener('_live_catch_up_init', () => {
        clearInterval(detect_interval);
        let my_interval;
        my_interval = detect_interval = setInterval(() => {
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
