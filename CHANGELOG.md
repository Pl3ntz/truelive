# Changelog — TrueLive

## 1.0.0 — 2026-07-02

Primeira versão do TrueLive (fork GPL-3.0 do ZeroDelay).

### Novo
- **Modo Super Ao Vivo**: edge-riding — reposiciona o playhead na borda do
  conteúdo já baixado. Validado ao vivo: ~3-4s de atraso real vs ~7s do live
  head padrão do YouTube.
- **Adaptação total à internet do usuário** (lei do produto):
  piso dinâmico medido (jitter + margem, mínimo 1,5s) · subida preventiva em
  rajadas de bitrate · freio suave 0,92x na zona de perigo · suspensão graciosa
  para o Automático em conexão fraca (re-arme automático).
- **Indicador de atraso real** fim-a-fim (relógio de ingestão) — badge
  "stats-for-nerds" no topo esquerdo do player, com hover e alerta âmbar.
- **Identidade TrueLive**: nome, ícones (raio azul), popup redesenhado.

### Mudado
- Modos simplificados: Desligado · Automático · Super Ao Vivo (os 4 presets
  fixos de buffer ficaram redundantes com a adaptação automática).
- Doações direcionadas ao autor do fork (PIX local, chave aleatória).
- Aviso de travamento removido (a suspensão graciosa cobre o caso sem pedir
  ação do usuário).

### Base herdada
- Componentes derivados de upstream (GPL-3.0) delimitados em THIRD-PARTY-NOTICES.md.
