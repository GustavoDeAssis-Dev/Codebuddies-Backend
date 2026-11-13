# CodeBuddies — Back-end (API)

API REST da plataforma educacional gamificada **CodeBuddies** (crianças de 5 a 8 anos).
Responsável: **Gustavo De Assis Vieira Dos Santos** — FEMA/IMESA, Análise e Desenvolvimento de Sistemas, 2026.

## Progresso

| Etapa                                            | Situação     |
| ------------------------------------------------ | ------------ |
| 1. Linguagem, framework e estrutura              | ✅ concluída |
| 2. Regras de negócio                             | ✅ concluída |
| 3. Autenticação e autorização                    | ✅ concluída |
| 4. Operações CRUD                                | ✅ concluída |
| 5. Integração com o banco Oracle (com Leonardo)  | ✅ concluída |
| 6. Gerenciamento de fases e desafios             | ⏳ próxima   |
| 7. Registro de respostas, tentativas e progresso | ⬜           |
| 8. Pontuação, estrelas e recompensas             | ⬜           |
| 9. Dados para o front-end                        | ⬜           |
| 10. Tratamento de erros e validação              | ⬜           |
| 11. Validação com os integrantes                 | ⬜           |
| 12. Produção                                     | ⬜           |

## Stack

| Camada          | Tecnologia                                      | Versão      | Por quê                                                                                                                      |
| --------------- | ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | **Node.js**                                     | 22 LTS      | Já instalado na equipe; LTS (suporte longo); lê `.env` nativamente (`--env-file`).                                           |
| Linguagem       | **TypeScript**                                  | 6.0         | Mesma linguagem do front-end Angular → tipos e conceitos compartilhados; erros pegos antes de rodar.                         |
| Framework HTTP  | **Express**                                     | 5.x         | O framework Node mais usado e documentado; a versão 5 trata erros de funções `async` automaticamente.                        |
| Validação       | **Zod**                                         | 4.x         | Valida entradas (nome, idade, respostas) e variáveis de ambiente, gerando os tipos TypeScript automaticamente.               |
| Segurança HTTP  | **Helmet**                                      | 8.x         | Define cabeçalhos HTTP de segurança.                                                                                         |
| CORS            | **cors**                                        | 2.x         | Permite que o front-end Angular (outra porta/endereço) chame a API.                                                          |
| Tokens          | **jsonwebtoken** (JWT)                          | 9.x         | Gera e confere o "crachá" de quem está logado (professor ou aluno).                                                          |
| Senhas          | **bcryptjs**                                    | 3.x         | Guarda só o hash da senha do professor — nunca a senha pura.                                                                 |
| Limite de login | **express-rate-limit**                          | 8.x         | Máximo de 5 tentativas de login por minuto, contra quem tenta adivinhar senhas.                                              |
| Logs            | **Pino** + **pino-http** (+ pino-pretty em dev) | 10.x / 11.x | Logs estruturados e rápidos de cada requisição.                                                                              |
| Testes          | **Vitest** + **Supertest**                      | 5.x / 7.x   | Testes automatizados das regras e das rotas, sem precisar abrir porta.                                                       |
| Execução em dev | **tsx**                                         | 4.x         | Roda TypeScript direto e reinicia ao salvar (`watch`).                                                                       |
| Qualidade       | **ESLint** (+ typescript-eslint) e **Prettier** | 10.x / 3.x  | Padroniza e revisa o código.                                                                                                 |
| ORM             | **TypeORM**                                     | 1.x         | Entidades com **anotações**, `DataSource` (classe de contexto), relacionamentos e transações — o "Entity Framework do Node". |
| Driver do banco | **oracledb** (modo _thin_)                      | 6.x         | Driver oficial da Oracle; não exige instalar o Oracle Client.                                                                |
| Anotações       | **reflect-metadata**                            | 0.2         | Necessária para os decorators (`@Entity`, `@Column`...) do TypeORM.                                                          |

