# CodeBuddies — Back-end (API)

API REST da plataforma educacional gamificada **CodeBuddies** (crianças de 5 a 8 anos).
Responsável: **Gustavo De Assis Vieira Dos Santos** — FEMA/IMESA, Análise e Desenvolvimento de Sistemas, 2026.

## Progresso

| Etapa                                            | Situação     |
| ------------------------------------------------ | ------------ |
| 1. Linguagem, framework e estrutura              | ✅ concluída |
| 2. Regras de negócio                             | ✅ concluída |
| 3. Autenticação e autorização                    | ✅ concluída |
| 4. Operações CRUD                                | ⏳ próxima   |
| 5. Integração com o banco Oracle (com Leonardo)  | ⬜           |
| 6. Gerenciamento de fases e desafios             | ⬜           |
| 7. Registro de respostas, tentativas e progresso | ⬜           |
| 8. Pontuação, estrelas e recompensas             | ⬜           |
| 9. Dados para o front-end                        | ⬜           |
| 10. Tratamento de erros e validação              | ⬜           |
| 11. Validação com os integrantes                 | ⬜           |
| 12. Produção                                     | ⬜           |

## Stack

| Camada          | Tecnologia                                      | Versão      | Por quê                                                                                                        |
| --------------- | ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime         | **Node.js**                                     | 22 LTS      | Já instalado na equipe; LTS (suporte longo); lê `.env` nativamente (`--env-file`).                             |
| Linguagem       | **TypeScript**                                  | 6.0         | Mesma linguagem do front-end Angular → tipos e conceitos compartilhados; erros pegos antes de rodar.           |
| Framework HTTP  | **Express**                                     | 5.x         | O framework Node mais usado e documentado; a versão 5 trata erros de funções `async` automaticamente.          |
| Validação       | **Zod**                                         | 4.x         | Valida entradas (nome, idade, respostas) e variáveis de ambiente, gerando os tipos TypeScript automaticamente. |
| Segurança HTTP  | **Helmet**                                      | 8.x         | Define cabeçalhos HTTP de segurança.                                                                           |
| CORS            | **cors**                                        | 2.x         | Permite que o front-end Angular (outra porta/endereço) chame a API.                                            |
| Tokens          | **jsonwebtoken** (JWT)                          | 9.x         | Gera e confere o "crachá" de quem está logado (professor ou aluno).                                            |
| Senhas          | **bcryptjs**                                    | 3.x         | Guarda só o hash da senha do professor — nunca a senha pura.                                                   |
| Limite de login | **express-rate-limit**                          | 8.x         | Máximo de 5 tentativas de login por minuto, contra quem tenta adivinhar senhas.                                |
| Logs            | **Pino** + **pino-http** (+ pino-pretty em dev) | 10.x / 11.x | Logs estruturados e rápidos de cada requisição.                                                                |
| Testes          | **Vitest** + **Supertest**                      | 5.x / 7.x   | Testes automatizados das regras e das rotas, sem precisar abrir porta.                                         |
| Execução em dev | **tsx**                                         | 4.x         | Roda TypeScript direto e reinicia ao salvar (`watch`).                                                         |
| Qualidade       | **ESLint** (+ typescript-eslint) e **Prettier** | 10.x / 3.x  | Padroniza e revisa o código.                                                                                   |

**Prevista:** **node-oracledb** (driver oficial da Oracle, modo _thin_) + **Knex** — acesso ao banco **Oracle** (Etapa 5, com o Leonardo). _O Prisma foi descartado porque não suporta Oracle._

## Arquitetura

```
src/
├── server.ts                  # sobe o servidor e cria o professor inicial do .env
├── app.ts                     # monta o Express: middlewares, rotas, erros
├── routes.ts                  # registra as rotas de todos os módulos em /api
├── config/
│   └── env.ts                 # variáveis de ambiente validadas com Zod
├── domain/                    # O CORAÇÃO: não depende de Express nem de banco
│   ├── entidades.ts           # Turma, Sessao, Aluno, Fase, Tentativa, Progresso, Professor...
│   └── regras/                # regras puras (fáceis de testar)
│       ├── estrelas.ts        # % de acertos → 0 a 5 estrelas; aprovação
│       ├── progressao.ts      # mapa de fases, bloqueio/desbloqueio, nível atual
│       ├── ranking.ts         # critério e ordenação do ranking
│       └── identificacao.ts   # normalização do nome do aluno
├── modules/                   # casos de uso por funcionalidade
│   ├── health/                # GET /api/health
│   ├── auth/                  # login do professor, entrada do aluno, "quem sou eu"
│   ├── sessoes/               # criar / abrir / encerrar aula
│   ├── alunos/                # entrada do aluno, desativar / reativar
│   ├── progresso/             # mapa de fases do aluno
│   ├── tentativas/            # registrar fim de fase (estrelas, melhor tentativa)
│   └── ranking/               # gerar (no encerramento) e consultar ranking
├── repositories/
│   ├── contratos.ts           # interfaces de acesso a dados
│   └── memoria/               # implementação em memória (até o Oracle ficar pronto)
├── types/
│   └── express.d.ts           # adiciona `req.usuario` ao tipo Request do Express
└── shared/
    ├── contexto.ts            # dependências injetadas nos services
    ├── logger.ts
    ├── auth/                  # senha.ts (bcrypt) e token.ts (JWT)
    ├── errors/                # AppError + catálogo de códigos de erro (erros.ts)
    └── middlewares/           # autenticar, exigirPerfil, erros e 404
tests/
├── health.test.ts             # estrutura base
├── regras.test.ts             # regras puras
├── fluxo-aula.test.ts         # CA01–CA10 do levantamento de requisitos
└── auth.test.ts               # login, tokens e permissões
```

