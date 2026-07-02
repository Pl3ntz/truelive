# Third-Party Notices — TrueLive

TrueLive é distribuído sob GNU GPL-3.0 (ver [LICENSE](LICENSE)).
© 2026 Vitor Plentz.

## Trabalho original do TrueLive (Vitor Plentz)

- Motor **Super Ao Vivo**: edge-riding (reposicionamento direto do playhead na
  borda do conteúdo baixado), piso dinâmico medido por envelope de jitter,
  freio suave 0,92x na zona de perigo, suspensão graciosa com re-arme.
- **Indicador de atraso real** fim-a-fim (relógio de ingestão) e o badge
  "stats-for-nerds" no player.
- Simplificação para 2 modos adaptativos, redesign do popup, identidade visual,
  pesquisa/validação (docs/RESEARCH.md), doações via PIX do autor.

## Trabalho derivado (cadeia de upstream, GPL-3.0)

TrueLive é um fork de **ZeroDelay** (© João Gustavo França,
https://github.com/joaogfc/ZeroDelay), que por sua vez deriva de
**live-catch-up** (© yudai-tiny-developer). Do upstream herdamos: o controller
de catch-up por taxa de reprodução (engine/controller.js base), a blindagem do
motor contra mudanças do player, a ponte content-script↔página, o harness de
build/validação e o gerador de BR Code (pix.js, reconfigurado). Os avisos
originais seguem abaixo, como exigido.

---

## 1. live-catch-up (base of this extension)

ZeroDelay is a **derivative work** of **live-catch-up** by **yudai-tiny-developer**:

> https://github.com/yudai-tiny-developer/live-catch-up

The original project is **dual-licensed under the MIT License and the Apache
License 2.0**. ZeroDelay incorporates and modifies its source under the terms of
the MIT License, reproduced below (the original repository did not ship a filled-in
copyright line; attribution to the original author is preserved here).

```
MIT License

Copyright (c) yudai-tiny-developer
https://github.com/yudai-tiny-developer/live-catch-up

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The Apache-2.0 option offered by the original project is also available at:
https://github.com/yudai-tiny-developer/live-catch-up/blob/main/LICENSE-APACHE

---

## 2. qrcode-generator (`vendor/qrcode.js`)

The bundled QR Code generator used by the PIX donation panel.

```
The MIT License (MIT)

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
