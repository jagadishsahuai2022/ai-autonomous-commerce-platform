/**
 * Skeleton loader component for displaying loading states
 * Used when data is being fetched from the API
 */

export const ProductCardSkeleton = () => (
  <div className="flex flex-col bg-gray-100 rounded-lg p-3 animate-pulse">
    {/* Image skeleton */}
    <div className="w-full h-40 bg-gray-300 rounded-lg mb-2" />
    
    {/* Title skeleton */}
    <div className="h-3 bg-gray-300 rounded w-3/4 mb-2" />
    
    {/* Price skeleton */}
    <div className="h-4 bg-gray-300 rounded w-1/2 mb-3" />
    
    {/* Original price skeleton */}
    <div className="h-2 bg-gray-300 rounded w-1/3 mb-2" />
    
    {/* Badges skeleton */}
    <div className="flex gap-1 mb-2">
      <div className="h-5 bg-gray-300 rounded px-2 w-12" />
      <div className="h-5 bg-gray-300 rounded px-2 w-10" />
    </div>
    
    {/* Rating skeleton */}
    <div className="h-3 bg-gray-300 rounded w-1/2 mb-2" />
    
    {/* Buttons skeleton */}
    <div className="flex gap-2 mt-2">
      <div className="flex-1 h-8 bg-gray-300 rounded" />
      <div className="h-8 w-8 bg-gray-300 rounded" />
    </div>
  </div>
);

export const ProductListSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export const HeroSkeleton = () => (
  <div className="w-full h-64 bg-gray-300 rounded-lg animate-pulse mb-4" />
);

export const FiltersSkeleton = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2">
        <div className="h-4 bg-gray-300 rounded w-1/2" />
        <div className="h-3 bg-gray-300 rounded w-full" />
        <div className="h-3 bg-gray-300 rounded w-full" />
      </div>
    ))}
  </div>
);
