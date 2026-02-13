"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Share2, FileText, Image as ImageIcon, File, FileArchive } from "lucide-react";
import { toast } from "sonner";

const fileIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "application/pdf": FileText,
  "image/jpeg": ImageIcon,
  "image/png": ImageIcon,
  "image/gif": ImageIcon,
  "application/zip": FileArchive,
  default: File,
};

interface DocumentSearchProps {
  projectId: string;
  onOpenDocument: (documentId: string, fileName: string) => void;
  onShareDocument: (documentId: string) => void;
}

const contentTypeOptions = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "Image (JPEG)" },
  { value: "image/png", label: "Image (PNG)" },
  { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Document (DOCX)" },
  { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Spreadsheet (XLSX)" },
];

const categoryOptions = [
  { value: "contract", label: "Contract" },
  { value: "drawing", label: "Drawing" },
  { value: "specification", label: "Specification" },
  { value: "submittal", label: "Submittal" },
  { value: "rfi", label: "RFI" },
  { value: "change_order", label: "Change Order" },
  { value: "payment_app", label: "Payment App" },
  { value: "invoice", label: "Invoice" },
  { value: "report", label: "Report" },
  { value: "photo", label: "Photo" },
  { value: "closeout", label: "Closeout" },
  { value: "other", label: "Other" },
];

export function DocumentSearch({
  projectId,
  onOpenDocument,
  onShareDocument,
}: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const utils = trpc.useUtils();

  // Build search input
  const searchInput = {
    projectId,
    query: query || undefined,
    category: category as any,
    contentTypes: selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
    tags: tags.length > 0 ? tags : undefined,
  };

  const { data: documents, isLoading } = trpc.document.search.useQuery(searchInput, {
    enabled: !!(query || category || selectedContentTypes.length > 0 || tags.length > 0),
  });

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const toggleContentType = (contentType: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(contentType)
        ? prev.filter((t) => t !== contentType)
        : [...prev, contentType]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getFileIcon = (contentType: string) => {
    const Icon = fileIcons[contentType] || fileIcons.default;
    return Icon;
  };

  const showResults = query || category || selectedContentTypes.length > 0 || tags.length > 0;

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Text Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__" onClick={() => setCategory(undefined)}>
                All categories
              </SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tag Input */}
        <div className="flex gap-2">
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
          />
          <Button type="button" variant="secondary" onClick={handleAddTag}>
            Add
          </Button>
        </div>
      </div>

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
      )}

      {/* Content Type Filters */}
      <div className="flex flex-wrap gap-4">
        {contentTypeOptions.map((type) => (
          <div key={type.value} className="flex items-center space-x-2">
            <Checkbox
              id={type.value}
              checked={selectedContentTypes.includes(type.value)}
              onCheckedChange={() => toggleContentType(type.value)}
            />
            <label
              htmlFor={type.value}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {type.label}
            </label>
          </div>
        ))}
      </div>

      {/* Results */}
      {showResults && (
        <div className="border rounded-lg">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => {
                  const FileIcon = getFileIcon(doc.contentType);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => onOpenDocument(doc.id, doc.name)}
                          className="flex items-center gap-2 hover:text-primary transition-colors text-left w-full"
                        >
                          <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate hover:underline">{doc.name}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        {doc.category ? (
                          <Badge variant="outline">
                            {categoryOptions.find((c) => c.value === doc.category)?.label || doc.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenDocument(doc.id, doc.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShareDocument(doc.id)}
                          >
                            <Share2 className="h-4 w-4" />
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
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-1">No documents match your search criteria</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      )}

      {!showResults && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Search className="h-12 w-12 mb-4" />
          <p className="text-sm">Enter search criteria to find documents</p>
        </div>
      )}
    </div>
  );
}
