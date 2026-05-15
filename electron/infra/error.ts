export type ApiErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError('INTERNAL', err.message);
  return new ApiError('INTERNAL', 'Unknown error');
}
