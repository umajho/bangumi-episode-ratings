#!/usr/bin/env -S <PATH_TO_DENO> --unstable-kv --allow-env --env=.env --allow-net

import { exportEntries } from "@deno/kv-utils";

const kv = await Deno.openKv();

const stream = exportEntries(kv, { start: [4], end: [Infinity] });

for await (const line of stream) {
  Deno.stdout.writeSync(line);
}
