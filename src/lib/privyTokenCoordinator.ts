type TokenOperation = () => Promise<string | null>;

/** In-flight coordination only: never store a token or replay a mutation. */
export function createPrivyTokenCoordinator(read: TokenOperation, refresh: TokenOperation) {
  let epoch = 0;
  let active = true;
  let reading: Promise<string | null> | null = null;
  let refreshing: Promise<string | null> | null = null;

  function start(operation: TokenOperation, previous?: Promise<string | null> | null) {
    const version = epoch;
    return (async () => {
      if (previous) await previous.catch(() => null);
      if (version !== epoch) return null;
      try {
        const token = await operation();
        return version === epoch ? token : null;
      } catch (error) {
        if (version !== epoch) return null;
        throw error;
      }
    })();
  }

  return {
    read() {
      if (!active) return Promise.resolve(null);
      if (refreshing) return refreshing;
      if (reading) return reading;
      const operation = start(read);
      reading = operation;
      void operation.finally(() => { if (reading === operation) reading = null; }).catch(() => {});
      return operation;
    },
    refresh() {
      if (!active) return Promise.resolve(null);
      if (refreshing) return refreshing;
      const operation = start(refresh, reading);
      refreshing = operation;
      void operation.finally(() => { if (refreshing === operation) refreshing = null; }).catch(() => {});
      return operation;
    },
    activate() { active = true; },
    invalidate() { active = false; epoch++; reading = null; refreshing = null; },
  };
}
