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
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronsUpDown, Calendar as CalendarIcon, X } from "lucide-react";
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
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);

  const utils = trpc.useUtils();

  // Fetch available users
  const { data: users } = trpc.user.list.useQuery();

  // Fetch current shares (need to add this procedure if it doesn't exist)
  // For now, we'll handle this in the getSharedWithMe query
  // TODO: Add document.getShares procedure to show current shares

  const shareDocumentMutation = trpc.document.shareDocument.useMutation({
    onSuccess: () => {
      toast.success("Document shared successfully");
      setSelectedUserId("");
      setPermissionLevel("view");
      setExpiresAt(undefined);
      utils.document.getSharedWithMe.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to share document");
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
      expiresAt: expiresAt?.toISOString(),
    });
  };

  const selectedUser = users?.find((u: any) => u.clerkUserId === selectedUserId);

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
                    {users?.map((user: any) => (
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !expiresAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={setExpiresAt}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {expiresAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpiresAt(undefined)}
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
            disabled={!selectedUserId || shareDocumentMutation.isLoading}
            className="w-full"
          >
            {shareDocumentMutation.isLoading ? "Sharing..." : "Share Document"}
          </Button>

          {/* Current Shares Section - Placeholder */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Current Shares</Label>
            <div className="text-sm text-muted-foreground italic">
              Share history will appear here after implementation
            </div>
            {/* TODO: Add document.getShares procedure and display list here with Revoke buttons */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
