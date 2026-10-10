// Pruebas del runner de pgTAP (run-pgtap.mjs): lectura del project_id y argv de docker create.
import assert from "node:assert/strict";
import { it } from "node:test";
import { buildPgProveArgs, readProjectId } from "./run-pgtap.mjs";

it("readProjectId extrae el project_id del config de Supabase", () => {
  const config = '[api]\nport = 54321\n\nproject_id = "glowbook"\n';
  assert.equal(readProjectId(config), "glowbook");
});

it("readProjectId lanza si el config no tiene project_id", () => {
  assert.throws(() => readProjectId("[api]\nport = 54321\n"), /project_id/);
});

it("buildPgProveArgs usa la red del stack, el host de la BD y pg_prove sobre /tests", () => {
  const image = "public.ecr.aws/supabase/pg_prove:3.36";
  const args = buildPgProveArgs({ projectId: "glowbook", image });
  assert.equal(args[0], "create");
  const networkIndex = args.indexOf("--network");
  assert.equal(args[networkIndex + 1], "supabase_network_glowbook");
  assert.ok(args.includes("PGHOST=supabase_db_glowbook"));
  assert.ok(args.includes("PGPASSWORD=postgres"));
  assert.equal(args.includes("-v"), false, "no se usa montaje bind (se cuelga en Docker Desktop de esta máquina)");
  const tail = args.slice(args.indexOf(image) + 1);
  assert.deepEqual(tail, ["pg_prove", "--ext", ".pg", "--ext", ".sql", "-r", "/tests"]);
});
