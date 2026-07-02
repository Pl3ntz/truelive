# Benchmark de delay — TrueLive vs concorrentes

> Gerado em 2026-07-02 por análise multi-agente (42 agents: levantamento em 4
> frentes → verificação adversarial de cada número → síntese). Todo valor
> carrega método, fonte e nível de confiança; claims de marketing sem medição
> independente foram rebaixados ou descartados.

## Comparação de delay

Delays absolutos medidos/derivados são **ingest→espectador** (método `ingestionTime`), válidos para streams do YouTube em modo *low-latency* — a mesma classe usada nos benchmarks. Linhas marcadas com † usam outra referência (estádio ou TV aberta) e não são diretamente somáveis com as demais.

| Como assiste | Delay | Como foi comprovado | Confiança |
|---|---|---|---|
| **TrueLive — Super Ao Vivo (edge-riding)** | **3,16s** (medido, reserva 1,6s — piso antigo) | Benchmark A/B/C controlado, mesma máquina/stream esports, via `ingestionTime` [1] | MEDIUM |
| Edge-riding @ 1,75s de headroom (validação R&D) | 3,1–3,6s | Medido ao vivo, 40s sem stalls, live Lofi Girl [2] | MEDIUM |
| **TrueLive — Super Ao Vivo (config atual, piso 2,0s)** | **~3,5–3,6s** (esperado, não re-medido) | Derivado do código (`EDGE_ABS_FLOOR=2.0`) + componente fixo medido ≈1,56s [3] | HIGH |
| live-catch-up, modo smooth opt-in (stream ultra-low) | 3,3–3,9s (não medido ponta-a-ponta) | Derivado do código (threshold 2×segduration) + offset medido [4] | HIGH* |
| TV aberta digital ISDB-Tb (vs estádio) † | ~3–5s | Estimativas convergentes de imprensa/indústria (Copa 2026) [5] | MEDIUM |
| YouTube nativo — Ultra-low latency | <5s (doc oficial); 2–5s | Doc do YouTube + secundárias derivativas, sem medição independente [6] | MEDIUM |
| TrueLive — pós-instabilidade (piso travado 2,5s por 3min) | ~4,0–4,1s (esperado) | Derivado do código (`inject.js:271`) + componente fixo medido [3] | HIGH |
| live-catch-up, smooth com threshold manual 3,0s | 4,3–4,9s (não medido) | Derivado do código + offset medido [4] | HIGH* |
| ZeroDelay upstream (catch-up 1.25x, buffer 3,5s) | **4,49s**, serrilhado 3,2–6,7s, 10 micro-stalls/28s | Benchmark A/B/C, mesma máquina/stream [1] | MEDIUM |
| ZeroDelay — modo Latência Mínima | 4,8–6,8s | Derivado do código (buffer 3,5s + histerese 1,5s) + offset medido; cross-check ~4,8s [7] | MEDIUM |
| live-catch-up, smooth auto (stream low) | ~5–7s | Derivado do código (threshold 4,0s) + oscilação de segmento [4] | MEDIUM |
| ZeroDelay — modo Próximo | 5,8–7,85s | Derivado do código (buffer 4,5s) + offset medido [7] | MEDIUM |
| YouTube nativo — live head padrão (sem extensão) | **6,99s** (esports) / **7,3s** (Lofi Girl) | Medido ao vivo via `ingestionTime` [1][2] | HIGH/MEDIUM |
| live-catch-up — configuração default | = live head nativo (ganho steady-state 0; só elimina atraso acumulado) | Derivado do código (`smooth=false` → 1.0x no live head) [4] | HIGH |
| ZeroDelay — modo Automático (default) e Equilibrado | 7,3–9,3s (faixa adaptativa do auto: 5,3–12,35s) | Derivado do código (buffer 6,0–7,5s) + offset medido [7] | HIGH |
| ZeroDelay — modo Suave | 9,3–11,35s | Derivado do código (buffer 8,0–9,5s) + offset medido [7] | MEDIUM |
| YouTube nativo — Low latency | <10s (doc oficial); secundárias ~5–20s | Doc do YouTube, sem medição independente [6] | MEDIUM |
| live-catch-up, smooth auto (stream latência normal) | 11,3–11,9s (piso de regime) | Derivado do código (threshold 10,0s) + offset medido [4] | HIGH |
| Streaming HLS/DASH padrão (baseline da indústria) | 10–30s | Doc de engenharia de vendor (Mux/Wowza), sem medição independente [8] | MEDIUM |
| YouTube nativo — Normal latency | 15–60s+ | Guias secundários (doc oficial não dá número) [9] | MEDIUM |
| CazéTV (YouTube) vs TV aberta, Copa 2026 † | +15–20s atrás da Globo | Medição independente da Canaltech (cronômetro do jogo, abertura da Copa) [10] | HIGH |

