import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/app/spaces/$spaceId")({
  component: function Screen() {
    return <Workspace section="space-detail" spaceId={Route.useParams().spaceId} />;
  },
});
