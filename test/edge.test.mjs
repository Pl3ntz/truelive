// TrueLive — edge governor v2 tests
// © 2026 Vitor Plentz — GPL-3.0
//
// Deterministic simulations of the governor against arrival patterns measured
// on real streams (2026-07-02 field session, docs/RESEARCH.md). No browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import edgePkg from '../engine/edge.js';
const { createEdgeGovernor } = edgePkg;

const TICK_MS = 250;

/**
 * Drive the governor through a synthetic stream.
 * arrivalFn(tickIndex) -> seconds of media arriving during this tick.
 * Playback consumes at `rate` (the governor's own output) in media seconds;
 * a rescue intent executes as an instant reserve restore (like inject.js).
 */
function simulate(gov, { ticks, arrivalFn, startReserve = 5, maxRate = 1.25, t0 = 1_000_000 }) {
    let bufferedEnd = 100;
    let currentTime = bufferedEnd - startReserve;
    let rate = 1.0;
    const log = [];
    for (let i = 0; i < ticks; i++) {
        const now = t0 + i * TICK_MS;
        bufferedEnd += arrivalFn(i);
        currentTime = Math.min(bufferedEnd, currentTime + rate * (TICK_MS / 1000));
        let reserve = bufferedEnd - currentTime;
        const out = gov.tick(now, bufferedEnd, reserve, maxRate);
        if (out.rescue && !out.suspended) {
            // inject.js: step the playhead back to restore the reserve
            currentTime = Math.max(0, bufferedEnd - out.rescueTo);
            reserve = bufferedEnd - currentTime;
            gov.noteRescue(now, reserve);
        }
        rate = out.suspended ? 1.0 : out.rate;
        log.push({ i, now, reserve, ...out });
    }
    return log;
}

// Calm stream: one 0.5s segment every 500ms (steady 1.0x inflow).
const calmArrival = i => (i % 2 === 0 ? 0.5 : 0);

// The measured 4K60 cycle (field, 2026-07-02): ~7s trickling at 0.44x
// (0.11s per tick), then a burst that repays the deficit.
function heavy4kArrival(i) {
    const phase = i % 40; // 10s cycle
    if (phase < 28) return 0.11;          // 7s trickle: 3.08s arrive, 7s consumed
    if (phase < 34) return 0.85;          // 1.5s burst repay
    return 0.3;                           // normal-ish tail
}

test('calm stream: rate never below 1.0 and never above the user ceiling', () => {
    const gov = createEdgeGovernor();
    const log = simulate(gov, { ticks: 2400, arrivalFn: calmArrival, startReserve: 8 });
    for (const s of log) {
        assert.ok(s.rate >= 1.0, `rate ${s.rate} < 1.0 at tick ${s.i}`);
        assert.ok(s.rate <= 1.25, `rate ${s.rate} > maxRate at tick ${s.i}`);
    }
});

test('calm stream: catch-up is gradual (0.05 steps, no jumps)', () => {
    const gov = createEdgeGovernor();
    const log = simulate(gov, { ticks: 2400, arrivalFn: calmArrival, startReserve: 10 });
    for (const s of log) {
        const q = Math.round(s.rate * 20) / 20;
        assert.equal(s.rate, q, `rate ${s.rate} not on the 0.05 grid`);
    }
    // it actually catches up: reserve converges near the target
    const tail = log.slice(-200);
    const avg = tail.reduce((a, s) => a + s.reserve, 0) / tail.length;
    assert.ok(avg < 4.0, `did not converge (avg tail reserve ${avg.toFixed(2)})`);
    assert.ok(tail.every(s => !s.rescue), 'calm stream must never need a rescue');
});

test('calm stream: floor relaxes to the deep-calm gate, then to ABS floor', () => {
    const gov = createEdgeGovernor();
    // 5 min of calm — beyond DEEP_CALM_MS (3 min)
    const log = simulate(gov, { ticks: 1200, arrivalFn: calmArrival, startReserve: 5 });
    const last = log[log.length - 1];
    assert.ok(last.floor <= 2.5 + 1e-9, `floor ${last.floor} should have relaxed`);
    assert.ok(last.target < 3.0, `target ${last.target} should creep toward the floor`);
});

