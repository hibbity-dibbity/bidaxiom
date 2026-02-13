"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ShareDialogProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ documentId, open, onOpenChange }: ShareDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permissionLevel, setPermissionLevel] = useState<"view" | "edit">("view");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);

  const utils = trpc.useUtils();

  // Fetch available users
  const { data: usersData } = trpc.user.list.useQuery({ limit: 100 });
  const users = usersData?.items || [];

  // Fetch current shares
  const { data: currentShares, isLoading: sharesLoading } = trpc.document.getDocumentPermissions.useQuery(
    { documentId },
    { enabled: open }
  );

  const shareDocumentMutation = trpc.document.shareDocument.useMutation({
    onSuccess: () => {
      toast.success("Document shared successfully");
      setSelectedUserId("");
      setPermissionLevel("view");
      setExpiresAt("");
      utils.document.getSharedWithMe.invalidate();
      utils.document.getDocumentPermissions.invalidate({ documentId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to share document");
    },
  });

  const revokePermissionMutation = trpc.document.revokeDocumentPermission.useMutation({
    onSuccess: () => {
      toast.success("Permission revoked");
      utils.document.getDocumentPermissions.invalidate({ documentId });
      utils.document.getSharedWithMe.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke permission");
    },
  });

  const handleShare = () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    shareDocumentMutation.mutate({
      documentId,
      userId: selectedUserId,
      permissionLevel,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  };

  const selectedUser = users.find((u: any) => u.clerkUserId === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Grant access to this document to other users in your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Selector */}
          <div className="space-y-2">
            <Label>Select User</Label>
            <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userComboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedUser
                    ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`
                    : "Select user..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {users.map((user: any) => (
                      <CommandItem
                        key={user.clerkUserId}
                        value={`${user.firstName} ${user.lastName} ${user.email}`}
                        onSelect={() => {
                          setSelectedUserId(user.clerkUserId);
                          setUserComboboxOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUserId === user.clerkUserId ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Permission Level */}
          <div className="space-y-2">
            <Label>Permission Level</Label>
            <RadioGroup value={permissionLevel} onValueChange={(value) => setPermissionLevel(value as "view" | "edit")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="view" id="view" />
                <Label htmlFor="view" className="font-normal cursor-pointer">
                  View Only - Can view and download
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="edit" id="edit" />
                <Label htmlFor="edit" className="font-normal cursor-pointer">
                  Can Edit - Can view, download, and upload new versions
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Expiration Date (Optional) */}
          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1"
              />
              {expiresAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpiresAt("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Share Button */}
          <Button
            onClick={handleShare}
            disabled={!selectedUserId || shareDocumentMutation.isPending}
            className="w-full"
          >
            {shareDocumentMutation.isPending ? "Sharing..." : "Share Document"}
          </Button>

          <Separator />

          {/* People with Access Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">People with Access</Label>

            {sharesLoading ? (
              <div className="text-sm text-muted-foreground">Loading current shares...</div>
            ) : !currentShares?.permissions || currentShares.permissions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No one has access to this document yet
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentShares.permissions.map((permission: any) => (
                      <TableRow key={permission.userId}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {permission.user.firstName} {permission.user.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {permission.user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={permission.permissionLevel === "view" ? "secondary" : "default"}>
                            {permission.permissionLevel === "view" ? "View" : "Edit"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {permission.expiresAt
                            ? format(new Date(permission.expiresAt), "PPP")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              revokePermissionMutation.mutate({
                                documentId,
                                userId: permission.userId,
                              });
                            }}
                            disabled={revokePermissionMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
