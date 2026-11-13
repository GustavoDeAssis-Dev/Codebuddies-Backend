import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  type Relation,
  type ValueTransformer,
} from 'typeorm';

/**
 * ENTIDADES DO TYPEORM — uma classe por tabela do Oracle (classes de domínio com ANOTAÇÕES).
 *
 * É o equivalente ao Entity Framework visto na disciplina:
 *   [Table("ALUNO")]        →  @Entity('ALUNO')
 *   [Key]                   →  @PrimaryGeneratedColumn / @PrimaryColumn
 *   [Column("NOME")]        →  @Column({ name: 'NOME' })
 *   [ForeignKey] + navegação →  @ManyToOne + @JoinColumn  /  @OneToMany
 *
 * Regras que valem para todas:
 *  - Nomes em MAIÚSCULAS: no Oracle, tabelas criadas sem aspas ficam em maiúsculas, e o TypeORM
 *    sempre usa aspas ("ALUNO"). Com "aluno" minúsculo, o Oracle não encontraria a tabela.
 *  - Todo @Column tem `type` explícito: o tsx (que roda o projeto em dev) não gera os metadados
 *    de tipo automaticamente, então informamos o tipo na mão.
 *  - `Relation<...>` evita erro de "importação circular" entre classes que se referenciam.
 *  - Ninguém aqui cria ou altera tabelas (synchronize: false). A estrutura é dos scripts do Leonardo.
 */

/** O banco guarda "verdadeiro/falso" como CHAR(1) 'S' / 'N'. Este conversor faz a tradução. */
const simNao: ValueTransformer = {
  to: (valor?: boolean) => (valor === undefined ? undefined : valor ? 'S' : 'N'),
  from: (valor: string | null) => valor === 'S',
};

// ─────────────────────────────── Pessoas e aulas ───────────────────────────────

@Entity('PROFESSOR')
export class ProfessorEntity {
  @PrimaryGeneratedColumn({ name: 'ID_PROFESSOR', type: 'number' })
  id!: number;

  @Column({ name: 'NOME', type: 'varchar2', length: 100 })
  nome!: string;

  @Column({ name: 'EMAIL', type: 'varchar2', length: 120 })
  email!: string;

  /** Hash bcrypt da senha (o nome da coluna é do script original do Leonardo). */
  @Column({ name: 'PIN_HASH', type: 'varchar2', length: 128 })
  senhaHash!: string;

  @Column({ name: 'ATIVO', type: 'char', length: 1, transformer: simNao })
  ativo!: boolean;

  @Column({ name: 'DATA_CADASTRO', type: 'timestamp' })
  criadoEm!: Date;
}

@Entity('TURMA')
export class TurmaEntity {
  @PrimaryGeneratedColumn({ name: 'ID_TURMA', type: 'number' })
  id!: number;

  @Column({ name: 'NOME', type: 'varchar2', length: 80 })
  nome!: string;

  @Column({ name: 'ATIVA', type: 'char', length: 1, transformer: simNao })
  ativa!: boolean;

  @Column({ name: 'DATA_CRIACAO', type: 'timestamp' })
  criadaEm!: Date;

  @OneToMany(() => SessaoAulaEntity, (sessao) => sessao.turma)
  sessoes?: Relation<SessaoAulaEntity>[];

  @OneToMany(() => AlunoEntity, (aluno) => aluno.turma)
  alunos?: Relation<AlunoEntity>[];
}

@Entity('SESSAO_AULA')
export class SessaoAulaEntity {
  @PrimaryGeneratedColumn({ name: 'ID_SESSAO', type: 'number' })
  id!: number;

  @Column({ name: 'ID_TURMA', type: 'number' })
  turmaId!: number;

  @ManyToOne(() => TurmaEntity, (turma) => turma.sessoes)
  @JoinColumn({ name: 'ID_TURMA' })
  turma?: Relation<TurmaEntity>;

  @Column({ name: 'ID_PROFESSOR', type: 'number' })
  professorId!: number;

  @ManyToOne(() => ProfessorEntity)
  @JoinColumn({ name: 'ID_PROFESSOR' })
  professor?: Relation<ProfessorEntity>;

  /** CRIADA → ABERTA → ENCERRADA (mudado só pelas procedures PRC_ABRIR_SESSAO / PRC_ENCERRAR_SESSAO). */
  @Column({ name: 'STATUS', type: 'varchar2', length: 20 })
  status!: 'CRIADA' | 'ABERTA' | 'ENCERRADA';

  @Column({ name: 'DATA_CRIACAO', type: 'timestamp' })
  criadaEm!: Date;

  @Column({ name: 'DATA_ABERTURA', type: 'timestamp', nullable: true })
  dataAbertura!: Date | null;

  @Column({ name: 'DATA_ENCERRAMENTO', type: 'timestamp', nullable: true })
  dataEncerramento!: Date | null;
}

@Entity('ALUNO')
export class AlunoEntity {
  @PrimaryGeneratedColumn({ name: 'ID_ALUNO', type: 'number' })
  id!: number;

