import { Link } from "@tanstack/react-router";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";

export function FormDemo() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-6 p-6">
      <Button variant="ghost" render={<Link to="/" />}>
        Back home
      </Button>
      <ProfileForm />
    </main>
  );
}
