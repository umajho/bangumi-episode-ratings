export type EntrypointStore = ReturnType<typeof createEntryPointStore>;

export function createEntryPointStore(opts: {
  defaultAuthEntrypoint: string;
  defaultApiEntrypoint: string;
}) {
  return {
    get authEntrypoint(): string {
      return opts.defaultAuthEntrypoint;
    },
    get apiEntrypoint(): string {
      return opts.defaultApiEntrypoint;
    },
  };
}
