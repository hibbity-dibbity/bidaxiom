# Phase 2: Company Setup & Configuration - Research

**Researched:** 2026-02-12
**Domain:** Multi-tenant company profile configuration with CSI MasterFormat trade management
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 requires implementing a company profile configuration system where companies self-identify as General Contractor (GC), Subcontractor (Sub), or Both (hybrid), and configure their trade capabilities from a CSI MasterFormat-based standard list plus custom specialties. This configuration must affect future RFQ filtering and bid categorization while preserving historical data immutability.

The implementation will extend the existing Drizzle ORM schema-per-tenant architecture with a JSONB configuration column for flexible company settings, use effective-dating patterns to enable point-in-time configuration queries, and build a shadcn/ui form interface with React Hook Form and Zod validation. The CSI MasterFormat provides a 50-division industry standard (expanded in 2004) for categorizing construction trades and specialties.

**Primary recommendation:** Store company configuration in a versioned table with effective dating (valid_from, valid_to) to enable point-in-time queries while maintaining historical immutability. Use JSONB for flexible trade configuration storage, and implement tRPC mutations with proper error handling for company setup workflows.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current | Schema definition, type-safe queries, migrations | Already in use; excellent TypeScript inference and PostgreSQL JSONB support |
| Zod | Current | Schema validation for form inputs and tRPC procedures | Already in use; type-safe validation with React Hook Form integration |
| React Hook Form | Current | Form state management, validation | Already in use; minimal re-renders, excellent shadcn/ui integration |
| shadcn/ui | Current | UI components (RadioGroup, Combobox, Checkbox) | Already in use; accessible, customizable components |
| tRPC | Current | Type-safe API layer | Already in use; end-to-end type safety for mutations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hookform/resolvers | Current | Zod resolver for React Hook Form | Integrating Zod schemas with forms |
| cmdk | via shadcn/ui | Command palette for searchable combobox | Multi-select trade configuration UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB column | Normalized trade_assignments table | JSONB offers flexibility for custom fields; normalized approach better for complex queries but requires schema migration for each new field |
| Effective dating pattern | Separate history table | History table is more traditional but duplicates schema; effective dating keeps all versions in one table |
| Combobox multi-select | Transfer list (dual listbox) | Combobox scales better with 50+ CSI divisions; transfer list better for small sets |

**Installation:**
No new dependencies required. All libraries already installed in Phase 1.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── db/schema/
│   ├── tenant.ts              # Add companyProfiles table to tenant schema
│   └── seed/
│       └── csi-divisions.ts   # CSI MasterFormat reference data
├── trpc/routers/
│   └── company.ts             # Company configuration mutations/queries
└── lib/
    └── effective-dating.ts    # Point-in-time query helpers

apps/web/app/
└── (dashboard)/settings/
    └── company/
        └── page.tsx           # Company setup form
```

### Pattern 1: Versioned Configuration with Effective Dating
**What:** Store company configuration in a table with `valid_from` and `valid_to` timestamps to enable point-in-time queries while preserving history.

**When to use:** Any configuration that must be queryable at a specific point in time (e.g., "What trades did this company handle when they submitted this bid in 2024?")

**Example:**
```typescript
// apps/api/src/db/schema/tenant.ts
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  const companyProfiles = schema.table("company_profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyType: text("company_type").notNull(), // "gc_only", "sub_only", "both"
    tradesConfig: jsonb("trades_config").notNull().$type<{
      csiDivisions: number[];      // e.g., [3, 4, 5] for Concrete, Masonry, Metals
      customTrades: Array<{
        id: string;
        name: string;
        parentDivision?: number;  // optional CSI parent
      }>;
    }>(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }), // null = current
    createdBy: text("created_by").notNull(), // Clerk user ID
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  return {
    schema,
    auditLogs,
    userProfiles,
    companyProfiles,  // Add to return object
  };
}
```

### Pattern 2: Point-in-Time Query Helper
**What:** Helper function to query current or historical configuration based on timestamp.

**When to use:** Retrieving company configuration for RFQ filtering, bid categorization, or historical reporting.

**Example:**
```typescript
// apps/api/src/lib/effective-dating.ts
import { eq, and, lte, or, isNull, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

export function asOfDate<T extends PgTable>(
  table: T,
  asOf: Date = new Date()
): SQL {
  return and(
    lte(table.validFrom, asOf),
    or(
      isNull(table.validTo),
      lte(asOf, table.validTo)
    )
  );
}

// Usage in tRPC query
const currentProfile = await tenantDb
  .select()
  .from(companyProfiles)
  .where(asOfDate(companyProfiles))
  .limit(1);
```

### Pattern 3: tRPC Mutation with Version Management
**What:** When updating company configuration, set `validTo` on current record and insert new version.

**When to use:** All company configuration updates to maintain audit trail.

**Example:**
```typescript
// apps/api/src/trpc/routers/company.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const companyConfigSchema = z.object({
  companyType: z.enum(["gc_only", "sub_only", "both"]),
  csiDivisions: z.array(z.number().min(0).max(49)),
  customTrades: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    parentDivision: z.number().min(0).max(49).optional(),
  })),
});

