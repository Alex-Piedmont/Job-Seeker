# Lessons Learned

## Prisma 7 Breaking Changes
- **Driver adapters required**: `new PrismaClient()` no longer works without an adapter. Must use `@prisma/adapter-pg` with `new PrismaPg({ connectionString })`.
- **No URL in schema**: `url` and `directUrl` removed from `datasource` block in `schema.prisma`. Connection config lives in `prisma.config.ts`.
- **Generated output**: Prisma 7 generates to `src/generated/prisma/` with separate files (`client.ts`, `enums.ts`). Import from specific files, not the directory: `@/generated/prisma/client` and `@/generated/prisma/enums`.
- **`directUrl` removed from config**: `prisma.config.ts` `datasource` only accepts `url` and `shadowDatabaseUrl`, not `directUrl`.

## Next.js 16 Notes
- `middleware.ts` convention deprecated in favor of `proxy`. Still works but shows warning.
- `create-next-app` prompts for React Compiler (new option).
- Project name validation is strict — no spaces or capitals in directory names.

## Auth.js v5 (next-auth@beta.30)
- Uses `AUTH_` prefix env vars, not `NEXTAUTH_`.
- `NextAuth()` returns `{ handlers, auth, signIn, signOut }`.
- JWT strategy with PrismaAdapter works — adapter handles account/user creation, JWT handles sessions.
- Edge-safe split config: `auth.config.ts` (providers only) for middleware, `auth.ts` (full config with adapter) for API routes.

## Vitest Mocking Patterns
- **`vi.mock` factories are hoisted** to the top of the file. Any variable referenced inside a `vi.mock` factory must be created with `vi.hoisted()` — otherwise you get "Cannot access before initialization" errors.
- Pattern: `const { mockAuth, mockPrisma } = vi.hoisted(() => { ... return { mockAuth, mockPrisma }; });`
- `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));` — placed after the `vi.hoisted` block.

## @hello-pangea/dnd Types
- `DraggableProvidedDragHandleProps` is not assignable to `Record<string, unknown>` due to missing index signature. Use `any` type for drag handle props passed between components to avoid friction.