_O Prisma foi descartado porque não suporta Oracle; o Knex, porque não é um ORM (a disciplina pede ORM, anotações e classe de contexto)._

## Arquitetura

```
src/
├── server.ts                  # sobe o servidor e cria o professor inicial do .env
├── app.ts                     # monta o Express: middlewares, rotas, erros
├── routes.ts                  # registra as rotas de todos os módulos em /api
├── config/
│   └── env.ts                 # variáveis de ambiente validadas com Zod
├── database/                  # ORM (Etapa 5)
│   ├── data-source.ts         # DataSource = "classe de contexto" (conexão + entidades)
│   └── entidades.ts           # 12 classes com anotações, uma por tabela do Oracle
├── domain/                    # O CORAÇÃO: não depende de Express nem de banco
│   ├── entidades.ts           # Turma, Sessao, Aluno, Fase, Tentativa, Progresso, Professor...
│   └── regras/                # regras puras (fáceis de testar)
│       ├── estrelas.ts        # % de acertos → 0 a 5 estrelas; aprovação
│       ├── progressao.ts      # mapa de fases, desbloqueio, nível atual, consolidação do progresso
│       ├── ranking.ts         # critério e ordenação do ranking
│       └── identificacao.ts   # normalização do nome do aluno
├── modules/                   # casos de uso por funcionalidade
│   ├── health/                # GET /api/health
│   ├── auth/                  # login do professor, entrada do aluno, "quem sou eu"
│   ├── professores/           # cadastrar, listar, ativar/desativar, trocar senha
│   ├── turmas/                # CRUD de turmas
│   ├── sessoes/               # criar / listar / abrir / encerrar aula
│   ├── alunos/                # entrada, correção de dados, desativar / reativar
│   ├── progresso/             # mapa de fases do aluno
│   ├── tentativas/            # registrar fim de fase (estrelas, melhor tentativa)
│   └── ranking/               # gerar (no encerramento) e consultar ranking
├── repositories/
│   ├── contratos.ts           # interfaces de acesso a dados (+ transação)
│   ├── memoria/               # implementação em memória (testes automáticos)
│   └── oracle/                # implementação Oracle (TypeORM)
│       ├── index.ts           # consultas, chamadas às procedures e transação
│       ├── mapeadores.ts      # entidade do banco → tipo do domínio
│       └── erros-oracle.ts    # ORA-200xx / ORA-00001 → erros de negócio
├── types/
│   └── express.d.ts           # adiciona `req.usuario` ao tipo Request do Express
└── shared/
    ├── contexto.ts            # dependências injetadas nos services
    ├── logger.ts
    ├── auth/                  # senha.ts (bcrypt) e token.ts (JWT)
    ├── errors/                # AppError + catálogo de códigos de erro (erros.ts)
    ├── http/params.ts         # lerId(): lê e valida o :id da URL
    └── middlewares/           # autenticar, exigirPerfil, erros e 404
scripts/
├── testar-conexao.ts          # npm run db:testar   → conecta e lista as tabelas
└── verificar-oracle.ts        # npm run db:verificar → aula completa no Oracle, com ROLLBACK no final
tests/
├── health.test.ts             # estrutura base
├── regras.test.ts             # regras puras
├── fluxo-aula.test.ts         # CA01–CA10 do levantamento de requisitos
├── auth.test.ts               # login, tokens e permissões
├── crud.test.ts               # rotas CRUD pela API
├── entidades.test.ts          # anotações do TypeORM (sem conectar)
└── erros-oracle.test.ts       # tradução dos erros do Oracle
```

As regras de negócio só conversam com os **contratos** de repositório, atendidos por duas implementações: **memória** (testes automáticos) e **Oracle** (uso real). A escolha é feita no `.env` (`BANCO=memoria` ou `BANCO=oracle`), em um único lugar: `src/shared/contexto.ts`. Trocar a memória pelo Oracle não exigiu mudar nenhuma regra, rota ou teste.

Cada módulo segue o padrão:

