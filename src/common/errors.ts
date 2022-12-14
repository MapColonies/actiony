export interface HttpError extends Error {
  status?: number;
}

export class TimeoutError extends Error {}
