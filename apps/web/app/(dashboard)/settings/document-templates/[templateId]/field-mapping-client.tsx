"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { BIDAXIOM_FIELD_KEYS } from "@construction/shared";
import type { TemplateDocType, FieldMapping } from "@construction/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkingMapping = FieldMapping;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<TemplateDocType, string> = {
  proposal: "Proposal",
  change_order: "Change Order",
};

/** Special sentinel values for the combobox */
const IGNORE_VALUE = "IGNORED";
const UNMAPPED_VALUE = "__UNMAPPED__";

// ---------------------------------------------------------------------------
// Build combobox options for a given doc type
// ---------------------------------------------------------------------------

function buildComboboxOptions(docType: TemplateDocType): ComboboxOption[] {
  const options: ComboboxOption[] = [
    { value: UNMAPPED_VALUE, label: "— Unmapped (clear)" },
    { value: IGNORE_VALUE, label: "Ignore this field" },
  ];

  // Company group
  for (const item of BIDAXIOM_FIELD_KEYS.company) {
    options.push({ value: item.key, label: `Company: ${item.label}` });
  }

  // Project group
  for (const item of BIDAXIOM_FIELD_KEYS.project) {
    options.push({ value: item.key, label: `Project: ${item.label}` });
  }

  // Doc-type-specific group
  const docSpecificKeys = BIDAXIOM_FIELD_KEYS[docType as keyof typeof BIDAXIOM_FIELD_KEYS];
  if (Array.isArray(docSpecificKeys)) {
    const label = DOC_TYPE_LABELS[docType];
    for (const item of docSpecificKeys as ReadonlyArray<{ key: string; label: string }>) {
      options.push({ value: item.key, label: `${label}: ${item.label}` });
    }
  }

  // Line table group
  for (const item of BIDAXIOM_FIELD_KEYS.lineTable) {
    options.push({ value: item.key, label: `Table: ${item.label}` });
  }

  return options;
}

// ---------------------------------------------------------------------------
// Field reference sidebar (collapsible)
// ---------------------------------------------------------------------------

interface FieldReferenceSidebarProps {
  docType: TemplateDocType;
}

