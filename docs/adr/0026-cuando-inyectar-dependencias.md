# ADR 0026: Cuándo inyectar dependencias (DIP pragmático)

- **Estado**: Aceptada.
- **Fecha**: 2026-10-10

## Contexto

Los casos de uso de GlowBook necesitan probarse sin base de datos ni red. Hasta ahora conviven dos estilos sin una regla escrita:

- Mocks de módulo con `vi.mock` sobre los repositorios o las RPC, que son válidos pero acoplan el test a la ruta de importación y no obligan a tipar el comportamiento simulado.
- Inyección por parámetro, que obliga a tipar las dependencias y deja explícito qué colabora con el caso de uso.

Sin una regla, cada módulo elige a su criterio y las revisiones discuten lo mismo una y otra vez. Aplicar inyección a todo sería ceremonia sin beneficio en casos de uso que solo leen o consultan. Aplicar `vi.mock` a todo dejaría sin control la lógica de transición de estado de las citas, que es donde un fallo cuesta más.

## Decisión

1. **El contexto de la petición siempre llega por parámetro.** `ActionContext` (`src/features/access/domain/request-context.ts`) lo construye `defineAction` (`src/app/_composition/define-action.ts`) y los casos de uso lo reciben como argumento. Nunca lo leen de la sesión ni de un módulo global.
2. **Comandos con transición de estado: dependencias inyectadas.** Los comandos que cambian el estado de una cita (`cancelAppointment`, `confirmAppointment`, `completeAppointment` en `src/features/appointments/use-cases/`) reciben sus repositorios, RPC y servicios externos como `deps` tipadas. El parámetro tiene un valor por defecto con las funciones reales de producción (`defaultCancelAppointmentDeps`, etc.). Sus tests inyectan fakes tipados con la misma interfaz, sin `vi.mock` de esos colaboradores.
3. **El resto de casos de uso importa sus repositorios directamente.** Los tests de estos casos de uso usan `vi.mock` sobre `data/` o sobre la infraestructura (por ejemplo `@/infra/observability`, como en `cancel-appointment.test.ts`). No se añade un parámetro `deps` solo para poder mockear.
4. **Prohibido: contenedores de inyección y service locators.** No se usan contenedores de DI, registros globales de dependencias ni localizadores de servicios. La inyección es un parámetro opcional con valor por defecto, y nada más.

Cambiar una de estas reglas exige un ADR nuevo que la sustituya.

## Consecuencias

- Los comandos de transición se prueban con fakes tipados: si cambia la firma de un repositorio, TypeScript marca el fake y el test falla en compilación, no en ejecución.
- Los tests de comandos no dependen de la ruta de importación de `data/`, así que mover un repositorio no rompe los `vi.mock` de esos tests.
- Los casos de uso sin `deps` siguen siendo más simples de leer. El coste es que sus tests dependen de `vi.mock`, que debe mantenerse con cuidado al mover archivos.
- Añadir una dependencia nueva a un comando de transición obliga a actualizar su interfaz `Deps` y su fake. Es un coste deliberado.
- Cualquier revisión que proponga un contenedor de DI o un localizador de servicios debe rechazarse por esta ADR. Un parámetro `deps` con valor por defecto sí es válido solo en los comandos del punto 2.
