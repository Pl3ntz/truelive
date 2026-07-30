// Coletor de metricas publicas do TrueLive.
//
// Puxa TUDO que da pra ler sem credencial (loja Chrome, AMO, GitHub) e anexa
// uma linha ao historico. O ponto nao e o snapshot, e a TENDENCIA: com base
// pequena, um numero isolado nao diz nada, a direcao entre duas coletas diz.
//
// O que este script NAO alcanca, e precisa de voce:
//   - CWS Dashboard (impressoes, instalacoes, DESINSTALACOES, usuarios semanais)
//     Nao ha API nem leitura publica; exporte o CSV do painel.
//   - Umami do site (visitas, origem, conversao dos CTAs)
//     Tem API; gere um link de compartilhamento somente leitura.
//
// Uso:  node scripts/metrics.mjs          coleta e mostra a variacao
//       node scripts/metrics.mjs --show   so mostra o historico, sem coletar

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const HISTORY = join(root, 'docs', 'metrics-history.jsonl');
const CWS_ID = 'hoihhfamhfmnnldkdllmemehhbcogkna';
const REPO = 'Pl3ntz/truelive';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Toda coleta e best-effort: uma fonte fora do ar vira null, nunca derruba o
// resto. Metrica que falha em silencio e pior que metrica ausente, entao o
// motivo do null vai junto em `erros`.
const erros = [];
async function tentar(nome, fn) {
    try { return await fn(); } catch (e) { erros.push(`${nome}: ${e.message}`); return null; }
}

async function chromeWebStore() {
    const r = await fetch(`https://chromewebstore.google.com/detail/${CWS_ID}?hl=pt-BR`,
        { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    // Scraping de HTML e fragil por natureza: o Google pode mudar o markup a
    // qualquer momento. Por isso cada campo cai pra null sozinho em vez de
    // quebrar a coleta inteira, e a versao serve de canario (se ela sumir, o
    // seletor provavelmente mudou).
    const num = s => { const m = html.match(s); return m ? Number(m[1].replace(/[.,]/g, '')) : null; };
    return {
        usuarios: num(/([\d.,]+)\s*usuários/),
        avaliacoes: num(/([\d.,]+)\s*(?:nota|avaliaç)/),
        versao: (html.match(/"(\d+\.\d+\.\d+)"/) || [])[1] ?? null,
    };
}

async function amo() {
    const r = await fetch('https://addons.mozilla.org/api/v5/addons/addon/truelive/');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return {
        usuarios_dia: d.average_daily_users ?? null,
        downloads_semana: d.weekly_downloads ?? null,
        avaliacoes: d.ratings?.count ?? null,
        nota: d.ratings?.average ?? null,
        versao: d.current_version?.version ?? null,
    };
}

function gh(args) {
    return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

async function github() {
    const releases = gh(['api', `repos/${REPO}/releases`, '--jq',
        '[.[] | {tag: .tag_name, downloads: ([.assets[].download_count] | add // 0)}]']);
    const views = gh(['api', `repos/${REPO}/traffic/views`, '--jq', '{count, uniques}']);
    const stars = gh(['api', `repos/${REPO}`, '--jq', '.stargazers_count']);
    return {
        downloads_total: releases.reduce((s, r) => s + r.downloads, 0),
        por_release: Object.fromEntries(releases.map(r => [r.tag, r.downloads])),
        views_14d: views.count,
        views_unicos_14d: views.uniques,
        stars,
    };
}

function ler() {
    if (!existsSync(HISTORY)) return [];
    return readFileSync(HISTORY, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

// Sem delta anterior o valor aparece sozinho: "primeira coleta" e informacao,
// "+0" seria mentira.
function delta(atual, anterior) {
    if (atual == null) return '  --';
    if (anterior == null || anterior[0] == null) return `  ${atual}`;
    const d = atual - anterior[0];
    return `  ${atual}` + (d === 0 ? ' (=)' : ` (${d > 0 ? '+' : ''}${d})`);
}

function mostrar(hist) {
    if (!hist.length) return console.log('Sem historico ainda.');
    const u = hist.at(-1);
    const p = hist.length > 1 ? hist.at(-2) : null;
    const cmp = (cur, path) => delta(cur, p ? [path.split('.').reduce((o, k) => o?.[k], p)] : null);

    console.log(`\nColeta: ${u.data}   (${hist.length} no historico)`);
    console.log('\n  CHROME WEB STORE');
    console.log('    usuarios          ' + cmp(u.chrome?.usuarios, 'chrome.usuarios'));
    console.log('    avaliacoes        ' + cmp(u.chrome?.avaliacoes, 'chrome.avaliacoes'));
    console.log('    versao no ar        ' + (u.chrome?.versao ?? '--'));
    console.log('\n  FIREFOX AMO');
    console.log('    usuarios/dia      ' + cmp(u.amo?.usuarios_dia, 'amo.usuarios_dia'));
    console.log('    downloads/semana  ' + cmp(u.amo?.downloads_semana, 'amo.downloads_semana'));
    console.log('    versao no ar        ' + (u.amo?.versao ?? '--'));
    console.log('\n  GITHUB');
    console.log('    downloads total   ' + cmp(u.github?.downloads_total, 'github.downloads_total'));
    console.log('    views (14d)       ' + cmp(u.github?.views_14d, 'github.views_14d'));
    console.log('    stars             ' + cmp(u.github?.stars, 'github.stars'));

    console.log('\n  FALTA (precisa de acesso seu)');
    console.log('    CWS Dashboard: impressoes, instalacoes, DESINSTALACOES, usuarios semanais');
    console.log('    Umami: visitas, origem do trafego, conversao dos CTAs');
    console.log('\n  A pergunta "o produto e bom?" mora em desinstalacoes/instalacoes.');
    console.log('  Nenhuma fonte publica expoe isso: so o painel da loja.\n');
    if (u.erros?.length) console.log('  Erros nesta coleta:\n    ' + u.erros.join('\n    ') + '\n');
}

const hist = ler();
if (process.argv.includes('--show')) {
    mostrar(hist);
} else {
    const [chrome, amoData, githubData] = await Promise.all([
        tentar('chrome', chromeWebStore),
        tentar('amo', amo),
        tentar('github', github),
    ]);
    const linha = {
        data: new Date().toISOString().slice(0, 10),
        chrome, amo: amoData, github: githubData,
        erros: erros.length ? erros : undefined,
    };
    mkdirSync(dirname(HISTORY), { recursive: true });
    writeFileSync(HISTORY, [...hist, linha].map(o => JSON.stringify(o)).join('\n') + '\n');
    mostrar([...hist, linha]);
}
