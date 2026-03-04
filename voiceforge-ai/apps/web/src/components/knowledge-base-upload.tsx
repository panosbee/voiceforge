// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Knowledge Base Upload Component
// Drag & drop file upload + URL + text → ElevenLabs native KB
// Reusable in: agent edit modal, onboarding wizard
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { Button, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  Upload,
  FileText,
  Globe,
  Type,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import type { ApiResponse, KBDocumentSummary } from '@voiceforge/shared';

// ── Types ────────────────────────────────────────────────────────

interface KnowledgeBaseUploadProps {
  /** Agent ID to attach documents to (null = standalone) */
  agentId: string | null;
  /** Callback when documents change */
  onDocumentsChange?: (docs: KBDocumentSummary[]) => void;
  /** Compact mode (for wizard) */
  compact?: boolean;
}

type UploadMode = 'file' | 'url' | 'text';

interface UploadingFile {
  id: string;
  name: string;
  progress: number; // 0-100
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.txt,.md,.csv,.html,.epub';
const MAX_FILE_SIZE_MB = 25;

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sourceIcon(source: string) {
  switch (source) {
    case 'url':
      return <Globe className="w-4 h-4" />;
    case 'text':
      return <Type className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function KnowledgeBaseUpload({ agentId, onDocumentsChange, compact = false }: KnowledgeBaseUploadProps) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<KBDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [textName, setTextName] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing documents ────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    try {
      const params = agentId ? { agentId } : {};
      const result = await api.get<ApiResponse<KBDocumentSummary[]>>('/api/knowledge-base', { params });
      if (result.success && result.data) {
        setDocuments(result.data);
        onDocumentsChange?.(result.data);
      }
    } catch {
      // Silently fail on load
    } finally {
      setIsLoading(false);
    }
  }, [agentId, onDocumentsChange]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ── File Upload Handlers ───────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: ${t.knowledgeBase.fileTooLarge} (max ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      setUploadingFiles((prev) => [...prev, { id: uploadId, name: file.name, progress: 30 }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        if (agentId) formData.append('agentId', agentId);

        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadId ? { ...f, progress: 60 } : f)),
        );

        const result = await api.upload<ApiResponse<KBDocumentSummary>>('/api/knowledge-base/upload-file', formData);

        if (result.success && result.data) {
          setDocuments((prev) => {
            const updated = [result.data!, ...prev];
            onDocumentsChange?.(updated);
            return updated;
          });
          toast.success(`${file.name} ${t.knowledgeBase.uploadSuccess}`);
        }

        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadId ? { ...f, progress: 0, error: message } : f)),
        );
        toast.error(`${t.knowledgeBase.uploadError}: ${file.name}`);
      }
    }
  }, [agentId, onDocumentsChange]);

  // ── Drag & Drop ────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        e.target.value = ''; // Reset for same file re-upload
      }
    },
    [handleFiles],
  );

  // ── URL Upload ─────────────────────────────────────────────────

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;

    const displayName = urlName.trim() || new URL(urlInput).hostname;

    try {
      const result = await api.post<ApiResponse<KBDocumentSummary>>('/api/knowledge-base/upload-url', {
        url: urlInput.trim(),
        name: displayName,
        agentId,
      });

      if (result.success && result.data) {
        setDocuments((prev) => {
          const updated = [result.data!, ...prev];
          onDocumentsChange?.(updated);
          return updated;
        });
        setUrlInput('');
        setUrlName('');
        toast.success(`URL "${displayName}" ${t.knowledgeBase.urlAdded}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'URL upload failed';
      toast.error(message);
    }
  };

  // ── Text Upload ────────────────────────────────────────────────

  const handleTextUpload = async () => {
    if (!textInput.trim() || !textName.trim()) return;

    try {
      const result = await api.post<ApiResponse<KBDocumentSummary>>('/api/knowledge-base/upload-text', {
        text: textInput.trim(),
        name: textName.trim(),
        agentId,
      });

      if (result.success && result.data) {
        setDocuments((prev) => {
          const updated = [result.data!, ...prev];
          onDocumentsChange?.(updated);
          return updated;
        });
        setTextInput('');
        setTextName('');
        toast.success(`${t.knowledgeBase.textLabel} "${textName}" ${t.knowledgeBase.textAdded}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Text upload failed';
      toast.error(message);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────

  const handleDelete = async (docId: string, docName: string) => {
    setDeletingIds((prev) => new Set(prev).add(docId));

    try {
      await api.delete<ApiResponse>(`/api/knowledge-base/${docId}`);
      setDocuments((prev) => {
        const updated = prev.filter((d) => d.id !== docId);
        onDocumentsChange?.(updated);
        return updated;
      });
      toast.success(`"${docName}" ${t.knowledgeBase.deleted}`);
    } catch {
      toast.error(`${t.knowledgeBase.deleteError}: ${docName}`);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  // ── Remove failed upload from list ─────────────────────────────

  const dismissUpload = (uploadId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t.knowledgeBase.title}</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t.knowledgeBase.description}
            </p>
          </div>
          <Badge variant={documents.length > 0 ? 'success' : 'default'}>
            {documents.length} {documents.length === 1 ? t.knowledgeBase.document : t.knowledgeBase.documents}
          </Badge>
        </div>
      )}

      {/* Upload Mode Tabs */}
      <div className="flex gap-1 bg-surface-tertiary rounded-lg p-1">
        {([
          { key: 'file' as const, icon: Upload, label: t.knowledgeBase.fileTab },
          { key: 'url' as const, icon: Globe, label: t.knowledgeBase.urlTab },
          { key: 'text' as const, icon: Type, label: t.knowledgeBase.textTab },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setUploadMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              uploadMode === key
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Upload Area */}
      {uploadMode === 'file' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-brand-400 bg-brand-50/50'
              : 'border-border hover:border-brand-300 hover:bg-surface-secondary'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-brand-500' : 'text-text-tertiary'}`} />
          <p className="text-sm font-medium text-text-primary">
            {isDragOver ? t.knowledgeBase.dropFiles : t.knowledgeBase.dragOrClick}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            PDF, DOCX, TXT, MD, CSV, HTML, EPUB — Μέχρι {MAX_FILE_SIZE_MB}MB
          </p>
        </div>
      )}

      {uploadMode === 'url' && (
        <div className="space-y-3 border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t.knowledgeBase.urlLabel}</label>
            <input
              type="url"
              placeholder="https://example.com/document"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t.knowledgeBase.nameOptional}</label>
            <input
              type="text"
              placeholder={t.knowledgeBase.namePlaceholder}
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <Button
            size="sm"
            onClick={handleUrlUpload}
            disabled={!urlInput.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t.knowledgeBase.addUrl}
          </Button>
        </div>
      )}

      {uploadMode === 'text' && (
        <div className="space-y-3 border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t.knowledgeBase.documentName}</label>
            <input
              type="text"
              placeholder={t.knowledgeBase.documentNamePlaceholder}
              value={textName}
              onChange={(e) => setTextName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t.knowledgeBase.textLabel}</label>
            <textarea
              placeholder={t.knowledgeBase.textPlaceholder}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-text-primary placeholder:text-text-tertiary resize-y"
            />
            <p className="text-xs text-text-tertiary mt-1">
              {textInput.length.toLocaleString()} {t.knowledgeBase.characters}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleTextUpload}
            disabled={!textInput.trim() || !textName.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t.knowledgeBase.addText}
          </Button>
        </div>
      )}

      {/* Uploading Files (progress) */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                file.error ? 'border-danger-500/30 bg-danger-50/50' : 'border-brand-200 bg-brand-50/30'
              }`}
            >
              {file.error ? (
                <AlertCircle className="w-4 h-4 text-danger-500 shrink-0" />
              ) : (
                <Spinner size="sm" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                {file.error ? (
                  <p className="text-xs text-danger-600">{file.error}</p>
                ) : (
                  <div className="mt-1 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {file.error && (
                <button onClick={() => dismissUpload(file.id)} className="p-1 text-text-tertiary hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors"
            >
              <div className="text-text-tertiary shrink-0">
                {sourceIcon(doc.source)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-tertiary">
                    {doc.source === 'file' ? (doc.mimeType?.split('/').pop()?.toUpperCase() ?? 'FILE') : doc.source.toUpperCase()}
                  </span>
                  {doc.fileSize && (
                    <>
                      <span className="text-xs text-text-tertiary">·</span>
                      <span className="text-xs text-text-tertiary">{formatFileSize(doc.fileSize)}</span>
                    </>
                  )}
                  {doc.sourceUrl && (
                    <>
                      <span className="text-xs text-text-tertiary">·</span>
                      <span className="text-xs text-text-tertiary truncate max-w-[200px]">{doc.sourceUrl}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.status === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4 text-success-500" />
                ) : doc.status === 'failed' ? (
                  <AlertCircle className="w-4 h-4 text-danger-500" />
                ) : (
                  <Spinner size="sm" />
                )}
                <button
                  onClick={() => handleDelete(doc.id, doc.name)}
                  disabled={deletingIds.has(doc.id)}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-50"
                  title={t.knowledgeBase.deleteTitle}
                >
                  {deletingIds.has(doc.id) ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && uploadingFiles.length === 0 && (
        <p className="text-xs text-text-tertiary text-center py-2">
          {t.knowledgeBase.noDocuments}
        </p>
      )}
    </div>
  );
}
