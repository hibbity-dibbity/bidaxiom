"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectPicker } from "./project-picker";
import { REMIND_LABELS, detectPreset, localMoment, pad, presetMoment, prettyMoment, type RemindPreset } from "@/lib/tasks";

export type TaskRow = {
  id: string;
  projectId: string | null;
  title: string;
  notes: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  status: string;
  remindAt: string | Date | null;
  remindBell: boolean;
  remindEmail: boolean;
  projectName?: string | null;
  jobNumber?: string | null;
};

const UNASSIGNED = "__none__";

/** Add a task, or change one. Pass `task` to edit; pass `project` to lock a new task to a project. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  project,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: TaskRow | null;
  project?: { id: string; label: string } | null;
}) {
  const utils = trpc.useUtils();
  const { userId } = useAuth();
  const { data: users } = trpc.user.list.useQuery({ limit: 100, offset: 0 }, { enabled: open, retry: false });
  const people = users?.items ?? [];

  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [picked, setPicked] = React.useState<{ id: string; label: string } | null>(null);
  const [assignee, setAssignee] = React.useState<string>(UNASSIGNED);
  const [dueDate, setDueDate] = React.useState("");
  const [preset, setPreset] = React.useState<RemindPreset>("none");
  const [customDate, setCustomDate] = React.useState("");
  const [customTime, setCustomTime] = React.useState("08:00");
  const [bell, setBell] = React.useState(true);
  const [email, setEmail] = React.useState(false);

  // Fill the form each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setPicked(task.projectId ? { id: task.projectId, label: `${task.jobNumber ? `${task.jobNumber} - ` : ""}${task.projectName ?? "Project"}` } : null);
      setAssignee(task.assigneeId ?? UNASSIGNED);
      setDueDate(task.dueDate ?? "");
      const p = detectPreset(task.remindAt, task.dueDate);
      setPreset(p);
      if (p === "custom" && task.remindAt) {
        const d = new Date(task.remindAt);
        setCustomDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setCustomTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setCustomDate("");
        setCustomTime("08:00");
      }
      setBell(task.remindBell);
      setEmail(task.remindEmail);
    } else {
      setTitle("");
      setNotes("");
      setPicked(project ?? null);
      setAssignee(userId ?? UNASSIGNED);
      setDueDate("");
      setPreset("none");
      setCustomDate("");
      setCustomTime("08:00");
      setBell(true);
      setEmail(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const needsDue = preset !== "none" && preset !== "custom";
  const remindAt: string | null =
    preset === "none" ? null : preset === "custom" ? (customDate ? localMoment(customDate, customTime || "08:00") : null) : presetMoment(preset, dueDate || null);
  const remindProblem = preset === "none" ? null : needsDue && !dueDate ? "Pick a due date first, or choose a specific date and time." : preset === "custom" && !customDate ? "Pick the reminder date." : null;
  const noChannel = preset !== "none" && !bell && !email;

  const done = () => {
    utils.task.invalidate();
    onOpenChange(false);
  };
  const create = trpc.task.create.useMutation({ onSuccess: () => { toast.success("Task added"); done(); }, onError: (e) => toast.error(e.message || "Could not add the task") });
  const update = trpc.task.update.useMutation({ onSuccess: () => { toast.success("Task saved"); done(); }, onError: (e) => toast.error(e.message || "Could not save the task") });
  const del = trpc.task.delete.useMutation({ onSuccess: () => { toast.success("Task deleted"); done(); }, onError: (e) => toast.error(e.message || "Could not delete the task") });

  const save = () => {
    const body = {
      title: title.trim(),
      notes: notes.trim() || null,
      assigneeId: assignee === UNASSIGNED ? null : assignee,
      dueDate: dueDate || null,
      remindAt,
      remindBell: preset === "none" ? true : bell,
      remindEmail: preset === "none" ? false : email,
    };
    if (task) update.mutate({ id: task.id, projectId: picked?.id ?? null, ...body });
    else create.mutate({ projectId: picked?.id ?? null, ...body });
  };
  const busy = create.isPending || update.isPending || del.isPending;
  const canSave = title.trim().length > 0 && !remindProblem && !noChannel && !busy;
  const lockedProject = !task && !!project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>An action item with an optional reminder under the bell, by email, or both.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">What needs to be done</Label>
            <Input id="task-title" autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Order rebar, call the inspector..." />
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            {lockedProject ? <div className="rounded-md border px-3 py-2 text-sm">{project!.label}</div> : <ProjectPicker value={picked} onChange={setPicked} />}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {people.map((u) => (
                    <SelectItem key={u.clerkUserId} value={u.clerkUserId}>
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                      {u.clerkUserId === userId ? " (me)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <DateInput id="task-due" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={dueDate} placeholder="No due date" onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea id="task-notes" rows={3} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember (optional)" />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1.5">
              <Label>Remind</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as RemindPreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(REMIND_LABELS) as RemindPreset[]).map((k) => (
                    <SelectItem key={k} value={k}>{REMIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <DateInput aria-label="Reminder date" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                <Input type="time" aria-label="Reminder time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              </div>
            )}

            {preset !== "none" && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={bell} onCheckedChange={(v) => setBell(v === true)} /> Show under the bell
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} /> Email {assignee === userId ? "me" : "the person it is assigned to"}
                  </label>
                </div>
                {remindProblem ? (
                  <p className="text-xs text-destructive">{remindProblem}</p>
                ) : noChannel ? (
                  <p className="text-xs text-destructive">Choose the bell, email, or both.</p>
                ) : remindAt ? (
                  <p className="text-xs text-muted-foreground">
                    Reminds {prettyMoment(remindAt)}. {assignee === UNASSIGNED ? "Nobody is assigned, so nobody will be reminded." : ""}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {task ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => { if (window.confirm("Delete this task?")) del.mutate({ id: task.id }); }}>
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={!canSave} onClick={save}>{task ? "Save" : "Add task"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
