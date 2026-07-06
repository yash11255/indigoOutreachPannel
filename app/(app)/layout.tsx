import Link from "next/link";
import { requireProfile } from "@/lib/data/session";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-12 items-center border-b-2 border-transparent px-4 text-sm text-neutral-300 transition-colors hover:border-[#0f62fe] hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 h-12 border-b border-[#393939] bg-[#161616] text-white">
        <div className="flex h-full items-center justify-between pr-4">
          <div className="flex h-full items-center">
            <Link
              href="/leads"
              className="flex h-full items-center border-r border-[#393939] px-4 text-sm font-semibold tracking-tight"
            >
              Indigo GWF <span className="ml-1 font-normal text-neutral-400">Outreach</span>
            </Link>
            <nav className="flex h-full items-center">
              <NavLink href="/leads">Leads</NavLink>
              <NavLink href="/calendar">Calendar</NavLink>
              <NavLink href="/map">Map</NavLink>
              {profile.role === "admin" && (
                <>
                  <NavLink href="/admin">Admin</NavLink>
                  <NavLink href="/admin/users">Users</NavLink>
                  <NavLink href="/admin/logs">Logs</NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-7 w-7 rounded-none bg-[#0f62fe] text-xs text-white">
              <AvatarFallback className="rounded-none bg-[#0f62fe] text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-xs leading-tight sm:block">
              <div className="font-medium text-white">{profile.full_name || profile.email}</div>
              <div className="text-neutral-400 capitalize">{profile.role}</div>
            </div>
            <form action={signOut}>
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                className="text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
