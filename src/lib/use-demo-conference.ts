import { useCallback, useState } from "react";

const storageKey = "parallel.conferenceId";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function useDemoConference() {
  const [conferenceId, setConferenceId] = useState<string | null>(readStored);

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
