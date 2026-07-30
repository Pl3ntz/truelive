// Tests for buildDiagExport in common.js — the PURE serializer behind the
// popup's "Report a problem" export. No chrome/DOM needed (mirrors the
// controller/edge/pix pure-logic pattern).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as common from '../common.js';

const sampleRaw = JSON.stringify({
    v: 1, sid: 3, start: 1000,
    caps: { stats: true, progress: true, seekLive: false, videoData: true },
    events: [
        { t: 10, k: 'attach', h: 0, caps: 'stats,progress' },
        { t: 500, k: 'rescue', h: 0, back: 2.1, to: 2.5 },
        { t: 800, k: 'stall', h: 1 },
        { t: 900, k: 'rescue', h: 1, back: 1.8, to: 2.5 },
    ],
    samples: [
        { t: 0, h: 0, rate: 1.05, reserve: 3.2, floor: 2.0, drawdown: 0.4, suspended: 0 },
        { t: 2000, h: 1, rate: 1.0, reserve: 2.9, floor: 2.0, drawdown: 0.5, suspended: 0 },
        { t: 4000, h: 1, rate: 1.1, reserve: 3.1, floor: 2.0, drawdown: 0.4, suspended: 0 },
    ],
});

test('buildDiagExport produces valid JSON with meta and the raw rings', () => {
    const out = common.buildDiagExport(sampleRaw, { version: '1.2.1', browser: 'Chrome 138', mode: 'edge', stamp: '2026-07-10-120000' });
    const parsed = JSON.parse(out.json);
    assert.equal(parsed.truelive, '1.2.1');
    assert.equal(parsed.browser, 'Chrome 138');
    assert.equal(parsed.mode, 'edge');
    assert.equal(parsed.session, 3);
    assert.equal(parsed.caps, 'stats,progress,videoData'); // only truthy caps, false dropped
    assert.equal(parsed.events.length, 4);
    assert.equal(parsed.samples.length, 3);
    assert.equal(out.filename, 'truelive-diagnostico-2026-07-10-120000.json');
    assert.equal(out.empty, false);
});

test('markdown carries a fenced json block and an event tally', () => {
    const out = common.buildDiagExport(sampleRaw, { version: '1.2.1', browser: 'Firefox 128', mode: 'edge' });
    assert.match(out.markdown, /```json/);
    assert.match(out.markdown, /rescue×2/);   // two rescue events tallied
    assert.match(out.markdown, /stall×1/);
    assert.match(out.markdown, /2 com aba oculta/); // two samples had h=1 (F3 evidence)
    // the fenced block must itself be valid JSON
    const fenced = out.markdown.split('```json\n')[1].split('\n```')[0];
    assert.doesNotThrow(() => JSON.parse(fenced));
});

test('never leaks identifiers: only allowlisted keys survive', () => {
    // Even if the engine somehow stored a forbidden field, the export shape is
    // built from events/samples/caps/sid only — but assert the contract holds
    // for a clean payload: no video/url/title/uuid keys anywhere in the output.
    const out = common.buildDiagExport(sampleRaw, { version: '1.2.1', browser: 'Chrome 138', mode: 'edge' });
    assert.doesNotMatch(out.json, /video_?id|watch\?v=|"url"|"title"|uuid/i);
});

test('empty / malformed input degrades gracefully to empty=true', () => {
    for (const bad of [undefined, '', 'not json', '{}', JSON.stringify({ events: [], samples: [] })]) {
        const out = common.buildDiagExport(bad, {});
        assert.equal(out.empty, true, `input ${JSON.stringify(bad)}`);
        assert.doesNotThrow(() => JSON.parse(out.json)); // still valid JSON
        assert.equal(out.filename, 'truelive-diagnostico-log.json'); // stamp fallback
    }
});

test('meta defaults to "?" when the popup supplies nothing', () => {
    const out = common.buildDiagExport(sampleRaw);
    const parsed = JSON.parse(out.json);
    assert.equal(parsed.truelive, '?');
    assert.equal(parsed.browser, '?');
    assert.equal(parsed.mode, '?');
});
