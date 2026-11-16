import { z } from 'zod';

/**
 * Etapa 10 — mensagens de validação do Zod em PORTUGUÊS.
 *
 * Os schemas do projeto já têm mensagens próprias ("Digite seu nome", "Ordem máxima: 99"...).
 * Esta configuração traduz as mensagens PADRÃO, as que aparecem quando um campo não tem
 * mensagem própria (ex.: mandar número onde era texto).
 *
 * Precisa ser importado ANTES de qualquer validação — por isso é o primeiro import do env.ts.
 */
z.config(z.locales.pt());