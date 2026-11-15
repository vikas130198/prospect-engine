// Unique, unpredictable, never-reused client codes for prototype URLs.
import crypto from 'node:crypto';
import { now, readJSON, writeJSON } from './util.mjs';

// No 0/O, 1/I/L to avoid confusion when codes are read aloud or typed.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateCode() {
  let s = '';
  for (let i = 0; i < LENGTH; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export function allocateCode(w, leadId) {
  const reg = readJSON(w.codes, { codes: {} });
  for (let i = 0; i < 100; i++) {
    const code = generateCode();
    if (reg.codes[code]) continue;
    reg.codes[code] = { lead_id: leadId, created_at: now(), deleted_at: null };
    writeJSON(w.codes, reg);
    return code;
  }
  throw new Error('Could not allocate a unique client code.');
}

/** Codes are never removed from the registry, only marked deleted, so they can never be reused. */
export function markCodeDeleted(w, code) {
  const reg = readJSON(w.codes, { codes: {} });
  if (reg.codes[code]) {
    reg.codes[code].deleted_at = now();
    writeJSON(w.codes, reg);
  }
}