export const companyRouter = router({
  updateConfig: protectedProcedure
    .input(companyConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Close current version
      await ctx.tenantDb
        .update(companyProfiles)
        .set({ validTo: now })
        .where(and(
          isNull(companyProfiles.validTo)
        ));

      // Insert new version
      const [newProfile] = await ctx.tenantDb
        .insert(companyProfiles)
        .values({
          companyType: input.companyType,
          tradesConfig: {
            csiDivisions: input.csiDivisions,
            customTrades: input.customTrades,
          },
          validFrom: now,
          validTo: null,
          createdBy: ctx.userId,
        })
        .returning();

      return newProfile;
    }),
});
```

### Pattern 4: Multi-Step Form with Validation
**What:** Company setup form using React Hook Form with Zod validation and shadcn/ui components.

**When to use:** Onboarding flow or settings page for company configuration.

**Example:**
```typescript
// apps/web/app/(dashboard)/settings/company/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";

const companySetupSchema = z.object({
  companyType: z.enum(["gc_only", "sub_only", "both"]),
  csiDivisions: z.array(z.number()).min(1, "Select at least one trade"),
  customTrades: z.array(z.object({
    id: z.string(),
    name: z.string().min(1),
    parentDivision: z.number().optional(),
  })).default([]),
});

type CompanySetupForm = z.infer<typeof companySetupSchema>;

