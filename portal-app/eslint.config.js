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
]);
