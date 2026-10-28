"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckSquare, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListToolbar, ListActions, SearchField, FilterSelect } from "@/components/shared/list-toolbar";
import { downloadCsv } from "@/lib/csv";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskDialog, type TaskRow } from "./task-dialog";
import { dueState, prettyDate, prettyMoment } from "@/lib/tasks";

/**
 * The task list, used for one project (its Tasks tab) or for every project (the Tasks page).
 * Tick the box to finish a task, click a row to change it.
 */
export function TaskBoard({
  project,
  newOpen,
  onNewOpenChange,
}: {
  /** Show only this project's tasks, and give new tasks to it. */
  project?: { id: string; label: string };
  newOpen?: boolean;
  onNewOpenChange?: (o: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { userId } = useAuth();
  const [search, setSearch] = React.useState("");
  const [assignee, setAssignee] = React.useState("all");
  const [status, setStatus] = React.useState<"open" | "done" | "all">("open");
  const [editing, setEditing] = React.useState<TaskRow | null>(null);
  const [innerNew, setInnerNew] = React.useState(false);
  const creating = newOpen ?? innerNew;
  const setCreating = onNewOpenChange ?? setInnerNew;

  const { data, isLoading } = trpc.task.list.useQuery({ projectId: project?.id, assignee, status, search: search.trim() || undefined });
  const { data: users } = trpc.user.list.useQuery({ limit: 100, offset: 0 }, { retry: false });
  const rows = data ?? [];

  const setDone = trpc.task.setDone.useMutation({
    onSuccess: () => utils.task.invalidate(),
    onError: (e) => toast.error(e.message || "That did not work"),
  });

  const assigneeOptions = [
    { value: "all", label: "Everyone" },
    { value: "me", label: "Assigned to me" },
    { value: "unassigned", label: "Unassigned" },
    ...(users?.items ?? []).filter((u) => u.clerkUserId !== userId).map((u) => ({ value: u.clerkUserId, label: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email })),
  ];
  const active = (search.trim() ? 1 : 0) + (assignee !== "all" ? 1 : 0) + (status !== "open" ? 1 : 0);
  const filtered = active > 0;

  return (
    <div className="space-y-4">
      <div>
        <div>
          <ListToolbar
            activeCount={active}
            summary={data ? `${rows.length} ${rows.length === 1 ? "task" : "tasks"}` : undefined}
            actions={
              <ListActions
                onAdd={() => setCreating(true)}
                exportDisabled={rows.length === 0}
                onExport={() => downloadCsv("tasks", ["Task", "Notes", "Project", "Assigned to", "Due", "Status"], rows.map((t) => [t.title, t.notes, [t.jobNumber, t.projectName].filter(Boolean).join(" - "), t.assigneeName, t.dueDate, t.status]))}
              />
            }
          >
            <SearchField value={search} onChange={setSearch} placeholder={project ? "Search tasks" : "Search task, notes or project"} />
            <FilterSelect label="Assigned to" value={assignee} onChange={setAssignee} options={assigneeOptions} />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              options={[
                { value: "open", label: "Open" },
                { value: "done", label: "Done" },
                { value: "all", label: "Open and done" },
              ]}
            />
          </ListToolbar>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-4">
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          heading={filtered ? "No tasks match" : project ? "No tasks on this project yet" : "No tasks yet"}
          description={filtered ? "Try changing the search or filters." : "Add an action item and set a reminder so it does not slip."}
          action={filtered ? undefined : { label: "New task", onClick: () => setCreating(true) }}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                {!project && <TableHead>Project</TableHead>}
                <TableHead>Assigned to</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Reminder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const isOpen = t.status === "open";
                const due = dueState(t.dueDate, isOpen);
                const row: TaskRow = { ...t, remindAt: t.remindAt };
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setEditing(row)}>
                    <TableCell className="max-w-[32rem]">
                      <div className="flex items-start gap-3">
                        <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                          <Checkbox
                            aria-label={isOpen ? `Mark "${t.title}" done` : `Reopen "${t.title}"`}
                            checked={!isOpen}
                            disabled={setDone.isPending}
                            onCheckedChange={(v) => setDone.mutate({ id: t.id, done: v === true })}
                          />
                        </span>
                        <div className="min-w-0">
                          <div className={cn("font-medium", !isOpen && "text-muted-foreground line-through")}>{t.title}</div>
                          {t.notes && <div className="line-clamp-2 text-xs font-normal text-muted-foreground">{t.notes}</div>}
                        </div>
                      </div>
                    </TableCell>
                    {!project && (
                      <TableCell>
                        {t.projectSlug ? (
                          <Link href={`/projects/${t.projectSlug}/tasks`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                            {t.jobNumber ? `${t.jobNumber} - ` : ""}
                            {t.projectName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">General</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>{t.assigneeName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className={cn(due === "overdue" && "font-medium text-destructive", due === "today" && "font-medium text-amber-600")}>
                      {t.dueDate ? (
                        <>
                          {prettyDate(t.dueDate)}
                          {due === "overdue" && " (overdue)"}
                          {due === "today" && " (today)"}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.remindAt ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          {t.remindBell && <Bell className="h-3.5 w-3.5" aria-label="Under the bell" />}
                          {t.remindEmail && <Mail className="h-3.5 w-3.5" aria-label="By email" />}
                          {prettyMoment(t.remindAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <TaskDialog open={creating} onOpenChange={setCreating} project={project ?? null} />
      <TaskDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} task={editing} />
    </div>
  );
}
