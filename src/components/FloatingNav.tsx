import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, BookOpen, ScrollText, Workflow } from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: "/" | "/how-it-works" | "/rules" | "/app";
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", icon: Home, href: "/" },
  { id: "how", label: "How it works", icon: BookOpen, href: "/how-it-works" },
  { id: "rules", label: "Rules & sources", icon: ScrollText, href: "/rules" },
  { id: "app", label: "Workflow", icon: Workflow, href: "/app" },
];

export function FloatingNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isHome = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160);
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    onScroll();
    onResize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // On home: mobile hides nav until scroll. On interior routes: always visible.
  const showBar = isDesktop || !isHome || scrolled;

  return (
    <AnimatePresence>
      {showBar && (
        <motion.nav
          aria-label="Primary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="
            glass fixed z-40
            bottom-4 left-1/2 -translate-x-1/2
            flex-row gap-1 p-1.5 rounded-full
            md:bottom-auto md:left-auto md:translate-x-0
            md:right-5 md:top-1/2 md:-translate-y-1/2
            md:flex-col md:rounded-3xl md:p-2
            flex
          "
        >
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} active={pathname === item.href} />
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center justify-center h-10 w-10 rounded-full transition-colors";
  const state = active
    ? "bg-foreground text-background"
    : "text-foreground/70 hover:text-foreground hover:bg-foreground/5";

  return (
    <Link
      to={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`${base} ${state}`}
    >
      <Icon className="h-4 w-4" />
      <span
        className="
          pointer-events-none absolute
          md:right-full md:mr-3 md:top-1/2 md:-translate-y-1/2
          -top-9 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto
          whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background
          opacity-0 group-hover:opacity-100 transition-opacity
        "
      >
        {item.label}
      </span>
    </Link>
  );
}
