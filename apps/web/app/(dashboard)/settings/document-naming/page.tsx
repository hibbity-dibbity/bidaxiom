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
import {
  PDF_DOC_TYPES,
  PDF_DOC_TYPE_LABELS,
  REVISABLE_PDF_DOC_TYPES,
  DEFAULT_NAMING,
  NAMING_VARIABLES,
  resolveDocumentFileName,
  type DocumentNamingSettings,
  type PdfDocType,
} from "@construction/shared";

// ----- constants -----

type Pattern = { template: string; revisionTemplate: string };

const SAMPLE = {
  jobNumber: "26-014",
  projectName: "Federal Rd 60x400",
  documentName: "Building Insulation",
  number: "CO26-014-01",
};

// ----- sub-component -----

interface DocTypeCardProps {
  docType: PdfDocType;
  value: Pattern;
  disabled: boolean;
  onChange: (value: Pattern) => void;
}

function PatternField({ id, label, hint, value, placeholder, disabled, onChange, preview }: {
  id: string; label: string; hint: string; value: string; placeholder: string; disabled: boolean;
  onChange: (v: string) => void; preview: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete="off" />
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="rounded-md bg-muted px-4 py-2 text-sm">
        <span className="text-muted-foreground">Example: </span>
        <span className="font-mono font-semibold">{preview}</span>
      </div>
    </div>
  );
}

function DocTypeCard({ docType, value, disabled, onChange }: DocTypeCardProps) {
  const [focused, setFocused] = useState<"template" | "revisionTemplate">("template");
  const revisable = REVISABLE_PDF_DOC_TYPES.includes(docType);
  const def = DEFAULT_NAMING[docType];
  const preview = (revision: number) => {
    const number = docType === "proposal" ? SAMPLE.jobNumber : docType === "invoice" ? "INV-26-014-01" : docType === "order" ? "PO26-014-01" : SAMPLE.number;
    return resolveDocumentFileName({ [docType]: value }, docType, { ...SAMPLE, number, revision });
  };
  const insert = (variable: string) => {
    const key = revisable ? focused : "template";
    onChange({ ...value, [key]: (value[key] ?? "") + variable });
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{PDF_DOC_TYPE_LABELS[docType]}</h2>
        <p className="text-sm text-muted-foreground">File name for {PDF_DOC_TYPE_LABELS[docType].toLowerCase()} PDFs. Leave a box blank to use its default.</p>
      </div>

      <div onFocus={() => setFocused("template")}>
        <PatternField
          id={`template-${docType}`}
          label={revisable ? "Original (Rev 0)" : "File name"}
          hint={`Default: ${def.template}.pdf`}
          value={value.template}
          placeholder={def.template}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, template: v })}
          preview={preview(0)}
        />
      </div>

      {revisable && (
        <div onFocus={() => setFocused("revisionTemplate")}>
          <PatternField
            id={`revision-template-${docType}`}
            label="Revisions (Rev 1 and up)"
            hint={`Default: ${def.revisionTemplate}.pdf`}
            value={value.revisionTemplate}
            placeholder={def.revisionTemplate}
            disabled={disabled}
            onChange={(v) => onChange({ ...value, revisionTemplate: v })}
            preview={preview(2)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Click to add a variable{revisable ? " to the box you last clicked" : ""}:</Label>
        <div className="flex flex-wrap gap-1.5">
          {NAMING_VARIABLES.map((variable) => (
            <Badge
              key={variable}
              variant="secondary"
              className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { if (!disabled) insert(variable); }}
            >
              {variable}
            </Badge>
          ))}
        </div>
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
  const blank: Pattern = { template: "", revisionTemplate: "" };
  const [templates, setTemplates] = useState<Record<PdfDocType, Pattern>>({
    proposal: blank, change_order: blank, invoice: blank, order: blank,
  });

  // Populate state when data loads
  useEffect(() => {
    if (data) {
      const settings: DocumentNamingSettings = data.documentNamingSettings;
      const get = (t: PdfDocType): Pattern => ({
        template: settings[t]?.template ?? "",
        revisionTemplate: settings[t]?.revisionTemplate ?? "",
      });
      setTemplates({ proposal: get("proposal"), change_order: get("change_order"), invoice: get("invoice"), order: get("order") });
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
    const settings: Record<string, { template?: string; revisionTemplate?: string }> = {};
    for (const docType of PDF_DOC_TYPES) {
      const t = templates[docType].template.trim();
      const r = templates[docType].revisionTemplate.trim();
      if (t || r) settings[docType] = { ...(t ? { template: t } : {}), ...(r ? { revisionTemplate: r } : {}) };
    }
    updateMutation.mutate({ settings });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Document Naming</h1>
          <p className="text-muted-foreground">
            Configure how downloaded and emailed PDFs are named. Leave a box blank to use the default.
          </p>
        </div>
        <div className="space-y-4">
          {PDF_DOC_TYPES.map((type) => (
            <Skeleton key={type} className="h-[200px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document Naming</h1>
        <p className="text-muted-foreground">
          Configure how downloaded and emailed PDFs are named. Leave a box blank to use the default.
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
        {PDF_DOC_TYPES.map((docType) => (
          <DocTypeCard
            key={docType}
            docType={docType}
            value={templates[docType]}
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
