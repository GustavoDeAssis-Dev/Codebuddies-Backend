import type {
  Aluno,
  FaseComNivel,
  Nivel,
  Participacao,
  Progresso,
  RankingFinal,
  Sessao,
  Tentativa,
  Turma,
} from '../../domain/entidades.js';
import type { Repositorios } from '../contratos.js';
import { conteudoInicial } from './conteudo-inicial.js';

/**
 * Implementação EM MEMÓRIA dos repositórios.
 * Usada em testes e no desenvolvimento enquanto o banco Oracle não está pronto.
 * Os dados somem quando o servidor reinicia.
 */
export function criarRepositoriosEmMemoria(
  conteudo: { niveis: Nivel[]; fases: FaseComNivel[] } = conteudoInicial(),
): Repositorios {
  let seq = 0;
  const novoId = () => ++seq;
  const copia = <T>(v: T): T => structuredClone(v);

  const turmas = new Map<number, Turma>();
  const sessoes = new Map<number, Sessao>();
  const alunos = new Map<number, Aluno>();
  const participacoes: Participacao[] = [];
  const tentativas: Tentativa[] = [];
  const progressos = new Map<string, Progresso>();
  const rankings = new Map<number, RankingFinal>();
  const chaveProgresso = (alunoId: number, faseId: number) => `${alunoId}:${faseId}`;

  return {
    turmas: {
      async buscarPorId(id) {
        const t = turmas.get(id);
        return t ? copia(t) : null;
      },
      async criar(dados) {
        const t = { id: novoId(), nome: dados.nome, ativa: true, criadaEm: dados.criadaEm };
        turmas.set(t.id, t);
        return copia(t);
      },
    },

    sessoes: {
      async buscarPorId(id) {
        const s = sessoes.get(id);
        return s ? copia(s) : null;
      },
      async buscarAberta() {
        const s = [...sessoes.values()].find((x) => x.status === 'ABERTA');
        return s ? copia(s) : null;
      },
      async criar(dados) {
        const s = {
          id: novoId(),
          turmaId: dados.turmaId,
          status: 'AGUARDANDO' as const,
          criadaEm: dados.criadaEm,
          dataHoraInicio: null,
          dataHoraFim: null,
        };
        sessoes.set(s.id, s);
        return copia(s);
      },
      async atualizar(sessao) {
        sessoes.set(sessao.id, copia(sessao));
        return copia(sessao);
      },
    },

    alunos: {
      async buscarPorId(id) {
        const a = alunos.get(id);
        return a ? copia(a) : null;
      },
      async buscarPorIdentificacao(turmaId, nomeNormalizado, idade) {
        const a = [...alunos.values()].find(
          (x) => x.turmaId === turmaId && x.nomeNormalizado === nomeNormalizado && x.idade === idade,
        );
        return a ? copia(a) : null;
      },
      async criar(dados) {
        const a = { id: novoId(), ...dados };
        alunos.set(a.id, a);
        return copia(a);
      },
      async atualizarStatus(id, status) {
        const a = alunos.get(id);
        if (!a) throw new Error(`Aluno ${id} não existe`);
        a.status = status;
        return copia(a);
      },
    },

    participacoes: {
      async registrar(dados) {
        const jaExiste = participacoes.some(
          (p) => p.sessaoId === dados.sessaoId && p.alunoId === dados.alunoId,
        );
        if (!jaExiste) participacoes.push(copia(dados));
      },
      async existe(sessaoId, alunoId) {
        return participacoes.some((p) => p.sessaoId === sessaoId && p.alunoId === alunoId);
      },
      async listarPorSessao(sessaoId) {
        return copia(participacoes.filter((p) => p.sessaoId === sessaoId));
      },
    },

    conteudo: {
      async listarFases() {
        return copia(conteudo.fases);
      },
      async buscarFase(id) {
        const f = conteudo.fases.find((x) => x.id === id);
        if (!f) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { nivel, ...fase } = f;
        return copia(fase);
      },
    },

    tentativas: {
      async criar(dados) {
        const t = { id: novoId(), ...dados };
        tentativas.push(t);
        return copia(t);
      },
      async listarPorSessao(sessaoId) {
        return copia(tentativas.filter((t) => t.sessaoId === sessaoId));
      },
    },

    progressos: {
      async listarPorAluno(alunoId) {
        return copia([...progressos.values()].filter((p) => p.alunoId === alunoId));
      },
      async buscar(alunoId, faseId) {
        const p = progressos.get(chaveProgresso(alunoId, faseId));
        return p ? copia(p) : null;
      },
      async salvar(progresso) {
        progressos.set(chaveProgresso(progresso.alunoId, progresso.faseId), copia(progresso));
        return copia(progresso);
      },
    },

    rankings: {
      async salvar(ranking) {
        rankings.set(ranking.sessaoId, copia(ranking));
      },
      async buscarPorSessao(sessaoId) {
        const r = rankings.get(sessaoId);
        return r ? copia(r) : null;
      },
    },
  };
}
