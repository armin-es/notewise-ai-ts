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

interface ReferencedChunk {
  id: string;
  chunkIndex: number | null;
  content: string;
  isReferenced: boolean;
}

interface FileChunks {
  file: string;
  chunks: ReferencedChunk[];
}

export function EmbeddingsList({ selectedChatId }: EmbeddingsListProps = {}) {
  const [files, setFiles] = useState<EmbeddedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [referencedFiles, setReferencedFiles] = useState<Set<string>>(new Set());
  const [referencedChunks, setReferencedChunks] = useState<Map<string, FileChunks>>(new Map());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

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

  // Fetch referenced files and chunks for the active chat
  const fetchReferencedFiles = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/referenced-files`);
      if (response.ok) {
        const data = await response.json();
        setReferencedFiles(new Set(data.files || []));
        
        // Organize chunks by file for easy lookup
        const chunksMap = new Map<string, FileChunks>();
        if (data.chunks && Array.isArray(data.chunks)) {
          for (const fileChunks of data.chunks) {
            chunksMap.set(fileChunks.file, fileChunks);
          }
        }
        setReferencedChunks(chunksMap);
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

  // Truncate text at word boundaries to avoid cutting words in the middle
  const truncateAtWord = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    
    // Find the last space before the max length
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    // If we found a space (and it's not at the very beginning), use it
    if (lastSpace > 0 && lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    // Otherwise, just truncate at max length (might cut a word, but better than nothing)
    return truncated + '...';
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
            {files.map((file) => {
              const fileKey = file.fileName || file.source;
              const isReferenced = referencedFiles.size > 0 && (
                referencedFiles.has(file.fileName) || 
                referencedFiles.has(file.source) ||
                referencedFiles.has(file.fileName.replace('.md', '')) ||
                referencedFiles.has(file.source.replace('.md', ''))
              );
              
              const fileChunks = referencedChunks.get(fileKey) || referencedChunks.get(file.source);
              const hasChunks = fileChunks && fileChunks.chunks.length > 0;
              const isExpanded = expandedFiles.has(file.source);
              
              return (
              <div key={file.source} className="space-y-1">
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isReferenced
                      ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className={`w-5 h-5 flex-shrink-0 ${isReferenced ? 'text-blue-600' : 'text-blue-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isReferenced ? 'text-blue-900' : 'text-gray-800'}`} title={file.fileName || file.source}>
                          {file.fileName || file.source}
                        </p>
                        {isReferenced && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded" title="Referenced in active chat">
                            In Chat
                          </span>
                        )}
                        {hasChunks && (
                          <span className="px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                            {fileChunks.chunks.length} chunk{fileChunks.chunks.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
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
                  <div className="flex items-center gap-2">
                    {hasChunks && (
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedFiles);
                          if (isExpanded) {
                            newExpanded.delete(file.source);
                          } else {
                            newExpanded.add(file.source);
                          }
                          setExpandedFiles(newExpanded);
                        }}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                      >
                        {isExpanded ? 'Hide' : 'Show'} chunks
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(file.source)}
                      disabled={deleting === file.source}
                      className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
                
                {/* Show chunks if expanded */}
                {isExpanded && hasChunks && fileChunks && (
                  <div className="ml-8 space-y-1 pl-3 border-l-2 border-blue-200">
                    {fileChunks.chunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className={`p-2 rounded text-xs ${
                          chunk.isReferenced
                            ? 'bg-blue-100 border border-blue-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">
                            Chunk {chunk.chunkIndex !== null ? chunk.chunkIndex + 1 : '?'}
                          </span>
                          {chunk.isReferenced && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-300 text-blue-900 rounded">
                              Referenced
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 line-clamp-2 text-xs">
                          {truncateAtWord(chunk.content, 150)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


