const tokenPattern = /\[PL-([A-Z0-9]{4,8})\]/;

export function tokenFromSubject(subject: string): string | null {
  const match = tokenPattern.exec(subject.toUpperCase());

  if (match === null) {
    return null;
  }

  return subject.toUpperCase().replace(/^.*\[PL-([A-Z0-9]{4,8})\].*$/, "$1");
}

export function normalizeAddress(address: string): string {
  const bare = address.includes("<") ? address.replace(/^[^<]*<([^>]*)>.*$/, "$1") : address;
  return bare.trim().toLowerCase();
}

const tokenAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeToken(seed: number): string {
  let value = Math.abs(Math.trunc(seed));
  let token = "";

  for (let index = 0; index < 4; index += 1) {
    token += tokenAlphabet.charAt(value % tokenAlphabet.length);
    value = Math.trunc(value / tokenAlphabet.length) + 7;
  }

  return token;
}
