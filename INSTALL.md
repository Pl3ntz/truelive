# Como instalar o TrueLive

> **Não precisa entender de tecnologia.** Se você sabe baixar um arquivo e dar
> dois cliques, você consegue — leva ~2 minutos.

O jeito mais fácil é pela
[Chrome Web Store](https://chromewebstore.google.com/detail/truelive/hoihhfamhfmnnldkdllmemehhbcogkna)
— 1 clique e as atualizações chegam sozinhas. O passo a passo abaixo é pra
quem prefere instalar por fora da loja **ou quer a versão beta mais nova**
(ela sai aqui no GitHub primeiro; a loja recebe depois da revisão do Google).

## Chrome

1. **Baixe o TrueLive**: [clique aqui](https://github.com/Pl3ntz/truelive/releases),
   abra a versão do topo da página (a mais recente, beta incluída) e, em
   **Assets**, clique no primeiro arquivo `.zip` — o nome começa com
   `truelive-` (o que tem `firefox` no nome é só pro Firefox). Ele vai pra
   sua pasta de Downloads, como qualquer arquivo.
2. Encontre o arquivo baixado e **dê dois cliques** nele. Isso cria uma pasta
   chamada `truelive`. *(Essa pasta precisa continuar existindo — não apague
   depois de instalar.)*
3. No Chrome, copie e cole isto na barra de endereço (onde você digita os
   sites) e aperte Enter: `chrome://extensions`
4. No canto superior direito dessa página, ligue a chavinha **"Modo do
   desenvolvedor"**. *(É só um nome assustador — não muda nada no seu Chrome.)*
5. Clique no botão **"Carregar sem compactação"** que apareceu e escolha a
   pasta `truelive` do passo 2.
6. Pronto! Abra uma live no YouTube, clique no ícone de quebra-cabeça (peça de encaixe) no
   topo do Chrome e fixe o TrueLive. Clique nele e escolha **Super Ao
   Vivo** — o badge no player mostra seu delay caindo.

## Edge, Brave, Opera e Vivaldi

Mesmos passos do Chrome — só muda o endereço do passo 3:

| Navegador | Cole na barra de endereço |
|---|---|
| Edge | `edge://extensions` |
| Brave | `brave://extensions` |
| Opera | `opera://extensions` |
| Vivaldi | `vivaldi://extensions` |

## Firefox

O Firefox exige que toda extensão seja **assinada pela Mozilla**, mesmo
instalando por fora da loja — é uma proteção pra você, e nós seguimos a regra.
Nossa versão está em análise; assim que aprovada, a instalação será 1 clique
na página oficial de add-ons. Enquanto isso, use a versão Chrome/Edge/Brave
acima.

## Deu algo errado?

- **"Não achei o Modo do desenvolvedor"** — ele fica no canto superior
  direito da página de extensões, é uma chavinha pequena.
- **A extensão sumiu depois de reiniciar** — provavelmente a pasta `truelive`
  foi apagada ou movida. Repita a instalação e deixe a pasta quieta (dica:
  mova ela pra fora de Downloads, ex. Documentos, antes do passo 5).
- **Instalei mas não vejo nada no player** — a extensão só age em **lives**
  (transmissões ao vivo), não em vídeos normais. Confira também se o modo
  escolhido no popup não é "Desligado".
- Outra coisa? [Abra uma issue](https://github.com/Pl3ntz/truelive/issues) que
  eu respondo.
