import { Parallelism } from './action';

export const parallelismToMaxActive = (parallelism: Parallelism): number => {
  switch (parallelism) {
    case Parallelism.SINGLE:
      return 0;
    case Parallelism.REPLACEABLE:
      return 1;
    case Parallelism.MULTIPLE:
      return Infinity;
  }
};

export const stringifyRotation = (serviceRotation: number, parentServiceRotation?: number): string => {
  // TODO: should be x.0 or 0.x instead?
  if (parentServiceRotation === undefined) {
    return `${serviceRotation}`;
  }
  return `${parentServiceRotation}.${serviceRotation}`;
};
