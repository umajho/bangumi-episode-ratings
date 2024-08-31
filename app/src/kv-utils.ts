import env from "./env.ts";
import { TokenData, UserID } from "./types.ts";

export async function getUserID(
  kv: Deno.Kv,
  token: string | null,
): Promise<UserID | null> {
  if (!token) return null;

  const tokenResult = await kv.get<TokenData>(env.buildKVKeyToken(token));
  if (!tokenResult.value) return null;

  return tokenResult.value.userID;
}

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
