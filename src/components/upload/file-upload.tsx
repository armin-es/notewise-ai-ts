'use client';

import { useState } from 'react';
import { Upload, FileText, X, Check, AlertCircle } from 'lucide-react';

interface UploadResult {
  success: boolean;
  fileName?: string;
  chunksInserted?: number;
  message?: string;
  error?: string;
}

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.md')) {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      setUploadResult({
        success: false,
        error: 'Please upload a .md (markdown) file',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.md')) {
      setFile(selectedFile);
      setUploadResult(null);
    } else if (selectedFile) {
      setUploadResult({
        success: false,
        error: 'Please select a .md (markdown) file',
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          fileName: result.fileName,
          chunksInserted: result.chunksInserted,
          message: result.message,
        });
        setFile(null); // Clear file after successful upload
        // Trigger refresh of embeddings list if parent component listens
        window.dispatchEvent(new CustomEvent('embeddingUploaded'));
      } else {
        setUploadResult({
          success: false,
          error: result.error || 'Upload failed',
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setUploadResult(null);
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        {!file ? (
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop a markdown file here, or click to select
            </p>
            <label className="inline-block">
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm font-medium">
                Choose File
              </span>
              <input
                type="file"
                accept=".md,text/markdown"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">Only .md files are supported</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isUploading}
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {uploadResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            uploadResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {uploadResult.success ? (
            <>
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  {uploadResult.message || 'File uploaded successfully!'}
                </p>
                {uploadResult.chunksInserted && (
                  <p className="text-xs text-green-600 mt-1">
                    Created {uploadResult.chunksInserted} embedding chunk
                    {uploadResult.chunksInserted !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  {uploadResult.error || 'Upload failed'}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

