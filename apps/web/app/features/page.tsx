'use client';

export default function FeaturesPage() {
  const features = [
    {
      icon: '🤖',
      title: 'AI Recommendations',
      description: 'Advanced machine learning that learns your preferences and suggests products you\'ll love',
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Sub-100ms response times with optimized infrastructure and intelligent caching',
    },
    {
      icon: '🔒',
      title: 'Enterprise Security',
      description: 'End-to-end encryption, compliance with PCI-DSS, GDPR, and industry standards',
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Real-time insights into shopping behavior, trends, and spending patterns',
    },
    {
      icon: '🎯',
      title: 'Smart Search',
      description: 'Natural language search that understands intent and context',
    },
    {
      icon: '💬',
      title: 'AI Chat Support',
      description: '24/7 intelligent customer support available in multiple languages',
    },
    {
      icon: '🌍',
      title: 'Global Reach',
      description: 'Multi-currency support and shipping integration worldwide',
    },
    {
      icon: '📱',
      title: 'Mobile Optimized',
      description: 'Seamless experience across all devices and platforms',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Powerful Features</h1>
        <p className="text-xl text-slate-600">Everything you need for a world-class e-commerce experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
        {features.map((feature, idx) => (
          <div key={idx} className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 transition-all">
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-slate-50 p-12 rounded-xl border border-blue-200 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to get started?</h2>
        <p className="text-lg text-slate-600 mb-8">Join thousands of merchants already using DelegateCart</p>
        <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all">
          Start Your Free Trial
        </button>
      </div>
    </div>
  );
}
