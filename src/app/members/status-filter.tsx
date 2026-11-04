"use client";

import { SEARCH_FORM_ID, SORTS, type SortKey } from "./sorts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";



// Radix Select renders a hidden native <select name=...>, so the GET search form still works.
// Changing a dropdown re-runs the search right away; the native select updates a tick later.
function submitSearch() {
  setTimeout(() => (document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null)?.requestSubmit());
}

export function StatusFilter({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select name="status" defaultValue={defaultValue || "all"} onValueChange={submitSearch}>
      <SelectTrigger aria-label="Status" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="expiring">Expiring</SelectItem>
        <SelectItem value="expired">Expired</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function SortSelect({ defaultValue }: { defaultValue: SortKey }) {
  return (
    <Select name="sort" defaultValue={defaultValue} onValueChange={submitSearch}>
      <SelectTrigger aria-label="Sort by" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(SORTS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
