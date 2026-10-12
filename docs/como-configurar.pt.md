# Couch Critics: como configurar as chaves de API

Este guia mostra, passo a passo, como colocar as chaves de API no Couch Critics. É para os admins da comunidade e não assume nada: se travar, vá direto para **Solução de problemas**, no final.

Ainda não tem as chaves? Veja [Como conseguir as chaves de API](chaves-de-api.pt.md). Esta página começa quando você já está com elas.

---

## A versão curta

1. Abra o Couch Critics na sua comunidade e clique em **Configurações**, no topo.
2. Cole cada chave no seu bloco e clique em **Salvar**.
3. Confira se cada bloco mostra **Configurada**.

É isso. O resto da página explica cada passo em detalhes.

---

## 1. Abrir a tela de Configurações

1. Na sua comunidade, abra o **Couch Critics**.
2. No topo do app, ao lado do botão **Adicionar filme / série / jogo**, está o botão **Configurações**.
3. Clique nele. Abre um painel chamado **Fontes de dados**, logo abaixo.

### Não aparece o botão Configurações

Só os **admins do app** veem esse botão. Os admins são escolhidos na instalação do app, na configuração chamada **App admins** (pessoas e cargos).

- Peça a quem instalou o app para incluir você (ou o seu cargo) em **App admins**, nas configurações do app no Root.
- Depois disso, feche o app e abra de novo.
- Se nunca ninguém foi escolhido como admin, a tela mostra o aviso "Ninguém foi escolhido como admin do app. Quem salvar a primeira chave vira o admin." Nesse caso, a primeira pessoa que salvar uma chave vira o admin.

---

## 2. Para que serve cada bloco

São três blocos. Você não precisa de todos: cada um liga um recurso.

| Bloco | O que liga | O que colar | Se você pular |
|---|---|---|---|
| **TMDB (filmes e séries)** | Busca de filmes e séries pelo nome, capas, nomes em português e inglês, lista de episódios | Um texto bem comprido (o **API Read Access Token**) | Sem busca de filmes e séries. Dá para adicionar à mão, sem capa |
| **OMDb (nota do IMDb)** | A notinha do IMDb ao lado da média e a nota do IMDb de cada episódio | Uma chave curta que chega por e-mail | Tudo funciona, só sem as notas do IMDb |
| **IGDB (jogos)** | Busca de jogos pelo nome e capas dos jogos | Duas coisas: **Client ID** e **Client Secret** | Sem busca de jogos. Dá para adicionar à mão, sem capa |

Cada bloco mostra o estado no canto direito: **Não configurada** ou **Configurada**.

---

## 3. Colar as chaves

Os passos são iguais para todos os blocos.

1. Clique dentro do campo.
2. Cole a chave (Ctrl+V no Windows, Cmd+V no Mac).
3. O campo esconde o que você cola, como numa senha. Clique em **Mostrar** para ver e conferir se está certo, e em **Ocultar** para esconder de novo.
4. Clique em **Salvar**.
5. Espere um ou dois segundos. O app confere a chave com o serviço antes de guardá-la.
6. Deve aparecer **Salvo.** embaixo do campo, e o bloco deve mostrar **Configurada**. O campo fica vazio de propósito: por segurança, uma chave salva nunca é mostrada de novo.

O botão **Salvar** fica cinza enquanto o campo estiver vazio. No bloco do IGDB, ele fica cinza até **os dois** campos estarem preenchidos.

### Bloco TMDB

- Cole o **API Read Access Token**. É um texto muito comprido, com centenas de caracteres, que começa com `eyJ`.
- Se você só tem a **API Key** curta (uns 32 caracteres entre letras e números), ela também funciona. O token comprido é o recomendado.
- Cole só o texto, sem espaços nem quebras de linha antes ou depois.

### Bloco OMDb

- Cole só a chave que veio no e-mail. Ela é curta, uns 8 caracteres entre letras e números, por exemplo `a1b2c3d4`.
- O e-mail também traz um link que tem `apikey=`. **Não cole o link.** Cole só o que vem depois de `apikey=`.
- Se você acabou de pedir a chave, clique antes no link de ativação do e-mail. A chave pode não funcionar antes disso.

