"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Home,
  FolderKanban,
  Users,
  HardHat,
  Settings,
  FileText,
  DollarSign,
  BarChart,
  Briefcase,
} from "lucide-react";

const SearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

/**
 * Command palette for global search and navigation.
 * Triggered by Cmd+K keyboard shortcut or search button in top bar.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Listen for Cmd+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette open={open} setOpen={setOpen} />
    </SearchContext.Provider>
  );
}

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter();

  const navigationItems = [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Subcontractors", href: "/subcontractors", icon: HardHat },
    { label: "Bidding", href: "/bids", icon: Briefcase },
    { label: "Financials", href: "/financials", icon: DollarSign },
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "Reports", href: "/reports", icon: BarChart },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or navigate..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
