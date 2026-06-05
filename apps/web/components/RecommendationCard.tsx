'use client';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: string;
  rating?: number;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="group bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-slate-200 hover:border-blue-300 overflow-hidden hover:-translate-y-2">
      {/* Product Image Placeholder */}
      <div className="relative h-56 bg-gradient-to-br from-blue-100 via-blue-50 to-slate-50 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transition-opacity"></div>
        <div className="text-center text-8xl opacity-20 group-hover:opacity-40 transition-opacity scale-110 group-hover:scale-125 duration-300">
          📦
        </div>
        {product.category && (
          <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
            {product.category}
          </div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
            {product.description}
          </p>
        </div>
        
        {/* Rating */}
        {product.rating && (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${
                    i < Math.floor(product.rating || 0) ? 'text-yellow-400' : 'text-slate-300'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-slate-600 font-semibold">{product.rating}</span>
          </div>
        )}
        
        {/* Price & Action */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-500 mb-1">Price</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              ₹{product.price.toLocaleString('en-IN')}
            </p>
          </div>
          <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 active:scale-95 whitespace-nowrap">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
