import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
import { authSearch } from "@/lib/contracts";
export const Route = createFileRoute("/forgot-password")({
  validateSearch: authSearch,
  component: function Screen() {
    const { token } = Route.useSearch();
    return <AuthScreen mode="forgot" token={token} />;
  },
});
