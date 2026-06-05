import Link from 'next/link';

const coverageItems = [
  { category: 'What we collect', icon: '📋', items: ['Session data (queries, product rankings)', 'Authentication tokens (session-only)', 'User preferences and AI interaction history', 'Performance telemetry (page load, API latency)'] },
  { category: 'What we do NOT collect', icon: '🚫', items: ['Payment card details (handled by payment processor)', 'Government ID or Aadhaar numbers', 'Precise location without consent', 'Biometric data of any kind'] },
  { category: 'Cookies we use', icon: '🍪', items: ['Session cookie — keeps you logged in (expires on browser close or 24 hours)', 'Preference cookie — stores your UI theme and column preferences (30-day expiry)', 'Analytics cookie — aggregate usage telemetry, no PII (90-day expiry)', 'Security cookie — CSRF protection token (session-only)'] },
  { category: 'Third-party cookies', icon: '🔗', items: ['We do not embed third-party advertising cookies', 'Analytics is first-party only — no Google Analytics or similar', 'No social-login pixels or cross-site tracking'] },
  { category: 'Your controls', icon: '⚙️', items: ['Clear session: Log out or clear browser cookies', 'Opt-out of analytics: Contact us at privacy@delegatecart.com', 'Data export: Available on request within 30 days', 'Data deletion: Permanent removal within 14 days on verified request'] },
];

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-10">
          <Link href="/" className="text-violet-600 hover:text-violet-800 text-sm font-medium mb-4 inline-block">
            ← Back to DelegateCart
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Cookie & Privacy Policy</h1>
          <p className="text-gray-500 mt-1 text-sm">Last updated April 2026 · Applies to delegatecart.com</p>
        </div>

        <div className="space-y-6">
          {coverageItems.map((section) => (
            <div key={section.category} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{section.icon}</span>
                <h2 className="text-base font-bold text-gray-900">{section.category}</h2>
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-violet-50 rounded-2xl border border-violet-200 p-5">
          <h3 className="text-sm font-bold text-violet-900 mb-1">Contact our Privacy Team</h3>
          <p className="text-sm text-violet-700">For data access, correction, export, or deletion requests — email <strong>privacy@delegatecart.com</strong>. We respond within 5 business days.</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          DelegateCart is committed to transparency in data handling. Policy applies to all authenticated and guest sessions.
        </p>
      </div>
    </main>
  );
}