  @Column({ name: 'ID_TURMA', type: 'number' })
  turmaId!: number;

  @ManyToOne(() => TurmaEntity, (turma) => turma.alunos)
  @JoinColumn({ name: 'ID_TURMA' })
  turma?: Relation<TurmaEntity>;

  @Column({ name: 'NOME', type: 'varchar2', length: 80 })
  nome!: string;

  @Column({ name: 'NOME_NORMALIZADO', type: 'varchar2', length: 80 })
  nomeNormalizado!: string;

  @Column({ name: 'IDADE', type: 'number' })
  idade!: number;

  @Column({ name: 'STATUS', type: 'varchar2', length: 20 })
  status!: 'ATIVO' | 'DESATIVADO';

  @Column({ name: 'DATA_CADASTRO', type: 'timestamp' })
  criadoEm!: Date;
}

/** Tabela associativa N:N — quais alunos entraram em qual aula. Chave primária composta. */
@Entity('PARTICIPACAO')
export class ParticipacaoEntity {
  @PrimaryColumn({ name: 'ID_SESSAO', type: 'number' })
  sessaoId!: number;

  @PrimaryColumn({ name: 'ID_ALUNO', type: 'number' })
  alunoId!: number;

  @ManyToOne(() => SessaoAulaEntity)
  @JoinColumn({ name: 'ID_SESSAO' })
  sessao?: Relation<SessaoAulaEntity>;

  @ManyToOne(() => AlunoEntity)
  @JoinColumn({ name: 'ID_ALUNO' })
  aluno?: Relation<AlunoEntity>;

  @Column({ name: 'DATA_ENTRADA', type: 'timestamp' })
  entradaEm!: Date;
}

// ─────────────────────────────── Conteúdo pedagógico ───────────────────────────────

@Entity('NIVEL')
export class NivelEntity {
  @PrimaryGeneratedColumn({ name: 'ID_NIVEL', type: 'number' })
  id!: number;

  @Column({ name: 'NUMERO_NIVEL', type: 'number' })
  numero!: number;

  @Column({ name: 'TITULO', type: 'varchar2', length: 50 })
  titulo!: string;

  @Column({ name: 'DESCRICAO', type: 'varchar2', length: 200, nullable: true })
  descricao!: string | null;

  @OneToMany(() => FaseEntity, (fase) => fase.nivel)
  fases?: Relation<FaseEntity>[];
}

@Entity('FASE')
export class FaseEntity {
  @PrimaryGeneratedColumn({ name: 'ID_FASE', type: 'number' })
  id!: number;

  @Column({ name: 'ID_NIVEL', type: 'number' })
  nivelId!: number;

  @ManyToOne(() => NivelEntity, (nivel) => nivel.fases)
  @JoinColumn({ name: 'ID_NIVEL' })
  nivel?: Relation<NivelEntity>;

  @Column({ name: 'ORDEM_FASE', type: 'number' })
  ordem!: number;

  @Column({ name: 'TITULO', type: 'varchar2', length: 80 })
  titulo!: string;

  @Column({ name: 'TIPO_ATIVIDADE', type: 'varchar2', length: 30 })
  tipo!: 'DIGITACAO' | 'LOGICA' | 'COMPUTACAO_BASICA';

  @OneToMany(() => DesafioEntity, (desafio) => desafio.fase)
  desafios?: Relation<DesafioEntity>[];
}

@Entity('DESAFIO')
export class DesafioEntity {
  @PrimaryGeneratedColumn({ name: 'ID_DESAFIO', type: 'number' })
  id!: number;

  @Column({ name: 'ID_FASE', type: 'number' })
  faseId!: number;

  @ManyToOne(() => FaseEntity, (fase) => fase.desafios)
  @JoinColumn({ name: 'ID_FASE' })
  fase?: Relation<FaseEntity>;

  @Column({ name: 'ORDEM', type: 'number' })
  ordem!: number;

  @Column({ name: 'ENUNCIADO', type: 'varchar2', length: 255 })
  enunciado!: string;

  @Column({ name: 'RESPOSTA_CORRETA', type: 'varchar2', length: 100 })
  respostaCorreta!: string;

  @Column({ name: 'PONTOS', type: 'number' })
  pontos!: number;
}

// ─────────────────────────────── Jogadas e resultados ───────────────────────────────

@Entity('TENTATIVA_FASE')
export class TentativaFaseEntity {
  @PrimaryGeneratedColumn({ name: 'ID_TENTATIVA', type: 'number' })
  id!: number;

  @Column({ name: 'ID_ALUNO', type: 'number' })
  alunoId!: number;

  @ManyToOne(() => AlunoEntity)
  @JoinColumn({ name: 'ID_ALUNO' })
  aluno?: Relation<AlunoEntity>;

  @Column({ name: 'ID_FASE', type: 'number' })
  faseId!: number;

  @ManyToOne(() => FaseEntity)
  @JoinColumn({ name: 'ID_FASE' })
  fase?: Relation<FaseEntity>;

  @Column({ name: 'ID_SESSAO', type: 'number' })
  sessaoId!: number;

