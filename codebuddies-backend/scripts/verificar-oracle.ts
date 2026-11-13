/**
 * Verifica a integração com o Oracle rodando um FLUXO COMPLETO de aula no banco real:
 * professor → turma → aula → abrir → aluno entra → joga uma fase → encerra → ranking.
 *
 * Tudo acontece dentro de UMA transação que é DESFEITA no final (ROLLBACK):
 * nada fica gravado no banco. Pode rodar quantas vezes quiser.
 *
 * Uso: npm run db:verificar
 */
import { criarDataSource } from '../src/database/data-source.js';
import { AlunosService } from '../src/modules/alunos/alunos.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ProgressoService } from '../src/modules/progresso/progresso.service.js';
import { RankingService } from '../src/modules/ranking/ranking.service.js';
import { SessoesService } from '../src/modules/sessoes/sessoes.service.js';
import { TentativasService } from '../src/modules/tentativas/tentativas.service.js';
import { TurmasService } from '../src/modules/turmas/turmas.service.js';
import { criarRepositoriosOracle } from '../src/repositories/oracle/index.js';
import type { Contexto } from '../src/shared/contexto.js';

class Desfazer extends Error {}

const ok = (texto: string) => console.log(`  ✅ ${texto}`);
const ds = criarDataSource();

try {
  await ds.initialize();
  console.log('Conectado. Rodando o fluxo dentro de uma transação que será desfeita...\n');

  await ds.transaction(async (manager) => {
    const ctx: Contexto = { repos: criarRepositoriosOracle(manager), agora: () => new Date() };

    const professor = await new AuthService(ctx).cadastrarProfessor({
      nome: 'Verificação',
      email: `verificacao.${Date.now()}@codebuddies.com`,
      senha: 'senha-de-teste',
    });
    ok(`professor criado (id ${professor.id})`);

    const turma = await new TurmasService(ctx).criar({ nome: 'Turma de Verificação' });
    ok(`turma criada (id ${turma.id})`);

    const sessoes = new SessoesService(ctx);
    const sessao = await sessoes.criar(turma.id, professor.id);
    ok(`aula criada com status ${sessao.status}`);

    await sessoes.abrir(sessao.id);
    ok('aula aberta pela procedure PRC_ABRIR_SESSAO');

    const outra = await sessoes.criar(turma.id, professor.id);
    try {
      await sessoes.abrir(outra.id);
      console.log('  ❌ uma segunda aula abriu ao mesmo tempo (RN01 falhou)');
    } catch (erro) {
      ok(`segunda aula barrada: ${(erro as { code?: string }).code}`);
    }

    const alunos = new AlunosService(ctx);
    const entrada = await alunos.entrar({ nome: 'João Teste', idade: 6 });
    const volta = await alunos.entrar({ nome: '  joao teste ', idade: 6 });
    ok(
      `aluno entrou (id ${entrada.aluno.id}) e foi reconhecido de novo: ${volta.aluno.id === entrada.aluno.id}`,
    );

    const mapa = await new ProgressoService(ctx).mapaDoAluno(entrada.aluno.id);
    const primeira = mapa.fases[0];
    if (!primeira) {
      console.log('  ⚠️  não há fases cadastradas (tabelas NIVEL/FASE vazias) — pulando a jogada');
    } else {
      const r = await new TentativasService(ctx).registrar(entrada.aluno.id, {
        faseId: primeira.faseId,
        acertos: 8,
        erros: 2,
        tempoSegundos: 40,
      });
      ok(`jogou "${primeira.titulo}": ${r.percentual}% → ${r.estrelas} estrelas, ${r.pontos} pontos`);

      const depois = await new ProgressoService(ctx).mapaDoAluno(entrada.aluno.id);
      ok(
        `trigger gravou o progresso: fase ${depois.fases[0]!.status}, ${depois.estrelasTotais} estrelas no total`,
      );
    }

    const { ranking } = await sessoes.encerrar(sessao.id);
    ok(`aula encerrada pela PRC_ENCERRAR_SESSAO; ranking com ${ranking.itens.length} aluno(s)`);

    const salvo = await new RankingService(ctx).obter(sessao.id);
    ok(`ranking congelado lido da tabela RANKING_SESSAO: 1º lugar = ${salvo.itens[0]?.nome ?? '—'}`);

    throw new Desfazer(); // força o ROLLBACK
  });
} catch (erro) {
  if (erro instanceof Desfazer) {
    console.log('\n🎉 Integração com o Oracle funcionando! (tudo foi desfeito, nada ficou gravado)');
  } else {
    console.error('\n❌ Falhou:', (erro as Error).message);
    console.error('   Mande esta saída para o Gustavo/Claude. Nada foi gravado no banco.');
    process.exitCode = 1;
  }
} finally {
  if (ds.isInitialized) await ds.destroy();
}