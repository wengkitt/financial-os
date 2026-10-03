import { Link } from "@tanstack/react-router";
import { ProfileForm } from "@/components/profile-form";
import { buttonVariants } from "@/components/ui/button-variants";

export function FormDemo() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-6 p-6">
      <Link className={buttonVariants({ variant: "ghost" })} to="/">
        Back home
      </Link>
      <ProfileForm />
    </main>
  );
}
