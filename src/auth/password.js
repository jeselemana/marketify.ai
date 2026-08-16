import argon2 from "argon2";
import { createHash } from "node:crypto";

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password) {
  return argon2.hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
