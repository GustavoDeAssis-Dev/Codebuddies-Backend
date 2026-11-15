CodeBuddies — Back-end (API)

API REST da plataforma educacional gamificada CodeBuddies (crianças de 5 a 8 anos). Responsável: Gustavo De Assis Vieira Dos Santos — FEMA/IMESA, Análise e Desenvolvimento de Sistemas, 2026.

Progresso
Etapa	Situação
1. Linguagem, framework e estrutura	✅ concluída
2. Regras de negócio	✅ concluída
3. Autenticação e autorização	✅ concluída
4. Operações CRUD	✅ concluída
5. Integração com o banco Oracle (com Leonardo)	✅ concluída
6. Gerenciamento de fases e desafios	✅ concluída
7. Registro de respostas, tentativas e progresso	✅ concluída
8. Pontuação, estrelas e recompensas	✅ concluída
9. Dados para o front-end (relatórios)	✅ concluída
10. Tratamento de erros e validação	⏳ próxima
11. Validação com os integrantes	⬜
12. Produção	⬜
Stack
Camada	Tecnologia	Versão	Por quê
Runtime	Node.js	22 LTS	Já instalado na equipe; LTS (suporte longo); lê .env nativamente (--env-file).
Linguagem	TypeScript	6.0	Mesma linguagem do front-end Angular → tipos e conceitos compartilhados; erros pegos antes de rodar.
Framework HTTP	Express	5.x	O framework Node mais usado e documentado; a versão 5 trata erros de funções async automaticamente.
Validação	Zod	4.x	Valida entradas (nome, idade, respostas) e variáveis de ambiente, gerando os tipos TypeScript automaticamente.
ORM	TypeORM	1.x	Entidades com anotações, DataSource (classe de contexto), consultas estilo LINQ, transações.
Driver do banco	oracledb (modo thin)	6.x	Driver oficial da Oracle; não exige instalar o Oracle Client.
Anotações	reflect-metadata	0.2	Necessária para os decorators (@Entity, @Column...) do TypeORM.
Segurança HTTP	Helmet	8.x	Define cabeçalhos HTTP de segurança.
CORS	cors	2.x	Permite que o front-end Angular (outra porta/endereço) chame a API.
Tokens	jsonwebtoken (JWT)	9.x	Gera e confere o "crachá" de quem está logado (professor ou aluno).
Senhas	bcryptjs	3.x	Guarda só o hash da senha do professor — nunca a senha pura.
Limite de login	express-rate-limit	8.x	Máximo de 5 tentativas de login por minuto, contra quem tenta adivinhar senhas.
Logs	Pino + pino-http (+ pino-pretty em dev)	10.x / 11.x	Logs estruturados e rápidos de cada requisição.
Testes	Vitest + Supertest	5.x / 7.x	Testes automatizados das regras e das rotas, sem precisar abrir porta.
Execução em dev	tsx	4.x	Roda TypeScript direto e reinicia ao salvar (watch).
Qualidade	ESLint (+ typescript-eslint) e Prettier	10.x / 3.x	Padroniza e revisa o código.

O Prisma foi descartado porque não suporta Oracle; o Knex, porque não é um ORM (a disciplina pede ORM, anotações e classe de contexto).

