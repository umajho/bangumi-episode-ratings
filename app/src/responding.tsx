import { Context } from "hono";
import type { FC } from "hono/jsx";

import {
  APIErrorResponse,
  APIOkResponse,
  APIResponse,
  ErrorName,
} from "./shared/dto.ts";

export function respondWithError(
  ctx: Context,
  name: ErrorName,
  message: string,
  opts: { isForAPI: boolean },
) {
  if (opts.isForAPI) {
    return respondWithErrorForAPI(ctx, name, message);
  } else {
    return respondWithErrorForPage(ctx, name, message);
  }
}

export function respondWithErrorForPage(
  ctx: Context,
  name: ErrorName,
  message: string,
) {
  return ctx.html(
    <Layout>
      <h1>Error: {name}</h1>
      <p>{message}</p>
    </Layout>,
  );
}

const Layout: FC = (props) => {
  return (
    <html>
      <body>{props.children}</body>
    </html>
  );
};

function respondWithErrorForAPI(
  ctx: Context,
  name: ErrorName,
  message: string,
) {
  return ctx.json(["error", name, message] satisfies APIErrorResponse);
}

function respondWithOkForAPI<T>(ctx: Context, data: T) {
  return ctx.json(["ok", data] satisfies APIOkResponse<T>);
}

export function makeErrorAuthRequiredResponse(): APIErrorResponse {
  return ["error", "AUTH_REQUIRED", "尚未将账号关联至应用。"];
}

export function respondForAPI<T>(ctx: Context, resp: APIResponse<T>) {
  if (resp[0] === "ok") {
    return respondWithOkForAPI(ctx, resp[1]);
  } else if (resp[0] === "error") {
    return respondWithErrorForAPI(ctx, resp[1], resp[2]);
  }
  resp satisfies never;
  throw new Error("unreachable");
}
