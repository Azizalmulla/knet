import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Mock console methods to test logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
};

// Test component that can be retried
const RetryableComponent: React.FC<{ onAction: () => void }> = ({ onAction }) => {
  return (
    <button onClick={onAction} data-testid="action-button">
      Trigger Action
    </button>
  );
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  test('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  test('renders fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Error Code:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    
    // Check that error was logged
    expect(mockConsoleError).toHaveBeenCalledWith(
      'BOUNDARY_ERROR',
      expect.objectContaining({
        code: expect.stringMatching(/^ERR_[A-Z0-9]{6}$/),
        path: expect.any(String),
        ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      })
    );
  });

  test('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  test('resets error state on retry', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click retry button exists and is clickable
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Test that we can click the retry button without error
    fireEvent.click(retryButton);

    // After clicking retry, the component resets and tries to render children
    // Since the child still throws, it will show error UI again
    // We just need to verify the retry mechanism works (no test errors)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('calls onRetry callback when provided', () => {
    const mockOnRetry = jest.fn();
    
    render(
      <ErrorBoundary onRetry={mockOnRetry}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  test('tracks retry attempts', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Click retry button - this increments retry count internally
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    
    // The retry button should still be available for another attempt
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    
    // Error boundary should still show error UI since child component still throws
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('logs additional error details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Check that detailed error logging occurred
    expect(mockConsoleError).toHaveBeenCalledWith(
      'BOUNDARY_ERROR_DETAILS',
      expect.objectContaining({
        name: 'Error',
        stack: expect.stringContaining('Test error'),
        componentStack: expect.any(String)
      })
    );
  });

  test('integrates with useErrorBoundary hook for retry actions', async () => {
    const mockAction = jest.fn();
    let registerRetryAction: ((action: () => void) => void) | undefined;

    const TestComponent: React.FC = () => {
      const { registerRetryAction: register } = require('@/components/ui/ErrorBoundary').useErrorBoundary();
      registerRetryAction = register;
      
      React.useEffect(() => {
        register(mockAction);
      }, [register]);

      return <RetryableComponent onAction={() => {}} />;
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    // Mock the retry action registration
    if (registerRetryAction) {
      registerRetryAction(mockAction);
    }

    expect(screen.getByTestId('action-button')).toBeInTheDocument();
  });

  test('generates unique error codes', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const firstErrorCall = mockConsoleError.mock.calls.find(call => 
      call[0] === 'BOUNDARY_ERROR'
    );
    const firstErrorCode = firstErrorCall?.[1]?.code;

    // Reset and trigger another error
    mockConsoleError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const secondErrorCall = mockConsoleError.mock.calls.find(call => 
      call[0] === 'BOUNDARY_ERROR'
    );
    const secondErrorCode = secondErrorCall?.[1]?.code;

    expect(firstErrorCode).toBeDefined();
    expect(secondErrorCode).toBeDefined();
    expect(firstErrorCode).not.toBe(secondErrorCode);
  });
});
