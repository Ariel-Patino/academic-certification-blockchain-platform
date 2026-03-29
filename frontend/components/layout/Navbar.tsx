"use client";

// Shared navigation used across the main application pages.
import Link from "next/link";

import { useWallet } from "@/hooks/useWallet";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";

const NavIcon = ({ href }: { href: string }) => {
  const pathByRoute: Record<string, string> = {
    "/": "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    "/issue": "M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm9 0v4h4",
    "/batch": "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm4 2v1h4V8h-4zm0 3v1h4v-1h-4zm0 3v1h4v-1h-4z",
    "/verify": "M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm6.2 13.7L21 21",
    "/revoke": "M6 7h12M9 7V5a3 3 0 0 1 6 0v2m-7 0 1 12h6l1-12",
    "/certificates": "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6m-3 4v6m-2-3h4"
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={pathByRoute[href] || pathByRoute["/"]} />
    </svg>
  );
};

export function Navbar() {
  const { isConnected } = useWallet();

  return (
    <div className="navbar-shell">
      <nav className="navbar">
        {NAV_ITEMS.map((item) => {
          const isLocked = (
            item.href === ROUTES.issue ||
            item.href === ROUTES.batch ||
            item.href === ROUTES.revoke ||
            item.href === ROUTES.certificates
          ) && !isConnected;

          if (isLocked) {
            return (
              <span key={item.href} className="nav-link-disabled" aria-disabled="true">
                <NavIcon href={item.href} />
                {item.label}
              </span>
            );
          }

          return (
            <Link key={item.href} href={item.href}>
              <NavIcon href={item.href} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
