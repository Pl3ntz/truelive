import os
BASE = os.path.dirname(os.path.abspath(__file__))

CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1280px; height:800px; overflow:hidden;
  background:#0a0e1a;
  background-image: radial-gradient(1100px 700px at 50% -10%, #131c33 0%, #0a0e1a 60%);
  color:#f2f5fb;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  display:flex; flex-direction:column;
}
.stage { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:56px 90px 24px; }
.footer {
  display:flex; align-items:center; justify-content:center; gap:14px;
  padding:0 0 34px; color:#8fa1c4; font-size:19px;
}
.footer .mark { width:26px; height:26px; }
.footer b { color:#c8d4ea; font-weight:600; }
.footer .dot { opacity:.5; }
h1 { font-size:64px; font-weight:700; letter-spacing:-0.02em; text-align:center; }
.sub { font-size:26px; color:#8fa1c4; text-align:center; margin-top:14px; }
.accent { color:#4d8dff; }
.mono { font-family:ui-monospace,"SF Mono",Menlo,monospace; }
"""

MARK = """<svg class="mark" viewBox="0 0 128 128"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#82b4ff"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect x="2" y="2" width="124" height="124" rx="28" fill="#141c31"/><g transform="translate(20.8,20.8) scale(1.8)"><polygon points="26,4 12,27 21,27 19,44 36,20 26,20" fill="url(#b)" stroke="url(#b)" stroke-width="2.5" stroke-linejoin="round"/></g></svg>"""

FOOTER = f"""<div class="footer">{MARK}<b>TrueLive</b><span class="dot">·</span><span>the lowest delay your stream allows</span><span class="dot">·</span><span>free &amp; open source</span></div>"""

def page(body, extra_css=""):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body>{body}{FOOTER}</body></html>"""

# ---------- A · hero comparison ----------
extraA = """
.bars { width:100%; max-width:980px; margin-top:64px; display:flex; flex-direction:column; gap:30px; }
.brow { display:flex; align-items:center; gap:26px; }
.blabel { width:270px; font-size:23px; color:#c8d4ea; text-align:right; flex:none; }
.blabel.hot { color:#fff; font-weight:600; }
.btrack { flex:1; height:34px; background:#161f36; border-radius:17px; position:relative; }
.bfill { height:100%; border-radius:17px; background:#2c3document; }
.bval { width:110px; font-size:25px; color:#8fa1c4; flex:none; }
.bval.hot { color:#4d8dff; font-weight:700; }
.fill-tl { background:linear-gradient(90deg,#2563eb,#4d8dff); width:17%; height:100%; border-radius:17px; box-shadow:0 0 22px rgba(77,141,255,.45); }
.fill-tv { background:#3d4c6e; width:21%; height:100%; border-radius:17px; }
.fill-yt { background:#2a3550; width:37%; height:100%; border-radius:17px; }
.note { margin-top:46px; font-size:19px; color:#66779b; text-align:center; }
"""
bodyA = """
<div class="stage">
  <h1>Actually <span class="accent">live</span>.</h1>
  <p class="sub">3.2 seconds measured from broadcast to your screen — not estimated, not promised</p>
  <div class="bars">
    <div class="brow">
      <div class="blabel hot">YouTube + TrueLive</div>
      <div class="btrack"><div class="fill-tl"></div></div>
      <div class="bval hot mono">3.2s</div>
    </div>
    <div class="brow">
      <div class="blabel">Broadcast TV</div>
      <div class="btrack"><div class="fill-tv"></div></div>
      <div class="bval mono">3–5s</div>
    </div>
    <div class="brow">
      <div class="blabel">YouTube default</div>
      <div class="btrack"><div class="fill-yt"></div></div>
      <div class="bval mono">7.0s</div>
    </div>
  </div>
  <p class="note">Measured with the player's own ingest clock on low-latency streams. Public methodology in the repository.</p>
</div>
"""

# ---------- B · modes / popup ----------
extraB = """
.stage { flex-direction:row; gap:80px; }
.popup {
  width:400px; background:#101827; border:1px solid #232f4a; border-radius:18px;
  padding:28px; box-shadow:0 30px 80px rgba(0,0,0,.55); flex:none;
}
.phead { display:flex; align-items:center; gap:12px; }
.phead .mark { width:38px; height:38px; }
.pname { font-size:22px; font-weight:700; }
.ptag { font-size:14px; color:#8fa1c4; margin-top:2px; }
.plabel { font-size:12px; letter-spacing:.12em; color:#66779b; margin:26px 0 10px; }
.seg { display:flex; background:#0a111f; border:1px solid #232f4a; border-radius:999px; padding:5px; }
.seg span { flex:1; text-align:center; padding:11px 0; font-size:16px; color:#8fa1c4; border-radius:999px; }
.seg .on { background:linear-gradient(180deg,#3b82f6,#2563eb); color:#fff; font-weight:600; box-shadow:0 4px 14px rgba(59,130,246,.4); }
.pdesc { font-size:14.5px; color:#8fa1c4; margin-top:14px; line-height:1.5; }
.prow { margin-top:18px; border:1px solid #232f4a; border-radius:12px; padding:15px 18px; font-size:16px; color:#c8d4ea; display:flex; justify-content:space-between; align-items:center; }
.prow small { color:#66779b; font-size:18px; }
.copy { max-width:520px; }
.copy h1 { font-size:52px; text-align:left; }
.copy .sub { text-align:left; margin-top:18px; font-size:24px; line-height:1.5; }
.copy ul { margin-top:30px; list-style:none; display:flex; flex-direction:column; gap:16px; }
.copy li { font-size:21px; color:#c8d4ea; display:flex; gap:12px; align-items:baseline; line-height:1.45; }
.copy li b { color:#fff; }
.copy li::before { content:""; width:9px; height:9px; border-radius:50%; background:#4d8dff; flex:none; transform:translateY(-2px); }
"""
bodyB = """
<div class="stage">
  <div class="popup">
    <div class="phead">
      <svg class="mark" viewBox="0 0 128 128"><defs><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#82b4ff"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect x="2" y="2" width="124" height="124" rx="28" fill="#141c31"/><g transform="translate(20.8,20.8) scale(1.8)"><polygon points="26,4 12,27 21,27 19,44 36,20 26,20" fill="url(#b2)" stroke="url(#b2)" stroke-width="2.5" stroke-linejoin="round"/></g></svg>
      <div><div class="pname">TrueLive</div><div class="ptag">Truly live — the lowest possible delay</div></div>
    </div>
    <div class="plabel">MODE</div>
    <div class="seg"><span>Off</span><span>Automatic</span><span class="on">⚡ Super Live</span></div>
    <p class="pdesc">The lowest delay this stream and your internet allow — backs off by itself when needed.</p>
    <div class="prow"><span>Player indicators</span><small>▾</small></div>
  </div>
  <div class="copy">
    <h1>One switch.<br>Zero fiddling.</h1>
    <p class="sub">Pick a mode and forget it — the engine adapts to every stream on its own.</p>
    <ul>
      <li><span><b>Super Live</b> — ride the edge of the buffer, protected by 4 automatic layers</span></li>
      <li><span><b>Automatic</b> — balanced delay and stability for your connection</span></li>
      <li><span>Playback speed never drops below 1.0x — no slow-motion, no freezing</span></li>
    </ul>
  </div>
</div>
"""

# ---------- C · badge ----------
extraC = """
.badges { width:100%; max-width:900px; margin-top:56px; display:flex; flex-direction:column; gap:26px; }
.bcard { background:#101827; border:1px solid #232f4a; border-radius:14px; padding:22px 26px; display:flex; align-items:center; justify-content:space-between; }
.chip { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:22px; background:#0a111f; border:1px solid #2a3550; border-radius:8px; padding:10px 16px; color:#c8d4ea; }
.chip .v { color:#4d8dff; font-weight:700; }
.chip.warn { background:#2b2110; border-color:#7a5a1c; color:#f5d9a0; }
.chip.warn .v { color:#ffc453; }
.bwhat { font-size:19px; color:#8fa1c4; text-align:right; }
.bwhat b { color:#c8d4ea; display:block; font-size:20px; }
"""
bodyC = """
<div class="stage">
  <h1>Your real delay, <span class="accent">measured</span>.</h1>
  <p class="sub">An optional badge in the player — always visible, never in the way</p>
  <div class="badges">
    <div class="bcard">
      <span class="chip">⚡ <span class="v">2.9s</span></span>
      <div class="bwhat"><b>At rest</b>just the number that matters</div>
    </div>
    <div class="bcard">
      <span class="chip">⚡ delay <span class="v">2.9s</span> · reserve <span class="v">2.0s</span></span>
      <div class="bwhat"><b>On hover</b>full detail: delay + safety reserve</div>
    </div>
    <div class="bcard">
      <span class="chip warn">⚡ delay <span class="v">3.4s</span> · reserve <span class="v">1.1s</span></span>
      <div class="bwhat"><b>Alert</b>amber when the reserve runs thin</div>
    </div>
  </div>
  <p class="sub" style="font-size:20px; margin-top:44px; color:#66779b;">Honest by design: the badge also shows the estimated floor of the stream you're watching.</p>
</div>
"""

# ---------- D · edge-riding ----------
extraD = """
.diagram { width:100%; max-width:1000px; margin-top:60px; }
.track { position:relative; height:56px; background:#161f36; border-radius:12px; overflow:visible; }
.buffered { position:absolute; left:0; top:0; bottom:0; width:86%; border-radius:12px; background:linear-gradient(90deg,#1b2b4d,#2563eb); }
.playhead { position:absolute; left:82%; top:-14px; bottom:-14px; width:5px; background:#fff; border-radius:3px; box-shadow:0 0 18px rgba(255,255,255,.7); }
.phlabel { position:absolute; left:82%; top:-58px; transform:translateX(-50%); font-size:18px; color:#fff; font-weight:600; white-space:nowrap; }
.livemark { position:absolute; right:0; top:-58px; font-size:18px; color:#ff5d5d; font-weight:700; letter-spacing:.06em; }
.livetick { position:absolute; right:0; top:-14px; bottom:-14px; width:5px; background:#ff5d5d; border-radius:3px; opacity:.9; }
.scale { display:flex; justify-content:space-between; margin-top:22px; font-size:17px; color:#66779b; }
.vs { margin-top:64px; display:grid; grid-template-columns:1fr 1fr; gap:22px; max-width:1000px; width:100%; }
.vcard { border-radius:14px; padding:24px 28px; font-size:20px; line-height:1.5; }
.vcard.them { background:#141b2c; border:1px solid #232f4a; color:#8fa1c4; }
.vcard.us { background:#12203f; border:1px solid #2f5cc0; color:#dce7fb; }
.vcard b { display:block; margin-bottom:6px; font-size:21px; }
.vcard.them b { color:#c8d4ea; }
.vcard.us b { color:#82b4ff; }
"""
bodyD = """
<div class="stage">
  <h1>It doesn't speed up. It <span class="accent">rides the edge</span>.</h1>
  <div class="diagram">
    <div class="track">
      <div class="buffered"></div>
      <div class="playhead"></div>
      <div class="phlabel">you are here</div>
      <div class="livetick"></div>
      <div class="livemark">LIVE</div>
    </div>
    <div class="scale"><span>already downloaded on your machine</span><span>true broadcast edge</span></div>
  </div>
  <div class="vs">
    <div class="vcard them"><b>Other extensions</b>speed up playback (1.25x) and hope the buffer holds.</div>
    <div class="vcard us"><b>TrueLive</b>repositions the playhead at the edge of the downloaded buffer — with automatic stall protection.</div>
  </div>
</div>
"""

# ---------- E · privacy ----------
extraE = """
.grid { margin-top:60px; display:grid; grid-template-columns:repeat(2, 440px); gap:22px; }
.pcard { background:#101827; border:1px solid #232f4a; border-radius:14px; padding:26px 30px; }
.pcard b { font-size:22px; color:#f2f5fb; display:block; margin-bottom:6px; }
.pcard span { font-size:18px; color:#8fa1c4; line-height:1.5; }
.gpl { margin-top:44px; font-size:20px; color:#66779b; }
.gpl a { color:#4d8dff; }
"""
bodyE = """
<div class="stage">
  <h1>Nothing leaves your <span class="accent">browser</span>.</h1>
  <p class="sub">Everything runs locally — the engine, the measurements, all of it</p>
  <div class="grid">
    <div class="pcard"><b>No data collection</b><span>Zero analytics, zero tracking, zero telemetry.</span></div>
    <div class="pcard"><b>No external requests</b><span>The extension never phones home. Ever.</span></div>
    <div class="pcard"><b>No sign-up</b><span>Install, open a live stream, done.</span></div>
    <div class="pcard"><b>Open source · GPL-3.0</b><span>Every line auditable on GitHub. Free forever.</span></div>
  </div>
</div>
"""

for name, body, extra in [("a-hero", bodyA, extraA), ("b-modes", bodyB, extraB), ("c-badge", bodyC, extraC), ("d-edge", bodyD, extraD), ("e-privacy", bodyE, extraE)]:
    with open(os.path.join(BASE, name + ".html"), "w") as f:
        f.write(page(body, extra))
    print("wrote", name)
