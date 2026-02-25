"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, X, Plus, Trash2 } from "lucide-react";
import type { ProjectRole } from "@construction/shared";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";

const NOTE_MAX = 500;

export default function ProjectOverviewPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("viewer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const utils = trpc.useUtils();

  // Fetch project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });

  // Use project.id for all subsequent queries
  const projectId = project?.id ?? "";

  const { data: usersData } = trpc.user.list.useQuery({ limit: 100, offset: 0 });

  const { data: notesData, isLoading: notesLoading } = trpc.notes.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const addTeamMemberMutation = trpc.project.addTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      toast.success("Team member added");
      setAddMemberOpen(false);
      setNewMemberUserId("");
      setNewMemberRole("viewer");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add team member");
    },
  });

  const removeTeamMemberMutation = trpc.project.removeTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      toast.success("Team member removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove team member");
    },
  });

  const inviteUserMutation = trpc.user.invite.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      toast.success("Invitation sent successfully");
      setInviteUserOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ projectId });
      setNoteContent("");
      toast.success("Note added");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add note");
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ projectId });
      toast.success("Note deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete note");
    },
  });

  const handleAddMember = () => {
    if (!newMemberUserId.trim()) {
      toast.error("User ID is required");
      return;
    }
    addTeamMemberMutation.mutate({
      projectId,
      userId: newMemberUserId,
      role: newMemberRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      removeTeamMemberMutation.mutate({
        projectId,
        userId,
      });
    }
  };

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="space-y-8">

      <h1 className="text-2xl font-bold">Overview</h1>

      {project.description && (
        <p className="text-sm text-muted-foreground -mt-4">{project.description}</p>
      )}

      {/* Dimensions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Dimensions</h2>
        <dl className="grid grid-cols-4 gap-2">
          {[
            { label: "Width", value: project.buildingWidth ? `${project.buildingWidth} ft` : "—" },
            { label: "Length", value: project.buildingLength ? `${project.buildingLength} ft` : "—" },
            { label: "Height", value: project.buildingHeight ? `${project.buildingHeight} ft` : "—" },
            { label: "Sq Ft", value: project.buildingSqft ? Number(project.buildingSqft).toLocaleString() : "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Project Team */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Project Team</h2>
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Assign a team member to this project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-select">Team Member</Label>
                  <div className="flex gap-2">
                    <SearchableSelect
                      options={
                        usersData?.items
                          .filter((user) => {
                            const existingMemberIds = new Set(
                              project?.teamMembers?.map((m: any) => m.userId) || []
                            );
                            return !existingMemberIds.has(user.userId);
                          })
                          .map((user) => ({
                            value: user.userId,
                            label: user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName} (${user.email})`
                              : user.email,
                          })) || []
                      }
                      value={newMemberUserId}
                      onValueChange={setNewMemberUserId}
                      placeholder="Select team member"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setAddMemberOpen(false);
                        setInviteUserOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Project Role</Label>
                  <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as ProjectRole)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="superintendent">Superintendent</SelectItem>
                      <SelectItem value="foreman">Foreman</SelectItem>
                      <SelectItem value="estimator">Estimator</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMember} disabled={addTeamMemberMutation.isPending}>
                  {addTeamMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {project.teamMembers && project.teamMembers.length > 0 ? (
          <div className="space-y-1">
            {project.teamMembers.map((member: any) => {
              const initials = [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
              const fullName = member.firstName && member.lastName
                ? `${member.firstName} ${member.lastName}`
                : member.email || member.userId;
              const roleLabel = (member.role as string)
                .split("_")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              return (
                <div key={member.userId} className="group flex items-center gap-2.5 py-1">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm font-medium">{fullName}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{roleLabel}</span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => handleRemoveMember(member.userId)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No team members assigned</p>
        )}
      </div>

      {/* Project Notes */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Project Notes</h2>
        {/* Note list (above the input, reverse-chron from API) */}
        <div className="space-y-3 mb-3">
          {notesLoading && (
            <p className="text-sm text-muted-foreground">Loading notes...</p>
          )}
          {notesData && notesData.length === 0 && null /* empty state: just show the input */}
          {notesData?.map((note: any) => (
            <div key={note.id} className="group flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {note.authorName} &middot;{" "}
                  {new Date(note.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                disabled={deleteNoteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Input area at bottom */}
        <div className="space-y-2">
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value.slice(0, NOTE_MAX))}
            placeholder="Add a note..."
            className="resize-none min-h-[80px]"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${noteContent.length >= NOTE_MAX - 50 ? "text-destructive" : "text-muted-foreground"}`}>
              {noteContent.length}/{NOTE_MAX}
            </span>
            <Button
              size="sm"
              onClick={() => {
                if (!noteContent.trim()) return;
                createNoteMutation.mutate({ projectId, content: noteContent.trim() });
              }}
              disabled={createNoteMutation.isPending || !noteContent.trim()}
            >
              {createNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </div>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={inviteUserOpen} onOpenChange={setInviteUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteUserOpen(false);
                setInviteEmail("");
                setInviteFirstName("");
                setInviteLastName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!inviteEmail.trim()) {
                  toast.error("Email is required");
                  return;
                }
                inviteUserMutation.mutate({
                  email: inviteEmail,
                  firstName: inviteFirstName || undefined,
                  lastName: inviteLastName || undefined,
                });
              }}
              disabled={inviteUserMutation.isPending}
            >
              {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
