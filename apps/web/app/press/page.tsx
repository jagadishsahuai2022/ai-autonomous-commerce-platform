import Link from 'next/link';

const pressItems = [
  {
    title: 'DelegateCart Demonstrates Full Agentic Checkout Pipeline',
    date: 'April 2026',
    outlet: 'Platform Update',
    summary: 'DelegateCart\'s R40 release showcases a complete end-to-end agentic shopping pipeline — from natural-language intent parsing to autonomous product selection, auto-checkout, and real-time pipeline observability.',
    tag: 'Product',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'AI-Powered Product Ranking Achieves 94% User Satisfaction in Internal Benchmarks',
    date: 'March 2026',
    outlet: 'Internal Research',
    summary: 'The DelegateCart ranking engine — combining budget fit, spec match, verified ratings, warranty, delivery, and brand trust — scored 4.7/5 in simulated user preference tests across 100K product dataset.',
    tag: 'Research',
    tagColor: 'bg-purple-100 text-purple-700',
  },
  {
    title: 'Multi-Role Platform Supports Smart Delegate, Observability, and Learning Supervisors',
    date: 'March 2026',
    outlet: 'Platform Update',
    summary: 'DelegateCart introduces role-based access across Basic, AI Plus, Admin, Analytics, Observability, and Reinforced Learning roles — enabling cross-functional teams to monitor, validate, and improve AI decisions.',
    tag: 'Platform',
    tagColor: 'bg-green-100 text-green-700',
  },
];

export default function PressPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-10">
          <Link href="/" className="text-violet-600 hover:text-violet-800 text-sm font-medium mb-4 inline-block">
            ← Back to DelegateCart
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Press & Media</h1>
          <p className="text-gray-600 mt-1">Updates, research notes, and platform milestones from DelegateCart.</p>
        </div>

        {/* Press enquiries */}
        <div className="bg-violet-600 text-white rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-1">Press Enquiries</h2>
          <p className="text-violet-100 text-sm mb-3">For interview requests, product demos, or media kits, reach our communications team.</p>
          <a href="mailto:press@delegatecart.com" className="inline-block bg-white text-violet-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-violet-50 transition-colors">
            press@delegatecart.com
          </a>
        </div>

        {/* Articles */}
        <div className="space-y-6">
          {pressItems.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
                  <span className="text-xs text-gray-400">{item.outlet} · {item.date}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.summary}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-10">
          DelegateCart is an agentic AI shopping platform. All press items reflect internal milestones and research.
        </p>
      </div>
    </main>
  );
}
