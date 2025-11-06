// Comprehensive error handling utilities
// Ensures the application always works, even when things fail

export interface ErrorContext {
  component: string;
  operation: string;
  details?: any;
}

export class ErrorHandler {
  private static errorHistory: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private static maxHistorySize = 100;

  /**
   * Handle an error gracefully with context
   */
  static handle(error: unknown, context: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Log error with context
    console.error(`[${context.component}] ${context.operation} failed:`, err, context.details);
    
    // Store in history
    this.errorHistory.push({
      error: err,
      context,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
    
    // Don't throw - let the caller decide how to handle
  }

  /**
   * Wrap an async function with error handling
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: ErrorContext
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, context);
        throw error; // Re-throw for caller to handle
      }
    }) as T;
  }

  /**
   * Wrap a sync function with error handling
   */
  static wrapSync<T extends (...args: any[]) => any>(
    fn: T,
    context: ErrorContext
  ): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handle(error, context);
        throw error;
      }
    }) as T;
  }

  /**
   * Safe async execution with fallback
   */
  static async safeExecute<T>(
    fn: () => Promise<T>,
    fallback: T,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      return fallback;
    }
  }

  /**
   * Safe sync execution with fallback
   */
  static safeExecuteSync<T>(
    fn: () => T,
    fallback: T,
    context: ErrorContext
  ): T {
    try {
      return fn();
    } catch (error) {
      this.handle(error, context);
      return fallback;
    }
  }

  /**
   * Get error history
   */
  static getHistory(): Array<{ error: Error; context: ErrorContext; timestamp: number }> {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  static clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if a specific error type occurred recently
   */
  static hasRecentError(
    component: string,
    operation?: string,
    withinMs: number = 60000
  ): boolean {
    const cutoff = Date.now() - withinMs;
    return this.errorHistory.some(
      entry =>
        entry.context.component === component &&
        (!operation || entry.context.operation === operation) &&
        entry.timestamp > cutoff
    );
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (context) {
        ErrorHandler.handle(error, { ...context, operation: `${context.operation} (attempt ${attempt + 1})` });
      }
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context?: ErrorContext
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Operation timed out after ${timeoutMs}ms`);
      if (context) {
        ErrorHandler.handle(error, context);
      }
      reject(error);
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}

/**
 * Safe DOM operation
 */
export function safeDOMOperation<T>(
  operation: () => T,
  fallback: T,
  context: ErrorContext
): T {
  try {
    return operation();
  } catch (error) {
    ErrorHandler.handle(error, context);
    return fallback;
  }
}

