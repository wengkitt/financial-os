import { queryOptions } from "@tanstack/react-query";

export const apiNameQueryOptions = queryOptions({
  queryKey: ["api", "name"],
  queryFn: async ({ signal }): Promise<{ name: string }> => {
    const response = await fetch("/api/", { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch name (${response.status})`);
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null ||
      !("name" in data) ||
      typeof data.name !== "string"
    ) {
      throw new Error("The API returned an invalid name");
    }

    return { name: data.name };
  },
});
