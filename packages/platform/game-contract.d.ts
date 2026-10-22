/** Game modules must be synchronous, deterministic with injected randomness, and transport-free. */
export interface GameModule<State, Command, View, Options = Record<string, unknown>, Memory = unknown> {
  readonly manifest: { id: string; title: string; rulesVersion: string; minPlayers: number; maxPlayers: number; stateVersion: number; defaultTurnSeconds?: number };
  create(playerIds: string[], options: Options, random: () => number): State;
  /** Return new state; never mutate input. Throw on any illegal command. */
  apply(state: State, playerId: string, command: Command, context: { random: () => number; isHost: boolean }): State;
  /** Explicit allowlist. Never serialize authoritative state to a client. */
  view(state: State, playerId: string, transition?: { before: State | null; actorId: string; command: Command | { type: 'start' } }, presentation?: { effectProgress: unknown }): View;
  isFinished(state: State): boolean;
  /** Opt-in independent submission window. Null for sequential/already submitted
   * actions. Include phase/round discriminators; apply() still validates legality. */
  submissionKey?(state: State, playerId: string, command?: Command): string | null;
  /** Small player-specific view patch. Never return provider input or raw progress. */
  presentation?(state: State, playerId: string, context: { effectProgress: unknown }): Partial<View>;
  /** Pure server-only request projection. Never include this in a player view. */
  effect?(state: State): { id: string; kind: string; local?: boolean; input: unknown } | null;
  /** Internal completion, not a player command. Validate untrusted provider output here. */
  applyEffect?(state: State, effectId: string, result: { source: 'ai' | 'local' | 'fallback'; value: unknown }, context: { random: () => number }): State;
  /** Game-owned pure migration. Bootstrap persists it atomically before recovery. */
  migrate?(state: unknown, fromVersion: number): State;
  /** Final public summary only. Must not contain cards, hands, decks or full state. */
  result?(state: State): { winners: string[]; rounds?: number; scoreDirection?: 'lower' | 'higher'; players: { id: string; score: number; rank: number; breakdown?: { label: string; value: number }[] }[] };
  /** Public decision window. Same key spans intermediate actions of a complete turn. */
  turn?(state: State): {key: string; players: string[]} | null;
  /** One legal timeout step, using only the affected player's redacted view. */
  timeout?(view: View, playerId: string): Command | null;
  /** Optional local AI: receives only its own view. Memory is ephemeral, never part of game state. */
  bot?: {
    observe(view: View, playerId: string, previous?: Memory, ownCommand?: Command | null): Memory;
    /** Return null when waiting. No I/O, timers or authoritative state access. */
    decide(view: View, playerId: string, memory: Memory): Command | null;
  };
}
