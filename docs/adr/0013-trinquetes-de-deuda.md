# ADR 0013: Trinquetes De Deuda Tecnica

## Estado

Aceptada.

## Contexto

GlowBook tiene deuda visible que no se puede eliminar de golpe: tokens de diseno con colores y tipografias literales, modulos grandes, violaciones de grafo de dependencias heredadas y cobertura que todavia no llega al objetivo.

Si el gate exige cero desde el primer dia, el verificador queda en rojo y se desactiva. Si el gate acepta la deuda sin limite, la deuda crece. Ninguna de las dos opciones protege el proyecto.

## Decision

Usamos trinquetes: cada medicion se compara contra una linea base versionada, y la linea base solo puede bajar.

Trinquetes activos:

| Trinquete | Archivo de linea base | Gate |
|---|---|---|
| Tokens de diseno (colores, tipografias y tamanos literales) | `quality/baselines/design-tokens.json` | `check-design-tokens.mjs` |
| Tamano de modulos (lineas por archivo) | `quality/baselines/module-size.json` | `check-module-size.mjs` |
| Violaciones conocidas de dependency-cruiser | `.dependency-cruiser-known-violations.json` | paso `architecture` con `--ignore-known` |
| Cobertura global | `quality/coverage-baseline.json` | `check-coverage.mjs` |

Estado de las lineas base: los archivos de linea base se generan al cierre de la fase 1, con el paso de calidad correspondiente. Hasta que existan, los gates de tokens, tamano de modulos, violaciones conocidas y cobertura fallan de forma explicita. No se crean lineas base vacias ni se desactivan gates para cerrar la fase.

Reglas de los trinquetes:

- Solo pueden bajar. Un valor nuevo mayor que la linea base falla el gate.
- Se regeneran solo mediante el paso de calidad correspondiente, nunca a mano para esconder un hallazgo.
- La meta es cero en todos los trinquetes. Cada trinquete tiene una fase prevista para llegar a cero, indicada en el plan de calidad vigente.
- La unica excepcion permanente es el archivo de tipos generados `src/types/database.types.ts`. Esta declarado en `quality/module-size-exceptions.json` porque lo genera Supabase y no se edita a mano.
- Umbrales de cobertura: globales 80% lineas y funciones, 70% ramas. Rutas criticas 90% lineas y funciones, 80% ramas. Las rutas criticas son `src/infra/auth/**`, `src/infra/security/**`, `src/features/access/**`, `src/features/platform/**` y `src/proxy*.ts`.
- Ademas del trinquete global, el cambio se mide por lineas tocadas frente a `main` (`check-coverage.mjs`), para que el codigo nuevo no herede la media.
- Ningun umbral se baja para pasar un gate. Si un umbral es imposible de cumplir, se documenta el hallazgo en el ADR o en el plan, no se reduce el valor.

## Consecuencias

La deuda existente queda congelada y visible. El codigo nuevo debe cumplir la regla completa desde el primer commit.

Reducir deuda tiene un efecto automatico: al bajar la linea base, el valor anterior ya no se puede volver a subir.

Un gate que falla por un trinquete no se resuelve subiendo el valor en la linea base. Si la subida fuera necesaria, debe justificarse en un ADR nuevo que reemplace este.

Las violaciones conocidas de dependency-cruiser son deuda real. Se eliminan al refactorizar el modulo afectado, y el archivo de violaciones se regenera sin ellas.
