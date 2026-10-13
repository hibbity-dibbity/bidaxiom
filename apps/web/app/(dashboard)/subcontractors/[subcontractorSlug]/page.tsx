"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Building2, User, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SubcontractorForm } from "@/components/bidding/subcontractor-form";
import { BidHistoryTable } from "@/components/bidding/bid-history-table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { SubcontractorStatus } from "@construction/shared";

export default function SubcontractorDetailPage({ params }: { params: { subcontractorSlug: string } }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: subcontractor, isLoading } = trpc.subcontractor.getBySlug.useQuery({
    slug: params.subcontractorSlug,
  });

  const updateMutation = trpc.subcontractor.update.useMutation({
    onSuccess: () => {
      utils.subcontractor.getBySlug.invalidate({ slug: params.subcontractorSlug });
      utils.subcontractor.list.invalidate();
      toast.success("Subcontractor updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update subcontractor");
    },
  });

  const deleteMutation = trpc.subcontractor.delete.useMutation({
    onSuccess: () => {
      toast.success("Subcontractor deleted successfully");
      router.push("/subcontractors");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete subcontractor");
    },
  });

  const handleStatusToggle = () => {
    if (!subcontractor) return;
    const newStatus: SubcontractorStatus =
      subcontractor.status === "active" ? "inactive" : "active";
    updateMutation.mutate({
      id: subcontractor.id,
      status: newStatus,
    });
  };

  const handleDelete = () => {
    if (!subcontractor) return;
    deleteMutation.mutate({ id: subcontractor.id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!subcontractor) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Subcontractor not found</h2>
          <p className="text-muted-foreground mt-2">
            The subcontractor you're looking for doesn't exist.
          </p>
          <Button onClick={() => router.push("/subcontractors")} className="mt-4">
            Back to directory
          </Button>
        </div>
      </div>
    );
  }

  const subStatusToVariant = (status: string) => {
    switch (status) {
      case "active": return "active" as const;
      case "inactive": return "cancelled" as const;
      case "blacklisted": return "rejected" as const;
      default: return "draft" as const;
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      active: "Active",
      inactive: "Inactive",
      blacklisted: "Blacklisted",
    };
    return statusLabels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/subcontractors"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to directory
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{subcontractor.companyName}</h1>
              <StatusBadge variant={subStatusToVariant(subcontractor.status)}>
                {getStatusLabel(subcontractor.status)}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground">
              Subcontractor details and bid history
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={handleStatusToggle}
              disabled={updateMutation.isPending}
            >
              {subcontractor.status === "active" ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Subcontractor contact details and trade specialties</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subcontractor.contactName && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contact Name</p>
                  <p className="text-sm text-muted-foreground">{subcontractor.contactName}</p>
                </div>
              </div>
            )}

            {subcontractor.contactEmail && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${subcontractor.contactEmail}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {subcontractor.contactEmail}
                  </a>
                </div>
              </div>
            )}

            {subcontractor.contactPhone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href={`tel:${subcontractor.contactPhone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {subcontractor.contactPhone}
                  </a>
                </div>
              </div>
            )}

            {subcontractor.street1 && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {[
                      subcontractor.street1,
                      subcontractor.street2,
                      subcontractor.city,
                      [subcontractor.state, subcontractor.zip].filter(Boolean).join(" "),
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Trade Specialties</p>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const tradeArr = (subcontractor as any).trade as string[] ?? [];
                if (tradeArr.length === 0) {
                  return <span className="text-sm text-muted-foreground">—</span>;
                }
                return tradeArr.map((t: string) => {
                  const label = t === "Other" && (subcontractor as any).tradeOther
                    ? (subcontractor as any).tradeOther
                    : t;
                  return (
                    <Badge key={t} variant="outline">
                      {label}
                    </Badge>
                  );
                });
              })()}
            </div>
          </div>

          {subcontractor.notes && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Internal Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {subcontractor.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bid History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bid History</CardTitle>
          <CardDescription>Past bids submitted by this subcontractor</CardDescription>
        </CardHeader>
        <CardContent>
          <BidHistoryTable bidHistory={subcontractor.bidHistory} />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subcontractor</DialogTitle>
            <DialogDescription>
              Update subcontractor information
            </DialogDescription>
          </DialogHeader>
          <SubcontractorForm
            mode="edit"
            defaultValues={{
              id: subcontractor.id,
              companyName: subcontractor.companyName,
              contactName: subcontractor.contactName,
              contactEmail: subcontractor.contactEmail ?? undefined,
              contactPhone: subcontractor.contactPhone ?? undefined,
              street1: subcontractor.street1,
              street2: subcontractor.street2,
              city: subcontractor.city,
              state: subcontractor.state,
              zip: subcontractor.zip,
              trades: subcontractor.trades,
              trade: (subcontractor as any).trade ?? [],
              tradeOther: (subcontractor as any).tradeOther ?? "",
              notes: subcontractor.notes,
            }}
            onSuccess={(updated) => {
              setIsEditing(false);
              // If slug regenerated due to name change, navigate to new URL
              if (updated?.slug && updated.slug !== params.subcontractorSlug) {
                router.replace(`/subcontractors/${updated.slug}`);
              } else {
                // Refresh data for the current slug
                utils.subcontractor.getBySlug.invalidate({ slug: params.subcontractorSlug });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {subcontractor.companyName} from your directory.
              This action cannot be undone. If this subcontractor has active bids, deletion will be prevented.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
