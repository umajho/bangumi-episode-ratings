import { APIErrorResponse, APIOkResponse } from "./shared/dto";
import ENDPOINT_PATHS from "./shared/endpoint-paths";

export class Client {
  public readonly entrypoint: string;
  public token: string | null;

  constructor(
    opts: {
      entrypoint: string;
      token: string | null;
    },
  ) {
    this.entrypoint = opts.entrypoint;
    this.token = opts.token;
  }

  get URL_AUTH_BANGUMI_PAGE(): string {
    return this.buildFullEndpoint("auth", ENDPOINT_PATHS.AUTH.BANGUMI_PAGE);
  }

  async fetch(
    group: "auth" | "api" | "api/dev",
    endpointPath: string,
    opts: { method: "GET" | "POST"; body?: string },
  ): Promise<APIOkResponse<unknown> | APIErrorResponse> {
    const url = this.buildFullEndpoint(group, endpointPath);

    const headers = new Headers();
    if (this.token) {
      headers.set("Authorization", `Basic ${this.token}`);
    }

    const resp = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body,
    });

    return await resp.json();
  }

  buildFullEndpoint(
    group: "auth" | "api" | "api/dev",
    endpointPath: string,
  ): string {
    return join(join(this.entrypoint, group + "/"), endpointPath);
  }

  async mustRedeemTokenCoupon(tokenCoupon: string): Promise<string | null> {
    const data = await this.fetch(
      "auth",
      ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON,
      {
        method: "POST",
        body: JSON.stringify({ tokenCoupon }),
      },
    );
    return unwrap(data);
  }

  async mustGetWhoami(): Promise<number | null> {
    if (!this.token) return null;

    const data = await this.fetch("api/dev", ENDPOINT_PATHS.API.DEV.WHOAMI, {
      method: "GET",
    });
    return unwrap(data);
  }
}

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

function unwrap<T>(resp: APIOkResponse<T> | APIErrorResponse | unknown): T {
  if (!Array.isArray(resp) || (resp[0] !== "ok" && resp[0] !== "error")) {
    console.error("Unsupported response", resp);
    throw new Error(`Unsupported response: ${JSON.stringify(resp)}`);
  }

  if (resp[0] === "error") throw new Error(resp[2]);
  return resp[1];
}
