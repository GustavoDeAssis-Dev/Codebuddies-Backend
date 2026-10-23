import type { Professor } from '../../domain/entidades.js';
import { conferirSenha, gerarHashSenha } from '../../shared/auth/senha.js';
import { gerarToken } from '../../shared/auth/token.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { AlunosService } from '../alunos/alunos.service.js';
import type { EntrarInput } from '../alunos/alunos.schemas.js';
import {
  cadastrarProfessorSchema,
  loginProfessorSchema,
  type CadastrarProfessorInput,
  type LoginProfessorInput,
} from './auth.schemas.js';

/** Dados do professor que podem sair da API (sem o hash da senha!). */
export type ProfessorPublico = Omit<Professor, 'senhaHash'>;

// Lista explícita do que pode sair: se um dia surgir um campo sensível novo, ele não vaza por acidente.
function semSenha(p: Professor): ProfessorPublico {
  return { id: p.id, nome: p.nome, email: p.email, ativo: p.ativo, criadoEm: p.criadoEm };
}

export class AuthService {
  private readonly alunos: AlunosService;

  constructor(private readonly ctx: Contexto) {
    this.alunos = new AlunosService(ctx);
  }

  /** RF-D01 — login do docente com e-mail + senha. */
  async loginProfessor(input: LoginProfessorInput) {
    const { email, senha } = loginProfessorSchema.parse(input);
    const professor = await this.ctx.repos.professores.buscarPorEmail(email);

    // Mesma mensagem para "e-mail não existe" e "senha errada":
    // assim ninguém descobre quais e-mails estão cadastrados.
    const senhaOk = professor !== null && (await conferirSenha(senha, professor.senhaHash));
    if (!professor || !senhaOk || !professor.ativo) throw Erros.credenciaisInvalidas();

    const token = gerarToken({ perfil: 'PROFESSOR', id: professor.id });
    return { token, professor: semSenha(professor) };
  }

  /** RF-P01 / RF-A01 — aluno entra com nome + idade (regras da Etapa 2) e recebe um token. */
  async entrarAluno(input: EntrarInput) {
    const { aluno, sessao, novo } = await this.alunos.entrar(input);
    const token = gerarToken({ perfil: 'ALUNO', id: aluno.id, sessaoId: sessao.id });
    return {
      token,
      novo,
      aluno: { id: aluno.id, nome: aluno.nome, idade: aluno.idade, personagem: aluno.personagem },
      sessao: { id: sessao.id },
    };
  }

  async cadastrarProfessor(input: CadastrarProfessorInput): Promise<ProfessorPublico> {
    const dados = cadastrarProfessorSchema.parse(input);
    if (await this.ctx.repos.professores.buscarPorEmail(dados.email)) throw Erros.emailJaCadastrado();

    const professor = await this.ctx.repos.professores.criar({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await gerarHashSenha(dados.senha),
      ativo: true,
      criadoEm: this.ctx.agora(),
    });
    return semSenha(professor);
  }

  /** Cria o professor inicial do .env, se ainda não existir (usado ao subir o servidor). */
  async garantirProfessorInicial(dados: CadastrarProfessorInput): Promise<void> {
    const email = dados.email.trim().toLowerCase();
    if (!(await this.ctx.repos.professores.buscarPorEmail(email))) await this.cadastrarProfessor(dados);
  }

  /** Dados de quem está logado (GET /api/auth/eu). */
  async buscarProfessor(id: number): Promise<ProfessorPublico> {
    const professor = await this.ctx.repos.professores.buscarPorId(id);
    if (!professor || !professor.ativo) throw Erros.tokenInvalido();
    return semSenha(professor);
  }
}