test('heavy 4K cycle: adapts above the old 4.5 ceiling instead of thrashing', () => {
    const gov = createEdgeGovernor();
    const log = simulate(gov, { ticks: 2400, arrivalFn: heavy4kArrival, startReserve: 8 });
    const tail = log.slice(-400);
    // the measured need exceeds the old fixed ceiling — v1 could never hold it
    const dd = gov.getState().drawdown;
    assert.ok(dd + 0.6 > 4.5, `measured need ${dd + 0.6} must exceed the old ceiling`);
    assert.ok(tail.every(s => s.floor <= 10.0), 'bound must respect HARD_CEIL');
    // stability: the handover of last resort never fires on this cycle
    assert.ok(tail.every(s => !s.suspended), 'must not suspend on the measured 4K cycle');
    // probing may buy delay with OCCASIONAL rescues — but bounded by budget
    const rescues = log.filter(s => s.rescue).length;
    assert.ok(rescues <= 8, `rescues must stay budget-bounded over 10 min, got ${rescues}`);
});

test('probing: after earned calm the target dives below the worst-case floor', () => {
    const gov = createEdgeGovernor();
    // a 4s-deep valley every 60s keeps the worst case high in the window,
    // while the stream is otherwise calm — the probe should undercut it
    const arrival = i => {
        if (i % 240 >= 224) return 0;            // 4s starvation every 60s
        return i % 2 === 0 ? 0.55 : 0;           // slight surplus otherwise
    };
    const log = simulate(gov, { ticks: 4000, arrivalFn: arrival, startReserve: 6 });
    assert.ok(log.every(s => !s.suspended), 'probing must never escalate to suspension');
    const adapted = log.slice(800); // after the first rescues taught the governor
    const worstCase = Math.max(...adapted.map(s => +s.target));
    const probedMin = Math.min(...adapted.map(s => +s.target));
    assert.ok(probedMin < worstCase - 0.5,
        `target never probed (min ${probedMin} vs worst-case ${worstCase})`);
});

test('a rescue jump is meaningful but hard-capped at 4.5s', () => {
    const gov = createEdgeGovernor();
    const log = simulate(gov, { ticks: 2400, arrivalFn: heavy4kArrival, startReserve: 8 });
    const dd = gov.getState().drawdown;
    const last = log[log.length - 1];
    assert.ok(last.rescueTo >= Math.min(4.5, Math.max(dd + 0.6, 2.5)) - 1e-9,
        `rescueTo ${last.rescueTo} too small for the measured valley (${dd})`);
    assert.ok(log.every(s => s.rescueTo <= 4.5 + 1e-9),
        'no single rescue may rewind more than 4.5s');
});

test('probe never dives below the deepest valley of the last 30s', () => {
    const gov = createEdgeGovernor();
    // recurring 3s-deep valleys every 20s: dd_recent stays ~3 permanently
    const arrival = i => (i % 80 >= 68 ? 0 : (i % 2 === 0 ? 0.55 : 0));
    const log = simulate(gov, { ticks: 3200, arrivalFn: arrival, startReserve: 6 });
    const adapted = log.slice(1200);
    const boundMin = Math.min(...adapted.map(s => +s.floor));
    assert.ok(boundMin >= 2.0, `bound ${boundMin} broke the absolute floor`);
    // with valleys ~3s recurring inside every 30s window, the probe's bound
    // must not rest materially below valley + margin
    assert.ok(boundMin >= 2.5, `probe bound ${boundMin} bet against known valleys`);
});

test('danger dip: rescue fires once, respects cooldown, target rises', () => {
    const gov = createEdgeGovernor();
    // steady inflow, then arrivals stop entirely for 6s (starvation)
    const arrival = i => (i >= 100 && i < 124 ? 0 : (i % 2 === 0 ? 0.5 : 0));
    const log = simulate(gov, { ticks: 400, arrivalFn: arrival, startReserve: 3 });
    const rescueTicks = log.filter(s => s.rescue).map(s => s.i);
    assert.ok(rescueTicks.length >= 1, 'starvation must trigger a rescue');
    for (let k = 1; k < rescueTicks.length; k++) {
        assert.ok((rescueTicks[k] - rescueTicks[k - 1]) * TICK_MS >= 10000,
            'rescues must respect the 10s cooldown');
    }
    const afterIdx = log.findIndex(s => s.rescue);
    assert.ok(log[log.length - 1].target > log[afterIdx > 0 ? afterIdx - 1 : 0].target - 1e-9,
        'target must not tighten right after an incident');
});

test('real stalls suspend; rescues alone do not', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    // two real stalls inside the 5-min window -> suspended
    gov.noteStall(t0);
    gov.noteStall(t0 + 60_000);
    const out = gov.tick(t0 + 61_000, 100, 5, 1.25);
    assert.equal(out.suspended, true, 'two real stalls must suspend');

    const gov2 = createEdgeGovernor();
    // many executed rescues below the hard ceiling -> never suspends
    for (let k = 0; k < 6; k++) gov2.noteRescue(t0 + k * 20_000, 2.5);
    const out2 = gov2.tick(t0 + 130_000, 100, 5, 1.25);
    assert.equal(out2.suspended, false, 'rescues below the ceiling must not suspend');
});

