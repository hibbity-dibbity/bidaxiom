"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { UnifiedDocumentTable } from "@/components/project/documents/unified-document-table";
import { DocumentFilters } from "@/components/project/documents/document-filters";
import { BulkActionBar } from "@/components/project/documents/bulk-action-bar";
import type { DocumentFilters as DocumentFiltersType } from "@/components/project/documents/document-filters";
import { DocumentUploader } from "@/components/project/document-uploader";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

// TODO: Replace with proper inferred type from tRPC AppRouter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnifiedDocument = any;

export default function ProjectDocumentsPage() {
  const params = useParams<{ projectSlug: string }>();
  const projectSlug = params.projectSlug;

  // Resolve projectId from slug (React Query deduplicates — layout uses same query)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  // URL filter state via nuqs
  const [filters, setFilters] = useQueryStates({
    type: parseAsString,
    status: parseAsString,
    dateFrom: parseAsString,
    dateTo: parseAsString,
    author: parseAsString,
  });

  // Local search state with debounce (debounced value fed to API)
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebounce(localSearch, 300);

  // Selected documents state for bulk actions
  const [selectedDocuments, setSelectedDocuments] = useState<UnifiedDocument[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  const utils = trpc.useUtils();

  // Fetch unified document list
  const { data: documents, isLoading, error: documentsError } = trpc.document.listUnified.useQuery(
    {
      projectId: projectId!,
      search: debouncedSearch || undefined,
      type: (filters.type ?? undefined) as
        | "rfi"
        | "submittal"
        | "transmittal"
        | "proposal"
        | "change_order"
        | "payment_app"
        | "rfq"
        | "file"
        | undefined,
      status: filters.status ?? undefined,
      dateFrom: filters.dateFrom ?? undefined,
      dateTo: filters.dateTo ?? undefined,
      authorId: filters.author ?? undefined,
    },
    {
      enabled: !!projectId,
    }
  );

  // Show error toast when document list fails (React Query v5: no onError option — use useEffect)
  useEffect(() => {
    if (documentsError) {
      toast.error("Failed to load documents");
    }
  }, [documentsError]);

  // Build author options from project team members (deduplication of network request via React Query)
  const authorOptions = (project?.teamMembers ?? []).map((m: { userId: string; firstName: string | null; lastName: string | null; email: string | null }) => ({
    id: m.userId,
    name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId,
  }));

  const currentFilters: DocumentFiltersType = {
    search: localSearch || null,
    type: filters.type,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    author: filters.author,
  };

  const handleFilterChange = useCallback(
    (partial: Partial<DocumentFiltersType>) => {
      if ("search" in partial) {
        setLocalSearch(partial.search ?? "");
      } else {
        // Cast through unknown to avoid the strict nuqs Partial type
        setFilters(partial as Parameters<typeof setFilters>[0]);
      }
    },
    [setFilters]
  );

  const handleDeleteSuccess = useCallback(() => {
    if (projectId) {
      utils.document.listUnified.invalidate({ projectId });
    }
    setSelectedDocuments([]);
  }, [projectId, utils]);

  const handleBulkDelete = useCallback(() => {
    handleDeleteSuccess();
  }, [handleDeleteSuccess]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowUploader((prev) => !prev)}
          disabled={!projectId}
        >
          <Upload className="mr-2 h-4 w-4" />
          {showUploader ? "Cancel" : "Upload"}
        </Button>
      </div>
      <DocumentFilters
        filters={currentFilters}
        onChange={handleFilterChange}
        authorOptions={authorOptions}
      />
      {showUploader && projectId && (
        <DocumentUploader
          projectId={projectId}
          folderId={null}
          onUploadComplete={() => {
            utils.document.listUnified.invalidate({ projectId });
            setShowUploader(false);
          }}
        />
      )}
      <UnifiedDocumentTable
        documents={documents ?? []}
        isLoading={isLoading}
        projectSlug={projectSlug}
        projectId={projectId ?? ""}
        onSelectionChange={setSelectedDocuments}
        onDeleteSuccess={handleDeleteSuccess}
      />
      {selectedDocuments.length > 0 && (
        <BulkActionBar
          selectedCount={selectedDocuments.length}
          selectedDocuments={selectedDocuments}
          projectId={projectId ?? ""}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelectedDocuments([])}
        />
      )}
    </div>
  );
}
