export class DomainError extends Error {
  constructor(message, status = 400, code) { super(message); this.status = status; if(code)this.code=code; }
}
export function ensure(condition, message, status = 400, code) {
  if (!condition) throw new DomainError(message, status, code);
}
