// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md
//
// Minimal MV3 service worker: keyboard commands only (toggle mode / jump to live).

import * as common from './common.js';

/**
 * Send the "jump to live" message to the active tab only. Any failure (no
 * active tab, not a YouTube tab, no content script listening) is swallowed —
 * the shortcut simply does nothing rather than falling back to a global signal.
 */
function goLiveOnActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs?.[0];
        if (!tab?.id) return;
        chrome.tabs.sendMessage(tab.id, { type: 'go-live' }, () => {
            void chrome.runtime.lastError; // no listener on that tab — ignore
        });
    });
}

/**
 * Handle a keyboard command. `toggle-enabled` writes storage, which every
 * open tab's content script reacts to. `go-live` is scoped to the active tab
 * only, sent directly via chrome.tabs.sendMessage (see goLiveOnActiveTab).
 * @param {'toggle-enabled'|'go-live'} command - Command id from the manifest.
 */
function onCommand(command) {
    if (command === 'toggle-enabled') {
        chrome.storage.local.get([...common.storage, common.lastModeKey], data => {
            const { apply, remember } = common.toggleEnabledAction(data, data[common.lastModeKey]);
            const patch = { ...apply };
            if (remember) patch[common.lastModeKey] = remember;
            chrome.storage.local.set(patch);
        });
    } else if (command === 'go-live') {
        goLiveOnActiveTab();
    }
}

if (chrome.commands?.onCommand) chrome.commands.onCommand.addListener(onCommand);
