# ADR 0015: Politica De Excepciones De Auditoria De Dependencias

## Estado

Aceptada.

## Contexto

`npm audit` reporta avisos de seguridad en dependencias directas y transitivas. Algunos avisos no tienen parche disponible o afectan a herramientas que solo corren en desarrollo. Si el gate falla siempre, el equipo desactiva el gate. Si el gate acepta cualquier excepcion sin fecha, las excepciones se vuelven permanentes.

El riesgo de produccion y el riesgo de herramientas de desarrollo no son iguales, y la politica debe tratarlos de forma distinta.

## Decision

Hay dos gates de auditoria:

```text
npm run verify:job -- static   # incluye audit-prod y audit-all
```

- `audit-prod` ejecuta `npm audit --omit=dev`. Produccion tiene cero excepciones. Cualquier aviso falla el gate.
- `audit-all` ejecuta `npm audit` completo. Solo acepta avisos cubiertos por una excepcion vigente.

Las excepciones viven en `security/audit-exceptions.json`, un array de objetos con estos campos obligatorios:

| Campo | Contenido |
|---|---|
| `advisory` | Identificador del aviso (id numerico, GHSA o URL) |
| `package` | Nombre del paquete afectado |
| `owner` | Persona responsable de resolverla |
| `reason` | Por que no se puede actualizar ahora |
| `mitigation` | Control compensatorio mientras dure la excepcion |
| `created` | Fecha `YYYY-MM-DD` |
| `expires` | Fecha `YYYY-MM-DD` |

Reglas:

1. Solo paquetes no productivos. Si el paquete esta en el arbol de produccion segun `package-lock.json`, la excepcion se rechaza.
2. Duracion maxima de 30 dias: `expires - created <= 30`.
3. Una excepcion expirada falla el gate.
4. Una excepcion obsoleta falla el gate. Si el aviso ya no aparece en `npm audit`, la excepcion se borra.
5. Ningun campo puede estar vacio.
6. Una excepcion no se amplia. Si el aviso sigue abierto al expirar, se resuelve la causa o se abre una excepcion nueva con su propia justificacion, y el cambio queda registrado en el historial del archivo.

## Consecuencias

Produccion no tiene camino de excepcion. Una vulnerabilidad en una dependencia de runtime bloquea el release hasta que se actualiza o se reemplaza el paquete.

Las excepciones de desarrollo tienen fecha de caducidad corta y responsable. La deuda de auditoria queda visible en cada ejecucion.

El gate `audit-all` puede fallar por avisos nuevos de herramientas de desarrollo sin relacion con el producto. Esa falla es intencional: obliga a decidir en un plazo de 30 dias.

El estado actual de `npm audit` no es cero. Hay avisos reportados por el gate que todavia no tienen excepcion ni actualizacion. Esos avisos se resuelven en la fase de dependencias, no se ocultan con esta politica.
