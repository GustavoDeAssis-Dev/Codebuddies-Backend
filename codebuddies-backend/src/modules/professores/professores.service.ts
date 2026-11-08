import { conferirSenha, gerarHashSenha } from '../../shared/auth/senha.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { AuthService, semSenha, type ProfessorPublico } from '../auth/auth.service.js';
import type { CadastrarProfessorInput } from '../auth/auth.schemas.js';
import { alterarAtivoSchema, trocarSenhaSchema, type AlterarAtivoInput,
  type TrocarSenhaInput, } from './professores.schema.js';

/** Gestão de professores. Decisão da equipe: todo professor pode tudo (não há perfil ADMIN separado). */
export class ProfessoresService {
  private readonly auth: AuthService;

  constructor(private readonly ctx: Contexto) {
    this.auth = new AuthService(ctx);
  }

  async listar(): Promise<ProfessorPublico[]> {
    const professores = await this.ctx.repos.professores.listar();
    return professores.map(semSenha).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  cadastrar(input: CadastrarProfessorInput): Promise<ProfessorPublico> {
    return this.auth.cadastrarProfessor(input); // reaproveita a regra da Etapa 3
  }

  /** Ativar/desativar outro professor. Ninguém desativa a si mesmo (para nunca ficar sem acesso). */
  async alterarAtivo(id: number, input: AlterarAtivoInput, idLogado: number): Promise<ProfessorPublico> {
    const { ativo } = alterarAtivoSchema.parse(input);
    if (id === idLogado && !ativo) throw Erros.naoPodeDesativarASiMesmo();

    const professor = await this.ctx.repos.professores.buscarPorId(id);
    if (!professor) throw Erros.professorNaoEncontrado();

    return semSenha(await this.ctx.repos.professores.atualizar({ ...professor, ativo }));
  }

  /** O professor logado troca a própria senha (precisa confirmar a atual). */
  async trocarSenha(idLogado: number, input: TrocarSenhaInput): Promise<void> {
    const { senhaAtual, novaSenha } = trocarSenhaSchema.parse(input);
    const professor = await this.ctx.repos.professores.buscarPorId(idLogado);
    if (!professor) throw Erros.professorNaoEncontrado();

    if (!(await conferirSenha(senhaAtual, professor.senhaHash))) throw Erros.senhaAtualIncorreta();

    await this.ctx.repos.professores.atualizar({ ...professor, senhaHash: await gerarHashSenha(novaSenha) });
  }
}