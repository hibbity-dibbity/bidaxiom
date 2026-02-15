"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Upload, Download, History, File, FileText, Image as ImageIcon, FileArchive, MoreVertical, Share2, Workflow as WorkflowIcon } from "lucide-react";
import { FolderTree } from "@/components/project/folder-tree";
import { DocumentUploader } from "@/components/project/document-uploader";
import { DocumentSearch } from "@/components/document/document-search";
import { TagManager } from "@/components/document/tag-manager";
import { ShareDialog } from "@/components/document/share-dialog";
import { WorkflowList } from "@/components/workflow/workflow-list";
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
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.document.list.useQuery({
    projectId: projectId!,
    folderId: selectedFolderId || undefined,
  }, { enabled: !!projectId });

  const { data: sharedDocuments, isLoading: sharedLoading } = trpc.document.getSharedWithMe.useQuery();

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

  const handleShareDocument = (documentId: string) => {
    setDocumentToShare(documentId);
    setShareDialogOpen(true);
  };

  const getFileIcon = (contentType: string) => {
    const Icon = fileIcons[contentType] || fileIcons.default;
    return Icon;
  };

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
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
              projectId={projectId!}
              folderId={selectedFolderId}
              onUploadComplete={() => {
                utils.document.list.invalidate({ projectId: projectId!, folderId: selectedFolderId || undefined });
                setUploadDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="shared">Shared With Me</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        {/* All Documents Tab */}
        <TabsContent value="all" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Folder Tree Sidebar */}
            <aside className="lg:col-span-1">
              <Card>
                <FolderTree
                  projectId={projectId!}
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={setSelectedFolderId}
                />
              </Card>
            </aside>

            {/* Document List */}
            <main className="lg:col-span-3">
              <Card className="p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-4">Search Documents</h2>
                  <DocumentSearch
                    projectId={projectId!}
                    onOpenDocument={handleDownload}
                    onShareDocument={handleShareDocument}
                  />
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-4">
                    {selectedFolderId ? "Folder Contents" : "Root Documents"}
                  </h2>
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
                          <TableHead>Tags</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc: any) => {
                          const FileIcon = getFileIcon(doc.contentType);
                          return (
                            <TableRow key={doc.id}>
                              <TableCell className="font-medium">
                                <button
                                  onClick={() => handleDownload(doc.id, doc.name)}
                                  className="flex items-center gap-2 hover:text-primary transition-colors text-left w-full"
                                >
                                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="truncate hover:underline">{doc.name}</span>
                                </button>
                              </TableCell>
                              <TableCell>
                                <TagManager documentId={doc.id} projectId={projectId!} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Document Details</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-2 text-sm space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Size:</span>
                                        <span className="font-medium">{formatFileSize(doc.fileSize)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Uploaded by:</span>
                                        <span className="font-medium truncate ml-2">
                                          {doc.uploadedByProfile?.fullName || doc.createdBy}
                                        </span>
                                      </div>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDownload(doc.id, doc.name)}>
                                      <Download className="mr-2 h-4 w-4" />
                                      Download
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleViewVersions(doc.id)}>
                                      <History className="mr-2 h-4 w-4" />
                                      Version History
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleShareDocument(doc.id)}>
                                      <Share2 className="mr-2 h-4 w-4" />
                                      Share
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {/* TODO: Create workflow */}}>
                                      <WorkflowIcon className="mr-2 h-4 w-4" />
                                      Create Workflow
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
                </div>
              </Card>
            </main>
          </div>
        </TabsContent>

        {/* Shared With Me Tab */}
        <TabsContent value="shared">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Documents Shared With Me</h2>
            {sharedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : sharedDocuments && sharedDocuments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Shared By</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>Shared Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharedDocuments.map((item: any) => {
                    const FileIcon = getFileIcon(item.document.contentType);
                    return (
                      <TableRow key={item.document.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => handleDownload(item.document.id, item.document.name)}
                            className="flex items-center gap-2 hover:text-primary transition-colors text-left w-full"
                          >
                            <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate hover:underline">{item.document.name}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.project.name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.grantedBy?.fullName || "Unknown"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.permissionLevel === "edit" ? "default" : "secondary"}>
                            {item.permissionLevel === "edit" ? "Can Edit" : "View Only"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.grantedAt ? new Date(item.grantedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(item.document.id, item.document.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No shared documents</h3>
                <p className="text-sm text-muted-foreground">
                  Documents that others share with you will appear here
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <WorkflowList projectId={projectId!} projectSlug={project.slug} />
        </TabsContent>
      </Tabs>

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

      {/* Share Dialog */}
      {documentToShare && (
        <ShareDialog
          documentId={documentToShare}
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open);
            if (!open) setDocumentToShare(null);
          }}
        />
      )}
    </div>
  );
}
