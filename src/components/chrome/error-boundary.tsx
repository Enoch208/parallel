import { Component, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  readonly onReset: () => void;
}

interface State {
  readonly message: string | null;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  public override state: State = { message: null };

  public static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "Something went wrong" };
  }

  private readonly handleReset = (): void => {
    this.props.onReset();
    this.setState({ message: null });
  };

  public override render(): ReactNode {
    const { message } = this.state;

    if (message === null) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020202] p-6">
        <div className="flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center">
          <span className="text-lg font-medium text-white">This workspace could not be opened</span>
          <p className="text-sm font-light leading-relaxed text-neutral-500">
            The saved workspace may have been reset or removed. Starting a fresh one will not affect
            anyone else.
          </p>
          <p className="max-w-full break-words font-mono text-[11px] text-neutral-700">{message}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Start a fresh workspace
          </button>
        </div>
      </div>
    );
  }
}
