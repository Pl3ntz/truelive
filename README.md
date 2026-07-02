# TrueLive

**O ao vivo de verdade — assista lives do YouTube com o menor atraso que a sua
internet permite.**

Quando você assiste qualquer live no YouTube — show, gameplay, lançamento,
notícia, sorteio, culto, aula, jogo — está vendo o passado: o player te segura
vários segundos atrás de propósito, como colchão de segurança, e boa parte
desse vídeo **já está baixada no seu computador**. No caso mais famoso, a
CazéTV na Copa 2026, isso significou ver o gol ~20 segundos depois da TV
aberta.

O TrueLive elimina esse excesso e te deixa colado no ponto mais recente
disponível, com proteção automática contra travamentos.

## Que delay você vai ter? (leia isto primeiro)

O delay mínimo possível **não depende só do TrueLive — depende da transmissão**.
Quem define a classe de latência é o **canal**, na hora de transmitir:

| Classe da stream (escolha do canal) | Piso físico | Com TrueLive você fica em |
|---|---|---|
| Ultra-baixa latência | ~2-5s | **~3-4s** — território da TV aberta |
| Baixa latência (CazéTV, esports) | ~5-10s | **~3-4s** — território da TV aberta |
| Latência normal (padrão do YouTube) | ~10-30s | **o piso da stream** (~10s+) |

> **Régua honesta:** nossos números são medidos da **ingestão** (encoder do
> YouTube) até a tela; o ~3-5s da TV aberta é medido **do estádio**. São réguas
> diferentes — contando do estádio, o caminho do streaming ainda soma o trecho
> até o YouTube, então a TV aberta **empata ou ganha**. O TrueLive te coloca no
> território dela, nunca "à frente da TV".

Em latência normal, o vídeo mais novo **nem chega** ao seu computador antes
disso — nenhuma extensão fura esse piso, e quem prometer o contrário está
mentindo. O que o TrueLive garante: você fica **no menor delay que aquela
transmissão e a sua internet permitem**, sempre. Se o badge mostra 10s num
canal de latência normal, você JÁ está no mínimo possível.

## Números (medidos e verificados, não prometidos)

Delays fim-a-fim (ingestão → sua tela) em **stream low-latency**, medidos com o
relógio de ingestão do próprio player, mesma máquina e mesma stream:

| Como você assiste | Delay | Comprovação |
|---|---|---|
| TV aberta (antena digital — régua própria: medida do estádio) | ~3-5s | convergência imprensa/indústria |
| **YouTube + TrueLive (Super Ao Vivo)** | **3,2s medido** da ingestão (~3,5s na calibração atual) | benchmark próprio A/B/C |
| Catch-up 1.25x (a técnica dos concorrentes) | 4,5-7s, serrilhado | medido + derivado do código deles |
| YouTube padrão (live low-latency, sem extensão) | 7,0-7,3s | medido |
| CazéTV na Copa 2026 | +15-20s atrás da Globo | medição independente (Canaltech) |

Redução real medida: **~55%** do delay (7,0s → 3,2s) — e não os "80%" que
concorrentes prometem sem medição. Nenhuma outra extensão pesquisada usa
edge-riding (reposicionamento do playhead); todas só aceleram o vídeo.

Análise completa — 16 fontes, metodologia e lacunas conhecidas:
[docs/DELAY-BENCHMARK.md](docs/DELAY-BENCHMARK.md).

## Modos

Dois modos, ambos **se adaptam sozinhos à sua internet** — você nunca configura
nada:

- **Automático** — equilíbrio sem pensar: reduz o atraso quando a conexão
  aguenta, mantém mais reserva quando ela oscila.
- **Super Ao Vivo** — força o menor atraso fisicamente possível, com quatro
  camadas de proteção para a experiência nunca degradar:
  1. **Piso dinâmico medido** — o motor mede a "respiração" da sua conexão e
     descobre o quão perto do vivo dá pra chegar (base conservadora: 2,0s).
     Descer abaixo de 2,5s é conquistado com 3+ minutos de estabilidade provada.
  2. **Reação preventiva** — picos de bitrate (ação na tela) aumentam a reserva
     *antes* de virarem travada.
  3. **Resgate instantâneo** — se a reserva despencar, um único recuo de ~1-2s
     restaura a proteção na hora. A velocidade **nunca** cai abaixo de 1,0x —
     você está ao vivo, não faz sentido desacelerar.
  4. **Suspensão graciosa** — internet fraca de verdade? O modo se suspende por
     10 minutos e entrega ao Automático. Re-arma sozinho, começando seguro.

## Indicador no player

Badge discreto no canto superior esquerdo (estética "Stats for nerds"):

- Em repouso: `2,9s` — seu atraso real, medido fim-a-fim
- Hover: `atraso 2,9s · reserva 2,0s`
- Âmbar + expandido: reserva fina (o modo já está agindo)
- Esmaece quando você usa os controles do player

Desligável em Opções → Indicadores no player.

## Instalação

- **Chrome Web Store / Firefox Add-ons:** *(links após publicação)*
- **Manual:** clone o repo → `chrome://extensions` → Modo do desenvolvedor →
  "Carregar sem compactação" → selecione a pasta.

Atalhos: `Alt+Shift+Y` liga/desliga · `Alt+Shift+L` pula pro ao vivo
(`⌘+Shift+…` no Mac).

## Como funciona (técnico)

O player web do YouTube (SABR/manifestless) mantém ~6s de vídeo já baixado à
frente do ponto de reprodução mesmo "ao vivo". O TrueLive:

1. mede o atraso real fim-a-fim pelo relógio de ingestão do player
   (`getProgressState().ingestionTime`);
2. reposiciona o playhead na borda do conteúdo baixado (nudge direto) — técnica
   que os catch-ups tradicionais (só aceleração 1.25x) não usam;
3. mantém a posição com um controlador de buffer (EMA + derivada de dreno) e as
   4 camadas de proteção acima.

Tudo local — zero requisições externas, zero coleta de dados
(ver [PRIVACY](publishing/PRIVACY.md)).

## Desenvolvimento

```bash
npm test            # suíte (motor, PIX, presets)
npm run validate    # valida manifests + arquivos embarcados
npm run build       # gera build/truelive-<versão>.zip (Chrome)
npm run build:firefox
```

Arquitetura: `engine/controller.js` (matemática de catch-up, unit-tested) ·
`inject.js` (motor no mundo da página: edge-riding, freio, suspensão, badge) ·
`content.js` (ponte storage→página) · `popup.js/html/css` (UI) · `pix.js`
(gerador BR Code local para doações).

## Apoie o projeto

Botão "Apoiar o projeto" no popup — PIX (QR/copia-e-cola) gerado localmente.

## Licença e créditos

GPL-3.0. © 2026 Vitor Plentz.

Desenvolvido por **Vitor Plentz** (ver [AUTHORS](AUTHORS.md)). O trabalho
original do TrueLive e os componentes derivados de upstream (GPL-3.0) estão
delimitados com precisão em [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md).
