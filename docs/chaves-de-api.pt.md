# Couch Critics: como conseguir as chaves de API

Este guia é para quem administra o Couch Critics na comunidade. Ele ensina, passo a passo, a conseguir as 3 chaves que o app usa para buscar filmes, séries e jogos. Não precisa saber programar.

## Antes de começar

**O que é uma chave de API?** É como uma senha que o Couch Critics usa para pedir informações a outro site (por exemplo, "me dê a capa e o nome em português deste filme"). Sem a chave, o app continua funcionando, mas só com títulos adicionados à mão e sem capa.

**Por que cada comunidade usa a sua?** Os sites limitam quantas consultas cada chave pode fazer por dia. Com uma chave por comunidade, o limite de uma não atrapalha as outras.

**Quanto custa?** Nada. As 3 chaves são gratuitas para uso pessoal e sem fins lucrativos.

**Quanto tempo leva?** Cerca de 20 a 30 minutos no total, mais a espera de um e-mail.

**O que você precisa ter à mão:**
- Um e-mail que você consiga abrir agora.
- Um celular (a Twitch exige verificação em duas etapas).
- Um computador. O cadastro do TMDB não funciona bem no celular.
- Alguns minutos para preencher os formulários por inteiro: o TMDB e o OMDb só criam a chave se **todos os campos pedidos** estiverem preenchidos (nome do aplicativo, URL, descrição e seus dados de contato no TMDB; e-mail no OMDb).

| Chave | Serve para | Onde |
|---|---|---|
| TMDB | Buscar filmes e séries em português ou inglês, capas e episódios | themoviedb.org |
| OMDb | Mostrar a nota do IMDb ao lado | omdbapi.com |
| IGDB (pela Twitch) | Buscar jogos e capas | dev.twitch.tv |

Os sites mudam as telas de vez em quando. Se um botão tiver um nome um pouco diferente do que está aqui, procure o que faz a mesma coisa.

---

## 1. TMDB (filmes e séries)

1. Abra https://www.themoviedb.org/ e crie uma conta (botão de cadastro no canto superior direito). Escolha usuário, senha e e-mail.
2. Abra o e-mail que o TMDB enviou e confirme a conta, se ele pedir.
3. Entre na sua conta, clique na sua foto (canto superior direito) e vá em **Settings** (Configurações).
4. No menu da esquerda, clique em **API**.
5. Peça uma chave. O TMDB mostra os termos de uso: leia e aceite. Depois abre um formulário **Application Details** (Detalhes do aplicativo) com 4 campos.

   > **Atenção: todos os campos precisam ser preenchidos para o TMDB criar a chave.** O formulário não deixa enviar com algum campo vazio. O que mais costuma travar é a **URL** (aparece em vermelho com "Field is required") e a **descrição** do aplicativo. Se ficar em branco, a chave não é criada.

   Preencha assim:
   - **Nome do aplicativo:** `Couch Critics`
   - **URL do aplicativo (obrigatório):** o app não tem site próprio, então use `https://www.rootapp.com`
   - **Tipo de uso:** `Personal` (uso pessoal, sem fins lucrativos)
   - **Sobre o aplicativo:** cole este texto em inglês, que é o que a equipe do TMDB lê:

     ```
     Couch Critics is a free, non-commercial app for a Root community where friends rate movies, series and games together. It uses the TMDB API to search titles in English and Portuguese and to show posters and episode lists. Each community uses its own API key. The app displays the required TMDB attribution and logo, and no data is sold or monetized.
     ```

   Mais abaixo, o formulário pode pedir seus dados de contato (nome, endereço, telefone, e-mail). Eles também são obrigatórios para criar a chave. Preencha com dados reais: servem só para o TMDB.
6. Ao terminar, a página **API** mostra duas coisas: **API Key** e **API Read Access Token**.
7. Copie o **API Read Access Token**. É o texto bem comprido (centenas de caracteres). Os dois dão o mesmo acesso, mas o Couch Critics usa o comprido.

**Guarde:** o API Read Access Token.

---

## 2. OMDb (nota do IMDb)

1. Abra https://www.omdbapi.com/apikey.aspx
2. Em **Account Type**, escolha a opção gratuita: **FREE! (1,000 daily limit)**. Isso significa 1.000 consultas por dia. O Couch Critics guarda as respostas para gastar pouco.
3. Digite o seu e-mail e clique em **Generate API Key**.
4. Espere o e-mail com a chave. Pode demorar, principalmente em contas Hotmail, Outlook, Live e Yahoo. Olhe também a caixa de spam.
5. Se o e-mail trouxer um link de ativação, clique nele. A chave pode não funcionar antes disso.
6. Se a chave não chegar em 1 hora, o próprio site pede para entrar em contato com o autor.

