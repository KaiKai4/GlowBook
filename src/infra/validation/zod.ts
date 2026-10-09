import { z, ZodError } from "zod";

// Adaptador unico de Zod para todo src/. Es el unico archivo autorizado a
// importar "zod" (regla no-restricted-imports en eslint.config.mjs).
//
// jitless: Zod 4 compila schemas con new Function (eval). Sin JIT no hay
// evaluacion dinamica de codigo en runtime, en linea con la politica CSP
// (script-src sin 'unsafe-eval' en produccion). La validacion es igual de
// correcta; solo cambia la velocidad de parseo, que aqui es irrelevante.
z.config({ jitless: true });

export { z, ZodError };
