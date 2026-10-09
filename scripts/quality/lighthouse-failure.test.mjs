import { test } from "node:test";
import assert from "node:assert/strict";
import { isEnvironmentFailure } from "./lighthouse-failure.mjs";

test("NO_NAVSTART, PROTOCOL_TIMEOUT y Runtime error son fallos de entorno", () => {
  assert.equal(isEnvironmentFailure("Runtime error encountered: NO_NAVSTART"), true);
  assert.equal(isEnvironmentFailure("LHError: PROTOCOL_TIMEOUT Waiting for DevTools"), true);
});

test("un fallo de aserciones no se repite", () => {
  const assertionFailure = [
    "categories.accessibility failure for minScore assertion",
    "  expected: >=0.95",
    "  found: 0.91",
  ].join("\n");
  assert.equal(isEnvironmentFailure(assertionFailure), false);
  assert.equal(isEnvironmentFailure(""), false);
});
