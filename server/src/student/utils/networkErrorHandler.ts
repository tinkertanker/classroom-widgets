import { errorService, ErrorType } from '../services/ErrorService';

interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff?: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delay: 1000,
  backoff: true
};

export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, delay, backoff } = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error('Retry failed');
}

// Enhanced fetch with error handling
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new NetworkError(
        errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }
    
    return response;
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    
    // Network failure
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError('Network connection failed. Please check your internet.');
    }
    
    throw error;
  }
}

// API client with automatic retry and error handling
export class ApiClient {
  constructor(
    private baseUrl: string = '',
    private defaultOptions: RequestInit = {},
    private retryConfig: Partial<RetryConfig> = {}
  ) {}
  
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, options);
  }
  
  async post<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, {
      ...options,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }
  
  async put<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, {
      ...options,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }
  
  async delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
  
  private async request<T>(
    method: string,
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestOptions: RequestInit = {
      ...this.defaultOptions,
      ...options,
      method
    };
    
    try {
      const response = await retryWithBackoff(
        () => fetchWithErrorHandling(url, requestOptions),
        this.retryConfig
      );
      
      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as any;
      }
    } catch (error) {
      // Handle network errors
      if (error instanceof NetworkError) {
        errorService.handleError(
          errorService.createError(
            ErrorType.NETWORK,
            error.message,
            `HTTP_${error.statusCode}`,
            error.response,
            () => this.request<T>(method, path, options)
          )
        );
      } else {
        errorService.handleError(error as Error, ErrorType.NETWORK);
      }
      
      throw error;
    }
  }
}

// Create default API client
export const apiClient = new ApiClient('/api');