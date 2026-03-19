// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Tasks Dashboard (Mini CRM)
// Shows AI-extracted post-call tasks with status tracking
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Spinner, EmptyState, PageHeader, Button, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  User,
  Bot,
  Mail,
} from 'lucide-react';

interface Task {
  id: string;
  agentId: string;
  callId: string | null;
  title: string;
  description: string | null;
  actionRequired: string | null;
  assignedEmail: string;
  assignedRole: string;
  status: 'pending' | 'confirmed' | 'expired';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  callerName: string | null;
  callerPhone: string | null;
  callerEmail: string | null;
  reminderCount: number;
  confirmedAt: string | null;
  createdAt: string;
}

interface TaskStats {
  total: number;
  pending: number;
  confirmed: number;
  expired: number;
  avgConfirmHours: number | null;
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-600', badgeVariant: 'warning' as const },
  confirmed: { icon: CheckCircle2, color: 'text-green-600', badgeVariant: 'success' as const },
  expired: { icon: XCircle, color: 'text-red-600', badgeVariant: 'danger' as const },
};

export default function TasksPage() {
  const { t } = useI18n();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const limit = 20;

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * limit;
      const result = await api.get<{ data: Task[]; pagination: { total: number; limit: number; offset: number } }>('/api/tasks', {
        params: {
          offset,
          limit,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      setTasks(result.data ?? []);
      setTotal(result.pagination?.total ?? 0);
    } catch {
      // Empty state will show
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const result = await api.get<{ data: TaskStats }>('/api/tasks/stats');
      setStats(result.data);
    } catch {
      // Stats are optional
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, [loadTasks, loadStats]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="AI-extracted tasks from calls — track departmental follow-ups"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
                <p className="text-xs text-text-tertiary">Total Tasks</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stats.pending}</p>
                <p className="text-xs text-text-tertiary">Pending</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stats.confirmed}</p>
                <p className="text-xs text-text-tertiary">Confirmed</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stats.expired}</p>
                <p className="text-xs text-text-tertiary">Expired</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Avg Confirm Time */}
      {stats?.avgConfirmHours != null && (
        <div className="mb-6 px-4 py-3 bg-surface-secondary rounded-lg border border-border">
          <p className="text-sm text-text-secondary">
            <CheckCircle2 className="w-4 h-4 inline mr-1.5 text-green-600" />
            Average confirmation time: <strong>{stats.avgConfirmHours.toFixed(1)}h</strong>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-text-tertiary" />
        <Select
          options={[
            { value: '', label: 'All Tasks' },
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'expired', label: 'Expired' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-48"
        />
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-12 h-12" />}
          title="No tasks found"
          description={statusFilter ? 'Try a different filter' : 'Tasks will appear here after calls are processed by the AI'}
        />
      ) : (
        <>
          {/* Task Cards */}
          <div className="space-y-3">
            {tasks.map((task) => {
              const sc = statusConfig[task.status] ?? statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <div key={task.id} className="cursor-pointer" onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}>
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`w-4 h-4 shrink-0 ${sc.color}`} />
                        <h3 className="text-sm font-semibold text-text-primary truncate">{task.title}</h3>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-tertiary mt-1">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" />
                          {task.assignedRole}
                        </span>
                        <span className="truncate">{task.assignedEmail}</span>
                        {task.callerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {task.callerPhone}
                          </span>
                        )}
                        {task.callerName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {task.callerName}
                          </span>
                        )}
                        {task.callerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {task.callerEmail}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={sc.badgeVariant}>
                        {task.status === 'pending' ? 'Pending' : task.status === 'confirmed' ? 'Confirmed' : 'Expired'}
                      </Badge>
                      <p className="text-xs text-text-tertiary mt-1">{formatRelativeTime(task.createdAt, t.shared)}</p>
                      {task.reminderCount > 0 && task.status === 'pending' && (
                        <p className="text-xs text-yellow-600 mt-0.5 flex items-center justify-end gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {task.reminderCount} reminder{task.reminderCount > 1 ? 's' : ''} sent
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {selectedTask?.id === task.id && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      {task.description && (
                        <div>
                          <p className="text-xs font-medium text-text-tertiary mb-1">Description</p>
                          <p className="text-sm text-text-secondary">{task.description}</p>
                        </div>
                      )}
                      {task.actionRequired && (
                        <div className="p-3 bg-brand-50 rounded-lg border border-brand-200">
                          <p className="text-xs font-medium text-brand-700 mb-1">Action Required</p>
                          <p className="text-sm text-brand-800">{task.actionRequired}</p>
                        </div>
                      )}
                      {task.confirmedAt && (
                        <p className="text-xs text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          Confirmed: {formatRelativeTime(task.confirmedAt, t.shared)}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
