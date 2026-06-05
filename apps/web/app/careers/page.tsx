'use client';

export default function CareersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Join Our Team</h1>
        <p className="text-xl text-slate-600">Help us revolutionize e-commerce with AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Innovation</h3>
          <p className="text-slate-600">Work on cutting-edge AI and machine learning projects</p>
        </div>
        <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Culture</h3>
          <p className="text-slate-600">Join a collaborative team that cares about your growth</p>
        </div>
        <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
          <div className="text-4xl mb-3">💰</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Benefits</h3>
          <p className="text-slate-600">Competitive compensation and comprehensive benefits</p>
        </div>
      </div>

      <div className="bg-blue-50 p-12 rounded-xl border border-blue-200 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">🌟 We're Hiring</h2>
        <p className="text-lg text-slate-600 mb-8">We're currently looking for talented engineers and product managers</p>
        <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all">
          View Open Positions
        </button>
      </div>

      <p className="mt-12 text-center text-slate-600">Email us at careers@delegatecart.com to learn more</p>
    </div>
  );
}