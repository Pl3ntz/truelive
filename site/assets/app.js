// TrueLive — landing. © 2026 Vitor Plentz — GPL-3.0
// CSP do servidor: script-src 'self' — todo JS vive aqui, nada inline.

// Tabs de instalação (um painel por navegador)
const tabs = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        tabs.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
        panels.forEach(p => { p.hidden = p.id !== btn.dataset.panel; });
    });
});

// Copia e cola do PIX (código embutido no atributo data-code)
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