export default function CompanySetupPage() {
  const form = useForm<CompanySetupForm>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyType: "both",
      csiDivisions: [],
      customTrades: [],
    },
  });

  const updateConfig = trpc.company.updateConfig.useMutation({
    onSuccess: () => {
      // Show success toast
    },
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") {
        // Show validation errors
      }
    },
  });

  const onSubmit = (data: CompanySetupForm) => {
    updateConfig.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* RadioGroup for companyType */}
      {/* Combobox multi-select for csiDivisions */}
      {/* Custom trades field array */}
    </form>
  );
}
```

### Anti-Patterns to Avoid
- **Updating configuration in place:** Mutates historical data, breaks audit trail. Always version with effective dating.
- **Storing CSI divisions in normalized table:** Requires migrations for industry standard updates; JSONB is more flexible.
- **Client-side company type enforcement:** Always validate on server; client can be manipulated.
- **Using PostgreSQL ENUM for company type:** Hard to change; text with Zod validation is more flexible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSI MasterFormat data | Custom trade taxonomy | Industry standard 50 divisions | CSI is universally recognized in construction; custom taxonomy creates data interoperability issues |
| Temporal queries | Custom date range logic per query | Effective dating pattern with helpers | Point-in-time queries are complex; standardized pattern prevents bugs |
| Form validation | Manual input checking | Zod schemas with React Hook Form | Type safety, error messages, and field-level validation out of the box |
| Multi-select UI | Custom checkbox list | shadcn/ui Combobox with checkboxes | Accessibility, keyboard navigation, search already implemented |
| Configuration versioning | Manual history tracking | Effective dating with valid_from/valid_to | Industry standard pattern; prevents accidental data mutation |

**Key insight:** Configuration management is deceptively complex. Hand-rolling versioning logic leads to bugs when querying historical state. Effective dating is a proven pattern that solves point-in-time queries, audit trails, and data immutability with minimal code.

## Common Pitfalls

### Pitfall 1: Forgetting to Close Previous Version
**What goes wrong:** When inserting new configuration version, developer forgets to set `validTo` on current record, resulting in multiple "current" configurations.

**Why it happens:** Version management requires two operations (update old, insert new) in a transaction.

**How to avoid:** Wrap version updates in a transaction and use a helper function that enforces both steps.

**Warning signs:** Queries return multiple rows when expecting one; duplicate company types appear in UI.

### Pitfall 2: Using ENUM for Company Type
**What goes wrong:** PostgreSQL ENUMs are difficult to modify (requires migration with table locking) and don't work well with multi-database tooling.

**Why it happens:** ENUMs seem like a natural fit for fixed values like "gc_only", "sub_only", "both".

**How to avoid:** Use `text` column with Zod validation. Validation happens at API boundary, storage remains flexible.

**Warning signs:** ALTER TYPE ... ADD VALUE statements in migrations; production downtime during enum changes.

### Pitfall 3: Client-Side Trade Validation Only
**What goes wrong:** User submits company configuration with invalid CSI division numbers or duplicate custom trade IDs, bypassing client validation.

**Why it happens:** Developer trusts client-side Zod schema without server-side enforcement.

**How to avoid:** Use same Zod schema in tRPC procedure `.input()`. tRPC automatically validates and returns BAD_REQUEST on failure.

**Warning signs:** Invalid data in database that passes client validation; undefined behavior in downstream features.

### Pitfall 4: Querying Without Point-in-Time Context
**What goes wrong:** RFQ filtering uses "current" company configuration, but company changed trades after RFQ was issued, breaking historical filtering.

**Why it happens:** Developer queries configuration without considering when the operation occurred.

**How to avoid:** Always pass timestamp context to configuration queries. For current operations, use `new Date()`. For historical queries, use entity's `createdAt`.

**Warning signs:** Bids appear or disappear when company configuration changes; historical reports show incorrect data.

### Pitfall 5: JSONB Without Type Safety
**What goes wrong:** Developer updates `tradesConfig` JSONB structure without TypeScript type definition, causing runtime errors when accessing nested properties.

**Why it happens:** JSONB is schema-less at database level; TypeScript types are only in application code.

**How to avoid:** Use Drizzle's `.$type<T>()` to enforce compile-time type checking on JSONB columns.

**Warning signs:** TypeScript shows `any` type for JSONB field; runtime "Cannot read property X of undefined" errors.

## Code Examples

Verified patterns from official sources:

### CSI MasterFormat Division Reference Data
```typescript
// apps/api/src/db/seed/csi-divisions.ts
// Source: Archtoolbox MasterFormat Divisions (Current 2004+)
export const CSI_DIVISIONS = [
  { number: 0, name: "Procurement and Contracting Requirements" },
  { number: 1, name: "General Requirements" },
  { number: 2, name: "Existing Conditions" },
  { number: 3, name: "Concrete" },
  { number: 4, name: "Masonry" },
  { number: 5, name: "Metals" },
  { number: 6, name: "Wood, Plastics, and Composites" },
  { number: 7, name: "Thermal and Moisture Protection" },
  { number: 8, name: "Openings" },
  { number: 9, name: "Finishes" },
  { number: 10, name: "Specialties" },
  { number: 11, name: "Equipment" },
  { number: 12, name: "Furnishings" },
  { number: 13, name: "Special Construction" },
  { number: 14, name: "Conveying Equipment" },
  // 15-19 reserved for future use
  { number: 20, name: "Reserved" },
  { number: 21, name: "Fire Suppression" },
  { number: 22, name: "Plumbing" },
  { number: 23, name: "Heating, Ventilating, and Air Conditioning (HVAC)" },
  { number: 25, name: "Integrated Automation" },
  { number: 26, name: "Electrical" },
  { number: 27, name: "Communications" },
  { number: 28, name: "Electronic Safety and Security" },
  // 29 reserved
  { number: 31, name: "Earthwork" },
  { number: 32, name: "Exterior Improvements" },
  { number: 33, name: "Utilities" },
  { number: 34, name: "Transportation" },
  { number: 35, name: "Waterway and Marine Construction" },
  // Additional divisions 40-48 for process equipment
  // Most relevant for construction management: 0-14, 21-28, 31-35
] as const;

