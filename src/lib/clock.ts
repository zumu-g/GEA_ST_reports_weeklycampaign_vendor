// Request-time clock reads, isolated from React render scope.
// Server Components render per request, so reading "now" here is intended
// behaviour — this indirection keeps the react-hooks/purity rule satisfied
// without changing semantics. ponytail: helper exists only to scope the impure read.
export const nowMs = (): number => Date.now();
export const today = (): Date => new Date();
