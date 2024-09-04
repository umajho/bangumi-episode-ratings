import { importEntries } from "jsr:@kitsonk/kv-toolbox/ndjson";

const kv = await Deno.openKv(Deno.args[0]);

const dump = await Deno.readTextFile(Deno.args[1]);

importEntries(kv, dump);
