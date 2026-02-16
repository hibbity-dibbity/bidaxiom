# Validation Schema Conventions

This document defines Zod schema patterns for client-server validation sharing.

## Single Source of Truth

All validation schemas live in `packages/shared/src/` and are imported by both:
- **Client:** React Hook Form via zodResolver
- **Server:** tRPC procedures via .input()

This prevents validation drift where client passes but server rejects.

## Schema Organization

```
packages/shared/src/
├── schemas/
│   ├── common.ts          # Shared primitives (phone, address, date)
│   └── index.ts           # Central export
└── types/
    ├── project.ts         # Project CRUD schemas
    ├── customer.ts        # Customer CRUD schemas
    ├── budget.ts          # Budget CRUD schemas
    ├── estimates.ts       # Estimate CRUD schemas
    └── index.ts           # Central export
```

**Convention:**
- `schemas/` → Reusable primitives (phoneSchema, addressSchema, dateSchema)
- `types/` → Entity CRUD schemas (createProjectSchema, updateProjectSchema)
- Both export from `index.ts` for convenience

**Import paths:**
```typescript
// Import from shared package
import { createProjectSchema } from "@construction/shared";
import { phoneSchema, addressSchema } from "@construction/shared/schemas";

// Both work, choose based on context
```

## Schema Patterns

### Create Schema

Used by client forms and server create mutations:

```typescript
export const createEntitySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email"),
  phone: phoneSchema,          // Reuse from common.ts
  address: addressSchema,      // Reuse from common.ts
  // All required fields for creation
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
```

### Update Schema

Used by client edit forms and server update mutations:

```typescript
export const updateEntitySchema = createEntitySchema.partial();

export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
```

**Pattern:** `.partial()` makes all fields optional for updates.

### Filter Schema

Used by list pages with nuqs and server list queries:

```typescript
export const entityFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type EntityFilter = z.infer<typeof entityFilterSchema>;
```

**Pattern:** All fields optional for flexible filtering, coerce for URL params.

## Validation Messages

Include user-friendly messages in schema (not component):

```typescript
// GOOD
name: z.string().min(1, "Name is required").max(200, "Name too long")

// BAD (error message in component)
name: z.string().min(1)
// Component: {errors.name && <span>Name is required</span>}
```

**Why:** Centralized messages prevent inconsistency.

## Async Validation

For uniqueness checks or external validation:

```typescript
email: z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { message: "Email already registered" }
)
```

**Important:** Use `mode: "onBlur"` in useForm for async validation:

```typescript
const form = useForm({
  mode: "onBlur",  // Not onChange
  resolver: zodResolver(schema),
});
```

## Reusing Common Schemas

Import from common.ts instead of duplicating:

```typescript
import { phoneSchema, addressSchema } from "@construction/shared/schemas";

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: phoneSchema,        // Don't redefine
  address: addressSchema,    // Don't redefine
});
```

## Multi-Step Form Validation

Use `.pick()` to validate subsets of full schema:

```typescript
// Step 1: Basic info only
const step1Schema = createEstimateSchema.pick({
  name: true,
  projectType: true,
});

// Step 2: Template selection
const step2Schema = createEstimateSchema.pick({
  templateId: true,
});

// Final submission: Full schema
const form = useForm({
  resolver: zodResolver(createEstimateSchema),
});
```

**Benefits:**
- Single source of truth maintained
- Each step validates only relevant fields
- TypeScript infers correct types automatically
- No validation drift between steps and final submission

## Client Usage

```typescript
import { createProjectSchema, type CreateProjectInput } from "@construction/shared";
import { zodResolver } from "@hookform/resolvers/zod";

export function ProjectForm() {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  });

  // Form fields inferred from schema
}
```

## Server Usage

```typescript
import { createProjectSchema, updateProjectSchema } from "@construction/shared";

export const projectRouter = router({
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // input is CreateProjectInput type
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateProjectSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // ...
    }),
});
```

## Migration from Local Schemas

When consolidating local schemas:

1. **Check if schema already exists in shared package**
   ```bash
   # Search for entity schema
   grep -r "createProjectSchema" packages/shared/src/types/
   ```

2. **If exists:** Update client component to import from shared
   ```typescript
   // Before
   const formSchema = z.object({ name: z.string().min(1) });

   // After
   import { createProjectSchema } from "@construction/shared";
   ```

3. **If missing:** Create in `packages/shared/src/types/[entity].ts`
   ```typescript
   // packages/shared/src/types/project.ts
   export const createProjectSchema = z.object({
     name: z.string().min(1, "Name is required"),
     // ...
   });

   export type CreateProjectInput = z.infer<typeof createProjectSchema>;
   ```

