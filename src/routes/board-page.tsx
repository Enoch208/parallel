import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppHeader } from "@/components/chrome/app-header";
import { EmptyState } from "@/components/chrome/empty-state";
import { PageHeading } from "@/components/chrome/page-heading";
import { ActivityFeed } from "@/components/board/activity-feed";
import { BoardView, type BoardLane } from "@/components/board/board-view";
import type { LaneCard } from "@/components/board/lane-column";
import type { CardState } from "@/components/board/session-card";
import { useDemoConference } from "@/lib/use-demo-conference";

export function BoardPage() {
  const { conferenceId, remember } = useDemoConference();
  const [starting, setStarting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const seedDemo = useMutation(api.demo.seedDemoWorkspace);
  const buildNaturalPlan = useMutation(api.plan.naturalPlan);
  const optimize = useMutation(api.plan.optimize);
  const repair = useMutation(api.plan.repair);
  const release = useMutation(api.assignments.release);
  const [repairing, setRepairing] = useState(false);

  const id = conferenceId === null ? null : (conferenceId as Id<"conferences">);
  const overview = useQuery(
    api.board.conferenceOverview,
    id === null ? "skip" : { conferenceId: id },
  );
  const sessions = useQuery(
    api.board.conferenceSessions,
    id === null ? "skip" : { conferenceId: id },
  );
  const plan = useQuery(api.board.latestPlan, id === null ? "skip" : { conferenceId: id });
  const coverage = useQuery(api.plan.coverage, id === null ? "skip" : { conferenceId: id });
  const activity = useQuery(api.activity.recent, id === null ? "skip" : { conferenceId: id });

  const startDemo = async () => {
    setStarting(true);
    const created = await seedDemo({});
    await buildNaturalPlan({ conferenceId: created });
    remember(created);
    setStarting(false);
  };

  const runOptimize = async () => {
    if (id === null) return;
    setOptimizing(true);
    try {
      await optimize({ conferenceId: id });
    } finally {
      setOptimizing(false);
    }
  };

  const runRepair = async () => {
    if (id === null) return;
    setRepairing(true);
    try {
      await repair({ conferenceId: id });
    } finally {
      setRepairing(false);
    }
  };

  const runRelease = async (membershipId: string, sessionId: string) => {
    if (plan === null || plan === undefined || overview === null || overview === undefined) {
      return;
    }

    await release({
      planId: plan.id as Id<"plans">,
      sessionId: sessionId as Id<"sessions">,
      membershipId: membershipId as Id<"memberships">,
      expectedRevision: plan.conferenceRevision,
    });
  };

  if (id === null) {
    return (
      <>
        <AppHeader title="Board" context="No workspace open" />
        <PageHeading
          title="Team plan"
          description="One lane per teammate. Claiming or releasing a session updates every screen."
        />
        <EmptyState
          title="Start the demo team"
          description="Opens a labelled demo conference with four teammates, a real day of parallel tracks, and everyone's natural picks already stacked on the same famous sessions."
          action={
            <button
              type="button"
              onClick={() => {
                void startDemo();
              }}
              disabled={starting}
              className="mt-2 rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
            >
              {starting ? "Setting up…" : "Try the live team"}
            </button>
          }
        />
      </>
    );
  }

  if (overview === undefined || sessions === undefined || plan === undefined) {
    return (
      <>
        <AppHeader title="Board" context="Loading" />
        <PageHeading title="Team plan" description="Reading the plan from Convex." />
      </>
    );
  }

  if (overview === null) {
    return (
      <>
        <AppHeader title="Board" context="Workspace missing" />
        <EmptyState
          title="That workspace no longer exists"
          description="The demo workspace it pointed at has been removed. Start a new one from the board."
        />
      </>
    );
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const assignments = plan === null ? [] : plan.assignments;
  const perSession = new Map<string, number>();

  for (const assignment of assignments) {
    perSession.set(assignment.sessionId, (perSession.get(assignment.sessionId) ?? 0) + 1);
  }

  const lanes: BoardLane[] = overview.members.map((member) => {
    const cards: LaneCard[] = assignments
      .filter((assignment) => assignment.membershipId === member.id)
      .flatMap<LaneCard>((assignment) => {
        const session = sessionById.get(assignment.sessionId);

        if (session === undefined) {
          return [];
        }

        const shared = (perSession.get(assignment.sessionId) ?? 0) > 1;
        const state: CardState = assignment.pinned ? "pinned" : shared ? "duplicate" : "assigned";

        return [{ session, state, reason: assignment.reason }];
      })
      .sort((a: LaneCard, b: LaneCard) => a.session.startsAt - b.session.startsAt);

    return {
      membershipId: member.id,
      memberName: member.displayName,
      isLead: member.isLead,
      cards,
    };
  });

  return (
    <>
      <AppHeader title="Board" context={overview.conference.name} />
      <PageHeading
        title="Team plan"
        description={
          overview.conference.isDemoData
            ? "Demo data. Agenda content is illustrative, not a real published agenda."
            : "One lane per teammate."
        }
      />
      <BoardView
        lanes={lanes}
        coverage={coverage ?? null}
        timezone={overview.conference.timezone}
        staleReason={
          plan !== null && plan.isStale
            ? "A constraint changed since this plan was computed."
            : null
        }
        optimizing={optimizing}
        repairing={repairing}
        onOptimize={() => {
          void runOptimize();
        }}
        onRepair={() => {
          void runRepair();
        }}
        onRelease={(membershipId, sessionId) => {
          void runRelease(membershipId, sessionId);
        }}
      />

      <div className="mt-6">
        <ActivityFeed rows={activity ?? []} />
      </div>
    </>
  );
}
