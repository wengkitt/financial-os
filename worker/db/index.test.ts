import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { withDatabase } from "./index.ts";

const connection = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  end: vi.fn<() => Promise<void>>(),
}));

vi.mock("pg", () => ({
  Client: class {
    connect = connection.connect;
    end = connection.end;
  },
}));

const env = {
  HYPERDRIVE: {
    connectionString: "postgres://test:test@localhost:5432/test",
  },
} satisfies Parameters<typeof withDatabase>[0];

describe("request database lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    connection.connect.mockResolvedValue();
    connection.end.mockResolvedValue();
  });

  it("returns the operation result and closes the connection", async () => {
    expect(await withDatabase(env, async () => "result")).toBe("result");
    expect(connection.connect).toHaveBeenCalledOnce();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it("closes the connection when the operation fails", async () => {
    const error = new Error("Query failed");
    await expect(
      withDatabase(env, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it("closes the client when connecting fails and skips the operation", async () => {
    const error = new Error("Connection failed");
    connection.connect.mockRejectedValue(error);
    const operation = vi.fn(async () => "result");
    await expect(withDatabase(env, operation)).rejects.toBe(error);
    expect(operation).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });
});
