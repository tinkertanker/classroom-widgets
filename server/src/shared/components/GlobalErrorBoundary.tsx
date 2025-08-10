// Global Error Boundary - Catches all unhandled errors in the app

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorService, ErrorCode } from '../../services/ErrorService';
import { Button, Card } from '../../components/ui';
import { FaTriangleExclamation, FaRotateLeft } from 'react-icons/fa6';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to error service
    errorService.logError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'Unhandled application error',
      details: {
        error: error.toString(),
        errorInfo: errorInfo.componentStack,
        stack: error.stack
      },
      timestamp: Date.now()
    });

    // Update state with error info
    this.setState({
      errorInfo
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 flex items-center justify-center p-8">
          <Card className="max-w-2xl w-full" variant="bordered">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-dusty-rose-100 dark:bg-dusty-rose-900 rounded-full">
                  <FaTriangleExclamation className="text-4xl text-dusty-rose-600 dark:text-dusty-rose-400" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
                Something went wrong
              </h1>
              
              <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-6">
                We encountered an unexpected error. The error has been logged and we'll look into it.
              </p>

              {process.env.NODE_ENV === 'development' && error && (
                <div className="mb-6 text-left">
                  <details className="bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg p-4">
                    <summary className="cursor-pointer text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                      Error Details (Development Only)
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-warm-gray-600 dark:text-warm-gray-400">
                          Error:
                        </p>
                        <pre className="text-xs text-dusty-rose-600 dark:text-dusty-rose-400 overflow-x-auto">
                          {error.toString()}
                        </pre>
                      </div>
                      {error.stack && (
                        <div>
                          <p className="text-xs font-medium text-warm-gray-600 dark:text-warm-gray-400">
                            Stack Trace:
                          </p>
                          <pre className="text-xs text-warm-gray-500 dark:text-warm-gray-500 overflow-x-auto whitespace-pre-wrap">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                      {errorInfo && (
                        <div>
                          <p className="text-xs font-medium text-warm-gray-600 dark:text-warm-gray-400">
                            Component Stack:
                          </p>
                          <pre className="text-xs text-warm-gray-500 dark:text-warm-gray-500 overflow-x-auto whitespace-pre-wrap">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              <div className="flex justify-center space-x-3">
                <Button
                  variant="primary"
                  icon={<FaRotateLeft />}
                  onClick={this.handleReset}
                >
                  Try Again
                </Button>
                <Button
                  variant="secondary"
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export default GlobalErrorBoundary;