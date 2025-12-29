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

interface EmbeddingsListProps {
  selectedChatId?: string | null;
}

export function EmbeddingsList({ selectedChatId }: EmbeddingsListProps = {}) {
  const [files, setFiles] = useState<EmbeddedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [referencedFiles, setReferencedFiles] = useState<Set<string>>(new Set());

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

  // Fetch referenced files for the active chat
  const fetchReferencedFiles = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/referenced-files`);
      if (response.ok) {
        const data = await response.json();
        setReferencedFiles(new Set(data.files || []));
      }
    } catch (err) {
      // Silently fail - referenced files highlighting is optional
      console.error('Failed to fetch referenced files:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
    
    // Listen for upload events to refresh the list
    const handleUpload = () => {
      fetchFiles();
    };
    window.addEventListener('embeddingUploaded', handleUpload);
    
    // Fetch referenced files when chat changes
    if (selectedChatId) {
      fetchReferencedFiles(selectedChatId);
    } else {
      setReferencedFiles(new Set());
    }
    
    return () => {
      window.removeEventListener('embeddingUploaded', handleUpload);
    };
  }, [selectedChatId]);

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
      <div className="flex items-center justify-between mb-6 px-1">
        <h3 className="text-sm font-semibold text-gray-700">
          Uploaded Files ({files.length})
        </h3>
        {!loading && (
          <button
            onClick={fetchFiles}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors px-3 py-1.5 hover:bg-blue-50 rounded"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading files...</span>
          </div>
        ) : error ? (
          <div className="p-5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error loading files</p>
              <p className="text-xs text-red-600 mt-2">{error}</p>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 px-4">
            <FileText className="w-14 h-14 mb-4 text-gray-300" />
            <p className="text-sm">No files uploaded yet</p>
            <p className="text-xs mt-2">Upload a markdown file to get started</p>
          </div>
        ) : (
          <div className="overflow-y-auto space-y-4 pr-2 h-full">
            {files.map((file) => {
              const isReferenced = referencedFiles.size > 0 && (
                referencedFiles.has(file.fileName) || 
                referencedFiles.has(file.source) ||
                referencedFiles.has(file.fileName.replace('.md', '')) ||
                referencedFiles.has(file.source.replace('.md', ''))
              );
              
              return (
                <div
                  key={file.source}
                  className={`group relative p-5 rounded-lg border transition-all ${
                    isReferenced
                      ? 'bg-blue-50/50 border-blue-200/50 hover:border-blue-300 hover:bg-blue-50'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <FileText className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 pr-2">
                          <p 
                            className={`text-base font-medium line-clamp-2 ${isReferenced ? 'text-blue-900' : 'text-gray-900'}`} 
                            title={file.fileName || file.source}
                          >
                            {file.fileName || file.source}
                          </p>
                          <div className="flex items-center gap-2.5 mt-3 whitespace-nowrap">
                            <span className="text-xs text-gray-500">
                              {file.chunkCount} chunk{file.chunkCount !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                              {formatDate(file.lastUpdated)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 flex-shrink-0">
                          {isReferenced && (
                            <span 
                              className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full whitespace-nowrap" 
                              title="Referenced in active chat"
                            >
                              In Chat
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(file.source)}
                            disabled={deleting === file.source}
                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Delete ${file.fileName || file.source}`}
                          >
                            {deleting === file.source ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


