import { NotFound } from "@/components/not-found";
import { createFileRoute } from "@tanstack/react-router";
import { FormDemo } from "@/components/form-demo";

export const Route = createFileRoute("/form-demo")({
  component: import.meta.env.DEV ? FormDemo : NotFound,
});