As regras de negócio só conversam com os **contratos** de repositório. Hoje eles são atendidos por uma implementação em memória; na Etapa 5 entra a implementação Oracle **sem alterar nenhuma regra**.

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
| RF-D01 login do docente                                        | `AuthService.loginProfessor`                        |

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

### Rotas disponíveis

| Método | Rota                        | Acesso  | Descrição                                                                           |
| ------ | --------------------------- | ------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/health`               | público | Servidor no ar?                                                                     |
| POST   | `/api/auth/professor/login` | público | `{ email, senha }` → `{ token, professor }`                                         |
| POST   | `/api/auth/aluno/entrar`    | público | `{ nome, idade }` → `{ token, aluno, sessao, novo }` (201 = novo, 200 = recuperado) |
| GET    | `/api/auth/eu`              | logado  | Dados de quem está logado                                                           |

## Formato padrão de erro

```json
{ "error": { "code": "SESSAO_FECHADA", "message": "Aguardando professor iniciar a aula." } }
```

O `code` é estável, para o front-end decidir qual mensagem/ícone mostrar à criança. Todos os códigos ficam em `src/shared/errors/erros.ts`.

| HTTP | Significado                        | Exemplos                                                     |
| ---- | ---------------------------------- | ------------------------------------------------------------ |
| 400  | Dados inválidos                    | `DADOS_INVALIDOS`, `JSON_INVALIDO`                           |
| 401  | Não sei quem você é                | `NAO_AUTENTICADO`, `TOKEN_INVALIDO`, `CREDENCIAIS_INVALIDAS` |
| 403  | Sei quem você é, mas você não pode | `SEM_PERMISSAO`, `SESSAO_FECHADA`, `FASE_BLOQUEADA`          |
| 404  | Não encontrado                     | `SESSAO_NAO_ENCONTRADA`, `ROTA_NAO_ENCONTRADA`               |
| 409  | Conflito com o estado atual        | `OUTRA_SESSAO_ABERTA`, `SESSAO_ENCERRADA`                    |
| 429  | Muitas tentativas                  | `MUITAS_TENTATIVAS`                                          |

## Para o banco (Leonardo)

Restrições que o banco também deve garantir (protegem contra cliques duplos e 30 alunos simultâneos — RNF03):

- Apenas **uma** sessão com status `ABERTA`: `CREATE UNIQUE INDEX ux_sessao_aberta ON sessao_aula (CASE WHEN status = 'ABERTA' THEN 1 END);`
- `UNIQUE (turma_id, nome_normalizado, idade)` em **aluno**.
- `PRIMARY KEY (sessao_id, aluno_id)` em **participacao**.
- `PRIMARY KEY (aluno_id, fase_id)` em **progresso**.
- `UNIQUE (email)` em **professor**; a coluna da senha guarda o **hash** (60 caracteres, `VARCHAR2(60)`).
- Procedures de sessão: validar a transição de status, lançar `RAISE_APPLICATION_ERROR` com códigos -20010 a -20014 e **não** dar `COMMIT` (o back controla a transação).
- Os campos de cada tabela estão em `src/domain/entidades.ts`.

## Configuração (`.env`)

Copie `.env.example` para `.env` e ajuste. O `.env` **nunca** vai para o GitHub.

| Variável                                          | Para quê                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `PORT`, `HOST`                                    | Porta e endereço do servidor (`0.0.0.0` = acessível pela rede da escola) |
| `CORS_ORIGIN`                                     | Endereço(s) do front-end Angular                                         |
| `JWT_SECRET`                                      | Chave que assina os tokens (mínimo 32 caracteres, aleatória)             |
| `JWT_EXPIRACAO_PROFESSOR` / `JWT_EXPIRACAO_ALUNO` | Validade dos tokens (padrão 8h / 4h)                                     |
| `PROFESSOR_INICIAL_*`                             | Professor criado ao subir o servidor (enquanto o banco é em memória)     |

Gerar uma chave: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Como rodar

Pré-requisito: Node.js 22.12 ou superior.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env  (depois gere o JWT_SECRET)
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