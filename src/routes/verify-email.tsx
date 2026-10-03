import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
import { authSearch } from "@/lib/contracts";
export const Route = createFileRoute("/verify-email")({
  validateSearch: authSearch,
  component: function Screen() {
    const { token } = Route.useSearch();
    return <AuthScreen mode="verify" token={token} />;
  },
});
