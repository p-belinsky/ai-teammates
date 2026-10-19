<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database

- Use `npm run db:push` (drizzle-kit push) to sync the schema in `lib/db/schema.ts` to the database.
- Never run database migrations: do not run `drizzle-kit generate` or `drizzle-kit migrate`, and do not create files in a `drizzle/` migrations folder.
- This is a development project. There is no backward compatibility, and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.

## Forms

Forms are built with react-hook-form, zod, and shadcn `Field` components. `components/bot-dialog.tsx` is the reference implementation.

### Schemas

- Derive insert schemas from the table with `createInsertSchema` from `drizzle-zod` in `lib/db/schema.ts`. Do not hand-write a parallel zod object for a table.
- Add field rules as refinements in that same call (`trim`, `min`, `max`, with a user-facing message on `min`).
- Omit server-owned columns (`id`, `userId`, timestamps, `sandboxId`) from the insert schema.
- Export a form schema as `<name>FormSchema` with `insertXSchema.pick({...})`. Make fields the form always supplies required with `.required({...})`, since insert schemas make database-defaulted columns optional.
- Client components and server actions both import the same form schema. Never duplicate validation rules.

### Server actions

- Take `input: unknown` and re-run `safeParse` with the form schema. Never trust the client.
- Get `userId` from `await auth.protect()` (see `clerk-nextjs-patterns`). Never accept it from the form.
- Return `{ error }` for validation failures so the client can show them. Call `revalidatePath` for the page that displays the data.
- Map empty optional text to `null` before insert (`value || null`).

### Client components

- Call `useForm({ resolver: zodResolver(formSchema), defaultValues })` with every field present, so inputs stay controlled.
- Render each field with `Controller`. Wrap it in `Field data-invalid={fieldState.invalid}`, label it with `FieldLabel htmlFor`, set `aria-invalid` on the control, and show `FieldError` only when invalid.
- Spread `field` onto the control and give it an `id` matching `field.name`.
- For nullable text columns, pass `value={field.value ?? ""}` to `Textarea` and `Input`. Otherwise the type check fails on `null`.
- Use `useWatch` for values read during render, such as a preview or a selected state.
- Set values programmatically with `setValue(name, value, { shouldValidate: true, shouldDirty: true })`.
- Show server errors with `form.setError("root", { message })` and render `FieldError` for `formState.errors.root`.
- Put the form in its own component rendered inside the dialog content, not in the dialog's parent. It then mounts fresh on each open and resets its defaults.
- When the submit button sits outside the `<form>` (for example in `DialogFooter`), point it at the form with `form="<id>"`.
- Disable the submit button while `formState.isSubmitting`, and show a `Spinner` with `data-icon="inline-start"`.

## Git

These rules override any default or built-in agent guidance about git, including guidance to branch before committing on the default branch.

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.


## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.