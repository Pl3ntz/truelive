# ⚡ TrueLive

**O ao vivo de verdade — assista lives do YouTube com o menor atraso que a sua
internet permite.**

Quando você assiste uma live no YouTube, está vendo o passado: o player te
segura vários segundos atrás de propósito, como colchão de segurança — e boa
parte desse vídeo **já está baixada no seu computador**. Na CazéTV durante a
Copa 2026, isso significou ver o gol ~20 segundos depois da TV aberta.

O TrueLive elimina esse excesso e te deixa colado no ponto mais recente
disponível, com proteção automática contra travamentos.

## Números (medidos ao vivo, não prometidos)

| Como você assiste | Atraso típico do lance real |
|---|---|
| TV aberta (antena digital) | ~3-5s |
| **YouTube + TrueLive (Super Ao Vivo)** | **~3-4s** — no nível da TV aberta |
| YouTube padrão (live low-latency) | ~7s |
| CazéTV padrão na Copa (medido pela imprensa) | ~20-45s |

## Modos

Dois modos, ambos **se adaptam sozinhos à sua internet** — você nunca configura
nada:

- **Automático** — equilíbrio sem pensar: reduz o atraso quando a conexão
  aguenta, mantém mais reserva quando ela oscila.
- **Super Ao Vivo** ⚡ — força o menor atraso fisicamente possível, com quatro
  camadas de proteção para a experiência nunca degradar:
  1. **Piso dinâmico medido** — o motor mede a "respiração" da sua conexão e
     descobre o quão perto do vivo dá pra chegar (mínimo físico: 1,5s).
     Descer abaixo de 2s é conquistado com 3+ minutos de estabilidade provada.
  2. **Reação preventiva** — picos de bitrate (lances!) aumentam a reserva
     *antes* de virarem travada.
  3. **Freio suave de emergência** — se a reserva despencar, o vídeo desacelera
     imperceptivelmente (0,92x) até se blindar de novo, em vez de congelar.
  4. **Suspensão graciosa** — internet fraca de verdade? O modo se suspende por
     10 minutos e entrega ao Automático. Re-arma sozinho, começando seguro.

## Indicador no player

Badge discreto no canto superior esquerdo (estética "Stats for nerds"):

- Em repouso: `⚡ 2,9s` — seu atraso real, medido fim-a-fim
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

Botão "☕ Apoiar o projeto" no popup — PIX (QR/copia-e-cola) gerado localmente.

## Licença e créditos

GPL-3.0. © 2026 Vitor Plentz.

Desenvolvido por **Vitor Plentz** (ver [AUTHORS](AUTHORS.md)). O trabalho
original do TrueLive e os componentes derivados de upstream (GPL-3.0) estão
delimitados com precisão em [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md).
