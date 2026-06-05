import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-md dark:bg-slate-700 ${className || ''}`}
      {...props}
    />
  );
}
