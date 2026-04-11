import { createSignal, untrack } from "solid-js";

export type AuthStore = ReturnType<typeof createAuthStore>;

export function createAuthStore() {
  const [token, setToken] = createSignal<string | null>(null);

  return {
    get token(): string | null {
      return untrack(token);
    },
    get tokenTracked(): string | null {
      return token();
    },
    set token(newValue: string | null) {
      setToken(newValue);
    },
  };
}
