import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.widgetName || 'widget'}:`, error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.resetError);
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-warm-gray-50 dark:bg-warm-gray-800 rounded-lg">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-dusty-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
              Widget Error
            </h3>
            <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-4">
              {this.props.widgetName ? `The ${this.props.widgetName} widget` : 'This widget'} encountered an error
            </p>
            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded-md transition-colors duration-200 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;