import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GenerateBriefResult } from "@convex/brief";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { BriefBody } from "@/components/knowledge/brief-body";
import { BriefGeneratePanel } from "@/components/knowledge/brief-generate-panel";
import { RecipientPanel } from "@/components/knowledge/recipient-panel";
import { TripSummaryCard } from "@/components/knowledge/trip-summary-card";
import { errorMessage } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";

const pageDescription =
  "What the trip returned, then the brief written from the team's takeaways and nothing else.";

function formatStamp(at: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(at));
}

export function BriefPage() {
  const { conferenceId } = useDemoConference();
  const generateBrief = useAction(api.brief.generateBrief);
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateBriefResult | null>(null);

  const id = conferenceId === null ? null : (conferenceId as Id<"conferences">);
  const extraRecipients = useQuery(
    api.notes.briefRecipients,
    id === null ? "skip" : { conferenceId: id },
  );
  const addRecipient = useMutation(api.notes.addBriefRecipient);
  const removeRecipient = useMutation(api.notes.removeBriefRecipient);
  const overview = useQuery(
    api.board.conferenceOverview,
    id === null ? "skip" : { conferenceId: id },
  );
  const latest = useQuery(api.brief.latest, id === null ? "skip" : { conferenceId: id });

  const runGenerate = (tripCostEstimate: number | null) => {
    if (id === null) return;
    setGenerating(true);
    setFailure(null);
    void generateBrief({ conferenceId: id, tripCostEstimate })
      .then((written) => {
        setResult(written);
      })
      .catch((error: unknown) => {
        setFailure(errorMessage(error));
      })
      .finally(() => {
        setGenerating(false);
      });
  };

  if (id === null) {
    return (
      <>
        <AppHeader title="Brief" context="No conference yet" />
        <PageHeading title="Brief" description={pageDescription} />
        <EmptyState
          title="No conference open"
          description="A brief is written from one conference's takeaways. Import a public agenda on the Agenda screen and this fills in."
        />
      </>
    );
  }

  if (latest === undefined || overview === undefined) {
    return (
      <>
        <AppHeader title="Brief" context="Loading" />
        <PageHeading title="Brief" description="Reading the trip summary from Convex." />
      </>
    );
  }

  if (latest === null || overview === null) {
    return (
      <>
        <AppHeader title="Brief" context="Conference missing" />
        <PageHeading title="Brief" description={pageDescription} />
        <EmptyState
          title="That conference no longer exists"
          description="The conference this browser remembers has been removed from the deployment. Import an agenda to start a new one."
        />
      </>
    );
  }

  const { brief, tripSummary } = latest;
  const timezone = overview.conference.timezone;
  const leadAddresses = overview.members
    .filter((member) => member.isLead)
    .map((member) => member.email);
  const blocked =
    overview.goals.length === 0
      ? "Add at least one goal before writing a brief: the brief is grouped by goal."
      : tripSummary.takeawaysCaptured === 0
        ? "There are no takeaways to write a brief from. Capture some on the Notes screen first."
        : null;

  return (
    <>
      <AppHeader title="Brief" context={overview.conference.name} />
      <PageHeading title="Brief" description={pageDescription} />

      <div className="flex flex-col gap-6">
        <TripSummaryCard summary={tripSummary} />

        <div className="mb-6">
          <RecipientPanel
            recipients={extraRecipients ?? []}
            teamRecipients={leadAddresses}
            onAdd={async (email) => {
              const lead = overview.members.find((member) => member.isLead);
              if (lead === undefined) return;
              await addRecipient({
                conferenceId: id,
                email,
                addedBy: lead.id as Id<"memberships">,
              });
            }}
            onRemove={async (recipientId) => {
              await removeRecipient({ recipientId: recipientId as Id<"briefRecipients"> });
            }}
          />
        </div>

        <BriefGeneratePanel
          costLabel={tripSummary.tripCostEstimateLabel}
          generating={generating}
          failure={failure}
          result={result}
          blocked={blocked}
          onGenerate={runGenerate}
        />

        {brief === null ? (
          <EmptyState
            title="No brief written yet"
            description="Once the team's takeaways are in, write the brief above. It cites only those takeaways, and says what it had to drop."
          />
        ) : (
          <section className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-neutral-500">
                Written {formatStamp(brief.createdAt, timezone)} by {brief.model}
              </span>
              <span className="text-xs text-neutral-500">
                {brief.sentAt === null
                  ? "Not sent yet"
                  : `Sent ${formatStamp(brief.sentAt, timezone)}`}
              </span>
            </div>
            <BriefBody body={brief.body} />
          </section>
        )}
      </div>
    </>
  );
}
