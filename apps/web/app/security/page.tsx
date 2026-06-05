'use client';

export default function SecurityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Security & Compliance</h1>
        <p className="text-xl text-slate-600">Enterprise-grade security protecting your data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">🔒 Certifications</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3"><span>✓</span> <span>ISO 27001 Certified</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>SOC 2 Type II Compliant</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>GDPR Compliant</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>PCI-DSS Level 1</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>CCPA Compliant</span></li>
          </ul>
        </div>

        <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">🛡️ Security Features</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3"><span>✓</span> <span>End-to-end encryption</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>256-bit SSL/TLS</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>Multi-factor authentication</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>DDoS protection</span></li>
            <li className="flex items-center gap-3"><span>✓</span> <span>24/7 monitoring</span></li>
          </ul>
        </div>
      </div>

      <div className="bg-blue-50 p-8 rounded-xl border border-blue-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Data Privacy</h2>
        <p className="text-slate-600 leading-relaxed mb-4">Your data is your data. We implement strict data governance policies and never sell your information to third parties. All data is encrypted and stored in secure, redundant facilities.</p>
        <p className="text-slate-600 leading-relaxed">For detailed security documentation and compliance reports, please contact our security team at security@delegatecart.com</p>
      </div>
    </div>
  );
}