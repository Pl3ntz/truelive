# Changelog — TrueLive

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
