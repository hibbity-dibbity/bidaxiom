"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { KeyRound, Trash2, UserPlus, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Custom member management page replacing Clerk OrganizationProfile.
 *
 * Features:
 * - Member list with role management (admin only)
 * - Pending invitations list
 * - Invite form (admin only)
 * - Remove member functionality (admin only)
 */
export default function MembersPage() {
  const { orgId, orgRole, orgName } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("org:member");
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [memberToReset, setMemberToReset] = useState<{ userId: string; label: string } | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null);

  const isAdmin = orgRole === "org:admin";

  const utils = trpc.useUtils();

  const { data: members, isLoading: membersLoading } = trpc.organization.listMembers.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId }
  );

  const { data: invitations, isLoading: invitationsLoading } = trpc.organization.listInvitations.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId && isAdmin }
  );

  const inviteMutation = trpc.organization.invite.useMutation({
    onSuccess: (r) => {
      if (r.emailSent) toast.success(`Invitation emailed to ${r.email}`);
      else toast.error(`Invitation created, but the email to ${r.email} was NOT sent`, { description: `${r.emailError ?? "Unknown error"} Use Resend under Pending Invitations to try again.`, duration: 12000 });
      setInviteEmail("");
      setInviteRole("org:member");
      utils.organization.listInvitations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const resendInvitationMutation = trpc.organization.resendInvitation.useMutation({
    onSuccess: (r) => {
      if (r.emailSent) toast.success(`Invitation emailed again to ${r.email}`);
      else toast.error(`The email to ${r.email} was NOT sent`, { description: r.emailError ?? "Unknown error", duration: 12000 });
      utils.organization.listInvitations.invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to resend invitation"),
  });

  const resetMutation = trpc.organization.resetMemberSignIn.useMutation({
    onSuccess: (r) => {
      toast.success(`Sign-in reset. A password reset link was emailed to ${r.email}.`);
      setMemberToReset(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset sign-in");
      setMemberToReset(null);
    },
  });

  const removeMutation = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed successfully");
      setMemberToRemove(null);
      utils.organization.listMembers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove member");
      setMemberToRemove(null);
    },
  });

  const updateRoleMutation = trpc.organization.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
      utils.organization.listMembers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const revokeInvitationMutation = trpc.organization.revokeInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked");
      setInvitationToRevoke(null);
      utils.organization.listInvitations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke invitation");
      setInvitationToRevoke(null);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }

    inviteMutation.mutate({
      organizationId: orgId,
      email: inviteEmail.trim(),
      role: inviteRole as any,
    });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (!orgId || !isAdmin) return;

    updateRoleMutation.mutate({
      organizationId: orgId,
      userId,
      role: newRole as any,
    });
  };

  const handleRemoveMember = () => {
    if (!orgId || !memberToRemove) return;

    removeMutation.mutate({
      organizationId: orgId,
      userId: memberToRemove,
    });
  };

  const handleRevokeInvitation = () => {
    if (!invitationToRevoke) return;

    revokeInvitationMutation.mutate({
      invitationId: invitationToRevoke,
    });
  };

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "org:admin") return "default";
    return "secondary";
  };

  const formatRole = (role: string) => {
    return role.replace("org:", "").replace("_", " ");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground">
          Manage your team and invite new members
          {orgName ? ` to ${orgName}` : ""}
        </p>
      </div>

      {/* Invite Form - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
            <CardDescription>
              Send an invitation to join your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteMutation.isPending}
                />
              </div>
              <div className="w-48">
                <Label htmlFor="role" className="sr-only">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviteMutation.isPending}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org:admin">Admin</SelectItem>
                    <SelectItem value="org:project_manager">Project Manager</SelectItem>
                    <SelectItem value="org:accountant">Accountant</SelectItem>
                    <SelectItem value="org:estimator">Estimator</SelectItem>
                    <SelectItem value="org:superintendent">Superintendent</SelectItem>
                    <SelectItem value="org:foreman">Foreman</SelectItem>
                    <SelectItem value="org:member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={inviteMutation.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                {inviteMutation.isPending ? "Sending..." : "Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members?.length || 0} member{members?.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.firstName, member.lastName, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.userId, value)}
                          disabled={updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="org:admin">Admin</SelectItem>
                            <SelectItem value="org:project_manager">Project Manager</SelectItem>
                            <SelectItem value="org:accountant">Accountant</SelectItem>
                            <SelectItem value="org:estimator">Estimator</SelectItem>
                            <SelectItem value="org:superintendent">Superintendent</SelectItem>
                            <SelectItem value="org:foreman">Foreman</SelectItem>
                            <SelectItem value="org:member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {formatRole(member.role)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(member.joinedAt)}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reset sign-in"
                          onClick={() => setMemberToReset({ userId: member.userId, label: member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.email })}
                          disabled={resetMutation.isPending}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member.userId)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-muted p-3">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">No members yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Invite team members to collaborate on projects</p>
                </div>
                {isAdmin && (
                  <Button onClick={() => document.getElementById("email")?.focus()}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              {invitations?.filter(i => i.status === "pending").length || 0} pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : invitations && invitations.filter(i => i.status === "pending").length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations
                    .filter(i => i.status === "pending")
                    .map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{formatRole(invitation.role)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInvitationMutation.mutate({ invitationId: invitation.id })}
                            disabled={resendInvitationMutation.isPending}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInvitationToRevoke(invitation.id)}
                            disabled={revokeInvitationMutation.isPending}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-full bg-muted p-3">
                    <UserPlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No pending invitations</h3>
                    <p className="text-sm text-muted-foreground mt-1">Invited members will appear here until they accept</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Sign-in Confirmation Dialog */}
      <AlertDialog open={!!memberToReset} onOpenChange={(open) => !open && setMemberToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset sign-in for {memberToReset?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their current password stops working and they are signed out. We email them a link to choose a new password.
              Their authenticator app and passkeys are removed, and they must set up security again the next time they sign in.
              Use this if you think their account is at risk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orgId && memberToReset && resetMutation.mutate({ organizationId: orgId, userId: memberToReset.userId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset sign-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invitation Confirmation Dialog */}
      <AlertDialog open={!!invitationToRevoke} onOpenChange={(open) => !open && setInvitationToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invitation?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvitation}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
