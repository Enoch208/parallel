import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { WorkflowId } from "@convex-dev/workflow";
import type { Id } from "@convex/_generated/dataModel";
import type { ImportResult } from "@convex/importAgenda";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { WorkflowProgress } from "@/components/setup/workflow-progress";
import { ImportAgendaForm, type ImportRequest } from "@/components/setup/import-agenda-form";
import { ImportSummary } from "@/components/setup/import-summary";
import { SessionList } from "@/components/setup/session-list";
import { errorMessage } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";

const pageDescription =
  "Every session Parallel imported, with the published page behind each one. Nothing here is typed by hand.";

export function AgendaPage() {
  const { conferenceId, remember } = useDemoConference();
  const beginImport = useMutation(api.importWorkflow.startImport);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
  const runStatus = useQuery(
    api.importWorkflow.runStatus,
    workflowId === null ? "skip" : { workflowId: workflowId as WorkflowId },
  );

  const running =
    workflowId !== null && (runStatus === undefined || runStatus.type === "inProgress");

  const startImport = async (request: ImportRequest) => {
    setSubmitting(true);
    setFailure(null);
    setResult(null);

    try {
      const started = await beginImport(request);
      setWorkflowId(started.workflowId);
      remember(started.conferenceId);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onImport = (request: ImportRequest) => {
    void startImport(request);
  };

  if (id === null) {
    return (
      <>
        <AppHeader title="Agenda" context="No conference yet" />
        <PageHeading title="Agenda" description={pageDescription} />
        <div className="flex flex-col gap-6">
          <EmptyState
            title="No conference open"
            description="Importing a public agenda is what starts one: Parallel creates the conference, the team and the sessions from the page you paste below."
          />
          {runStatus !== undefined && (
            <WorkflowProgress
              type={runStatus.type}
              running={runStatus.running}
              error={runStatus.error}
            />
          )}
          <ImportAgendaForm
            importing={submitting || running}
            failure={failure}
            onImport={onImport}
          />
        </div>
      </>
    );
  }

  if (overview === undefined || sessions === undefined) {
    return (
      <>
        <AppHeader title="Agenda" context="Loading" />
        <PageHeading title="Agenda" description="Reading the agenda from Convex." />
      </>
    );
  }

  if (overview === null) {
    return (
      <>
        <AppHeader title="Agenda" context="Conference missing" />
        <PageHeading title="Agenda" description={pageDescription} />
        <div className="flex flex-col gap-6">
          <EmptyState
            title="That conference no longer exists"
            description="The conference this browser remembers has been removed from the deployment. Import an agenda to start a new one."
          />
          {runStatus !== undefined && (
            <WorkflowProgress
              type={runStatus.type}
              running={runStatus.running}
              error={runStatus.error}
            />
          )}
          <ImportAgendaForm
            importing={submitting || running}
            failure={failure}
            onImport={onImport}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Agenda" context={overview.conference.name} />
      <PageHeading
        title="Agenda"
        description={
          overview.conference.isDemoData
            ? "Demo data. Agenda content is illustrative, not a real published agenda."
            : pageDescription
        }
      />

      <div className="flex flex-col gap-6">
        {runStatus !== undefined && (
          <WorkflowProgress
            type={runStatus.type}
            running={runStatus.running}
            error={runStatus.error}
          />
        )}

        <ImportSummary result={result} />

        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions on this conference"
            description="This conference exists but nothing was inserted from its agenda page. Run an import below and read the counts it returns."
          />
        ) : (
          <SessionList sessions={sessions} timezone={overview.conference.timezone} />
        )}

        <ImportAgendaForm importing={submitting || running} failure={failure} onImport={onImport} />
      </div>
    </>
  );
}
