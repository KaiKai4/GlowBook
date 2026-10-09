// Reglas de política para migraciones SQL forward-only (expand/contract).
//
// Función pura: no lee disco, no abre conexiones y no ejecuta squawk. La usa el lint
// de migraciones para las migraciones posteriores al corte. Ver docs/adr/0016-migraciones-forward-only-expand-contract.md.
//
// Reglas (sobre el SQL sin comentarios y sin contenido de literales):
// - "rename column" / "rename to": siempre prohibido.
// - "drop column", "drop table", "drop constraint", "alter column ... type", "set not null":
//   solo permitido en migraciones "contract", es decir, con "_contract_" en el nombre y
//   cabecera "-- contract-of: <id>" donde <id> es una migración existente.
// - "truncate": siempre prohibido.
// - "delete from" sin "where": prohibido.
// - "drop function": solo si el mismo archivo vuelve a crear la función.
// - "drop policy": solo si el mismo archivo vuelve a crear una política con el mismo nombre en la misma tabla.
// - "drop index": permitido (no altera datos ni contratos de lectura).

const CONTRACT_NAME_MARKER = "_contract_";
const CONTRACT_HEADER = /^--\s*contract-of:\s*(\S+)\s*$/im;
// Identificadores: nombre entre comillas dobles o sin comillas; tabla opcionalmente con esquema.
const DROP_POLICY = /\bdrop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+("[^"]+"|[\w."]+)/i;
const CREATE_POLICY = /\bcreate\s+policy\s+("[^"]+"|\w+)\s+on\s+("[^"]+"|[\w."]+)/gi;

/**
 * @typedef {{ rule: string, message: string }} Violation
 * @typedef {{ ok: boolean, violations: Violation[] }} MigrationAnalysis
 */

/**
 * Elimina comentarios SQL de línea (--) y de bloque, respetando literales entre comillas simples.
 * Los literales se conservan íntegros.
 * @param {string} sql
 * @returns {string}
 */
function stripSqlComments(sql) {
  let out = "";
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    if (char === "'") {
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === "'") {
          if (sql[end + 1] === "'") {
            end += 2;
            continue;
          }
          break;
        }
        end += 1;
      }
      out += sql.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (char === "-" && next === "-") {
      const newline = sql.indexOf("\n", index);
      index = newline === -1 ? sql.length : newline;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = sql.indexOf("*" + "/", index + 2);
      out += " ";
      index = close === -1 ? sql.length : close + 2;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * Sustituye el contenido de los literales entre comillas simples por nada, para que
 * palabras clave dentro de cadenas no provoquen falsos positivos.
 * @param {string} sql
 * @returns {string}
 */
function maskLiterals(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Resuelve si la migración puede usar operaciones de contract.
 * @param {string} fileName
 * @param {string} sql SQL original (la cabecera vive en un comentario)
 * @param {ReadonlyArray<string | number>} existingMigrationIds
 * @returns {{ valid: boolean, reason: string }}
 */
function resolveContract(fileName, sql, existingMigrationIds) {
  const baseName = fileName.split(/[\\/]/).pop() ?? fileName;
  if (!baseName.includes(CONTRACT_NAME_MARKER)) {
    return { valid: false, reason: `el nombre no contiene "${CONTRACT_NAME_MARKER}"` };
  }
  const header = CONTRACT_HEADER.exec(sql);
  if (!header) {
    return { valid: false, reason: 'falta la cabecera "-- contract-of: <id>"' };
  }
  const targetId = header[1];
  const known = existingMigrationIds.map(String).includes(targetId);
  if (!known) {
    return { valid: false, reason: `contract-of ${targetId} no es una migración existente` };
  }
  return { valid: true, reason: "" };
}

const CREATE_FUNCTION = /\bcreate\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi;

/**
 * Extrae el nombre (sin esquema ni comillas) de la función eliminada por una sentencia DROP FUNCTION.
 * @param {string} statement
 * @returns {string | null}
 */
function droppedFunctionName(statement) {
  const match = /\bdrop\s+function\s+(?:if\s+exists\s+)?([\w."]+)/i.exec(statement);
  if (!match) return null;
  return (match[1].split(".").pop() ?? "").replace(/"/g, "");
}

/**
 * Comprueba si el código vuelve a crear una función con ese nombre.
 * @param {string} code
 * @param {string} name
 * @returns {boolean}
 */
function recreatesFunction(code, name) {
  const target = name.toLowerCase();
  for (const match of code.matchAll(CREATE_FUNCTION)) {
    const created = (match[1] ?? "").split(".").pop() ?? "";
    if (created.replace(/"/g, "").toLowerCase() === target) return true;
  }
  return false;
}

/**
 * Clave canónica de una política: tabla con esquema (public por defecto) y nombre, sin comillas.
 * @param {string} name
 * @param {string} table
 * @returns {string}
 */
function policyKey(name, table) {
  const unquotedTable = table.replace(/"/g, "").toLowerCase();
  const qualifiedTable = unquotedTable.includes(".") ? unquotedTable : `public.${unquotedTable}`;
  return `${qualifiedTable}|${name.replace(/"/g, "").toLowerCase()}`;
}

/**
 * Conjunto de claves de las políticas que el código crea (CREATE POLICY).
 * @param {string} code
 * @returns {Set<string>}
 */
function createdPolicyKeys(code) {
  const keys = new Set();
  for (const match of code.matchAll(CREATE_POLICY)) {
    keys.add(policyKey(match[1], match[2]));
  }
  return keys;
}

const CREATE_INDEX = /\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?[\w."]+\s+on\s+(?:only\s+)?([\w."]+)/i;
const CREATE_TABLE = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi;

/**
 * Clave normalizada de una tabla: sin comillas, en minúsculas y con esquema public por defecto.
 * @param {string} name
 * @returns {string}
 */
function tableKey(name) {
  const clean = name.replace(/"/g, "").toLowerCase();
  return clean.includes(".") ? clean : `public.${clean}`;
}

/**
 * Analiza una migración y devuelve las violaciones de la política forward-only.
 * @param {string} fileName nombre del archivo (puede incluir ruta)
 * @param {string} sql contenido completo del archivo
 * @param {ReadonlyArray<string | number>} existingMigrationIds ids de migraciones existentes
 * @returns {MigrationAnalysis}
 */
export function analyzeMigration(fileName, sql, existingMigrationIds) {
  const code = maskLiterals(stripSqlComments(sql));
  const statements = code
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  const contract = resolveContract(fileName, sql, existingMigrationIds);
  const recreatedPolicies = createdPolicyKeys(code);
  const createdTables = new Set(Array.from(code.matchAll(CREATE_TABLE), (match) => tableKey(match[1] ?? "")));
  const hasLockTimeout = /\bset\s+(?:local\s+)?lock_timeout\b/i.test(code);

  /** @type {Violation[]} */
  const violations = [];
  /**
   * @param {string} rule
   * @param {string} message
   */
  const addViolation = (rule, message) => {
    violations.push({ rule, message });
  };

  // Las reglas de squawk se gestionan solo en .squawk.toml (sin excepciones en línea).
  if (/squawk-ignore/i.test(sql)) {
    addViolation("squawk-ignore", "Los comentarios squawk-ignore estan prohibidos: ajusta .squawk.toml con un ADR o corrige la migracion.");
  }

  for (const statement of statements) {
    if (/\brename\s+(?:column|to)\b/i.test(statement)) {
      addViolation("rename", `RENAME esta prohibido (forward-only): "${statement.slice(0, 80)}"`);
    }

    const contractOnly = [
      { rule: "drop-column", test: /\bdrop\s+column\b/i, label: "DROP COLUMN" },
      { rule: "drop-table", test: /\bdrop\s+table\b/i, label: "DROP TABLE" },
      { rule: "drop-constraint", test: /\bdrop\s+constraint\b/i, label: "DROP CONSTRAINT" },
      { rule: "alter-type", test: /\balter\s+column\b[\s\S]*?\btype\b/i, label: "ALTER COLUMN ... TYPE" },
      { rule: "set-not-null", test: /\bset\s+not\s+null\b/i, label: "SET NOT NULL" },
    ];
    for (const operation of contractOnly) {
      if (operation.test.test(statement) && !contract.valid) {
        addViolation(operation.rule, `${operation.label} solo se permite en una migracion contract: ${contract.reason}`);
      }
    }

    if (/\btruncate\b/i.test(statement)) {
      addViolation("truncate", "TRUNCATE esta prohibido.");
    }

    if (/\bdelete\s+from\b/i.test(statement) && !/\bwhere\b/i.test(statement)) {
      addViolation("delete-without-where", "DELETE FROM sin WHERE esta prohibido.");
    }

    if (/\bdrop\s+function\b/i.test(statement)) {
      const name = droppedFunctionName(statement);
      if (name === null || !recreatesFunction(code, name)) {
        addViolation("drop-function", `DROP FUNCTION solo se permite si la misma migracion recrea la funcion (${name ?? "nombre no reconocido"}).`);
      }
    }

    if (/\bdrop\s+policy\b/i.test(statement)) {
      const dropped = DROP_POLICY.exec(statement);
      if (!dropped || !recreatedPolicies.has(policyKey(dropped[1], dropped[2]))) {
        const label = dropped ? `${dropped[1]} en ${dropped[2]}` : "nombre no reconocido";
        addViolation("drop-policy", `DROP POLICY solo se permite si la misma migracion recrea la politica con el mismo nombre (${label}).`);
      }
    }

    // Supabase aplica cada migracion en una transaccion, asi que CREATE INDEX
    // CONCURRENTLY no es posible: el bloqueo se acota con lock_timeout.
    const indexed = CREATE_INDEX.exec(statement);
    if (indexed && !createdTables.has(tableKey(indexed[1])) && !hasLockTimeout) {
      addViolation("index-lock-timeout", `CREATE INDEX sobre la tabla existente ${indexed[1]} exige "set lock_timeout" en la misma migracion.`);
    }
  }

  return { ok: violations.length === 0, violations };
}
