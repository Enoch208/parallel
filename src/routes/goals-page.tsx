import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ScoreConferenceResult } from "@convex/scoring";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { GoalPanel } from "@/components/setup/goal-panel";
import { ScoringPanel } from "@/components/setup/scoring-panel";
import { TeammatePanel } from "@/components/setup/teammate-panel";
import { errorMessage } from "@/components/setup/setup-shell";
import { useDemoConference } from "@/lib/use-demo-conference";

const pageDescription =
  "Weighted goals and the people going. Relevance scores are advisory input; the deterministic optimizer makes every assignment.";

export function GoalsPage() {
  const { conferenceId } = useDemoConference();
  const addGoal = useMutation(api.team.addGoal);
  const addTeammate = useMutation(api.team.addTeammate);
  const scoreConference = useAction(api.scoring.scoreConference);

  const [goalWork, setGoalWork] = useState(false);
  const [goalFailure, setGoalFailure] = useState<string | null>(null);
  const [memberWork, setMemberWork] = useState(false);
  const [memberFailure, setMemberFailure] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreFailure, setScoreFailure] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreConferenceResult | null>(null);

  const id = conferenceId === null ? null : (conferenceId as Id<"conferences">);
  const overview = useQuery(
    api.board.conferenceOverview,
    id === null ? "skip" : { conferenceId: id },
  );
  const sessions = useQuery(
    api.board.conferenceSessions,
    id === null ? "skip" : { conferenceId: id },
  );

  const submitGoal = (label: string, weight: number) => {
    if (id === null) return;
    setGoalWork(true);
    setGoalFailure(null);
    void addGoal({ conferenceId: id, label, weight })
      .catch((error: unknown) => {
        setGoalFailure(errorMessage(error));
      })
      .finally(() => {
        setGoalWork(false);
      });
  };

  const submitTeammate = (displayName: string, email: string, isLead: boolean) => {
    if (id === null) return;
    setMemberWork(true);
    setMemberFailure(null);
    void addTeammate({ conferenceId: id, displayName, email, isLead })
      .catch((error: unknown) => {
        setMemberFailure(errorMessage(error));
      })
      .finally(() => {
        setMemberWork(false);
      });
  };

  const runScoring = () => {
    if (id === null) return;
    setScoring(true);
    setScoreFailure(null);
    void scoreConference({ conferenceId: id })
      .then((measured) => {
        setScoreResult(measured);
      })
      .catch((error: unknown) => {
        setScoreFailure(errorMessage(error));
      })
      .finally(() => {
        setScoring(false);
      });
  };

  if (id === null) {
    return (
      <>
        <AppHeader title="Goals" context="No conference yet" />
        <PageHeading title="Goals" description={pageDescription} />
        <EmptyState
          title="No conference open"
          description="Goals and teammates belong to a conference. Import a public agenda on the Agenda screen and this fills in."
        />
      </>
    );
  }

  if (overview === undefined || sessions === undefined) {
    return (
      <>
        <AppHeader title="Goals" context="Loading" />
        <PageHeading title="Goals" description="Reading goals and the team from Convex." />
      </>
    );
  }

  if (overview === null) {
    return (
      <>
        <AppHeader title="Goals" context="Conference missing" />
        <PageHeading title="Goals" description={pageDescription} />
        <EmptyState
          title="That conference no longer exists"
          description="The conference this browser remembers has been removed from the deployment. Import an agenda to start a new one."
        />
      </>
    );
  }

  const blocked =
    sessions.length === 0
      ? "Import an agenda before scoring: there are no sessions to score."
      : overview.goals.length === 0
        ? "Add at least one goal before scoring: there is nothing to score sessions against."
        : null;

  return (
    <>
      <AppHeader title="Goals" context={overview.conference.name} />
      <PageHeading
        title="Goals"
        description={
          overview.conference.isDemoData
            ? "Demo data. Agenda content is illustrative, not a real published agenda."
            : pageDescription
        }
      />

      <div className="flex flex-col gap-6">
        <GoalPanel
          goals={overview.goals}
          adding={goalWork}
          failure={goalFailure}
          onAdd={submitGoal}
        />
        <ScoringPanel
          result={scoreResult}
          scoring={scoring}
          failure={scoreFailure}
          blocked={blocked}
          onScore={runScoring}
        />
        <TeammatePanel
          members={overview.members}
          adding={memberWork}
          failure={memberFailure}
          onAdd={submitTeammate}
        />
      </div>
    </>
  );
}
