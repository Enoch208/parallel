export const renameSimilarity = 0.6;
const shortestPhrase = 4;

function bigrams(value: string): readonly string[] {
  const grams: string[] = [];

  for (let index = 0; index + 1 < value.length; index += 1) {
    grams.push(value.slice(index, index + 2));
  }

  return grams;
}

function bigramOverlap(left: string, right: string): number {
  const grams = bigrams(left);
  const other = bigrams(right);
  const pool = [...other];

  if (grams.length === 0 || other.length === 0) {
    return 0;
  }

  let shared = 0;

  for (const gram of grams) {
    const found = pool.indexOf(gram);

    if (found >= 0) {
      pool.splice(found, 1);
      shared += 1;
    }
  }

  return (2 * shared) / (grams.length + other.length);
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (needle.length < shortestPhrase) {
    return false;
  }

  return (
    haystack === needle ||
    haystack.startsWith(`${needle} `) ||
    haystack.endsWith(` ${needle}`) ||
    haystack.includes(` ${needle} `)
  );
}

export function readsAsTheSameTitle(before: string, after: string): boolean {
  return (
    containsPhrase(before, after) ||
    containsPhrase(after, before) ||
    bigramOverlap(before, after) >= renameSimilarity
  );
}
