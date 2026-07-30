// Publicacao automatizada na Chrome Web Store.
//
// Depois de um setup unico, cada release vira `npm run publish`, sem abrir o
// painel, sem 2FA, sem upload manual do zip.
//
// PRIMEIRA VEZ (uma vez na vida):
//   node scripts/publish-cws.mjs --auth
// Ele imprime o passo a passo e cuida da troca de codigo por refresh_token.
//
// DEPOIS, a cada versao:
//   npm run build && npm run publish
//
// As credenciais vivem em .env (fora do git). O refresh_token publica em nome
// do Owner: quem tiver o arquivo publica. Nunca comitar, nunca colar em chat.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ENV = join(root, '.env');
const ITEM_ID = 'hoihhfamhfmnnldkdllmemehhbcogkna';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
// Fluxo de app instalado: o codigo aparece na propria tela do Google e o Owner
// cola aqui. Evita subir servidor local so pra receber um redirect.
const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';

// Carrega o .env para dentro de process.env (nao sobrescreve o que ja veio do
// ambiente, pra CI poder injetar sem editar arquivo). Ler credencial de
// process.env e a convencao do Node, e tambem o que o scanner de segredos
// reconhece como leitura de configuracao em vez de valor embutido.
function carregarEnv() {
    if (!existsSync(ENV)) return;
    for (const linha of readFileSync(ENV, 'utf8').split('\n')) {
        const t = linha.trim();
        if (!t || t.startsWith('#') || !t.includes('=')) continue;
        const chave = t.slice(0, t.indexOf('=')).trim();
        const valor = t.slice(t.indexOf('=') + 1).trim();
        if (valor && !process.env[chave]) process.env[chave] = valor;
    }
}

function versao() {
    return JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).version;
}

function faltando() {
    return ['CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN']
        .filter(k => !process.env[k]);
}

async function accessToken() {
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.CWS_CLIENT_ID,
            client_secret: process.env.CWS_CLIENT_SECRET,
            refresh_token: process.env.CWS_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    });
    const d = await r.json();
    // Refresh token expira se ficar meses sem uso ou se o Owner revogar o
    // acesso: dizer isso aqui evita caçar o erro no Google depois.
    if (!r.ok) throw new Error(`token (${r.status}): ${d.error_description || d.error}. `
        + 'Se for invalid_grant, rode --auth de novo.');
    return d.access_token;
}

async function auth() {
    if (!process.env.CWS_CLIENT_ID || !process.env.CWS_CLIENT_SECRET) {
        console.log('\nFalta a credencial do Google Cloud (uma vez so, ~5 min).');
        console.log('Passo a passo: publishing/CWS-API-SETUP.md');
        console.log('O arquivo .env ja existe na raiz com as duas chaves em branco.\n');
        process.exit(1);
    }

    const url = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
        client_id: process.env.CWS_CLIENT_ID,
        redirect_uri: REDIRECT,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent',           // forca vir refresh_token, nao so access
    });
    console.log('\n1. Abra esta URL, entre com a conta dona da extensao e autorize:\n');
    console.log('   ' + url + '\n');
    console.log('2. O Google mostra um codigo na tela. Cole ele aqui.\n');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const code = (await rl.question('   Codigo: ')).trim();
    rl.close();

    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.CWS_CLIENT_ID,
            client_secret: process.env.CWS_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT,
        }),
    });
    const d = await r.json();
    if (!r.ok || !d.refresh_token) {
        throw new Error(`troca do codigo falhou (${r.status}): ${d.error_description || d.error || 'sem refresh_token'}`);
    }
    appendFileSync(ENV, `\nCWS_REFRESH_TOKEN=${d.refresh_token}\n`);
    console.log('\nOK. refresh_token gravado no .env.');
    console.log('Daqui pra frente e so:  npm run build && npm run publish\n');
}

async function publicar() {
    const falta = faltando();
    if (falta.length) {
        console.error(`Faltando no .env: ${falta.join(', ')}\nRode:  node scripts/publish-cws.mjs --auth`);
        process.exit(1);
    }

    const v = versao();
    const zip = join(root, 'build', `truelive-${v}.zip`);
    if (!existsSync(zip)) {
        console.error(`Pacote nao encontrado: build/truelive-${v}.zip\nRode antes:  npm run build`);
        process.exit(1);
    }

    const token = await accessToken();
    const bytes = readFileSync(zip);
    console.log(`Enviando truelive-${v}.zip (${(bytes.length / 1024).toFixed(0)} KB)...`);

    const up = await fetch(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${ITEM_ID}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'x-goog-api-version': '2' },
        body: bytes,
    });
    const upData = await up.json();
    if (!up.ok || upData.uploadState === 'FAILURE') {
        const det = upData.itemError?.map(x => x.error_detail).join('; ') || JSON.stringify(upData);
        throw new Error(`upload falhou: ${det}`);
    }
    console.log(`  upload: ${upData.uploadState}`);

    // Sem --publish o pacote fica em rascunho no painel. Util quando se quer
    // conferir a listagem antes de mandar pra revisao.
    if (process.argv.includes('--draft')) {
        console.log('\nRascunho enviado, NAO publicado (--draft). Publique pelo painel quando quiser.');
        return;
    }

    const pub = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${ITEM_ID}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-goog-api-version': '2', 'Content-Length': '0' },
    });
    const pubData = await pub.json();
    if (!pub.ok) throw new Error(`publish falhou: ${JSON.stringify(pubData)}`);

    console.log(`  publish: ${(pubData.status || []).join(', ') || 'OK'}`);
    if (pubData.statusDetail?.length) console.log('  ' + pubData.statusDetail.join('\n  '));
    console.log(`\nVersao ${v} enviada para revisao da Chrome Web Store.`);
    console.log('A revisao costuma levar de algumas horas a alguns dias.');
    console.log('ATENCAO: enquanto ela estiver pendente, a loja NAO aceita um novo upload.');
}

try {
    carregarEnv();
    await (process.argv.includes('--auth') ? auth() : publicar());
} catch (err) {
    console.error('\nERRO: ' + err.message);
    process.exit(1);
}
