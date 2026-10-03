import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { Filters } from "@/lib/contracts";
import { dataSchema, messageSchema, sessionSchema, filtersSchema } from "@/lib/contracts";
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  // HTTP JSON is an untyped boundary; Zod owns narrowing here.
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = messageSchema.safeParse(body);
    throw new Error(error.success ? error.data.message : "Request failed. Please retry.");
  }
  return schema.parse(body);
}
export const sessionOptions = queryOptions({
  queryKey: ["session"],
  queryFn: ({ signal }) => request("/api/auth/session", sessionSchema, { signal }),
  retry: false,
  staleTime: 0,
});
export const financeOptions = queryOptions({
  queryKey: ["finance"],
  queryFn: ({ signal }) => request("/api/finance/data", dataSchema, { signal }),
  retry: false,
});
export type Payload = Record<string, string | boolean | null>;
export function useWrite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      payload,
      method = "POST",
    }: {
      path: string;
      payload?: Payload;
      method?: "POST" | "PATCH" | "DELETE";
    }) =>
      request(path, messageSchema, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : "{}",
      }),
    onSuccess: async (_result, variables) => {
      if (
        [
          "/api/auth/login",
          "/api/auth/register",
          "/api/auth/logout",
          "/api/auth/reset-password",
        ].includes(variables.path)
      )
        client.removeQueries({ queryKey: ["finance"] });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["finance"] }),
        client.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}

export function useExport() {
  return useMutation({
    mutationFn: async (filters: Filters) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filtersSchema.parse(filters)))
        if (value) params.set(key, value);
      const response = await fetch(`/api/finance/export?${params}`, { credentials: "same-origin" });
      if (!response.ok) {
        const body: unknown = await response.json();
        const error = messageSchema.safeParse(body);
        throw new Error(error.success ? error.data.message : "Export failed. Please retry.");
      }
      z.string().startsWith("text/csv").parse(response.headers.get("Content-Type"));
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = "financial-os-transactions.csv";
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
}
