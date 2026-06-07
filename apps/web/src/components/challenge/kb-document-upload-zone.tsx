"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "text/html",
  "application/rtf",
];

const ACCEPTED_EXTENSIONS = ".pdf,.txt,.md,.docx,.doc,.pptx,.ppt,.odt,.html,.rtf";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface KbDocumentUploadZoneProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function KbDocumentUploadZone({
  onUpload,
  isUploading,
}: KbDocumentUploadZoneProps) {
  const t = useTranslations("knowledgeBase");
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return t("upload.errors.unsupportedType");
    }
    if (file.size > MAX_FILE_SIZE) {
      return t("upload.errors.tooLarge");
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      onUpload(file);
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragOver
            ? "border-yellow-400 bg-yellow-500/10"
            : "border-slate-700 bg-slate-900 hover:border-slate-600"
        } ${isUploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mb-2" />
        ) : (
          <Upload className="w-8 h-8 text-slate-500 mb-2" />
        )}
        <p className="text-sm text-slate-400 text-center">
          {isUploading ? t("upload.uploading") : t("upload.prompt")}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {t("upload.formats")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
