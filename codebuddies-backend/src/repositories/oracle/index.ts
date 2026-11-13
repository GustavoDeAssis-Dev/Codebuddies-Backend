import type { EntityManager } from 'typeorm';
import {
  AlunoEntity,
  FaseEntity,
  ParticipacaoEntity,
  ProfessorEntity,
  ProgressoFaseEntity,
  RankingSessaoEntity,
  SessaoAulaEntity,
  TentativaFaseEntity,
  TurmaEntity,
} from '../../database/entidades.js';
import type { Repositorios } from '../contratos.js';
import { comTraducaoDeErros, ehValorDuplicado } from './erros-oracle.js';
import { paraAluno, paraFase, paraProgresso, paraSessao, paraTentativa } from './mapeadores.js';

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
  const fases = manager.getRepository(FaseEntity);
  const tentativas = manager.getRepository(TentativaFaseEntity);
  const progressos = manager.getRepository(ProgressoFaseEntity);
  const rankings = manager.getRepository(RankingSessaoEntity);

  /** Busca a sessão de novo depois de uma procedure (para devolver os dados atualizados). */
  const recarregarSessao = async (id: number) => paraSessao(await sessoes.findOneByOrFail({ id }));

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
      async listarFases() {
        const lista = await fases.find({ relations: { nivel: true } });
        return lista.map((f) => paraFase(f));
      },
      async buscarFase(id) {
        const f = await fases.findOne({ where: { id }, relations: { nivel: true } });
        if (!f) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { nivel, ...fase } = paraFase(f);
        return fase;
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

    /**
     * TRANSAÇÃO (unit of work): tudo o que `trabalho` fizer usa o mesmo manager.
     * Se der erro no meio, o Oracle desfaz tudo (ROLLBACK); se der certo, grava tudo (COMMIT).
     */
    async transacao(trabalho) {
      if (manager.queryRunner?.isTransactionActive) return trabalho(repos); // já dentro de uma
      return manager.transaction((managerDaTransacao) =>
        trabalho(criarRepositoriosOracle(managerDaTransacao)),
      );
    },
  };

  return repos;
}