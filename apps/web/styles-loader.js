const pending = new Map();

/** Share stylesheet requests and wait for styling before rendering a new surface. */
export function loadStyles(paths) {
  return Promise.all(paths.map(path => {
    if (!pending.has(path)) {
      const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = path;
        link.onload = resolve;
        link.onerror = () => { link.remove(); reject(new Error('页面样式加载失败，请重试')); };
        // Surface overrides follow the common base; preserve order within each group.
        document.head.append(link);
      }).catch(error => { pending.delete(path); throw error; });
      pending.set(path, promise);
    }
    return pending.get(path);
  }));
}
