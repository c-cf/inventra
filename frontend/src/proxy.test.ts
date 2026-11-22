// @vitest-environment node
import { NextRequest } from "next/server";
import {
  getRedirectUrl,
  isRewrite,
  unstable_doesProxyMatch,
} from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import { config, proxy } from "@/proxy";

function requestFor(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it.each(["/products", "/products/7", "/orders", "/orders/new", "/orders/3", "/users", "/account"])(
    "guards %s",
    (url) => {
      expect(unstable_doesProxyMatch({ config, nextConfig, url })).toBe(true);
    },
  );

  it.each(["/login", "/_next/static/chunk.js", "/favicon.ico"])("leaves %s alone", (url) => {
    expect(unstable_doesProxyMatch({ config, nextConfig, url })).toBe(false);
  });

  it("sends a request without a session cookie to /login", () => {
    const response = proxy(requestFor("/orders/3"));

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/login");
  });

  it("lets a request with a session cookie through to the page", () => {
    const response = proxy(requestFor("/orders/3", "inventra_session=some.jwt.value"));

    expect(getRedirectUrl(response)).toBeNull();
    expect(isRewrite(response)).toBe(false);
  });
});
