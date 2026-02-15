"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyLogo } from "./company-logo";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ACCEPTED_FORMATS = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function LogoUpload() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: currentLogo } = trpc.company.getLogo.useQuery();

  const uploadLogoMutation = trpc.company.uploadLogo.useMutation();
  const deleteLogoMutation = trpc.company.deleteLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo deleted successfully");
      utils.company.getLogo.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete logo: ${error.message}`);
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      toast.error("Invalid file format. Please upload PNG, JPG, SVG, or WebP.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }

    setUploading(true);

    try {
      // Get extension from file type
      const extension = file.type.split("/")[1];

      // Get pre-signed upload URL
      const { uploadUrl, storageKey } = await uploadLogoMutation.mutateAsync({
        fileExtension: extension as "png" | "jpg" | "jpeg" | "svg" | "webp",
      });

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      toast.success("Logo uploaded successfully");
      utils.company.getLogo.invalidate(); // Refresh logo display
    } catch (error) {
      toast.error(`Failed to upload logo: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Logo</CardTitle>
        <CardDescription>
          Upload your company logo. Recommended size: 512x512px. Max file size: 2MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current logo preview */}
        <div className="flex items-center gap-4">
          <CompanyLogo variant="auth" showName={false} />
          <div className="flex-1">
            {currentLogo?.logoUrl ? (
              <p className="text-sm text-muted-foreground">Current logo</p>
            ) : (
              <p className="text-sm text-muted-foreground">No logo uploaded</p>
            )}
          </div>
        </div>

        {/* Upload/Delete buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {currentLogo?.logoUrl ? "Replace Logo" : "Upload Logo"}
              </>
            )}
          </Button>

          {currentLogo?.logoUrl && (
            <Button
              onClick={() => deleteLogoMutation.mutate()}
              disabled={deleteLogoMutation.isPending}
              variant="destructive"
            >
              {deleteLogoMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Logo
            </Button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS.join(",")}
          className="hidden"
          onChange={handleFileSelect}
        />
      </CardContent>
    </Card>
  );
}