Arquitetura
src/
├── server.ts                  # conecta no banco, cria o professor inicial e sobe o servidor
├── app.ts                     # monta o Express: middlewares, rotas, erros
├── routes.ts                  # registra as rotas de todos os módulos em /api
├── config/
│   └── env.ts                 # variáveis de ambiente validadas com Zod
├── database/                  # ORM (Etapa 5)
│   ├── data-source.ts         # DataSource = "classe de contexto" (conexão + entidades)
│   └── entidades.ts           # 12 classes com anotações, uma por tabela do Oracle
├── domain/                    # O CORAÇÃO: não depende de Express nem de banco
│   ├── entidades.ts           # Turma, Sessao, Aluno, Nivel, Fase, Desafio, Tentativa, Progresso...
│   └── regras/                # regras puras (fáceis de testar)
│       ├── estrelas.ts        # % de acertos → 0 a 5 estrelas; aprovação
│       ├── correcao.ts        # correção das respostas (ignora maiúsculas, acentos e espaços)
│       ├── progressao.ts      # mapa de fases, desbloqueio, nível atual, consolidação do progresso
│       ├── conquistas.ts      # catálogo e regras das medalhas (recompensas)
│       ├── ranking.ts         # critério e ordenação do ranking
│       └── identificacao.ts   # normalização do nome do aluno
├── modules/                   # casos de uso por funcionalidade
│   ├── health/                # GET /api/health
│   ├── auth/                  # login do professor, entrada do aluno, "quem sou eu"
│   ├── professores/           # CRUD de professores
│   ├── turmas/                # CRUD de turmas
│   ├── sessoes/               # criar / abrir / encerrar aula
│   ├── alunos/                # entrada do aluno, corrigir, desativar / reativar
│   ├── conteudo/              # CRUD de níveis, fases e desafios (professor)
│   ├── jogo/                  # mapa, abrir fase e responder (aluno)
│   ├── tentativas/            # corrige as respostas e registra a tentativa
│   ├── progresso/             # mapa de fases do aluno
│   ├── recompensas/           # painel de pontuação, estrelas e conquistas
│   ├── ranking/               # gerar (no encerramento) e consultar ranking
│   └── relatorios/            # resumo, por fase, boletim (pivot) e desafios mais errados
├── repositories/
│   ├── contratos.ts           # interfaces de acesso a dados (+ transação)
│   ├── memoria/               # implementação em memória (testes automáticos)
│   └── oracle/                # implementação Oracle (TypeORM)
│       ├── index.ts           # consultas, QueryBuilder, procedures e transação
│       ├── mapeadores.ts      # entidade do banco → tipo do domínio
│       └── erros-oracle.ts    # ORA-200xx / ORA-00001 / ORA-02292 → erros de negócio
├── types/
│   └── express.d.ts           # adiciona `req.usuario` ao tipo Request do Express
└── shared/
    ├── contexto.ts            # dependências injetadas nos services (memória ou Oracle)
    ├── logger.ts
    ├── auth/                  # senha.ts (bcrypt) e token.ts (JWT)
    ├── errors/                # AppError + catálogo de códigos de erro (erros.ts)
    ├── http/                  # params.ts (lerId)
    └── middlewares/           # autenticar, exigirPerfil, erros e 404
scripts/
├── testar-conexao.ts          # npm run db:testar   → conecta e lista as tabelas
└── verificar-oracle.ts        # npm run db:verificar → fluxo completo no Oracle, com ROLLBACK no final
docs/
└── banco/
    └── migracao_opcao_b.sql   # migração do modelo do banco para a Opção B
tests/
├── health.test.ts             # estrutura base
├── regras.test.ts             # regras puras (estrelas, progressão, ranking, correção, conquistas)
├── fluxo-aula.test.ts         # CA01–CA10 do levantamento de requisitos
├── auth.test.ts               # login, tokens e permissões
├── crud.test.ts               # rotas CRUD pela API
├── conteudo.test.ts           # níveis, fases, desafios, jogo e conquistas pela API
├── relatorios.test.ts         # relatórios (agregação, agrupamento e pivot)
├── entidades.test.ts          # anotações do TypeORM (sem conectar)
└── erros-oracle.test.ts       # tradução dos erros do Oracle

As regras de negócio só conversam com os contratos de repositório, atendidos por duas implementações: memória (testes automáticos) e Oracle (uso real). A escolha é feita no .env (BANCO=memoria ou BANCO=oracle), em um único lugar: src/shared/contexto.ts. Trocar a memória pelo Oracle não exigiu mudar nenhuma regra, rota ou teste.

Cada módulo segue o padrão:

