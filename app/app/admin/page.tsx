"use client";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
}

interface Stats {
  totalFindings: number;
  private: number;
  pending: number;
  reviewed: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()),
      fetch("/api/admin/stats").then(r => r.json())
    ]).then(([usersData, statsData]) => {
      if (usersData.users) setUsers(usersData.users);
      if (statsData.stats) setStats(statsData.stats);
    }).finally(() => setLoading(false));
  }, []);

  async function approve(id: string) {
    if (!confirm("Approve this clinician?")) return;
    await fetch(`/api/admin/users/${id}/approve`, { method: "POST" });
    setUsers(users.map(u => u.id === id ? { ...u, role: "clinician" } : u));
  }

  async function reject(id: string) {
    if (!confirm("Reject this clinician?")) return;
    await fetch(`/api/admin/users/${id}/reject`, { method: "POST" });
    setUsers(users.map(u => u.id === id ? { ...u, role: "rejected" } : u));
  }

  if (loading) {
    return <div className="p-10 text-center text-muted">Loading dashboard…</div>;
  }

  const pendingClinicians = users.filter(u => u.role === "pending_clinician");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 space-y-8 animate-fadeIn">
      <div>
        <h1 className="font-display text-3xl">Admin Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Manage users and view platform analytics.
        </p>
      </div>

      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={users.length} />
          <StatCard label="Pending Findings" value={stats.pending} highlight />
          <StatCard label="Reviewed Findings" value={stats.reviewed} />
          <StatCard label="Total Findings" value={stats.totalFindings} />
        </section>
      )}

      {pendingClinicians.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-medium text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-flag inline-block animate-pulse2"></span>
            Pending clinician approvals
          </h2>
          <div className="card divide-y hairline">
            {pendingClinicians.map(u => (
              <div key={u.id} className="p-4 flex items-center justify-between bg-flag/5">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                  <div className="text-xs text-muted mt-1">Signed up: {new Date(u.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reject(u.id)} className="btn btn-ghost !text-danger">Reject</button>
                  <button onClick={() => approve(u.id)} className="btn btn-primary">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-medium text-lg">User Directory</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface2 border-b hairline">
              <tr>
                <th className="px-4 py-2 font-medium">Name / Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y hairline">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface2/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`tag ${
                      u.role === "admin" ? "bg-ink text-surface" :
                      u.role === "clinician" ? "accent" : 
                      u.role === "pending_clinician" ? "flag" : ""
                    }`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted text-center pt-8">
        Privacy notice: For data protection compliance, patient medical data and findings text are not exposed in this dashboard.
      </p>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string, value: number, highlight?: boolean }) {
  return (
    <div className={`card p-5 ${highlight ? 'border-accent/40 bg-accent/5' : ''}`}>
      <div className="text-xs text-muted font-medium mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-display ${highlight ? 'text-accent' : ''}`}>{value}</div>
    </div>
  );
}
