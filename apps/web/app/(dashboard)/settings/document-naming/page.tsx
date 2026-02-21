"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAbilities } from "@/lib/abilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import type { DocumentNamingSettings } from "@construction/shared";

// ----- constants -----

const DOC_TYPES = ["proposal", "change_order", "payment_app", "rfq"] as const;
type DocType = (typeof DOC_TYPES)[number];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  proposal: "Proposal",
  change_order: "Change Order",
  payment_app: "Payment Application",
  rfq: "RFQ",
};

/** Shorthand substituted in the live preview for each doc type */
const DOC_TYPE_SHORTHANDS: Record<DocType, string> = {
  proposal: "PROPOSAL",
  change_order: "CO",
  payment_app: "PAY-APP",
  rfq: "RFQ",
};

/** All supported template variables */
const SUPPORTED_VARIABLES = [
  "{JOB-NUMBER}",
  "{PROJECT-NAME}",
  "{DOC-TYPE}",
  "{SEQ}",
  "{YEAR}",
  "{MONTH}",
  "{DATE}",
];

const DEFAULT_TEMPLATE = "{DOC-TYPE}-{JOB-NUMBER}-{DATE}";

// ----- helpers -----

function buildPreview(template: string, docType: DocType): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const date = `${year}-${month}-${now.getDate().toString().padStart(2, "0")}`;

  const effectiveTemplate = template.trim() || DEFAULT_TEMPLATE;

  return (
    effectiveTemplate
      .replace(/\{JOB-NUMBER\}/g, "2026-001")
      .replace(/\{PROJECT-NAME\}/g, "example-project")
      .replace(/\{DOC-TYPE\}/g, DOC_TYPE_SHORTHANDS[docType])
      .replace(/\{SEQ\}/g, "003")
      .replace(/\{YEAR\}/g, year)
      .replace(/\{MONTH\}/g, month)
      .replace(/\{DATE\}/g, date) + ".pdf"
  );
}

// ----- sub-component -----

interface DocTypeCardProps {
  docType: DocType;
  template: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function DocTypeCard({ docType, template, disabled, onChange }: DocTypeCardProps) {
  const preview = buildPreview(template, docType);

  const appendVariable = (variable: string) => {
    onChange(template + variable);
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{DOC_TYPE_LABELS[docType]}</h2>
        <p className="text-sm text-muted-foreground">
          Naming template for {DOC_TYPE_LABELS[docType].toLowerCase()} PDFs
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`template-${docType}`}>Naming Template</Label>
        <Input
          id={`template-${docType}`}
          value={template}
          onChange={(e) => onChange(e.target.value)}
          placeholder={DEFAULT_TEMPLATE}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Click to insert variable:
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_VARIABLES.map((variable) => (
            <Badge
              key={variable}
              variant="secondary"
              className={
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              }
              onClick={() => {
                if (!disabled) appendVariable(variable);
              }}
            >
              {variable}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-muted px-4 py-2 text-sm">
        <span className="text-muted-foreground">Preview: </span>
        <span className="font-mono font-semibold">{preview}</span>
      </div>
    </Card>
  );
}

// ----- page -----

/**
 * Document Naming settings page.
 * Allows admins to configure per-doc-type naming templates for generated PDFs.
 * Non-admins see a read-only view.
 */
export default function DocumentNamingPage() {
  const abilities = useAbilities();
  const canManage = abilities.can("manage", "CompanySettings");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.company.getDocumentNaming.useQuery();

  // Per-doc-type template state
  const [templates, setTemplates] = useState<Record<DocType, string>>({
    proposal: "",
    change_order: "",
    payment_app: "",
    rfq: "",
  });

  // Populate state when data loads
  useEffect(() => {
    if (data) {
      const settings: DocumentNamingSettings = data.documentNamingSettings;
      setTemplates({
        proposal: settings.proposal?.template ?? "",
        change_order: settings.change_order?.template ?? "",
        payment_app: settings.payment_app?.template ?? "",
        rfq: settings.rfq?.template ?? "",
      });
    }
  }, [data]);

  const updateMutation = trpc.company.updateDocumentNaming.useMutation({
    onSuccess: () => {
      utils.company.getDocumentNaming.invalidate();
      toast.success("Document naming conventions saved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save naming conventions");
    },
  });

  const handleSave = () => {
    // Only include types that have a template (non-empty)
    const settings: Record<string, { template: string }> = {};
    for (const docType of DOC_TYPES) {
      if (templates[docType].trim()) {
        settings[docType] = { template: templates[docType].trim() };
      }
    }
    updateMutation.mutate({ settings });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Naming</h1>
          <p className="text-muted-foreground">
            Configure how generated PDFs are named. Leave blank to use the default format.
          </p>
        </div>
        <div className="space-y-4">
          {DOC_TYPES.map((type) => (
            <Skeleton key={type} className="h-[200px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Naming</h1>
        <p className="text-muted-foreground">
          Configure how generated PDFs are named. Leave blank to use the default format.
        </p>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-border bg-muted p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Read-only access</p>
            <p className="text-sm text-muted-foreground">
              Only company administrators can modify document naming conventions
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {DOC_TYPES.map((docType) => (
          <DocTypeCard
            key={docType}
            docType={docType}
            template={templates[docType]}
            disabled={!canManage}
            onChange={(value) =>
              setTemplates((prev) => ({ ...prev, [docType]: value }))
            }
          />
        ))}
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Conventions"}
          </Button>
        </div>
      )}
    </div>
  );
}