  @ManyToOne(() => SessaoAulaEntity)
  @JoinColumn({ name: 'ID_SESSAO' })
  sessao?: Relation<SessaoAulaEntity>;

  @Column({ name: 'ESTRELAS_OBTIDAS', type: 'number' })
  estrelas!: number;

  @Column({ name: 'PONTOS_OBTIDOS', type: 'number' })
  pontos!: number;

  @Column({ name: 'PERCENTUAL_ACERTOS', type: 'number' })
  percentual!: number;

  @Column({ name: 'TEMPO_SEGUNDOS', type: 'number' })
  tempoSegundos!: number;

  @Column({ name: 'APROVADO', type: 'char', length: 1, transformer: simNao })
  aprovada!: boolean;

  @Column({ name: 'DATA_TENTATIVA', type: 'timestamp' })
  dataHora!: Date;
}

@Entity('RESPOSTA_DESAFIO')
export class RespostaDesafioEntity {
  @PrimaryGeneratedColumn({ name: 'ID_RESPOSTA', type: 'number' })
  id!: number;

  @Column({ name: 'ID_TENTATIVA', type: 'number' })
  tentativaId!: number;

  @ManyToOne(() => TentativaFaseEntity)
  @JoinColumn({ name: 'ID_TENTATIVA' })
  tentativa?: Relation<TentativaFaseEntity>;

  @Column({ name: 'ID_DESAFIO', type: 'number' })
  desafioId!: number;

  @ManyToOne(() => DesafioEntity)
  @JoinColumn({ name: 'ID_DESAFIO' })
  desafio?: Relation<DesafioEntity>;

  @Column({ name: 'RESPOSTA_SUBMETIDA', type: 'varchar2', length: 100, nullable: true })
  respostaSubmetida!: string | null;

  @Column({ name: 'ACERTOU', type: 'char', length: 1, transformer: simNao })
  acertou!: boolean;
}

/** Melhor resultado do aluno em cada fase. Quem grava é a trigger TRG_ATUALIZA_PROGRESSO_OFICIAL. */
@Entity('PROGRESSO_FASE')
export class ProgressoFaseEntity {
  @PrimaryGeneratedColumn({ name: 'ID_PROGRESSO', type: 'number' })
  id!: number;

  @Column({ name: 'ID_ALUNO', type: 'number' })
  alunoId!: number;

  @ManyToOne(() => AlunoEntity)
  @JoinColumn({ name: 'ID_ALUNO' })
  aluno?: Relation<AlunoEntity>;

  @Column({ name: 'ID_FASE', type: 'number' })
  faseId!: number;

  @ManyToOne(() => FaseEntity)
  @JoinColumn({ name: 'ID_FASE' })
  fase?: Relation<FaseEntity>;

  @Column({ name: 'ESTRELAS', type: 'number' })
  estrelas!: number;

  @Column({ name: 'PONTUACAO_MAXIMA', type: 'number' })
  pontuacaoMaxima!: number;

  @Column({ name: 'CONCLUIDA', type: 'char', length: 1, transformer: simNao })
  concluida!: boolean;

  @Column({ name: 'DATA_ATUALIZACAO', type: 'timestamp' })
  atualizadoEm!: Date;
}

/** Ranking congelado de cada aula (uma linha por aluno). Chave primária composta. */
@Entity('RANKING_SESSAO')
export class RankingSessaoEntity {
  @PrimaryColumn({ name: 'ID_SESSAO', type: 'number' })
  sessaoId!: number;

  @PrimaryColumn({ name: 'ID_ALUNO', type: 'number' })
  alunoId!: number;

  @ManyToOne(() => SessaoAulaEntity)
  @JoinColumn({ name: 'ID_SESSAO' })
  sessao?: Relation<SessaoAulaEntity>;

  @Column({ name: 'POSICAO', type: 'number' })
  posicao!: number;

  @Column({ name: 'NOME_ALUNO', type: 'varchar2', length: 80 })
  nome!: string;

  @Column({ name: 'NIVEL_ALCANCADO', type: 'number' })
  nivelAlcancado!: number;

  @Column({ name: 'ESTRELAS_SESSAO', type: 'number' })
  estrelasNaSessao!: number;

  @Column({ name: 'FASES_CONCLUIDAS', type: 'number' })
  fasesConcluidasNaSessao!: number;

  @Column({ name: 'TEMPO_TOTAL_SEGUNDOS', type: 'number' })
  tempoTotalSegundos!: number;

  @Column({ name: 'DATA_GERACAO', type: 'timestamp' })
  geradoEm!: Date;
}

/** Lista usada pelo DataSource (a "classe de contexto"). */
export const entidades = [
  ProfessorEntity,
  TurmaEntity,
  SessaoAulaEntity,
  AlunoEntity,
  ParticipacaoEntity,
  NivelEntity,
  FaseEntity,
  DesafioEntity,
  TentativaFaseEntity,
  RespostaDesafioEntity,
  ProgressoFaseEntity,
  RankingSessaoEntity,
];