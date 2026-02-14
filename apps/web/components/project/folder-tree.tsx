"use client";

import { trpc } from "@/lib/trpc";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  projectId: string;
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}

export function FolderTree({ projectId, selectedFolderId, onFolderSelect }: FolderTreeProps) {
  const { data: folders, isLoading } = trpc.document.listFolders.useQuery({
    projectId,
    parentId: null,
  });

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
    </div>
  );
}
