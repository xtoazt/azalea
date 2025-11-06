// Resilience utilities - ensure the app always works

/**
 * Ensure a function always returns a value, even on error
 */
export function ensureValue<T>(
  fn: () => T,
  fallback: T,
  errorMessage?: string
): T {
  try {
    const result = fn();
    // Check for null/undefined
    if (result === null || result === undefined) {
      return fallback;
    }
    return result;
  } catch (error) {
    if (errorMessage) {
      console.warn(errorMessage, error);
    }
    return fallback;
  }
}

/**
 * Ensure async function always resolves
 */
export async function ensureAsyncValue<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  try {
    const result = await fn();
    if (result === null || result === undefined) {
      return fallback;
    }
    return result;
  } catch (error) {
    if (errorMessage) {
      console.warn(errorMessage, error);
    }
    return fallback;
  }
}

/**
 * Safe element query with retry
 */
export async function safeQuerySelector(
  selector: string,
  maxRetries: number = 10,
  retryDelay: number = 100
): Promise<HTMLElement | null> {
  for (let i = 0; i < maxRetries; i++) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  return null;
}

/**
 * Safe element query all with retry
 */
export async function safeQuerySelectorAll(
  selector: string,
  maxRetries: number = 10,
  retryDelay: number = 100
): Promise<NodeListOf<HTMLElement>> {
  for (let i = 0; i < maxRetries; i++) {
    const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
    if (elements.length > 0) {
      return elements;
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  return document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
}

/**
 * Wait for element to exist
 */
export async function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        return;
      }
      
      setTimeout(check, 50);
    };
    
    check();
  });
}

/**
 * Safe property access
 */
export function safeGet<T>(obj: any, path: string, fallback: T): T {
  try {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) {
        return fallback;
      }
      current = current[key];
    }
    return current !== undefined && current !== null ? current : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Create a circuit breaker
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

