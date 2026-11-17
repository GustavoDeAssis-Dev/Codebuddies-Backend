import type { EntityManager } from 'typeorm';
import {
  AlunoEntity,
  DesafioEntity,
  FaseEntity,
  NivelEntity,
  ParticipacaoEntity,
  ProfessorEntity,
  ProgressoFaseEntity,
  RankingSessaoEntity,
  SessaoAulaEntity,
  TentativaFaseEntity,
  TurmaEntity,
  RespostaDesafioEntity,
} from '../../database/entidades.js';
import type { Repositorios } from '../contratos.js';
import { comTraducaoDeErros, ehValorDuplicado, traduzirErroOracle } from './erros-oracle.js';
import {
  paraAluno,
  paraDesafio,
  paraFase,
  paraFaseComNivel,
  paraNivel,
  paraProgresso,
  paraSessao,
  paraTentativa,
  paraResposta,
  paraEstatisticas,
} from './mapeadores.js';

/**
 * Implementação ORACLE dos repositórios (mesmos contratos da implementação em memória).
 *
 * `manager` é o EntityManager do TypeORM: dentro de uma transação, é o manager DAQUELA transação
 * — por isso a função recebe o manager em vez de usar um global.
 */
export function criarRepositoriosOracle(manager: EntityManager): Repositorios {
  const professores = manager.getRepository(ProfessorEntity);
  const turmas = manager.getRepository(TurmaEntity);
  const sessoes = manager.getRepository(SessaoAulaEntity);
  const alunos = manager.getRepository(AlunoEntity);
  const participacoes = manager.getRepository(ParticipacaoEntity);
  const niveis = manager.getRepository(NivelEntity);
  const fases = manager.getRepository(FaseEntity);
  const desafios = manager.getRepository(DesafioEntity);
  const tentativas = manager.getRepository(TentativaFaseEntity);
  const progressos = manager.getRepository(ProgressoFaseEntity);
  const rankings = manager.getRepository(RankingSessaoEntity);
  const respostasDesafio = manager.getRepository(RespostaDesafioEntity);

  /** Busca a sessão de novo depois de uma procedure (para devolver os dados atualizados). */
  const recarregarSessao = async (id: number) => paraSessao(await sessoes.findOneByOrFail({ id }));

    /**
   * Etapa 9 — consulta base dos relatórios, no estilo LINQ:
   *   FROM TENTATIVA_FASE t JOIN ALUNO a ... WHERE a.ID_TURMA = :turmaId
   *   SELECT COUNT, AVG, MAX, MIN, SUM
   * Os nomes `t.estrelas`, `a.turmaId` são das PROPRIEDADES das entidades: o TypeORM traduz
   * para as colunas do Oracle (ESTRELAS_OBTIDAS, ID_TURMA...).
   */
  const consultaEstatisticas = (turmaId: number) =>
    tentativas
      .createQueryBuilder('t')
      .innerJoin(AlunoEntity, 'a', 'a.id = t.alunoId')
      .select('COUNT(*)', 'totalTentativas')
      .addSelect('COUNT(DISTINCT t.alunoId)', 'alunosQueJogaram')
      .addSelect('AVG(t.estrelas)', 'mediaEstrelas')
      .addSelect('AVG(t.percentual)', 'mediaPercentual')
      .addSelect('MAX(t.percentual)', 'maiorPercentual')
      .addSelect('MIN(t.percentual)', 'menorPercentual')
      .addSelect('SUM(t.pontos)', 'somaPontos')
      .addSelect('AVG(t.tempoSegundos)', 'tempoMedioSegundos')
      .addSelect("SUM(CASE WHEN t.aprovada = 'S' THEN 1 ELSE 0 END)", 'aprovacoes')
      .where('a.turmaId = :turmaId', { turmaId });

  const repos: Repositorios = {
    // Os campos de ProfessorEntity têm os mesmos nomes do tipo Professor: não precisa de conversão.
    professores: comTraducaoDeErros({
      buscarPorId: (id) => professores.findOneBy({ id }),
      buscarPorEmail: (email) => professores.findOneBy({ email }),
      criar: (dados) => professores.save(professores.create(dados)),
      listar: () => professores.find({ order: { nome: 'ASC' } }),
      atualizar: (professor) => professores.save(professor),
    }),

    turmas: comTraducaoDeErros({
      buscarPorId: (id) => turmas.findOneBy({ id }),
      criar: (dados) => turmas.save(turmas.create({ ...dados, ativa: true })),
      listar: () => turmas.find(),
      atualizar: (turma) => turmas.save(turma),
    }),

    sessoes: comTraducaoDeErros({
      async buscarPorId(id) {
        const s = await sessoes.findOneBy({ id });
        return s ? paraSessao(s) : null;
      },
      async buscarAberta() {
        const s = await sessoes.findOneBy({ status: 'ABERTA' });
        return s ? paraSessao(s) : null;
      },
      async criar(dados) {
        const s = await sessoes.save(
          sessoes.create({
            turmaId: dados.turmaId,
            professorId: dados.professorId,
            status: 'CRIADA',
            criadaEm: dados.criadaEm,
            dataAbertura: null,
            dataEncerramento: null,
          }),
        );
        return paraSessao(s);
      },
      async listar(filtro = {}) {
        const lista = await sessoes.find({
          where: {
            ...(filtro.turmaId !== undefined && { turmaId: filtro.turmaId }),
            ...(filtro.status !== undefined && { status: filtro.status }),
          },
        });
        return lista.map(paraSessao);
      },
      // As transições de status passam pelas PROCEDURES do Leonardo (elas também validam a RN01).
      // A data/hora fica a cargo do Oracle (SYSTIMESTAMP).
      async abrir(id) {
        await manager.query('BEGIN PRC_ABRIR_SESSAO(:id); END;', [id]);
        return recarregarSessao(id);
      },
      async encerrar(id) {
        await manager.query('BEGIN PRC_ENCERRAR_SESSAO(:id); END;', [id]);
        return recarregarSessao(id);
      },
    }),

    alunos: comTraducaoDeErros({
      async buscarPorId(id) {
        const a = await alunos.findOneBy({ id });
        return a ? paraAluno(a) : null;
      },
      async buscarPorIdentificacao(turmaId, nomeNormalizado, idade) {
        const a = await alunos.findOneBy({ turmaId, nomeNormalizado, idade });
        return a ? paraAluno(a) : null;
      },
      async criar(dados) {
        return paraAluno(await alunos.save(alunos.create(dados)));
      },
      async atualizarStatus(id, status) {
        await alunos.update({ id }, { status });
        return paraAluno(await alunos.findOneByOrFail({ id }));
      },
      async atualizar(aluno) {
        return paraAluno(await alunos.save(alunos.create(aluno)));
      },
      async listarPorTurma(turmaId) {
        return (await alunos.findBy({ turmaId })).map(paraAluno);
      },
    }),

    participacoes: comTraducaoDeErros({
      async registrar(dados) {
        if (await participacoes.existsBy({ sessaoId: dados.sessaoId, alunoId: dados.alunoId })) return;
        try {
          await participacoes.insert(dados);
        } catch (erro) {
          // Dois "entrar" ao mesmo tempo: a chave primária barra o segundo — e tudo bem.
          if (!ehValorDuplicado(erro)) throw erro;
        }
      },
      existe: (sessaoId, alunoId) => participacoes.existsBy({ sessaoId, alunoId }),
      async listarPorSessao(sessaoId) {
        const lista = await participacoes.findBy({ sessaoId });
        return lista.map(({ sessaoId, alunoId, entradaEm }) => ({ sessaoId, alunoId, entradaEm }));
      },
    }),

        conteudo: comTraducaoDeErros({
      // Níveis (no banco a coluna é NUMERO_NIVEL; no domínio é `ordem`)
      async listarNiveis() {
        return (await niveis.find({ order: { numero: 'ASC' } })).map(paraNivel);
      },
      async buscarNivel(id) {
        const n = await niveis.findOneBy({ id });
        return n ? paraNivel(n) : null;
      },
      async buscarNivelPorOrdem(ordem) {
        const n = await niveis.findOneBy({ numero: ordem });
        return n ? paraNivel(n) : null;
      },
      async criarNivel(dados) {
        const { ordem, ...resto } = dados;
        return paraNivel(await niveis.save(niveis.create({ ...resto, numero: ordem })));
      },
      async atualizarNivel(nivel) {
        const { ordem, ...resto } = nivel;
        return paraNivel(await niveis.save(niveis.create({ ...resto, numero: ordem })));
      },
      async removerNivel(id) {
        await niveis.delete({ id });
      },

      // Fases
      async listarFases() {
        const lista = await fases.find({ relations: { nivel: true } }); // JOIN com NIVEL
        return lista.map(paraFaseComNivel);
      },
      async buscarFase(id) {
        const f = await fases.findOneBy({ id });
        return f ? paraFase(f) : null;
      },
      async buscarFasePorOrdem(nivelId, ordem) {
        const f = await fases.findOneBy({ nivelId, ordem });
        return f ? paraFase(f) : null;
      },
      async criarFase(dados) {
        return paraFase(await fases.save(fases.create(dados)));
      },
      async atualizarFase(fase) {
        return paraFase(await fases.save(fases.create(fase)));
      },
      async removerFase(id) {
        await fases.delete({ id });
      },
      async contarDesafiosPorFase() {
        // SELECT ID_FASE, COUNT(*) FROM DESAFIO GROUP BY ID_FASE
        const linhas = await desafios
          .createQueryBuilder('d')
          .select('d.faseId', 'faseId')
          .addSelect('COUNT(*)', 'total')
          .groupBy('d.faseId')
          .getRawMany();
        return new Map(linhas.map((l) => [Number(l.faseId), Number(l.total)]));
      },

      // Desafios
      async listarDesafios(faseId) {
        const lista = await desafios.find({ where: { faseId }, order: { ordem: 'ASC', id: 'ASC' } });
        return lista.map(paraDesafio);
      },
      async buscarDesafio(id) {
        const d = await desafios.findOneBy({ id });
        return d ? paraDesafio(d) : null;
      },
      async criarDesafio(dados) {
        return paraDesafio(await desafios.save(desafios.create(dados)));
      },
      async atualizarDesafio(desafio) {
        return paraDesafio(await desafios.save(desafios.create(desafio)));
      },
      async removerDesafio(id) {
        await desafios.delete({ id });
      },
    }),

    tentativas: comTraducaoDeErros({
      // Ao inserir, a trigger TRG_ATUALIZA_PROGRESSO_OFICIAL atualiza PROGRESSO_FASE sozinha.
      async criar(dados) {
        return paraTentativa(await tentativas.save(tentativas.create(dados)));
      },
      async listarPorSessao(sessaoId) {
        return (await tentativas.findBy({ sessaoId })).map(paraTentativa);
      },
        existeNaFase: (faseId) => tentativas.existsBy({ faseId }),
              async listarPorAluno(alunoId) {
        const lista = await tentativas.find({ where: { alunoId }, order: { id: 'ASC' } });
        return lista.map(paraTentativa);
      },
    }),

      respostas: comTraducaoDeErros({
      async registrar(tentativaId, itens) {
        // Uma linha por desafio. Roda dentro da transação da tentativa: ou grava tudo, ou nada.
        for (const item of itens) {
          await respostasDesafio.insert({ tentativaId, ...item });
        }
      },
      async listarPorTentativa(tentativaId) {
        const lista = await respostasDesafio.find({ where: { tentativaId }, order: { id: 'ASC' } });
        return lista.map(paraResposta);
      },
    }),

    progressos: comTraducaoDeErros({
      async listarPorAluno(alunoId) {
        return (await progressos.findBy({ alunoId })).map(paraProgresso);
      },
      async buscar(alunoId, faseId) {
        const p = await progressos.findOneBy({ alunoId, faseId });
        return p ? paraProgresso(p) : null;
      },
    }),

    rankings: comTraducaoDeErros({
      async salvar(ranking) {
        // Uma linha por aluno (dentro da transação do encerramento: ou grava todas, ou nenhuma)
        for (const item of ranking.itens) {
          await rankings.insert({ ...item, sessaoId: ranking.sessaoId, geradoEm: ranking.geradoEm });
        }
      },
      async buscarPorSessao(sessaoId) {
        const linhas = await rankings.find({ where: { sessaoId }, order: { posicao: 'ASC', nome: 'ASC' } });
        if (linhas.length === 0) return null;
        return {
          sessaoId,
          geradoEm: linhas[0]!.geradoEm,
          itens: linhas.map((l) => ({
            posicao: l.posicao,
            alunoId: l.alunoId,
            nome: l.nome,
            nivelAlcancado: l.nivelAlcancado,
            estrelasNaSessao: l.estrelasNaSessao,
            fasesConcluidasNaSessao: l.fasesConcluidasNaSessao,
            tempoTotalSegundos: l.tempoTotalSegundos,
          })),
        };
      },
    }),

        relatorios: comTraducaoDeErros({
      async estatisticasDaTurma(turmaId) {
        const linha = await consultaEstatisticas(turmaId).getRawOne();
        return paraEstatisticas(linha ?? {});
      },
      async estatisticasPorFase(turmaId) {
        // Mesma consulta + GROUP BY fase
        const linhas = await consultaEstatisticas(turmaId)
          .addSelect('t.faseId', 'faseId')
          .groupBy('t.faseId')
          .getRawMany();
        return linhas.map((l) => ({ faseId: Number(l.faseId), ...paraEstatisticas(l) }));
      },
      async errosPorDesafio(turmaId) {
        // RESPOSTA_DESAFIO r JOIN TENTATIVA_FASE t JOIN ALUNO a ... GROUP BY r.ID_DESAFIO
        const linhas = await respostasDesafio
          .createQueryBuilder('r')
          .innerJoin(TentativaFaseEntity, 't', 't.id = r.tentativaId')
          .innerJoin(AlunoEntity, 'a', 'a.id = t.alunoId')
          .select('r.desafioId', 'desafioId')
          .addSelect('COUNT(*)', 'respostas')
          .addSelect("SUM(CASE WHEN r.acertou = 'N' THEN 1 ELSE 0 END)", 'erros')
          .where('a.turmaId = :turmaId', { turmaId })
          .groupBy('r.desafioId')
          .getRawMany();
        return linhas.map((l) => ({
          desafioId: Number(l.desafioId),
          respostas: Number(l.respostas),
          erros: Number(l.erros),
        }));
      },
    }),
    /**
     * TRANSAÇÃO (unit of work): tudo o que `trabalho` fizer usa o mesmo manager.
     * Se der erro no meio, o Oracle desfaz tudo (ROLLBACK); se der certo, grava tudo (COMMIT).
     */
        async transacao(trabalho) {
      if (manager.queryRunner?.isTransactionActive) return trabalho(repos); // já dentro de uma
      try {
        return await manager.transaction((managerDaTransacao) =>
          trabalho(criarRepositoriosOracle(managerDaTransacao)),
        );
      } catch (erro) {
        throw traduzirErroOracle(erro); // ex.: conexão caiu ao começar → 503
      }
    },
  };

  return repos;
}