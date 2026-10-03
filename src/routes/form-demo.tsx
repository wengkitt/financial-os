import { createFileRoute } from "@tanstack/react-router";
import { FormDemo } from "@/components/form-demo";

export const Route = createFileRoute("/form-demo")({
  component: FormDemo,
});
