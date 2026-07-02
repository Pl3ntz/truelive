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
    // The player keeps several seconds of ALREADY-DOWNLOADED video ahead of the
    // playhead even "at live head". This mode nudges the playhead to that edge,
    // holding only EDGE_TARGET seconds of reserve. Validated live (2026-07-02,
    // EDGE-RIDING-FINDINGS.md): ~3.1-3.6s true latency sustained vs 7.3s default;
    // below ~1.5s of reserve a stall becomes a PERMANENT latency penalty, hence
    // the guards: never after a recent stall (let the reserve rebuild), never in
    // DVR (respect a viewer who rewound on purpose), rate-limited, and the nudge
    // itself must not trip the stall watchdog.
    // The reserve target ADAPTS to what this stream/connection can sustain.
    // Fixed 2.0s was validated on steady feeds (lofi/esports) but stalls on
    // high-motion sports (CazéTV): action moments spike the bitrate, segments
    // arrive in heavier bursts, and a thin reserve drains exactly when the
    // viewer can least afford a freeze. So: start safe, tighten only while the
    // stream proves calm, back off hard on any evidence of trouble.
    const EDGE_ABS_FLOOR = 2.0;        // conservative floor (Owner, 2026-07-02: the user must
                                       // never suffer): below ~1.5s a stall becomes a
                                       // PERMANENT latency penalty (measured live, 2026-07-02)
    const EDGE_CEIL = 4.5;             // never hold more than this (stable-mode territory)
    const EDGE_START = 2.75;           // first target after attach — safe until proven calm
    const EDGE_JITTER_MARGIN = 0.6;    // cushion above the measured segment-arrival jitter
    const EDGE_DEEP_CALM_MS = 180000;  // calm this long unlocks probing below 2.0s
    const EDGE_DANGER = 1.5;           // reserve below this = stall territory (measured ~1.2,
                                       // raised for margin — rescue fires earlier)
    const EDGE_RESCUE_TO = 2.5;        // a rescue step-back restores at least this much reserve
    const EDGE_RESCUE_COOLDOWN = 10000; // ms between rescues (target rises after each one)
    const EDGE_NUDGE_BAND = 0.75;      // nudge once reserve outgrows target by this
    const EDGE_NUDGE_COOLDOWN = 5000;  // ms between nudges
    const EDGE_STALL_HOLDOFF = 45000;  // ms to pause nudging after a real stall
    const EDGE_CALM_MS = 60000;        // calm this long before tightening again
    const EDGE_SUSPEND_STALLS = 2;     // this many real stalls within the window...
    const EDGE_SUSPEND_WINDOW = 300000; // ...suspends edge-riding (5 min)
    const EDGE_SUSPEND_MS = 600000;     // suspension length (10 min) — then re-arm safely
    let edge_target = EDGE_START;
    let edge_last_nudge = 0;
    let edge_self_seek_until = 0;
    let edge_last_reserve = null;
    let edge_last_trouble = 0;         // last stall OR burst-drain sighting
    // Reserve breathing envelope: tracks how much the reserve naturally
    // oscillates as segments arrive (decaying min/max). The DYNAMIC floor is
    // that jitter + a margin — the lowest reserve THIS stream on THIS internet
    // can hold without gambling. A calm fiber connection converges near the
    // absolute floor; a bursty one keeps a bigger cushion, automatically.
    let edge_env_max = null;
    let edge_env_min = null;
    let edge_last_rescue = 0;

    // Owner's rule (2026-07-02): playback NEVER drops below 1.0x on a live —
    // a sub-real-time rate makes no sense. So a danger dip is rescued by an
    // instant step-back instead of a slow-down: one small playhead jump
    // (~1-2s of replayed content) restores the reserve immediately while the
    // rate stays untouched. The target rises to the restored level so the
    // rider doesn't nudge right back into danger, and repeated rescues count
    // toward graceful suspension (this internet can't hold the edge now).
    function edge_rescue(v, reserve, now) {
        if (reserve >= EDGE_DANGER) return;
        if (now - edge_last_rescue < EDGE_RESCUE_COOLDOWN) return;
        if (!v || v.paused || !v.buffered.length) return;
        const range = v.buffered.length - 1;
        const end = v.buffered.end(range);
        const restore = Math.min(EDGE_CEIL, Math.max(edge_target, EDGE_RESCUE_TO));
        // never step back past what's actually buffered behind the playhead
        const back = Math.max(v.buffered.start(range) + 0.1, end - restore);
        if (back >= v.currentTime) {
            // Danger with no material to step back to (e.g. right after attach,
            // before back-buffer accumulates). Still trouble: keep the floor up
            // and block tightening — but leave suspension to the real-stall
            // watchdog, so a normal stream start can't trip a 10-min handover.
            edge_last_trouble = now;
            return;
        }
        edge_self_seek_until = now + 1500; // the seek fires 'waiting'; not a real stall
        v.currentTime = back;
        edge_last_rescue = now;
        edge_last_trouble = now;                                        // no tightening soon
        edge_target = Math.min(EDGE_CEIL, Math.max(edge_target, end - back)); // hold the new cushion
        edge_note_stall(now);              // repeated rescues -> hand over to Automático
    }

    function edge_dynamic_floor(now) {
        const jitter = (edge_env_max !== null && edge_env_min !== null)
            ? Math.max(0, edge_env_max - edge_env_min) : 1.0;
        let floor = Math.max(EDGE_ABS_FLOOR, jitter + EDGE_JITTER_MARGIN);
        // going below 2.5 is EARNED: only after deep calm (3+ min without trouble)
        if (now - edge_last_trouble < EDGE_DEEP_CALM_MS) floor = Math.max(floor, 2.5);
        return Math.min(floor, EDGE_CEIL);
    }
    let edge_stall_times = [];         // real stalls seen while edge mode is on
    let edge_suspended_until = 0;      // while in the future: behave as Automático

    // Weak-connection tier: if the stream stalls repeatedly even with the
    // adaptive reserve, edge-riding is the wrong tool for THIS internet right
    // now. Suspend it and hand control to the Automático controller (which
    // grows the buffer to whatever the connection sustains). Re-arm later,
    // starting safe. The viewer never has to touch anything.
    function edge_note_stall(now) {
        edge_stall_times = edge_stall_times.filter(t => now - t < EDGE_SUSPEND_WINDOW);
        edge_stall_times.push(now);
        if (edge_stall_times.length >= EDGE_SUSPEND_STALLS) {
            edge_suspended_until = now + EDGE_SUSPEND_MS;
            edge_stall_times = [];
            edge_target = EDGE_START; // when it re-arms, start from the safe target
        }
    }

    function edge_is_suspended(now) {
        return now < edge_suspended_until;
    }

    function ride_edge(progress_state) {
        const v = video_instance();
        if (!v || v.paused || !v.buffered.length) return;
        if (progress_state && progress_state.isAtLiveHead === false) return; // viewer is in DVR on purpose
        const now = Date.now();
        const edge = v.buffered.end(v.buffered.length - 1);
        const reserve = edge - v.currentTime;

        // --- adapt the target ---
        if (now - last_stall < 8000 && last_stall > edge_last_trouble) {
            // a real stall just happened: this stream needs more cushion
            edge_target = Math.min(EDGE_CEIL, edge_target + 1.5);
            edge_last_trouble = last_stall;
            edge_note_stall(now);
        } else if (edge_last_reserve !== null && edge_last_reserve - reserve > 1.2) {
            // burst drain (bitrate spike swallowed >1.2s in one tick-gap):
            // pre-emptive raise BEFORE it becomes a stall
            edge_target = Math.min(EDGE_CEIL, Math.max(edge_target, reserve + 1.5));
            edge_last_trouble = now;
        }
        // breathing envelope (decays ~0.008s/s so old spikes stop counting)
        edge_env_max = edge_env_max === null ? reserve : Math.max(reserve, edge_env_max - 0.002);
        edge_env_min = edge_env_min === null ? reserve : Math.min(reserve, edge_env_min + 0.002);
        const floor = edge_dynamic_floor(now);
        if (now - edge_last_trouble > EDGE_CALM_MS && edge_target > floor) {
            // stream is calm: creep down toward the measured floor (~0.05s/s)
            edge_target = Math.max(floor, edge_target - 0.0125);
        } else if (edge_target < floor) {
            edge_target = floor; // floor rose (jitter grew) — respect it immediately
        }
        edge_last_reserve = reserve;
        // observability (page-world): lets diagnostics read the adaptive state
        window.__truelive_debug = { target: +edge_target.toFixed(2), reserve: +reserve.toFixed(2),
                                    lastTrouble: edge_last_trouble, lastStall: last_stall,
                                    suspendedUntil: edge_suspended_until, stallCount: edge_stall_times.length, lastRescue: edge_last_rescue,
                                    floor: +edge_dynamic_floor(now).toFixed(2),
                                    jitter: (edge_env_max !== null && edge_env_min !== null) ? +(edge_env_max - edge_env_min).toFixed(2) : null };

        // --- nudge (with all guards) ---
        if (now - last_stall < EDGE_STALL_HOLDOFF) return;      // let the reserve rebuild
        if (now - edge_last_nudge < EDGE_NUDGE_COOLDOWN) return;
        if (reserve <= edge_target + EDGE_NUDGE_BAND) return;   // already riding the edge
        edge_self_seek_until = now + 1500;                      // the seek fires 'waiting'; don't count it as a stall
        v.currentTime = edge - edge_target;
        edge_last_nudge = now;
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
        + '._tl_bolt{color:#4a90ff;display:inline-block;animation:_tl_pulse 1.6s ease-in-out infinite;'
        + 'filter:drop-shadow(0 0 3px rgba(41,121,255,.7));font-size:10px}'
        + '@media (prefers-reduced-motion: reduce){._tl_bolt{animation:none !important}}';

    const pinned_bolt = document.createElement('span');
    pinned_bolt.className = '_tl_bolt';
    pinned_bolt.textContent = '⚡';
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
        if (now < edge_self_seek_until) return; // our own edge nudge, not a real stall
        if (now < stall_cooldown_until || now - last_stall < 5000) return;
        last_stall = now;
        // (stall-offer card removed: the graceful-suspension tier handles a
        // struggling connection automatically — no user action required)
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

        const edge_suspended = settings.edge && edge_is_suspended(Date.now());
        if (caps.setRate && caps.getRate) {
            if (!settings.enabled) {
                reset_playbackRate();
            } else if (settings.edge && !edge_suspended) {
                // ONE buffer metric governs edge mode: the same video.buffered
                // reserve ride_edge nudges on. Feeding the controller the
                // stats-for-nerds health here could accelerate while a nudge
                // thins the reserve in the same tick (review finding).
                const ev = video_instance();
                const read_reserve = () => (ev && ev.buffered.length)
                    ? ev.buffered.end(ev.buffered.length - 1) - ev.currentTime
                    : health;
                // Rate control stays >= 1.0x always (Owner rule); danger dips
                // are handled by an instant step-back, not a slow-down.
                edge_rescue(ev, read_reserve(), Date.now());
                // Re-read AFTER the possible rescue seek — the controller must
                // see the restored reserve, not the pre-seek danger value
                // (review finding: don't lean on EDGE_DANGER == BUFFER_FLOOR).
                set_playbackRate(settings.playbackRate, latency, read_reserve(), edge_target, false);
            } else if (settings.edge) {
                set_playbackRate(settings.playbackRate, latency, health, settings.bufferTarget, true);
            } else {
                set_playbackRate(settings.playbackRate, latency, health, settings.bufferTarget, settings.auto);
            }
        }

        if (settings.enabled && settings.edge && !edge_suspended) {
            ride_edge(progress_state);
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
        edge_last_nudge = 0;      // fresh stream: edge-riding state must not carry over
        edge_self_seek_until = 0;
        edge_target = EDGE_START;
        edge_last_reserve = null;
        edge_last_trouble = 0;
        edge_stall_times = [];
        edge_suspended_until = 0;
        edge_env_max = null;
        edge_env_min = null;
        edge_last_rescue = 0;

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