modules/<nome>/
├── <nome>.routes.ts    # URLs, verbos HTTP e quem pode acessar
├── <nome>.service.ts   # REGRAS DE NEGÓCIO
└── <nome>.schemas.ts   # validação Zod das entradas
Regras de negócio
Decisões da equipe
Estrelas = porcentagem de acertos, calculada no servidor: acertos / total de desafios, arredondada para baixo.
Acertos	Estrelas
≥ 90%	5
75 – 89%	4
60 – 74%	3 ✅ aprovado
40 – 59%	2
20 – 39%	1
< 20%	0
O tempo não influencia as estrelas (sem pressão para a criança); serve só como desempate no ranking.
Correção no back-end (Etapa 7): o front envia a resposta de cada desafio e o back compara com a resposta correta ignorando maiúsculas, acentos e espaços extras ("a" = "A", "ó" = "O"). Desafio pulado ou em branco conta como erro. A resposta correta nunca é enviada ao aluno — nem antes, nem depois de responder.
Pontos: soma dos pontos dos desafios acertados (cada desafio vale 100 por padrão; o professor pode mudar).
Gravação: a tentativa (TENTATIVA_FASE) e uma linha por desafio (RESPOSTA_DESAFIO) são gravadas na mesma transação — ou tudo, ou nada.
Progresso guardado por turma (Opção B). Cada aula é uma sessão de uma turma. O aluno é reconhecido por nome + idade dentro da turma (ignorando acentos, maiúsculas e espaços) e continua de onde parou na aula seguinte. As tentativas ficam ligadas à sessão, para o relatório de cada aula.
Melhor tentativa: vale sempre o melhor resultado de cada fase (mais estrelas; empate → mais pontos). No Oracle quem mantém é a trigger TRG_ATUALIZA_PROGRESSO_OFICIAL; em memória, consolidarProgresso.
Conteúdo (Etapa 6): Nível → Fase → Desafio. Posições únicas (número do nível; posição da fase no nível; posição do desafio na fase). Sem ordem no cadastro → vai para o final. Não se apaga nível com fases, fase com desafios, nem fase/desafio que já foi jogado (preserva o histórico).
Recompensas (Etapa 8): 6 conquistas calculadas a partir do progresso e das tentativas (não ficam gravadas — nunca ficam desatualizadas e não exigem tabela nova): 🌟 Primeira estrela (concluiu uma fase) · 🏆 Perfeito! (5 estrelas numa fase) · 💪 Não desistiu (refez uma fase e melhorou) · 🚀 Subiu de nível (concluiu todas as fases de um nível) · ⭐ Colecionador (15 estrelas) · 👑 Mestre CodeBuddies (todas as fases). O resultado de cada fase traz novasConquistas para o front comemorar na hora.
Pontuação total: soma da melhor pontuação de cada fase (repetir uma fase não soma pontos de novo — vale o recorde).
Ranking da aula: 1º nível alcançado → 2º estrelas ganhas nesta aula → 3º menor tempo. Empate total divide a posição. Gerado e congelado no encerramento, na mesma transação. Alterável em src/domain/regras/ranking.ts.
Idade permitida: 4 a 15 anos (igual ao CHECK do banco). Status inicial da aula: CRIADA. Sem personagem/mascote.
Aniversário entre aulas: se a criança digitar a nova idade, vira outro aluno — o professor corrige a idade pelo PATCH /api/alunos/:id.
Rastreabilidade (requisito → código)
Requisito	Onde
RN01 sessão única aberta	SessoesService.abrir + PRC_ABRIR_SESSAO + índice UX_SESSAO_ABERTA
RN02 / CA01 entrada só com sessão aberta	SessoesService.exigirAberta
RN03 / CA02 nome e idade obrigatórios	alunos.schemas.ts
RN04 / RF-P03 / CA03 recuperar perfil sem duplicar	AlunosService.entrar, regras/identificacao.ts
RN05 / RN09 / RN12 / CA04 estrelas 0–5 e aprovação ≥ 3	regras/estrelas.ts, regras/correcao.ts, TentativasService.registrar
RN06 / RN15 / CA07 melhor tentativa	trigger TRG_ATUALIZA_PROGRESSO_OFICIAL (memória: consolidarProgresso)
RN07 / RN11 / RN13 / RN14 / CA05 / CA06 desbloqueio sequencial	regras/progressao.ts, JogoService.abrirFase
RN08 / CA08 / CA09 / RF-D12 ranking só ao encerrar, congelado	RankingService, SessoesService.encerrar
RN10 / CA10 desativar mantendo dados	AlunosService.desativar, RankingService.gerar
RF-D05 bloquear entradas após encerrar	SessoesService.exigirAberta
RF-D01 login do docente	AuthService.loginProfessor
Autenticação e autorização (Etapa 3)
Autenticação = "quem é você?" · Autorização = "o que você pode fazer?"
Professor entra com e-mail + senha. A senha é guardada como hash bcrypt. Recebe um token JWT válido por 8 h.
Aluno entra com nome + idade (sem senha) e recebe um token JWT ligado à aula aberta. O servidor usa o id do aluno de dentro do token — nunca do que o front envia — para ninguém jogar no lugar do colega.
Decisão da equipe: não há perfil ADMIN separado — todo professor pode tudo.
O front envia o token em todas as requisições protegidas: Authorization: Bearer <token>.
Middlewares: autenticar (confere o token) e exigirPerfil('PROFESSOR') (confere o perfil).
Login do professor limitado a 5 tentativas por minuto por computador.
Erro de login é sempre o mesmo (CREDENCIAIS_INVALIDAS), para não revelar quais e-mails existem.
Ação	Aluno	Professor
Ver se há aula aberta, entrar com nome + idade	✅	✅
Ver o próprio mapa, abrir fase, responder, conquistas	✅ (só o dele)	—
Ver o ranking depois que a aula acaba	✅	✅
Cadastrar professores, turmas, aulas	❌	✅
Cadastrar níveis, fases e desafios	❌	✅
Listar alunos, corrigir, desativar/reativar	❌	✅
Ver relatórios	❌	✅
Rotas

