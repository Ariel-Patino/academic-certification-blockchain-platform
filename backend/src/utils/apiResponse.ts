// Standard response helpers used by controllers and error middleware.
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: {
    code?: string;
    details?: unknown;
  };
}

export const createSuccessResponse = <T>(message: string, data?: T): ApiSuccessResponse<T> => ({
  success: true,
  message,
  data
});

export const createErrorResponse = (
  message: string,
  error?: ApiErrorResponse["error"]
): ApiErrorResponse => ({
  success: false,
  message,
  ...(error ? { error } : {})
});

// Kept for compatibility with existing controllers.
export const createApiResponse = createSuccessResponse;
