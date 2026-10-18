/** Game modules must be synchronous, deterministic with injected randomness, and transport-free. */
export interface GameModule<State, Command, View, Options = Record<string, unknown>, Memory = unknown> {
  readonly manifest: { id: string; title: string; rulesVersion: string; minPlayers: number; maxPlayers: number; stateVersion: number };
  create(playerIds: string[], options: Options, random: () => number): State;
  /** Return new state; never mutate input. Throw on any illegal command. */
  apply(state: State, playerId: string, command: Command, context: { random: () => number; isHost: boolean }): State;
  /** Explicit allowlist. Never serialize authoritative state to a client. */
  view(state: State, playerId: string, transition?: { before: State | null; actorId: string; command: Command | { type: 'start' } }): View;
  isFinished(state: State): boolean;
  /** Optional local AI: receives only its own view. Memory is ephemeral, never part of game state. */
  bot?: {
    observe(view: View, playerId: string, previous?: Memory, ownCommand?: Command | null): Memory;
    /** Return null when waiting. No I/O, timers or authoritative state access. */
    decide(view: View, playerId: string, memory: Memory): Command | null;
  };
}
