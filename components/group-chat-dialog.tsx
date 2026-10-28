"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
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
  chat,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bots: UserBot[]
  // Passing a chat opens the dialog in edit mode
  chat?: { id: string; name: string; bots: { id: string }[] }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <GroupChatForm
          bots={bots}
          chat={chat}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function GroupChatForm({
  bots,
  chat,
  onSaved,
}: {
  bots: UserBot[]
  chat?: { id: string; name: string; bots: { id: string }[] }
  onSaved: () => void
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const form = useForm({
    resolver: zodResolver(groupChatFormSchema),
    defaultValues: {
      name: chat?.name ?? "",
      botIds: chat?.bots.map((bot) => bot.id) ?? ([] as string[]),
    },
  })

  async function onSubmit(values: z.infer<typeof groupChatFormSchema>) {
    const result = chat
      ? await updateGroupChat(chat.id, values)
      : await createGroupChat(values)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onSaved()
    // Only a new chat needs a new route; an edited one is already open
    if (!chat) router.push(`/chats/${result.id}`)
  }

  async function onDelete() {
    if (!chat) return

    setIsDeleting(true)
    const result = await deleteGroupChat(chat.id)
    setIsDeleting(false)
    setDeleteOpen(false)

    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }

    onSaved()
    // The chat is gone, so leave its route
    router.push("/")
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{chat ? "Edit group chat" : "New group chat"}</DialogTitle>
        <DialogDescription>
          {chat
            ? "Change its name, or add and remove bots."
            : "Name it and pick at least two bots. You choose who answers each message."}
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
        {chat && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger
              render={<Button variant="destructive" className="mr-auto" />}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the group chat. Its bots are kept, and this
                  can&apos;t be undone.
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
                  Delete group chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          type="submit"
          form="group-chat-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {chat ? "Save changes" : "Create group chat"}
        </Button>
      </DialogFooter>
    </>
  )
}

export { GroupChatDialog }
