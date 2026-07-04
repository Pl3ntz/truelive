# Store Listing — TrueLive

> **ASO (2026-07-04):** o título é o fator nº 1 de ranqueamento na busca
> interna da Chrome Web Store. Validação no Google Trends (BR, 5 anos)
> mostrou que a intenção de solução ("diminuir delay youtube") tem volume
> quase zero: a dor é latente, ninguém busca a cura. O canal de descoberta
> real é quem digita "youtube", "live", "ao vivo", "extensão youtube" na
> própria loja. Por isso o nome agora lidera com a marca e carrega keyword.
> O nome vem do manifest (`__MSG_extName__`, um por locale) — este arquivo
> espelha o pt-BR. A descrição longa abaixo é colada no campo do dashboard.

## Nome (vem do manifest `extName`, por locale)
- pt-BR: TrueLive - YouTube ao vivo com menos atraso
- en: TrueLive - Lower delay on YouTube livestreams
- es: TrueLive - YouTube en vivo con menos retraso
- fr: TrueLive - YouTube en direct, moins de délai

## Resumo curto (132 chars max)
Assista lives do YouTube com o menor atraso que a transmissão e a sua
internet permitem. Adapta-se sozinho. Sem coleta de dados.

## Descrição longa

Assistir live no YouTube com menos atraso: é isso que o TrueLive faz. O
player te segura vários segundos atrás do ao vivo de propósito, e boa parte
desse vídeo já está baixada no seu computador. Em qualquer transmissão (o
lance, o drop, o anúncio do resultado), é a diferença entre reagir junto e
ficar sabendo pelo chat.

O TrueLive te deixa colado no ponto mais recente disponível:

• Super Ao Vivo: o menor delay que A TRANSMISSÃO e a sua internet permitem,
  com 4 camadas de proteção automática. Piso medido pela sua conexão, reação
  preventiva a picos, resgate instantâneo em vez de travada (a velocidade
  nunca cai abaixo de 1,0x) e suspensão automática se a internet não aguentar.
• Automático: equilíbrio sem pensar. Analisa sua internet e ajusta sozinho.
• Indicador de atraso real no player (opcional): veja em segundos o quão
  longe do ao vivo você está, medido de verdade, não estimado.

Quanto você ganha depende da transmissão (quem escolhe a classe de latência
é o canal). Em streams de baixa latência (CazéTV, esports), medimos ~3-4s da
transmissão à tela, território de TV aberta, contra ~7s do player padrão. Em
canais que transmitem em latência normal, o piso físico é maior (~10s+), e
nenhuma extensão fura esse limite: o TrueLive te garante o mínimo possível
dali. Números medidos e verificados, com metodologia pública no repositório.

Funciona em qualquer live do YouTube: futebol, esports, shows, gameplay,
lançamentos, notícias, sorteios, cultos e aulas ao vivo.

Sem cadastro, sem coleta de dados, sem requisições externas. Tudo acontece
localmente no seu navegador. Código aberto (GPL-3.0).

Atalho: Alt+Shift+Y (Cmd+Shift+Y no Mac) liga e desliga.

## Categoria
Ferramentas / Entretenimento

## Screenshots (1280x800)
1. Player com badge "2,9s" numa live com movimento (herói)
2. Popup com os 3 modos
3. Badge expandido no hover (atraso · reserva)

## Justificativa de permissões (revisão da store)
- `storage`: guardar as preferências do usuário (modo, indicadores). Local.
- `host youtube.com`: o content script só roda em páginas do YouTube, é onde
  o player que a extensão controla existe.
