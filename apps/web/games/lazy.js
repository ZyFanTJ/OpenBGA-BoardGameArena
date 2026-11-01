/** Keep the platform entry light; create a game UI only when a table needs it. */
export function lazyRenderer(load) {
  let factory, loading;
  function loadFactory() {
    loading ??= load().then(value => { factory = value; return value; }).catch(error => { loading = null; throw error; });
    return loading;
  }
  return (send, rerender) => {
    let instance, pending = false, failed = false, generation = 0;
    function start() {
      if (instance || pending) return;
      if (factory) { instance = factory(send, rerender); return; }
      const token = generation; pending = true;
      loadFactory().then(value => {
        if (token !== generation) return;
        pending = false; instance = value(send, rerender); rerender();
      }).catch(() => {
        if (token !== generation) return;
        pending = false; failed = true; rerender();
      });
    }
    return {
      update(container, snapshot, user, options) {
        if (!failed) start();
        if (instance?.update) instance.update(container, snapshot, user, options);
        else if (instance) container.innerHTML = instance.render(snapshot, user);
        else container.innerHTML = failed ? '<div class="game-loading"><p>暂时没能打开牌桌</p><button type="button" data-action="game:retryRenderer">重试</button></div>' : '<p class="game-loading" role="status">正在铺好牌桌…</p>';
      },
      handle(action, target) {
        if (action === 'retryRenderer') { failed = false; rerender(); return; }
        return instance?.handle(action, target);
      },
      beforeOverlay() { instance?.beforeOverlay?.(); },
      afterOverlay() { instance?.afterOverlay?.(); },
      dispose() { generation++; pending = false; failed = false; instance?.dispose?.(); instance = null; },
    };
  };
}
