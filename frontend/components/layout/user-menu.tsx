"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/api/types";
import { ROLE_LABELS } from "@/lib/roles";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-1.5 sm:px-2"
            aria-label="Open account menu"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/10 text-[0.625rem] font-semibold text-primary">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-32 truncate text-xs font-medium">
            {user.name}
          </span>
          <span className="block text-[0.625rem] text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronDown
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-xs font-medium">{user.name}</p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {user.email}
          </p>
          <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
