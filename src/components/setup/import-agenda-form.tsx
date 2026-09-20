import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { ErrorNote, PrimaryButton, SetupPanel, TextField } from "./setup-shell";

export interface ImportRequest {
  readonly agendaUrl: string;
  readonly conferenceName: string;
  readonly teamName: string;
  readonly timezone: string;
  readonly dayMarker: string | null;
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function ImportAgendaForm({
  importing,
  failure,
  onImport,
}: {
  importing: boolean;
  failure: string | null;
  onImport: (request: ImportRequest) => void;
}) {
  const [agendaUrl, setAgendaUrl] = useState("");
  const [conferenceName, setConferenceName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone);
  const [dayMarker, setDayMarker] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = () => {
    const url = agendaUrl.trim();

    if (!url.startsWith("https://")) {
      setInvalid("The agenda URL must be a public https:// page.");
      return;
    }

    if (conferenceName.trim().length === 0) {
      setInvalid("Give the conference a name so the workspace can be found again.");
      return;
    }

    if (teamName.trim().length === 0) {
      setInvalid("Give the team a name.");
      return;
    }

    if (timezone.trim().length === 0) {
      setInvalid("An IANA timezone is required to turn local agenda times into real times.");
      return;
    }

    setInvalid(null);
    onImport({
      agendaUrl: url,
      conferenceName: conferenceName.trim(),
      teamName: teamName.trim(),
      timezone: timezone.trim(),
      dayMarker: dayMarker.trim().length === 0 ? null : dayMarker.trim(),
    });
  };

  return (
    <SetupPanel
      title="Import a public agenda"
      description="Parallel scrapes the page you paste, extracts sessions from it, and keeps the source URL on every session so any field can be checked against the published agenda. The scrape and extraction usually take 20 to 60 seconds."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          id="agenda-url"
          label="Agenda URL"
          type="url"
          value={agendaUrl}
          onChange={setAgendaUrl}
          placeholder="https://"
          hint="A public agenda page. No login walls."
          disabled={importing}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="conference-name"
            label="Conference name"
            value={conferenceName}
            onChange={setConferenceName}
            disabled={importing}
          />
          <TextField
            id="team-name"
            label="Team name"
            value={teamName}
            onChange={setTeamName}
            disabled={importing}
          />
          <TextField
            id="timezone"
            label="Conference timezone"
            value={timezone}
            onChange={setTimezone}
            hint="IANA name, such as the one your browser reports."
            disabled={importing}
          />
          <TextField
            id="day-marker"
            label="Day marker (optional)"
            value={dayMarker}
            onChange={setDayMarker}
            hint="Text that marks the start of the day you want, if the page lists several."
            disabled={importing}
          />
        </div>

        {invalid !== null && (
          <p role="alert" className="text-xs text-amber-200">
            {invalid}
          </p>
        )}
        {failure !== null && <ErrorNote message={failure} />}

        <div className="flex items-center gap-3">
          <PrimaryButton type="submit" disabled={importing}>
            <HugeiconsIcon icon={Download01Icon} size={15} />
            {importing ? "Importing…" : "Import agenda"}
          </PrimaryButton>
          {importing && (
            <span className="text-xs text-neutral-500" aria-live="polite">
              Scraping the page, then extracting sessions. This can take a minute.
            </span>
          )}
        </div>
      </form>
    </SetupPanel>
  );
}