test('rescue at the hard ceiling counts as a handover case', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    // force the target to the hard ceiling via repeated incidents
    for (let k = 0; k < 8; k++) gov.noteStall(t0 + k * 400_000); // spaced: no suspension
    assert.ok(gov.getState().target >= 9.9, 'setup: target must reach the ceiling');
    gov.noteRescue(t0 + 4_000_000, 2.5);
    gov.noteRescue(t0 + 4_020_000, 2.5);
    const out = gov.tick(t0 + 4_021_000, 100, 5, 1.25);
    assert.equal(out.suspended, true, 'rescuing while fully relaxed must hand over');
});

test('quality RISE while suspended: re-measures but keeps the suspension', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    gov.noteStall(t0);
    gov.noteStall(t0 + 10_000); // suspended now
    gov.qualityChange(t0 + 20_000, false); // 720p -> 1080p: more bitrate won't fix this internet
    const out = gov.tick(t0 + 26_000, 50, 5, 1.25);
    assert.equal(out.suspended, true, 'a quality rise must not clear the suspension');
});

test('handover via rescue-at-ceiling re-arms at the safe START target', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    for (let k = 0; k < 8; k++) gov.noteStall(t0 + k * 400_000); // spaced: reach the ceiling
    gov.noteRescue(t0 + 4_000_000, 2.5);
    gov.noteRescue(t0 + 4_020_000, 9.9); // triggers the handover
    const st = gov.getState();
    assert.ok(st.suspended_until > t0 + 4_020_000, 'setup: must be suspended');
    assert.ok(st.target <= 2.75 + 1e-9,
        `target ${st.target} must re-arm at START, not carry the incident bump`);
});

test('quality DROP: fresh measurement, suspension cleared, grace respected', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    gov.noteStall(t0);
    gov.noteStall(t0 + 10_000); // suspended now
    gov.qualityChange(t0 + 20_000, true);
    // rendition wipe: reserve crashes to 0.4 during grace — must NOT rescue
    const during = gov.tick(t0 + 21_000, 50, 0.4, 1.25);
    assert.equal(during.suspended, false, 'quality change must clear suspension');
    assert.equal(during.rescue, false, 'no rescue during the refill grace');
    assert.equal(during.rate, 1.0, 'no catch-up during the refill grace');
    // after grace, buffered.end moved BACKWARD (new rendition) — the
    // measurement must re-anchor without registering a fake drawdown
    gov.tick(t0 + 25_000, 30, 3.0, 1.25);
    const st = gov.getState();
    assert.ok(st.drawdown < 1.0, `fake drawdown leaked in: ${st.drawdown}`);
    assert.ok(st.target <= 2.75 + 1e-9, 'target must restart safe after a quality change');
});

test('old 4K valley expires: floor recovers after the window on a calm rendition', () => {
    const gov = createEdgeGovernor();
    // phase 1: heavy 4K long enough to raise the floor
    simulate(gov, { ticks: 1200, arrivalFn: heavy4kArrival, startReserve: 8, t0: 1_000_000 });
    const heavyFloor = gov.getState();
    // quality drop to a calm rendition
    gov.qualityChange(1_000_000 + 1200 * TICK_MS);
    const log = simulate(gov, {
        ticks: 2000, arrivalFn: calmArrival, startReserve: 5,
        t0: 1_000_000 + 1200 * TICK_MS + 5_000,
    });
    const last = log[log.length - 1];
    assert.ok(last.floor <= 2.5 + 1e-9,
        `floor ${last.floor} must re-learn the calm rendition (was ${JSON.stringify(heavyFloor.drawdown)})`);
});

test('incident bump above the safe floor drains fast after calm', () => {
    const gov = createEdgeGovernor();
    // establish a calm baseline so the safe floor is low and stable
    simulate(gov, { ticks: 400, arrivalFn: calmArrival, startReserve: 5, t0: 1_000_000 });
    const t1 = 1_000_000 + 400 * TICK_MS;
    gov.noteRescue(t1, 4.4); // incident: target jumps ~+1.5 above the floor
    const bumped = gov.getState().target;
    // resume calm; measure how long the bump takes to drain back to the floor
    const log = simulate(gov, { ticks: 800, arrivalFn: calmArrival, startReserve: 4.4, t0: t1 + 250 });
    const settled = log.findIndex(s => s.target <= bumped - 1.4);
    assert.ok(settled >= 0, 'the bump never drained');
    // CALM_MS (60s) + ~1.5s/0.0375-per-tick ≈ 240+40 ticks — assert well under
    // the old single-speed pace (240 + 120 ticks)
    assert.ok(settled < 320, `bump drained only at tick ${settled} (too slow)`);
});

