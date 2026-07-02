// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md

(() => {
    // Catch-up control logic lives in engine/controller.js (a classic script
    // injected just before this one) — unit-tested in test/controller.test.mjs.
    // If it somehow didn't load, we stay safely at 1.0x (no acceleration).
    // A fresh controller is created per attach (see detect_and_attach) so one
    // stream's EMAs/hysteresis never steer the first seconds of the next one.
    const controllerFactory = (typeof window !== 'undefined' && window.TrueLive && typeof window.TrueLive.createController === 'function')
        ? window.TrueLive.createController
        : null;
    let controller = controllerFactory ? controllerFactory() : null;
    // Buffer level below which the health indicator turns red — shared with the
    // controller's own back-off threshold (falls back if the controller is absent).
    const BUFFER_WARN = controller ? controller.WARN_BUFFER : 2.5;

    // Build "<span translate="no">TEXT</span>" via DOM (no innerHTML): avoids the
    // Trusted-Types dependency on YouTube and the addons-linter UNSAFE_VAR_ASSIGNMENT
    // warning. translate="no" keeps Google Translate from mangling the numbers.
    function setChip(el, text) {
        el.textContent = '';
        const span = document.createElement('span');
        span.setAttribute('translate', 'no');
        span.textContent = text;
        el.appendChild(span);
    }

    function update_playbackRate(playbackRate) {
        const video = video_instance();
        if (video) {
            setChip(button_playbackrate, video.playbackRate.toFixed(2) + 'x');

            if (video.playbackRate === playbackRate) {
                button_playbackrate.style.color = '#ff8983';
            } else {
                button_playbackrate.style.color = '#eee';
            }

            button_playbackrate.style.display = 'inline-block';
        } else {
            button_playbackrate.style.display = 'none';
        }
    }

    function hide_playbackRate() {
        button_playbackrate.style.display = 'none';
    }

    function update_latency(latency, isAtLiveHead) {
        if (isAtLiveHead) {
            setChip(button_latency, isFinite(latency) ? 'Delay ' + latency.toFixed(1) + 's' : 'Delay —');
        } else {
            setChip(button_latency, '(DVR)');
        }

        button_latency.style.display = 'inline-block';
    }

    function hide_latency() {
        button_latency.style.display = 'none';
    }

    function update_health(health) {
        setChip(button_health, isFinite(health) ? 'Buffer ' + health.toFixed(1) + 's' : 'Buffer —');

        // Warn (red) when the buffer is running low.
        if (health < BUFFER_WARN) {
            button_health.style.color = '#ff8983';
        } else {
            button_health.style.color = '#eee';
        }

        button_health.style.display = 'inline-block';
    }

    function hide_health() {
        button_health.style.display = 'none';
    }

    function update_estimation(seekableEnd, current, isAtLiveHead) {
        const video = video_instance();
        if (!video) {
            hide_estimation();
            return;
        }
        addWithLimit(seekableEnds, seekableEnd);
        const streamHasProbablyEnded = allElementsEqual(seekableEnds);
        const estimated_seconds = (seekableEnd - current) / (streamHasProbablyEnded ? video.playbackRate : video.playbackRate - 1.0);
        if (!isAtLiveHead && isFinite(estimated_seconds)) {
            const estimated_time = new Date(Date.now() + estimated_seconds * 1000.0).toLocaleTimeString();
            setChip(button_estimation, '(' + estimated_time + ')');
            button_estimation.style.display = 'inline-block';
        } else {
            button_estimation.style.display = 'none';
        }
    }

    function hide_estimation() {
        button_estimation.style.display = 'none';
    }

    function update_current(current, seekableEnd, isAtLiveHead, videoId) {
        const current_time = isFinite(current) ? format_time(current) : '--:--';

        if (isAtLiveHead) {
            setChip(button_current, current_time);
        } else {
            const seekableEnd_time = isFinite(seekableEnd) ? format_time(seekableEnd) : '--:--';
            setChip(button_current, current_time + ' / ' + seekableEnd_time);
        }

        if (videoId) {
            const current_time_url = addParamsToUrl('https://www.youtube.com/watch', { v: videoId, t: format_time_hms(current) });
            button_current.setAttribute('current', `${current_time_url}#\n${current_time}`);
        } else {
            button_current.removeAttribute('current'); // no video id — nothing valid to copy
        }

        button_current.style.display = 'inline-block';
    }

    function hide_current() {
        button_current.style.display = 'none';
    }

    // --- Playback-rate controller -------------------------------------------
    // IMPORTANT: modern YouTube live (SABR / "manifestless") REVERTS direct
    // `video.playbackRate` changes within ~250ms, so the only reliable way to
    // speed up is the player API `setPlaybackRate()`. We remember the rate we
    // applied; if the player's rate diverges we assume the viewer changed it and
    // yield to them, re-engaging once they go back to 1.0x.
    let applied_rate = 1.0;
    let yielded_to_user = false;

    function apply_playback_rate(desired) {
        if (!player?.setPlaybackRate || !player?.getPlaybackRate) return;
        const cur = player.getPlaybackRate();
        if (Math.abs(cur - applied_rate) > 0.01) {
            if (Math.abs(cur - 1.0) < 0.01) {
                applied_rate = 1.0;      // reset to 1.0 (YouTube reset or viewer) -> re-engage
                yielded_to_user = false;
            } else {
                yielded_to_user = true;  // viewer picked a specific speed -> yield
                applied_rate = cur;
            }
        }
        if (yielded_to_user) return;
        if (Math.abs(desired - applied_rate) > 0.01) {
            player.setPlaybackRate(desired);
            // READ BACK what the player actually applied: YouTube quantizes
            // custom rates (0.92 -> 0.90). Recording `desired` here made the
            // divergence detector mistake that quantization for a manual user
            // change and yield forever — leaving playback stuck slow while the
            // delay grew unbounded (field bug, 2026-07-02).
            const actual = player.getPlaybackRate();
            applied_rate = isFinite(actual) ? actual : desired;
        }
    }

    function set_playbackRate(speed, latency, health, bufferTarget, auto) {
        if (!controller) return;
        apply_playback_rate(controller.calcPlaybackRate(speed, latency, health, bufferTarget, auto));
    }

    function reset_playbackRate() {
        if (applied_rate !== 1.0 && !yielded_to_user) {
            apply_playback_rate(1.0);
        }
    }

    // Catch-up control logic + its tunables/state now live in
    // engine/controller.js (unit-tested via test/controller.test.mjs).

    // (`skipThreathold` keeps the storage key's historical typo — see common.js.)
    function skip_if_over_threshold(latency, skipThreathold) {
        if (!caps?.seekLive || !caps?.stateObject) return;
        if (player && latency >= skipThreathold) {
            if (player.getPlayerStateObject()?.isPlaying) {
                player.seekToLiveHead();
                if (caps.playVideo) player.playVideo();
            }
        }
    }

    /** Jump to the live edge on demand (keyboard shortcut / popup chip). No latency threshold — the viewer asked for it. */
    function seek_to_live() {
        if (!player || !caps?.seekLive) return;
        player.seekToLiveHead();
        if (caps.playVideo) player.playVideo();
    }

    // --- Edge-riding ("Super Ao Vivo") ---------------------------------------
    // v2 (2026-07-02): the brain lives in engine/edge.js (unit-tested, loaded
    // before this file). Delay now shrinks ONLY via playback rate — gradual,
    // hls.js-style sigmoid, never below 1.0x (Owner rule) — and a seek
    // survives solely as the emergency rescue. The reserve floor is measured
    // from segment ARRIVAL (NetEQ spirit), so our own seeks and the catch-up
    // drain can't pollute it, and it expires by time (BBR win_minmax) instead
    // of haunting a calmer rendition. Technique study: docs/RESEARCH.md.
    const edgeGovernorFactory = (typeof window !== 'undefined' && window.TrueLive && typeof window.TrueLive.createEdgeGovernor === 'function')
        ? window.TrueLive.createEdgeGovernor
        : null;
    let edge_governor = edgeGovernorFactory ? edgeGovernorFactory() : null;
    let edge_self_seek_until = 0;  // our rescue seek fires 'waiting' — not a real stall
    let edge_quality_h = 0;        // last seen videoHeight (rendition watch)

    // Rendition switched: old measurements describe the old rendition, and the
    // buffer wipe of the switch must not read as danger. Re-learn from zero.
    // Runs even while suspended, so a quality DROP re-arms the motor at once
    // (a lower rendition usually sustains a much lower delay).
    function edge_watch_quality(v, now) {
        if (!v || !v.videoHeight || !edge_governor) return;
        if (edge_quality_h !== 0 && v.videoHeight !== edge_quality_h) {
            // rearm (clear a suspension) only on a DROP — a lighter rendition
            // earns a fresh chance; a RISE on a suspended connection doesn't
            edge_governor.qualityChange(now, v.videoHeight < edge_quality_h);
            edge_self_seek_until = now + 4000; // refill 'waiting' isn't a stall
        }
        edge_quality_h = v.videoHeight;
    }

    // Emergency rescue: ONE instant step-back (~1-2s of replayed content)
    // restores the reserve while the rate never leaves >=1.0x (Owner rule).
    function edge_execute_rescue(v, rescueTo, now) {
        if (!v || v.paused || !v.buffered.length || !edge_governor) return;
        const range = v.buffered.length - 1;
        const end = v.buffered.end(range);
        // never step back past what's actually buffered behind the playhead
        const back = Math.max(v.buffered.start(range) + 0.1, end - rescueTo);
        if (back >= v.currentTime) {
            // Danger with no material to step back to (e.g. right after
            // attach, before back-buffer accumulates). Still trouble: block
            // tightening — but a normal stream start can't trip a handover.
            edge_governor.noteTrouble(now);
            return;
        }
        edge_self_seek_until = now + 1500; // the seek fires 'waiting'; not a real stall
        v.currentTime = back;
        edge_governor.noteRescue(now, end - v.currentTime);
    }

    function video_instance() {
        if (!video?.parentNode && player) {
            video = player.querySelector('video.html5-main-video');
        }
        return video;
    }

    function format_time(seconds) {
        const hs = Math.floor(seconds / 3600.0);
        const ms = Math.floor((seconds % 3600) / 60.0);
        const ss = Math.floor(seconds % 60);

        const h = hs > 0 ? `${String(hs)}:` : '';
        const m = String(ms).padStart(hs > 0 ? 2 : 1, '0');
        const s = String(ss).padStart(2, '0');

        return `${h}${m}:${s}`;
    }

    function format_time_hms(seconds) {
        const hs = Math.floor(seconds / 3600.0);
        const ms = Math.floor((seconds % 3600) / 60.0);
        const ss = Math.floor(seconds % 60);

        const h = hs > 0 ? `${String(hs)}h` : '';
        const m = String(ms).padStart(hs > 0 ? 2 : 1, '0');
        const s = String(ss).padStart(2, '0');

        return `${h}${m}m${s}s`;
    }

    function addWithLimit(arr, newElement, limit = 5) {
        arr.push(newElement);
        if (arr.length > limit) {
            arr.splice(0, arr.length - limit);
        }
        return arr;
    }

    function allElementsEqual(arr, limit = 5) {
        if (arr.length < limit) return false;
        return arr.every(el => el === arr[0]);
    }

    function addParamsToUrl(url, params) {
        const urlObj = new URL(url);
        for (const [key, value] of Object.entries(params)) {
            urlObj.searchParams.set(key, value);
        }
        return urlObj.toString();
    }

    function create_elem(elem_name, elem_classes) {
        const elem = document.createElement(elem_name);
        elem.classList.add(...elem_classes);
        elem.style.display = 'none';
        elem.style.cursor = 'default';
        elem.style.textAlign = 'center';
        elem.style.width = 'auto';
        elem.style.height = 'auto';
        elem.style.color = '#eee';
        elem.style.fontWeight = 'normal';
        elem.style.paddingLeft = '8px';
        elem.style.paddingRight = '8px';
        return elem;
    }

    const button_playbackrate = create_elem('button', ['_live_catch_up_playbackrate', 'ytp-button']);

    const button_latency = create_elem('button', ['_live_catch_up_latency', 'ytp-button']);

    const button_health = create_elem('button', ['_live_catch_up_health', 'ytp-button']);

    const button_estimation = create_elem('button', ['_live_catch_up_estimation', 'ytp-button']);

    const msg_current = create_elem('button', ['_live_catch_up_msg_current', 'ytp-button']);
    msg_current.setAttribute('role', 'status');
    msg_current.setAttribute('aria-live', 'polite');
    setChip(msg_current, 'Copied!');
    msg_current.style.position = 'fixed';

    const button_current = create_elem('button', ['_live_catch_up_current', 'ytp-button']);
    button_current.addEventListener('click', () => {
        const link = button_current.getAttribute('current');
        if (!link) return;
        navigator.clipboard.writeText(link);

        msg_current.style.translate = '-32px -16px';
        msg_current.style.display = 'inline-block';

        clearTimeout(msg_current_timeout);
        msg_current_timeout = setTimeout(() => {
            msg_current.style.display = 'none';
        }, 4000);
    });

    // Pinned delay panel — top-left, styled like a native player pill (dark,
    // blurred, small) so it reads as part of YouTube. It must inform without
    // intruding: when the player chrome is visible (mouse active) it ghosts to
    // low opacity; while you just watch, it sits at comfortable contrast.
    const pinned_panel = document.createElement('div');
    pinned_panel.className = '_live_catch_up_pinned';
    pinned_panel.setAttribute('translate', 'no');

    const pinned_style = document.createElement('style');
    pinned_style.textContent =
        // Mini badge, stats-for-nerds aesthetic: near-square corners, dark
        // translucent block, mono numbers. Rest = just the live delay; hover
        // expands the full detail. pointer-events stays on (hover needs it) but
        // the hit area is tiny, so it never gets in the way of the video.
        '._live_catch_up_pinned{position:absolute;top:12px;left:12px;z-index:60;display:none;'
        + 'align-items:center;gap:5px;padding:4px 10px;border-radius:12px;'
        + 'background:rgba(0,0,0,.5);color:#fff;'
        + 'font:500 12px/1.35 "Roboto","Arial",sans-serif;'
        + 'pointer-events:auto;cursor:default;opacity:1;transition:opacity .25s ease,background .3s ease}'
        + '._live_catch_up_pinned .tl-num{color:#fff}'
        + '._live_catch_up_pinned .tl-dim{color:#fff;font-weight:400}'
        // repouso mostra só o atraso; hover (ou alerta) expande o detalhe
        + '._live_catch_up_pinned .tl-full{display:none}'
        + '._live_catch_up_pinned:hover .tl-full,._live_catch_up_pinned.tl-warn .tl-full{display:inline}'
        + '._live_catch_up_pinned:hover .tl-short,._live_catch_up_pinned.tl-warn .tl-short{display:none}'
        // controles do player visíveis -> esmaece (não briga com a UI)
        + '#movie_player:not(.ytp-autohide) ._live_catch_up_pinned{opacity:.35}'
        + '._live_catch_up_pinned:hover{opacity:1 !important}'
        // reserva fina: âmbar + detalhe sempre visível (alerta não depende de hover)
        + '._live_catch_up_pinned.tl-warn{background:rgba(150,100,0,.75);opacity:.95}'
        + '._live_catch_up_pinned.tl-warn .tl-num{color:#ffd77a}'
        + '@keyframes _tl_pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}'
        + '._tl_bolt{color:#4a90ff;display:inline-flex;animation:_tl_pulse 1.6s ease-in-out infinite;'
        + 'filter:drop-shadow(0 0 3px rgba(41,121,255,.7))}'
        + '@media (prefers-reduced-motion: reduce){._tl_bolt{animation:none !important}}';

    // Bolt icon as inline SVG — no emoji anywhere in the product (Owner rule),
    // and SVG renders identically across platforms while emoji glyphs don't.
    const pinned_bolt = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pinned_bolt.setAttribute('class', '_tl_bolt');
    pinned_bolt.setAttribute('viewBox', '0 0 24 24');
    pinned_bolt.setAttribute('width', '10');
    pinned_bolt.setAttribute('height', '10');
    pinned_bolt.setAttribute('aria-hidden', 'true');
    const bolt_path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    bolt_path.setAttribute('points', '13 2 3 14 11 14 10 22 21 9 13 9');
    bolt_path.setAttribute('fill', 'currentColor');
    pinned_bolt.append(bolt_path);
    const pinned_short = document.createElement('span');
    pinned_short.className = 'tl-short tl-num';
    const pinned_full = document.createElement('span');
    pinned_full.className = 'tl-full';

    let pinned_suspended = false;
    function update_pinned(latency, health) {
        if (!pinned_panel.contains(pinned_bolt)) {
            pinned_panel.append(pinned_bolt, pinned_short, pinned_full);
        }
        if (!pinned_style.isConnected) document.head.appendChild(pinned_style);
        const lat = isFinite(latency) ? latency.toFixed(1).replace('.', ',') + 's' : '—';
        const res = isFinite(health) ? health.toFixed(1).replace('.', ',') + 's' : '—';
        pinned_short.textContent = lat;
        pinned_full.textContent = '';
        const dim1 = document.createElement('span'); dim1.className = 'tl-dim'; dim1.textContent = 'Delay ';
        const n1 = document.createElement('span'); n1.className = 'tl-num'; n1.textContent = lat;
        const dim2 = document.createElement('span'); dim2.className = 'tl-dim'; dim2.textContent = ' · Buffer ';
        const n2 = document.createElement('span'); n2.className = 'tl-num'; n2.textContent = res;
        pinned_full.append(dim1, n1, dim2, n2);
        if (pinned_suspended) {
            const tag = document.createElement('span'); tag.className = 'tl-dim'; tag.textContent = ' · Estável';
            pinned_full.append(tag);
        }
        pinned_panel.classList.toggle('tl-warn', isFinite(health) && health < BUFFER_WARN);
        pinned_panel.style.display = 'flex';
    }

    function hide_pinned() {
        pinned_panel.style.display = 'none';
    }

    let player;
    let video;
    let interval;
    let interval_count = 0;
    let seekableEnds = [];
    let msg_current_timeout;
    let current_settings;
    let last_active_ping = 0;

    // --- Resilience state (R1/R2/R3) ----------------------------------------
    // The engine drives entirely off UNDOCUMENTED player methods. `caps` records
    // which ones actually exist (probed once per attach); the hot loop is guarded
    // so a YouTube-side refactor degrades gracefully instead of throwing 4x/sec.
    let caps = null;              // probed player capabilities (or null)
    let engine_degraded = false;  // gave up until the next navigation
    let tick_errors = 0;          // consecutive errors in the hot loop
    let bound_video = null;       // video element we've attached listeners to
    let detect_interval = null;   // player-detection poll (managed by start_detection)
    const MAX_TICK_ERRORS = 8;    // ~2s of failures in a row before giving up

    // --- Stall watchdog ------------------------------------------------------
    // If the live keeps buffering while the extension is enabled, the chosen
    // mode is probably too aggressive for this connection. We notify the content
    // script, which offers a one-tap switch to a calmer, more-buffered mode.
    let last_stall = 0;
    let stall_cooldown_until = 0;
    function on_video_waiting() {
        if (!current_settings?.enabled) return;
        const now = Date.now();
        if (now < edge_self_seek_until) return; // our own rescue seek, not a real stall
        if (now < stall_cooldown_until || now - last_stall < 5000) return;
        last_stall = now;
        // A REAL stall (frozen screen) is what counts toward the graceful
        // handover — an invisible rescue step-back no longer does (v2).
        if (current_settings?.edge && edge_governor) edge_governor.noteStall(now);
    }

    // --- Resilience helpers (R1/R3) -----------------------------------------
    // Probe the private player API surface once, so a missing method is a known
    // "skip that feature" instead of a per-tick exception.
    function probe_caps(p) {
        const has = name => typeof p?.[name] === 'function';
        return {
            stats: has('getStatsForNerds'),
            progress: has('getProgressState'),
            videoData: has('getVideoData'),
            setRate: has('setPlaybackRate'),
            getRate: has('getPlaybackRate'),
            seekLive: has('seekToLiveHead'),
            playVideo: has('playVideo'),
            stateObject: has('getPlayerStateObject'),
        };
    }

    function hideAllIndicators() {
        hide_pinned();
        hide_playbackRate();
        hide_latency();
        hide_health();
        hide_estimation();
        hide_current();
    }

    let a11y_labeled = false;
    /**
     * Set screen-reader labels on the player indicators (once; they're static).
     * @param {{playbackRate: string, latency: string, health: string, estimation: string, current: string}} labels - Localized strings from the settings detail (the engine has no chrome.i18n).
     */
    function apply_a11y_labels(labels) {
        if (a11y_labeled || !labels) return;
        const pairs = [
            [button_playbackrate, labels.playbackRate],
            [button_latency, labels.latency],
            [button_health, labels.health],
            [button_estimation, labels.estimation],
            [button_current, labels.current],
        ];
        for (const [el, text] of pairs) if (text) el.setAttribute('aria-label', text);
        a11y_labeled = true;
    }

    // Give up until the next navigation, once, without spamming the console. A
    // fresh (re)attach — initial load or SPA nav — clears this and retries.
    function degrade(reason) {
        if (engine_degraded) return;
        engine_degraded = true;
        clearInterval(interval);
        hideAllIndicators();
        console.warn(`[TrueLive] Paused: the YouTube player API looks different (${reason}). It will retry on the next video/navigation.`);
    }

    // One iteration of the hot loop, always called inside guarded_tick's
    // try/catch. Every private-API call is gated by `caps`; when the stats say
    // this isn't a catch-up-able live, indicators are hidden (never left stale).
    function run_tick(settings) {
        if (!caps || !caps.stats) { degrade('getStatsForNerds missing'); return; }

        const stats_for_nerds = player.getStatsForNerds();
        if (!stats_for_nerds || stats_for_nerds.live_latency_style !== '') {
            hideAllIndicators();
            return;
        }

        const latency = Number.parseFloat(stats_for_nerds.live_latency_secs);
        const health = Number.parseFloat(stats_for_nerds.buffer_health_seconds);
        const progress_state = caps.progress ? player.getProgressState() : null;

        // Throttled "watching a live" ping — drives usage tracking in the
        // content script (so only real live time counts).
        const active_now = Date.now();
        if (active_now - last_active_ping > 2000) {
            last_active_ping = active_now;
            document.dispatchEvent(new CustomEvent('_live_catch_up_active'));
        }

        let edge_suspended = false;
        if (caps.setRate && caps.getRate) {
            if (!settings.enabled) {
                reset_playbackRate();
            } else if (settings.edge && edge_governor) {
                // ONE buffer metric governs edge mode: the video.buffered
                // reserve — the same one the governor measures arrivals on.
                const ev = video_instance();
                const now = Date.now();
                edge_watch_quality(ev, now);
                if (ev && !ev.paused && ev.buffered.length
                    && progress_state && progress_state.isAtLiveHead === false) {
                    // Viewer rewound on purpose: don't fight, and don't feed
                    // DVR "reserve" into the governor's measurement — it does
                    // not describe the live-edge headroom (review finding).
                    // The tick-gap guard re-anchors when we come back.
                    apply_playback_rate(1.0);
                } else if (ev && !ev.paused && ev.buffered.length) {
                    const b_end = ev.buffered.end(ev.buffered.length - 1);
                    const g = edge_governor.tick(now, b_end, b_end - ev.currentTime, settings.playbackRate);
                    edge_suspended = g.suspended;
                    if (g.suspended) {
                        // weak-connection handover: behave as Automático
                        set_playbackRate(settings.playbackRate, latency, health, settings.bufferTarget, true);
                    } else {
                        // Rate stays >= 1.0x always (Owner rule); a danger dip
                        // is handled by an instant step-back, not a slow-down.
                        if (g.rescue) edge_execute_rescue(ev, g.rescueTo, now);
                        apply_playback_rate(g.rate);
                    }
                    // observability (page-world): diagnostics read the live state
                    window.__truelive_debug = {
                        v: 2, rate: g.rate, target: +g.target.toFixed(2),
                        floor: +g.floor.toFixed(2), reserve: +(b_end - ev.currentTime).toFixed(2),
                        suspended: g.suspended, ...edge_governor.getState(),
                    };
                }
            } else if (settings.edge) {
                // governor unavailable (engine/edge.js failed to load) — the
                // stable, buffered profile is the safe fallback
                set_playbackRate(settings.playbackRate, latency, health, settings.bufferTarget, true);
            } else {
                set_playbackRate(settings.playbackRate, latency, health, settings.bufferTarget, settings.auto);
            }
        }

        if (settings.skip) {
            skip_if_over_threshold(latency, settings.skipThreathold);
        }

        const want_update = interval_count++ % 4 === 0;
        settings.showPlaybackRate ? update_playbackRate(settings.playbackRate) : hide_playbackRate();
        if (progress_state) {
            // Real end-to-end delay (ingest -> this screen) via the player's
            // ingestion wall-clock, when exposed — more truthful than the stats
            // estimate. Falls back to the stats latency on players without it.
            const real_latency = Number.isFinite(progress_state.ingestionTime)
                ? (Date.now() / 1000.0 - progress_state.ingestionTime)
                : latency;
            settings.showLatency ? (want_update && update_latency(real_latency, progress_state.isAtLiveHead)) : hide_latency();
            pinned_suspended = edge_suspended;
            settings.showPinned ? (want_update && update_pinned(real_latency, health)) : hide_pinned();
            settings.showHealth ? (want_update && update_health(health)) : hide_health();
            settings.showEstimation ? (want_update && update_estimation(progress_state.seekableEnd, progress_state.current, progress_state.isAtLiveHead)) : hide_estimation();
            settings.showCurrent ? update_current(progress_state.current, progress_state.seekableEnd, progress_state.isAtLiveHead, caps.videoData ? player.getVideoData()?.video_id : undefined) : hide_current();
        } else {
            hide_latency();
            hide_health();
            hide_estimation();
            hide_current();
            hide_pinned();
        }
    }

    // Guards the 4x/second loop: a single YouTube-side change can't spin
    // exceptions forever — after MAX_TICK_ERRORS in a row we stop and wait for
    // the next navigation to retry (see degrade / detect_and_attach).
    function guarded_tick() {
        if (!player || engine_degraded) return;
        const settings = current_settings;
        if (!settings) return;
        try {
            run_tick(settings);
            tick_errors = 0;
        } catch (e) {
            if (++tick_errors >= MAX_TICK_ERRORS) degrade(e?.message || 'exception');
        }
    }

    document.addEventListener('_live_catch_up_load_settings', e => {
        const settings = e.detail;
        if (!settings) return; // Firefox X-ray edge: detail failed to cross worlds
        current_settings = settings;
        if (settings.copiedLabel) {
            setChip(msg_current, settings.copiedLabel);
        }
        apply_a11y_labels(settings.a11yLabels);
        clearInterval(interval);
        if (engine_degraded) return; // paused until the next navigation retries
        if (settings.enabled || settings.skip || settings.showPlaybackRate || settings.showLatency || settings.showHealth || settings.showEstimation || settings.showCurrent || settings.showPinned) {
            interval = setInterval(guarded_tick, 250);
        } else {
            reset_playbackRate();
            hideAllIndicators();
        }
    });

    document.addEventListener('_live_catch_up_go_live', seek_to_live);

    // --- Player detection + (re)attach (R2) ---------------------------------
    // Runs on first load AND on every SPA navigation (YouTube reuses the tab and
    // may rebuild the player bar). Idempotent: video listeners bind once per
    // element, buttons are only re-inserted when they've been detached.
    function buttons_attached(area) {
        return button_playbackrate.isConnected && area.contains(button_playbackrate);
    }

    function detect_and_attach() {
        player = document.getElementById("movie_player");
        if (!player) return false;

        const v = video_instance();
        if (!v) return false;

        const time_display = document.getElementsByTagName('player-time-display')[0];
        let area;
        let button_live_badge;
        if (time_display) { // new-style YouTube embedded player
            area = time_display.querySelector('div.ytwPlayerTimeDisplayLiveDot');
            if (!area) return false;

            button_live_badge = time_display.querySelector('div.ytwPlayerTimeDisplayLiveDot > div');
            if (!button_live_badge) return false;
        } else {
            area = player.querySelector('div.ytp-time-display:has(button.ytp-live-badge) div.ytp-time-wrapper');
            if (!area) return false;

            button_live_badge = player.querySelector('button.ytp-live-badge');
            if (!button_live_badge) return false;
        }

        // Probe the private API surface once per attach and clear any prior
        // degraded state so a new stream/page gets a fresh chance.
        caps = probe_caps(player);
        engine_degraded = false;
        tick_errors = 0;

        // Fresh stream, fresh controller state: EMAs/hysteresis measured on the
        // previous live must not steer the first seconds of this one.
        // (applied_rate is kept — apply_playback_rate's divergence logic already
        // handles whatever rate the new player starts at.)
        if (controllerFactory) controller = controllerFactory();
        seekableEnds = [];
        // fresh stream: edge-riding state must not carry over
        if (edgeGovernorFactory) edge_governor = edgeGovernorFactory();
        edge_self_seek_until = 0;
        edge_quality_h = 0;

        if (bound_video !== v) {
            // Detach the previous <video>'s listener before binding the new one,
            // so the old element can be garbage-collected after a live→live
            // navigation instead of being pinned by the closure (PR #17). The
            // `ratechange` listener was dropped entirely — nothing consumes it.
            if (bound_video) bound_video.removeEventListener('waiting', on_video_waiting);
            v.addEventListener('waiting', on_video_waiting);
            bound_video = v;
        }

        if (!pinned_panel.isConnected || !player.contains(pinned_panel)) {
            player.appendChild(pinned_panel);
        }

        if (!buttons_attached(area)) {
            let prev = undefined;
            for (const elem of [button_live_badge, button_playbackrate, button_latency, button_health, button_current, msg_current, button_estimation].reverse()) {
                area.insertBefore(elem, prev);
                prev = elem;
            }
        }

        document.dispatchEvent(new CustomEvent('_live_catch_up_init'));
        return true;
    }

    const FAST_DETECT_MS = 500;
    const SLOW_DETECT_MS = 5000;
    const FAST_DETECT_ATTEMPTS = 40;   // ~20s of fast polling, then back off

    function stop_detection() {
        clearInterval(detect_interval);
        detect_interval = null;
    }

    // Poll fast right after (re)load/navigation, when the player bar is about
    // to appear. Most frames (VOD pages, playerless iframes) never get a live
    // player, so after FAST_DETECT_ATTEMPTS we drop to a slow probe instead of
    // polling at 500ms forever — still catching pages that only *become* a live
    // later (premieres / scheduled streams) without any navigation event.
    function start_detection(fast = true) {
        stop_detection();
        if (detect_and_attach()) return;   // ready right now
        let attempts = 0;
        detect_interval = setInterval(() => {
            if (detect_and_attach()) stop_detection();
            else if (fast && ++attempts >= FAST_DETECT_ATTEMPTS) start_detection(false);
        }, fast ? FAST_DETECT_MS : SLOW_DETECT_MS);
    }

    start_detection();

    // SPA navigation: re-attach (idempotent) so indicators/catch-up survive
    // moving between lives without a full page reload.
    document.addEventListener('yt-navigate-finish', () => start_detection(true));
})();