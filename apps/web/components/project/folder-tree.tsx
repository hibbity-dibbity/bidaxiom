"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Folder, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  projectId: string;
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}

export function FolderTree({ projectId, selectedFolderId, onFolderSelect }: FolderTreeProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const utils = trpc.useUtils();
  const { data: folders, isLoading } = trpc.document.listFolders.useQuery({
    projectId,
    parentId: null,
  });

  const createFolderMutation = trpc.document.createFolder.useMutation({
    onSuccess: () => {
      utils.document.listFolders.invalidate({ projectId, parentId: null });
      toast.success("Folder created");
      setCreateDialogOpen(false);
      setNewFolderName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create folder");
    },
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }
    createFolderMutation.mutate({
      projectId,
      name: newFolderName,
      parentId: null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {/* All Documents Option */}
      <button
        onClick={() => onFolderSelect(null)}
        className={cn(
          "flex items-center gap-2 w-full p-2 rounded-md text-sm hover:bg-accent transition-colors",
          selectedFolderId === null && "bg-accent"
        )}
      >
        <Folder className="h-4 w-4" />
        <span>All Documents</span>
      </button>

      {/* Folder List */}
      {folders && folders.length > 0 ? (
        folders.map((folder: any) => (
          <button
            key={folder.id}
            onClick={() => onFolderSelect(folder.id)}
            className={cn(
              "flex items-center gap-2 w-full p-2 rounded-md text-sm hover:bg-accent transition-colors",
              selectedFolderId === folder.id && "bg-accent"
            )}
          >
            <Folder className="h-4 w-4" />
            <span>{folder.name}</span>
          </button>
        ))
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No folders yet
        </p>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full mt-2">
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Add a new folder to organize project documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                placeholder="e.g., Shop Drawings"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
