FROM denoland/deno:alpine-1.46.2

EXPOSE 80

WORKDIR /app

COPY deno.json deno.lock import_map.json main.ts /app/
COPY ./src /app/src

RUN deno cache main.ts

CMD ["run", "--unstable-kv", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "main.ts"]