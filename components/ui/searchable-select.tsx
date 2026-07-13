"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type SearchableSelectOption = { value: string; label: string };

/**
 * A dropdown with a search box, for pickers with too many options to scan
 * (e.g. choosing one of 400+ people) — the plain Select component has no way
 * to filter, so this is a separate component rather than an option on it.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverPrimitive.Trigger
        className={cn(
          "flex h-8 w-48 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <span className="truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-neutral-400" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="z-50 outline-none"
          align="start"
          sideOffset={4}
        >
          <PopoverPrimitive.Popup className="w-(--anchor-width) min-w-56 origin-(--transform-origin) overflow-hidden rounded-lg border bg-white shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="border-b p-1.5">
              <Input
                autoFocus
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-7"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100",
                  !value && "bg-neutral-100 font-medium",
                )}
              >
                {placeholder}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100",
                    o.value === value && "bg-neutral-100 font-medium",
                  )}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-neutral-400">
                  No matches
                </p>
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
