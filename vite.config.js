import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Destino del proxy de desarrollo: el backend Spring Boot.
  const backend = env.BACKEND_URL || 'http://localhost:8081';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: false },
        '/actuator': { target: backend, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      // Con cobertura y en CI las pruebas de interfaz tardan más que los 5 s por defecto.
      testTimeout: 15000,
      // npm run test:coverage → coverage/ (index.html, lcov.info, coverage-summary.json).
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'json-summary', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/test/**', 'src/main.jsx'],
      },
    },
  };
});
