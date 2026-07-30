# Publicar na Chrome Web Store pela API

Configuração única, cerca de 5 minutos. Depois dela, cada versão nova sobe com
`npm run build && npm run publish`, sem abrir o painel e sem 2FA.

## 1. Criar o projeto

<https://console.cloud.google.com/projectcreate>

Nome livre, por exemplo `truelive-publish`.

## 2. Ativar a API

Com o projeto novo selecionado no topo da página:

<https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com>

Clique em **Ativar**.

## 3. Tela de consentimento OAuth

<https://console.cloud.google.com/apis/credentials/consent>

Tipo **Externo**. Preencha o nome do app e o e-mail de contato, e salve.

Em **Usuários de teste**, adicione o seu próprio e-mail. Esse passo é fácil de
pular e o erro só aparece lá na frente, na hora de autorizar, sem dizer que a
causa foi essa.

## 4. Criar a credencial

<https://console.cloud.google.com/apis/credentials>

**Criar credenciais** > **ID do cliente OAuth** > tipo de aplicativo
**App para computador**.

O Google mostra dois valores: o ID do cliente e a chave secreta.

## 5. Preencher o .env

O arquivo `.env` já existe na raiz do projeto, com as duas chaves em branco.
Abra ele e cole cada valor logo depois do sinal de igual da linha
correspondente: o ID do cliente na primeira, a chave secreta na segunda.

O `.env` está no `.gitignore`. Nunca comite esse arquivo e nunca cole o
conteúdo dele em chat, ticket ou captura de tela.

## 6. Autorizar

```bash
npm run publish:auth
```

O script mostra uma URL. Abra, entre com a conta dona da extensão, autorize, e
o Google exibe um código na tela. Cole esse código no terminal.

Pronto. O token de acesso fica gravado no `.env` e essa etapa não se repete.

## Uso diário

```bash
npm run build      # gera build/truelive-<versão>.zip
npm run publish    # sobe e manda pra revisão
```

Para subir sem mandar pra revisão, útil para conferir a listagem antes:

```bash
npm run publish -- --draft
```

## Quando algo falha

**`invalid_grant`**: o token de acesso expirou ou foi revogado. Rode
`npm run publish:auth` de novo; os passos de 1 a 5 continuam valendo.

**Erro de item já em revisão**: a loja não aceita pacote novo enquanto há uma
versão pendente, e não dá para cancelar uma revisão. Só esperar.

**Consentimento recusado**: quase sempre é o passo 3, o e-mail que não foi
adicionado em Usuários de teste.

## Por que o token merece cuidado

O valor gravado no `.env` publica uma versão nova da extensão em nome do dono
da conta, sem pedir senha nem segundo fator. Quem tiver o arquivo consegue
publicar. É por isso que ele nunca entra no git.
