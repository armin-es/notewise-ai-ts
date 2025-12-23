'use client';

import { useEffect, useState } from 'react';
import { FileText, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface EmbeddedFile {
  source: string;
  fileName: string;
  chunkCount: number;
  firstUploaded: string;
  lastUpdated: string;
  embeddingIds: string[];
}

export function EmbeddingsList() {
  const [files, setFiles] = useState<EmbeddedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/embeddings');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    
    // Listen for upload events to refresh the list
    const handleUpload = () => {
      fetchFiles();
    };
    window.addEventListener('embeddingUploaded', handleUpload);
    
    return () => {
      window.removeEventListener('embeddingUploaded', handleUpload);
    };
  }, []);

  const handleDelete = async (source: string) => {
    if (!confirm(`Are you sure you want to delete all chunks for "${source}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(source);
      const response = await fetch(`/api/embeddings?source=${encodeURIComponent(source)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      // Refresh the list
      await fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return 'Invalid date';
      // Format as: Dec 23, 2024
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Uploaded Files ({files.length})
        </h3>
        {!loading && (
          <button
            onClick={fetchFiles}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading files...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error loading files</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <FileText className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">No files uploaded yet</p>
            <p className="text-xs mt-1">Upload a markdown file to get started</p>
          </div>
        ) : (
          <div className="overflow-y-auto space-y-2 pr-1 h-full">
            {files.map((file) => (
              <div
                key={file.source}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" title={file.fileName || file.source}>
                      {file.fileName || file.source}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {file.chunkCount} chunk{file.chunkCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {formatDate(file.lastUpdated)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(file.source)}
                  disabled={deleting === file.source}
                  className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-2"
                  title={`Delete ${file.fileName || file.source}`}
                >
                  {deleting === file.source ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


