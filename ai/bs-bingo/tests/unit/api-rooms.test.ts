/**
 * Unit tests for POST /api/rooms and GET /api/rooms/[code]/exists (TDD RED phase).
 *
 * We import the SvelteKit +server.ts handlers directly and invoke them with
 * mock RequestEvent objects so we can test without wrangler running.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared alphabet for assertions
// ---------------------------------------------------------------------------

const ROOM_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// ---------------------------------------------------------------------------
// POST /api/rooms
// ---------------------------------------------------------------------------

describe("POST /api/rooms", () => {
  it("returns 200 JSON with a valid code and shareUrl when DO is fresh (returns !ok)", async () => {
    // Stub: mock GameRoom stub fetch → returns !ok (room does not exist yet)
    const stubFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const mockStub = { fetch: stubFetch };
    const mockGameRoom = {
      get: vi.fn().mockReturnValue(mockStub),
      idFromName: vi.fn((name: string) => name),
    };

    const { POST } = await import("../../src/routes/api/rooms/+server.js");

    const mockUrl = new URL("http://localhost/api/rooms");
    const event = {
      platform: { env: { GameRoom: mockGameRoom } },
      url: mockUrl,
      request: new Request("http://localhost/api/rooms", { method: "POST" }),
    } as never;

    const response = await POST(event);
    expect(response.status).toBe(200);

    const body = await response.json() as { code: string; shareUrl: string };
    expect(body.code).toMatch(ROOM_CODE_RE);
    expect(body.shareUrl).toBe(`http://localhost/join/${body.code}`);
  });

  it("shareUrl uses request origin", async () => {
    const stubFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const mockGameRoom = {
      get: vi.fn().mockReturnValue({ fetch: stubFetch }),
      idFromName: vi.fn((name: string) => name),
    };

    const { POST } = await import("../../src/routes/api/rooms/+server.js");

    const mockUrl = new URL("https://bsbingo.example.com/api/rooms");
    const event = {
      platform: { env: { GameRoom: mockGameRoom } },
      url: mockUrl,
      request: new Request("https://bsbingo.example.com/api/rooms", { method: "POST" }),
    } as never;

    const response = await POST(event);
    const body = await response.json() as { code: string; shareUrl: string };
    expect(body.shareUrl).toMatch(/^https:\/\/bsbingo\.example\.com\/join\//);
  });

  it("returns 500 when all 5 attempts collide (stub always returns ok)", async () => {
    // Stub: all DO pings return ok → room already exists → all 5 attempts fail
    const stubFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ exists: true }), { status: 200 }));
    const mockGameRoom = {
      get: vi.fn().mockReturnValue({ fetch: stubFetch }),
      idFromName: vi.fn((name: string) => name),
    };

    const { POST } = await import("../../src/routes/api/rooms/+server.js");

    const mockUrl = new URL("http://localhost/api/rooms");
    const event = {
      platform: { env: { GameRoom: mockGameRoom } },
      url: mockUrl,
      request: new Request("http://localhost/api/rooms", { method: "POST" }),
    } as never;

    await expect(POST(event)).rejects.toMatchObject({ status: 500 });
  });

  it("returns 500 when platform env is unavailable", async () => {
    const { POST } = await import("../../src/routes/api/rooms/+server.js");

    const event = {
      platform: undefined,
      url: new URL("http://localhost/api/rooms"),
      request: new Request("http://localhost/api/rooms", { method: "POST" }),
    } as never;

    await expect(POST(event)).rejects.toMatchObject({ status: 500 });
  });
});

// ---------------------------------------------------------------------------
// GET /api/rooms/[code]/exists
// ---------------------------------------------------------------------------

describe("GET /api/rooms/[code]/exists", () => {
  it("returns 200 JSON when DO is live", async () => {
    const doBody = JSON.stringify({ exists: true, playerCount: 2 });
    const stubFetch = vi.fn().mockResolvedValue(new Response(doBody, { status: 200 }));
    const mockGameRoom = {
      get: vi.fn().mockReturnValue({ fetch: stubFetch }),
      idFromName: vi.fn((name: string) => name),
    };

    const { GET } = await import("../../src/routes/api/rooms/[code]/exists/+server.js");

    const event = {
      params: { code: "ABCDEF" },
      platform: { env: { GameRoom: mockGameRoom } },
    } as never;

    const response = await GET(event);
    expect(response.status).toBe(200);
  });

  it("returns 404 when DO ping fails", async () => {
    const stubFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const mockGameRoom = {
      get: vi.fn().mockReturnValue({ fetch: stubFetch }),
      idFromName: vi.fn((name: string) => name),
    };

    const { GET } = await import("../../src/routes/api/rooms/[code]/exists/+server.js");

    const event = {
      params: { code: "ZZZZZZ" },
      platform: { env: { GameRoom: mockGameRoom } },
    } as never;

    await expect(GET(event)).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 when DO fetch throws", async () => {
    const stubFetch = vi.fn().mockRejectedValue(new Error("DO unavailable"));
    const mockGameRoom = {
      get: vi.fn().mockReturnValue({ fetch: stubFetch }),
      idFromName: vi.fn((name: string) => name),
    };

    const { GET } = await import("../../src/routes/api/rooms/[code]/exists/+server.js");

    const event = {
      params: { code: "XXXXXX" },
      platform: { env: { GameRoom: mockGameRoom } },
    } as never;

    await expect(GET(event)).rejects.toMatchObject({ status: 404 });
  });
});
