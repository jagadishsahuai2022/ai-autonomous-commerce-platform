/**
 * useAI Hook
 * - React Query integration for AI services
 * - Intent parsing, product ranking, recommendations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  aiService,
  type ParsedQuery,
  type RankedProduct,
  type RankingRequest,
  type RecommendationRequest,
  type ComparisonRequest,
  type ComparisonResult,
} from '@/services/ai.service';

/**
 * Query keys for AI
 */
export const aiQueryKeys = {
  all: ['ai'] as const,
  intent: () => [...aiQueryKeys.all, 'intent'] as const,
  parse: (query: string) => [...aiQueryKeys.intent(), query] as const,
  ranking: () => [...aiQueryKeys.all, 'ranking'] as const,
  rank: (productIds: string[]) => [...aiQueryKeys.ranking(), { productIds }] as const,
  recommend: (data: RecommendationRequest) =>
    [...aiQueryKeys.ranking(), 'recommend', { ...data }] as const,
  comparison: () => [...aiQueryKeys.all, 'comparison'] as const,
  compare: (productIds: string[]) => [...aiQueryKeys.comparison(), { productIds }] as const,
  feed: () => [...aiQueryKeys.all, 'feed'] as const,
  personalized: () => [...aiQueryKeys.feed(), 'personalized'] as const,
};

/**
 * useParseIntent - Parse user query using AI
 */
export const useParseIntent = (query: string | null, userId?: string) => {
  return useQuery({
    queryKey: query ? aiQueryKeys.parse(query) : ['parse-no-query'],
    queryFn: () => aiService.parseIntent(query!, userId),
    enabled: !!query && query.trim().length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useRankProducts - Rank products based on preferences
 */
export const useRankProducts = (request: RankingRequest | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: request ? aiQueryKeys.rank(request.productIds) : ['rank-no-request'],
    queryFn: () => aiService.rankProducts(request!),
    enabled: enabled && !!request,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useGetRecommendations - Get product recommendations
 */
export const useGetRecommendations = (
  request: RecommendationRequest | null,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: request ? aiQueryKeys.recommend(request) : ['recommend-no-request'],
    queryFn: () => aiService.getRecommendations(request!),
    enabled: enabled && !!request,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * useCompareProducts - Compare products
 */
export const useCompareProducts = (productIds: string[] | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: productIds ? aiQueryKeys.compare(productIds) : ['compare-no-ids'],
    queryFn: () =>
      aiService.compareProducts({
        productIds: productIds!,
      }),
    enabled: enabled && !!productIds && productIds.length > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * usePersonalizedFeed - Get personalized product feed
 */
export const usePersonalizedFeed = (limit: number = 20) => {
  return useQuery({
    queryKey: aiQueryKeys.personalized(),
    queryFn: () => aiService.getPersonalizedFeed(limit),
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * useMutateParseIntent - Mutation for intent parsing (manual trigger)
 */
export const useMutateParseIntent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: string) => aiService.parseIntent(query),
    onSuccess: (data) => {
      // Cache the parsed intent
      queryClient.setQueryData(aiQueryKeys.parse(data.originalQuery), data);
    },
  });
};

/**
 * useMutateRankProducts - Mutation for ranking products
 */
export const useMutateRankProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: RankingRequest) => aiService.rankProducts(request),
    onSuccess: (data, request) => {
      queryClient.setQueryData(aiQueryKeys.rank(request.productIds), data);
    },
  });
};

/**
 * useMutateCompareProducts - Mutation for comparing products
 */
export const useMutateCompareProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ComparisonRequest) => aiService.compareProducts(request),
    onSuccess: (data, request) => {
      queryClient.setQueryData(aiQueryKeys.compare(request.productIds), data);
    },
  });
};

/**
 * Helper: Combined AI + search flow
 * Parses intent, then ranks products
 */
export const useAISearch = (query: string | null, enabled: boolean = true) => {
  const parseQuery = useParseIntent(query, undefined);
  const rankQuery = useRankProducts(
    parseQuery.data
      ? {
          productIds: [], // Will be filled from search results
          context: {
            keywords: parseQuery.data.keywords,
          },
        }
      : null,
    enabled && !!parseQuery.data
  );

  return {
    parsed: parseQuery,
    ranked: rankQuery,
    isLoading: parseQuery.isLoading || rankQuery.isLoading,
    isError: parseQuery.isError || rankQuery.isError,
  };
};

/**
 * useAnalyzeSentiment - Analyze text sentiment (for reviews)
 */
export const useAnalyzeSentiment = (text: string | null) => {
  return useQuery({
    queryKey: ['sentiment', text],
    queryFn: () => aiService.analyzeSentiment(text!),
    enabled: !!text && text.trim().length > 0,
    staleTime: Infinity, // Immutable result
  });
};

/**
 * useGetAIServiceHealth - Check AI service status
 */
export const useGetAIServiceHealth = () => {
  return useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiService.getServiceHealth(),
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};