4. **Export from index.ts**
   ```typescript
   // packages/shared/src/types/index.ts
   export * from "./project";
   ```

5. **Update server:** Replace .input(z.object({...})) with .input(schema)

6. **Verify TypeScript compilation:** `cd packages/shared && npm run build`

## Real-World Examples from Phase 19

### Estimate Workflow Multi-Step Validation

**Before (Plan 19-03):** Local schemas in each workflow step component:
```typescript
// apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  projectType: z.enum(["residential", "commercial", "institutional"]), // Wrong enum!
});
```

**After:** Import shared schema and use `.pick()`:
```typescript
import { createEstimateSchema } from "@construction/shared";

const step1Schema = createEstimateSchema.pick({
  name: true,
  projectType: true,
});

// projectType now uses correct enum values from shared schema
```

**Bug found during migration:** Client used "institutional" enum value, but shared schema defined "infrastructure". Fixed to match server validation.

### Project Schema Structure

**Location:** `packages/shared/src/types/project.ts`

**Pattern:**
```typescript
// Create schema (all required fields)
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  jobNumber: z.string().optional(),
  customerId: z.string().uuid("Invalid customer ID"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  street1: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2).max(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
});

// Update schema (all optional)
export const updateProjectSchema = createProjectSchema.partial();

// List filter schema
export const listProjectsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "completed", "on_hold"]).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
```

**Server usage:**
```typescript
// apps/api/src/trpc/routers/project.ts
create: protectedProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => { ... }),

update: protectedProcedure
  .input(z.object({ id: z.string().uuid(), data: updateProjectSchema }))
  .mutation(async ({ ctx, input }) => { ... }),

list: protectedProcedure
  .input(listProjectsSchema)
  .query(async ({ ctx, input }) => { ... }),
```

**Client usage:**
```typescript
// apps/web/components/project/project-form.tsx
import { createProjectSchema, type CreateProjectInput } from "@construction/shared";

const form = useForm<CreateProjectInput>({
  resolver: zodResolver(createProjectSchema),
});
```

### Change Order Discriminated Union

**Complex example:** Change orders have different schemas based on type:

```typescript
// packages/shared/src/types/change-order.ts
const ownerChangeOrderSchema = z.object({
  type: z.literal("owner"),
  requestedBy: z.string().min(1, "Requested by is required"),
  // Owner-specific fields
});

const internalChangeOrderSchema = z.object({
  type: z.literal("internal"),
  reason: z.enum(["scope_change", "cost_savings", "schedule"]),
  // Internal-specific fields
});

const subcontractorChangeOrderSchema = z.object({
  type: z.literal("subcontractor"),
  commitmentId: z.string().uuid("Invalid commitment"),
  // Subcontractor-specific fields
});

export const createChangeOrderSchema = z.discriminatedUnion("type", [
  ownerChangeOrderSchema,
  internalChangeOrderSchema,
  subcontractorChangeOrderSchema,
]);
```

**Client usage with discriminated union:**
```typescript
const form = useForm<CreateChangeOrderInput>({
  resolver: zodResolver(createChangeOrderSchema),
});

// TypeScript narrows based on type field
if (formData.type === "owner") {
  // formData.requestedBy is available
}
```

## Anti-Patterns

**DON'T duplicate schemas:**
```typescript
// Client
const formSchema = z.object({ name: z.string().min(1) });

// Server
.input(z.object({ name: z.string().min(1) }))  // DUPLICATION
```

**DO import shared schema:**
```typescript
import { createEntitySchema } from "@construction/shared";

// Client
const form = useForm({ resolver: zodResolver(createEntitySchema) });

// Server
.input(createEntitySchema)
```

**DON'T use .refine() for simple validation:**
```typescript
// BAD
z.string().refine(val => val.length >= 1, "Required")

// GOOD
z.string().min(1, "Required")
```

**DO use .refine() for complex cross-field validation:**
```typescript
// GOOD
z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  data => data.endDate >= data.startDate,
  { message: "End date must be after start date", path: ["endDate"] }
)
```

## References

- Common schemas: `packages/shared/src/schemas/common.ts`
- Entity schemas: `packages/shared/src/types/`
- Research: `.planning/phases/19-component-library-architecture/19-RESEARCH.md`
- Phase 19 Plan 03 Summary: `.planning/phases/19-component-library-architecture/19-03-SUMMARY.md`
