import type { Aluno, Sessao } from '../../domain/entidades.js';
import { limparNome, normalizarNome } from '../../domain/regras/identificacao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { SessoesService } from '../sessoes/sessoes.service.js';
import {
  atualizarAlunoSchema,
  entrarSchema,
  type AtualizarAlunoInput,
  type EntrarInput,
} from './alunos.schemas.js';

export interface ResultadoEntrada {
  aluno: Aluno;
  sessao: Sessao;
  novo: boolean; // true = primeiro acesso (cadastro automático); false = perfil recuperado
}

/** Aluno na lista da aula: dados do aluno + quando entrou. */
export interface AlunoNaSessao extends Aluno {
  entradaEm: Date;
}

export class AlunosService {
  private readonly sessoes: SessoesService;

  constructor(private readonly ctx: Contexto) {
    this.sessoes = new SessoesService(ctx);
  }

  /**
   * RF-P01/02/03, RF-D09, RF-A01/02, RN02/03/04, CA01/02/03
   *
   * 1. Exige sessão aberta (senão: "Aguardando professor iniciar a aula").
   * 2. Valida nome e idade.
   * 3. Procura o aluno na TURMA da sessão por (nome normalizado + idade):
   *      existe → recupera o mesmo perfil e progresso (sem duplicar)
   *      não existe → cria automaticamente
   * 4. Registra que o aluno participou desta sessão.
   */
  async entrar(input: EntrarInput): Promise<ResultadoEntrada> {
    const sessao = await this.sessoes.exigirAberta();
    const dados = entrarSchema.parse(input);
    const { repos, agora } = this.ctx;

    const nomeNormalizado = normalizarNome(dados.nome);
    let aluno = await repos.alunos.buscarPorIdentificacao(sessao.turmaId, nomeNormalizado, dados.idade);
    const novo = aluno === null;

    if (!aluno) {
      aluno = await repos.alunos.criar({
        turmaId: sessao.turmaId,
        nome: limparNome(dados.nome),
        nomeNormalizado,
        idade: dados.idade,
        status: 'ATIVO',
        criadoEm: agora(),
      });
    } else if (aluno.status === 'DESATIVADO') {
      throw Erros.alunoDesativado();
    }

    await repos.participacoes.registrar({ sessaoId: sessao.id, alunoId: aluno.id, entradaEm: agora() });
    return { aluno, sessao, novo };
  }

  /** RF-D08 / RN10 / CA10 — some da lista ativa, mas tentativas e relatórios são mantidos. */
  async desativar(alunoId: number): Promise<Aluno> {
    await this.buscar(alunoId);
    return this.ctx.repos.alunos.atualizarStatus(alunoId, 'DESATIVADO');
  }

  async reativar(alunoId: number): Promise<Aluno> {
    await this.buscar(alunoId);
    return this.ctx.repos.alunos.atualizarStatus(alunoId, 'ATIVO');
  }

  async buscar(alunoId: number): Promise<Aluno> {
    const aluno = await this.ctx.repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();
    return aluno;
  }

    /**
   * Etapa 4 — corrige nome, idade ou personagem.
   * Continua valendo a RN04: não pode ficar igual a outro aluno da mesma turma.
   */
  async atualizar(alunoId: number, input: AtualizarAlunoInput): Promise<Aluno> {
    const dados = atualizarAlunoSchema.parse(input);
    const aluno = await this.buscar(alunoId);

    const nome = dados.nome !== undefined ? limparNome(dados.nome) : aluno.nome;
    const nomeNormalizado = normalizarNome(nome);
    const idade = dados.idade ?? aluno.idade;

    const outro = await this.ctx.repos.alunos.buscarPorIdentificacao(aluno.turmaId, nomeNormalizado, idade);
    if (outro && outro.id !== aluno.id) throw Erros.alunoJaExiste();

    return this.ctx.repos.alunos.atualizar({
      ...aluno,
      nome,
      nomeNormalizado,
      idade,
    });
  }

  /** Todos os alunos da turma, em ordem alfabética (ativos e desativados). */
  async listarDaTurma(turmaId: number): Promise<Aluno[]> {
    const turma = await this.ctx.repos.turmas.buscarPorId(turmaId);
    if (!turma) throw Erros.turmaNaoEncontrada();
    const alunos = await this.ctx.repos.alunos.listarPorTurma(turmaId);
    return alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** RF-D07 — alunos que entraram nesta aula, com o status de cada um. */
  async listarDaSessao(sessaoId: number): Promise<AlunoNaSessao[]> {
    const sessao = await this.ctx.repos.sessoes.buscarPorId(sessaoId);
    if (!sessao) throw Erros.sessaoNaoEncontrada();

    const participacoes = await this.ctx.repos.participacoes.listarPorSessao(sessaoId);
    const lista: AlunoNaSessao[] = [];
    for (const p of participacoes) {
      const aluno = await this.ctx.repos.alunos.buscarPorId(p.alunoId);
      if (aluno) lista.push({ ...aluno, entradaEm: p.entradaEm });
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}