Todas começam com /api. "professor" = exige token de professor; "aluno" = exige token de aluno.

Públicas e autenticação
Método	Rota	Acesso	Descrição
GET	/api/health	público	Servidor no ar?
POST	/api/auth/professor/login	público	{ email, senha } → { token, professor }
POST	/api/auth/aluno/entrar	público	{ nome, idade } → { token, aluno, sessao, novo } (201 = novo, 200 = recuperado)
GET	/api/auth/eu	logado	Dados de quem está logado
GET	/api/sessoes/aberta	público	Há aula aberta? (tela "Aguardando professor iniciar a aula")
Professores, turmas, aulas e alunos — somente professor (Etapa 4)
Método	Rota	Descrição
GET	/api/professores	Lista os professores (sem o hash da senha)
POST	/api/professores	Cadastra { nome, email, senha }
GET	/api/turmas	Lista as turmas
POST	/api/turmas	Cria { nome }
GET	/api/turmas/:id	Uma turma
PATCH	/api/turmas/:id	Altera { nome?, ativa? } (não desativa turma com aula aberta)
GET	/api/turmas/:id/alunos	Alunos da turma (ativos e desativados)
POST	/api/sessoes	Cria aula { turmaId } com status CRIADA (guarda o professor do token)
GET	/api/sessoes	Lista as aulas (filtros ?turmaId= e ?status=)
GET	/api/sessoes/:id	Uma aula
POST	/api/sessoes/:id/abrir	Abre a aula (libera a entrada dos alunos)
POST	/api/sessoes/:id/encerrar	Encerra a aula e congela o ranking
GET	/api/sessoes/:id/alunos	Alunos que participaram da aula
GET	/api/sessoes/:id/ranking	Ranking (aluno ou professor; só depois de encerrada)
GET	/api/alunos/:id	Um aluno
PATCH	/api/alunos/:id	Corrige { nome?, idade? }
POST	/api/alunos/:id/desativar	Desativa (os dados ficam guardados)
POST	/api/alunos/:id/reativar	Reativa
GET	/api/alunos/:id/conquistas	Painel de recompensas de um aluno (Etapa 8)
Conteúdo — somente professor (Etapa 6)
Método	Rota	Descrição
GET	/api/niveis	Lista os níveis em ordem
POST	/api/niveis	Cria { titulo, ordem?, descricao? } (sem ordem → vai para o final)
GET	/api/niveis/:id	Nível + suas fases
PATCH	/api/niveis/:id	Altera { titulo?, ordem?, descricao? }
DELETE	/api/niveis/:id	Remove (só sem fases)
GET	/api/fases	Todas as fases na ordem do jogo
POST	/api/fases	Cria { nivelId, titulo, tipo, ordem? } — tipo: DIGITACAO, LOGICA, COMPUTACAO_BASICA
GET	/api/fases/:id	Fase + nível + desafios (com resposta correta)
PATCH	/api/fases/:id	Altera/move { nivelId?, ordem?, titulo?, tipo? }
DELETE	/api/fases/:id	Remove (só sem desafios e nunca jogada)
POST	/api/fases/:id/desafios	Cria { enunciado, respostaCorreta, pontos? (100), ordem? }
GET	/api/desafios/:id	Um desafio
PATCH	/api/desafios/:id	Corrige { enunciado?, respostaCorreta?, pontos?, ordem? }
DELETE	/api/desafios/:id	Remove (só se a fase nunca foi jogada)
Jogo — somente aluno (Etapas 6, 7 e 8)
Método	Rota	Descrição
GET	/api/jogo/mapa	Mapa de fases (BLOQUEADA / LIBERADA / CONCLUIDA) e estrelas
GET	/api/jogo/fases/:id	Desafios da fase sem a resposta correta (exige aula aberta e fase liberada)
POST	/api/jogo/fases/:id/respostas	Envia { tempoSegundos, respostas: [{ desafioId, resposta }] }; o back corrige e devolve estrelas, pontos, ✓/✗ de cada desafio e novasConquistas
GET	/api/jogo/conquistas	Painel de recompensas: estrelas, pontos, fases concluídas e as 6 conquistas (ganhas e bloqueadas)
Relatórios — somente professor (Etapa 9)
Método	Rota	Descrição
GET	/api/relatorios/turmas/:id/resumo	Visão geral: alunos, aulas, tentativas (COUNT), médias de estrelas e acertos (AVG), maior/menor % (MAX/MIN), pontos (SUM), tempo médio e taxa de aprovação
GET	/api/relatorios/turmas/:id/fases	As mesmas estatísticas por fase (GROUP BY), incluindo fases não jogadas
GET	/api/relatorios/turmas/:id/boletim	Boletim (pivot aluno × fase): melhores estrelas de cada aluno em cada fase + média por fase
GET	/api/relatorios/turmas/:id/desafios-mais-errados?limite=5	Desafios com maior taxa de erro (GROUP BY desafio)

