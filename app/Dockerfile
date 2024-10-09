FROM denoland/deno:alpine-2.0.0

EXPOSE 80

WORKDIR /app

COPY deno.json deno.lock import_map.json /app/

RUN deno install

COPY main.ts /app/
COPY ./src /app/src

RUN deno cache main.ts

CMD ["run", "--unstable-kv", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "main.ts"]