function FieldReferenceSidebar({ docType }: FieldReferenceSidebarProps) {
  const [open, setOpen] = useState(false);

  const sections = [
    { label: "Company", items: BIDAXIOM_FIELD_KEYS.company },
    { label: "Project", items: BIDAXIOM_FIELD_KEYS.project },
    {
      label: DOC_TYPE_LABELS[docType],
      items: (
        BIDAXIOM_FIELD_KEYS[docType as keyof typeof BIDAXIOM_FIELD_KEYS] as ReadonlyArray<{
          key: string;
          label: string;
        }>
      ) ?? [],
    },
    { label: "Line Table", items: BIDAXIOM_FIELD_KEYS.lineTable },
  ];

  return (
    <div className="mt-6 rounded-xl border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 rounded-xl transition-colors"
      >
        <span>BIDAXIOM Field Reference</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <div key={section.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    {section.label}
                  </p>
                  <table className="w-full text-xs">
                    <tbody>
                      {section.items.map((item) => (
                        <tr key={item.key} className="border-b border-border/40 last:border-0">
                          <td className="py-1 pr-4 font-mono text-muted-foreground">
                            {"<<"}
                            {item.key.split(".")[1]}
                            {">>"}
                          </td>
                          <td className="py-1 text-muted-foreground">{item.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface FieldMappingClientProps {
  templateId: string;
}

export function FieldMappingClient({ templateId }: FieldMappingClientProps) {
  const utils = trpc.useUtils();
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Fetch template
  const { data: template, isLoading } = trpc.template.getById.useQuery({ templateId });

  // Working copy of field mappings
  const [workingMappings, setWorkingMappings] = useState<WorkingMapping[]>([]);

  // Initialize working mappings from template data
  useEffect(() => {
    if (template?.fieldMappings) {
      setWorkingMappings(template.fieldMappings as FieldMapping[]);
    }
  }, [template]);

  // Mutations
  const updateMappingsMutation = trpc.template.updateMappings.useMutation({
    onSuccess: (result) => {
      if (result.unmappedCount > 0) {
        toast.warning(
          `${result.unmappedCount} unresolved field(s) were auto-ignored: ${result.unmappedFields.join(", ")}`
        );
      } else {
        toast.success("Mappings saved");
      }
      if (template) {
        utils.template.listByDocType.invalidate({ docType: template.docType as TemplateDocType });
      }
      utils.template.getById.invalidate({ templateId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save mappings");
    },
  });

  const generatePreviewMutation = trpc.template.generatePreview.useMutation({
    onSuccess: (result) => {
      window.open(result.previewUrl, "_blank");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate preview");
    },
  });

  // Handlers
  const handleSave = () => {
    updateMappingsMutation.mutate({
      templateId,
      fieldMappings: workingMappings.map((m) => ({
        detectedField: m.detectedField,
        displayField: m.displayField,
        mappedTo: m.mappedTo,
      })),
    });
  };

  const handlePreview = () => {
    generatePreviewMutation.mutate({ templateId });
  };

  const handleMappingChange = (detectedField: string, value: string) => {
    setWorkingMappings((prev) =>
      prev.map((m) =>
        m.detectedField === detectedField
          ? { ...m, mappedTo: value === UNMAPPED_VALUE ? null : value }
          : m
      )
    );
  };

  const scrollToMappingRow = (detectedField: string) => {
    const el = document.getElementById(`mapping-row-${detectedField}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Highlight briefly
    el?.classList.add("ring-2", "ring-primary", "ring-offset-2");
    setTimeout(() => {
      el?.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }, 1500);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-6 h-[70vh]">
          <Skeleton className="flex-1" />
          <Skeleton className="flex-1" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Link
          href="/settings/document-templates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Document Templates
        </Link>
        <p className="text-muted-foreground">Template not found.</p>
      </div>
    );
  }

  const docType = template.docType as TemplateDocType;
  const detectedFields = (
    template.detectedFields as Array<{ detectedField: string; displayField: string }>
  ) ?? [];
  const comboboxOptions = buildComboboxOptions(docType);

  const mappedCount = workingMappings.filter(
    (m) => m.mappedTo !== null && m.mappedTo !== IGNORE_VALUE
  ).length;
  const totalFields = detectedFields.length;

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <Link
        href="/settings/document-templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Document Templates
      </Link>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
        <p className="text-muted-foreground text-sm">
          {DOC_TYPE_LABELS[docType]} template — map the document fields to BIDAXIOM data
        </p>
      </div>

      {/* Split view */}
      <div className="flex gap-6 min-h-[600px]">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL — template preview (detected fields as amber highlights) */}
        {/* ------------------------------------------------------------------ */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-y-auto rounded-xl border bg-card"
        >
          <div className="p-4 border-b sticky top-0 bg-card z-10">
            <p className="text-sm font-semibold">Template Preview</p>
            <p className="text-xs text-muted-foreground">
              Click a field to scroll to its mapping
            </p>
          </div>

          <div className="p-4">
            {detectedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No merge fields detected in this template.
              </p>
            ) : (
              <div className="rounded-lg bg-muted/30 border p-6 font-mono text-sm leading-loose">
                {/* Simulated document layout: show fields as amber highlights */}
                <p className="text-muted-foreground text-xs mb-4 font-sans not-italic">
                  Detected merge fields in your document:
                </p>
                <div className="flex flex-wrap gap-2">
                  {detectedFields.map((field) => {
                    const mapping = workingMappings.find(
                      (m) => m.detectedField === field.detectedField
                    );
                    const isMapped =
                      mapping?.mappedTo !== null &&
                      mapping?.mappedTo !== undefined &&
                      mapping.mappedTo !== IGNORE_VALUE;
                    const isIgnored = mapping?.mappedTo === IGNORE_VALUE;

                    return (
                      <button
                        key={field.detectedField}
                        type="button"
                        onClick={() => scrollToMappingRow(field.detectedField)}
                        className={[
                          "px-2 py-0.5 rounded text-xs font-mono transition-all cursor-pointer hover:opacity-80",
                          isMapped
                            ? "bg-muted text-financial-positive font-semibold"
                            : isIgnored
                              ? "bg-muted text-muted-foreground line-through"
                              : "bg-muted text-foreground",
                        ].join(" ")}
                        title={`Click to jump to mapping for ${field.displayField}`}
                      >
                        {field.displayField}
                      </button>
                    );
                  })}
                </div>

                {/* Color legend */}
                <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap gap-4 text-xs font-sans">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-muted border border-border" />
                    <span className="text-muted-foreground">Unmapped</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-muted border border-financial-positive" />
                    <span className="text-muted-foreground">Mapped</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-muted border border-border" />
                    <span className="text-muted-foreground">Ignored</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL — field mapping list                                   */}
        {/* ------------------------------------------------------------------ */}
        <div
          ref={rightPanelRef}
          className="flex-1 overflow-y-auto rounded-xl border bg-card"
        >
          {/* Sticky header */}
          <div className="sticky top-0 bg-card z-10 border-b p-4 space-y-3">
            {/* Progress */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Field Mappings</p>
              <span
                className={[
                  "text-sm font-medium",
                  mappedCount === totalFields && totalFields > 0
                    ? "text-financial-positive"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {mappedCount} / {totalFields} fields mapped
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMappingsMutation.isPending}
                className="flex-1"
              >
                {updateMappingsMutation.isPending ? "Saving..." : "Save Mappings"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreview}
                disabled={generatePreviewMutation.isPending}
                className="flex-1"
              >
                {generatePreviewMutation.isPending ? (
                  "Generating..."
                ) : (
                  <>
                    Preview PDF
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Mapping rows */}
          <div className="p-4 space-y-3">
            {detectedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                No fields to map.
              </p>
            ) : (
              detectedFields.map((field) => {
                const mapping = workingMappings.find(
                  (m) => m.detectedField === field.detectedField
                );
                const currentValue =
                  mapping?.mappedTo === null || mapping?.mappedTo === undefined
                    ? UNMAPPED_VALUE
                    : mapping.mappedTo;

                return (
                  <div
                    key={field.detectedField}
                    id={`mapping-row-${field.detectedField}`}
                    className="flex flex-col gap-1.5 rounded-lg p-3 bg-muted/20 border border-transparent transition-all"
                  >
                    {/* Field name */}
                    <span className="text-xs font-mono text-muted-foreground">
                      {field.displayField}
                    </span>

                    {/* Combobox */}
                    <Combobox
                      options={comboboxOptions}
                      value={currentValue === UNMAPPED_VALUE ? undefined : currentValue}
                      onValueChange={(value) =>
                        handleMappingChange(field.detectedField, value)
                      }
                      placeholder="Select BIDAXIOM field..."
                      searchPlaceholder="Search fields..."
                      emptyText="No matching field found."
                    />

                    {/* Ignored label */}
                    {mapping?.mappedTo === IGNORE_VALUE && (
                      <p className="text-xs text-muted-foreground">
                        This field will be left blank in generated documents.
                      </p>
                    )}
                  </div>
                );
              })
            )}

            {/* Field reference sidebar */}
            <FieldReferenceSidebar docType={docType} />
          </div>
        </div>
      </div>
    </div>
  );
}
