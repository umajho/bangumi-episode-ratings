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
    group: "auth" | "api",
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

  buildFullEndpoint(group: "auth" | "api", endpointPath: string): string {
    return join(join(this.entrypoint, group + "/"), endpointPath);
  }

  async redeemTokenCoupon(tokenCoupon: string): Promise<string | null> {
    const data = await this.fetch(
      "auth",
      ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON,
      {
        method: "POST",
        body: JSON.stringify({ tokenCoupon }),
      },
    );

    if (data[0] === "error") throw new Error(data[2]);
    return data[1] as string | null;
  }

  async whoami(): Promise<number | null> {
    if (!this.token) return null;

    const data = await this.fetch("api", ENDPOINT_PATHS.API.WHOAMI, {
      method: "GET",
    });

    if (data[0] === "error") throw new Error(data[2]);
    return data[1] as number | null;
  }
}

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}
