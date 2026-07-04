# Changelog — TrueLive

## 1.1.3 - 2026-07-04

Sem mudança de motor. Foco em descoberta (ASO) e texto.

### Mudado
- **Título da loja com palavra-chave (ASO)**: o nome exibido na Chrome Web
  Store deixou de ser só "TrueLive" e passou a liderar com a marca seguida
  da dor que resolve, localizado por idioma (pt: "YouTube ao vivo com menos
  atraso"; en: "Lower delay for YouTube live"; es/fr equivalentes). Validação
  no Google Trends mostrou que a busca pela solução é quase nula (dor
  latente): a descoberta acontece na busca interna da loja, onde o título
  pesa. O nome no popup segue limpo ("TrueLive").
- **Zero travessão em todo texto de usuário**: site, popup (4 idiomas),
  README e INSTALL passaram a usar vírgula, dois-pontos ou ponto no lugar do
  "—" (padrão que denuncia texto de IA). Nova lei do produto.
- **Seção "Apoie" do site** centralizada e com tom mais cordial.

## 1.1.0 — 2026-07-02

Motor do Super Ao Vivo reescrito (v2) após diagnóstico ao vivo em stream
4K60: o modo travava em transmissões pesadas. Estudo técnico completo em
docs/RESEARCH.md (hls.js, dash.js LoL+, WebRTC NetEQ, TCP BBR, Shaka).

### Mudado
- **Redução de delay sempre gradual**: o Super Ao Vivo agora encosta na
  borda só por velocidade (curva sigmoide suave, 1,0x-teto do usuário, em
  passos de 0,05) — o reposicionamento do playhead sobrou apenas como
  resgate de emergência. Nada de pulos perceptíveis.
- **Piso medido por chegada de segmentos** (não mais pelo nível do buffer):
  imune à interferência do próprio motor, com memória que expira — o vale
  de uma rendition 4K não contamina o 720p.
- **Colchão que a transmissão exigir**: o teto do alvo subiu de 4,5s para
  até 10s quando a entrega medida pede — 4K pesado roda estável em vez de
  alternar travada/suspensão.
- **Trocar de resolução re-mede na hora**: baixar a qualidade agora mergulha
  o delay para o piso da nova rendition em ~1 min (antes, a troca punia o
  motor com uma suspensão de 10 min).
- **Suspensão graciosa só por travada real**: um resgate invisível não conta
  mais como stall.

- **Catch-up até 2x no Super Ao Vivo** (teto hls.js), independente do
  preset do Automático — a curva só encosta no teto quando muito atrás;
  perto do alvo fica em passos suaves de 1,05-1,15x.

### Novo
- **Sonda de delay (AIMD)**: com calmaria comprovada, o alvo desce abaixo
  do pior caso medido rumo ao mínimo real da transmissão; um resgate é o
  sinal de recuo (nível falho lembrado por 10 min, orçamento de 1 morte
  por 10 min, nunca aposta contra o vale dos últimos 30s).
- **Piso por episódios de vale**: um engasgo aberrante único do broadcast
  não domina o piso (usa o 2º vale mais fundo da janela); gap que repete é
  honrado; déficit permanente (halt na fonte) re-ancora a medição.
- **Régua honesta no badge**: hover mostra "Piso desta live ~X,Xs" —
  pipeline medido do canal + colchão mínimo medido. O usuário vê quando
  está encostado no limite físico da classe de latência da live.
- `engine/edge.js` — o cérebro do Super Ao Vivo extraído e coberto por
  testes (`test/edge.test.mjs`, incluindo o ciclo de entrega 4K medido em
  campo). Suíte: 47 testes.

### Validado em campo (2026-07-02, transmissão 4K60 de futebol)
Delay 9,3s estável em 4K a 0,4s do limite físico estimado da live —
paridade com a TV aberta pós-catch-up, sem os congelamentos dela.

## 1.0.0 — 2026-07-02

Primeira versão do TrueLive (fork GPL-3.0 do ZeroDelay).

### Novo
- **Modo Super Ao Vivo**: edge-riding — reposiciona o playhead na borda do
  conteúdo já baixado. Validado ao vivo: ~3-4s de atraso real vs ~7s do live
  head padrão do YouTube.
- **Adaptação total à internet do usuário** (lei do produto):
  piso dinâmico medido (jitter + margem, base conservadora 2,0s) · subida
  preventiva em rajadas de bitrate · resgate instantâneo na zona de perigo
  (recuo único do playhead; a velocidade **nunca** cai abaixo de 1,0x) ·
  suspensão graciosa para o Automático em conexão fraca (re-arme automático).
- **Indicador de atraso real** fim-a-fim (relógio de ingestão) — badge no topo
  esquerdo do player com visual nativo do YouTube (Delay/Buffer), hover e
  alerta âmbar.
- **Identidade TrueLive**: nome, ícones (raio azul), popup redesenhado —
  controle segmentado de modos com descrição progressiva, tudo localizado
  (pt-BR, en, es, fr).
- **Doações PIX**: valores R$ 5/15/25/50 (≈ US$ 1/3/5/10) + opção **Livre**
  (QR sem valor — quem doa escolhe o quanto no app do banco).

### Mudado
- Modos simplificados: Desligado · Automático · Super Ao Vivo (os 4 presets
  fixos de buffer ficaram redundantes com a adaptação automática).
- Doações direcionadas ao autor do fork (PIX local, chave aleatória; BR Code
  gerado 100% offline).
- Aviso de travamento removido (a suspensão graciosa cobre o caso sem pedir
  ação do usuário).

### Base herdada
- Componentes derivados de upstream (GPL-3.0) delimitados em THIRD-PARTY-NOTICES.md.
