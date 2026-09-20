import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";

export function BriefPage() {
  return (
    <>
      <AppHeader title="Brief" context="No conference imported" />
      <PageHeading title="Brief" description="The trip summary and takeaways grouped by goal." />
      <EmptyState
        title="Nothing here yet"
        description="The trip summary and takeaways grouped by goal."
      />
    </>
  );
}
