import { randomBytes } from 'node:crypto';

// base64url 12 byte → 16 char ID. 파일명 안전 + 충분한 엔트로피.
export function newId(): string {
  return randomBytes(12).toString('base64url');
}

const RE = /^[A-Za-z0-9_-]+$/;
export function isValidId(s: string): boolean {
  return RE.test(s);
}
