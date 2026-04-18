# CI/CD — IAM

Workflows de GitHub Actions para el monorepo IAM.

## Workflows

| Archivo | Trigger | Propósito |
|---------|---------|-----------|
| `mobile-tests.yml` | Push/PR en `apps/mobile/**` | Corre `flutter test` (269 tests) + analyze |
| `backend-tests.yml` | Push/PR en `apps/backend/**` | Corre `npm test` (438 tests) en Node 20.x y 22.x |
| `mobile-build.yml` | Tags `v*` o dispatch manual | Compila APK Android + iOS (no-codesign) |

## Secrets requeridos (repo settings → Secrets and variables → Actions)

Para que `mobile-build.yml` pueda construir con credenciales reales:

- `SUPABASE_URL` — URL del proyecto Supabase
- `SUPABASE_ANON_KEY` — Anon key del proyecto
- `API_BASE_URL` — URL del backend NestJS (opcional si se usa Edge Functions)

## Branches monitoreadas

Los tests corren en push/PR a: `master`, `main`, `develop`.

## Releases manuales

```bash
# Desde Actions → Mobile Build → Run workflow
# Elegir environment: dev | staging | prod
```

O automático por tag:
```bash
git tag v0.6
git push origin v0.6
# → dispara build staging
```
