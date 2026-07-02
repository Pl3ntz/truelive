# Política de Segurança

## Versões suportadas

O TrueLive é uma extensão de navegador distribuída pela Chrome Web Store e
buildada para Firefox. Apenas a **versão publicada mais recente** recebe
correções de segurança. Atualize sempre para a última versão antes de reportar.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública** para relatar falhas de segurança. Isso exporia o
problema antes de uma correção estar disponível.

Prefira um dos canais privados abaixo:

1. **GitHub Security Advisories** (recomendado): use o botão
   [*Report a vulnerability*](https://github.com/Pl3ntz/TrueLive/security/advisories/new)
   na aba **Security** do repositório.
2. **E-mail:** envie os detalhes para
   [vitorribasplentz@gmail.com](mailto:vitorribasplentz@gmail.com) com o assunto começando por
   `[SECURITY] TrueLive`.

Inclua, se possível:

- Uma descrição da falha e do impacto potencial;
- Passos para reproduzir (URL da live, modo em uso, navegador e versão);
- Qualquer prova de conceito, log ou captura de tela relevante.

## O que esperar

- **Confirmação de recebimento:** em até 5 dias úteis.
- **Avaliação inicial e próximos passos:** em até 15 dias úteis.
- Manteremos você informado sobre o andamento da correção e combinaremos a
  divulgação pública somente depois que uma versão corrigida for publicada.

Pedimos que você dê um prazo razoável para a correção antes de divulgar a falha
publicamente. Contribuições responsáveis serão creditadas no
[CHANGELOG.md](CHANGELOG.md), se você desejar.

## Escopo

A extensão roda inteiramente no navegador e **não envia dados a servidores
externos**. Recursos como o QR Code PIX de doação são gerados **localmente**.
Relatórios especialmente úteis envolvem:

- Vazamento de dados do usuário para fora do navegador;
- Execução de código não confiável a partir de conteúdo da página;
- Escalonamento indevido de permissões da extensão.

## Decisão de arquitetura documentada (revisão 2026-07-02)

O motor roda no MAIN world da página (exigência: só ali existem as APIs privadas
do player). Consequência aceita: scripts da própria página podem forjar os
CustomEvents internos (`_live_catch_up_*`). Pior caso analisado: nenhum — os
campos alcançam apenas sinks inócuos (`textContent`, atributos ARIA, taxa de
reprodução — que a página já controla nativamente). O MAIN world não tem acesso
a `chrome.*` nem ao storage da extensão. O destinatário das doações (pix.js) é
constante de módulo em contexto privilegiado — inalcançável pela página.

## Auditoria pré-lançamento (2026-07-02)

Revisão completa (extensão, landing em produção, VPS, supply chain) por
revisor dedicado, read-only. Resultado: **apto** — nenhum vetor de roubo de
PIX, XSS ou exfiltração. Ações derivadas, todas aplicadas:

- Pacotes das lojas rebuildados para casar byte a byte com o fonte auditado.
- CI com `permissions: contents: read` e actions pinadas por SHA.
- Landing servida com o conjunto completo de headers (CSP estrito,
  Permissions-Policy, COOP/CORP, frame-ancestors 'none', base-uri 'none').
- QR PIX servido em produção decodificado por máquina e conferido contra a
  chave esperada (payload EMV byte-idêntico ao fonte, CRC verificado).

Superfície conhecida e aceita: eventos `_live_catch_up_*` no MAIN world são
forjáveis por scripts co-residentes na página do YouTube; o impacto se limita
à reprodução do próprio usuário (sem dados, sem privilégio, sem DOM injetável)
— ver seção acima sobre a decisão de MAIN world.
