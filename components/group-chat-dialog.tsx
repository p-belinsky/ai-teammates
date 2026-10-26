"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { groupChatFormSchema } from "@/lib/db/schema"
import type { UserBot } from "@/queries/bots"

function GroupChatDialog({
  open,
  onOpenChange,
  bots,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bots: UserBot[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <GroupChatForm bots={bots} onCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupChatForm({
  bots,
  onCreated,
}: {
  bots: UserBot[]
  onCreated: () => void
}) {
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(groupChatFormSchema),
    defaultValues: {
      name: "",
      botIds: [] as string[],
    },
  })

  async function onSubmit(values: z.infer<typeof groupChatFormSchema>) {
    const result = await createGroupChat(values)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onCreated()
    router.push(`/chats/${result.id}`)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New group chat</DialogTitle>
        <DialogDescription>
          Name it and pick at least two bots. You choose who answers each
          message.
        </DialogDescription>
      </DialogHeader>
      <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={field.name}
                  placeholder="Launch team"
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
            name="botIds"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Bots</FieldLegend>
                {bots.map((bot) => {
                  const id = `bot-${bot.id}`

                  return (
                    <Field key={bot.id} orientation="horizontal">
                      <Checkbox
                        id={id}
                        checked={field.value.includes(bot.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, bot.id]
                              : field.value.filter((botId) => botId !== bot.id)
                          )
                        }
                        aria-invalid={fieldState.invalid}
                      />
                      <ChatAvatar seed={bot.avatar} />
                      <FieldLabel htmlFor={id}>{bot.name}</FieldLabel>
                    </Field>
                  )
                })}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldSet>
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
          form="group-chat-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Create group chat
        </Button>
      </DialogFooter>
    </>
  )
}

export { GroupChatDialog }