export type CSIDivisionNumber = typeof CSI_DIVISIONS[number]["number"];
```

### Drizzle JSONB with Type Safety
```typescript
// Source: Drizzle ORM PostgreSQL Column Types docs
import { jsonb } from "drizzle-orm/pg-core";

// Define TypeScript type FIRST
type TradesConfig = {
  csiDivisions: number[];
  customTrades: Array<{
    id: string;
    name: string;
    parentDivision?: number;
  }>;
};

// Then use .$type<T>() for compile-time enforcement
const companyProfiles = schema.table("company_profiles", {
  tradesConfig: jsonb("trades_config")
    .notNull()
    .$type<TradesConfig>()
    .default({ csiDivisions: [], customTrades: [] }),
});

// TypeScript now enforces correct structure
const config = await db.select().from(companyProfiles);
// config[0].tradesConfig.csiDivisions // ✅ number[]
// config[0].tradesConfig.invalidField // ❌ TypeScript error
```

### shadcn/ui Multi-Select Combobox with Checkboxes
```typescript
// Source: shadcn.io patterns - Combobox Multi-Select with Checkboxes
"use client";

import { Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";

export function TradesCombobox({ value, onChange }: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleDivision = (divisionNumber: number) => {
    if (value.includes(divisionNumber)) {
      onChange(value.filter(n => n !== divisionNumber));
    } else {
      onChange([...value, divisionNumber]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {value.length === 0 ? "Select trades..." : `${value.length} selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search trades..." />
          <CommandEmpty>No trades found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {CSI_DIVISIONS.map((division) => (
              <CommandItem
                key={division.number}
                onSelect={() => toggleDivision(division.number)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    value.includes(division.number) && "bg-primary border-primary"
                  )}>
                    {value.includes(division.number) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {division.number.toString().padStart(2, "0")}
                  </span>
                  <span>{division.name}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### tRPC Error Handling for Mutations
```typescript
// Source: tRPC Error Handling documentation
import { TRPCError } from "@trpc/server";

// Server-side mutation
export const companyRouter = router({
  updateConfig: protectedProcedure
    .input(companyConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Validation already happened via Zod schema
        // Business logic validation
        if (input.companyType === "sub_only" && input.csiDivisions.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subcontractors must select at least one trade",
          });
        }

        // ... perform update

        return newProfile;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error; // Re-throw tRPC errors
        }

        // Log unexpected errors
        console.error("Company config update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update company configuration",
          cause: error,
        });
      }
    }),
});

