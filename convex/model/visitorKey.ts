import { ConvexError } from "convex/values";

const maximumLength = 64;
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireVisitorKey(value: string): string {
  if (value.length > maximumLength || !uuidShape.test(value)) {
    throw new ConvexError(
      "This browser sent a visitor key Parallel does not recognise. Reload the page and try again.",
    );
  }

  return value.toLowerCase();
}
