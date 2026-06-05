import Link from 'next/link';

const releases = [
  {
    version: 'R41',
    date: 'April 2026',
    tag: 'Latest',
    tagColor: 'bg-green-100 text-green-800',
    highlights: [
      'Rich dimension chip modals — Warranty, Spec Match, Delivery, Verified Ratings',
      'Cross-user data visibility for privileged roles',
      'Full-name display with alias in Metrics Validation and Self-Learning Dashboard',
      'Graceful database-unavailable state for Self-Learning Dashboard',
      '/api/auth/me endpoint added — resolves 404 in Docker deployments',
      'Self-Learning email whitelist extended (reenforcedlearning, analytics)',
      'Footer pages: Changelog, Press, Cookies',
    ],
  },
  {
    version: 'R40',
    date: 'April 2026',
    tag: 'Stable',
    tagColor: 'bg-blue-100 text-blue-800',
    highlights: [
      'Smart Shopping Copilot — agentic checkout + pipeline orchestration',
      'Observability Dashboard — live pipeline monitoring',
      'Self-Learning Dashboard — SmartIntent record management',
      'Metrics Validation Dashboard — multi-session analytics',
      'Multi-user demo sessions for admin view',
      'Kafka-based pipeline with WebSocket streaming',
    ],
  },
  {
    version: 'R39',
    date: 'March 2026',
    tag: 'Archive',
    tagColor: 'bg-gray-100 text-gray-600',
    highlights: [
      'AI-powered product ranking engine',
      'Smart intent parsing with context memory',
      'Role-based access — Basic, AI Plus, Admin',
      'Product aggregator with catalog search',
      'Initial Docker multi-service deployment',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-violet-600 hover:text-violet-800 text-sm font-medium mb-4 inline-block">
            ← Back to DelegateCart
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Changelog</h1>
          <p className="text-gray-600 mt-1">Release notes and feature updates for DelegateCart.</p>
        </div>

        {/* Releases */}
        <div className="space-y-8">
          {releases.map((r) => (
            <div key={r.version} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{r.version}</h2>
                  <p className="text-sm text-gray-500">{r.date}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.tagColor}`}>{r.tag}</span>
              </div>
              <ul className="px-6 py-4 space-y-2">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-violet-500 mt-0.5 flex-shrink-0">✦</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-10">
          DelegateCart is an agentic AI shopping platform. All release notes reflect internal build milestones.
        </p>
      </div>
    </main>
  );
}
