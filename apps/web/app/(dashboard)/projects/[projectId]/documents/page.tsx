"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Upload, Download, History, File, FileText, Image as ImageIcon, FileArchive } from "lucide-react";
import { FolderTree } from "@/components/project/folder-tree";
import { DocumentUploader } from "@/components/project/document-uploader";
import { toast } from "sonner";

const fileIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "application/pdf": FileText,
  "image/jpeg": ImageIcon,
  "image/png": ImageIcon,
  "image/gif": ImageIcon,
  "application/zip": FileArchive,
  default: File,
};

export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  const { data: documents, isLoading } = trpc.document.list.useQuery({
    projectId,
    folderId: selectedFolderId || undefined,
  });

  const { data: versions } = trpc.document.getVersionHistory.useQuery(
    { documentId: selectedDocumentId! },
    { enabled: !!selectedDocumentId }
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      // Since getDownloadUrl is a query, we need to fetch it directly
      const result = await utils.document.getDownloadUrl.fetch({ documentId });
      window.open(result.downloadUrl, "_blank");
      toast.success(`Downloading ${fileName}`);
    } catch (error) {
      toast.error("Failed to generate download link");
    }
  };

  const handleViewVersions = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setVersionSheetOpen(true);
  };

  const getFileIcon = (contentType: string) => {
    const Icon = fileIcons[contentType] || fileIcons.default;
    return Icon;
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Project not found</h3>
          <Button asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectId}`} className="hover:text-foreground">
          {project.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Documents</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage project documents and files</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
              <DialogDescription>
                Upload files to {selectedFolderId ? "the selected folder" : "the project root"}
              </DialogDescription>
            </DialogHeader>
            <DocumentUploader
              projectId={projectId}
              folderId={selectedFolderId}
              onUploadComplete={() => {
                utils.document.list.invalidate({ projectId, folderId: selectedFolderId || undefined });
                setUploadDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Tree Sidebar */}
        <aside className="lg:col-span-1">
          <Card>
            <FolderTree
              projectId={projectId}
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
            />
          </Card>
        </aside>

        {/* Document List */}
        <main className="lg:col-span-3">
          <Card className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : documents && documents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc: any) => {
                    const FileIcon = getFileIcon(doc.contentType);
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{doc.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.uploadedByProfile?.fullName || doc.uploadedBy}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc.id, doc.name)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewVersions(doc.id)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <File className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No documents in this folder</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your first document to get started
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Version History Sheet */}
      <Sheet open={versionSheetOpen} onOpenChange={setVersionSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              All versions of this document
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {versions && versions.length > 0 ? (
              versions.map((version: any) => (
                <div key={version.id} className="flex items-start justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">v{version.versionNumber}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(version.fileSize)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(version.createdAt).toLocaleString()}
                    </p>
                    {version.changeNotes && (
                      <p className="text-sm mt-1">{version.changeNotes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedDocumentId) {
                        handleDownload(selectedDocumentId, `version-${version.versionNumber}`);
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No version history available
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
