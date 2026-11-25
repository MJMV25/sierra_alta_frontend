import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Con cobertura, el primer render de una prueba puede tardar más que el segundo que findBy/waitFor esperan por defecto.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  // Los colores elegidos se recuerdan en el navegador; cada prueba arranca con los iniciales.
  localStorage.clear();
  // Borra las cookies creadas por cada prueba.
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});