### Bloco IGDB (dois campos)

- **Client ID:** o código que a Twitch mostra na página **Manage** do seu aplicativo. Uns 30 caracteres entre letras e números.
- **Client Secret:** o código que você recebe ao clicar em **New Secret** nessa mesma página. Uns 30 caracteres entre letras e números.
- **Os dois são obrigatórios.** O app salva os dois juntos, com o único botão **Salvar** desse bloco.
- O Client Secret aparece só uma vez na página da Twitch. Se você não copiou, clique em **New Secret** na Twitch e use o novo.

---

## Opcional: livros, animes e álbuns

Abaixo dos três blocos de chaves há um bloco **Categorias** com três caixas: **Livros (Open Library)**, **Animes (AniList)** e **Álbuns (MusicBrainz)**.

- Elas são opcionais e **não precisam de chave nenhuma**: os serviços são gratuitos e abertos.
- Marque as que a comunidade quer usar. Cada caixa grava na hora, e uma aba nova aparece para todo mundo.
- Desmarque uma caixa para esconder a aba. Os títulos que já foram adicionados ficam guardados e voltam se você marcar de novo.
- Os animes também são achados pelo nome original (por exemplo "Shingeki no Kyojin"). Nem todo livro ou álbum tem capa.

---

## 4. O que significam os estados e as mensagens

### Estado de cada bloco (canto direito do bloco)

| Você vê | Significa |
|---|---|
| **Não configurada** | Nenhuma chave salva. Esse recurso está desligado |
| **Configurada** | A chave foi conferida e salva. O recurso está ligado |
| **Recusada pelo serviço** | O serviço recusou a chave. Uma chave que já estava salva antes continua valendo até ser trocada; a nova **não** foi salva |
| **Salva, mas não deu para conferir agora** | A chave foi salva, mas o serviço não respondeu (fora do ar ou sem internet). Teste uma busca daqui a alguns minutos |

### Mensagens embaixo do campo

| Mensagem | O que fazer |
|---|---|
| **Salvo.** | Pronto |
| **O serviço recusou essa chave. Confira se copiou inteira.** | A chave está errada ou incompleta. Copie de novo da página original e cole outra vez. Veja "Erros mais comuns" abaixo |
| **Isso não parece uma chave válida. Copie de novo, sem espaços.** | O texto tem o formato errado: espaços no meio, um link no lugar da chave, ou falta um pedaço |
| **Só admins do app podem mudar essas configurações.** | Sua conta não é admin. Veja "Não aparece o botão Configurações" |

### Erros mais comuns

- **Copiar só um pedaço da chave.** Clique três vezes no texto para selecionar tudo, ou use o botão de copiar do site, se houver.
- **Colar o link inteiro** do e-mail do OMDb. Cole só a parte depois de `apikey=`.
- **Colar a chave no bloco errado.** O bloco TMDB recebe o token do TMDB; o bloco IGDB recebe os códigos da Twitch.
- **Trocar os dois campos do IGDB.** O Client ID vai em **Client ID** e o Client Secret em **Client Secret**.
- **Secret que foi gerado de novo.** Se você clicou em **New Secret** na Twitch, o Client Secret antigo parou de funcionar. Cole o novo.
- **Espaços ou quebra de linha** no começo ou no fim. O app tira esses, mas caracteres a mais no meio estragam a chave.
- **Chave do site errado.** Cada bloco recebe a chave do seu próprio site: themoviedb.org, omdbapi.com, dev.twitch.tv.

---

## 5. Conferir se funcionou

1. Vá na aba **Filmes** e clique em **Adicionar filme**. Digite um título, por exemplo `parasita`. Devem aparecer resultados com capa.
2. Vá na aba **Jogos** e clique em **Adicionar jogo**. Digite um título, por exemplo `zelda`. Devem aparecer resultados com capa.
3. Adicione um filme. Uma notinha **IMDb** deve aparecer abaixo da média. Pode demorar um pouco, e títulos adicionados à mão nunca têm essa nota.
4. Abra uma série que veio da busca e clique em **Avaliar por episódio**. Os episódios aparecem, com a nota do IMDb de cada um.

