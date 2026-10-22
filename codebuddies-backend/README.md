# CodeBuddies — Back-end (API)

API REST da plataforma educacional gamificada **CodeBuddies** (crianças de 5 a 8 anos).
Responsável: **Gustavo De Assis Vieira Dos Santos** — FEMA/IMESA, Análise e Desenvolvimento de Sistemas, 2026.

## Stack escolhida (Etapa 1)

| Camada          | Tecnologia                                      | Versão      | Por quê                                                                                                        |
| --------------- | ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime         | **Node.js**                                     | 22 LTS      | Já instalado na equipe; LTS (suporte longo); lê `.env` nativamente (`--env-file`).                             |
| Linguagem       | **TypeScript**                                  | 6.0         | Mesma linguagem do front-end Angular → tipos e conceitos compartilhados; erros pegos antes de rodar.           |
| Framework HTTP  | **Express**                                     | 5.x         | O framework Node mais usado e documentado; a versão 5 trata erros de funções `async` automaticamente.          |
| Validação       | **Zod**                                         | 4.x         | Valida entradas (nome, idade, respostas) e variáveis de ambiente, gerando os tipos TypeScript automaticamente. |
| Segurança HTTP  | **Helmet**                                      | 8.x         | Define cabeçalhos HTTP de segurança.                                                                           |
| CORS            | **cors**                                        | 2.x         | Permite que o front-end Angular (outra porta/endereço) chame a API.                                            |
| Logs            | **Pino** + **pino-http** (+ pino-pretty em dev) | 10.x / 11.x | Logs estruturados e rápidos de cada requisição.                                                                |
| Testes          | **Vitest** + **Supertest**                      | 5.x / 7.x   | Testes automatizados das rotas sem precisar abrir porta.                                                       |
| Execução em dev | **tsx**                                         | 4.x         | Roda TypeScript direto e reinicia ao salvar (`watch`).                                                         |
| Qualidade       | **ESLint** (+ typescript-eslint) e **Prettier** | 10.x / 3.x  | Padroniza e revisa o código.                                                                                   |

**Previstas para as próximas etapas** (instaladas quando chegarmos nelas):

- **node-oracledb** (driver oficial da Oracle, modo _thin_) + **Knex** (montador de SQL) — acesso ao banco **Oracle** (Etapa 5, junto com o Leonardo). _O Prisma foi descartado porque não suporta Oracle._
- **jsonwebtoken** (JWT) e **bcryptjs** — autenticação do professor (PIN/senha) e do aluno (Etapa 3).
- **express-rate-limit** — limitar tentativas de login (Etapa 10).
- **Swagger/OpenAPI** — documentação das rotas para o front-end (Etapa 9).

## Arquitetura

Organização **modular por funcionalidade**: cada módulo tem suas rotas, validação (schemas), regras (service) e acesso a dados.

```
src/
├── server.ts                  # sobe o servidor (porta/host)
├── app.ts                     # monta o Express: middlewares, rotas, erros
├── routes.ts                  # registra as rotas de todos os módulos em /api
├── config/
│   └── env.ts                 # variáveis de ambiente validadas com Zod
├── domain/                    # O CORAÇÃO: não depende de Express nem de banco
│   ├── entidades.ts           # Turma, Sessao, Aluno, Fase, Tentativa, Progresso, Ranking...
│   └── regras/                # regras puras (fáceis de testar)
│       ├── estrelas.ts        # % de acertos → 0 a 5 estrelas; aprovação
│       ├── progressao.ts      # mapa de fases, bloqueio/desbloqueio, nível atual
│       ├── ranking.ts         # critério e ordenação do ranking
│       └── identificacao.ts   # normalização do nome do aluno
├── modules/                   # casos de uso (services) por funcionalidade
│   ├── health/                # GET /api/health
│   ├── sessoes/               # criar / abrir / encerrar aula
│   ├── alunos/                # entrada do aluno, desativar / reativar
│   ├── progresso/             # mapa de fases do aluno
│   ├── tentativas/            # registrar fim de fase (estrelas, melhor tentativa)
│   └── ranking/               # gerar (no encerramento) e consultar ranking
├── repositories/
│   ├── contratos.ts           # interfaces de acesso a dados
│   └── memoria/               # implementação em memória (até o Oracle ficar pronto)
└── shared/
    ├── contexto.ts            # dependências injetadas nos services
    ├── logger.ts
    ├── errors/                # AppError + catálogo de códigos de erro (erros.ts)
    └── middlewares/           # tratamento de erros e 404
tests/
├── regras.test.ts             # testes das regras puras
└── fluxo-aula.test.ts         # CA01–CA10 do levantamento de requisitos
```

