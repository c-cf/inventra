/**
 * Loads for `latest.current`, and loads again whenever it changed while a request was
 * out, so the answer always belongs to the newest value (for example, the filters a list
 * page has applied by the time its reload comes back).
 */
export async function loadForLatest<K, T>(
  latest: { readonly current: K },
  load: (key: K) => Promise<T>,
): Promise<T> {
  let key: K;
  let result: T;
  do {
    key = latest.current;
    result = await load(key);
  } while (!Object.is(latest.current, key));
  return result;
}
