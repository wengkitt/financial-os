import { Link } from "@tanstack/react-router";
import { buttonVariants } from "./ui/button-variants";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "./ui/empty";
export function NotFound() {
  return (
    <main className="auth-layout">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>The page you requested does not exist.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants({ variant: "outline" })} to="/">
            Return home
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
