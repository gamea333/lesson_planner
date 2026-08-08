"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  label: string;
  description: string;
  accept: Accept;
  file: File | null;
  onFileChange: (file: File | null) => void;
  optional?: boolean;
}

export function FileUploadZone({
  label,
  description,
  accept,
  file,
  onFileChange,
  optional = false,
}: FileUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{label}</p>
        {optional && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            Optional
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>

      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-accent/50 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onFileChange(null)}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
            isDragActive
              ? "border-primary bg-accent/60"
              : "border-border bg-background hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <input {...getInputProps()} />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">
            {isDragActive ? "Drop your file here" : "Drag & drop or click to upload"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supported formats shown in the description above
          </p>
        </div>
      )}
    </div>
  );
}
