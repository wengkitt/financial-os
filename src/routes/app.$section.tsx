import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/app/$section")({
  component: function Screen() {
    return <Workspace section={Route.useParams().section} />;
  },
});
