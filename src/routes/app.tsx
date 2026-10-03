import { createFileRoute } from "@tanstack/react-router";
import { viewSearchSchema } from "@/lib/contracts";
import { AppLayout } from "@/components/app-layout";
export const Route = createFileRoute("/app")({
  validateSearch: viewSearchSchema,
  component: AppLayout,
});
