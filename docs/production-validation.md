# Validacion de produccion

Este flujo valida el despliegue de Railway correspondiente al commit que activo
GitHub Actions. No crea contenedores ni integra Hermes.

## Configuracion

1. En GitHub, abre **Settings > Secrets and variables > Actions**.
2. Crea el repository secret `PRODUCTION_URL` con la URL publica de Railway,
   por ejemplo `https://example.up.railway.app`, sin rutas adicionales.
3. Confirma que Railway proporciona `RAILWAY_GIT_COMMIT_SHA` durante el build.
   El Dockerfile declara esta variable y el plugin de Vite usa su valor para
   escribir `dist/version.json`.

No se debe guardar `PRODUCTION_URL` ni ninguna credencial en el repositorio.
`EXPECTED_COMMIT_SHA` lo define el workflow automáticamente con
`${{ github.sha }}`.

## Ejecucion

El workflow `.github/workflows/validate-production.yml` se ejecuta con cada
push a `main`. Para iniciarlo manualmente:

1. Abre **Actions > Validate production** en GitHub.
2. Selecciona **Run workflow** y la rama cuyo commit esta desplegando Railway.
3. Abre la ejecucion para seguir los pasos en tiempo real.

El paso **Wait for Railway deployment** consulta `/version.json` hasta que su
campo `commit` coincide exactamente con `github.sha`. El timeout predeterminado
es de 10 minutos. Para una ejecucion local se pueden usar:

```bash
PRODUCTION_URL=https://example.up.railway.app \
EXPECTED_COMMIT_SHA=$(git rev-parse HEAD) \
npm run wait:production

PRODUCTION_URL=https://example.up.railway.app \
EXPECTED_COMMIT_SHA=$(git rev-parse HEAD) \
npm run test:e2e:production
```

Los ajustes opcionales `PRODUCTION_WAIT_TIMEOUT_MS` y
`PRODUCTION_POLL_INTERVAL_MS` controlan el timeout y el intervalo de consulta.

## Diagnostico

Si la validacion falla, revisa primero el log del paso que quedo en rojo:

- **Wait for Railway deployment** muestra el ultimo estado HTTP o commit visto.
- **Run production smoke test** muestra la asercion fallida y los errores de
  consola capturados.
- **Upload Playwright artifacts** se ejecuta siempre, incluso tras un fallo.

La seccion **Artifacts** de la ejecucion contiene un archivo
`production-validation-<run-id>` durante 14 dias. Al descargarlo:

- `playwright-report/` contiene el reporte HTML; abre `index.html` localmente.
- `test-results/` contiene screenshots y traces retenidos para fallos.
- Para abrir un trace, ejecuta `npx playwright show-trace <archivo-trace.zip>`.

Si la espera agota el timeout, comprueba el estado del deploy en Railway y el
contenido publico de `/version.json`. La API mutable de gameplay se sirve solo
desde el harness local de Playwright y no forma parte del artefacto productivo.
