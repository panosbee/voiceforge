// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Admin Panel (Full-featured SPA)
// Login → Dashboard with stats, registrations, license keys,
// customer management all in one page with tab navigation.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/env';

// ── Types ────────────────────────────────────────────────────────

interface Registration {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  afm: string;
  doy: string;
  phone: string;
  businessAddress: string;
  plan: string;
  durationMonths: number;
  userRole: string;
  status: string;
  createdAt: string;
}

interface LicenseKey {
  id: string;
  licenseKey: string;
  plan: string;
  durationMonths: number;
  pricePaid: number | null;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  companyName: string;
  status: string;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Customer {
  id: string;
  email: string;
  ownerName: string;
  businessName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  plan: string;
  isActive: boolean;
  registrationStatus: string;
  licenseKey: string | null;
  licenseExpiresAt: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface Stats {
  pendingRegistrations: number;
  approvedRegistrations: number;
  totalRegistrations: number;
  activeKeys: number;
  pendingKeys: number;
  expiredKeys: number;
  totalKeys: number;
  activeCustomers: number;
  totalCustomers: number;
}

type Tab = 'dashboard' | 'registrations' | 'licenses' | 'customers';

// ── Admin API Helper ─────────────────────────────────────────────

function adminFetch(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `Request failed: ${res.status}`);
    return json;
  });
}

// ═══════════════════════════════════════════════════════════════════
// Admin Page Component
// ═══════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Check for saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem('voiceforge-admin-token');
    if (saved) setToken(saved);
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!data.success) {
        setLoginError(data.error?.message || 'Λάθος κωδικός');
        return;
      }
      const adminToken = data.data.token;
      setToken(adminToken);
      localStorage.setItem('voiceforge-admin-token', adminToken);
    } catch {
      setLoginError('Σφάλμα σύνδεσης');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('voiceforge-admin-token');
  };

  // ── Login Screen ──
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
              <span className="text-3xl">🛡️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 mt-1">VoiceForge AI — Διαχείριση</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Secret</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Εισάγετε τον κωδικό admin..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading || !secret}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition"
            >
              {loginLoading ? 'Σύνδεση...' : 'Είσοδος'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard token={token} onLogout={handleLogout} />;
}

