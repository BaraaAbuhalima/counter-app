const locks: Map<string, Promise<unknown>> = new Map();

export async function withLock<T>(
  key: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();

  // Create a new chained promise so operations for the same key run sequentially
  const next = prev
    .then(() => Promise.resolve().then(fn))
    .catch((err) => {
      // prevent the chain from breaking on error
      throw err;
    });

  locks.set(key, next);

  try {
    const result = await next;
    return result;
  } finally {
    // clear lock if this is the last in chain
    if (locks.get(key) === next) locks.delete(key);
  }
}

export default withLock;
