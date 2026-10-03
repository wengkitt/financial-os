import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  component: () => <Navigate to="/app/$section" params={{ section: "dashboard" }} />,
});