\* HIGH na fidelidade da derivação de código; o número ponta-a-ponta nunca foi medido nessa configuração (transferência do offset entre classes de latência é extrapolação).

**Fundamento de todas as derivações:** delay ≈ buffer mantido + offset playhead→ingest de **1,3–1,85s** (medido: 3,1–3,6s @ headroom 1,75s; piso de pipeline ingest→CDN ~1,3s) [2] — MEDIUM (1 stream, 1 conexão).

**Piso físico:** edge-riding a 0,75s de headroom atinge 2,38s por instantes, mas stalla em ~10s e termina em ~5,3s **permanente** — pior que não tentar. Piso prático de headroom: ~1,5–2s [2]. Por isso o TrueLive trava a reserva em 2,0s (`EDGE_ABS_FLOOR`), sobe para 2,5s após instabilidade, e suspende o edge-riding por 10min após 2 stalls em 5min [3].

**Concorrentes sem número de delay declarado:** YouTube Live Stream Latency Mitigator (yudai, ~10.000 usuários — aceleração de playback, exibe delay mas não promete número) [11]; YouTube Live Chat Anti-lag (57 usuários — threshold configurável 1–30s, único com snap-to-edge além do TrueLive) [12]; Tool For YouTube Live Streams Enhancer (159 usuários — só catch-up) [13]. Nenhum concorrente pesquisado usa reposicionamento direto do playhead (edge-riding).

**Claims de marketing NÃO usados como medição:** ZeroDelay "reduz até 80%" é promessa do desenvolvedor repetida pela imprensa, sem qualquer teste independente — a redução medida real (nesta base) é 6,99s→3,16s ≈ **55%** [1][14]. Delay Off "45s→~6s" é autorreportado no README, sem metodologia, extensão não publicada em loja [15]. Workaround manual de 2x na CazéTV rende ~5s de ganho (teste Canaltech) [16].

### Metodologia

Medições próprias usam latência fim-a-fim **ingest→olho**: `latência = Date.now()/1000 − getProgressState().ingestionTime`, no Chrome real, mesma máquina e mesma stream para todas as condições comparadas (benchmark A/B/C: extensão OFF vs upstream ZeroDelay vs TrueLive). Valores "derivados do código" combinam constantes lidas no código-fonte real (commits fixados) com o offset medido de 1,3–1,85s. Confiança: **HIGH** = 3+ fontes independentes ou medição/derivação própria reproduzível confirmada; **MEDIUM** = 2 fontes ou medição própria de sessão única (n=1 stream/conexão); **LOW** = fonte única ou claim de marketing sem medição independente. `ingestionTime` é um campo não documentado do player, validado apenas empiricamente (auto-consistente entre experimentos).

### Fontes

