import type { Aluno, FaseComNivel, Progresso, Sessao, Tentativa } from '../../domain/entidades.js';
import type {
  AlunoEntity,
  FaseEntity,
  ProgressoFaseEntity,
  SessaoAulaEntity,
  TentativaFaseEntity,
} from '../../database/entidades.js';

/**
 * MAPEADORES: convertem as entidades do TypeORM (linhas do Oracle) nos tipos do domínio.
 *
 * Por que não usar a entidade direto nas regras? Porque o domínio não deve depender do banco:
 * se a coluna mudar de nome, só o mapeador muda — as regras de negócio e os testes continuam iguais.
 */

export function paraSessao(s: SessaoAulaEntity): Sessao {
  return {
    id: s.id,
    turmaId: s.turmaId,
    professorId: s.professorId,
    status: s.status,
    criadaEm: s.criadaEm,
    dataHoraInicio: s.dataAbertura,
    dataHoraFim: s.dataEncerramento,
  };
}

export function paraAluno(a: AlunoEntity): Aluno {
  return {
    id: a.id,
    turmaId: a.turmaId,
    nome: a.nome,
    nomeNormalizado: a.nomeNormalizado,
    idade: a.idade,
    status: a.status,
    criadoEm: a.criadoEm,
  };
}

/** A fase precisa vir com o nível carregado (relations: { nivel: true }). */
export function paraFase(f: FaseEntity): FaseComNivel {
  const nivel = f.nivel!;
  return {
    id: f.id,
    nivelId: f.nivelId,
    ordem: f.ordem,
    titulo: f.titulo,
    tipo: f.tipo,
    nivel: { id: nivel.id, ordem: nivel.numero, titulo: nivel.titulo, descricao: nivel.descricao },
  };
}

export function paraTentativa(t: TentativaFaseEntity): Tentativa {
  return {
    id: t.id,
    alunoId: t.alunoId,
    faseId: t.faseId,
    sessaoId: t.sessaoId,
    percentual: t.percentual,
    estrelas: t.estrelas,
    pontos: t.pontos,
    aprovada: t.aprovada,
    tempoSegundos: t.tempoSegundos,
    dataHora: t.dataHora,
  };
}

export function paraProgresso(p: ProgressoFaseEntity): Progresso {
  return {
    alunoId: p.alunoId,
    faseId: p.faseId,
    melhorEstrelas: p.estrelas,
    pontuacaoMaxima: p.pontuacaoMaxima,
    concluida: p.concluida,
    atualizadoEm: p.atualizadoEm,
  };
}