Boletim no Angular: fases são as colunas e linhas[i].estrelas[j] é a célula do aluno i na fase j (mesma ordem). null = nunca jogou (mostrar "—").

Formato padrão de erro
json
{ "error": { "code": "SESSAO_FECHADA", "message": "Aguardando professor iniciar a aula." } }

O code é estável, para o front-end decidir qual mensagem/ícone mostrar à criança. Todos os códigos ficam em src/shared/errors/erros.ts.

HTTP	Significado	Exemplos
400	Dados inválidos	DADOS_INVALIDOS, JSON_INVALIDO, DESAFIO_FORA_DA_FASE, RESPOSTA_DUPLICADA
401	Não sei quem você é	NAO_AUTENTICADO, TOKEN_INVALIDO, CREDENCIAIS_INVALIDAS
403	Sei quem você é, mas você não pode	SEM_PERMISSAO, SESSAO_FECHADA, FASE_BLOQUEADA, ALUNO_DESATIVADO, RANKING_INDISPONIVEL
404	Não encontrado	TURMA_NAO_ENCONTRADA, FASE_NAO_ENCONTRADA, DESAFIO_NAO_ENCONTRADO, ROTA_NAO_ENCONTRADA
409	Conflito com o estado atual	OUTRA_SESSAO_ABERTA, NIVEL_DUPLICADO, ORDEM_FASE_DUPLICADA, FASE_JA_JOGADA, FASE_SEM_DESAFIOS
429	Muitas tentativas	MUITAS_TENTATIVAS
Banco de dados Oracle (Etapa 5)

Modelo do Leonardo + script de migração para a Opção B (docs/banco/migracao_opcao_b.sql): 12 tabelas — PROFESSOR, TURMA, SESSAO_AULA, ALUNO, PARTICIPACAO, NIVEL, FASE, DESAFIO, TENTATIVA_FASE, RESPOSTA_DESAFIO, PROGRESSO_FASE, RANKING_SESSAO.

Divisão de responsabilidades ("cada regra tem um dono"):

