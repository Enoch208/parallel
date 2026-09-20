import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";

export function GoalsPage() {
  return (
    <>
      <AppHeader title="Goals" context="No conference imported" />
      <PageHeading
        title="Goals"
        description="Three to six weighted goals. Every session is scored against each one."
      />
      <EmptyState
        title="Nothing here yet"
        description="Three to six weighted goals. Every session is scored against each one."
      />
    </>
  );
}
