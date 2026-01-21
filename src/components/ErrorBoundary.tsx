import * as React from "react";
import shakeLogo from "@/assets/shake-logo-new.png";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <img
            src={shakeLogo}
            alt="SHAKE"
            className="mx-auto mb-6 h-20 w-20 object-contain"
            loading="eager"
          />
          <h1 className="text-2xl font-display font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try reloading. If it keeps happening, we’ll use the console log to pinpoint the exact cause.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="secondary"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
