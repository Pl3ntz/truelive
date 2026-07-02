// TrueLive — landing. © 2026 Vitor Plentz — GPL-3.0
// CSP do servidor: script-src 'self' — todo JS vive aqui, nada inline.
// Padrão de performance: JS só DETECTA (IntersectionObserver / relógio);
// quem anima é o CSS (transform/opacity, thread do compositor).

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Formato numérico segue o idioma da página (pt-BR usa vírgula decimal).
const decimalComma = (document.documentElement.lang || '').toLowerCase().startsWith('pt');
const fmt = (n, decimals) => {
    const s = n.toFixed(decimals);
    return decimalComma ? s.replace('.', ',') : s;
};

// ------------------------------------------------------------- tabs install
const tabs = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        tabs.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
        panels.forEach(p => { p.hidden = p.id !== btn.dataset.panel; });
    });
});

// ------------------------------------------------------------- copiar PIX
const copyBtn = document.querySelector('.copy-pix');
if (copyBtn) {
    const original = copyBtn.textContent;
    let timer;
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(copyBtn.dataset.code).then(() => {
            copyBtn.textContent = copyBtn.dataset.done;
            copyBtn.classList.add('done');
            clearTimeout(timer);
            timer = setTimeout(() => {
                copyBtn.textContent = original;
                copyBtn.classList.remove('done');
            }, 2500);
        });
    });
}

// ------------------------------------------------------------- scroll reveal
// JS adiciona a classe; o CSS anima. Revela uma vez só (sem re-esconder).
const revealObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (e.isIntersecting) {
            e.target.classList.add('in-view');
            revealObserver.unobserve(e.target);
        }
    }
}, { threshold: 0.18 });

document.querySelectorAll('.reveal, .bars').forEach(el => revealObserver.observe(el));

// ------------------------------------------------------------- count-up
// Números sobem quando entram na tela (barras do comparativo).
function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const decimals = (el.dataset.count.split('.')[1] || '').length;
    const dur = 900;
    const t0 = performance.now();
    function frame(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + fmt(target * eased, decimals) + suffix;
        if (p < 1) requestAnimationFrame(frame);
    }
    if (reducedMotion) {
        el.textContent = prefix + fmt(target, decimals) + suffix;
        return;
    }
    requestAnimationFrame(frame);
}

const countObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (e.isIntersecting) {
            countUp(e.target);
            countObserver.unobserve(e.target);
        }
    }
}, { threshold: 0.6 });

document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

// ------------------------------------------------------------- corrida do gol
// Simulação em tempo real: o gol acontece em t=0; cada "tela" recebe no seu
// delay medido (data-delay em segundos). Roda em loop enquanto visível.
const race = document.querySelector('.race');
if (race) {
    const clock = race.querySelector('.race-clock');
    const event = race.querySelector('.race-event');
    const lanes = [...race.querySelectorAll('.lane')];
    const END = Math.max(...lanes.map(l => parseFloat(l.dataset.delay))) + 3.5;
    let start = null;
    let raf = null;
    let visible = false;

    // barra de progresso de cada lane cresce durante o delay dela
    lanes.forEach(l => {
        l.querySelector('.lane-screen').style.setProperty('--lane-delay', l.dataset.delay + 's');
    });

    function reset() {
        race.classList.remove('running');
        event.classList.remove('fired');
        lanes.forEach(l => l.classList.remove('scored'));
        clock.textContent = fmt(0, 1) + 's';
        // reflow pra reiniciar as transições das barras no próximo loop
        void race.offsetWidth;
    }

    function tick(now) {
        if (!start) start = now;
        const t = (now - start) / 1000;
        if (t < 0.9) {
            clock.textContent = fmt(0, 1) + 's';
        } else {
            const rt = t - 0.9; // 0,9s de "respiro" antes do gol
            clock.textContent = fmt(rt, 1) + 's';
            if (!event.classList.contains('fired')) {
                event.classList.add('fired');
                race.classList.add('running');
            }
            for (const l of lanes) {
                if (!l.classList.contains('scored') && rt >= parseFloat(l.dataset.delay)) {
                    l.classList.add('scored');
                }
            }
            if (rt >= END) {
                start = null;
                reset();
            }
        }
        if (visible) raf = requestAnimationFrame(tick);
    }

    if (reducedMotion) {
        // sem movimento: estado final estático, tudo marcado
        event.classList.add('fired');
        lanes.forEach(l => l.classList.add('scored'));
        clock.textContent = '';
    } else {
        // roda só quando visível (economia de bateria em mobile)
        new IntersectionObserver(entries => {
            for (const e of entries) {
                visible = e.isIntersecting;
                if (visible && raf === null) {
                    raf = requestAnimationFrame(tick);
                } else if (!visible && raf !== null) {
                    cancelAnimationFrame(raf);
                    raf = null;
                    start = null;
                    reset();
                }
            }
        }, { threshold: 0.25 }).observe(race);
    }
}

// ------------------------------------------------------------- badge demo
// Réplica do badge do player: delay caindo de 7,0s até 3,2s, em loop suave.
// Mesmo gate de viewport da corrida (review): rAF só roda com o badge visível.
const badgeVal = document.querySelector('.badge-pill .val');
if (badgeVal && !reducedMotion) {
    const FROM = 7.0, TO = 3.2, FALL = 6000, HOLD = 2600;
    let t0 = null;
    let badgeRaf = null;
    let badgeVisible = false;
    function badgeTick(now) {
        if (!t0) t0 = now;
        const t = now - t0;
        if (t < FALL) {
            const p = 1 - Math.pow(1 - t / FALL, 2);
            badgeVal.textContent = fmt(FROM - (FROM - TO) * p, 1) + 's';
        } else if (t < FALL + HOLD) {
            badgeVal.textContent = fmt(TO, 1) + 's';
        } else {
            t0 = now;
        }
        if (badgeVisible) badgeRaf = requestAnimationFrame(badgeTick);
    }
    new IntersectionObserver(entries => {
        for (const e of entries) {
            badgeVisible = e.isIntersecting;
            if (badgeVisible && badgeRaf === null) {
                badgeRaf = requestAnimationFrame(badgeTick);
            } else if (!badgeVisible && badgeRaf !== null) {
                cancelAnimationFrame(badgeRaf);
                badgeRaf = null;
                t0 = null;
            }
        }
    }, { threshold: 0.3 }).observe(badgeVal.closest('.badge-demo'));
}
