"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

// Inline links on tablet/desktop, a slide-out menu on phones.
export function NavLinks({ links, staffName, logout }: { links: [string, string][]; staffName: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden items-center gap-1 md:flex">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${isActive(path, href) ? "bg-white font-semibold text-rubber" : "text-white/80 hover:bg-white/10"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <form action={logout} className="ml-auto hidden items-center gap-3 md:flex">
        <span className="text-sm text-white/70">{staffName}</span>
        <button className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">Log out</button>
      </form>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" className="ml-auto text-white hover:bg-white/10 hover:text-white md:hidden" aria-label="Open menu">
            <MenuIcon className="size-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-64">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{staffName}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActive(path, href) ? "page" : undefined}
                className={`rounded-md px-3 py-3 text-base ${isActive(path, href) ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="mt-auto p-4">
            <Button variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
