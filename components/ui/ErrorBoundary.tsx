'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  errorCode: string;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private lastAction: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCode: '', retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate redacted error code (no PII)
    const errorCode = `ERR_${Date.now().toString(36).toUpperCase().slice(-6)}`;
    console.error('BOUNDARY_ERROR', { 
      code: errorCode, 
      path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ts: new Date().toISOString()
    });
    
    return { hasError: true, errorCode, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log additional context without PII
    console.error('BOUNDARY_ERROR_DETAILS', {
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 stack lines only
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 2).join('\n')
    });
  }

  setLastAction = (action: () => void) => {
    this.lastAction = action;
  };

  handleRetry = () => {
    this.setState(prev => ({ 
      hasError: false, 
      errorCode: '', 
      retryCount: prev.retryCount + 1 
    }));
    
    // Execute the last action if available
    if (this.lastAction) {
      setTimeout(() => {
        this.lastAction?.();
      }, 100);
    } else if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>
              <div className="bg-muted p-2 rounded text-sm font-mono">
                Error Code: {this.state.errorCode}
              </div>
              <Button 
                onClick={this.handleRetry}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              {this.state.retryCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Retry attempts: {this.state.retryCount}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook to register actions for retry
export const useErrorBoundary = () => {
  const errorBoundaryRef = React.useRef<ErrorBoundary>(null);
  
  const registerRetryAction = React.useCallback((action: () => void) => {
    if (errorBoundaryRef.current) {
      errorBoundaryRef.current.setLastAction(action);
    }
  }, []);

  return { errorBoundaryRef, registerRetryAction };
};
