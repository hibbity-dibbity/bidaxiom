"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Trash2, ArrowRight, LayoutTemplate } from "lucide-react";
import type { TemplateDocType } from "@construction/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPES: TemplateDocType[] = ["proposal", "change_order", "payment_app", "rfq"];

const DOC_TYPE_LABELS: Record<TemplateDocType, string> = {
  proposal: "Proposal",
  change_order: "Change Order",
  payment_app: "Payment Application",
  rfq: "RFQ",
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
}

function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "—";
  try {
    return new Date(dateValue).toLocaleDateString();
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Template card sub-component
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    fileType: string;
    isActive: boolean;
    createdAt: Date | string | null;
    detectedFields: Array<{ detectedField: string; displayField: string }>;
    fieldMappings: Array<{
      detectedField: string;
      displayField: string;
      mappedTo: string | null;
    }>;
    docType: TemplateDocType;
  };
  onActiveToggled: () => void;
  onDeleted: () => void;
}

function TemplateCard({ template, onActiveToggled, onDeleted }: TemplateCardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const setActiveMutation = trpc.template.setActive.useMutation({
    onSuccess: () => {
      utils.template.listByDocType.invalidate({ docType: template.docType });
      onActiveToggled();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update template status");
    },
  });

  const deleteMutation = trpc.template.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.template.listByDocType.invalidate({ docType: template.docType });
      toast.success("Template deleted");
      onDeleted();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });

  const mappedCount = template.fieldMappings.filter(
    (m) => m.mappedTo !== null && m.mappedTo !== "IGNORED"
  ).length;
  const totalFields = template.detectedFields.length;

  const handleDelete = () => {
    if (window.confirm("Delete this template? This cannot be undone.")) {
      deleteMutation.mutate({ templateId: template.id });
    }
  };

  const handleToggle = () => {
    setActiveMutation.mutate({
      templateId: template.id,
      isActive: !template.isActive,
    });
  };

  return (
    <div
      className={[
        "bg-card text-card-foreground border rounded-xl p-5 flex flex-col gap-3",
        template.isActive ? "ring-2 ring-primary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{template.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs uppercase">
              {template.fileType}
            </Badge>
            {template.isActive && (
              <Badge variant="default" className="text-xs">
                Active
              </Badge>
            )}
          </div>
        </div>
        {/* Active toggle */}
        <Switch
          checked={template.isActive}
          onCheckedChange={handleToggle}
          disabled={setActiveMutation.isPending}
          aria-label={template.isActive ? "Deactivate template" : "Activate template"}
        />
      </div>

      {/* Meta row */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Uploaded: {formatDate(template.createdAt)}</p>
        <p>
          Fields mapped:{" "}
          <span
            className={
              totalFields > 0 && mappedCount === totalFields
                ? "text-financial-positive font-medium"
                : "text-muted-foreground font-medium"
            }
          >
            {mappedCount} / {totalFields}
          </span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/settings/document-templates/${template.id}`)}
        >
          Map Fields
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          aria-label="Delete template"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc type section
// ---------------------------------------------------------------------------

interface DocTypeSectionProps {
  docType: TemplateDocType;
}

function DocTypeSection({ docType }: DocTypeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.template.listByDocType.useQuery({ docType });

  const getUploadUrlMutation = trpc.template.getUploadUrl.useMutation();
  const registerAndExtractMutation = trpc.template.registerAndExtract.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target) return;
    // Reset so same file can be re-selected
    (e.target as HTMLInputElement).value = "";

    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "xlsx") {
      toast.error("Only .docx and .xlsx files are supported");
      return;
    }

    const contentType = getContentType(file.name) as
      | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    setIsUploading(true);
    try {
      // Step 1: Get presigned upload URL
      const { uploadUrl, storageKey, fileType } = await getUploadUrlMutation.mutateAsync({
        fileName: file.name,
        contentType,
        docType,
        name: file.name,
      });

      // Step 2: Browser PUT directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      // Step 3: Register template and extract fields
      const { templateId } = await registerAndExtractMutation.mutateAsync({
        name: file.name,
        docType,
        fileType,
        storageKey,
        fileSize: file.size,
      });

      // Refresh list
      utils.template.listByDocType.invalidate({ docType });
      toast.success("Template uploaded — map its fields to activate it");
      router.push(`/settings/document-templates/${templateId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{DOC_TYPE_LABELS[docType]}</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? (
            "Uploading..."
          ) : (
            <>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Template
            </>
          )}
        </Button>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <LayoutTemplate className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm font-medium mb-1">No templates uploaded yet</p>
          <p className="text-xs">
            Upload a Word or Excel template to get started.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={{
                ...tpl,
                docType,
                detectedFields: (tpl.detectedFields as Array<{
                  detectedField: string;
                  displayField: string;
                }>) ?? [],
                fieldMappings: (tpl.fieldMappings as Array<{
                  detectedField: string;
                  displayField: string;
                  mappedTo: string | null;
                }>) ?? [],
              }}
              onActiveToggled={() => {}}
              onDeleted={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Document Templates settings page.
 * Allows admins to upload, manage, and activate branded Word/Excel templates
 * to replace built-in PDF layouts for each document type.
 */
export default function DocumentTemplatesPage() {
  const [activeTab, setActiveTab] = useState<TemplateDocType>("proposal");

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Templates</h1>
        <p className="text-muted-foreground">
          Upload branded Word or Excel templates to replace the built-in PDF layouts for each
          document type.
        </p>
      </div>

      {/* Doc type tabs */}
      <div className="flex gap-1 border-b">
        {DOC_TYPES.map((docType) => (
          <button
            key={docType}
            type="button"
            onClick={() => setActiveTab(docType)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === docType
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {DOC_TYPE_LABELS[docType]}
          </button>
        ))}
      </div>

      {/* Active section */}
      <DocTypeSection key={activeTab} docType={activeTab} />
    </div>
  );
}