1. `docs/RESEARCH.md:78-88` — benchmark A/B/C (2026-07-02, mesma máquina/stream esports): 6,99s OFF · 4,49s upstream · 3,16s TrueLive
2. `zerodelay-test/EDGE-RIDING-FINDINGS.md` (2026-07-02) — 7,3s live head padrão (:16), ~4,8s equivalente modo mínimo (:17), 3,1–3,6s @ 1,75s (:18), falha @ 0,75s → 5,3s permanente (:19), estrutura do piso (:29-33)
3. `inject.js` (TrueLive): `EDGE_ABS_FLOOR=2.0` (:209), `EDGE_START=2.75` (:213), `EDGE_DANGER=1.5` (:216-217), `EDGE_RESCUE_TO=2.5` (:218), suspensão 2 stalls/5min → 10min (:224-226), piso dinâmico (:269-271)
4. github.com/yudai-tiny-developer/live-catch-up @ 663b128 (v1.24.1, 2026-06-01): `inject.js:102-116,129-146,280`; `common.js:24,35,37,42`
5. https://98fmnatal.com.br/brasil/entenda-a-diferenca-de-delay-entre-tv-aberta-e-streaming-na-copa/343053/ · https://set.org.br/set-news/guerra-do-delay-nas-transmissoes-da-copa-do-mundo/ (medição relativa: UHF +0 / satélite +2s / streaming +11s)
6. https://support.google.com/youtube/answer/7444635 (doc oficial: <5s ultra-low, <10s low)
7. github.com/joaogfc/ZeroDelay @ a347b3e: `common.js:210,226-227,260,268,276,284`; `engine/controller.js:25,28-29,37,50-55,71,74-75,84`
8. https://www.mux.com/articles/low-latency-video-streaming-a-complete-guide-with-definitions-examples-and-more (Standard Latency 10–30s)
9. https://ytstreamer.com/live-stream-latency/
10. https://canaltech.com.br/entretenimento/delay-da-cazetv-na-copa-chega-a-ser-o-dobro-do-globoplay-canaltech-testou/ · https://www.lance.com.br/fora-de-campo/sbt-globo-e-cazetv-veja-como-foi-a-guerra-do-delay-na-abertura-da-copa.html
11. https://chromewebstore.google.com/detail/youtube-live-stream-laten/ambdnabnehojedeaffciphbmfhfmfmjp · https://addons.mozilla.org/en-US/firefox/addon/youtube-live-stream-laten/
12. https://chromewebstore.google.com/detail/youtube-live-chat-anti-la/eohdkaimocmdkglfdjdpmnmlihhfahkl
13. https://chromewebstore.google.com/detail/tool-for-youtube-live-str/dfeniajjphaklaamhmjefjmkfcjegbil
14. https://exame.com/inteligencia-artificial/cansado-do-atraso-na-cazetv-ele-driblou-o-delay-criando-uma-extensao-no-chrome/ · https://busaocuritiba.com/zerodelay-extensao-criada-por-brasileiro-promete-reduzir-em-ate-80-o-delay-da-cazetv-no-youtube/ · https://chromewebstore.google.com/detail/zerodelay/gblbnnkemjblakamnbclcehoaobnhlpm
15. https://github.com/ipsbruno3/youtube-delay-off
16. https://canaltech.com.br/internet/colocar-jogo-da-copa-em-velocidade-2x-elimina-o-delay-da-cazetv/

### Lacunas

- **Re-medição ao vivo com o piso novo (2,0s):** o 3,16s do benchmark foi medido com reserva 1,6s (anterior à subida do piso). O valor esperado ~3,5–3,6s da config atual é derivação de código, ainda não confirmado ao vivo.
- **Generalização do offset 1,3–1,85s:** medido em 1 stream low-latency, 1 conexão, janelas de 30–40s. Falta medir em streams ultra-low e latência normal (a quantização de segmento pode aumentar o offset) e em conexões instáveis.
- **live-catch-up nunca medido ponta-a-ponta:** todas as faixas dele são código + offset transferido de experimento com outro método; os números exatos exigem medição empírica.
- **YouTube Normal latency sem número oficial:** a faixa 15–60s+ vem de ~2 linhagens de guias secundários que divergem no piso (15s vs 30s).
- **Citações quebradas corrigidas:** referências antigas a `RESEARCH.md:20-22` em `zerodelay-test/` apontavam para arquivo inexistente; a fonte válida é `EDGE-RIDING-FINDINGS.md` (o `docs/RESEARCH.md` do repo truelive é documento distinto e válido).
- **Nenhum claim foi refutado** na verificação adversarial; os rebaixamentos foram de sourcing (números de imprensa atribuídos a listing errado, "80%" sem medição, arredondamentos de 0,05–0,35s nos tetos das faixas do ZeroDelay).