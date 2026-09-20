import { Link } from "react-router";
import { EmptyState } from "@/components/chrome/empty-state";
import { appRoutes } from "@/lib/routes";

export function NotFoundPage() {
  return (
    <div className="pt-10">
      <EmptyState
        title="Page not found"
        description="That route does not exist in Parallel."
        action={
          <Link
            to={appRoutes.board}
            className="mt-2 rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Back to the board
          </Link>
        }
      />
    </div>
  );
}
