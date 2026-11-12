import React from 'react';

interface State {
  error: Error | null;
}

/** Shows the error instead of a blank white page when something crashes while rendering. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Aplikasi error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 shadow-xl">
          <h1 className="text-lg font-bold text-rose-600">Terjadi kesalahan</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Aplikasi gagal ditampilkan. Kirim pesan di bawah ini ke developer.
          </p>
          <pre className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-60 overflow-auto">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
