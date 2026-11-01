/** Navigation owns cancellation; imports can finish without reopening an abandoned page. */
export function lazySurface(load) {
  let instance, pending, generation = 0, opening = false;
  return {
    get active() { return opening || !!instance?.active; },
    async open(...args) {
      const token = ++generation; opening = true;
      try {
        pending ??= load().then(value => (instance = value)).catch(error => { pending = null; throw error; });
        const surface = await pending;
        if (token === generation) return await surface.open(...args);
      } finally { if (token === generation) opening = false; }
    },
    dispose() { generation++; opening = false; instance?.dispose(); },
    handle(...args) { return instance?.handle(...args); },
    submit(...args) { return instance?.submit(...args); },
    change(...args) { return instance?.change?.(...args); },
    input(...args) { return instance?.input?.(...args); },
  };
}
