import type { Desafio, Fase, FaseComNivel, Nivel } from '../../domain/entidades.js';
import { ordenarFases } from '../../domain/regras/progressao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import {
  atualizarDesafioSchema,
  atualizarFaseSchema,
  atualizarNivelSchema,
  criarDesafioSchema,
  criarFaseSchema,
  criarNivelSchema,
  type AtualizarDesafioInput,
  type AtualizarFaseInput,
  type AtualizarNivelInput,
  type CriarDesafioInput,
  type CriarFaseInput,
  type CriarNivelInput,
} from './conteudo.schemas.js';

export interface NivelComFases extends Nivel {
  fases: Fase[];
}

/** Fase na lista do professor: com quantos desafios tem (0 = "em construção", o aluno não vê). */
export interface FaseNaLista extends FaseComNivel {
  totalDesafios: number;
}

export interface FaseDetalhada extends FaseComNivel {
  desafios: Desafio[]; // para o PROFESSOR: inclui a resposta correta
}

/** Próxima posição livre: maior ordem + 1 (ou 1 se a lista estiver vazia). */
const proximaOrdem = (itens: { ordem: number }[]) => Math.max(0, ...itens.map((i) => i.ordem)) + 1;

/**
 * Etapa 6 — Gerenciamento de níveis, fases e desafios pelo professor.
 *
 * Regras:
 *  - Nível: número único (1, 2, 3...). Só é apagado se não tiver fases.
 *  - Fase: posição única dentro do nível. Só é apagada se não tiver desafios e se ninguém jogou.
 *  - Desafio: posição única dentro da fase. Não é apagado se a fase já foi jogada
 *    (mudaria o histórico); corrigir o texto ou a resposta pode.
 *  - Sem "ordem" no cadastro → o item vai para o final.
 */
export class ConteudoService {
  constructor(private readonly ctx: Contexto) {}

  private get conteudo() {
    return this.ctx.repos.conteudo;
  }

  // ═════════════════════════════ NÍVEIS ═════════════════════════════

  async listarNiveis(): Promise<Nivel[]> {
    const niveis = await this.conteudo.listarNiveis();
    return niveis.sort((a, b) => a.ordem - b.ordem);
  }

  async buscarNivel(id: number): Promise<NivelComFases> {
    const nivel = await this.exigirNivel(id);
    const fases = (await this.conteudo.listarFases()).filter((f) => f.nivelId === id);
    return {
      ...nivel,
      fases: ordenarFases(fases).map((f) => ({
        id: f.id,
        nivelId: f.nivelId,
        ordem: f.ordem,
        titulo: f.titulo,
        tipo: f.tipo,
      })),
    };
  }

  async criarNivel(input: CriarNivelInput): Promise<Nivel> {
    const dados = criarNivelSchema.parse(input);
    const ordem = dados.ordem ?? proximaOrdem(await this.conteudo.listarNiveis());
    if (await this.conteudo.buscarNivelPorOrdem(ordem)) throw Erros.nivelDuplicado();

    return this.conteudo.criarNivel({ ordem, titulo: dados.titulo, descricao: dados.descricao ?? null });
  }

  async atualizarNivel(id: number, input: AtualizarNivelInput): Promise<Nivel> {
    const dados = atualizarNivelSchema.parse(input);
    const nivel = await this.exigirNivel(id);

    if (dados.ordem !== undefined && dados.ordem !== nivel.ordem) {
      if (await this.conteudo.buscarNivelPorOrdem(dados.ordem)) throw Erros.nivelDuplicado();
    }

    return this.conteudo.atualizarNivel({
      ...nivel,
      ordem: dados.ordem ?? nivel.ordem,
      titulo: dados.titulo ?? nivel.titulo,
      descricao: dados.descricao !== undefined ? dados.descricao : nivel.descricao,
    });
  }

  async removerNivel(id: number): Promise<void> {
    await this.exigirNivel(id);
    const temFases = (await this.conteudo.listarFases()).some((f) => f.nivelId === id);
    if (temFases) throw Erros.nivelComFases();
    await this.conteudo.removerNivel(id);
  }

  // ═════════════════════════════ FASES ═════════════════════════════

  /** Todas as fases na ordem do jogo (nível 1 fase 1, nível 1 fase 2, ...). */
  async listarFases(): Promise<FaseNaLista[]> {
    const [fases, totais] = await Promise.all([
      this.conteudo.listarFases(),
      this.conteudo.contarDesafiosPorFase(),
    ]);
    return ordenarFases(fases).map((f) => ({ ...f, totalDesafios: totais.get(f.id) ?? 0 }));
  }

