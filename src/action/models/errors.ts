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

export class ServiceNotFoundOnRegistry extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceNotFoundOnRegistry.prototype);
  }
}