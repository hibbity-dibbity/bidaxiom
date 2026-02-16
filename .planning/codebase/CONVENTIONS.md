# Code Conventions

This document defines coding standards, naming conventions, and best practices for the Construction Management SaaS codebase.

## Validation Conventions

All Zod schemas centralized in `packages/shared/src/` for client-server sharing.

**Pattern:**
- Create schema: All required fields
- Update schema: `.partial()` of create schema
- Filter schema: Optional fields for list queries

**Import pattern:**
```typescript
import { createProjectSchema, updateProjectSchema } from "@construction/shared";
```

Client and server import same schema to prevent validation drift.

**See:** `packages/shared/SCHEMA-CONVENTIONS.md` for complete schema patterns and examples.

## Component Naming

- **File names:** kebab-case (`status-badge.tsx`, `currency-display.tsx`)
- **Component exports:** PascalCase (`StatusBadge`, `CurrencyDisplay`)
- **Utility exports:** camelCase (`formatCurrency`, `generateSlug`)

Follows Next.js App Router conventions and shadcn/ui patterns.

**See:** `apps/web/COMPONENT-ORGANIZATION.md` for extraction guidelines and component organization.

## Routing Conventions

**Slug patterns:**
- Projects: `{jobNumber}-{projectName}` → `24001-main-street-renovation`
- Customers: `cust-{uuid8}-{name}` → `cust-a5520c49-abc-construction`
- Subcontractors: `sub-{uuid8}-{companyName}` → `sub-b2b1fc58-acme-hvac`
- Estimates: `est-{jobNumber}-{name}` → `est-24001-option-1`

**Route patterns:**
- List pages: `/[entities]` (e.g., `/projects`)
- Detail pages: `/[entities]/[entitySlug]` (e.g., `/projects/24001-renovation`)
- Nested tabs: `/[entities]/[entitySlug]/[tab]` (e.g., `/projects/24001-renovation/budget`)

**See:** `apps/web/ROUTING-CONVENTIONS.md` for slug generation, prefetching, and scroll restoration.

## File Organization

**Monorepo structure:**
```
apps/
  api/                      # Backend API
    src/
      db/
        schema/             # Drizzle schemas (tenant.ts, public.ts)
        migrations/         # Database migrations
      trpc/
        routers/            # tRPC route handlers
      utils/                # Backend utilities
  web/                      # Frontend app
    app/                    # Next.js App Router pages
      (dashboard)/          # Authenticated routes
      (auth)/               # Public auth routes
    components/
      ui/                   # shadcn/ui base components
      shared/               # Extracted components (3+ uses)
      [domain]/             # Domain-specific components
    lib/
      utils/                # Frontend utilities
      hooks/                # Custom React hooks
packages/
  shared/                   # Shared types and schemas
    src/
      schemas/              # Reusable primitives
      types/                # Entity CRUD schemas
```

## Import Conventions

**Path aliases:**
- `@/` → `apps/[app]/` (app-specific root)
- `@construction/shared` → `packages/shared` (shared package)

**Import order:**
1. External packages (React, Next.js, etc.)
2. Internal packages (`@construction/shared`)
3. Internal modules (`@/components`, `@/lib`)
4. Relative imports (`./`, `../`)

**Example:**
```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { createProjectSchema } from "@construction/shared";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

import { ProjectHeader } from "./project-header";
```

## TypeScript Conventions

**Type imports:**
```typescript
// Use 'type' keyword for type-only imports
import type { Project } from "@construction/shared";

// Regular import for values
import { createProjectSchema } from "@construction/shared";
```

**Type inference:**
```typescript
// Prefer inference from schemas
type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Not manual type definitions
type CreateProjectInput = {
  name: string;
  customerId: string;
  // ...
};
```

**Nullability:**
```typescript
// Use optional chaining and nullish coalescing
const projectName = project?.name ?? "Untitled";

// Not verbose null checks
const projectName = project && project.name ? project.name : "Untitled";
```

## API Conventions

**tRPC procedure naming:**
- `list` - Get paginated list (e.g., `project.list`)
- `getById` - Get single record by UUID (e.g., `project.getById`)
- `getBySlug` - Get single record by slug (e.g., `project.getBySlug`)
- `create` - Create new record (e.g., `project.create`)
- `update` - Update existing record (e.g., `project.update`)
- `delete` - Delete record (e.g., `project.delete`)

**Procedure types:**
- `publicProcedure` - No authentication required
- `protectedProcedure` - Requires valid JWT (basic auth)
- `authorizedProcedure` - Requires auth + loads CASL abilities

**Input validation:**
```typescript
// Always use Zod schema from shared package
create: protectedProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => { ... })

// Not inline z.object()
create: protectedProcedure
  .input(z.object({ name: z.string() }))  // DON'T DO THIS
  .mutation(async ({ ctx, input }) => { ... })
```

## Database Conventions

**Table naming:**
- Plural snake_case (e.g., `projects`, `budget_line_items`, `change_orders`)
- Join tables: `{entity1}_{entity2}` (e.g., `project_team_members`)

