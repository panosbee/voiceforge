// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Error Boundary Component
// Catches render-time errors in the React tree and shows a fallback.
// ═══════════════════════════════════════════════════════════════════

'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback renderer */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
          <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-danger-500" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Κάτι πήγε στραβά</h2>
          <p className="text-sm text-text-secondary mb-6 text-center max-w-md">
            Παρουσιάστηκε ένα απρόσμενο σφάλμα. Δοκιμάστε να ανανεώσετε τη σελίδα.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.resetError} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Δοκιμάστε ξανά
            </Button>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Ανανέωση σελίδας
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-6 p-4 bg-surface-secondary rounded-lg text-xs text-danger-500 max-w-lg overflow-auto">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
