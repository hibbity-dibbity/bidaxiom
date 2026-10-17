"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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

/** The Issue button for a purchase or work order. It asks first, because an issued order is locked and counts as owed. */
export function ConfirmIssueButton(props: {
  number: string;
  vendorName: string | null;
  isWork: boolean;
  total?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  title?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" size={props.size} disabled={props.disabled} title={props.title} onClick={() => setOpen(true)}>
        Issue {props.number}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue {props.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {props.number}
              {props.vendorName ? ` to ${props.vendorName}` : ""}
              {props.total ? ` for ${props.total}` : ""} will be marked issued and locked, and it counts as owed on the Outstanding page. A later change creates a new revision. Issuing does not email it; use Email to vendor for that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                props.onConfirm();
              }}
            >
              Issue {props.isWork ? "work order" : "PO"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
