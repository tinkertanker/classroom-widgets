import React, { Component, ReactNode } from 'react';
import { ErrorBoundaryState } from '../../types/ui.types';
import Card from './Card';
import Button from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };
  
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.resetError);
      }
      
      return (
        <Card className="m-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.resetError} variant="primary" size="sm">
              Try Again
            </Button>
          </div>
        </Card>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;