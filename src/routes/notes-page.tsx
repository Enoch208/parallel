import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";

export function NotesPage() {
  return (
    <>
      <AppHeader title="Notes" context="No conference imported" />
      <PageHeading
        title="Notes"
        description="Takeaways arrive as email replies and land here live."
      />
      <EmptyState
        title="Nothing here yet"
        description="Takeaways arrive as email replies and land here live."
      />
    </>
  );
}
