# Sistema web de pronóstico de producción — Frontend

[![Tests](https://github.com/MJMV25/sierra_alta_frontend/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/MJMV25/sierra_alta_frontend/actions/workflows/tests.yml)
[![Cobertura](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/MJMV25/sierra_alta_frontend/badges/coverage.json)](https://github.com/MJMV25/sierra_alta_frontend/actions/workflows/tests.yml)

Sierra Alta S.A.S. BIC · marca Eleven Pro. SPA en React + Vite que consume la API REST del backend
Spring Boot (`sierra_alta_backend`).

Estado actual: inicio de sesión, navegación por permisos, administración de usuarios y, como pantalla de
inicio, la hoja de datos de la empresa con el pronóstico en vivo (tema oscuro, según el mockup de Industrial):
se corrigen o agregan meses y se cambian los parámetros, y todo se recalcula en la misma pantalla.

## Requisitos

- Node.js LTS (probado con 22) y npm.
- Backend corriendo en `http://localhost:8081` (ver su README):

  ```powershell
  cd C:\Users\manue\sierra_alta_backend
  .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
  ```

## Comandos

```bash
npm install      # instala dependencias
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # compilación de producción en dist/
npm test         # pruebas (Vitest + React Testing Library)
npm run test:coverage  # pruebas con reporte de cobertura en coverage/index.html
```

Integración continua: `.github/workflows/tests.yml` corre en cada push (cualquier rama) y en cada pull
request. Instala con `npm ci`, ejecuta las pruebas con cobertura, compila y publica el reporte como
artefacto `cobertura-frontend`, con un resumen de líneas, ramas, sentencias y funciones en la página de la
ejecución. Exige un mínimo de 80 % de líneas cubiertas (`coverage.thresholds` en `vite.config.js`): por
debajo, `npm run test:coverage` y el pipeline fallan.

## Configuración

Copie `.env.example` como `.env` si necesita cambiar algo:

| Variable       | Uso |
|----------------|-----|
| `VITE_API_URL` | URL base de la API. **Vacía en desarrollo**: el proxy de Vite envía `/api` y `/actuator` al backend, así navegador y API comparten origen y las cookies funcionan sin CORS. |
| `BACKEND_URL`  | (Opcional) destino del proxy de desarrollo. Por defecto `http://localhost:8081`. Útil si el backend corre en otro puerto. |

## Cuentas de demostración

Con el perfil `dev` el backend crea estas cuentas. Las contraseñas **no** están en este repositorio:
salen del `.env` del backend (`BOOTSTRAP_ADMIN_PASSWORD` para `admin`, `DEMO_USERS_PASSWORD` para las demás).

| Usuario      | Rol                         | Ve en el menú |
|--------------|-----------------------------|---------------|
| `admin`      | Administrador del sistema   | Todo: edita la hoja (y la importa de Excel), guarda pronósticos, exporta y administra usuarios |
| `planeador`  | Planeador de producción     | Hoja de datos (consulta y recalcula), Pronósticos guardados e Indicadores; exporta (Excel, PDF, CSV, PNG/SVG) |
| `analista`   | Analista de datos           | Hoja de datos (consulta y recalcula), guarda pronósticos, Pronósticos guardados e Indicadores |

## Seguridad en el cliente

- El backend es la autoridad. Los permisos (`permissions` de `/api/v1/auth/me`) solo deciden qué se muestra;
  toda la interfaz se basa en permisos, nunca en el nombre del rol.
- Sesión por cookie `JSESSIONID` HttpOnly; no se guardan tokens en `localStorage`.
  Todas las solicitudes van con `withCredentials: true`.
- CSRF por doble envío: al iniciar se llama `GET /api/v1/auth/csrf`; cada POST/PUT/PATCH/DELETE lleva
  `X-XSRF-TOKEN` con el valor **actual** de la cookie `XSRF-TOKEN` (se lee en cada solicitud porque el
  login la renueva y el logout la borra). Si falta la cookie se pide antes de enviar; ante un 403 con
  `code: "csrf-invalid"` se renueva y se reintenta una sola vez. Si vuelve a fallar se muestra su `detail`
  (no se trata como falta de permisos).
- Versión de la API: el prefijo `/api/v1` se define solo en `API_PREFIX` (`src/api/http.js`) y se suma a
  `VITE_API_URL`; las rutas de `auth.js`, `admin.js` y `modules.js` son relativas a él.
- Cualquier 401 fuera del login lleva a `/login` con "Su sesión terminó. Inicie sesión de nuevo."
  Un 403 `access-denied` refresca la sesión (el rol pudo cambiar) y lleva a `/sin-permiso`.
- Los errores se muestran con el `detail` del problem+json del backend; los de validación, junto a
  cada campo (`aria-describedby`).

## Pantallas de pronóstico

- **Hoja de datos** (`/`, pantalla de inicio; ADR 13 del backend):
  - Pestaña "Datos de Sierra Alta": la hoja como la hoja DATOS del Excel (un bloque por año, referencias en
    filas, meses en columnas y total). Con `history:write` (solo administrador) las celdas se editan como en
    Excel: flechas o Enter para moverse, Escape deshace la celda y se puede pegar un rango copiado del Excel.
    Los cambios quedan resaltados (nuevo, corregido, borrado o con error) hasta "Guardar cambios" o
    "Descartar cambios"; borrar meses pide confirmación. "Exportar Excel" descarga la hoja con el formato de
    DATOS e "Importar Excel" la lee de vuelta (de la aplicación o del Excel de Industrial) y deja los cambios
    resaltados para revisarlos antes de guardar. Debajo, el historial de cambios de la referencia.
  - Pestaña "Datos de ejemplo": Spokane y ACME con los parámetros del Excel ya puestos; se pueden cambiar
    valores para probar (nada se guarda) y "Volver a los datos del Excel".
  - Pronóstico de la referencia elegida, recalculado en vivo (`POST /forecasts/preview`, 350 ms después de
    la última tecla) con los datos sin guardar: celdas de parámetros como en el Excel (n, K0…Kn con su suma, α,
    β, L y el periodo histórico; si los K no suman 1 no se calcula), tarjetas del mejor método por MAD y por
    MAPE (una sola si coinciden; el estacional no compite), pronóstico del periodo siguiente y último dato,
    gráfico personalizable, comparación completa y tabla de resultados y trazabilidad (D(t), P(t), E(t), |E(t)|
    y |E(t)|/D(t)). Con `forecast:execute` (administrador y analista), "Guardar pronóstico" deja la ejecución
    con su trazabilidad.
- **Pronósticos guardados** (`/pronosticos`): las ejecuciones recientes.
- **Resultado** (`/pronosticos/:id`), el dashboard de la ejecución:
  - Ficha: periodo histórico usado, fecha, quién ejecutó, versión de datos y de cálculo.
  - Comparación: tabla (parámetros, pronóstico siguiente, MAD, MAPE y el menor de cada uno) que se ordena por
    método, menor MAD o menor MAPE; debajo, barras de MAD y de MAPE en gráficos separados (no comparten eje).
  - Gráfico personalizable: mostrar u ocultar series, tipo líneas, columnas o combinado (real en columnas y
    métodos en línea), valores sobre los puntos, eje Y desde 0 o ajustado (las columnas siempre desde 0),
    rango de meses visible y "Restablecer vista".
  - Tabla de datos con los meses evaluados y el mes pronosticado resaltados.
  - Con `forecast:export` (administrador y planeador): Excel (hojas Resumen, con el gráfico, y Datos), PDF
    (impresión del navegador; el gráfico sale completo como imagen y sin menú ni controles), tabla en CSV
    (";" y coma decimal) y gráfico en PNG o SVG. El contenido sigue la respuesta 23 de Industrial; ExcelJS
    se descarga solo al exportar.
- **Indicadores** (`/indicadores?ejecucion=7`): la misma tabla comparativa para cualquier ejecución.
- Gráfico: cada mes ocupa al menos 34 px; con más meses de los que caben, la zona del gráfico se desplaza
  hacia los lados (el eje Y queda fijo) y abre en los meses más recientes. Etiquetas del eje X sin
  superponerse, con el año en enero.
- Responsive: en pantallas de hasta 640 px las tablas de comparación, ejecuciones y referencias se muestran
  como tarjetas; la tabla de datos mes a mes conserva el encabezado y la columna del mes fijos al desplazarse.
- El frontend no recalcula nada: pronósticos, errores, MAD, MAPE y mejores vienen del backend. Cada método tiene un color
  fijo (paleta categórica validada para daltonismo) y la tabla de datos acompaña siempre al gráfico.

## Estructura

```
src/
  api/          http.js (Axios: credenciales, CSRF, interceptores 401/403), auth.js, admin.js, modules.js
  auth/         AuthProvider, RequireAuth, RequirePermission
  export/       chartImage (gráfico a SVG/PNG), report (contenido común y CSV), excel (ExcelJS), sheetExcel (hoja DATOS de ida y vuelta)
  components/   Layout, Topbar, Sidebar, FormField, ConfirmDialog, ProblemAlert, Notice, QueryState, LineChart, ...
  pages/        LoginPage, IndicatorsPage, ForbiddenPage, NotFoundPage, useModuleQuery, seriesOptions
  pages/workspace/ WorkspacePage (inicio), DataSheet, sheetModel, ParameterBar, KpiCards, ResultsTable, ChangeHistory, useLivePreview
  pages/forecast/ ForecastPage, ForecastDetailPage, ForecastChart, MethodComparison, ComparisonTable, IndicatorBars, ExecutionsTable, methodConfig
  pages/admin/  UsersPage, UsersTable, CreateUserForm, SecurityEventsTable
  navigation.js secciones del menú y su permiso
  format.js     números, porcentajes y meses en es-CO; nombres de métodos
  routes.jsx, main.jsx, styles.css
  test/         pruebas y utilidades (simulan la API sustituyendo el adaptador de Axios)
```
