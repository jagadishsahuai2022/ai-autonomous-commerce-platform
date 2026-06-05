'use client';

import { motion } from 'framer-motion';

export function SkeletonLoader({
  width = 'w-full',
  height = 'h-4',
  rounded = 'rounded-lg',
  count = 1,
  className = '',
}: {
  width?: string;
  height?: string;
  rounded?: string;
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {[...Array(count)].map((_, idx) => (
        <motion.div
          key={idx}
          className={`${width} ${height} ${rounded} bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 mb-2`}
          animate={{
            backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl overflow-hidden bg-white shadow-lg p-4 space-y-4"
    >
      {/* Image Skeleton */}
      <SkeletonLoader width="w-full" height="h-48" rounded="rounded-xl" />

      {/* Content Skeletons */}
      <div className="space-y-3">
        <SkeletonLoader width="w-20" height="h-3" />
        <SkeletonLoader width="w-full" height="h-4" />
        <SkeletonLoader width="w-full" height="h-4" />
        <SkeletonLoader width="w-32" height="h-4" />
      </div>

      {/* Rating Skeleton */}
      <SkeletonLoader width="w-full" height="h-3" count={2} />

      {/* Button Skeleton */}
      <SkeletonLoader width="w-full" height="h-10" rounded="rounded-lg" />
    </motion.div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <SkeletonLoader width="w-3/4" height="h-4" rounded="rounded-full" />
      <SkeletonLoader width="w-2/3" height="h-4" rounded="rounded-full" className="mt-2" />
    </motion.div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex gap-4"
        >
          <SkeletonLoader width="w-12" height="h-12" rounded="rounded-full" />
          <div className="flex-1">
            <SkeletonLoader width="w-1/2" height="h-4" />
            <SkeletonLoader width="w-full" height="h-3" className="mt-2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ComparisonTableSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-lg p-6 space-y-4">
      {/* Header */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, idx) => (
          <SkeletonLoader key={idx} width="w-full" height="h-6" />
        ))}
      </div>

      {/* Rows */}
      {[...Array(6)].map((_, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-200">
          {[...Array(4)].map((_, colIdx) => (
            <SkeletonLoader key={colIdx} width="w-full" height="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function OrderSummarySkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Order Card */}
      <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
        <SkeletonLoader width="w-2/3" height="h-6" />
        <div className="flex gap-4">
          <SkeletonLoader width="w-24" height="h-24" rounded="rounded-xl" />
          <div className="flex-1 space-y-3">
            <SkeletonLoader width="w-full" height="h-4" />
            <SkeletonLoader width="w-2/3" height="h-4" />
            <SkeletonLoader width="w-1/3" height="h-4" />
          </div>
        </div>
      </div>

      {/* Timeline Skeleton */}
      <TimelineSkeleton />
    </motion.div>
  );
}
