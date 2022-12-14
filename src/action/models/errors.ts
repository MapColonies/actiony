export class ActionNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ActionNotFoundError.prototype);
  }
}

export class ActionAlreadyClosedError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ActionAlreadyClosedError.prototype);
  }
}

export class ServiceNotRecognizedByRegistry extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceNotRecognizedByRegistry.prototype);
  }
}

export class ParallelismMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ParallelismMismatchError.prototype);
  }
}
