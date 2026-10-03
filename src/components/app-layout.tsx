import { useSidebar } from "@/hooks/use-sidebar";
import { Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ArrowLeftRight,
  WalletCards,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Layers,
  Settings,
  LogOut,
} from "lucide-react";
import { sessionOptions, useWrite } from "@/queries/financial";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const links = [
  { section: "dashboard", name: "Overview", icon: LayoutDashboard },
  { section: "transactions", name: "Transactions", icon: ArrowLeftRight },
  { section: "wallets", name: "Wallets", icon: WalletCards },
  { section: "recurring", name: "Recurring payments", icon: CalendarClock },
  { section: "budgets", name: "Budgets", icon: ChartNoAxesColumnIncreasing },
  { section: "spaces", name: "Spaces", icon: Layers },
  { section: "settings", name: "Settings", icon: Settings },
];
export function AppLayout() {
  const session = useQuery(sessionOptions);
  const write = useWrite();
  const client = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (session.isPending)
    return (
      <main className="p-8">
        <Skeleton className="h-10 w-48" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your account…</p>
      </main>
    );
  if (session.isError)
    return (
      <main className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{session.error.message}</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => void session.refetch()}>
          Retry
        </Button>
      </main>
    );
  const user = session.data.user;
  if (!user) return <Navigate to="/login" />;
  if (!user.verified) return <Navigate to="/verify-email" />;
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="px-5 py-6">
            <Link
              to="/app/$section"
              params={{ section: "dashboard" }}
              search={(prev) => prev}
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <WalletCards className="size-5" />
              Financial OS
            </Link>
            <span className="text-xs text-muted-foreground">Your money, with clarity.</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Personal finance</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavigationLinks path={path} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="gap-2 p-3">
            <Separator />
            <Item size="xs" className="flex-nowrap px-1 py-2">
              <ItemContent className="min-w-0">
                <ItemTitle className="block w-full truncate" title={user.name}>
                  {user.name}
                </ItemTitle>
                <ItemDescription className="truncate" title={user.email}>
                  {user.email}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={write.isPending ? "Signing out…" : "Sign out"}
                        disabled={write.isPending}
                        onClick={() => {
                          void write
                            .mutateAsync({ path: "/api/auth/logout", payload: {} })
                            .then(() => client.clear());
                        }}
                      />
                    }
                  >
                    <LogOut />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {write.isPending ? "Signing out…" : "Sign out"}
                  </TooltipContent>
                </Tooltip>
              </ItemActions>
            </Item>
            {write.isError && (
              <Alert variant="destructive">
                <AlertDescription>{write.error.message}</AlertDescription>
              </Alert>
            )}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="app-topbar">
            <SidebarTrigger />
          </header>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function NavigationLinks({ path }: { path: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {links.map((item) => (
        <SidebarMenuItem key={item.section}>
          <SidebarMenuButton
            isActive={path.startsWith(`/app/${item.section}`)}
            onClick={() => setOpenMobile(false)}
            render={
              <Link to="/app/$section" params={{ section: item.section }} search={(prev) => prev} />
            }
          >
            <item.icon />
            <span>{item.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
