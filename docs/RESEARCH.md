# Pesquisa — edge-riding e o piso físico de latência (2026-07-02)

> Registro do R&D que fundamenta o modo Super Ao Vivo. Todos os números foram
> medidos ao vivo em Chrome real (não simulados), método descrito abaixo.

Experimentos ao vivo (Chrome real, live Lofi Girl X4VbdwhkE10, conexão doméstica
estável) sobre o limite de latência client-side no player web do YouTube (SABR).

## Medição

`getProgressState().ingestionTime` (epoch de ingestão, não documentado) →
`latência real = Date.now()/1000 - ingestionTime`. Auto-consistente em todos os
experimentos (deltas batem com as mudanças de headroom).

## Resultados

| Estratégia | Latência real | Estável? |
|---|---|---|
| Live head padrão do YouTube | 7.3s | sim (headroom ~6s) |
| ZeroDelay modo mínimo (buffer 3.5s) — equivalente estimado | ~4.8s | sim |
| **Edge-riding @ 1.75s de headroom** (nudge `v.currentTime` → `buffered.end - 1.75`) | **3.1-3.6s** | **sim — 40s, zero stalls, sem snap-back, sem re-nudge (auto-estável)** |
| Edge-riding @ 0.75s | 2.38s por instantes | **NÃO** — stall em ~10s → player retoma com 4s de colchão → latência PERMANENTE de ~5.3s (pior que não tentar) |

## Conclusões

1. **O player web segura ~6s de conteúdo JÁ BAIXADO à frente do playhead** mesmo
   "at live head" — esse é o excesso recuperável além do que rate-catch-up alcança.
2. **Método novo além do ZeroDelay:** nudge direto do playhead na timeline do
   media element (`v.currentTime = buffered.end - alvo`), não só rate 1.25x até
   buffer-alvo. Instantâneo; o rate-based continua melhor pra correção contínua
   (sem pulo audível).
3. **Piso prático ≈ 1.5-2s de headroom.** Abaixo disso: rebuffer, e cada rebuffer
   vira atraso permanente (player retoma atrás + reconstrói colchão). 0.75s é
   insustentável.
4. Estrutura do piso: ~1.3s (pipeline ingest→CDN, irremovível) + headroom mínimo
   sustentável (~1.75s) + quantização de chunk.
5. Deep-research (2026-07-02) confirma: rate+buffer é a única técnica conhecida na
   comunidade; sem evidência de punição/snap-back do YouTube (bate com o observado);
   piso absoluto = modo de latência escolhido pelo streamer.

## Caveats

- 1 stream (lofi = low-latency, piso ~7s no head padrão), 1 conexão, janelas de
  30-40s. Falta: stream de latência normal (ganho maior, piso maior), jogo real
  (CazéTV), conexão instável, janelas longas (ad-breaks, rotação de segmento).
- `ingestionTime` não tem doc oficial — validado só empiricamente.

## Implicação pra futebol (CazéTV vs TV aberta)

TV aberta ≈ 2-6s do lance. CazéTV padrão ≈ 20-45s. Com edge-riding, espectador fica
~3-4s do sinal ingerido + tempo câmera→ingest da Cazé (~1-3s, não medido) ≈
**~4-7s do lance real → paridade aproximada com a antena** SE a stream do jogo
rodar latência baixa. Não verificado em jogo real ainda.

## Próximo (se continuar)

Protótipo "modo Borda" no fork: entrar na zona via nudge + guardas do controller
existente (EMA/drain) adaptadas pra headroom 1.75s, fallback pro modo Latência
Mínima em conexão instável. Candidato a contribuição upstream no ZeroDelay.


## Evolução pós-medição (implementada)

1. **Piso dinâmico medido** — o alvo não é fixo: envelope de respiração da
   reserva (min/máx decadente) define o piso = jitter + 0,6s (base conservadora
   2,0s, subida em 2026-07-02 por decisão de produto). Descer <2,5s exige 3min
   de calmaria provada.
2. **Resgate instantâneo** (substituiu o freio 0,92x em 2026-07-02) — na zona
   de perigo (<1,5s), um único recuo do playhead restaura a reserva para
   ≥2,5s imediatamente. Regra de produto do autor: **a velocidade nunca cai
   abaixo de 1,0x ao vivo** — o freio 0,92x foi removido porque (a) sub-tempo-
   real não faz sentido assistindo ao vivo e (b) o YouTube quantizava 0,92→0,90x.
   Resgates repetidos contam para a suspensão graciosa.
3. **Suspensão graciosa** — 2 stalls/5min suspendem o edge por 10min
   (Automático governa); re-arme seguro. Máquina validada por réplica
   determinística.

