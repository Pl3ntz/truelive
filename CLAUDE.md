# TrueLive — contrato operacional do projeto

Extensão Chrome MV3 + Firefox que reduz o delay de lives do YouTube ao mínimo
que a transmissão e a internet do usuário permitem. Autor: Vitor Plentz (solo).
Fork GPL-3.0 do ZeroDelay, reescrito — atribuição confinada a
THIRD-PARTY-NOTICES.md. Contexto completo da construção: `docs/SESSION-LOG.md`.

## Leis do produto (decisões do Owner — NÃO violar)

1. **Adaptação total:** tudo se adapta ao que a internet do usuário permite; a
   experiência de assistir nunca é sacrificada por latência.
2. **Velocidade NUNCA abaixo de 1,0x ao vivo.** O freio 0,92x foi removido; a
   zona de perigo usa resgate instantâneo (recuo único do playhead). Não
   reintroduzir slow-down.
3. **Régua honesta:** nosso 3,2s é medido da INGESTÃO à tela; o ~3-5s da TV
   aberta é do ESTÁDIO à tela. Claim permitido: "território da TV aberta" —
   NUNCA "mais rápido que a TV" ou "à frente".
4. **Zero emojis** em qualquer superfície (código, UI, docs, site). Ícones =
   SVG inline.
5. **Sem âncora em futebol:** o produto é pra QUALQUER live (show, gameplay,
   lançamento, notícia). CazéTV/Copa = no máximo um exemplo medido por doc.
6. **Textos com voz humana** (sem cara de IA) e revisados — pt-BR passa pelo
   ortografia-reviewer, EN pelo grammar-reviewer.
7. **Zero coleta na extensão** (nenhuma requisição externa). O site usa só
   Umami self-hosted (anônimo, sem cookies) — e isso está declarado no FAQ.

## Arquitetura

- `engine/controller.js` — matemática de catch-up Automático (unit-tested)
- `engine/edge.js` — governador v2 do Super Ao Vivo (unit-tested): piso por
  drawdown de CHEGADA de segmentos (NetEQ), janela que expira (BBR
  win_minmax), rate sigmoide ≥1,0x quantizada 0,05 (hls.js), dead-band +
  buffer-first (LoL+), alvo dinâmico (Shaka), soft-reset em troca de
  qualidade. Estudo com fontes: docs/RESEARCH.md ("Motor v2")
- `inject.js` — wiring no MAIN world: liga o governador ao player, resgate
  de emergência, suspensão→Automático, badge de delay real
  (`getProgressState().ingestionTime`, não documentado, validado empiricamente)
- `content.js` — ponte storage→página (CustomEvents `_live_catch_up_*`)
- `popup.js/html/css` — UI (segmented off/auto/edge, doações PIX)
- `pix.js` — BR Code EMV local (chave aleatória do Owner; valor livre = sem campo 54)
- `site/` — landing truelive.vitorplentz.com.br (pt-BR + /en/), design
  dark-premium, corrida do gol animada, selo Beta
- `scripts/deploy-site.mjs` — deploy do site: cache-bust por hash + gate
  estrutural PT×EN; **ordem: assets ANTES dos HTMLs** (senão o Cloudflare
  cacheia asset velho sob hash novo — já aconteceu 2x)

## Comandos

```bash
npm test              # 40 testes (motores, PIX, presets)
npm run validate      # manifests + arquivos embarcados
npm run check:locales # 4 locales íntegros
npm run build         # build/truelive-<versão>.zip (Chrome)
npm run build:firefox # dist/firefox (zipar pra AMO)
node scripts/deploy-site.mjs  # site: hashes + gate + imprime os scp
```

## Estado das lojas (2026-07-02)

- **Chrome Web Store:** item `hoihhfamhfmnnldkdllmemehhbcogkna`, "Revisão
  pendente", publica automático pós-review. Publisher `89a24945-…` (Vitor
  Plentz, não-negociante EEE, email verificado).
- **Firefox AMO:** slug `truelive`, "Awaiting Review" (~24h). URL futura:
  addons.mozilla.org/firefox/addon/truelive/. Conta Mozilla com 2FA do Owner.
- **Pós-aprovação (pendente):** trocar os botões "em breve na loja" da landing
  pelos links reais; atualizar README/INSTALL; divulgação (ângulo genérico de
  live + caso Copa/CazéTV pra imprensa — publishing/CHECKLIST.md).

## Gotchas aprendidos (não re-tropeçar)

- CWS: `description` do manifest ≤ **132 chars POR locale** (rejeita com 133).
- CWS: PNG de screenshot/ícone tem que ser **sem canal alfa** (RGB).
- Arquivo novo embarcado na extensão entra em **4 lugares**: manifest.json,
  manifest.firefox.json, content.js (se injetado) E as listas hardcoded de
  `scripts/build.mjs` + `scripts/build-firefox.cjs` — o `npm run validate`
  confere manifests×disco, mas NÃO confere as listas de build (quase shipou
  zip sem engine/edge.js na v1.1.0).
- AMO: `author` no manifest tem que ser **string** (objeto = erro no linter).
- YouTube quantiza playbackRate custom (0,92→0,90) — por isso o read-back em
  `apply_playback_rate` é obrigatório.
- Stream de "latência normal" tem piso ~10s+ que NENHUMA extensão fura — a
  expectativa por classe de latência precisa estar explícita em todo claim.
- VPS: o Caddyfile é bind-mount **read-only preso por inode** — mudança de
  vhost = editar `/srv/infra/Caddyfile` no host (in-place, sem trocar inode)
  + `docker restart caddy`. Site é servido de `/srv/sites/truelive`.
- Umami do site: website_id `09e3c322-9299-4694-9ace-4d0268e81416`
  (analytics.vitorplentz.com.br; filtra bots server-side).

## Roadmap

1. **TV (spike validado 2026-07-02):** `youtube.com/tv` com UA de Smart TV
   expõe TODAS as APIs do motor (`setPlaybackRate`, `getProgressState`,
   `getStatsForNerds`, `seekTo`) e o content script já casa com o host.
   Arquitetura decidida: app Android TV + **GeckoView** (suporta WebExtensions;
   login funciona, diferente de WebView) carregando /tv; distribuição sideload
   (Play Store deve recusar por ToS do YouTube). Próximo passo: spike 2 numa
   live logada (validar `ingestionTime` no /tv) antes de criar `truelive-tv`.
2. Re-medição ao vivo do benchmark competitivo com o motor v2 — o 3,16s do
   benchmark foi com o motor v1; docs/DELAY-BENCHMARK.md declara a lacuna.
3. ~~Extrair o motor edge pra `engine/` com testes formais~~ — FEITO na
   v1.1.0 (`engine/edge.js` + `test/edge.test.mjs`).
4. Twitch/Kick; doação internacional (Ko-fi) se surgir demanda gringa.
5. Opcional (decisão de produto pendente): toggle "priorizar velocidade"
   que limita a qualidade via `setPlaybackQualityRange` pra quem aceita
   1080p em troca do menor delay possível.
