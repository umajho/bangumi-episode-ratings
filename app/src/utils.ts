import { Buffer } from "node:buffer";

export function generateToken(userID: number): string {
  const prefix = (() => { // see: https://stackoverflow.com/a/78574144
    const dv = new DataView(new ArrayBuffer(8));
    dv.setBigUint64(0, BigInt(userID));
    return new Uint8Array(dv.buffer);
  })();

  const random = new Uint8Array(16); // 128 bits.
  crypto.getRandomValues(random);

  const token = new Uint8Array(prefix.length + 1 + random.length);
  token.set(prefix, 0);
  token[prefix.length] = 0;
  token.set(random, prefix.length + 1);

  return Buffer.from(token).toString("base64");
}
