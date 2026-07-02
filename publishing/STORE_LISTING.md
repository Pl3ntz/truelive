# Store Listing — TrueLive

## Nome
TrueLive — menor atraso em lives

## Resumo curto (132 chars max)
Assista lives do YouTube com o menor atraso que a transmissão e a sua
internet permitem. Adapta-se sozinho. Sem coleta.

## Descrição longa

⚡ O ao vivo do YouTube não é ao vivo: o player te segura vários segundos atrás
de propósito — e boa parte desse vídeo já está baixada no seu computador. Num
jogo, é a diferença entre ouvir o grito do vizinho e gritar junto.

O TrueLive te deixa colado no ponto mais recente disponível:

• Super Ao Vivo — o menor delay que A TRANSMISSÃO e a sua internet permitem,
  com 4 camadas de proteção automática: piso medido pela sua conexão, reação
  preventiva a picos, resgate instantâneo em vez de travada (a velocidade
  nunca cai abaixo de 1,0x), e suspensão automática se a internet não aguentar.
• Automático — equilíbrio sem pensar: analisa sua internet e ajusta sozinho.
• Indicador de atraso real no player (opcional): veja em segundos o quão longe
  do vivo você está — medido de verdade, não estimado.

Quanto você ganha depende da transmissão (quem escolhe a classe de latência é
o canal): em streams de baixa latência (CazéTV, esports), medimos ~3-4s da
transmissão à tela — território de TV aberta, contra ~7s do player padrão. Em canais que
transmitem em latência normal, o piso físico é maior (~10s+) e NENHUMA
extensão fura esse limite — o TrueLive te garante o mínimo possível dali.
Números medidos e verificados, com metodologia pública no repositório.

Sem cadastro, sem coleta de dados, sem requisições externas — tudo acontece
localmente no seu navegador. Código aberto (GPL-3.0).

Atalhos: Alt+Shift+Y liga/desliga · Alt+Shift+L pula pro ao vivo.

## Categoria
Ferramentas / Entretenimento

## Screenshots (1280x800)
1. Player com badge "⚡ 2,9s" numa live de esporte (herói)
2. Popup com os 3 modos
3. Badge expandido no hover (atraso · reserva)

## Justificativa de permissões (revisão da store)
- `storage`: guardar as preferências do usuário (modo, indicadores). Local.
- `host youtube.com`: o content script só roda em páginas do YouTube — é onde o
  player que a extensão controla existe.
