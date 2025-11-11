"use client";

import { useState, useCallback } from "react";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = ".pdf",
  maxSizeMB = 10,
  disabled = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const validateFile = (file: File): boolean => {
    setError("");

    // Validar tipo
    if (!file.type.includes("pdf")) {
      setError("Apenas arquivos PDF são permitidos");
      return false;
    }

    // Validar tamanho
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`Arquivo muito grande. Máximo: ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-all ${
          dragActive
            ? "border-primary bg-primary/5"
            : error
            ? "border-destructive"
            : "border-muted-foreground/25"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div
              className={`rounded-full p-4 ${
                error
                  ? "bg-destructive/10"
                  : dragActive
                  ? "bg-primary/10"
                  : "bg-muted"
              }`}
            >
              {error ? (
                <AlertCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Upload
                  className={`h-8 w-8 ${
                    dragActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-lg font-medium">
                {dragActive
                  ? "Solte o arquivo aqui"
                  : selectedFile
                  ? "Arquivo selecionado"
                  : "Arraste e solte o PDF da NF-e"}
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Máximo: {maxSizeMB}MB • Formato: PDF
              </p>
            </div>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={accept}
              onChange={handleChange}
              disabled={disabled}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={disabled}
            >
              Selecionar Arquivo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      {/* Selected File Info */}
      {selectedFile && !error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                <File className="h-6 w-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
