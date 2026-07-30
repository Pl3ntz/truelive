# Política de Privacidade — TrueLive

**TL;DR: o TrueLive não transmite nenhum dado seu. O que ele guarda fica só no
seu navegador, e só sai de lá se você mesmo exportar.**

- Nenhuma requisição de rede é feita pela extensão. Zero telemetria, zero
  analytics, zero servidores próprios.
- As preferências (modo escolhido, indicadores visíveis) ficam em
  `chrome.storage.local`, no seu navegador, e nunca saem dele.
- Existe um log de diagnóstico técnico, também local, que ajuda a investigar
  bugs. Ele guarda só o estado do motor (velocidade, buffer, eventos de resgate,
  se a aba estava oculta), nunca a URL, o título ou qualquer identificação do
  vídeo. Fica no seu navegador e só sai de lá se VOCÊ copiar ou baixar para
  anexar num relato de problema. A extensão nunca o envia sozinha.
- A extensão roda somente em páginas do YouTube (`youtube.com`), onde lê o
  estado do player de vídeo (buffer, posição, latência) exclusivamente para
  ajustar a reprodução localmente.
- O código de doação PIX (QR/copia-e-cola) é gerado 100% localmente.
- Código aberto (GPL-3.0): qualquer pessoa pode auditar.

Contato: vitorribasplentz@gmail.com
