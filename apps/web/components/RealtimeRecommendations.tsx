/**
 * Real-time Recommendations Component
 * Displays live AI recommendations that update via WebSocket
 */

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useWebSocket, useNotification } from '@/lib/hooks/useWebSocket';
import useRealtimeStore from '@/lib/store/realtime.store';

export const RealtimeRecommendations: React.FC = () => {
  const { recommendations, isConnected } = useWebSocket();
  const store = useRealtimeStore();
  const notification = useNotification();
  const [fadeIn, setFadeIn] = useState(false);

  const [isLoading, setIsLoading] = React.useState(false);

  useEffect(() => {
    if (recommendations.length > 0) {
      // Animate new recommendations
      setFadeIn(false);
      setTimeout(() => setFadeIn(true), 50);

      // Show notification for new recommendations
      notification.add(
        'New Recommendations',
        `${recommendations.length} products recommended for you!`,
        'success'
      );
    }
  }, [recommendations.length]);

  if (!isConnected) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-700">
          📡 Connecting to real-time updates...
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No recommendations yet. Keep browsing to get personalized suggestions!
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-50'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Recommended for You</h2>
        <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
          🔴 LIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((product) => (
          <div
            key={product.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
          >
            <div className="relative h-40 mb-4 bg-gray-100 rounded">
              <Image
                src={product.image}
                alt={product.productName}
                fill
                className="object-cover rounded"
              />
              <span className="absolute top-2 right-2 px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded">
                {Math.round(product.score * 100)}% Match
              </span>
            </div>

            <h3 className="font-semibold text-sm mb-2 line-clamp-2">
              {product.productName}
            </h3>

            <p className="text-lg font-bold text-gray-900 mb-3">
              ₹{product.price.toLocaleString('en-IN')}
            </p>

            <button className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">
              View Product
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RealtimeRecommendations;
