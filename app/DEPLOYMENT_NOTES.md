# 部署笔记

在此记录我如何在服务器上部署此服务端，方便未来参考。

## VPS 上的反向代理

直接在 VPS 上装了 Caddy，配置文件（`Caddyfile`）内容如下：

```Caddyfile
xn--kbrs5al25jbhj.bgm.zone {
    reverse_proxy :8000

    log {
        output file <路径> # 这里用 `<路径>` 代替实际路径。

        format filter {
            request>remote_ip ip_mask 16 32
            request>remote_port delete
            request>client_ip delete
            # request>proto
            # request>method
            request>host delete
            # request>uri
            request>headers delete
            request>tls delete
            # bytes_read
            user_id delete
            # duration
            # size
            # status
            resp_headers delete
        }
    }
}
```

## Deno Deploy 上的本体 Auth 部分

不在 VPS 上，而是放在 Deno Deploy 上，在迁移到其他地方之前应该是不会有大变动了。

地址是 <https://bgm-ep-ratings.deno.dev>。

环境变量如下（Deno Deploy 不允许查看曾经设置的环境变量，就凭记忆来了）：

| 键                    | 值（为空代表不公开）                                     | 补充说明                                                                |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| API_ROUTE_MODE        | `["forward", "https://xn--kbrs5al25jbhj.bgm.zone/api/"]` | 用于兼容旧版组建                                                        |
| AUTH_ROUTE_MODE       | `["normal"]`                                             |                                                                         |
| BGM_APP_ID            |                                                          |                                                                         |
| BGM_APP_SECRET        |                                                          |                                                                         |
| BGM_HOMEPAGE_URL      | `https://bangumi.tv/`                                    | 新版本还要求存在 `BGM_GADGET_PAGE_PATH`，未来部署新版本时需要注意补上。 |
| ENTRYPOINT_URL        | `https://bgm-ep-ratings.deno.dev`                        | 不确定，不过也不重要。（见本体 API 部分中的说明。）                     |
| JWT_SIGNING_KEY_JWK   |                                                          |                                                                         |
| JWT_VERIFYING_KEY_JWK |                                                          |                                                                         |
| USER_AGENT            |                                                          |                                                                         |

## VPS 上的本体 API 部分

以 Docker 容器的形式放在 VPS 上。

地址是 <https://xn--kbrs5al25jbhj.bgm.zone>（<https://单集评分.bgm.zone>）。

`docker-compose.yml`:

```yaml
services:
  app:
    image: umajho/bangumi-episode-ratings:<版本> # 这里用 `<版本>` 代替实际版本。
    container_name: bangumi-episode-ratings
    restart: always
    ports:
      - "127.0.0.1:8000:80"
    volumes:
      - data:/data
    environment:
      LOG_FILE_PATH: /data/logs/app.log
      KV_PATH: /data/kv.s3db
      AUTH_ROUTE_MODE: '["off"]'
      API_ROUTE_MODE: '["normal"]'
      ENTRYPOINT_URL: https://localhost # 实际上并没有用到，或许应该在之后删掉。
      PORT: 80
      BGM_APP_ID: _ # 只在 AUTH 部分会被使用，这里随便填些什么来占位。（在代码里写死了检查存在懒得改。）
      BGM_APP_SECRET: _ # 同上。
      USER_AGENT_FILE: /run/secrets/USER_AGENT
      BGM_HOMEPAGE_URL: https://bangumi.tv/
      BGM_GADGET_PAGE_PATH: /dev/app/3263
      # JWT_SIGNING_KEY_JWK_FILE: /run/secrets/JWT_SIGNING_KEY_JWK # 只在 AUTH 部分会被使用，这里不提供。
      JWT_VERIFYING_KEY_JWK_FILE: /run/secrets/JWT_VERIFYING_KEY_JWK
    secrets:
      - USER_AGENT
      # - JWT_SIGNING_KEY_JWK
      - JWT_VERIFYING_KEY_JWK

  # 省略非本体服务…
  # 会在后面的子章节中说明。

volumes:
  data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data

secrets:
  USER_AGENT:
    file: ./secrets/USER_AGENT.txt
  # JWT_SIGNING_KEY_JWK:
  #   file: ./secrets/JWT_SIGNING_KEY_JWK.json
  JWT_VERIFYING_KEY_JWK:
    file: ./secrets/JWT_VERIFYING_KEY_JWK.json
```

### Chrome 远程除错

1. 更新 `docker-compose.yml`（变化部分）：

   ```yaml
   services:
     app:
       ports:
         - "127.0.0.1:9229:9229"
       command: ["run", "--inspect-brk=0.0.0.0:9229", "--unstable-kv", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "main.ts"]
   ```

2. 端口转发：

   ```sh
   ssh -N -L 127.0.0.1:9229:127.0.0.1:9229 <用户名>@<IP> # 这里用 `<用户名>`、`<IP>` 代替实际内容。
   ```
3. `chrome://inspect`，略。

### 备份

`docker-compose.yml`（先前省略部分）：

```yaml
services:
    # see: https://github.com/mattn/litestream-sidecar-example/blob/main/docker-compose.yaml
  litestream:
    image: litestream/litestream:0.3.13
    container_name: bangumi-episode-ratings-litestream
    restart: always
    depends_on:
      - app
    volumes:
      - data:/data
      - ./litestream.yml:/opt/litestream/litestream.yml
    extra_hosts:
      - "host.docker.internal:host-gateway"
    entrypoint: /bin/sh
    command: -c "/usr/local/bin/litestream replicate --config /opt/litestream/litestream.yml"
    secrets:
      - BACKUP_SFTP_SSH_KEY

secrets:
  BACKUP_SFTP_SSH_KEY:
    file: ./secrets/bangumi_episode_ratings_backup.id_ed25519
```

`litestream.yml`:

```yaml
dbs:
  - path: /data/kv.s3db
    replicas:
      - url: sftp://bangumi_episode_ratings_backup@<host>/backup/kv.s3db # 这里用 `<host>` 代替实际上备份到的另一台主机。
        key-path: /run/secrets/BACKUP_SFTP_SSH_KEY
```

另一台主机创建 SFTP 专用用户、配置路径映射等事项就不再赘述了。
