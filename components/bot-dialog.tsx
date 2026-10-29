"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import type { z } from "zod"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { usePlanGate } from "@/hooks/use-plan-gate"
import { type bots, botFormSchema } from "@/lib/db/schema"

const JOB_PRESETS = [
  {
    job: "Research assistant",
    instructions:
      "Answer with concise, well-sourced findings. Cite where each claim comes from and say when the evidence is thin. Ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Read changes carefully and point out bugs, edge cases, and unclear code. Explain the why behind each comment and suggest a fix. Keep nits separate from real problems.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten prose without changing the author's voice. Flag unclear sentences, repetition, and weak structure. Briefly explain any significant edit.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step and check understanding with a question before moving on. Use simple examples, and give a hint before a full answer.",
  },
]

function BotDialog({
  bot,
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: {
  // Passing a bot opens the dialog in edit mode
  bot?: typeof bots.$inferSelect
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const { requireBots } = usePlanGate()

  // Only creating a bot needs a paid plan, so editing one stays open to everyone
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !bot && !requireBots()) return

    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger render={<Button variant="secondary" />}>
          <PlusIcon data-icon="inline-start" />
          Create a new bot
        </DialogTrigger>
      )}
      <DialogContent>
        <BotForm bot={bot} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BotForm({
  bot,
  onSaved,
}: {
  bot?: typeof bots.$inferSelect
  onSaved: () => void
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const form = useForm({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      avatar: bot?.avatar ?? nanoid(),
      name: bot?.name ?? "",
      job: bot?.job ?? "",
      instructions: bot?.instructions ?? "",
    },
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })
  const job = useWatch({ control: form.control, name: "job" })

  function applyPreset(preset: (typeof JOB_PRESETS)[number]) {
    form.setValue("job", preset.job, {
      shouldValidate: true,
      shouldDirty: true,
    })
    form.setValue("instructions", preset.instructions, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  async function onSubmit(values: z.infer<typeof botFormSchema>) {
    const result = bot
      ? await updateBot(bot.id, values)
      : await createBot(values)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onSaved()
  }

  async function onDelete() {
    if (!bot) return

    setIsDeleting(true)
    const result = await deleteBot(bot.id)
    setIsDeleting(false)
    setDeleteOpen(false)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onSaved()
    // The bot's chat is gone, so leave its route
    router.push("/")
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
        <DialogDescription>
          {bot
            ? "Change its face, name, or job."
            : "Give it a face, a name, and a job to do."}
        </DialogDescription>
      </DialogHeader>
      <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-wrap gap-2">
            {JOB_PRESETS.map((preset) => (
              <Button
                key={preset.job}
                type="button"
                variant={job === preset.job ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.job}
              </Button>
            ))}
          </div>
          <Field orientation="horizontal">
            <ChatAvatar seed={avatar} />
            <FieldContent>
              <FieldTitle>Face</FieldTitle>
              <FieldDescription>
                Shuffle until you find one you like.
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.setValue("avatar", nanoid())}
            >
              <ShuffleIcon data-icon="inline-start" />
              Shuffle
            </Button>
          </Field>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Ada"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="job"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Job</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Research assistant"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="instructions"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>How it should work</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id={field.name}
                  placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          {form.formState.errors.root && (
            <FieldError errors={[form.formState.errors.root]} />
          )}
        </FieldGroup>
      </form>
      <DialogFooter>
        {bot && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger
              render={<Button variant="destructive" className="mr-auto" />}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the bot and its chat. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Spinner data-icon="inline-start" />}
                  Delete bot
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          type="submit"
          form="bot-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {bot ? "Save changes" : "Create bot"}
        </Button>
      </DialogFooter>
    </>
  )
}

export { BotDialog }