```
modules/<nome>/
├── <nome>.routes.ts    # URLs, verbos HTTP e quem pode acessar
├── <nome>.service.ts   # REGRAS DE NEGÓCIO
└── <nome>.schemas.ts   # validação Zod das entradas
```

## Regras de negócio (Etapa 2)

### Decisões da equipe

- **Estrelas = porcentagem de acertos**, calculada no servidor: `acertos / (acertos + erros)`, arredondada para baixo. Toda resposta conta, inclusive as erradas antes de acertar.

  | Acertos  | Estrelas      |
  | -------- | ------------- |
  | ≥ 90%    | 5             |
  | 75 – 89% | 4             |
  | 60 – 74% | 3 ✅ aprovado |
  | 40 – 59% | 2             |
  | 20 – 39% | 1             |
  | < 20%    | 0             |

  O tempo **não** influencia as estrelas (sem pressão para a criança); serve só como desempate no ranking.

- **Progresso guardado por turma (Opção B).** Cada aula é uma sessão de uma turma. O aluno é reconhecido por _nome + idade_ dentro da turma (ignorando acentos, maiúsculas e espaços) e continua de onde parou na aula seguinte. As tentativas ficam ligadas à sessão, para o relatório de cada aula.
- **Ranking da aula**: 1º nível alcançado → 2º estrelas ganhas **nesta aula** → 3º menor tempo. Empate total divide a posição. Gerado e congelado no encerramento. Alterável em `src/domain/regras/ranking.ts`.
- **Pontos:** 100 por resposta certa (igual ao `DEFAULT` de `DESAFIO.PONTOS`). Na Etapa 7 passam a vir dos desafios.
- **Idade permitida:** 4 a 15 anos (igual ao `CHECK` do banco). Status inicial da aula: `CRIADA`. Sem personagem/mascote.
- **Aniversário entre aulas:** se a criança digitar a nova idade, ela vira outro aluno. Solução (Etapa 4): o professor corrige a idade em `PATCH /api/alunos/:id` e ela volta a ser reconhecida.

### Rastreabilidade (requisito → código)

| Requisito                                                      | Onde                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RN01 sessão única aberta                                       | `SessoesService.abrir` + `PRC_ABRIR_SESSAO` + índice `UX_SESSAO_ABERTA`   |
| RN02 / CA01 entrada só com sessão aberta                       | `SessoesService.exigirAberta`                                             |
| RN03 / CA02 nome e idade obrigatórios                          | `alunos.schemas.ts`                                                       |
| RN04 / RF-P03 / CA03 recuperar perfil sem duplicar             | `AlunosService.entrar`, `regras/identificacao.ts`                         |
| RN05 / RN09 / RN12 / CA04 estrelas 0–5 e aprovação ≥ 3         | `regras/estrelas.ts`, `TentativasService.registrar`                       |
| RN06 / RN15 / CA07 melhor tentativa                            | trigger `TRG_ATUALIZA_PROGRESSO_OFICIAL` (memória: `consolidarProgresso`) |
| RN07 / RN11 / RN13 / RN14 / CA05 / CA06 desbloqueio sequencial | `regras/progressao.ts`                                                    |
| RN08 / CA08 / CA09 / RF-D12 ranking só ao encerrar, congelado  | `RankingService`, `SessoesService.encerrar`                               |
| RN10 / CA10 desativar mantendo dados                           | `AlunosService.desativar`, `RankingService.gerar`                         |
| RF-D05 bloquear entradas após encerrar                         | `SessoesService.exigirAberta`                                             |
| RF-D01 login do docente                                        | `AuthService.loginProfessor`                                              |
| RF-D02 / RF-D03 / RF-D04 criar, abrir e encerrar aula          | `sessoes.routes.ts` → `SessoesService`                                    |
| RF-D07 listar alunos da sessão                                 | `AlunosService.listarDaSessao`                                            |
| RF-D08 desativar / reativar aluno                              | `alunos.routes.ts` → `AlunosService`                                      |

