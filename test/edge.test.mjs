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

test('heavy 4K cycle: floor rises above the old 4.5 ceiling instead of thrashing', () => {
    const gov = createEdgeGovernor();
    const log = simulate(gov, { ticks: 2400, arrivalFn: heavy4kArrival, startReserve: 8 });
    const tail = log.slice(-400);
    const floor = tail[tail.length - 1].floor;
    assert.ok(floor > 4.5, `floor ${floor} must exceed the old ceiling for this stream`);
    assert.ok(floor <= 10.0, `floor ${floor} must respect HARD_CEIL`);
    // stability: no suspension and (near) no rescues once adapted
    assert.ok(tail.every(s => !s.suspended), 'must not suspend on the measured 4K cycle');
    const rescues = tail.filter(s => s.rescue).length;
    assert.ok(rescues === 0, `expected no rescues after adapting, got ${rescues}`);
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

test('quality change: fresh measurement, suspension cleared, grace respected', () => {
    const gov = createEdgeGovernor();
    const t0 = 1_000_000;
    gov.noteStall(t0);
    gov.noteStall(t0 + 10_000); // suspended now
    gov.qualityChange(t0 + 20_000);
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

test('buffer-first: no acceleration while the reserve is thin', () => {
    const gov = createEdgeGovernor();
    // reserve hovers just above danger with weak inflow — must rest at 1.0
    const log = simulate(gov, { ticks: 200, arrivalFn: i => (i % 2 === 0 ? 0.48 : 0), startReserve: 2.2 });
    for (const s of log.slice(4)) {
        if (s.reserve < 2.0) assert.equal(s.rate, 1.0, `accelerated at thin reserve ${s.reserve}`);
    }
});
