import type {
  Aluno,
  Desafio,
  Fase,
  FaseComNivel,
  Nivel,
  Progresso,
  Sessao,
  Tentativa,
} from '../../domain/entidades.js';
import type {
  AlunoEntity,
  DesafioEntity,
  FaseEntity,
  NivelEntity,
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

/** No banco a coluna é NUMERO_NIVEL; no domínio chamamos de `ordem`. */
export function paraNivel(n: NivelEntity): Nivel {
  return { id: n.id, ordem: n.numero, titulo: n.titulo, descricao: n.descricao };
}

/** Fase sem o nível (para cadastro). */
export function paraFase(f: FaseEntity): Fase {
  return { id: f.id, nivelId: f.nivelId, ordem: f.ordem, titulo: f.titulo, tipo: f.tipo };
}

/** Fase com o nível — exige que a consulta tenha carregado a relação `nivel`. */
export function paraFaseComNivel(f: FaseEntity): FaseComNivel {
  return { ...paraFase(f), nivel: paraNivel(f.nivel!) };
}

export function paraDesafio(d: DesafioEntity): Desafio {
  return {
    id: d.id,
    faseId: d.faseId,
    ordem: d.ordem,
    enunciado: d.enunciado,
    respostaCorreta: d.respostaCorreta,
    pontos: d.pontos,
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