## Autenticação e autorização (Etapa 3)

- **Autenticação** = "quem é você?" · **Autorização** = "o que você pode fazer?"
- **Professor** entra com **e-mail + senha**. A senha é guardada como hash **bcrypt**. Recebe um **token JWT** válido por 8 h.
- **Aluno** entra com **nome + idade** (sem senha) e recebe um token JWT ligado à aula aberta. O servidor usa o id do aluno **de dentro do token** — nunca do que o front envia — para ninguém jogar no lugar do colega.
- **Decisão da equipe:** não há perfil ADMIN separado — **todo professor pode tudo**.
- O front envia o token em todas as requisições protegidas: `Authorization: Bearer <token>`.
- Middlewares: `autenticar` (confere o token) e `exigirPerfil('PROFESSOR')` (confere o perfil).
- Login do professor limitado a **5 tentativas por minuto** por computador.
- Erro de login é sempre o mesmo (`CREDENCIAIS_INVALIDAS`), para não revelar quais e-mails existem.

| Ação                                           | Aluno          | Professor |
| ---------------------------------------------- | -------------- | --------- |
| Ver se há aula aberta, entrar com nome + idade | ✅             | ✅        |
| Ver o próprio mapa de fases, jogar, registrar  | ✅ (só o dele) | —         |
| Ver o ranking depois que a aula acaba          | ✅             | ✅        |
| Criar turma, abrir/encerrar aula               | ❌             | ✅        |
| Listar alunos, desativar/reativar              | ❌             | ✅        |
| Ver métricas e relatórios                      | ❌             | ✅        |

## Rotas da API (Etapas 3 e 4)

Nada é apagado: turmas, alunos e professores são **desativados**, para manter o histórico (RN10).