Se a busca disser que a fonte não foi ativada, volte em **Configurações** e confira aquele bloco.

---

## 6. Trocar ou remover uma chave

- **Trocar:** cole a chave nova no mesmo bloco e clique em **Salvar**. A antiga só é substituída se a nova for aceita.
- **Remover:** clique em **Remover chave**, embaixo do bloco. O recurso desliga, e os títulos já adicionados continuam na lista.
- **Depois de um vazamento:** gere uma chave nova no site original (veja o guia das chaves) e cole aqui. Depois, nesse site, apague ou revogue a chave antiga sempre que o site permitir. Na Twitch, **New Secret** já cancela o Client Secret antigo.

---

## 7. Mantendo as chaves seguras

- Trate as chaves como senhas. Não poste em chats, em canais da comunidade nem em prints.
- Use **Mostrar** só quando ninguém estiver vendo ou gravando a sua tela.
- Depois de salva, uma chave nunca pode ser lida de volta no app, só trocada ou removida.
- Se você postou uma chave sem querer, gere outra na hora e cole aqui.

---

## 8. Solução de problemas

| Problema | Por que acontece | O que fazer |
|---|---|---|
| Não tem o botão **Configurações** | Você não é admin do app | Veja a seção 1 |
| **Salvar** fica cinza | O campo está vazio (ou um dos dois campos do IGDB) | Preencha tudo |
| "O serviço recusou essa chave" | Chave errada, incompleta ou vencida | Copie de novo do site original, ou gere outra |
| "Isso não parece uma chave válida" | Espaços, um link, ou caracteres faltando | Cole só a chave em si |
| "A busca ainda não foi ativada" ao adicionar | A chave daquela fonte nunca foi salva | Um admin precisa colar em Configurações |
| "O TMDB (ou IGDB) recusou a chave. Um admin precisa trocá-la" | Uma chave salva deixou de funcionar, por exemplo depois de **New Secret** | Cole uma chave nova |
| "O TMDB (ou IGDB) está limitando as consultas agora" | Consultas demais em pouco tempo | Espere alguns minutos |
| "Não foi possível falar com o TMDB (ou IGDB) agora" | O serviço está fora do ar, ou a conexão falhou | Tente de novo daqui a pouco |
| As notas do IMDb não aparecem | Falta a chave do OMDb, ou o limite do dia (1.000 consultas) acabou | Confira o bloco OMDb. O limite volta no dia seguinte, e as notas são preenchidas depois, sozinhas |
| Uma série diz que não tem lista de episódios | Ela foi adicionada à mão | Quem a adicionou pode removê-la (só essa pessoa pode) e adicionar de novo pela busca |
| Sem capas | O título foi adicionado à mão, ou falta a chave do TMDB/IGDB | Adicione pela busca |
| "Salva, mas não deu para conferir agora" | O serviço não respondeu | Espere alguns minutos e teste uma busca |

---

## 9. Perguntas frequentes

**Preciso pagar por alguma coisa?** Não. As três chaves são gratuitas para uso não comercial.

**Cada comunidade precisa das suas próprias chaves?** Sim. Cada comunidade cola as suas, para o uso de uma nunca atrasar o de outra.

**Preciso das três?** Não. Cada chave liga um recurso, como mostra a tabela da seção 2.

**Livros, animes e álbuns precisam de chave?** Não. É só marcar no bloco **Categorias**.

**Mais de um admin pode configurar as chaves?** Sim. Qualquer pessoa em **App admins** pode colar, trocar ou remover.

**O que acontece se o admin que salvou as chaves sair?** Nada. As chaves são da comunidade, não de uma pessoa. Outro admin pode trocá-las quando quiser.

**O app compartilha as minhas chaves?** Não. Elas ficam só no banco de dados da sua comunidade e são usadas pelo servidor do app para falar com o TMDB, o OMDb e o IGDB.

---

## Ainda travado?

Mande uma mensagem para quem mantém o Couch Critics (usuário do Root **MalphasW**) e conte:

- em qual bloco você está (TMDB, OMDb ou IGDB);
- a mensagem exata que aparece;
- o que você já tentou.

**Nunca mande a chave em si.**
