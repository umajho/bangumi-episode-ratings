import { renderToString } from "https://esm.sh/react-dom@18.3.1/server";
import React, { FC } from "https://esm.sh/react@18.3.1";

import {
  APIErrorResponse,
  APIOkResponse,
  APIResponse,
  ErrorName,
} from "./shared/dto.ts";

export function stringifyErrorResponse(
  name: ErrorName,
  message: string,
  opts: { isForAPI: boolean },
): string {
  if (opts.isForAPI) {
    return stringifyErrorResponseForAPI(name, message);
  } else {
    return stringifyErrorResponseForPage(name, message);
  }
}

export function stringifyErrorResponseForPage(
  name: ErrorName,
  message: string,
): string {
  return renderToString(
    <Layout>
      <h1>Error: {name}</h1>
      <p>{message}</p>
    </Layout>,
  );
}

export function stringifyErrorResponseForAPI(
  name: ErrorName,
  message: string,
): string {
  return JSON.stringify(["error", name, message] satisfies APIErrorResponse);
}

const Layout: FC<{ children: React.ReactNode }> = (props) => {
  return (
    <html>
      <body>{props.children}</body>
    </html>
  );
};

export function stringifyOkResponseForAPI<T>(data: T): string {
  return JSON.stringify(["ok", data] satisfies APIOkResponse<T>);
}

export function stringifyResponseForAPI<T>(resp: APIResponse<T>) {
  if (resp[0] === "ok") {
    return stringifyOkResponseForAPI(resp[1]);
  } else if (resp[0] === "error") {
    return stringifyErrorResponseForAPI(resp[1], resp[2]);
  } else if (resp[0] === "auth_required") {
    return stringifyErrorResponseForAPI(
      "AUTH_REQUIRED",
      "尚未将账号关联至应用。",
    );
  }
  resp satisfies never;
}
