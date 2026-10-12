# Couch Critics

App do [Root](https://www.rootapp.com) em que os membros de uma comunidade dão nota juntos a filmes, séries, jogos, livros, animes e álbuns e veem as notas uns dos outros num só lugar.

English: [README.md](README.md). Licença: [MIT](LICENSE).

> O Couch Critics é um projeto independente. Não é um app oficial do Root e não é patrocinado, apoiado nem certificado pelo Root, TMDB, OMDb, IGDB, Twitch, Open Library, AniList ou MusicBrainz. Veja [NOTICE.md](NOTICE.md).

Observação: as pastas e os pacotes internos ainda se chamam `notas-app` (nome antigo do projeto). Isso não aparece para ninguém e não afeta o app.

- Qualquer membro adiciona um título e dá a sua nota (0 a 10, de 0,5 em 0,5), com comentário opcional.
- Cada membro tem uma nota por título e pode mudá-la ou removê-la.
- Notas especiais: **Peak** (acima de 10, conta como 10 na média) e **Rock Bottom** / **Fundo do poço** (abaixo de 0, conta como 0). Na barra de nota, são as duas pontas depois do 0 e do 10.
- Cada título mostra, na própria linha, a nota de até 4 membros (3 no celular), sem precisar abrir.
- Filmes e séries são buscados pelo nome, em português ou inglês, com capa. A nota do IMDb aparece pequena abaixo da média da comunidade, só por curiosidade. Se o título já foi adicionado, a busca avisa e leva até ele.
- Jogos também são buscados pelo nome (IGDB), com capa. Na tela em português aparece o nome em português quando o IGDB tem um (ex.: Deus da Guerra), e o original vem ao lado. O IGDB só tem nome em português para parte dos jogos; os outros aparecem com o nome original.
- Quando a busca não acha, dá para adicionar à mão (sem capa; filmes e séries também ficam sem a nota do IMDb).
- Cada título guarda o nome nos dois idiomas e mostra o do idioma da pessoa.
- Séries do TMDB têm nota geral e, se quiserem, nota por episódio: o botão "Avaliar por episódio" lista as temporadas e os episódios (nome e data no idioma da pessoa). Cada episódio mostra a nota do IMDb ou, quando o IMDb ainda não tem, a do TMDB (sublinhada, com a explicação). A média da série usa só a nota geral; a média dos episódios aparece à parte ("Episódios: 8,6").
- O comentário das notas (de títulos e de episódios) tem um botão de **Emojis** que coloca o emoji onde está o cursor.
- A média e as notas de cada pessoa atualizam na hora para todos.
- Quem adicionou um título (ou um admin do app) pode removê-lo. Títulos adicionados à mão também podem ter o nome e o ano editados.
- Ordenar por ano (mais novo ou mais antigo) e filtrar por **Ainda não avaliei**, para ver só o que falta você dar nota.
- Comentários podem ser marcados como **spoiler** (ficam escondidos até alguém clicar). Admins podem apagar o texto de um comentário; a nota da pessoa continua.
- Cada nota guarda a data (aparece ao passar o mouse na nota). Notas anteriores à 1.2 ficam sem data.
- O título aberto mostra sinopse e gêneros no idioma da pessoa, e as plataformas nos jogos. Títulos antigos recebem esses dados sozinhos, aos poucos, quando as chaves do TMDB e do IGDB estão configuradas. O IGDB só tem sinopse em inglês.
- **Livros** (Open Library), **animes** (AniList) e **álbuns** (MusicBrainz): categorias opcionais, sem chave de API. O admin liga as que quiser em Configurações, e cada uma ganha uma aba, busca com capa, autor ou artista, sinopse e gêneros.
- **Importar notas (CSV)** (rodapé): cada membro traz as próprias notas de uma planilha (vírgula, ponto e vírgula ou tab; o arquivo exportado pelo app também serve). O app casa cada linha com um título da busca, mostra o que achou para conferir e importa uma linha por vez. Linhas com nota ou categoria inválidas são ignoradas com o motivo.
- A lista chega do servidor em páginas (o Root limita cada mensagem a 256 KiB, e uma comunidade com algumas centenas de títulos passaria disso) e a tela mostra 30 títulos por vez, com "Mostrar mais".
- **Reações** nas notas dos outros (👍 😂 🔥 😮 ❤️), nos títulos e nos episódios. Clicar de novo no mesmo emoji tira a reação.
- **Quero ver / vendo / já vi** (nos jogos: quero jogar / jogando / já joguei): cada pessoa marca o seu estado, vê quem marcou o quê, e o filtro da lista mostra só o que está em cada estado.
- **Para ver / jogar** (visão ao lado de "Notas"): a lista da turma com tudo que alguém marcou "quero ver / jogar / ler / ouvir", de todas as categorias, com quem quer cada título. Quem tem mais gente querendo vem primeiro; dá para filtrar por categoria e por "só os que eu quero". Quando você marca "já vi" ou "joguei", o título sai só da sua lista (os outros continuam vendo; há um aviso com "Desfazer"). Dá para adicionar títulos direto dali (o título novo já entra como "quero" para quem adicionou).
- **Noite** (visão ao lado de "Para ver / jogar"): qualquer membro cria uma noite com nome (opcional), data e hora, prazo de votação e de 2 a 8 títulos da comunidade. Cada membro tem um voto (trocável até fechar; **o voto é aberto**, todos veem quem votou em quê) e responde Vou / Talvez / Não vou. A votação fecha no prazo ou por quem criou (ou um admin); a opção mais votada vence e, em caso de empate (ou se ninguém votou), quem criou escolhe entre as empatadas. O título escolhido aparece como "Noite marcada" nas listas. Seis horas depois do início a noite passa sozinha para "aconteceu" (ou "cancelada", se o empate nunca foi resolvido), e depois dela há um atalho para marcar "já vi / joguei" e dar a nota. Limites: 5 noites abertas na comunidade e 3 por pessoa. O servidor confere prazos a cada 30 segundos e também ao listar. O app usa as notificações do Root (sem permissão no manifesto): o indicador de atividade da comunidade quando uma noite abre ou fecha e um aviso para quem disse Vou ou Talvez quando a noite é decidida e cerca de 1 hora antes do início (pode depender do Root entregar a notificação; não testado no Root real).
- **Estatísticas** (rodapé), em duas abas. *Comunidade:* quem pensa parecido (compatibilidade entre membros com pelo menos 3 títulos em comum), notas por membro, os títulos que mais dividiram a turma e como as notas se distribuem. *Meu ano:* a retrospectiva de cada pessoa por ano (notas dadas, média, Peak e Rock Bottom, as mais altas, a opinião mais diferente da turma e o mês mais movimentado). A retrospectiva usa a data de cada nota; notas anteriores à 1.2 não têm data e não entram.
- **Hall da fama e da vergonha** (rodapé): os títulos com mais notas Peak e com mais notas Rock Bottom.
- **Exportar notas (CSV)** (rodapé): todas as notas da comunidade em uma planilha (nota, comentário, spoiler e data). Se o Root não permitir baixar arquivos dentro do app, o botão não terá efeito (ainda não testado no Root real).
- Português e inglês: o botão PT/EN no topo troca o idioma. Sem escolha salva, o app segue o idioma do sistema (português para quem usa português, inglês para os demais).

## Fontes de dados (chaves de API)

A busca usa o TMDB (filmes e séries) e o IGDB (jogos), e a nota do IMDb vem pelo OMDb. Livros, animes e álbuns usam a Open Library, a AniList e a MusicBrainz, que são gratuitas e **não precisam de chave**. As chaves são gratuitas e **cada comunidade usa as suas**. O IGDB é da Twitch: a chave é um par, o Client ID e o Client Secret de um aplicativo criado em dev.twitch.tv (a conta precisa de verificação em duas etapas):

1. Quem instala o app escolhe, na instalação, quem administra o Couch Critics (pessoas ou cargos). O dono da comunidade também é sempre admin. Se ninguém for escolhido, quem salvar a primeira chave vira o admin.
2. Os admins veem o botão **Configurações** no topo e colam as chaves lá. Elas ficam no banco da comunidade e nunca voltam para a tela.
3. Passo a passo para conseguir as chaves: [docs/chaves-de-api.pt.md](docs/chaves-de-api.pt.md) (português) e [docs/api-keys.en.md](docs/api-keys.en.md) (inglês).
4. Passo a passo para colocar as chaves no app, com o significado de cada mensagem e solução de problemas: [docs/como-configurar.pt.md](docs/como-configurar.pt.md) (português) e [docs/how-to-set-up.en.md](docs/how-to-set-up.en.md) (inglês).

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
- Troque o `User-Agent` em [`server/src/providers/catalog.ts`](server/src/providers/catalog.ts) para identificar o seu projeto: a MusicBrainz e a AniList pedem uma identificação própria e podem bloquear clientes abusivos
- Mantenha a atribuição do TMDB (o logo e o aviso na tela "Sobre e créditos") se usar a API do TMDB, e siga os termos de cada serviço que usar. A maioria é só para uso não comercial
- Troque o contato e os links da política de privacidade e dos guias

## Licença

[MIT](LICENSE). Os avisos de terceiros e o que a licença não cobre estão em [NOTICE.md](NOTICE.md).
