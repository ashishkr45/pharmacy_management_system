"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/layout/brand";
import { RoleBadge } from "@/components/layout/role-badge";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/auth-context";
import { findNavItem } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) {
    return null;
  }

  const title = findNavItem(pathname)?.label ?? "MediTrack";

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    toast.success("Signed out");
    router.replace("/login");
  };

  return (
    <div className="min-h-svh bg-muted/30">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav role={user.role} />
        </div>
        <div className="border-t px-4 py-3">
          <p className="text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground">
            Signed in as
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu className="size-4" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <SidebarNav
                  role={user.role}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <SheetFooter className="border-t p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Sign out
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-medium">{title}</p>
          </div>

          <RoleBadge role={user.role} className="hidden sm:inline-flex" />
          <ThemeToggle />
          <UserMenu user={user} onLogout={handleLogout} />
        </header>

        <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
