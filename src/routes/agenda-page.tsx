import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";

export function AgendaPage() {
  return (
    <>
      <AppHeader title="Agenda" context="No conference imported" />
      <PageHeading
        title="Agenda"
        description="Sessions imported from the public agenda, with a source link on every field."
      />
      <EmptyState
        title="Nothing here yet"
        description="Sessions imported from the public agenda, with a source link on every field."
      />
    </>
  );
}
