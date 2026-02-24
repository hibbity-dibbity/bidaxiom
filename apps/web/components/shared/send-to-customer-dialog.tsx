"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SendToCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentName: string
  prePopulatedEmail: string | null | undefined
  prePopulatedSubject?: string
  isPending: boolean
  onSend: (data: { recipients: string[]; subject: string; note: string }) => void
}

export function SendToCustomerDialog({
  open,
  onOpenChange,
  documentName,
  prePopulatedEmail,
  prePopulatedSubject,
  isPending,
  onSend,
}: SendToCustomerDialogProps) {
  const [recipientInput, setRecipientInput] = useState("")
  const [subject, setSubject] = useState("")
  const [note, setNote] = useState("")

  // Pre-populate fields when dialog opens (only if fields are currently empty)
  useEffect(() => {
    if (open) {
      if (prePopulatedEmail && recipientInput === "") {
        setRecipientInput(prePopulatedEmail)
      }
      if (prePopulatedSubject && subject === "") {
        setSubject(prePopulatedSubject)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset all fields when dialog closes
  useEffect(() => {
    if (!open) {
      setRecipientInput("")
      setSubject("")
      setNote("")
    }
  }, [open])

  const handleSend = () => {
    const recipients = recipientInput
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
    onSend({ recipients, subject, note })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Send to Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Document</Label>
            <p className="text-sm text-muted-foreground">{documentName}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="recipients">Recipient Email(s)</Label>
            <Input
              id="recipients"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="email@example.com, another@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple addresses with commas.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Proposal for [Project Name]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="note">
              Note{" "}
              <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a personal message to your customer..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || !recipientInput.trim()}
          >
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
