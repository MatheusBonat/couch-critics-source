# Couch Critics: guia de desenvolvimento

[← Voltar ao README](../README.pt.md)

## Fontes de dados (chaves de API)

A busca usa o TMDB (filmes e séries) e o IGDB (jogos), e a nota do IMDb vem pelo OMDb. Livros, animes e álbuns usam a Open Library, a AniList e a MusicBrainz, que são gratuitas e **não precisam de chave**. As chaves são gratuitas e **cada comunidade usa as suas**. O IGDB é da Twitch: a chave é um par, o Client ID e o Client Secret de um aplicativo criado em dev.twitch.tv (a conta precisa de verificação em duas etapas):

1. Quem instala o app escolhe, na instalação, quem administra o Couch Critics (pessoas ou cargos). O dono da comunidade também é sempre admin. Se ninguém for escolhido, quem salvar a primeira chave vira o admin.
2. Os admins veem o botão **Configurações** no topo e colam as chaves lá. Elas ficam no banco da comunidade e nunca voltam para a tela.
3. Passo a passo para conseguir as chaves: [chaves-de-api.pt.md](chaves-de-api.pt.md) (português) e [api-keys.en.md](api-keys.en.md) (inglês).
4. Passo a passo para colocar as chaves no app, com o significado de cada mensagem e solução de problemas: [como-configurar.pt.md](como-configurar.pt.md) (português) e [how-to-set-up.en.md](how-to-set-up.en.md) (inglês).

Quando um serviço recusa uma chave salva, o app avisa os admins no log do app dentro do Root. Sem chaves o app funciona, só com títulos adicionados à mão. A tela "Sobre e créditos" traz o aviso e o logo exigidos pelo TMDB e o crédito do IGDB.

Jogos: o servidor pede à Twitch um token de acesso com o Client ID e o Client Secret (guardado só na memória, renovado sozinho quando vence) e consulta o IGDB. A busca deixa de fora edições, DLCs e expansões. O Client Secret fica no banco da comunidade e nunca volta para a tela.

O servidor guarda as notas do IMDb e as busca de novo depois de uma semana, poucas por vez, por causa do limite de 1.000 consultas por dia do OMDb.

Episódios: ao adicionar uma série, o servidor já guarda as temporadas e a primeira temporada, então abrir a lista é instantâneo. Cada temporada (TMDB para nomes e datas, OMDb para a nota do IMDb, uma consulta por temporada) é buscada ao ser aberta pela primeira vez e atualizada depois de uma semana, sem perder as notas dos membros. Enquanto algum episódio estiver sem nota do IMDb, a consulta é repetida depois de 6 horas.

## Estrutura

| Pasta | O que tem |
|---|---|
| `networking/src/titles.proto` | Contrato entre tela e servidor. Depois de mexer nele, rode `npm run build`. |
| `server/src` | Regras, validação e banco SQLite (`titleService.ts`, `titleRepository.ts`). |
| `server/src/providers` | Conversa com o TMDB, o OMDb e o IGDB/Twitch (tempo limite, erros claros). |
| `server/src/access.ts` | Quem é admin do app. |
| `server/src/nightService.ts`, `nightRepository.ts` | A Noite: criar, votar, presença, fechar, desempatar, prazos, lembretes e noites passadas (em páginas). |
| `client/src/nights.ts` | Regras da Noite na tela (grupos, votos, empate, noite marcada, datas e formulário), com testes. |
| `client/src` | Tela em React. Usa as variáveis de cor do Root, então acompanha o tema claro/escuro. |
| `client/src/i18n.tsx` | Todos os textos da tela, em português e inglês. Para mudar uma frase ou acrescentar um idioma, é aqui. |

## Rodar para testar

1. No portal dev (dev.rootapp.com), crie um app, abra-o em **My apps**, vá em **Settings** e clique em **Generate new dev token**. Coloque o ID do seu app no campo `id` de `root-manifest.json`.
2. Copie `server/.env.example` para `server/.env` e cole o token nele, numa linha só. Cuidado para não repetir o prefixo: o token é o que vem depois do `=`. Esse arquivo fica fora do git.

```
DEV_TOKEN=cole_o_token_aqui
```

3. Na pasta do projeto:

```bash
npm install
npm run build
```

4. Em um terminal, `npm run server` dentro de `server/`. Em outro, `npm run client` dentro de `client/`. A tela abre em http://localhost:5173.

Dicas do ambiente de teste:

- A barra no topo da tela troca o usuário virtual. Abra a tela em duas janelas para simular dois membros.
- Os usuários virtuais não têm perfil, então o nome aparece como "Membro". Numa comunidade real aparecem o apelido e a foto.
- Os dados ficam em `server/rootsdk.sqlite3`. Apague esse arquivo (com o servidor parado) para zerar o teste.
- O `DEV_TOKEN` vale para uma comunidade. Para testar em outra, gere um novo.
- Se mexer no `.ts` do servidor, rode `npm run build` e reinicie o `npm run server`.

## Publicar a sua versão

1. Use o ID do seu app em `root-manifest.json` e suba o `version`: o Root recusa um envio com a versão de um que já existe.
2. Empacote e envie (o token é o de **Settings → Tokens** do portal, diferente do `DEV_TOKEN`):

```bash
npm install && npm run build
npm run package
npx rootsdk upload package --file ./rootapp.pkg --authToken <AUTH_TOKEN> --host dev.rootapp.com
```

Use sempre `npm run package` (e não `rootsdk build package` direto): o empacotador leva a pasta `node_modules` inteira, e `node_modules/@notas-app/server` é um atalho para `server/`, então o pacote levaria o `server/.env` (DEV_TOKEN) e o banco de testes `server/rootsdk.sqlite3` (que guarda as chaves de API coladas na tela de Configurações). O script `scripts/package.cjs` tira esses arquivos do lugar, empacota, confere o pacote (e o apaga se achar algum segredo) e devolve os arquivos. Pare o servidor de teste antes.

O pacote sai com cerca de 53 MB porque leva a pasta `node_modules` inteira (inclui ferramentas só de desenvolvimento). Não encontrei limite de tamanho na documentação do Root.

## Se você fizer um fork

- Use o seu próprio ID de app, nome e logo. O nome "Couch Critics" e o logo não estão cobertos pela licença MIT
- Troque o `User-Agent` em [`server/src/providers/catalog.ts`](../server/src/providers/catalog.ts) para identificar o seu projeto: a MusicBrainz e a AniList pedem uma identificação própria e podem bloquear clientes abusivos
- Mantenha a atribuição do TMDB (o logo e o aviso na tela "Sobre e créditos") se usar a API do TMDB, e siga os termos de cada serviço que usar. A maioria é só para uso não comercial
- Troque o contato e os links da política de privacidade e dos guias
