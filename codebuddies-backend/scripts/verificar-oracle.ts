/**
 * Verifica a integração com o Oracle rodando um FLUXO COMPLETO de aula no banco real:
 * professor → turma → aula → abrir → aluno entra → conteúdo (nível/fase/desafio) → abre a fase
 * → responde os desafios → encerra → ranking.
 *
 * Tudo acontece dentro de UMA transação que é DESFEITA no final (ROLLBACK):
 * nada fica gravado no banco. Pode rodar quantas vezes quiser.
 *
 * Uso: npm run db:verificar
 */
import { criarDataSource } from '../src/database/data-source.js';
import { AlunosService } from '../src/modules/alunos/alunos.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ConteudoService } from '../src/modules/conteudo/conteudo.service.js';
import { JogoService } from '../src/modules/jogo/jogo.service.js';
import { ProgressoService } from '../src/modules/progresso/progresso.service.js';
import { RankingService } from '../src/modules/ranking/ranking.service.js';
import { SessoesService } from '../src/modules/sessoes/sessoes.service.js';
import { TentativasService } from '../src/modules/tentativas/tentativas.service.js';
import { TurmasService } from '../src/modules/turmas/turmas.service.js';
import { criarRepositoriosOracle } from '../src/repositories/oracle/index.js';
import type { Contexto } from '../src/shared/contexto.js';
import { RelatoriosService } from '../src/modules/relatorios/relatorios.service.js';

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

    // Etapa 6 — cadastro de conteúdo (nível → fase → desafio)
    const conteudo = new ConteudoService(ctx);
    const nivel = await conteudo.criarNivel({ titulo: 'Nível de Verificação' });
    const fase = await conteudo.criarFase({
      nivelId: nivel.id,
      titulo: 'Fase de Verificação',
      tipo: 'LOGICA',
    });
    await conteudo.criarDesafio(fase.id, { enunciado: 'Quanto é 1 + 1?', respostaCorreta: '2' });
    await conteudo.criarDesafio(fase.id, { enunciado: 'Quanto é 2 + 2?', respostaCorreta: '4', pontos: 150 });
    const detalhe = await conteudo.buscarFase(fase.id);
    ok(`conteúdo criado: nível ${nivel.ordem}, fase "${fase.titulo}" com ${detalhe.desafios.length} desafios`);
    try {
      await conteudo.criarFase({ nivelId: nivel.id, ordem: fase.ordem, titulo: 'Repetida', tipo: 'LOGICA' });
      console.log('  ❌ duas fases na mesma posição do nível');
    } catch (erro) {
      ok(`fase na mesma posição barrada: ${(erro as { code?: string }).code}`);
    }

    const mapa = await new ProgressoService(ctx).mapaDoAluno(entrada.aluno.id);
    const primeira = mapa.fases[0];
    if (!primeira) {
      console.log('  ⚠️  não há fases cadastradas (tabelas NIVEL/FASE vazias) — pulando a jogada');
    } else {
      const desafios = await ctx.repos.conteudo.listarDesafios(primeira.faseId);
      if (desafios.length === 0) {
        console.log(`  ⚠️  "${primeira.titulo}" não tem desafios cadastrados — pulando a jogada`);
      } else {
        // Etapa 6 — o aluno abre a fase: recebe os desafios SEM a resposta correta
        const paraJogar = await new JogoService(ctx).abrirFase(entrada.aluno.id, primeira.faseId);
        const vazou = JSON.stringify(paraJogar).includes('respostaCorreta');
        ok(`aluno abriu "${primeira.titulo}": ${paraJogar.totalDesafios} desafios, resposta escondida: ${!vazou}`);

        // Etapa 7 — responde tudo certo (em minúsculas), menos o último desafio, que fica em branco
        const respostas = desafios.map((d, i) => ({
          desafioId: d.id,
          resposta: i < desafios.length - 1 ? d.respostaCorreta.toLowerCase() : '',
        }));
        const r = await new TentativasService(ctx).registrar(entrada.aluno.id, {
          faseId: primeira.faseId,
          tempoSegundos: 40,
          respostas,
        });
        ok(
          `respondeu "${primeira.titulo}": ${r.acertos}/${desafios.length} certas → ${r.percentual}% → ${r.estrelas} estrelas, ${r.pontos} pontos`,
        );

        const gravadas = await ctx.repos.respostas.listarPorTentativa(r.tentativa.id);
        ok(
          `RESPOSTA_DESAFIO gravou ${gravadas.length} linha(s), ${gravadas.filter((g) => g.acertou).length} certa(s)`,
        );

        const depois = await new ProgressoService(ctx).mapaDoAluno(entrada.aluno.id);
        ok(
          `trigger gravou o progresso: fase ${depois.fases[0]!.status}, ${depois.estrelasTotais} estrelas no total`,
        );
      }
    }

        // Etapa 9 — relatórios com agregação (QueryBuilder no Oracle)
    const relatorios = new RelatoriosService(ctx);
    const resumo = await relatorios.resumo(turma.id);
    ok(
      `relatório (COUNT/AVG/MAX/MIN/SUM): ${resumo.totalTentativas} tentativa(s), média ${resumo.mediaEstrelas ?? '—'} estrelas, ${resumo.pontosTotais} pontos`,
    );
    const porFase = await relatorios.desempenhoPorFase(turma.id);
    ok(`por fase (GROUP BY): ${porFase.filter((f) => f.totalTentativas > 0).length} de ${porFase.length} fases jogadas`);
    const boletim = await relatorios.boletim(turma.id);
    ok(`boletim (pivot): ${boletim.linhas.length} aluno(s) × ${boletim.fases.length} fase(s)`);
    const errados = await relatorios.desafiosMaisErrados(turma.id);
    ok(
      `desafios mais errados: ${errados.map((d) => `"${d.enunciado}" (${d.taxaErro}%)`).join(', ') || 'nenhum erro'}`,
    );
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