As regras de negócio só conversam com os **contratos** de repositório. Hoje eles são atendidos por uma implementação em memória; na Etapa 5 entra a implementação Oracle **sem alterar nenhuma regra**.

Padrão de cada módulo (a partir da Etapa 2):

```
modules/<nome>/
├── <nome>.routes.ts       # define URLs e verbos HTTP
├── <nome>.controller.ts   # lê a requisição e devolve a resposta
├── <nome>.service.ts      # REGRAS DE NEGÓCIO (RN01–RN15)
├── <nome>.repository.ts   # acesso ao banco
└── <nome>.schemas.ts      # validação Zod das entradas
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
- **Limitação conhecida:** se a criança fizer aniversário entre aulas e digitar a nova idade, ela vira outro aluno. O professor poderá corrigir a idade (Etapa 4 — CRUD).

### Rastreabilidade (requisito → código)

| Requisito                                                      | Onde                                                |
| -------------------------------------------------------------- | --------------------------------------------------- |
| RN01 sessão única aberta                                       | `SessoesService.abrir`                              |
| RN02 / CA01 entrada só com sessão aberta                       | `SessoesService.exigirAberta`                       |
| RN03 / CA02 nome e idade obrigatórios                          | `alunos.schemas.ts`                                 |
| RN04 / RF-P03 / CA03 recuperar perfil sem duplicar             | `AlunosService.entrar`, `regras/identificacao.ts`   |
| RN05 / RN09 / RN12 / CA04 estrelas 0–5 e aprovação ≥ 3         | `regras/estrelas.ts`, `TentativasService.registrar` |
| RN06 / RN15 / CA07 melhor tentativa                            | `TentativasService.registrar`                       |
| RN07 / RN11 / RN13 / RN14 / CA05 / CA06 desbloqueio sequencial | `regras/progressao.ts`                              |
| RN08 / CA08 / CA09 / RF-D12 ranking só ao encerrar, congelado  | `RankingService`, `SessoesService.encerrar`         |
| RN10 / CA10 desativar mantendo dados                           | `AlunosService.desativar`, `RankingService.gerar`   |
| RF-D05 bloquear entradas após encerrar                         | `SessoesService.exigirAberta`                       |

### Para o banco (Leonardo)

Restrições que o banco também deve garantir (protegem contra cliques duplos e 30 alunos simultâneos — RNF03):

- Apenas **uma** sessão com status `ABERTA` (ex.: índice único baseado em função: `CREATE UNIQUE INDEX ux_sessao_aberta ON sessao (CASE WHEN status = 'ABERTA' THEN 1 END)`).
- `UNIQUE (turma_id, nome_normalizado, idade)` em **aluno**.
- `PRIMARY KEY (sessao_id, aluno_id)` em **participacao**.
- `PRIMARY KEY (aluno_id, fase_id)` em **progresso**.
- Os campos de cada tabela estão em `src/domain/entidades.ts`.

### Formato padrão de erro

```json
{ "error": { "code": "SESSAO_FECHADA", "message": "Aguardando professor iniciar a aula" } }
```

O `code` é estável, para o front-end decidir qual mensagem/ícone mostrar à criança.

## Como rodar

Pré-requisito: Node.js 22.12 ou superior.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
npm run dev               # desenvolvimento (reinicia ao salvar)
```

Teste: abrir `http://localhost:3333/api/health` no navegador.

| Comando                       | O que faz                               |
| ----------------------------- | --------------------------------------- |
| `npm run dev`                 | Roda em modo desenvolvimento            |
| `npm test`                    | Roda os testes automatizados            |
| `npm run typecheck`           | Verifica os tipos TypeScript            |
| `npm run lint`                | Verifica a qualidade do código          |
| `npm run format`              | Formata o código                        |
| `npm run build` e `npm start` | Compila para `dist/` e roda em produção |

## Uso na sala de aula

O servidor escuta em `0.0.0.0`, então os computadores do laboratório podem acessar a API pelo IP da máquina do professor na rede local (ex.: `http://192.168.0.10:3333/api`).
