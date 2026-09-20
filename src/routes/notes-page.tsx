import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { NoteForm } from "@/components/knowledge/note-form";
import { NoteList } from "@/components/knowledge/note-list";
import { errorMessage } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";

const pageDescription =
  "Every takeaway the team captured, newest first. Each one says whether it came back as an email reply or was typed in here.";

export function NotesPage() {
  const { conferenceId } = useDemoConference();
  const addNote = useMutation(api.notes.addNote);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const id = conferenceId === null ? null : (conferenceId as Id<"conferences">);
  const overview = useQuery(
    api.board.conferenceOverview,
    id === null ? "skip" : { conferenceId: id },
  );
  const sessions = useQuery(
    api.board.conferenceSessions,
    id === null ? "skip" : { conferenceId: id },
  );
  const notes = useQuery(api.notes.listForConference, id === null ? "skip" : { conferenceId: id });

  const submitNote = (sessionId: string, membershipId: string, body: string) => {
    if (id === null) return;
    setAdding(true);
    setFailure(null);
    void addNote({
      conferenceId: id,
      sessionId: sessionId as Id<"sessions">,
      membershipId: membershipId as Id<"memberships">,
      body,
      source: "app",
    })
      .catch((error: unknown) => {
        setFailure(errorMessage(error));
      })
      .finally(() => {
        setAdding(false);
      });
  };

  if (id === null) {
    return (
      <>
        <AppHeader title="Notes" context="No conference yet" />
        <PageHeading title="Notes" description={pageDescription} />
        <EmptyState
          title="No conference open"
          description="Takeaways belong to a conference. Import a public agenda on the Agenda screen and this fills in."
        />
      </>
    );
  }

  if (overview === undefined || sessions === undefined || notes === undefined) {
    return (
      <>
        <AppHeader title="Notes" context="Loading" />
        <PageHeading title="Notes" description="Reading takeaways from Convex." />
      </>
    );
  }

  if (overview === null) {
    return (
      <>
        <AppHeader title="Notes" context="Conference missing" />
        <PageHeading title="Notes" description={pageDescription} />
        <EmptyState
          title="That conference no longer exists"
          description="The conference this browser remembers has been removed from the deployment. Import an agenda to start a new one."
        />
      </>
    );
  }

  const emailCount = notes.filter((note) => note.source === "email").length;

  return (
    <>
      <AppHeader title="Notes" context={overview.conference.name} />
      <PageHeading
        title="Notes"
        description={pageDescription}
        aside={
          <span className="font-mono text-xs tabular-nums text-neutral-500">
            {notes.length} captured · {emailCount} by email reply
          </span>
        }
      />

      <div className="flex flex-col gap-6">
        {notes.length === 0 ? (
          <EmptyState
            title="No takeaways yet"
            description="Takeaways also arrive on their own: when a session ends, teammates get an email asking what they learned, and every reply lands here labelled as an email reply. You can add one by hand below."
          />
        ) : (
          <NoteList notes={notes} timezone={overview.conference.timezone} />
        )}

        <NoteForm
          sessions={sessions}
          members={overview.members}
          timezone={overview.conference.timezone}
          adding={adding}
          failure={failure}
          onAdd={submitNote}
        />
      </div>
    </>
  );
}
