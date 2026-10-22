import type { Aluno, Sessao } from '../../domain/entidades.js';
import { limparNome, normalizarNome } from '../../domain/regras/identificacao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { SessoesService } from '../sessoes/sessoes.service.js';
import { entrarSchema, type EntrarInput } from './alunos.schemas.js';

export interface ResultadoEntrada {
  aluno: Aluno;
  sessao: Sessao;
  novo: boolean; // true = primeiro acesso (cadastro automático); false = perfil recuperado
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
        personagem: dados.personagem ?? null,
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
}
