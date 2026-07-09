import Link from "next/link";
import { requireProfile } from "@/lib/data/session";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppNav } from "@/components/app-nav";
import { ROLE_LABELS } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 h-12 border-b border-[#393939] bg-[#161616] text-white">
        <div className="relative flex h-full items-center justify-between pr-2 sm:pr-4">
          <div className="flex h-full items-center">
            <Link
              href="/leads"
              className="flex h-full items-center border-r border-[#393939] px-3 text-sm font-semibold tracking-tight whitespace-nowrap sm:px-4"
            >
              Indigo GWF <span className="ml-1 hidden font-normal text-neutral-400 sm:inline">Outreach</span>
            </Link>
            <AppNav role={profile.role} teamId={profile.team_id} subTeam={profile.sub_team} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-7 w-7 rounded-none bg-[#0f62fe] text-xs text-white">
              <AvatarFallback className="rounded-none bg-[#0f62fe] text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-xs leading-tight sm:block">
              <div className="font-medium text-white">{profile.full_name || profile.email}</div>
              <div className="text-neutral-400">{ROLE_LABELS[profile.role]}</div>
            </div>
            <form action={signOut}>
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                className="px-2 text-neutral-300 hover:bg-white/10 hover:text-white sm:px-3"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
