import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      eventId: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info for display
    this.setState({ errorInfo });
    
    // Log to backend (optional - can be enhanced with error tracking service)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // Log error details for debugging
    const errorData = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    
    console.error('Error details:', errorData);
    
    // Could send to backend error logging endpoint
    // fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorData) });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-b from-[#F8F7F4] to-[#F0EFEB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center" data-testid="error-boundary-fallback">
            {/* Error Icon */}
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            {/* Error Message */}
            <h1 className="font-serif text-2xl text-[#264653] mb-3">
              Oops! Something went wrong
            </h1>
            <p className="text-[#6B705C] mb-6">
              We're sorry, but something unexpected happened. Don't worry, your data is safe.
            </p>
            
            {/* Error Details (collapsed by default) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left bg-gray-50 rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                  Technical Details
                </summary>
                <div className="mt-2 text-xs text-red-600 font-mono overflow-auto max-h-40">
                  <p className="font-semibold">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="mt-2 whitespace-pre-wrap text-gray-500">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2A9D8F] text-white rounded-xl font-medium hover:bg-[#238b7e] transition-colors"
                data-testid="error-retry-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#F0EFEB] text-[#264653] rounded-xl font-medium hover:bg-[#E0DCD3] transition-colors"
                data-testid="error-home-btn"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
            
            {/* Reload option */}
            <button
              onClick={this.handleReload}
              className="mt-4 text-sm text-[#6B705C] hover:text-[#2A9D8F] transition-colors underline"
              data-testid="error-reload-btn"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for functional components to trigger error boundary
 */
export function useErrorHandler() {
  const [error, setError] = React.useState(null);
  
  if (error) {
    throw error;
  }
  
  return React.useCallback((e) => {
    setError(e);
  }, []);
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary(Component, fallback = null) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
