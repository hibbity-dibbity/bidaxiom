"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, User, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";

const SearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

/**
 * SearchProvider wraps the command palette with context for external control.
 * Used by app-shell to allow TopBar to open the search palette.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
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

/**
 * CommandPalette component with global search functionality.
 * Can be used standalone or via SearchProvider for context-based control.
 */
function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300); // 300ms debounce

  // Search query (only runs when debounced query changes)
  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query: debouncedQuery, limit: 10 },
    {
      enabled: debouncedQuery.length > 0,
    }
  );

  const handleSelect = useCallback(
    (url: string) => {
      setOpen(false);
      setQuery("");
      router.push(url);
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search projects, customers, jobs..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!debouncedQuery && (
          <CommandEmpty>Start typing to search...</CommandEmpty>
        )}
        {debouncedQuery && (
          <>
            {isLoading && (
              <div className="py-6 text-center text-sm">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching...</span>
                </div>
              </div>
            )}
            {!isLoading && (!results || results.length === 0) && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
          </>
        )}
        {results && results.length > 0 && (
          <>
            <CommandGroup heading="Projects">
              {results
                .filter((r) => r.type === "project")
                .map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => handleSelect(result.url)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Customers">
              {results
                .filter((r) => r.type === "customer")
                .map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => handleSelect(result.url)}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Standalone CommandPalette that manages its own open state.
 * Use this version when you don't need SearchProvider context.
 */
export function StandaloneCommandPalette() {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
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

  return <CommandPalette open={open} setOpen={setOpen} />;
}
