import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
      env: { NODE_ENV: 'test', JWT_SECRET: 'segredo-apenas-para-testes-com-32-caracteres!' },
    include: ['tests/**/*.test.ts'],
  },
});
