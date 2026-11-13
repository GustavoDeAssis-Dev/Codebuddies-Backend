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
  Professor,
} from '../../domain/entidades.js';
import type { Repositorios } from '../contratos.js';
import { conteudoInicial } from './conteudo-inicial.js';
import { consolidarProgresso } from '../../domain/regras/progressao.js';

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
  const professores = new Map<number, Professor>();

  const repos: Repositorios = {
        professores: {
      async buscarPorId(id) {
        const p = professores.get(id);
        return p ? copia(p) : null;
      },
      async buscarPorEmail(email) {
        const p = [...professores.values()].find((x) => x.email === email);
        return p ? copia(p) : null;
      },
      async criar(dados) {
        const p = { id: novoId(), ...dados };
        professores.set(p.id, p);
        return copia(p);
      },
            async listar() {
        return copia([...professores.values()]);
      },
      async atualizar(professor) {
        professores.set(professor.id, copia(professor));
        return copia(professor);
      },
    },
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
            async listar() {
        return copia([...turmas.values()]);
      },
      async atualizar(turma) {
        turmas.set(turma.id, copia(turma));
        return copia(turma);
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
        const s: Sessao = {
          id: novoId(),
          turmaId: dados.turmaId,
          professorId: dados.professorId,
          status: 'CRIADA',
          criadaEm: dados.criadaEm,
          dataHoraInicio: null,
          dataHoraFim: null,
        };
        sessoes.set(s.id, s);
        return copia(s);
      },
      async abrir(id, em) {
        const s = sessoes.get(id)!;
        s.status = 'ABERTA';
        s.dataHoraInicio = em;
        return copia(s);
      },
      async encerrar(id, em) {
        const s = sessoes.get(id)!;
        s.status = 'ENCERRADA';
        s.dataHoraFim = em;
        return copia(s);
      },
            async listar(filtro = {}) {
        const lista = [...sessoes.values()].filter(
          (s) =>
            (filtro.turmaId === undefined || s.turmaId === filtro.turmaId) &&
            (filtro.status === undefined || s.status === filtro.status),
        );
        return copia(lista);
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
            async atualizar(aluno) {
        alunos.set(aluno.id, copia(aluno));
        return copia(aluno);
      },
      async listarPorTurma(turmaId) {
        return copia([...alunos.values()].filter((a) => a.turmaId === turmaId));
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
                // Faz o papel da trigger TRG_ATUALIZA_PROGRESSO_OFICIAL do Oracle
        const chave = chaveProgresso(t.alunoId, t.faseId);
        progressos.set(chave, consolidarProgresso(progressos.get(chave) ?? null, t));
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
      }
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
     // Em memória não existe "desfazer": a transação só executa o trabalho.
    // (No Oracle, um erro no meio desfaz tudo — ver repositories/oracle.)
    async transacao(trabalho) {
      return trabalho(repos);
    },
  };

  return repos;
}