  async buscarFase(id: number): Promise<FaseDetalhada> {
    const fase = await this.exigirFase(id);
    const [nivel, desafios] = await Promise.all([
      this.conteudo.buscarNivel(fase.nivelId),
      this.conteudo.listarDesafios(id),
    ]);
    return { ...fase, nivel: nivel!, desafios };
  }

  async criarFase(input: CriarFaseInput): Promise<Fase> {
    const dados = criarFaseSchema.parse(input);
    await this.exigirNivel(dados.nivelId);

    const doNivel = (await this.conteudo.listarFases()).filter((f) => f.nivelId === dados.nivelId);
    const ordem = dados.ordem ?? proximaOrdem(doNivel);
    if (await this.conteudo.buscarFasePorOrdem(dados.nivelId, ordem)) throw Erros.ordemFaseDuplicada();

    return this.conteudo.criarFase({ ...dados, ordem });
  }

  /** Também serve para MOVER a fase de nível ou de posição. */
  async atualizarFase(id: number, input: AtualizarFaseInput): Promise<Fase> {
    const dados = atualizarFaseSchema.parse(input);
    const fase = await this.exigirFase(id);
    const nova: Fase = {
      ...fase,
      nivelId: dados.nivelId ?? fase.nivelId,
      ordem: dados.ordem ?? fase.ordem,
      titulo: dados.titulo ?? fase.titulo,
      tipo: dados.tipo ?? fase.tipo,
    };

    if (nova.nivelId !== fase.nivelId) await this.exigirNivel(nova.nivelId);
    if (nova.nivelId !== fase.nivelId || nova.ordem !== fase.ordem) {
      const ocupada = await this.conteudo.buscarFasePorOrdem(nova.nivelId, nova.ordem);
      if (ocupada && ocupada.id !== id) throw Erros.ordemFaseDuplicada();
    }

    return this.conteudo.atualizarFase(nova);
  }

  async removerFase(id: number): Promise<void> {
    await this.exigirFase(id);
    if (await this.ctx.repos.tentativas.existeNaFase(id)) throw Erros.faseJaJogada();
    if ((await this.conteudo.listarDesafios(id)).length > 0) throw Erros.faseComDesafios();
    await this.conteudo.removerFase(id);
  }

  // ═════════════════════════════ DESAFIOS ═════════════════════════════

  async buscarDesafio(id: number): Promise<Desafio> {
    const desafio = await this.conteudo.buscarDesafio(id);
    if (!desafio) throw Erros.desafioNaoEncontrado();
    return desafio;
  }

  async criarDesafio(faseId: number, input: CriarDesafioInput): Promise<Desafio> {
    const dados = criarDesafioSchema.parse(input);
    await this.exigirFase(faseId);

    const daFase = await this.conteudo.listarDesafios(faseId);
    const ordem = dados.ordem ?? proximaOrdem(daFase);
    if (daFase.some((d) => d.ordem === ordem)) throw Erros.ordemDesafioDuplicada();

    return this.conteudo.criarDesafio({ ...dados, faseId, ordem });
  }

  async atualizarDesafio(id: number, input: AtualizarDesafioInput): Promise<Desafio> {
    const dados = atualizarDesafioSchema.parse(input);
    const desafio = await this.buscarDesafio(id);

    if (dados.ordem !== undefined && dados.ordem !== desafio.ordem) {
      const daFase = await this.conteudo.listarDesafios(desafio.faseId);
      if (daFase.some((d) => d.ordem === dados.ordem && d.id !== id)) throw Erros.ordemDesafioDuplicada();
    }

    return this.conteudo.atualizarDesafio({
      ...desafio,
      ordem: dados.ordem ?? desafio.ordem,
      enunciado: dados.enunciado ?? desafio.enunciado,
      respostaCorreta: dados.respostaCorreta ?? desafio.respostaCorreta,
      pontos: dados.pontos ?? desafio.pontos,
    });
  }

  async removerDesafio(id: number): Promise<void> {
    const desafio = await this.buscarDesafio(id);
    if (await this.ctx.repos.tentativas.existeNaFase(desafio.faseId)) throw Erros.faseJaJogada();
    await this.conteudo.removerDesafio(id);
  }

  // ═════════════════════════════ auxiliares ═════════════════════════════

  private async exigirNivel(id: number): Promise<Nivel> {
    const nivel = await this.conteudo.buscarNivel(id);
    if (!nivel) throw Erros.nivelNaoEncontrado();
    return nivel;
  }

  private async exigirFase(id: number): Promise<Fase> {
    const fase = await this.conteudo.buscarFase(id);
    if (!fase) throw Erros.faseNaoEncontrada();
    return fase;
  }
}