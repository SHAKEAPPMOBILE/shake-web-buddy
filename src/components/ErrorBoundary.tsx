import * as React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

/**
 * Prevents a blank screen by rendering a fallback UI when a runtime error happens.
 * Keeps styling token-based (no raw colors).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : typeof this.state.error === "string"
          ? this.state.error
          : "Something went wrong.";

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-5">
          <h1 className="text-lg font-display">We hit a problem</h1>
          <p className="mt-2 text-sm text-muted-foreground break-words">{message}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