## Benchmark competitivo (2026-07-02, mesma máquina/stream esports)

| Condição | Atraso real | Estabilidade |
|---|---|---|
| YouTube padrão (OFF) | 6,99s | ±0,01s, 0 stalls |
| Upstream (catch-up 1.25x, buffer 3,5s) | 4,49s | serrilhado 3,2–6,7s, 10 micro-stalls/28s |
| **TrueLive Super Ao Vivo** | **3,16s** | estável, cavalgando a 1,6s |

Nenhum concorrente pesquisado (ZeroDelay, Live Stream Latency Mitigator,
userscripts Greasyfork) usa reposicionamento direto do playhead — todos apenas
aceleram a reprodução.

## Motor v2 (2026-07-02) — redução gradual, medição por chegada

Reescrita do Super Ao Vivo após diagnóstico em campo (Copa, 4K60 51Mbps):
o v1 travava porque (a) o nudge por seek era perceptível e disparava o
próprio detector de burst-drain, zerando o relógio de calmaria; (b) o
envelope min/máx media o nível da reserva — poluído pelos nossos seeks,
pelo dreno do catch-up e pelo wipe de troca de qualidade; (c) o teto fixo
de 4,5s era menor que o déficit real de entrega do 4K (~5-7s por ciclo
goteja-rajada), gerando thrash stall→resgate→suspensão.

O v2 vive em `engine/edge.js` (unit-tested, `test/edge.test.mjs`, com o
ciclo 4K medido como caso de teste). Técnicas adotadas do estudo
comparativo (2 deep-researchers, fontes primárias com código lido):

1. **Rate sigmoide (hls.js `latency-controller.ts`)** — delay reduz SÓ por
   velocidade: `rate = 2/(1+e^(-0,75·Δ))`, clampeada ≥1,0x, quantizada em
   passos de 0,05 (a mesma grade que o YouTube impõe). Seek sobrou apenas
   no resgate de emergência — consenso hls.js/dash.js/Shaka.
2. **Dead-band + buffer-first (dash.js LoL+ `CatchupController.js`)** —
   perto do alvo (±máx(0,15s, 2%)) a rate crava 1,0; reserva fina ignora
   latência e protege o buffer.
3. **Medição por CHEGADA (WebRTC NetEQ `delay_manager`)** — o piso vem do
   drawdown máximo do fluxo líquido de chegada de segmentos
   (Σ(chegada−relógio)), imune a playhead/rate/seeks por construção.
4. **Janela que expira (BBR `lib/win_minmax.c`)** — filtro de máximo com 3
   amostras/2min: o vale de uma rendition 4K não assombra o 720p.
5. **Alvo dinâmico (Shaka `dynamicTargetLatency`)** — incidente afrouxa o
   alvo em +1,5s; 60s de calmaria reaperta rumo ao piso. Suspensão binária
   (10min) virou último recurso: só 2 stalls REAIS/5min (resgate não conta;
   resgate com alvo já no teto de 10s conta — rede não segura a borda).
6. **Soft-reset na troca de qualidade** (achado nosso — players não
   precisam porque controlam o próprio ABR): `videoHeight` mudou →
   re-mede do zero, limpa suspensão, 4s de graça pro wipe da rendition.

Validação ao vivo (2026-07-02, mesma live 4K/720p): 90s+90s sem stall,
sem resgate, sem suspensão; catch-up só em 1,15-1,25x; 4K estável ~10s
(piso medido 5,7-5,8s + pipeline ~5,4s); troca pra 720p re-mediu e
mergulhou 17,7→10,7s em 90s. Lição honesta: o piso é da TRANSMISSÃO na
conexão do usuário (esta live entrega 720p com déficits de ~5,5s também)
— o motor obedece a medição, não a expectativa por classe.

### Validação final do v2 em campo (2026-07-02, Copa 4K60)

Após a rodada completa de calibração (sonda informada pelo vale recente,
descida em duas velocidades, teto de catch-up 2x, piso por episódios com
desconto de outlier único, re-ancoragem de déficit permanente):

- Badge: "Delay 9,3s · Buffer 4,1s · Piso desta live ~8,9s" — cavalgando a
  0,4s do limite físico estimado, a 1,0x, estável, em 4K.
- Percepção do Owner: áudio ECOANDO com a TV aberta (CazéTV pós-truque do
  2x) — mesmo nível de delay, sem os congelamentos que a TV come.
- O piso físico desta live (~8,9s) é da classe de latência do canal
  (pipeline ~5s) + entrega 4K em rajadas (~4s) — o 3,16s do benchmark
  segue válido para streams de classe ultra-baixa (régua declarada).
