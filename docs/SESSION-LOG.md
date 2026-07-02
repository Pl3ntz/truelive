# Diário de construção — TrueLive

Registro das sessões de trabalho (Owner + Claude) para uma futura sessão
retomar o contexto sem depender do histórico do chat.

## 2026-07-02 — Da avaliação do fork à publicação nas duas lojas (1 dia)

### Manhã — avaliação e motor
- Avaliado github.com/joaogfc/ZeroDelay; validado ao vivo no Chrome do Owner.
- Descoberto e validado o **edge-riding**: o player web guarda ~6s já baixados
  à frente do playhead; reposicionar em `buffered.end - alvo` sustenta ~3,1s de
  latência real vs 7,3s padrão. Medição fim-a-fim via
  `getProgressState().ingestionTime` (validado empiricamente).
- Fork rebatizado **TrueLive** ("o ao vivo de verdade"), repo recriado do zero
  em github.com/Pl3ntz/truelive (contribuidor único; Owner apagou o repo antigo
  pra zerar o cache de contributors do upstream).
- Motor adaptativo em 4 camadas (lei do produto: internet do usuário manda):
  piso dinâmico medido, reação preventiva, proteção de emergência, suspensão
  graciosa. Bugs de campo do Owner corrigidos (stall na CazéTV; rate preso em
  0,90x → read-back fix).

### Tarde — regras de produto e qualidade
- **Owner baniu velocidade <1,0x ao vivo** → freio 0,92x substituído por
  **resgate instantâneo** (recuo único restaurando ≥2,5s); pisos conservadores
  (2,0s físico; <2,5s só com 3min de calmaria). Réplica determinística 12/12.
- **Benchmark comprovado por workflow de 42 agents** (verificação adversarial,
  16 fontes): TrueLive 3,16s medido (~55% de redução — o "80%" de concorrente é
  marketing sem medição); nenhum concorrente usa edge-riding.
  → docs/DELAY-BENCHMARK.md
- **Régua honesta** (correção importante do Owner): nosso número é
  ingestão→tela; TV aberta é estádio→tela. Todo claim reescrito pra
  "território da TV aberta", nunca "à frente".
- Popup redesenhado (segmented + descrição progressiva), badge do player com
  visual nativo do YouTube, doações PIX R$ 5/15/25/50 + Livre (QR sem valor),
  **zero emojis** (regra do Owner; SVGs inline), selo **Beta**.
- Reviews de qualidade: code-reviewer (0 críticos; 2 MEDIUM corrigidos),
  security-reviewer 2x (apto pra loja; pacotes re-buildados pra casar com o
  fonte; CI pinada por SHA), ortografia-reviewer (8/10 "escrito por gente"),
  grammar-reviewer (calques corrigidos), ux/seo-reviewers na landing.

### Noite — site e publicação
- **Landing no ar:** truelive.vitorplentz.com.br (VPS pessoal, Caddy +
  Cloudflare; vhost com headers endurecidos). Design dark-premium (referências
  Raycast/Linear), corrida do gol em tempo real como demo, pt-BR + /en/,
  cross-platform sem overflow (360–1920), SEO completo (canonical, hreflang,
  JSON-LD, sitemap), Umami self-hosted (anônimo) com honestidade no FAQ.
  Deploy: `node scripts/deploy-site.mjs` (hash + gate PT×EN; assets→HTML).
- **Chrome Web Store: SUBMETIDO.** Conta do Owner configurada no navegador dele
  (nome, não-negociante, email verificado via link do Gmail), zip aceito após
  fix do limite de 132 chars na description, listagem + privacidade
  (zero coleta, sem código remoto) + distribuição (grátis/público/155 países).
  Status: Revisão pendente, publicação automática.
- **Firefox AMO: SUBMETIDO.** Conta Mozilla criada (2FA TOTP do Owner),
  validação 0 erros/0 warnings, listado, GPL-3.0, notas ao revisor, 3
  screenshots. Status: Awaiting Review (~24h).

### Spike TV (validado, engavetado por ora)
`youtube.com/tv` com UA de Smart TV expõe todas as APIs do motor e o content
script já casa com o host. Rota decidida: Android TV + GeckoView + sideload.
Detalhes no CLAUDE.md (Roadmap).

### Pendências ao retomar
1. Emails de aprovação das lojas → ativar botões reais na landing
   (`site/index.html` + `/en/`), atualizar README/INSTALL, divulgar
   (publishing/CHECKLIST.md).
2. Re-medir delay ao vivo com o piso 2,0s (lacuna declarada no benchmark).
3. TV: spike 2 (live logada no /tv, validar ingestionTime) → repo truelive-tv.

### Onde está cada coisa
- Repo: github.com/Pl3ntz/truelive (release v1.0.0 com os 2 zips)
- Site: truelive.vitorplentz.com.br · fonte em `site/` · VPS `/srv/sites/truelive`
- Analytics: analytics.vitorplentz.com.br → site "TrueLive"
- Benchmark: docs/DELAY-BENCHMARK.md · Pesquisa: docs/RESEARCH.md
- Publicação: publishing/ (listing, privacy, checklist, screenshots)
- Contrato operacional (leis do produto, gotchas, comandos): CLAUDE.md na raiz
