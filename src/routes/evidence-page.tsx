import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { AgendaEvidence } from "@/components/evidence/agenda-evidence";
import { AssignmentEvidence } from "@/components/evidence/assignment-evidence";
import { ConstraintEvidence } from "@/components/evidence/constraint-evidence";
import { ModelEvidence } from "@/components/evidence/model-evidence";
import { SetupPanel } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";

const pageDescription =
  "Pick any number on this plan and follow it back to the row it came from: the page it was scraped off, the reason the optimizer stored, or the sentence a teammate actually wrote.";

const sampleSize = 12;

export function EvidencePage() {
  const { conferenceId } = useDemoConference();
  const id = conferenceId === null ? null : (conferenceId as Id<"conferences">);

  const overview = useQuery(
    api.board.conferenceOverview,
    id === null ? "skip" : { conferenceId: id },
  );
  const sessions = useQuery(
    api.evidence.agendaProvenance,
    id === null ? "skip" : { conferenceId: id },
  );
  const plan = useQuery(
    api.evidence.assignmentProvenance,
    id === null ? "skip" : { conferenceId: id },
  );
  const trail = useQuery(api.evidence.constraintTrail, id === null ? "skip" : { conferenceId: id });
  const scores = useQuery(
    api.evidence.relevanceProvenance,
    id === null ? "skip" : { conferenceId: id, limit: sampleSize },
  );

  if (id === null) {
    return (
      <>
        <AppHeader title="Evidence" context="No conference yet" />
        <PageHeading title="Evidence" description={pageDescription} />
        <EmptyState
          title="No conference open"
          description="This screen audits one conference. Import a public agenda on the Agenda screen, or run the one-click demo on the Judges screen, and every row behind the plan appears here."
        />
      </>
    );
  }

  if (
    overview === undefined ||
    sessions === undefined ||
    plan === undefined ||
    trail === undefined ||
    scores === undefined
  ) {
    return (
      <>
        <AppHeader title="Evidence" context="Loading" />
        <PageHeading title="Evidence" description="Reading the provenance rows from Convex." />
      </>
    );
  }

  if (overview === null) {
    return (
      <>
        <AppHeader title="Evidence" context="Conference missing" />
        <PageHeading title="Evidence" description={pageDescription} />
        <EmptyState
          title="That conference no longer exists"
          description="The conference this browser remembers has been removed from the deployment, so there is nothing left to audit. Import an agenda to start a new one."
        />
      </>
    );
  }

  const timezone = overview.conference.timezone;

  return (
    <>
      <AppHeader title="Evidence" context={overview.conference.name} />
      <PageHeading title="Evidence" description={pageDescription} />

      <div className="flex min-w-0 flex-col gap-6 pb-10">
        <SetupPanel
          title="Where the agenda came from"
          description={`Every session was extracted from a published page. Each row carries the URL it was read from, when it was fetched, and the hash of the exact bytes that were fetched. Times in ${timezone}.`}
        >
          <AgendaEvidence sessions={sessions} timezone={timezone} />
        </SetupPanel>

        <SetupPanel
          title="Why each person is where they are"
          description="The reason stored with each assignment when the optimizer wrote it, and the constraint revision the plan was computed at. Nothing here is generated when the page loads."
        >
          <AssignmentEvidence plan={plan} timezone={timezone} />
        </SetupPanel>

        <SetupPanel
          title="What changed the plan"
          description="Each block on somebody's day, with the teammate's own words beside it. A block is joined to an inbound reply only when that reply's stored quote matches the block's quote for the same teammate."
        >
          <ConstraintEvidence trail={trail} timezone={timezone} />
        </SetupPanel>

        <SetupPanel
          title="What the model contributed"
          description="Relevance scores, the one-line reason stored with each, and the model that produced it."
        >
          <ModelEvidence scores={scores} />
        </SetupPanel>
      </div>
    </>
  );
}
