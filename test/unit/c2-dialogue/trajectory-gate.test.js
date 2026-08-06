// @category C2
// TrajectoryGate contract: derivePathComplete true/false + shape normalize.
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  derivePathComplete,
  buildTrajectoryGate,
  validateTrajectoryGateShape,
} from "../../../src/dialogue/trajectory.js";

test("incomplete purpose → pathComplete false", () => {
  assert.equal(
    derivePathComplete({
      mode: "fast",
      purposeDone: false,
      verifyDone: null,
      skipReasons: {},
    }),
    false,
  );
});

test("purposeDone true + verify N/A → pathComplete true", () => {
  assert.equal(
    derivePathComplete({
      mode: "fast",
      purposeDone: true,
      verifyDone: null,
      skipReasons: {},
    }),
    true,
  );
});

test("purpose skip reason counts as purpose done", () => {
  assert.equal(
    derivePathComplete({
      mode: "control",
      purposeDone: false,
      verifyDone: true,
      skipReasons: { purpose: "user re-used ledger purpose from session 1" },
    }),
    true,
  );
});

test("empty purpose skip string does not count", () => {
  assert.equal(
    derivePathComplete({
      mode: "fast",
      purposeDone: false,
      verifyDone: null,
      skipReasons: { purpose: "   " },
    }),
    false,
  );
});

test("verifyDone false without skip → pathComplete false", () => {
  assert.equal(
    derivePathComplete({
      mode: "control",
      purposeDone: true,
      verifyDone: false,
      skipReasons: {},
    }),
    false,
  );
});

test("verifyDone false with verify skip reason → pathComplete true", () => {
  assert.equal(
    derivePathComplete({
      mode: "control",
      purposeDone: true,
      verifyDone: false,
      skipReasons: { verify: "path skips mechanical verify for this subject" },
    }),
    true,
  );
});

test("verifyDone true with purpose done → pathComplete true", () => {
  assert.equal(
    derivePathComplete({
      mode: "control",
      purposeDone: true,
      verifyDone: true,
      skipReasons: {},
    }),
    true,
  );
});

test("invalid mode → pathComplete false", () => {
  assert.equal(
    derivePathComplete({
      // Intentionally invalid gate mode (not fast|control).
      mode: /** @type {any} */ ("workbook"),
      purposeDone: true,
      verifyDone: null,
      skipReasons: {},
    }),
    false,
  );
});

test("buildTrajectoryGate re-derives pathComplete (ignores agent hope)", () => {
  const gate = buildTrajectoryGate({
    mode: "fast",
    purposeDone: false,
    verifyDone: null,
    pathComplete: true,
  });
  assert.equal(gate.pathComplete, false);
  assert.equal(gate.purposeDone, false);
  assert.equal(gate.mode, "fast");
});

test("buildTrajectoryGate control missing verifyDone defaults false → incomplete", () => {
  const gate = buildTrajectoryGate({ mode: "control", purposeDone: true });
  assert.equal(gate.verifyDone, false);
  assert.equal(gate.pathComplete, false);
});

test("buildTrajectoryGate fast missing verifyDone defaults null → complete when purpose done", () => {
  const gate = buildTrajectoryGate({ mode: "fast", purposeDone: true });
  assert.equal(gate.verifyDone, null);
  assert.equal(gate.pathComplete, true);
});

test("validateTrajectoryGateShape accepts complete control gate", () => {
  const result = validateTrajectoryGateShape({
    mode: "control",
    purposeDone: true,
    verifyDone: true,
    skipReasons: {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.gate.pathComplete, true);
});

test("validateTrajectoryGateShape rejects bad mode", () => {
  const result = validateTrajectoryGateShape({
    mode: /** @type {any} */ ("workbook"),
    purposeDone: true,
    verifyDone: null,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /mode/.test(e)));
});

test("gate module has no user-chat field-name dump helpers", () => {
  // 0.1 keeps internals internal — plain-language refuse is 0.4.
  // Contract exports derive/build/validate only; no formatRefuse / toUserMessage.
  assert.equal(typeof derivePathComplete, "function");
  assert.equal(typeof buildTrajectoryGate, "function");
  assert.equal(typeof validateTrajectoryGateShape, "function");
  assert.equal(
    Object.keys({
      derivePathComplete,
      buildTrajectoryGate,
      validateTrajectoryGateShape,
    }).some((k) => /user|chat|refuse|message|phrase/i.test(k)),
    false,
  );
});