// ═══════════════════════════════════════════════════════════════════
// Admin Dashboard (authenticated)
// ═══════════════════════════════════════════════════════════════════

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [regFilter, setRegFilter] = useState('pending');

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/stats', token);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [token]);

  const fetchRegistrations = useCallback(async (status = 'pending') => {
    try {
      const res = await adminFetch(`/admin/registrations?status=${status}`, token);
      setRegistrations(res.data);
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
    }
  }, [token]);

  const fetchLicenseKeys = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/license-keys', token);
      setLicenseKeys(res.data);
    } catch (err) {
      console.error('Failed to fetch license keys:', err);
    }
  }, [token]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/customers', token);
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchRegistrations(), fetchLicenseKeys(), fetchCustomers()])
      .finally(() => setLoading(false));
  }, [fetchStats, fetchRegistrations, fetchLicenseKeys, fetchCustomers]);

  useEffect(() => {
    fetchRegistrations(regFilter);
  }, [regFilter, fetchRegistrations]);

  // ── Actions ──

  const handleGenerateKey = async (reg: Registration) => {
    const prices: Record<string, number> = { starter: 2900, professional: 7900, business: 19900 };
    try {
      await adminFetch('/admin/license-keys/generate', token, {
        method: 'POST',
        body: JSON.stringify({
          registrationId: reg.id,
          plan: reg.plan,
          durationMonths: reg.durationMonths,
          pricePaid: (prices[reg.plan] ?? 0) * reg.durationMonths,
        }),
      });
      alert(`Κλειδί δημιουργήθηκε και στάλθηκε στο ${reg.email}!`);
      fetchRegistrations(regFilter);
      fetchLicenseKeys();
      fetchStats();
    } catch (err: any) {
      alert(`Σφάλμα: ${err.message}`);
    }
  };

  const handleRejectRegistration = async (id: string) => {
    if (!confirm('Σίγουρα θέλετε να απορρίψετε αυτή την εγγραφή;')) return;
    try {
      await adminFetch(`/admin/registrations/${id}`, token, { method: 'DELETE' });
      fetchRegistrations(regFilter);
      fetchStats();
    } catch (err: any) {
      alert(`Σφάλμα: ${err.message}`);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Σίγουρα θέλετε να ανακαλέσετε αυτό το κλειδί; Ο πελάτης θα χάσει πρόσβαση.')) return;
    try {
      await adminFetch(`/admin/license-keys/${id}/revoke`, token, { method: 'PATCH' });
      fetchLicenseKeys();
      fetchCustomers();
      fetchStats();
    } catch (err: any) {
      alert(`Σφάλμα: ${err.message}`);
    }
  };

  const planLabels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    business: 'Business',
    enterprise: 'Enterprise',
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      approved: 'bg-blue-100 text-blue-800',
      expired: 'bg-gray-100 text-gray-600',
      revoked: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-orange-100 text-orange-700',
    };
    const labels: Record<string, string> = {
      pending: 'Εκκρεμεί',
      active: 'Ενεργό',
      approved: 'Εγκρίθηκε',
      expired: 'Έληξε',
      revoked: 'Ανακλήθηκε',
      rejected: 'Απορρίφθηκε',
      suspended: 'Αναστολή',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'registrations', label: 'Εγγραφές', icon: '📝' },
    { id: 'licenses', label: 'Κλειδιά', icon: '🔑' },
    { id: 'customers', label: 'Πελάτες', icon: '👥' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🛡️</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">VoiceForge Admin</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {stats && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    {stats.pendingRegistrations} εκκρεμείς
                  </span>
                </div>
              )}
              <button
                onClick={onLogout}
                className="text-sm text-gray-500 hover:text-red-600 font-medium transition"
              >
                Αποσύνδεση
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.id === 'registrations' && stats && stats.pendingRegistrations > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full font-bold">
                    {stats.pendingRegistrations}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Επισκόπηση</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Εκκρεμείς Εγγραφές"
                value={stats.pendingRegistrations}
                icon="📝"
                color="yellow"
              />
              <StatCard
                label="Ενεργά Κλειδιά"
                value={stats.activeKeys}
                icon="🔑"
                color="green"
              />
              <StatCard
                label="Ενεργοί Πελάτες"
                value={stats.activeCustomers}
                icon="👥"
                color="blue"
              />
              <StatCard
                label="Σύνολο Πελατών"
                value={stats.totalCustomers}
                icon="📈"
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Εγγραφές</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Εκκρεμείς</span>
                    <span className="font-semibold text-yellow-600">{stats.pendingRegistrations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Εγκεκριμένες</span>
                    <span className="font-semibold text-green-600">{stats.approvedRegistrations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Σύνολο</span>
                    <span className="font-semibold">{stats.totalRegistrations}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Κλειδιά Αδειών</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ενεργά</span>
                    <span className="font-semibold text-green-600">{stats.activeKeys}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Εκκρεμή ενεργοποίηση</span>
                    <span className="font-semibold text-yellow-600">{stats.pendingKeys}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ληγμένα</span>
                    <span className="font-semibold text-gray-500">{stats.expiredKeys}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Σύνολο</span>
                    <span className="font-semibold">{stats.totalKeys}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Εγγραφές Πελατών</h2>
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRegFilter(s)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                      regFilter === s
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-white text-gray-500 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {{ pending: 'Εκκρεμείς', approved: 'Εγκρίθηκαν', rejected: 'Απορρίφθηκαν' }[s]}
                  </button>
                ))}
              </div>
            </div>

            {registrations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <span className="text-4xl block mb-3">📭</span>
                <p className="text-gray-500">Δεν υπάρχουν εγγραφές με αυτό το φίλτρο.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((reg) => (
                  <div key={reg.id} className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-gray-900">{reg.companyName}</h3>
                          {statusBadge(reg.status)}
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                            {planLabels[reg.plan] || reg.plan}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                          <div><span className="text-gray-400">Ονοματεπώνυμο:</span> <span className="font-medium text-gray-800">{reg.firstName} {reg.lastName}</span></div>
                          <div><span className="text-gray-400">Email:</span> <span className="font-medium text-gray-800">{reg.email}</span></div>
                          <div><span className="text-gray-400">Τηλέφωνο:</span> <span className="font-medium text-gray-800">{reg.phone}</span></div>
                          <div><span className="text-gray-400">ΑΦΜ:</span> <span className="font-medium text-gray-800">{reg.afm}</span></div>
                          <div><span className="text-gray-400">ΔΟΥ:</span> <span className="font-medium text-gray-800">{reg.doy}</span></div>
                          <div><span className="text-gray-400">Διεύθυνση:</span> <span className="font-medium text-gray-800">{reg.businessAddress}</span></div>
                          <div><span className="text-gray-400">Διάρκεια:</span> <span className="font-medium text-gray-800">{reg.durationMonths} μήνες</span></div>
                          <div><span className="text-gray-400">Ημ/νία:</span> <span className="font-medium text-gray-800">{formatDate(reg.createdAt)}</span></div>
                        </div>
                      </div>

                      {reg.status === 'pending' && (
                        <div className="flex gap-2 lg:flex-col">
                          <button
                            onClick={() => handleGenerateKey(reg)}
                            className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition whitespace-nowrap"
                          >
                            ✅ Έγκριση & Κλειδί
                          </button>
                          <button
                            onClick={() => handleRejectRegistration(reg.id)}
                            className="flex-1 lg:flex-none px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition whitespace-nowrap"
                          >
                            ❌ Απόρριψη
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* License Keys Tab */}
        {activeTab === 'licenses' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Κλειδιά Αδειών</h2>

            {licenseKeys.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <span className="text-4xl block mb-3">🔑</span>
                <p className="text-gray-500">Δεν υπάρχουν κλειδιά ακόμα.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Κλειδί</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Πελάτης</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Πακέτο</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Διάρκεια</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Κατάσταση</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Λήξη</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Ενέργειες</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenseKeys.map((key) => (
                        <tr key={key.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{key.licenseKey}</code>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{key.customerName}</div>
                            <div className="text-xs text-gray-400">{key.customerEmail}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-600">{planLabels[key.plan] || key.plan}</td>
                          <td className="px-4 py-3">{key.durationMonths} μήν.</td>
                          <td className="px-4 py-3">{statusBadge(key.status)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(key.expiresAt)}</td>
                          <td className="px-4 py-3">
                            {(key.status === 'active' || key.status === 'pending') && (
                              <button
                                onClick={() => handleRevokeKey(key.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium transition"
                              >
                                Ανάκληση
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Πελάτες ({customers.length})</h2>

            {customers.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <span className="text-4xl block mb-3">👥</span>
                <p className="text-gray-500">Δεν υπάρχουν πελάτες ακόμα.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Πελάτης</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Εταιρεία</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Πακέτο</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Κατάσταση</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Κλειδί</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Λήξη Αδείας</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Εγγραφή</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((cust) => (
                        <tr key={cust.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">
                              {cust.firstName && cust.lastName
                                ? `${cust.firstName} ${cust.lastName}`
                                : cust.ownerName}
                            </div>
                            <div className="text-xs text-gray-400">{cust.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {cust.companyName || cust.businessName}
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-600">
                            {planLabels[cust.plan] || cust.plan}
                          </td>
                          <td className="px-4 py-3">
                            {cust.isActive
                              ? statusBadge('active')
                              : statusBadge(cust.registrationStatus || 'pending')}
                          </td>
                          <td className="px-4 py-3">
                            {cust.licenseKey ? (
                              <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                {cust.licenseKey}
                              </code>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(cust.licenseExpiresAt)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(cust.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Stat Card Component
// ═══════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: 'yellow' | 'green' | 'blue' | 'purple';
}) {
  const colorStyles = {
    yellow: 'from-yellow-500 to-amber-500',
    green: 'from-green-500 to-emerald-500',
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-violet-500',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className={`w-10 h-1.5 rounded-full bg-gradient-to-r ${colorStyles[color]}`} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
