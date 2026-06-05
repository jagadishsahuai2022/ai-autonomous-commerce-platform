'use client';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$99',
      period: '/month',
      description: 'Perfect for small stores',
      features: [
        'Up to 1,000 products',
        'Basic AI recommendations',
        'Email support',
        '99.5% uptime SLA',
        'Community dashboard',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$299',
      period: '/month',
      description: 'For growing businesses',
      features: [
        'Unlimited products',
        'Advanced AI analytics',
        'Priority email & chat support',
        '99.9% uptime SLA',
        'Custom integrations',
        'API access',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      description: 'For large enterprises',
      features: [
        'Unlimited everything',
        'Dedicated account manager',
        'Phone & priority support',
        '99.99% uptime SLA',
        'Custom features',
        'On-premise deployment available',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-slate-600">Choose the plan that fits your business</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        {plans.map((plan, idx) => (
          <div
            key={idx}
            className={`rounded-xl border-2 transition-all ${
              plan.highlighted
                ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-white shadow-2xl scale-105'
                : 'border-slate-200 bg-white shadow-md hover:shadow-lg'
            }`}
          >
            {plan.highlighted && (
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-t-lg text-center font-semibold">
                ⭐ MOST POPULAR
              </div>
            )}
            <div className="p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-slate-600 ml-2">{plan.period}</span>
              </div>

              <button
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all mb-8 ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg'
                    : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {plan.cta}
              </button>

              <div className="space-y-3">
                {plan.features.map((feature, fi) => (
                  <p key={fi} className="flex items-center gap-3 text-slate-600">
                    <span className="text-lg">✓</span> {feature}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">All plans include</h2>
        <p className="text-slate-600 mb-6">Free setup, 14-day free trial, and 24/7 customer support</p>
      </div>
    </div>
  );
}
