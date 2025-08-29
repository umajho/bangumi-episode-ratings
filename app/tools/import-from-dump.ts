import { importEntries } from "@deno/kv-utils";

const kv = await Deno.openKv(Deno.args[0]);

const dump = await Deno.readTextFile(Deno.args[1]);

await importEntries(kv, dump);
