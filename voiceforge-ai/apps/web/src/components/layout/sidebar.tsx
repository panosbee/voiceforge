// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Dashboard Sidebar Navigation
// Role-based filtering: naive users see simplified nav,
// expert users see everything including Flows.
// ═══════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase-browser';
import { isDevAuthEnabled, clearDevToken } from '@/lib/dev-auth';
import { useI18n } from '@/lib/i18n';
import { LanguageToggle } from '@/components/ui/language-toggle';
import {
  LayoutDashboard,
  Bot,
  Phone,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  CalendarDays,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { UserRole } from '@voiceforge/shared';

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  /** If set, only visible to these roles */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/agents', labelKey: 'agents', icon: Bot },
  { href: '/dashboard/flows', labelKey: 'flows', icon: GitBranch, roles: ['expert'] },
  { href: '/dashboard/calls', labelKey: 'calls', icon: Phone },
  { href: '/dashboard/calendar', labelKey: 'calendar', icon: CalendarDays },
  { href: '/dashboard/analytics', labelKey: 'analytics', icon: BarChart3 },
  { href: '/dashboard/settings', labelKey: 'settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, reset } = useAuthStore();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  // Get user role from profile — default to 'naive' if not set
  const userRole: UserRole = (profile as { userRole?: UserRole } | null)?.userRole ?? 'naive';

  // Filter nav items based on user role
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(userRole)),
    [userRole],
  );

  const handleLogout = async () => {
    // Clear dev auth cookie if in dev mode
    if (isDevAuthEnabled()) {
      clearDevToken();
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    toast.success(t.auth.logoutSuccess);
    router.push('/login');
  };

  // Resolve label from translation key
  const getLabel = (key: string): string => {
    return (t.dashboard.nav as Record<string, string>)[key] ?? key;
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-surface border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        {!collapsed && <span className="text-lg font-bold text-text-primary">VoiceForge</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          const label = getLabel(item.labelKey as string);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border px-2 py-3 space-y-1">
        {/* Language toggle */}
        {!collapsed && (
          <div className="px-3 py-2">
            <LanguageToggle />
          </div>
        )}

        {/* User info */}
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-text-primary truncate">{profile.businessName}</p>
            <p className="text-xs text-text-tertiary truncate">{profile.email}</p>
            <span className={cn(
              'mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
              userRole === 'expert'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-brand-50 text-brand-700',
            )}>
              {userRole}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-danger-50 hover:text-danger-600 transition-colors',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? t.common.logout : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{t.common.logout}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
