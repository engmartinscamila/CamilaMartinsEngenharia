const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'supabase/functions/**'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    rules: {
      // Scripts de QA são CLIs e usam console.log para registrar o resultado dos testes.
      'no-console': 'off',
    },
  },
  {
    files: ['src/app/admin/document-preparation.tsx'],
    rules: {
      // Esta tela reinicializa controles dependentes de projeto/tipo e carrega aprovações
      // quando a seleção muda. O reset é intencional e não sincroniza estado externo.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