**Column naming:**
- snake_case (e.g., `created_at`, `updated_at`, `deleted_at`)
- Foreign keys: `{entity}_id` (e.g., `project_id`, `customer_id`)
- Booleans: `is_{adjective}` or `has_{noun}` (e.g., `is_locked`, `has_budget`)

**Timestamps:**
```typescript
// Standard timestamp columns
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
deletedAt: timestamp("deleted_at"),  // Soft delete
```

**Currency:**
```typescript
// Use NUMERIC(15,2) for exact precision
amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
```

**Enums:**
```typescript
// Use TEXT with Zod validation (not PostgreSQL ENUM)
status: text("status").notNull(),  // Validated via statusEnum Zod schema
```

## React Conventions

**Component structure:**
```typescript
// 1. Imports
import { useState } from "react";
import { useForm } from "react-hook-form";

// 2. Types
interface ComponentProps {
  projectId: string;
  onSuccess?: () => void;
}

// 3. Component
export function Component({ projectId, onSuccess }: ComponentProps) {
  // 3a. Hooks
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm();

  // 3b. Queries
  const { data: project } = trpc.project.getById.useQuery({ id: projectId });

  // 3c. Mutations
  const updateProject = trpc.project.update.useMutation();

  // 3d. Event handlers
  const handleSubmit = async (data: FormData) => { ... };

  // 3e. Render
  return ( ... );
}
```

**Hook naming:**
```typescript
// Custom hooks start with 'use'
export function useProjectAbilities(projectId: string) { ... }

// Not
export function getProjectAbilities(projectId: string) { ... }
```

**Event handlers:**
```typescript
// Prefix with 'handle'
const handleClick = () => { ... };
const handleSubmit = async (data: FormData) => { ... };

// Not
const onClick = () => { ... };
const submit = async (data: FormData) => { ... };
```

## Form Conventions

**React Hook Form setup:**
```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, type CreateProjectInput } from "@construction/shared";

const form = useForm<CreateProjectInput>({
  resolver: zodResolver(createProjectSchema),
  defaultValues: {
    name: "",
    customerId: "",
  },
});
```

**Form structure:**
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(handleSubmit)}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>
```

## Error Handling

**tRPC errors:**
```typescript
// Use TRPCError with appropriate codes
throw new TRPCError({
  code: "NOT_FOUND",
  message: "Project not found",
});

throw new TRPCError({
  code: "FORBIDDEN",
  message: "You don't have permission to update this project",
});

throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Invalid project data",
});
```

**Client error handling:**
```typescript
const mutation = trpc.project.update.useMutation({
  onSuccess: () => {
    toast.success("Project updated successfully");
    onSuccess?.();
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

## Commit Conventions

**Format:** `type(scope): message`

**Types:**
- `feat` - New feature or enhancement
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring without behavior change
- `test` - Test additions or updates
- `chore` - Build, tooling, dependency updates

**Scopes:**
- `api` - Backend API changes
- `web` - Frontend app changes
- `shared` - Shared package changes
- `phase-XX` - Phase-specific work (e.g., `phase-19`)
- `XX-YY` - Specific plan within phase (e.g., `19-05`)

**Examples:**
```
feat(19-05): add slug-based routing for customers
fix(api): resolve null pointer in project creation
docs(web): document component extraction patterns
refactor(19-02): migrate status badges to shared component
```

## Testing Conventions

**Test file naming:**
- Component tests: `{component}.test.tsx`
- Utility tests: `{utility}.test.ts`
- Integration tests: `{feature}.integration.test.ts`

**Test structure:**
```typescript
describe("ComponentName", () => {
  describe("when condition", () => {
    it("should behave as expected", () => {
      // Arrange
      const props = { ... };

      // Act
      render(<Component {...props} />);

      // Assert
      expect(screen.getByText("Expected")).toBeInTheDocument();
    });
  });
});
```

## Documentation Conventions

**JSDoc comments:**
```typescript
/**
 * Generates a URL-safe slug from identifier and name.
 *
 * @param identifier - Unique identifier (job number, ID prefix)
 * @param name - Human-readable name
 * @returns Lowercase slug with hyphens
 *
 * @example
 * generateSlug("24001", "Main Street Renovation")
 * // Returns: "24001-main-street-renovation"
 */
export function generateSlug(identifier: string, name: string): string {
  // ...
}
```

**Component documentation:**
```typescript
/**
 * Displays currency values with optional semantic colorization.
 *
 * @example
 * <CurrencyDisplay amount={1234.56} />
 * // Renders: $1,234.56
 *
 * <CurrencyDisplay amount={-500} colorize />
 * // Renders: $-500.00 (in red)
 */
export function CurrencyDisplay({ amount, colorize, showSign }: Props) {
  // ...
}
```

## References

- Component organization: `apps/web/COMPONENT-ORGANIZATION.md`
- Routing patterns: `apps/web/ROUTING-CONVENTIONS.md`
- Schema patterns: `packages/shared/SCHEMA-CONVENTIONS.md`
- Architecture overview: `.planning/codebase/ARCHITECTURE.md`
- Project decisions: `.planning/STATE.md` (Accumulated Context → Decisions)
