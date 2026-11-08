import type { Turma } from '../../domain/entidades.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import {
  atualizarTurmaSchema,
  criarTurmaSchema,
  type AtualizarTurmaInput,
  type CriarTurmaInput,
} from './turmas.schemas.js';

/** CRUD de turmas (ex.: "2º ano B"). Turma não é apagada: é desativada, para manter o histórico. */
export class TurmasService {
  constructor(private readonly ctx: Contexto) {}

  async criar(input: CriarTurmaInput): Promise<Turma> {
    const { nome } = criarTurmaSchema.parse(input);
    return this.ctx.repos.turmas.criar({ nome, criadaEm: this.ctx.agora() });
  }

  async listar(): Promise<Turma[]> {
    const turmas = await this.ctx.repos.turmas.listar();
    return turmas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async buscar(id: number): Promise<Turma> {
    const turma = await this.ctx.repos.turmas.buscarPorId(id);
    if (!turma) throw Erros.turmaNaoEncontrada();
    return turma;
  }

  async atualizar(id: number, input: AtualizarTurmaInput): Promise<Turma> {
    const dados = atualizarTurmaSchema.parse(input);
    const turma = await this.buscar(id);

    if (dados.ativa === false) {
      const aberta = await this.ctx.repos.sessoes.buscarAberta();
      if (aberta?.turmaId === id) throw Erros.turmaComAulaAberta();
    }

    return this.ctx.repos.turmas.atualizar({ ...turma, ...dados });
  }
}