| Método | Rota                            | Acesso    | Descrição                                                                           |
| ------ | ------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/health`                   | público   | Servidor no ar?                                                                     |
| POST   | `/api/auth/professor/login`     | público   | `{ email, senha }` → `{ token, professor }`                                         |
| POST   | `/api/auth/aluno/entrar`        | público   | `{ nome, idade }` → `{ token, aluno, sessao, novo }` (201 = novo, 200 = recuperado) |
| GET    | `/api/auth/eu`                  | logado    | Dados de quem está logado                                                           |
| GET    | `/api/professores`              | professor | Lista professores (sem hash de senha)                                               |
| POST   | `/api/professores`              | professor | Cadastra professor `{ nome, email, senha }`                                         |
| PUT    | `/api/professores/eu/senha`     | professor | Troca a própria senha `{ senhaAtual, novaSenha }` → 204                             |
| PATCH  | `/api/professores/:id`          | professor | Ativa/desativa `{ ativo }` (não pode desativar a si mesmo)                          |
| POST   | `/api/turmas`                   | professor | Cria turma `{ nome }`                                                               |
| GET    | `/api/turmas`                   | professor | Lista turmas (ordem alfabética)                                                     |
| GET    | `/api/turmas/:id`               | professor | Detalhe da turma                                                                    |
| PATCH  | `/api/turmas/:id`               | professor | Renomeia / desativa `{ nome?, ativa? }`                                             |
| GET    | `/api/turmas/:id/alunos`        | professor | Alunos da turma (ativos e desativados)                                              |
| GET    | `/api/sessoes/aberta`           | público   | `{ aberta: false }` ou `{ aberta: true, sessao: { id, turmaNome, ... } }` (CA01)    |
| POST   | `/api/sessoes`                  | professor | Cria aula `{ turmaId }` com status `CRIADA` (guarda o professor do token)           |
| GET    | `/api/sessoes?turmaId=&status=` | professor | Lista aulas (mais recentes primeiro)                                                |
| GET    | `/api/sessoes/:id`              | professor | Detalhe da aula                                                                     |
| POST   | `/api/sessoes/:id/abrir`        | professor | Abre a aula (RN01: só uma aberta)                                                   |
| POST   | `/api/sessoes/:id/encerrar`     | professor | Encerra e devolve `{ sessao, ranking }`                                             |
| GET    | `/api/sessoes/:id/alunos`       | professor | Alunos que entraram na aula (RF-D07)                                                |
| GET    | `/api/sessoes/:id/ranking`      | logado    | Ranking final — só após encerrar (RN08)                                             |
| GET    | `/api/alunos/:id`               | professor | Detalhe do aluno                                                                    |
| PATCH  | `/api/alunos/:id`               | professor | Corrige `{ nome?, idade? }` (RN04 continua valendo)                                 |
| POST   | `/api/alunos/:id/desativar`     | professor | Desativa (RN10)                                                                     |
| POST   | `/api/alunos/:id/reativar`      | professor | Reativa                                                                             |

## Formato padrão de erro

```json
{ "error": { "code": "SESSAO_FECHADA", "message": "Aguardando professor iniciar a aula." } }
```

O `code` é estável, para o front-end decidir qual mensagem/ícone mostrar à criança. Todos os códigos ficam em `src/shared/errors/erros.ts`.

| HTTP | Significado                        | Exemplos                                                                              |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| 400  | Dados inválidos                    | `DADOS_INVALIDOS`, `JSON_INVALIDO`                                                    |
| 401  | Não sei quem você é                | `NAO_AUTENTICADO`, `TOKEN_INVALIDO`, `CREDENCIAIS_INVALIDAS`                          |
| 403  | Sei quem você é, mas você não pode | `SEM_PERMISSAO`, `SESSAO_FECHADA`, `FASE_BLOQUEADA`                                   |
| 404  | Não encontrado                     | `SESSAO_NAO_ENCONTRADA`, `ROTA_NAO_ENCONTRADA`                                        |
| 409  | Conflito com o estado atual        | `OUTRA_SESSAO_ABERTA`, `SESSAO_ENCERRADA`, `ALUNO_JA_EXISTE`, `TURMA_COM_AULA_ABERTA` |
| 429  | Muitas tentativas                  | `MUITAS_TENTATIVAS`                                                                   |

## Banco de dados Oracle (Etapa 5)

Modelo do Leonardo + script de migração para a Opção B (`docs/banco/migracao_opcao_b.sql`): **12 tabelas** — `PROFESSOR`, `TURMA`, `SESSAO_AULA`, `ALUNO`, `PARTICIPACAO`, `NIVEL`, `FASE`, `DESAFIO`, `TENTATIVA_FASE`, `RESPOSTA_DESAFIO`, `PROGRESSO_FASE`, `RANKING_SESSAO`.

Divisão de responsabilidades ("cada regra tem um dono"):

| Regra                                   | Dono                                                                       | O back-end…                                       |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Abrir / encerrar aula, RN01             | Procedures `PRC_ABRIR_SESSAO` / `PRC_ENCERRAR_SESSAO` + `UX_SESSAO_ABERTA` | valida antes (mensagem clara) e chama a procedure |
| Melhor resultado por fase (RN06/RN15)   | Trigger `TRG_ATUALIZA_PROGRESSO_OFICIAL`                                   | só grava a tentativa e lê o progresso             |
| Estrelas, desbloqueio, ranking, nomes   | Back-end (`src/domain/regras`)                                             | calcula e grava                                   |
| Unicidade (aluno, e-mail, participação) | `UNIQUE` / `PRIMARY KEY` no banco                                          | verifica antes e traduz o `ORA-00001`             |

- As procedures **não** dão `COMMIT`: o back controla a transação. Ex.: encerrar a aula + gravar o ranking acontecem juntos (`repos.transacao`) — ou tudo, ou nada.
- Erros do Oracle são traduzidos em `src/repositories/oracle/erros-oracle.ts` (ex.: `ORA-20014` → `OUTRA_SESSAO_ABERTA`), então o front recebe os mesmos códigos com memória ou Oracle.
- `synchronize: false`: o TypeORM **nunca** altera tabelas; a estrutura é dos scripts SQL.
- Verificação completa no banco real, sem gravar nada: `npm run db:verificar`.

## Conteúdos da disciplina × projeto

| Conteúdo da disciplina                                | Onde aparece                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Frameworks / MVC / programação em camadas             | Express; `routes` (controller) → `service` → `repositories` → `domain`        |
| Camada de persistência / ORM / contexto               | `repositories/oracle`; TypeORM + `DataSource` (`src/database/data-source.ts`) |
| Classes de domínio e anotações                        | `domain/entidades.ts`; `src/database/entidades.ts` (`@Entity`, `@Column`...)  |
| Consultas (LINQ)                                      | `find`, `findBy`, `relations`, `existsBy` do TypeORM (`repositories/oracle`)  |
| Transações                                            | `repos.transacao(...)` no encerramento da aula                                |
| Manter dados (CRUD)                                   | Etapa 4                                                                       |
| Relacionamento e movimentação entre tabelas           | Turma → Sessão → Participação ← Aluno → Tentativa → Progresso                 |
| Segurança (autenticação e autorização)                | Etapa 3                                                                       |
| Gerar / filtrar dados                                 | Ranking gerado no encerramento; filtros de sessões                            |
| Soma, média, contagem, máx., mín., agrupamento, pivot | Relatórios do professor (Etapa 9): por aluno, por fase e matriz aluno × fase  |
| Views                                                 | Angular (front-end, Dhérick)                                                  |
| Projeto web + GitHub                                  | Repositório privado do back-end                                               |

## Configuração (`.env`)

Copie `.env.example` para `.env` e ajuste. O `.env` **nunca** vai para o GitHub.

| Variável                                          | Para quê                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `PORT`, `HOST`                                    | Porta e endereço do servidor (`0.0.0.0` = acessível pela rede da escola) |
| `CORS_ORIGIN`                                     | Endereço(s) do front-end Angular                                         |
| `JWT_SECRET`                                      | Chave que assina os tokens (mínimo 32 caracteres, aleatória)             |
| `JWT_EXPIRACAO_PROFESSOR` / `JWT_EXPIRACAO_ALUNO` | Validade dos tokens (padrão 8h / 4h)                                     |
| `PROFESSOR_INICIAL_*`                             | Professor criado ao subir o servidor, se ainda não existir               |
| `BANCO`                                           | `memoria` (dados somem ao reiniciar) ou `oracle`                         |
| `DB_USER`, `DB_PASSWORD`, `DB_CONNECT_STRING`     | Acesso ao Oracle (ex.: `servidor:1521/ORCL`)                             |
| `DB_LOGGING`                                      | `true` mostra no terminal cada SQL executado (bom para estudar)          |

Gerar uma chave: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Como rodar

Pré-requisito: Node.js 22.12 ou superior.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env  (depois gere o JWT_SECRET)
npm run dev               # desenvolvimento (reinicia ao salvar)
```

Teste: abrir `http://localhost:3333/api/health` no navegador.

| Comando                       | O que faz                                               |
| ----------------------------- | ------------------------------------------------------- |
| `npm run dev`                 | Roda em modo desenvolvimento                            |
| `npm test`                    | Roda os testes automatizados                            |
| `npm run typecheck`           | Verifica os tipos TypeScript                            |
| `npm run lint`                | Verifica a qualidade do código                          |
| `npm run format`              | Formata o código                                        |
| `npm run build` e `npm start` | Compila para `dist/` e roda em produção                 |
| `npm run db:testar`           | Testa a conexão e lista as tabelas                      |
| `npm run db:verificar`        | Roda uma aula completa no Oracle e desfaz tudo no final |

## Uso na sala de aula

O servidor escuta em `0.0.0.0`, então os computadores do laboratório podem acessar a API pelo IP da máquina do professor na rede local (ex.: `http://192.168.0.10:3333/api`).
