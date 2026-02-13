"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface TagManagerProps {
  documentId: string;
  projectId: string;
}

export function TagManager({ documentId, projectId }: TagManagerProps) {
  const [tagInput, setTagInput] = useState("");
  const utils = trpc.useUtils();

  const { data: tags, isLoading } = trpc.document.getTags.useQuery({ documentId });

  const addTagMutation = trpc.document.addTag.useMutation({
    onMutate: async (newTag) => {
      // Cancel outgoing refetches
      await utils.document.getTags.cancel({ documentId });

      // Snapshot previous value
      const previousTags = utils.document.getTags.getData({ documentId });

      // Optimistically update to the new value
      if (previousTags) {
        utils.document.getTags.setData({ documentId }, [
          { tag: newTag.tag.toLowerCase(), createdBy: "", createdAt: new Date() },
          ...previousTags,
        ]);
      }

      return { previousTags };
    },
    onError: (err, newTag, context) => {
      // Rollback to previous value on error
      if (context?.previousTags) {
        utils.document.getTags.setData({ documentId }, context.previousTags);
      }
      toast.error(err.message || "Failed to add tag");
    },
    onSuccess: () => {
      toast.success("Tag added");
      // Invalidate search results
      utils.document.search.invalidate({ projectId });
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.document.getTags.invalidate({ documentId });
    },
  });

  const removeTagMutation = trpc.document.removeTag.useMutation({
    onMutate: async (removeTag) => {
      // Cancel outgoing refetches
      await utils.document.getTags.cancel({ documentId });

      // Snapshot previous value
      const previousTags = utils.document.getTags.getData({ documentId });

      // Optimistically update
      if (previousTags) {
        utils.document.getTags.setData(
          { documentId },
          previousTags.filter((t) => t.tag !== removeTag.tag.toLowerCase())
        );
      }

      return { previousTags };
    },
    onError: (err, removeTag, context) => {
      // Rollback on error
      if (context?.previousTags) {
        utils.document.getTags.setData({ documentId }, context.previousTags);
      }
      toast.error(err.message || "Failed to remove tag");
    },
    onSuccess: () => {
      toast.success("Tag removed");
      // Invalidate search results
      utils.document.search.invalidate({ projectId });
    },
    onSettled: () => {
      utils.document.getTags.invalidate({ documentId });
    },
  });

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      addTagMutation.mutate({ documentId, tag: trimmed });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    removeTagMutation.mutate({ documentId, tag });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-16 bg-muted animate-pulse rounded" />
        <div className="h-6 w-20 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Display existing tags */}
      {tags && tags.length > 0 ? (
        tags.map((tagData) => (
          <Badge key={tagData.tag} variant="secondary" className="flex items-center gap-1 pr-1">
            <span>{tagData.tag}</span>
            <button
              onClick={() => handleRemoveTag(tagData.tag)}
              className="hover:bg-destructive/10 rounded p-0.5 transition-colors"
              disabled={removeTagMutation.isLoading}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">No tags</span>
      )}

      {/* Add tag input */}
      <div className="flex items-center gap-1">
        <Input
          placeholder="Add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTag();
            }
          }}
          className="h-6 text-sm w-24"
          disabled={addTagMutation.isLoading}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleAddTag}
          disabled={!tagInput.trim() || addTagMutation.isLoading}
          className="h-6 w-6 p-0"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
