"use client";

import { LogOutIcon, UserPlusIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../../../components/avatar";
import { Button } from "../../../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../../components/dropdown-menu";

export type TopUserMenuUser = {
  avatarSrc?: string;
  email: string;
  fallback: string;
  name: string;
};

export type TopUserMenuProps = {
  addUserHref?: string;
  logoutHref?: string;
  onLogout?: () => void | Promise<void>;
  profileHref?: string;
  user: TopUserMenuUser;
};

export function TopUserMenu({
  addUserHref,
  logoutHref = "/login",
  onLogout,
  profileHref,
  user
}: TopUserMenuProps) {
  const [open, setOpen] = useState(false);
  const greetingName = user.name.trim().split(/\s+/u)[0] || user.name;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`User menu for ${user.name}`}
          className="size-9 rounded-full p-0 ring-2 ring-primary/20 ring-offset-1 ring-offset-background"
          size="icon"
          variant="ghost"
        >
          <Avatar className="size-8">
            {user.avatarSrc ? <AvatarImage alt={user.name} src={user.avatarSrc} /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user.fallback}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[22rem] rounded-[1.75rem] border bg-popover p-3 text-popover-foreground shadow-2xl"
        sideOffset={10}
      >
        <DropdownMenuLabel className="relative px-3 pb-4 pt-1 text-center font-normal">
          <div className="truncate px-8 text-xs font-medium text-muted-foreground">
            {user.email}
          </div>
          <button
            aria-label="Close user menu"
            className="absolute right-0 top-0 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            onClick={() => setOpen(false)}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
          <div className="mt-4 flex flex-col items-center">
            <Avatar className="size-20 border-4 border-background shadow-md ring-2 ring-primary/20">
              {user.avatarSrc ? <AvatarImage alt={user.name} src={user.avatarSrc} /> : null}
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                {user.fallback}
              </AvatarFallback>
            </Avatar>
            <div className="mt-3 text-xl font-medium tracking-tight">Hi, {greetingName}!</div>
            {profileHref ? (
              <Button asChild className="mt-3 rounded-full px-5" size="sm" variant="outline">
                <a href={profileHref}>
                  <UserRoundIcon />
                  Manage your profile
                </a>
              </Button>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          {addUserHref ? (
            <DropdownMenuItem asChild className="h-12 gap-3 rounded-none px-4">
              <a href={addUserHref}>
                <UserPlusIcon />
                Add user
              </a>
            </DropdownMenuItem>
          ) : null}
          {addUserHref ? <DropdownMenuSeparator className="m-0" /> : null}
          {onLogout ? (
            <DropdownMenuItem
              className="h-12 gap-3 rounded-none px-4"
              onSelect={(event) => {
                event.preventDefault();
                void onLogout();
              }}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild className="h-12 gap-3 rounded-none px-4">
              <a href={logoutHref}>
                <LogOutIcon />
                Sign out
              </a>
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
