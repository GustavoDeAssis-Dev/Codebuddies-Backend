import type {
  Aluno,
  Desafio,
  Fase,
  Nivel,
  Participacao,
  Professor,
  Progresso,
  RankingFinal,
  Sessao,
  Tentativa,
  Turma,
  RespostaDesafio,
} from '../../domain/entidades.js';
import { consolidarProgresso } from '../../domain/regras/progressao.js';
import type { Repositorios, EstatisticasTentativas } from '../contratos.js';
import { conteudoInicial, type ConteudoInicial } from './conteudo-inicial.js';

/**
 * Implementação EM MEMÓRIA dos repositórios.
 * Usada em testes e no desenvolvimento enquanto o banco Oracle não está pronto.
 * Os dados somem quando o servidor reinicia.
 */
export function criarRepositoriosEmMemoria(conteudo: ConteudoInicial = conteudoInicial()): Repositorios {
  let seq = 0;
  const novoId = () => ++seq;
  const copia = <T>(v: T): T => structuredClone(v);

  const turmas = new Map<number, Turma>();
  const sessoes = new Map<number, Sessao>();
  const alunos = new Map<number, Aluno>();
  const participacoes: Participacao[] = [];
  const tentativas: Tentativa[] = [];
  const respostasDesafio: RespostaDesafio[] = [];
  const progressos = new Map<string, Progresso>();
  const rankings = new Map<number, RankingFinal>();
  const chaveProgresso = (alunoId: number, faseId: number) => `${alunoId}:${faseId}`;
  
  // Conteúdo: cada tabela tem sua própria sequência de ids, começando depois do conteúdo inicial
  const niveis = new Map<number, Nivel>(conteudo.niveis.map((n) => [n.id, copia(n)]));
  const fases = new Map<number, Fase>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conteudo.fases.map(({ nivel, ...f }) => [f.id, f]),
  );
  const desafios = new Map<number, Desafio>(conteudo.desafios.map((d) => [d.id, copia(d)]));
  const proximoId = (tabela: Map<number, unknown>) => Math.max(0, ...tabela.keys()) + 1;
  const professores = new Map<number, Professor>();

    // ───── Apoio aos relatórios (Etapa 9): as mesmas contas que o Oracle faz com SUM/AVG/COUNT/MAX/MIN ─────
  const tentativasDaTurma = (turmaId: number) =>
    tentativas.filter((t) => alunos.get(t.alunoId)?.turmaId === turmaId);
  const soma = (valores: number[]) => valores.reduce((total, v) => total + v, 0);
  const media = (valores: number[]) => (valores.length > 0 ? soma(valores) / valores.length : null);

  function estatisticas(lista: Tentativa[]): EstatisticasTentativas {
    const vazia = lista.length === 0; // igual ao SQL: sem linhas, AVG/MAX/MIN/SUM dão NULL
    const percentuais = lista.map((t) => t.percentual);
    return {
      totalTentativas: lista.length,
      alunosQueJogaram: new Set(lista.map((t) => t.alunoId)).size,
      mediaEstrelas: media(lista.map((t) => t.estrelas)),
      mediaPercentual: media(percentuais),
      maiorPercentual: vazia ? null : Math.max(...percentuais),
      menorPercentual: vazia ? null : Math.min(...percentuais),
      somaPontos: vazia ? null : soma(lista.map((t) => t.pontos)),
      tempoMedioSegundos: media(lista.map((t) => t.tempoSegundos)),
      aprovacoes: vazia ? null : lista.filter((t) => t.aprovada).length,
    };
  }
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
      // Níveis
      async listarNiveis() {
        return copia([...niveis.values()]);
      },
      async buscarNivel(id) {
        const n = niveis.get(id);
        return n ? copia(n) : null;
      },
      async buscarNivelPorOrdem(ordem) {
        const n = [...niveis.values()].find((x) => x.ordem === ordem);
        return n ? copia(n) : null;
      },
      async criarNivel(dados) {
        const n = { id: proximoId(niveis), ...dados };
        niveis.set(n.id, n);
        return copia(n);
      },
      async atualizarNivel(nivel) {
        niveis.set(nivel.id, copia(nivel));
        return copia(nivel);
      },
      async removerNivel(id) {
        niveis.delete(id);
      },

      // Fases (o nível vai junto, igual ao JOIN do Oracle)
      async listarFases() {
        return [...fases.values()].map((f) => copia({ ...f, nivel: niveis.get(f.nivelId)! }));
      },
      async buscarFase(id) {
        const f = fases.get(id);
        return f ? copia(f) : null;
      },
      async buscarFasePorOrdem(nivelId, ordem) {
        const f = [...fases.values()].find((x) => x.nivelId === nivelId && x.ordem === ordem);
        return f ? copia(f) : null;
      },
      async criarFase(dados) {
        const f = { id: proximoId(fases), ...dados };
        fases.set(f.id, f);
        return copia(f);
      },
      async atualizarFase(fase) {
        fases.set(fase.id, copia(fase));
        return copia(fase);
      },
      async removerFase(id) {
        fases.delete(id);
      },

      // Desafios
      async listarDesafios(faseId) {
        const lista = [...desafios.values()].filter((d) => d.faseId === faseId);
        return copia(lista.sort((a, b) => a.ordem - b.ordem || a.id - b.id));
      },
      async buscarDesafio(id) {
        const d = desafios.get(id);
        return d ? copia(d) : null;
      },
      async criarDesafio(dados) {
        const d = { id: proximoId(desafios), ...dados };
        desafios.set(d.id, d);
        return copia(d);
      },
      async atualizarDesafio(desafio) {
        desafios.set(desafio.id, copia(desafio));
        return copia(desafio);
      },
      async removerDesafio(id) {
        desafios.delete(id);
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
            async existeNaFase(faseId) {
        return tentativas.some((t) => t.faseId === faseId);
      },
            async listarPorAluno(alunoId) {
        return copia(tentativas.filter((t) => t.alunoId === alunoId));
      },
    },

    respostas: {
      async registrar(tentativaId, itens) {
        for (const item of itens) respostasDesafio.push({ id: novoId(), tentativaId, ...item });
      },
      async listarPorTentativa(tentativaId) {
        return copia(respostasDesafio.filter((r) => r.tentativaId === tentativaId));
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
        relatorios: {
      async estatisticasDaTurma(turmaId) {
        return estatisticas(tentativasDaTurma(turmaId));
      },
      async estatisticasPorFase(turmaId) {
        // GROUP BY fase: Map<faseId, tentativas daquela fase>
        const porFase = new Map<number, Tentativa[]>();
        for (const t of tentativasDaTurma(turmaId)) {
          porFase.set(t.faseId, [...(porFase.get(t.faseId) ?? []), t]);
        }
        return [...porFase].map(([faseId, lista]) => ({ faseId, ...estatisticas(lista) }));
      },
      async errosPorDesafio(turmaId) {
        const daTurma = new Set(tentativasDaTurma(turmaId).map((t) => t.id));
        const porDesafio = new Map<number, { respostas: number; erros: number }>();
        for (const r of respostasDesafio.filter((r) => daTurma.has(r.tentativaId))) {
          const atual = porDesafio.get(r.desafioId) ?? { respostas: 0, erros: 0 };
          porDesafio.set(r.desafioId, {
            respostas: atual.respostas + 1,
            erros: atual.erros + (r.acertou ? 0 : 1),
          });
        }
        return [...porDesafio].map(([desafioId, contagem]) => ({ desafioId, ...contagem }));
      },
    },
  };

  return repos;
}
