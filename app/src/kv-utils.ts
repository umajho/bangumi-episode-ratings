export function sumFreely(
  tx: Deno.AtomicOperation,
  key: Deno.KvKey,
  value: bigint,
): Deno.AtomicOperation {
  if (value === 0n) return tx;

  if (value < 0n) {
    value = (1n << 64n) + value;
  }

  return tx.sum(key, value);
}
