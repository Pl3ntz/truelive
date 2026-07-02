// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md
//
// Minimal MV3 service worker: keyboard commands only (toggle mode / jump to live).

import * as common from './common.js';

/**
 * Handle a keyboard command. `toggle-enabled` writes storage, which every
 * open tab's content script reacts to.
 * @param {'toggle-enabled'} command - Command id from the manifest.
 */
function onCommand(command) {
    if (command === 'toggle-enabled') {
        chrome.storage.local.get([...common.storage, common.lastModeKey], data => {
            const { apply, remember } = common.toggleEnabledAction(data, data[common.lastModeKey]);
            const patch = { ...apply };
            if (remember) patch[common.lastModeKey] = remember;
            chrome.storage.local.set(patch);
        });
    }
}

if (chrome.commands?.onCommand) chrome.commands.onCommand.addListener(onCommand);
