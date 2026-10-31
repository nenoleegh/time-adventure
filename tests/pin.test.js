import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/utils/pin.js";

test("local SHA-256 fallback matches the standard test vector", () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("local SHA-256 fallback handles UTF-8 input", () => {
  assert.equal(
    sha256Hex("孩子:2468"),
    "d98ef77d525a9e6e6e289a7bd895cc42ff4f4b898cf2843c03b456f4a03abf03",
  );
});