test('one freak delivery gap does not pin the floor; a repeating one does', () => {
    const gov = createEdgeGovernor();
    // calm, then ONE 8s starvation (freak broadcast hiccup), then calm again
    const oneGap = i => (i >= 400 && i < 432 ? 0 : (i % 2 === 0 ? 0.5 : 0));
    simulate(gov, { ticks: 1200, arrivalFn: oneGap, startReserve: 12 });
    const afterFreak = gov.getState().drawdown;
    assert.ok(afterFreak < 4.0,
        `a single completed freak valley must not own the floor (need ${afterFreak})`);

    const gov2 = createEdgeGovernor();
    // the same gap REPEATING inside the window must be honored
    const twoGaps = i => ((i >= 400 && i < 432) || (i >= 700 && i < 732)
        ? 0 : (i % 2 === 0 ? 0.5 : 0));
    simulate(gov2, { ticks: 900, arrivalFn: twoGaps, startReserve: 12 });
    assert.ok(gov2.getState().drawdown > 4.0,
        `a repeating gap must raise the measured need (${gov2.getState().drawdown})`);
});

test('quantile floor: the rare deepest valley does not tax every second', () => {
    const gov = createEdgeGovernor();
    // many shallow valleys (~2s) + one deep (~5s) inside the window: the
    // floor should track the shallow majority, leaving the tail to rescues
    const arrival = i => {
        if (i >= 380 && i < 400) return 0;             // one 5s valley
        if (i % 60 >= 52) return 0;                    // 2s valley every 15s
        return i % 2 === 0 ? 0.6 : 0;                  // 1.2x surplus: valleys repay
    };
    simulate(gov, { ticks: 960, arrivalFn: arrival, startReserve: 10 });
    const need = gov.getState().drawdown;
    assert.ok(need < 4.0, `floor must follow the shallow majority, got ${need}`);
    assert.ok(need >= 1.5, `floor must still honor the recurring valleys, got ${need}`);
});

test('post-rescue hold is short once the valley closed; stalls keep the long gate', () => {
    const gov = createEdgeGovernor();
    // calm regime, one starvation deep enough to force a rescue, then calm
    const arrival = i => (i >= 200 && i < 220 ? 0 : (i % 2 === 0 ? 0.6 : 0));
    const log = simulate(gov, { ticks: 200 + 20 + 240, arrivalFn: arrival, startReserve: 4 });
    const lastRescueIdx = log.map(s => s.rescue).lastIndexOf(true);
    assert.ok(lastRescueIdx > 0, 'setup: the starvation must force a rescue');
    // peak target right after the (last) rescue, vs ~40s later: the descent
    // must already be under way — the old 60s gate would still hold it flat
    const peak = Math.max(...log.slice(lastRescueIdx, lastRescueIdx + 40).map(s => +s.target));
    const at40s = log[Math.min(log.length - 1, lastRescueIdx + 160)].target;
    assert.ok(at40s < peak - 0.2,
        `target ${at40s} vs peak ${peak}: descent must start before the 60s stall gate`);

    // a REAL stall keeps the 60s gate
    const gov2 = createEdgeGovernor();
    simulate(gov2, { ticks: 400, arrivalFn: calmArrival, startReserve: 5, t0: 1_000_000 });
    const t1 = 1_000_000 + 400 * TICK_MS;
    gov2.noteStall(t1);
    const bumped = gov2.getState().target;
    const log2 = simulate(gov2, { ticks: 160, arrivalFn: calmArrival, startReserve: 5, t0: t1 + 250 });
    assert.ok(log2[log2.length - 1].target > bumped - 0.1,
        'a stall must hold the bumped target through the 40s mark');
});

test('buffer-first: no acceleration while the reserve is thin', () => {
    const gov = createEdgeGovernor();
    // reserve hovers just above danger with weak inflow — must rest at 1.0
    const log = simulate(gov, { ticks: 200, arrivalFn: i => (i % 2 === 0 ? 0.48 : 0), startReserve: 2.2 });
    for (const s of log.slice(4)) {
        if (s.reserve < 2.0) assert.equal(s.rate, 1.0, `accelerated at thin reserve ${s.reserve}`);
    }
});
