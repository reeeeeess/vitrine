import { describe, expect, it } from "vitest";
import { authorizeUrl, challengeFor, createPkcePair, isClientId, parseTokenResponse, REDIRECT_URI } from "../electron/pkce";

describe("PKCE", () => {
  it("derives the S256 challenge of RFC 7636's example", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes url-safe verifiers of the allowed length", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(challengeFor(verifier));
  });

  it("builds the authorize URL", () => {
    const url = new URL(authorizeUrl("a".repeat(32), "challenge", "state"));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("streaming");
  });

  it("checks Client IDs", () => {
    expect(isClientId("0123456789abcdef0123456789ABCDEF")).toBe(true);
    expect(isClientId("not-a-client-id")).toBe(false);
  });
});

describe("token responses", () => {
  it("keeps the previous refresh token when Spotify does not rotate it", () => {
    const tokens = parseTokenResponse({ access_token: "new", expires_in: 3600 }, "id", "old-refresh", 1000);
    expect(tokens).toEqual({ clientId: "id", accessToken: "new", refreshToken: "old-refresh", expiresAt: 3_601_000 });
  });

  it("takes a rotated refresh token", () => {
    expect(parseTokenResponse({ access_token: "a", refresh_token: "r2", expires_in: 10 }, "id", "r1").refreshToken).toBe("r2");
  });

  it("rejects incomplete responses", () => {
    expect(() => parseTokenResponse({ error_description: "invalid client" }, "id")).toThrow(/invalid client/);
  });
});
