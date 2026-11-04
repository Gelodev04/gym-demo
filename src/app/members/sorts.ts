// Shared by the server page (query) and the client dropdown, so it can't live in a "use client" file.
export const SORTS = {
  name: "Name (A–Z)",
  "end-asc": "End date (earliest)",
  "end-desc": "End date (latest)",
  newest: "Newest members",
} as const;
export type SortKey = keyof typeof SORTS;

export const SEARCH_FORM_ID = "member-search";
