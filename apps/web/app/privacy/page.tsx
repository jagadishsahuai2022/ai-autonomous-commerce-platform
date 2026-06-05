'use client';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 className="text-5xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
      <div className="prose prose-slate max-w-none">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-600 leading-relaxed">
              DelegateCart ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Data Collection</h2>
            <p className="text-slate-600 leading-relaxed">
              We collect information you provide directly, such as when you create an account, make a purchase, or contact us. We also automatically collect certain information about your device and browsing behavior.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Use of Your Information</h2>
            <p className="text-slate-600 leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services, process transactions, and comply with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              You have the right to access, correct, or delete your personal data. You can also opt out of marketing communications at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at privacy@delegatecart.com
            </p>
          </section>

          <p className="text-xs text-slate-500 pt-4 border-t border-slate-200">Last updated: March 23, 2024</p>
        </div>
      </div>
    </div>
  );
}