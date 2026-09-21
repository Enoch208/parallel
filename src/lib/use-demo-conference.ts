import { useCallback, useEffect, useState } from "react";

const storageKey = "parallel.conferenceId";
const linkParam = "c";

function readLinked(): string | null {
  try {
    const linked = new URLSearchParams(window.location.search).get(linkParam);
    return linked === null || linked === "" ? null : linked;
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function useDemoConference() {
  const [conferenceId, setConferenceId] = useState<string | null>(
    () => readLinked() ?? readStored(),
  );

  useEffect(() => {
    const linked = readLinked();
    if (linked === null) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, linked);
    } catch {
      return;
    }
  }, []);

  const remember = useCallback((id: string) => {
    try {
      window.localStorage.setItem(storageKey, id);
    } catch {
      setConferenceId(id);
      return;
    }
    setConferenceId(id);
  }, []);

  const forget = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      setConferenceId(null);
      return;
    }
    setConferenceId(null);
  }, []);

  return { conferenceId, remember, forget };
}