Regra	Dono	O back-end…
Abrir / encerrar aula, RN01	Procedures PRC_ABRIR_SESSAO / PRC_ENCERRAR_SESSAO + UX_SESSAO_ABERTA	valida antes (mensagem clara) e chama a procedure
Melhor resultado por fase (RN06/RN15)	Trigger TRG_ATUALIZA_PROGRESSO_OFICIAL	só grava a tentativa e lê o progresso
Estrelas, correção, desbloqueio, ranking	Back-end (src/domain/regras)	calcula e grava
Unicidade (aluno, e-mail, fase, participação)	UNIQUE / PRIMARY KEY no banco	verifica antes e traduz o ORA-00001
As procedures não dão COMMIT: o back controla a transação. Ex.: encerrar a aula + gravar o ranking; gravar a tentativa + as respostas — ou tudo, ou nada (repos.transacao).
Erros do Oracle são traduzidos em src/repositories/oracle/erros-oracle.ts (ex.: ORA-20014 → OUTRA_SESSAO_ABERTA, ORA-02292 → CONTEUDO_EM_USO), então o front recebe os mesmos códigos com memória ou Oracle.
synchronize: false: o TypeORM nunca altera tabelas; a estrutura é dos scripts SQL.
Verificação completa no banco real, sem gravar nada: npm run db:verificar.
Conteúdos da disciplina × projeto
Conteúdo	Onde no projeto
Camada de persistência / ORM / contexto	repositories/oracle; TypeORM + DataSource (src/database/data-source.ts)
Classes de domínio e anotações	domain/entidades.ts; src/database/entidades.ts (@Entity, @Column...)
Consultas (LINQ)	find, findBy, where, order, relations, existsBy (repositories/oracle)
Transações	repos.transacao(...): encerrar aula + ranking; tentativa + respostas
Agregação (SUM, AVG, COUNT, MAX, MIN)	repositories/oracle — consultaEstatisticas (QueryBuilder → SQL)
Agrupamento (GROUP BY)	estatisticasPorFase, errosPorDesafio (Oracle) e Map (memória)
Pivot	RelatoriosService.boletim — linhas = alunos, colunas = fases
Parâmetros (proteção contra SQL Injection)	.where('a.turmaId = :turmaId', { turmaId })
Procedures e triggers	PRC_ABRIR_SESSAO, PRC_ENCERRAR_SESSAO, TRG_ATUALIZA_PROGRESSO_OFICIAL
Testes automatizados	tests/ — 132 testes (Vitest + Supertest)
Configuração (.env)

Copie .env.example para .env e ajuste. O .env nunca vai para o GitHub.

Variável	Para quê
PORT, HOST	Porta e endereço do servidor (0.0.0.0 = acessível pela rede da escola)
CORS_ORIGIN	Endereço(s) do front-end Angular
JWT_SECRET	Chave que assina os tokens (mínimo 32 caracteres, aleatória)
JWT_EXPIRACAO_PROFESSOR / JWT_EXPIRACAO_ALUNO	Validade dos tokens (padrão 8h / 4h)
PROFESSOR_INICIAL_*	Professor criado ao subir o servidor, se ainda não existir
BANCO	memoria (dados somem ao reiniciar) ou oracle
DB_USER, DB_PASSWORD, DB_CONNECT_STRING	Acesso ao Oracle (ex.: servidor:1521/ORCL)
DB_LOGGING	true mostra no terminal cada SQL executado (bom para estudar)

Gerar uma chave: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

Como rodar

Pré-requisito: Node.js 22.12 ou superior.

bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env  (depois gere o JWT_SECRET)
npm run dev               # desenvolvimento (reinicia ao salvar)

Teste: abrir http://localhost:3333/api/health no navegador.

Comando	O que faz
npm run dev	Roda em modo desenvolvimento
npm test	Roda os testes automatizados
npm run typecheck	Verifica os tipos TypeScript
npm run lint	Verifica a qualidade do código
npm run format	Formata o código
npm run build e npm start	Compila para dist/ e roda em produção
npm run db:testar	Testa a conexão com o Oracle e lista as tabelas
npm run db:verificar	Roda o fluxo completo no Oracle e desfaz tudo no final
Uso na sala de aula

O servidor escuta em 0.0.0.0, então os computadores do laboratório podem acessar a API pelo IP da máquina do professor na rede local (ex.: http://192.168.0.10:3333/api).