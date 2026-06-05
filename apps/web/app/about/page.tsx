'use client';

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">About DelegateCart</h1>
        <p className="text-xl text-slate-600">Revolutionizing e-commerce with AI-powered intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Mission</h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            DelegateCart is dedicated to transforming the online shopping experience through advanced artificial intelligence and machine learning. We believe that shopping should be personalized, intuitive, and delightful.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed">
            Our mission is to empower both merchants and customers with intelligent tools that drive better business decisions and create meaningful shopping experiences.
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 p-8 rounded-xl border border-blue-200">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">🎯 Core Values</h3>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-semibold text-slate-900">Innovation</p>
                <p className="text-slate-600 text-sm">Continuously advancing AI technology</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <p className="font-semibold text-slate-900">Trust</p>
                <p className="text-slate-600 text-sm">Secure and transparent operations</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold text-slate-900">Excellence</p>
                <p className="text-slate-600 text-sm">Superior user experience always</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">📊 By The Numbers</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { value: '50K+', label: 'Active Users' },
            { value: '100M+', label: 'Products Indexed' },
            { value: '45%', label: 'Higher Engagement' },
            { value: '99.9%', label: 'Uptime' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">{stat.value}</p>
              <p className="text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
