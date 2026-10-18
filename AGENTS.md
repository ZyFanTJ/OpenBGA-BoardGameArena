# Repository working agreements

- Keep game rules under `packages/games/<id>` and game UI under `apps/web/games/<id>`. Platform services must not import a particular game's rules.
- Room membership, sessions, chat, transport, and persistence have distinct owners. Add a new module only when it has a concrete responsibility.
- A game state is authoritative server data. Every client response and push must use its player-specific `view`; never send full state and hide it with CSS.
- Game transitions must not mutate their input or perform I/O. Inject randomness and keep state JSON-serializable.
- All state-changing room commands must validate the current revision inside the same transaction as persistence.
- Do not silently mix CABO editions or house rules. Document any interpretation of ambiguous rules in `docs/cabo-rules.md`.
- Run `npm test` after rule, platform, or protocol changes. For UI flows, verify the affected flow in the browser; reload after edits.
- Never commit `.data`, session tokens, game snapshots, or generated browser test data. Keep scratch artifacts under `work/`.
- Bump the game's state version and provide a migration before changing the shape of persisted game state.
