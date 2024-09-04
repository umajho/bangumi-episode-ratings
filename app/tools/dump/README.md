# tools/dump

将数据库 dump 下来，用于简单的备份。

## dump.ts

注意要改 `<PATH_TO_DENO>`。

## .env

以 `.env.template` 作为模板。

## cron

注意要改 `$SOMEWHERE`，还要提前 `mkdir dumped`。

```cron
0 0 * * * cd $SOMEWHERE; ./dump.ts | gzip > dumped/$(date +\%Y-\%m-\%d_\%H_\%M_\%Z).jsonl.gz
```

要查看的时候用 `zcat`。
