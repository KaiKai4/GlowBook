# ADR 0013: Trinquetes De Deuda Tecnica

## Estado

Aceptada, con partes superadas por ADR 0019. Los trinquetes de tokens de diseño, tamaño de módulos y violaciones de grafo se retiran: son controles absolutos sin baseline. Sigue vigente el trinquete de cobertura.

## Contexto

GlowBook tiene deuda visible que no se puede eliminar de golpe: tokens de diseno con colores y tipografias literales, modulos grandes, violaciones de grafo de dependencias heredadas y cobertura que todavia no llega al objetivo.

Si el gate exige cero desde el primer dia, el verificador queda en rojo y se desactiva. Si el gate acepta la deuda sin limite, la deuda crece. Ninguna de las dos opciones protege el proyecto.

## Decision

Usamos trinquetes: cada medicion se compara contra una linea base versionada, y la linea base solo puede bajar.

Trinquetes activos:

| Trinquete | Archivo de linea base | Gate |
|---|---|---|
| Cobertura global | `quality/coverage-baseline.json` | `check-coverage.mjs` |

Retirados por ADR 0019 (controles absolutos, sin linea base):

| Control | Antes | Ahora |
|---|---|---|
| Tokens de diseno (colores, tipografias y tamanos literales) | baseline de tokens (eliminada) | `check-design-tokens.mjs` falla con cualquier token crudo |
| Tamano de modulos (lineas por archivo) | baseline de tamano (eliminada) | `check-module-size.mjs` falla por encima de 300 lineas, salvo la excepcion permanente |
| Violaciones conocidas de dependency-cruiser | lista de violaciones conocidas (eliminada) | paso `architecture` sin `--ignore-known`; cero violaciones |

Los controles absolutos no tienen archivo de linea base ni opcion para crearlo.

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

Las violaciones conocidas de dependency-cruiser ya no existen: se eliminaron al refactorizar, y el archivo de violaciones se retiro (ADR 0019).
