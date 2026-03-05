export class SaveError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SaveError";
    this.status = status;
  }

  get isRetryable(): boolean {
    return this.status === 0 || this.status === 500 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}
