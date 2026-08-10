export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/**
 * App changelog — newest first. Add an entry whenever package.json version bumps.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.15",
    date: "2026-08-10",
    changes: [
      "Automatic web updates: browsers now detect and load new builds without a hard refresh",
      "New-version banner with countdown and post-update confirmation",
      "Cache-busting: HTML always fetched fresh, only hashed assets cached",
      "Version history page tracking when each browser updated",
    ],
  },
  {
    version: "1.0.14",
    date: "2026-08-09",
    changes: [
      "Excel export for reports (quotations summary + line items)",
      "Per-user Price Portal permission toggle in Users",
      "Customer portal statistics and in-portal quote viewer",
    ],
  },
  {
    version: "1.0.13",
    date: "2026-08-06",
    changes: [
      "Master price list refresh (415 price updates, 35 new SKUs)",
      "Full catalog visible in the customer price portal, plus slide view",
      "Duplicate customer cards merged",
    ],
  },
  {
    version: "1.0.12",
    date: "2026-08-02",
    changes: [
      "Automatic cost fill by SKU with group-based costing for US-/UC- items",
      "Manual cost approval saved as a default override",
      "Tiered quantity pricing and lead times",
    ],
  },
];
