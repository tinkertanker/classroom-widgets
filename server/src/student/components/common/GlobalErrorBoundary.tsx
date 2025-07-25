import React, { Component, ReactNode } from 'react';
import { errorService, ErrorType } from '../../services/ErrorService';
import Button from './Button';
import Card from './Card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Global error boundary caught:', error, errorInfo);
    
    // Report to error service
    errorService.handleError(error, ErrorType.UNKNOWN);
    
    this.setState({ errorInfo });
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Optionally reload the page
    if (this.state.error?.message.includes('chunk')) {
      window.location.reload();
    }
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <div className="text-center">
              <div className="mb-4">
                <div className="text-6xl mb-4">😕</div>
                <h1 className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
                  Oops! Something went wrong
                </h1>
                <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-4">
                  We're sorry, but something unexpected happened. Please try refreshing the page.
                </p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-800 dark:hover:text-warm-gray-200">
                    Error details
                  </summary>
                  <pre className="mt-2 p-2 bg-warm-gray-100 dark:bg-warm-gray-800 rounded text-xs overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleReset} variant="primary">
                  Try Again
                </Button>
                <Button onClick={() => window.location.href = '/'} variant="ghost">
                  Go Home
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default GlobalErrorBoundary;