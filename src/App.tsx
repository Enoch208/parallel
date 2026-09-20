import { Route, Routes } from "react-router";
import { AppShell } from "./components/chrome/app-shell";
import { AgendaPage } from "./routes/agenda-page";
import { BoardPage } from "./routes/board-page";
import { BriefPage } from "./routes/brief-page";
import { GoalsPage } from "./routes/goals-page";
import { LandingPage } from "./routes/landing-page";
import { NotesPage } from "./routes/notes-page";
import { NotFoundPage } from "./routes/not-found-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/board" element={<BoardPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/brief" element={<BriefPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
