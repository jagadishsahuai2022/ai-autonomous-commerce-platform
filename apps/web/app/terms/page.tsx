'use client';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 className="text-5xl font-bold text-slate-900 mb-8">Terms of Service</h1>
      <div className="prose prose-slate max-w-none">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Use License</h2>
            <p className="text-slate-600 leading-relaxed">
              Permission is granted to temporarily download one copy of the materials for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Disclaimer</h2>
            <p className="text-slate-600 leading-relaxed">
              The materials on DelegateCart are provided on an 'as is' basis. DelegateCart makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Limitations</h2>
            <p className="text-slate-600 leading-relaxed">
              In no event shall DelegateCart or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption).
            </p>
          </section>

          <p className="text-xs text-slate-500 pt-4 border-t border-slate-200">Last updated: March 23, 2024</p>
        </div>
      </div>
    </div>
  );
}