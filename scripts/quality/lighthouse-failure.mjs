// Clasifica los fallos de lhci: los de entorno (Chrome y Docker compitiendo por CPU en la
// misma máquina) no llegan a medir la página y se pueden repetir una vez; los de aserciones
// son regresiones reales y nunca se repiten.
const ENVIRONMENT_FAILURE = /NO_NAVSTART|PROTOCOL_TIMEOUT|Runtime error encountered/;

/**
 * true si la salida de lhci muestra un fallo de entorno (repetible).
 * @param {string} output salida combinada de lhci
 * @returns {boolean}
 */
export function isEnvironmentFailure(output) {
  return ENVIRONMENT_FAILURE.test(output);
}
