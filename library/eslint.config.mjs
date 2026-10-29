import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'drizzle/**'] },
  ...next,
];

export default config;
