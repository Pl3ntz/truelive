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
