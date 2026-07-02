// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
//
// Edge governor v2 — the "Super Ao Vivo" brain, extracted from inject.js so it
// can be unit-tested without a browser. Replaces the seek-nudge rider (v1):
// delay now shrinks ONLY by playback rate (gradual, like Automático), and a
// seek survives solely as the emergency rescue.
//
// Technique provenance (docs/RESEARCH.md has the full study, 2026-07-02):
//   • Rate curve: hls.js latency-controller sigmoid 2/(1+e^(-0.75Δ)), clamped
//     to >=1.0 and quantized in 0.05 steps (also matches YouTube's own rate
//     quantization).
//   • Dead-band near the target + buffer-first override: dash.js LoL+.
//   • Floor measurement: NetEQ-style — measure segment ARRIVAL, not buffer
//     level, so our own seeks and the catch-up drain can't pollute it. The
//     statistic is the max drawdown of cumulative (arrival − wallclock), i.e.
//     how deep the reserve WOULD dip at 1.0x with no seeks.
//   • Forgetting: BBR win_minmax 3-sample windowed max — an old 4K burst
//     valley expires instead of haunting a calmer rendition for 20 minutes.
//   • Give-up policy: Shaka dynamicTargetLatency — the target relaxes after an
//     incident and re-tightens with stability; binary suspension is only the
//     last resort (repeated REAL stalls — a rescue no longer counts as one).
//
// Dual-loaded like controller.js: classic script in the page (exposes
// window.TrueLive.createEdgeGovernor) and CommonJS under node --test.
'use strict';
(function () {
    function createEdgeGovernor() {
        // --- reserve policy (seconds of buffered reserve ahead of playhead) ---
        const FLOOR_ABS = 2.0;        // never target less (below ~1.5 a stall
                                      // becomes a permanent latency penalty)
        const DEEP_CALM_FLOOR = 2.5;  // probing under this is EARNED by calm
        const DEEP_CALM_MS = 180000;  // ...this much calm (3 min)
        const HARD_CEIL = 10.0;       // beyond this, edge-riding stops helping
        const START = 2.75;           // first target — safe until proven calm
        const MARGIN = 0.6;           // cushion above the measured drawdown
        const DANGER = 1.5;           // reserve below this = rescue territory
        const RESCUE_TO = 2.5;        // a rescue restores at least this much
        const RESCUE_COOLDOWN_MS = 10000;
        const INCIDENT_BUMP = 1.5;    // target raise per stall/rescue
        const CALM_MS = 60000;        // calm needed before tightening resumes
        const CREEP = 0.0125;         // target decay toward floor, per tick
        // --- catch-up rate (hls.js sigmoid family) ---
        const SIG_K = 0.75;           // sigmoid steepness over Δ = reserve-target
        const RATE_QUANT = 20;        // quantize rate to 1/20 = 0.05 steps
        const DEADBAND = 0.15;        // Δ under max(this, 2% of target) rests at 1.0
        const DRAIN_BRAKE = -0.02;    // net-inflow EMA under this: rest (LoL+ buffer-first)
        // --- probing below the safe floor (AIMD spirit, TCP-style) ---
        // The measured drawdown is a WORST-CASE estimate; the true sustainable
        // reserve is usually lower. After earned calm the target probes below
        // the safe floor; a rescue is the congestion signal: back off above
        // the level that failed, remember it for a while, try again later.
        // Worst case (budget spent) degrades to exactly the safe floor.
        const PROBE_CALM_MS = 120000;    // calm to earn probing below the floor
        const PROBE_BACKOFF = 1.0;       // failed level + this = new lower bound
        const PROBE_FAIL_TTL_MS = 600000; // how long a failed level is remembered
        const PROBE_MAX_RESCUES = 1;     // rescues within the window that...
        const PROBE_RESCUE_WINDOW_MS = 600000; // ...pause probing (hold safe floor)
        const DD_RECENT_WINDOW_MS = 30000; // short valley memory: the probe never
                                           // dives below what JUST happened
        const RESCUE_STEP_MAX = 4.5;     // hard cap per rescue jump — a deep need
                                         // is met by chained small steps, never
                                         // one giant visible rewind
        // --- suspension (last resort — REAL stalls only) ---
        const SUSPEND_STALLS = 2;
        const SUSPEND_WINDOW_MS = 300000;
        const SUSPEND_MS = 600000;
        // --- measurement ---
        const DD_WINDOW_MS = 120000;  // drawdown memory (BBR-style expiry)
        const GRACE_MS = 4000;        // after quality switch: no rescue, no measuring
        const MAX_TICK_GAP_S = 2.0;   // bigger gap = we were asleep: re-anchor

        // BBR lib/win_minmax.c running-max: 3 time-stamped samples, O(1),
        // old maxima expire by age instead of decaying asymptotically.
        function winmax_create() { return { s: [] }; }
        function winmax_update(m, win, t, v) {
            const s = m.s;
            if (!s.length || v >= s[0].v || (s[2] && t - s[2].t > win)) {
                m.s = [{ t, v }, { t, v }, { t, v }];
                return v;
            }
            if (v >= s[1].v) { s[2] = { t, v }; s[1] = { t, v }; }
            else if (v >= s[2].v) { s[2] = { t, v }; }
            const dt = t - s[0].t;
            if (dt > win) {
                s.shift(); s.push({ t, v });
                if (t - s[0].t > win) { s.shift(); s.push({ t, v }); }
            } else if (s[1].t === s[0].t && dt > win / 4) {
                s[2] = s[1] = { t, v };
            } else if (s[2].t === s[1].t && dt > win / 2) {
                s[2] = { t, v };
            }
            return s[0].v;
        }

        // --- state ---
        let target = START;
        let last_now = null;          // ms of previous tick
        let last_end = null;          // buffered.end of previous tick
        let cum = 0;                  // cumulative (arrival − wallclock) since anchor
        let cum_max = 0;              // running peak of cum
        let dd_filter = winmax_create();
        let dd_now = 0;               // windowed max drawdown (the measured need)
        let dd_recent_filter = winmax_create();
        let dd_recent = 0;            // same statistic over 30s — the probe's floor
        let reserve_ema = null;
        let inflow_ema = 0;           // smoothed net inflow per tick (s)
        let last_trouble = 0;         // stall, rescue, or failed rescue
        let last_rescue = 0;
        let grace_until = 0;
        let stall_times = [];
        let suspended_until = 0;
        let rescue_times = [];        // probing budget bookkeeping
        let probe_fail = 0;           // reserve level a probe died at (+backoff)
        let probe_fail_t = 0;

        function measurement_reset() {
            last_now = null;
            last_end = null;
            cum = 0;
            cum_max = 0;
            dd_filter = winmax_create();
            dd_now = 0;
            dd_recent_filter = winmax_create();
            dd_recent = 0;
            reserve_ema = null;
            inflow_ema = 0;
        }

        function abs_gate(now) {
            // going under 2.5 is EARNED by deep calm (3+ min without trouble)
            return now - last_trouble < DEEP_CALM_MS ? DEEP_CALM_FLOOR : FLOOR_ABS;
        }

        // Worst-case-safe floor: the deepest arrival valley in the window
        // plus a margin. Holding this NEVER needs a rescue.
        function safe_floor(now) {
            return Math.min(HARD_CEIL, Math.max(abs_gate(now), dd_now + MARGIN));
        }

        // Where the target is allowed to rest. Normally the safe floor; with
        // earned calm and rescue budget it drops toward the absolute gate so
        // the target can PROBE the true minimum, bounded by any remembered
        // failed level.
        function target_bound(now) {
            const safe = safe_floor(now);
            if (now - last_trouble < PROBE_CALM_MS) return safe;
            rescue_times = rescue_times.filter(t => now - t < PROBE_RESCUE_WINDOW_MS);
            if (rescue_times.length >= PROBE_MAX_RESCUES) return safe;
            const fail = now - probe_fail_t < PROBE_FAIL_TTL_MS ? probe_fail : 0;
            // never bet against known data: the probe bottoms at the deepest
            // valley of the last 30s (a stream that truly calmed lets it dive)
            return Math.min(safe, Math.max(abs_gate(now), fail, dd_recent + MARGIN));
        }

        function incident(now) {
            target = Math.min(HARD_CEIL, target + INCIDENT_BUMP);
            last_trouble = now;
        }

        function note_stall(now) {
            stall_times = stall_times.filter(t => now - t < SUSPEND_WINDOW_MS);
            stall_times.push(now);
            incident(now);
            if (stall_times.length >= SUSPEND_STALLS) {
                suspended_until = now + SUSPEND_MS;
                stall_times = [];
                target = START; // floor knowledge survives in dd_filter
            }
        }

        // hls.js latency-controller curve: gentle near the target, saturating
        // toward maxRate as the excess grows; 0.05 quantization kills rate
        // flutter (and matches what YouTube snaps custom rates to anyway).
        function sigmoid_rate(delta, maxRate) {
            const raw = 2 / (1 + Math.exp(-SIG_K * delta));
            const q = Math.round(raw * RATE_QUANT) / RATE_QUANT;
            return Math.min(Math.max(1.0, maxRate), Math.max(1.0, q));
        }

        /**
         * One governor step. Call every engine tick while Super Ao Vivo is on
         * and the viewer is at the live head.
         * @param {number} nowMs - wall clock (ms)
         * @param {number} bufferedEnd - video.buffered end (s, media time)
         * @param {number} reserve - bufferedEnd − currentTime (s)
         * @param {number} maxRate - the user's catch-up rate ceiling (>= 1.0)
         * @returns {{rate:number, rescue:boolean, rescueTo:number, target:number,
         *            floor:number, suspended:boolean}}
         */
        function tick(nowMs, bufferedEnd, reserve, maxRate) {
            const suspended = nowMs < suspended_until;

            // --- measure arrival (NetEQ spirit: immune to playhead moves) ---
            const in_grace = nowMs < grace_until;
            if (!in_grace && Number.isFinite(bufferedEnd) && Number.isFinite(reserve)) {
                if (last_now !== null && last_end !== null) {
                    const dt = (nowMs - last_now) / 1000;
                    const arrival = bufferedEnd - last_end;
                    if (dt > 0 && dt <= MAX_TICK_GAP_S && arrival >= 0) {
                        // negative arrival = rendition wipe/DVR seek → skip, re-anchor
                        cum += arrival - dt;
                        cum_max = Math.max(cum_max, cum);
                        const drawdown = cum_max - cum;
                        dd_now = winmax_update(dd_filter, DD_WINDOW_MS, nowMs, drawdown);
                        dd_recent = winmax_update(dd_recent_filter, DD_RECENT_WINDOW_MS, nowMs, drawdown);
                        inflow_ema = inflow_ema * 0.8 + (arrival - dt) * 0.2;
                    }
                }
                last_now = nowMs;
                last_end = bufferedEnd;
                reserve_ema = reserve_ema === null ? reserve : reserve_ema * 0.9 + reserve * 0.1;
            } else if (in_grace) {
                last_now = null; // re-anchor after the grace window
                last_end = null;
            }

            // --- adapt the target (Shaka dynamicTargetLatency + AIMD probe) ---
            const floor = target_bound(nowMs);
            if (target < floor) {
                target = floor;                       // bound rose: respect it now
            } else if (nowMs - last_trouble > CALM_MS && target > floor) {
                target = Math.max(floor, target - CREEP); // calm: creep back down
            }
            // A rescue restores toward the safe floor but each JUMP is capped:
            // a deep need is met by chained small steps (10s cooldown apart),
            // never one giant visible rewind (field finding, 2026-07-02).
            const rescue_to = Math.min(RESCUE_STEP_MAX, Math.max(safe_floor(nowMs), RESCUE_TO));

            if (suspended) {
                return { rate: 1.0, rescue: false, rescueTo: rescue_to, target, floor, suspended: true };
            }

            // --- emergency rescue intent (seek stays ONLY here) ---
            const rescue = !in_grace && reserve < DANGER
                && nowMs - last_rescue >= RESCUE_COOLDOWN_MS;

            // --- catch-up rate (gradual ONLY — Owner rule) ---
            let rate = 1.0;
            const smoothed = reserve_ema === null ? reserve : reserve_ema;
            const delta = smoothed - target;
            const deadband = Math.max(DEADBAND, 0.02 * target);
            const buffer_first = reserve < Math.max(DANGER + 0.5, target * 0.5);
            if (!in_grace && !rescue && !buffer_first
                && delta > deadband && inflow_ema > DRAIN_BRAKE) {
                rate = sigmoid_rate(delta, maxRate);
            }
            return {
                rate,
                rescue,
                rescueTo: rescue_to,
                target, floor,
                suspended: false,
            };
        }

        /** A rescue seek was performed (inject.js moved the playhead back). */
        function noteRescue(nowMs, restoredReserve) {
            last_rescue = nowMs;
            rescue_times.push(nowMs);
            // a probe died here: remember the level that failed so the next
            // probing round bottoms out just above it (AIMD back-off)
            if (target < safe_floor(nowMs) - 0.01) {
                probe_fail = Math.min(HARD_CEIL, target + PROBE_BACKOFF);
                probe_fail_t = nowMs;
            }
            // the seek moved the playhead, not the arrivals — measurement
            // stays valid; only the reserve EMA must re-learn
            reserve_ema = null;
            // needing a rescue while ALREADY fully relaxed = this internet
            // can't hold the edge at all right now — a real handover case
            // (rescues are cooldown-limited, so this can't spam suspension)
            if (target >= HARD_CEIL - 0.01) {
                note_stall(nowMs);
                // if that triggered the handover, note_stall already reset the
                // target to START for the re-arm — don't bump it back up
                if (nowMs < suspended_until) return;
            }
            incident(nowMs);
            if (Number.isFinite(restoredReserve)) {
                target = Math.min(HARD_CEIL, Math.max(target, restoredReserve));
            }
        }

        /** Danger with nothing buffered behind to step back to. */
        function noteTrouble(nowMs) {
            last_trouble = nowMs;
        }

        /** A REAL stall (video 'waiting' that wasn't our own seek). */
        function noteStall(nowMs) {
            note_stall(nowMs);
        }

        /**
         * Rendition switched: old measurements describe the old rendition.
         * @param {boolean} rearm - true when the quality went DOWN: a lighter
         * rendition earns a fresh chance (suspension cleared). A quality RISE
         * on a connection bad enough to be suspended keeps the suspension —
         * more bitrate will not have fixed that internet.
         */
        function qualityChange(nowMs, rearm) {
            measurement_reset();
            target = START;
            rescue_times = [];
            probe_fail = 0;
            probe_fail_t = 0;
            if (rearm) {
                stall_times = [];
                suspended_until = 0;
            }
            grace_until = nowMs + GRACE_MS;
            last_trouble = nowMs;       // no tightening during the refill
        }

        /** New stream/page: forget everything. */
        function reset() {
            measurement_reset();
            target = START;
            last_trouble = 0;
            last_rescue = 0;
            grace_until = 0;
            stall_times = [];
            rescue_times = [];
            probe_fail = 0;
            probe_fail_t = 0;
            suspended_until = 0;
        }

        /** Read-only snapshot — diagnostics and tests. */
        function getState() {
            return {
                target, drawdown: dd_now, inflow_ema, reserve_ema,
                last_trouble, last_rescue, grace_until,
                stall_count: stall_times.length, suspended_until,
                probe_fail, rescue_count: rescue_times.length,
            };
        }

        return { tick, noteRescue, noteTrouble, noteStall, qualityChange, reset, getState,
                 DANGER, HARD_CEIL, START };
    }

    const api = { createEdgeGovernor };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') (window.TrueLive = window.TrueLive || {}).createEdgeGovernor = createEdgeGovernor;
}());
