"use client";

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocumentUploaderProps {
  projectId: string;
  folderId: string | null;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "registering" | "complete" | "error";
  progress: number;
  error?: string;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export function DocumentUploader({ projectId, folderId, onUploadComplete }: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrlMutation = trpc.document.getUploadUrl.useMutation();
  const createDocumentMutation = trpc.document.create.useMutation();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: UploadFile[] = Array.from(selectedFiles).map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: "pending",
      progress: 0,
    }));

    // Validate file sizes
    const oversizedFiles = newFiles.filter((f) => f.file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed the 500MB limit: ${oversizedFiles.map((f) => f.file.name).join(", ")}`);
      return;
    }

    setFiles((prev) => [...prev, ...newFiles]);
    processUploads(newFiles);
  }, []);

  const processUploads = async (uploadFiles: UploadFile[]) => {
    for (const uploadFile of uploadFiles) {
      try {
        // Step 1: Update status to uploading
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading" as const } : f))
        );

        // Step 2: Get pre-signed URL
        const { uploadUrl, storageKey } = await getUploadUrlMutation.mutateAsync({
          projectId,
          fileName: uploadFile.file.name,
          contentType: uploadFile.file.type || "application/octet-stream",
          fileSize: uploadFile.file.size,
        });

        // Step 3: Upload to S3
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setFiles((prev) =>
                prev.map((f) => (f.id === uploadFile.id ? { ...f, progress } : f))
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", uploadFile.file.type || "application/octet-stream");
          xhr.send(uploadFile.file);
        });

        // Step 4: Register document in database
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "registering" as const } : f))
        );

        await createDocumentMutation.mutateAsync({
          projectId,
          folderId: folderId || undefined,
          name: uploadFile.file.name,
          storageKey,
          fileSize: uploadFile.file.size,
          contentType: uploadFile.file.type || "application/octet-stream",
        });

        // Step 5: Mark complete
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "complete" as const, progress: 100 } : f))
        );

        toast.success(`Uploaded ${uploadFile.file.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "error" as const, error: errorMessage } : f))
        );
        toast.error(`Failed to upload ${uploadFile.file.name}: ${errorMessage}`);
      }
    }

    // Trigger refresh after all uploads
    onUploadComplete();
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const getStatusIcon = (status: UploadFile["status"]) => {
    switch (status) {
      case "complete":
        return <Check className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {isDragActive ? "Drop files here" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          Maximum file size: 500MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Upload Progress List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadFile) => (
            <div key={uploadFile.id} className="flex items-center gap-3 p-3 rounded-lg border">
              {getStatusIcon(uploadFile.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                  <p className="text-xs text-muted-foreground ml-2">
                    {formatFileSize(uploadFile.file.size)}
                  </p>
                </div>
                {uploadFile.status === "uploading" && (
                  <div className="space-y-1">
                    <Progress value={uploadFile.progress} className="h-1" />
                    <p className="text-xs text-muted-foreground">Uploading... {uploadFile.progress}%</p>
                  </div>
                )}
                {uploadFile.status === "registering" && (
                  <p className="text-xs text-muted-foreground">Registering document...</p>
                )}
                {uploadFile.status === "complete" && (
                  <p className="text-xs text-green-600">Upload complete</p>
                )}
                {uploadFile.status === "error" && (
                  <p className="text-xs text-red-600">{uploadFile.error}</p>
                )}
              </div>
              {(uploadFile.status === "complete" || uploadFile.status === "error") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(uploadFile.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
