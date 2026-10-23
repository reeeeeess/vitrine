// A page that broke while drawing: instead of a blank window, what happened, a way back, and the report.
import { Component, type ReactNode } from "react";
import { recordError } from "../lib/errorLog";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    recordError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-display text-3xl tracking-tight">Vitrine a rencontré une erreur</h1>
        <p className="max-w-md text-sm text-gray-400">La musique continue. L'erreur est gardée sur cet ordinateur : vous pouvez copier le rapport pour nous l'envoyer.</p>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={() => location.reload()}>
            Recharger
          </button>
          <button className="btn-ghost" onClick={() => void window.vitrine?.errors?.copy()}>
            Copier le rapport
          </button>
        </div>
      </main>
    );
  }
}
