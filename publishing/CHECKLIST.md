# Checklist de publicação — TrueLive

## Pré-flight (feito)
- [x] Testes verdes (`npm test`) e manifests válidos (`npm run validate`)
- [x] Marca própria: nome, ícones, locales, © headers; crédito GPL ao upstream
- [x] Doações apontando pro autor do fork (chave PIX aleatória)
- [x] Permissões mínimas (storage; sem alarms)
- [x] Zip: `npm run build` → build/truelive-<versão>.zip

## Chrome Web Store (manual, conta do Owner)
- [ ] Conta dev ($5 única) em https://chrome.google.com/webstore/devconsole
- [ ] Upload do zip · listing (STORE_LISTING.md) · screenshots 1280x800
- [ ] Privacy practices: "não coleta dados" + URL: https://github.com/Pl3ntz/truelive/blob/main/publishing/PRIVACY.md
- [ ] Publicar (revisão ~1-3 dias)

## Firefox AMO (manual, conta do Owner)
- [ ] `npm run build:firefox` · upload em https://addons.mozilla.org/developers/
- [ ] Fonte GPL: apontar o repositório público

## GPL (obrigatório na distribuição)
- [x] Repositório público: https://github.com/Pl3ntz/truelive (tag v1.0.0 + release com zip)
- [ ] LICENSE + THIRD-PARTY-NOTICES no zip (já embarcados)

## Divulgação
- [ ] Post de lançamento (ângulo genérico: "qualquer live do YouTube no menor atraso que a transmissão permite — 3,2s medidos vs ~7s do player padrão")
- [ ] Caso para imprensa: Copa 2026 / CazéTV (+15-20s atrás da TV aberta; com TrueLive, território da TV aberta)
- [ ] Comunidades: X/Twitter tech-BR; esports/gaming; r/futebol e r/CazeTV (via caso Copa)