// Client-side usage
const updateConfig = trpc.company.updateConfig.useMutation({
  onError: (error) => {
    // Errors automatically typed based on TRPCError codes
    if (error.data?.code === "BAD_REQUEST") {
      toast.error(error.message); // User-friendly validation error
    } else {
      toast.error("Something went wrong. Please try again.");
    }
  },
  onSuccess: () => {
    toast.success("Company configuration updated");
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 16 CSI Divisions | 50 Divisions | November 2004 | More granular trade categorization; better coverage of modern construction specialties |
| Hard-coded trade lists | CSI MasterFormat standard | Industry adoption 1960s-present | Interoperability across construction software; standardized cost coding |
| PostgreSQL ENUM for config | Text + Zod validation | Modern TypeScript era | Easier migrations, better tooling support, no production downtime for value changes |
| Separate history tables | Effective dating (valid_from/valid_to) | Temporal database patterns (2010s+) | Single table maintains all versions; simpler queries for point-in-time state |
| Manual form validation | React Hook Form + Zod | ~2020 | Type-safe validation, better DX, fewer bugs |

**Deprecated/outdated:**
- **16-division CSI system**: Replaced by 50 divisions in 2004; still referenced in legacy systems
- **Separate configuration_history table**: Effective dating pattern is more elegant and query-friendly
- **PostgreSQL ENUM for company_type**: Text with validation is more flexible for modern applications

## Open Questions

1. **Should CSI divisions be normalized or remain in JSONB?**
   - What we know: CSI divisions are industry standard and rarely change (last major update 2004)
   - What's unclear: Whether we need to query/filter by specific divisions frequently enough to justify normalization
   - Recommendation: Start with JSONB for flexibility. If RFQ filtering requires complex division queries, migrate to junction table in later phase.

2. **How granular should custom trades be?**
   - What we know: Users can add custom specialty trades with optional CSI parent division
   - What's unclear: Should custom trades have subcategories, or is flat structure sufficient?
   - Recommendation: Start flat. Add subcategories only if user feedback shows need for hierarchy.

3. **Should company type affect available features?**
   - What we know: GC-only, Sub-only, and Both have different workflows
   - What's unclear: Should UI hide/show features based on company type, or keep everything visible?
   - Recommendation: Show all features but tailor onboarding/defaults. Don't lock capabilities by type (company needs may evolve).

4. **How to handle CSI MasterFormat updates?**
   - What we know: CSI updates standards periodically (2010, 2011, 2012, 2014, 2016, 2018)
   - What's unclear: Should we version CSI reference data, or always use latest?
   - Recommendation: Store CSI division list in seed data; update with new releases. Historical configs remain unchanged (immutability).

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg) - JSONB type definition and `.$type<T>()` usage
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) - Migration workflows and best practices
- [tRPC Error Handling](https://trpc.io/docs/server/error-handling) - TRPCError codes, mutation patterns
- [shadcn/ui React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form) - Form patterns with Zod validation
- [Archtoolbox MasterFormat Divisions](https://www.archtoolbox.com/masterformat-divisions/) - Complete 50-division list

### Secondary (MEDIUM confidence)
- [Procore CSI MasterFormat Guide](https://www.procore.com/library/csi-masterformat) - Industry usage and history
- [CYBERTEC: Lookup Table vs ENUM](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/) - PostgreSQL ENUM performance analysis
- [LogRocket: Multi-Step Forms with React Hook Form and Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) - Multi-step form patterns
- [shadcn.io Combobox Multi-Select Pattern](https://www.shadcn.io/patterns/combobox-multi-select-4) - Multi-select with checkboxes implementation
- [Effective Dating Pattern](https://gcraig.github.io/effective-dating/) - Temporal database design for configuration versioning
- [Simple Talk: Point in Time Architecture](https://www.red-gate.com/simple-talk/databases/sql-server/database-administration-sql-server/database-design-a-point-in-time-architecture/) - Point-in-time database design patterns
- [Procore: Types of Subcontractors](https://www.procore.com/library/types-of-subcontractors-construction) - Construction company classification patterns
- [eSub: General Contractor vs Subcontractor](https://esub.com/blog/trade-contractor-vs-subcontractor-vs-general) - Industry role definitions

### Tertiary (LOW confidence)
- Web search results on multi-tenant configuration patterns - General architectural guidance, needs project-specific validation
- CSI MasterFormat 2026 updates - No official 2026 release found; 2018 appears to be most recent update

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use from Phase 1; documented patterns
- Architecture: MEDIUM-HIGH - Effective dating pattern is well-documented but not yet verified in Drizzle context; JSONB type safety verified
- CSI MasterFormat data: HIGH - Industry standard since 1963, 50-division structure stable since 2004
- Form patterns: HIGH - Official shadcn/ui and React Hook Form documentation
- Pitfalls: MEDIUM - Based on general temporal database and PostgreSQL ENUM anti-patterns; specific to this implementation needs validation

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - configuration patterns are stable; CSI standards update infrequently)
