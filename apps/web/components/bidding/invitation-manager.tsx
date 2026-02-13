"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { UserPlus, Mail, X, Building2 } from "lucide-react";
import type { InvitationStatus } from "@construction/shared";

interface InvitationManagerProps {
  rfqId: string;
  projectId: string;
  rfqTrades: number[];
  invitations: Array<{
    id: string;
    status: InvitationStatus;
    subcontractorId?: string | null;
    externalEmail?: string | null;
    externalCompanyName?: string | null;
    subcontractor?: {
      companyName: string;
      contactEmail?: string | null;
    } | null;
  }>;
}

const invitationStatusColors: Record<InvitationStatus, string> = {
  pending: "bg-gray-500/10 text-gray-700 border-gray-200",
  viewed: "bg-blue-500/10 text-blue-700 border-blue-200",
  responded: "bg-green-500/10 text-green-700 border-green-200",
  declined: "bg-red-500/10 text-red-700 border-red-200",
};

export function InvitationManager({
  rfqId,
  projectId,
  rfqTrades,
  invitations,
}: InvitationManagerProps) {
  const utils = trpc.useUtils();
  const [directoryDialogOpen, setDirectoryDialogOpen] = useState(false);
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [externalCompanyName, setExternalCompanyName] = useState("");

  // Get subcontractors matching RFQ trades
  const { data: subcontractors } = trpc.subcontractor.getByTrades.useQuery(
    { trades: rfqTrades },
    { enabled: directoryDialogOpen }
  );

  const addInvitationMutation = trpc.rfq.addInvitation.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("Invitation sent");
      setDirectoryDialogOpen(false);
      setExternalDialogOpen(false);
      setSelectedSubcontractorId("");
      setExternalEmail("");
      setExternalCompanyName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const removeInvitationMutation = trpc.rfq.removeInvitation.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("Invitation removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove invitation");
    },
  });

  const handleAddFromDirectory = () => {
    if (!selectedSubcontractorId) {
      toast.error("Please select a subcontractor");
      return;
    }
    addInvitationMutation.mutate({
      rfqId,
      subcontractorId: selectedSubcontractorId,
    });
  };

  const handleAddExternal = () => {
    if (!externalEmail || !externalCompanyName) {
      toast.error("Email and company name are required");
      return;
    }
    addInvitationMutation.mutate({
      rfqId,
      externalEmail,
      externalCompanyName,
    });
  };

  const handleRemove = (invitationId: string) => {
    if (confirm("Remove this invitation?")) {
      removeInvitationMutation.mutate({ id: invitationId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={directoryDialogOpen} onOpenChange={setDirectoryDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              Add from Directory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Subcontractor</DialogTitle>
              <DialogDescription>
                Select a subcontractor from your directory
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subcontractor</Label>
                <SearchableSelect
                  options={
                    subcontractors?.map((sub) => ({
                      value: sub.id,
                      label: `${sub.companyName}${sub.contactEmail ? ` (${sub.contactEmail})` : ""}`,
                    })) || []
                  }
                  value={selectedSubcontractorId}
                  onValueChange={setSelectedSubcontractorId}
                  placeholder="Search subcontractors..."
                />
                {subcontractors && subcontractors.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No subcontractors found matching the selected trades
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDirectoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddFromDirectory}
                disabled={
                  !selectedSubcontractorId || addInvitationMutation.isPending
                }
              >
                {addInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={externalDialogOpen} onOpenChange={setExternalDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Invite External
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite External Bidder</DialogTitle>
              <DialogDescription>
                Invite a subcontractor not in your directory
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="external-company">Company Name *</Label>
                <Input
                  id="external-company"
                  value={externalCompanyName}
                  onChange={(e) => setExternalCompanyName(e.target.value)}
                  placeholder="Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external-email">Email *</Label>
                <Input
                  id="external-email"
                  type="email"
                  value={externalEmail}
                  onChange={(e) => setExternalEmail(e.target.value)}
                  placeholder="bidder@company.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setExternalDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddExternal}
                disabled={
                  !externalEmail ||
                  !externalCompanyName ||
                  addInvitationMutation.isPending
                }
              >
                {addInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">
                  {invitation.subcontractor?.companyName ||
                    invitation.externalCompanyName ||
                    "Unknown"}
                </TableCell>
                <TableCell>
                  {invitation.subcontractor?.contactEmail ||
                    invitation.externalEmail ||
                    "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={invitationStatusColors[invitation.status]}
                  >
                    {invitation.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {invitation.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(invitation.id)}
                      disabled={removeInvitationMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No invitations sent yet
        </p>
      )}
    </div>
  );
}
