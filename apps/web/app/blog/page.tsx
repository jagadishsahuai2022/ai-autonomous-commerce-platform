'use client';

export default function BlogPage() {
  const posts = [
    {
      title: 'The Future of AI in E-Commerce',
      excerpt: 'Exploring how artificial intelligence is transforming retail',
      date: 'March 20, 2026',
      readTime: '5 min read',
      category: 'AI',
    },
    {
      title: 'Building Better Customer Experiences',

      excerpt: 'Best practices for personalization at scale',
      date: 'March 18, 2026',
      readTime: '7 min read',
      category: 'UX',
    },
    {
      title: 'Security Best Practices for Online Stores',
      excerpt: 'Protecting your business and customers',
      date: 'March 15, 2026',
      readTime: '6 min read',
      category: 'Security',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">DelegateCart Blog</h1>
        <p className="text-xl text-slate-600">Insights, updates, and best practices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {posts.map((post, idx) => (
          <article key={idx} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 overflow-hidden transition-all hover:-translate-y-1 cursor-pointer">
            <div className="h-48 bg-gradient-to-br from-blue-100 to-slate-50 flex items-center justify-center">
              <div className="text-6xl">📝</div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{post.category}</span>
                <span className="text-xs text-slate-500">{post.readTime}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{post.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{post.excerpt}</p>
              <p className="text-xs text-slate-500">{post.date}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-20 p-8 bg-blue-50 rounded-xl border border-blue-200 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">📚 More Articles Coming</h2>
        <p className="text-slate-600">We're adding new content regularly. Subscribe to our newsletter to stay updated.</p>
      </div>
    </div>
  );
}