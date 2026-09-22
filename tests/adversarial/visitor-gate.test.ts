import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

function handlerSource(file: string, exportName: string): string {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf(`export const ${exportName} =`);

  expect(start).toBeGreaterThan(-1);

  return source.slice(start);
}

function positionOf(source: string, needle: string): number {
  const at = source.indexOf(needle);

  expect(at, needle).toBeGreaterThan(-1);

  return at;
}

it("startImport admits the browser before it creates a conference or starts the workflow", () => {
  const source = handlerSource("../../convex/importWorkflow.ts", "startImport");
  const gate = positionOf(source, "await admitVisitor(");

  for (const spend of ["internal.importWrites.createConference", "importWorkflows.start("]) {
    expect(gate, spend).toBeLessThan(positionOf(source, spend));
  }
});

it("runDemo admits the browser before it seeds a workspace", () => {
  const source = handlerSource("../../convex/judges.ts", "runDemo");

  expect(positionOf(source, "await admitVisitor(")).toBeLessThan(
    positionOf(source, "api.demo.seedDemoWorkspace"),
  );
});
