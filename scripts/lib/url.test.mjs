// Pruebas de normalizeUrl (node:test, sin red).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "./url.mjs";

test("quita las barras finales y pasa a minúsculas", () => {
  assert.equal(normalizeUrl("https://ABC.supabase.co///"), "https://abc.supabase.co");
});

test("una URL sin barras finales queda igual salvo minúsculas", () => {
  assert.equal(normalizeUrl("https://abc.supabase.co"), "https://abc.supabase.co");
});

test("un valor ausente se trata como cadena vacía", () => {
  assert.equal(normalizeUrl(undefined), "");
  assert.equal(normalizeUrl(), "");
});

test("dos URLs equivalentes comparan igual tras normalizar", () => {
  assert.equal(normalizeUrl("https://Proj.supabase.co/"), normalizeUrl("https://proj.supabase.co"));
});
