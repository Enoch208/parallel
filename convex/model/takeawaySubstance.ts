import { significantWords } from "./sessionMatch";

const takeawayFraming = new Set(["takeaway", "takeaways", "from", "my", "re"]);
const wordsOfItsOwn = 4;

export function saysMoreThanTheTitle(body: string, sessionTitle: string): boolean {
  const named = new Set(significantWords(sessionTitle));
  const own = significantWords(body).filter(
    (word) => !named.has(word) && !takeawayFraming.has(word),
  );

  return own.length >= wordsOfItsOwn;
}
