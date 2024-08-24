// see: https://stackoverflow.com/a/60768453
// deno-lint-ignore no-explicit-any
export type ReverseMap<T extends Record<keyof T, keyof any>> = {
  [K in keyof T as T[K]]: K;
};