**Guarde:** a chave que veio por e-mail.

---

## 3. IGDB (jogos), pela Twitch

O IGDB é o banco de dados de jogos que pertence à Twitch. Por isso a chave sai da conta da Twitch.

### 3.1 Conta e verificação em duas etapas
1. Abra https://www.twitch.tv/ e crie uma conta (**Sign Up**). Confirme o e-mail.
2. Ative a **verificação em duas etapas** (2FA): na Twitch, abra **Settings** (Configurações), depois **Security and Privacy** (Segurança e privacidade) e procure a seção **Security**. Ative a verificação em duas etapas e siga as instruções com o seu celular.
   - Sem isso, a Twitch não deixa criar o aplicativo no passo seguinte.

### 3.2 Criar o aplicativo
3. Abra https://dev.twitch.tv/console e entre com a mesma conta. Se a página não reconhecer a 2FA recém-ativada, atualize a página.
4. Abra a aba **Applications** e clique em **Register Your Application**.
5. Preencha:
   - **Name:** um nome único em toda a Twitch, por exemplo `Couch Critics - NomeDaSuaComunidade`. Se disser que já existe, acrescente números.
   - **OAuth Redirect URLs:** digite `http://localhost` e clique em **Add**. O Couch Critics não usa esse endereço, mas o formulário exige.
   - **Category:** escolha **Application Integration**. Se não existir, escolha a opção mais próxima.
   - **Client Type**, se aparecer: escolha **Confidential**.
   - Marque **I'm not a robot** e clique em **Create**.

### 3.3 Pegar o Client ID e o Client Secret
6. Na lista **Developer Applications**, ache o seu aplicativo e clique em **Manage**.
7. Copie o **Client ID**.
8. Clique em **New Secret** e copie o **Client Secret** na hora. Ele só aparece uma vez. Se você perder, é só clicar em **New Secret** de novo (o antigo deixa de funcionar).

**Guarde:** o Client ID e o Client Secret.

---

## 4. Onde colar as chaves no Couch Critics

1. Quem instala o app escolhe, na instalação, **quem administra o Couch Critics** (pessoas ou cargos).
2. Só essas pessoas veem o botão **Configurações** no topo do app.
3. Lá há três blocos: **TMDB** (um campo), **OMDb** (um campo) e **IGDB (jogos)**, que tem dois campos, **Client ID** e **Client Secret**. Os dois do IGDB são obrigatórios e vão juntos no mesmo botão Salvar. Cole cada chave no lugar certo e salve. Se o serviço recusar a chave, o app avisa e não a guarda.
Guia detalhado, com cada mensagem da tela e solução de problemas: [Como configurar as chaves](como-configurar.pt.md).

4. O app guarda as chaves no banco de dados da sua comunidade. Depois de salvas, elas não aparecem de volta na tela (só "configurada").

Pode configurar só uma parte: sem a chave do OMDb, por exemplo, tudo funciona, só não aparece a nota do IMDb.

---

## 5. Cuidados com as chaves

- Trate como senha. Não poste em chat, em canal da comunidade nem em print.
- Se uma chave vazar:
  - **TMDB:** gere outra na mesma página **Settings → API**.
  - **OMDb:** peça uma nova chave pelo mesmo formulário.
  - **Twitch/IGDB:** clique em **New Secret** (o Client Secret antigo para de funcionar).
  Depois cole a nova no Couch Critics.
- Se uma busca parar de funcionar do nada, veja se a chave expirou ou foi trocada.

## 6. Problemas comuns

| Problema | O que fazer |
|---|---|
| O e-mail do OMDb não chega | Espere até 1 hora, olhe o spam, tente com outro e-mail (Gmail costuma ser mais rápido). |
| A Twitch não deixa criar o aplicativo | Confirme que a verificação em duas etapas está ativa e atualize a página do console. |
| "Name already in use" na Twitch | Troque o nome do aplicativo por outro, mais específico. |
| A busca diz que o limite do dia acabou | O OMDb libera de novo no dia seguinte. O resto do app segue funcionando. |
| Não acho "Generate API Key" ou "Register Your Application" | O site mudou a tela. Procure um botão com o mesmo sentido, ou me mande um print. |

## 7. Créditos (o app mostra isso sozinho)

Os serviços exigem aviso de uso. O Couch Critics terá uma tela "Sobre" com:

- "This product uses the TMDB API but is not endorsed or certified by TMDB." e o logo do TMDB.
- Aviso do IGDB e do OMDb/IMDb.

Você não precisa fazer nada. Só não esconda essa tela.
