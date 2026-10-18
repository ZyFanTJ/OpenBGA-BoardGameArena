export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function ensure(condition, message, status = 400) {
  if (!condition) throw new DomainError(message, status);
}
