"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";

type NavItem = { href: string; label: string };

const DESKTOP_LINK_CLASS =
  "flex h-12 items-center border-b-2 border-transparent px-4 text-sm text-neutral-300 transition-colors hover:border-[#0f62fe] hover:bg-white/5 hover:text-white";

const MOBILE_LINK_CLASS =
  "flex h-12 items-center border-b border-[#393939] px-4 text-sm text-neutral-200 hover:bg-white/5";

/** Nav links + a hamburger menu below `md`, since the inline links overflow on phone-width screens. */
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  const links: NavItem[] = [
    { href: "/leads", label: "Leads" },
    { href: "/calendar", label: "Calendar" },
    { href: "/map", label: "Map" },
    ...(isAdmin
      ? [
          { href: "/admin", label: "Admin" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/logs", label: "Logs" },
        ]
      : []),
  ];

  return (
    <>
      <nav className="hidden h-full items-center md:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={DESKTOP_LINK_CLASS}>
            {l.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-full items-center px-4 text-neutral-300 md:hidden"
      >
        {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-12 z-40 flex flex-col border-b border-[#393939] bg-[#161616] shadow-lg md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={MOBILE_LINK_CLASS}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
