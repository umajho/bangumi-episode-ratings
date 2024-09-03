# tools

## dump

将数据库 dump 下来，用于简单的备份。

### dump.ts

注意要改 `<PATH_TO_DENO>` 和 `<…>`。

```typescript
#!/usr/bin/env -S <PATH_TO_DENO> --unstable-kv --allow-env --env=.env.dump --allow-net

const kv = await Deno.openKv("https://api.deno.com/databases/<…>/connect");

const data = [];
for await (const result of kv.list({ prefix: [] })) {
  data.push(result);
}

console.log(Deno.inspect(data, {
  colors: false,
  depth: Infinity,
  iterableLimit: Infinity,
  strAbbreviateSize: Infinity,
}));
```

### .env.dump

注意要改标注 `# TODO` 的地方。

```shell
DENO_KV_ACCESS_TOKEN= # TODO
```

### cron

注意要改 `$SOMEWHERE`，还要提前 `mkdir dumped`。

```cron
0 0 * * * cd $SOMEWHERE; ./dump.ts | gzip > dumped/$(date +\%Y-\%m-\%d_\%H_\%M_\%Z).txt.gz
```

要查看的时候用 `zcat`。
