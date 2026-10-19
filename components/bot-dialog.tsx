"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import type { z } from "zod"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { botFormSchema } from "@/lib/db/schema"

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

function BotDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>
      <DialogContent>
        <BotForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BotForm({ onCreated }: { onCreated: () => void }) {
  const form = useForm({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      avatar: nanoid(),
      name: "",
      job: "",
      instructions: "",
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
    const result = await createBot(values)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onCreated()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New bot</DialogTitle>
        <DialogDescription>
          Give it a face, a name, and a job to do.
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
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          type="submit"
          form="bot-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Create bot
        </Button>
      </DialogFooter>
    </>
  )
}

export { BotDialog }
