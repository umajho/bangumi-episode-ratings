import { renderToString } from "https://esm.sh/react-dom@18.3.1/server";
import React, { FC } from "https://esm.sh/react@18.3.1";

import { APIErrorResponse, APIOkResponse, ErrorName } from "./shared/dto.ts";

export function makeErrorResponse(
  name: ErrorName,
  message: string,
  opts: { isForAPI: boolean },
): string {
  if (opts.isForAPI) {
    return makeErrorResponseForAPI(name, message);
  } else {
    return makeErrorResponseForPage(name, message);
  }
}

export function makeErrorResponseForPage(
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

export function makeErrorResponseForAPI(
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

export function makeOkResponseForAPI<T>(data: T): string {
  return JSON.stringify(["ok", data] satisfies APIOkResponse<T>);
}
