import { NextRequest, NextResponse } from 'next/server';
import { insertSmartIntentRecord } from '@/lib/db';

// â”€â”€ Session state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// In-memory Maps are the primary store (fast, zero-latency).
// On container restart they reset, so every request also seeds from `current_intent`
// sent by the frontend, making the session resilient to restarts and multi-worker deployments.
const sessionAnswers = new Map<string, Record<string, string>>();
const sessionIntents = new Map<string, Record<string, unknown>>();
// Total questions per user session â€” set dynamically from the frontend (actual questions generated)
const sessionTotalQuestions = new Map<string, number>();
const DEFAULT_TOTAL_QUESTIONS = 3;

const BUDGET_MAP: Record<string, { min: number; max: number }> = {
  under_10k: { min: 0, max: 10000 },
  '10k_30k': { min: 10000, max: 30000 },
  '10k_20k': { min: 10000, max: 20000 },
  '20k_40k': { min: 20000, max: 40000 },
  '30k_60k': { min: 30000, max: 60000 },
  '40k_60k': { min: 40000, max: 60000 },
  '60k_plus': { min: 60000, max: 500000 },
  '60k_100k': { min: 60000, max: 100000 },
  '100k_plus': { min: 100000, max: 500000 },
  under_30k: { min: 0, max: 30000 },
  under_1k: { min: 0, max: 1000 },
  '1k_5k': { min: 1000, max: 5000 },
  '5k_15k': { min: 5000, max: 15000 },
  '15k_plus': { min: 15000, max: 100000 },
  under_15k: { min: 0, max: 15000 },
  '15k_30k': { min: 15000, max: 30000 },
  under_2k: { min: 0, max: 2000 },
  '2k_5k': { min: 2000, max: 5000 },
  '5k_20k': { min: 5000, max: 20000 },
  '20k_plus': { min: 20000, max: 200000 },
  under_20k: { min: 0, max: 20000 },
  '20k_50k': { min: 20000, max: 50000 },
  '50k_100k': { min: 50000, max: 100000 },
  '20k_35k': { min: 20000, max: 35000 },
  '35k_plus': { min: 35000, max: 100000 },
  '25k_50k': { min: 25000, max: 50000 },
  '50k_plus': { min: 50000, max: 200000 },
  under_25k: { min: 0, max: 25000 },
  '25k_40k': { min: 25000, max: 40000 },
  under_5k: { min: 0, max: 5000 },
  '30k_plus': { min: 30000, max: 200000 },
  '15k_25k': { min: 15000, max: 25000 },
  // Stationery-specific budget ranges
  under_50: { min: 0, max: 50 },
  '50_200': { min: 50, max: 200 },
  '200_500': { min: 200, max: 500 },
  '500_plus': { min: 500, max: 5000 },
};

function parseBudgetAnswer(answer: string): { min: number; max: number } | null {
  // Handle custom budget: "custom_5000"
  if (typeof answer === 'string' && answer.startsWith('custom_')) {
    const amount = parseInt(answer.replace('custom_', ''), 10);
    if (!isNaN(amount) && amount > 0) {
      return { min: 0, max: Math.round(amount * 1.2) };
    }
  }
  // Handle dynamic budget format from new analyze API: "0_1299", "1299_3499", etc.
  if (typeof answer === 'string' && /^\d+_\d+$/.test(answer)) {
    const [minStr, maxStr] = answer.split('_');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    if (!isNaN(min) && !isNaN(max) && max > min) {
      return { min, max };
    }
  }
  if (answer === 'any') return { min: 0, max: 999999 };
  if (answer === 'other') return null; // user will type custom amount
  return BUDGET_MAP[answer] ?? null;
}

function parseBrandAnswer(answer: string): string | null {
  // Handle custom brand: "custom_Bosch"
  if (typeof answer === 'string' && answer.startsWith('custom_')) {
    return answer.replace('custom_', '').trim() || null;
  }
  if (answer === 'any') return null;
  // Standard brand map
  const label = answer.charAt(0).toUpperCase() + answer.slice(1);
  return label || null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTE: The embedded FALLBACK_PRODUCTS catalogue and getEmbeddedProducts()
// function have been permanently removed.  All product data must come from the
// real database via fetchDBProducts() (v2 path) or the NestJS API (v1 path).
// Returning synthetic/hardcoded products undermines user trust and produces
// incorrect, non-purchasable results.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Infers question category from the question ID using legacy positional mapping.
 * Used as a fallback when question_category is not sent by the frontend.
 */
function inferCategoryFromId(
  questionId: string,
  currentIntent: Record<string, unknown> | null | undefined
): string {
  // If budget is already known, q1 was likely NOT a budget question
  const hasBudget = currentIntent?.budget && (currentIntent.budget as any)?.max > 0;
  const hasBrand =
    currentIntent?.preferred_brand !== null && currentIntent?.preferred_brand !== undefined;

  if (questionId === 'q1') return hasBudget ? (hasBrand ? 'use_case' : 'brand') : 'budget';
  if (questionId === 'q2') return hasBudget ? (hasBrand ? 'feature' : 'use_case') : 'brand';
  if (questionId === 'q3') return 'use_case';
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, question_id, question_category, total_questions, answer, current_intent } =
      body;

    if (!user_id || !question_id) {
      return NextResponse.json({ error: 'Missing user_id or question_id' }, { status: 400 });
    }

    // â”€â”€ Dynamic total â€” use frontend's actual count, falling back to stored or default â”€â”€
    if (total_questions && typeof total_questions === 'number' && total_questions > 0) {
      sessionTotalQuestions.set(user_id, total_questions);
    }
    const TOTAL_QUESTIONS = sessionTotalQuestions.get(user_id) ?? DEFAULT_TOTAL_QUESTIONS;

    // â”€â”€ Session management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If the in-memory Map was wiped (container restart, multi-worker), start a
    // fresh session. We removed false "reconstructed" prefilling because it caused
    // incorrect answer counts when current_intent fields were already pre-detected
    // from the user's query (not from actual question answers).
    let answers = sessionAnswers.get(user_id);
    if (!answers) {
      answers = {};
    }
    answers[question_id] = String(answer);
    sessionAnswers.set(user_id, answers);

    // Store/update intent â€” seed from current_intent when not in Map
    const intent: Record<string, unknown> = sessionIntents.get(user_id) || {
      ...(current_intent || {}),
      answers_collected: 0,
    };

    // â”€â”€ Category-based answer routing (fixes the positional q1/q2/q3 assumption bug) â”€â”€
    // question_category is sent by the frontend from the actual question object.
    // This ensures answers are always routed to the correct intent field regardless
    // of which questions were generated/skipped for the current query.
    const category = question_category || inferCategoryFromId(question_id, current_intent);
    const answerStr = String(answer);

    if (category === 'budget') {
      const budgetRange = parseBudgetAnswer(answerStr);
      if (budgetRange) {
        (intent as Record<string, unknown>).budget = budgetRange;
      }
    } else if (category === 'brand') {
      const brand = parseBrandAnswer(answerStr);
      (intent as Record<string, unknown>).preferred_brand = brand || null;
      (intent as Record<string, unknown>).preferences = brand ? [brand] : [];
    } else if (category === 'use_case') {
      (intent as Record<string, unknown>).use_case = answerStr;
    } else if (category === 'feature') {
      const existing = ((intent as Record<string, unknown>).features as string[]) || [];
      (intent as Record<string, unknown>).features = [...existing, answerStr].filter(
        (f) => f !== 'none'
      );
    } else if (category === 'delivery') {
      (intent as Record<string, unknown>).delivery_preference = answerStr;
    } else {
      // Legacy fallback: positional q1/q2/q3 mapping (kept for backward compat)
      if (question_id === 'q1') {
        const budgetRange = parseBudgetAnswer(answerStr);
        if (budgetRange) (intent as Record<string, unknown>).budget = budgetRange;
      } else if (question_id === 'q2') {
        const brand = parseBrandAnswer(answerStr);
        (intent as Record<string, unknown>).preferred_brand = brand || null;
        (intent as Record<string, unknown>).preferences = brand ? [brand] : [];
      } else if (question_id === 'q3') {
        const useCaseValues = [
          'gaming',
          'office',
          'student',
          'travel',
          'photography',
          'music',
          'fitness',
          'coding',
          'entertainment',
          'home',
          'creative',
          'general',
          'energy_efficient',
          'smart',
          'professional',
          'vlogging',
          'party',
        ];
        if (useCaseValues.includes(answerStr)) {
          (intent as Record<string, unknown>).use_case = answerStr;
        } else {
          (intent as Record<string, unknown>).delivery_preference = answerStr;
        }
      }
    }

    const answeredCount = Object.keys(answers).length;
    (intent as Record<string, unknown>).answers_collected = answeredCount;
    sessionIntents.set(user_id, intent);

    const updated_intent = intent;

    // When all questions answered, fetch products from the backend and return recommendations
    if (answeredCount >= TOTAL_QUESTIONS) {
      try {
        const budget = (intent as Record<string, unknown>).budget as
          | { min: number; max: number }
          | undefined;
        const category = (intent as Record<string, unknown>).category as string | undefined;
        const preferredBrand = (intent as Record<string, unknown>).preferred_brand as string | null;
        const useCase = (intent as Record<string, unknown>).use_case as string | undefined;

        // â”€â”€ Try Smart Intent Engine v2 for richer results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Uses fetchDBProducts (real DB only) â€” no synthetic catalog data.
        try {
          const { fetchDBProducts, rankProducts, isSmartIntentV2Enabled } =
            await import('@/lib/smart-intent');
          if (isSmartIntentV2Enabled()) {
            // Collect feature answers from this session — forwarded to rankProducts()
            // so featureMatch / useCaseMatch dimension scorers boost matching products.
            const features = ((intent as Record<string, unknown>).features as string[]) || [];
            // FIX: include all required ParsedIntent fields (noun_signals, amount_signals)
            const v2Intent = {
              category: category || null,
              brand: preferredBrand || null,
              budget: budget || null,
              use_case: useCase || null,
              // Pass collected feature answers so featureMatch dimension scorer
              // can boost products matching the user's stated requirements.
              features,
              confidence: 60,
              raw_tokens: [] as string[],
              matched_entities: [] as any[],
              noun_signals: category ? [category] : ([] as string[]),
              amount_signals: budget ? [`${budget.min}_${budget.max}`] : ([] as string[]),
            };
            // Fetch REAL DB products ranked by intent — same pattern as /analyze route.
            // If the DB returns 0 results, fall through to the v1 API path below.
            const dbProducts = await fetchDBProducts(
              category || null,
              budget,
              preferredBrand || null,
              20,
              {
                useCase: useCase || null,
                features,
                // Forward any extra noun signals the v1 path may have stored
                // on the intent (e.g. user's original product noun phrase).
                searchTerms: [
                  (intent as Record<string, unknown>).user_intent as string | undefined,
                  ...(((intent as Record<string, unknown>).noun_signals as string[]) || []),
                ].filter((s): s is string => typeof s === 'string' && s.length > 0),
              }
            );
            if (dbProducts.length > 0) {
              const rankInputs = dbProducts.map((p) => ({
                product: p,
                matchScore: 90,
                matchReasons: ['db'] as string[],
              }));
              const ranked = rankProducts(rankInputs, v2Intent);
              const products = ranked.slice(0, 8).map((p) => ({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.price,
                originalPrice: p.originalPrice,
                category: p.category,
                rating: p.rating,
                reviewCount: p.reviewCount,
                image: p.image,
                inStock: p.inStock,
                delivery: p.delivery,
                codAvailable: p.codAvailable,
                hasEMI: p.hasEMI,
                attributes: p.attributes,
                relevanceScore: p.relevanceScore,
              }));

              sessionAnswers.delete(user_id);
              sessionIntents.delete(user_id);
              sessionTotalQuestions.delete(user_id);

              // â”€â”€ Capture quiz completion in SmartIntentEngineResponse â”€â”€
              const numUserId = /^\d+$/.test(String(user_id))
                ? parseInt(String(user_id), 10)
                : null;
              const queryText =
                (intent.user_intent as string) || (intent.category as string) || 'quiz-completed';
              insertSmartIntentRecord({
                userId: numUserId,
                queryBy: String(user_id),
                queryText,
                initialProductSuggestionText: `Quiz answers: budget=${JSON.stringify(budget)}, brand=${preferredBrand}, use_case=${useCase}`,
                intentEngineResponse: {
                  answers,
                  intent,
                  products: products
                    .slice(0, 5)
                    .map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
                  engine_version: 'v2',
                },
              }).catch((err) => console.error('[Learning] quiz capture failed:', err.message));

              // ── Background DB tag enrichment (fire-and-forget) ──────────
              // Silently grow the ProductTag/ProductTagMap taxonomy from the
              // user's selected use_case + features. Marked approved=false so
              // it never affects ranking until a moderator reviews it.
              try {
                const { triggerTagEnrichment } =
                  await import('@/lib/smart-intent/db-tag-enrichment');
                triggerTagEnrichment({
                  productIds: products.map((p) => p.id),
                  useCase: useCase || null,
                  features,
                  brand: preferredBrand || null,
                });
              } catch {
                // Enrichment is best-effort — never block the user.
              }

              return NextResponse.json({
                updated_intent,
                products,
                ready: true,
                message: 'All questions answered â€” here are your personalized recommendations!',
                engine_version: 'v2',
              });
            }
          }
        } catch (v2Error) {
          console.error('[answer-question] v2 engine error, falling back to v1:', v2Error);
        }
        // â”€â”€ End v2 path â€” fall through to v1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Build query params
        const params = new URLSearchParams({ take: '12', skip: '0' });
        if (category && category !== 'general') params.set('category', category);

        let products: unknown[] = [];

        // Try Docker-internal API first, then localhost fallback, then embedded catalogue
        const apiUrls = [
          process.env.BACKEND_URL,
          'http://ai-commerce-api:3001', // Docker service name (works inside containers)
          'http://localhost:3001', // Local dev fallback
        ].filter(Boolean) as string[];

        for (const apiBase of apiUrls) {
          try {
            const res = await fetch(`${apiBase}/products?${params.toString()}`, {
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) continue;

            const productData = await res.json();
            const rawProducts: unknown[] = Array.isArray(productData)
              ? productData
              : (productData.products ?? productData.data ?? []);

            const budgetFiltered = budget
              ? rawProducts.filter((p) => {
                  const price = (p as Record<string, unknown>).price as number;
                  return price >= budget.min && price <= budget.max;
                })
              : rawProducts;

            products = budgetFiltered.slice(0, 8);
            break; // success â€” stop trying other URLs
          } catch {
            // try next URL
          }
        }

        // If API returned nothing (all URLs failed or returned empty), leave
        // products as [] â€” do NOT fall back to synthetic embedded catalogue.
        // An honest empty result is better than fabricated product data.

        // Clean up session after delivering final recommendations
        sessionAnswers.delete(user_id);
        sessionIntents.delete(user_id);
        sessionTotalQuestions.delete(user_id);

        // â”€â”€ Capture v1 quiz completion in SmartIntentEngineResponse â”€â”€
        const numUserIdV1 = /^\d+$/.test(String(user_id)) ? parseInt(String(user_id), 10) : null;
        const queryTextV1 =
          (intent as any).user_intent || (intent as any).category || 'quiz-completed';
        insertSmartIntentRecord({
          userId: numUserIdV1,
          queryBy: String(user_id),
          queryText: queryTextV1,
          initialProductSuggestionText: `Quiz answers (v1): category=${(intent as any).category}, budget=${JSON.stringify(budget)}, brand=${preferredBrand}`,
          intentEngineResponse: {
            answers,
            intent,
            products: products
              .slice(0, 5)
              .map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
            engine_version: 'v1',
          },
        }).catch((err) => console.error('[Learning] v1 quiz capture failed:', err.message));

        return NextResponse.json({
          updated_intent,
          products,
          ready: true,
          message: 'All questions answered â€” here are your personalized recommendations!',
        });
      } catch (fetchErr) {
        console.error('Failed to fetch products for recommendations:', fetchErr);
        // Do NOT fall back to synthetic embedded catalogue â€” return empty
        // so the mobile app can show an honest "no results" state.
        const fallbackProducts: unknown[] = [];
        sessionAnswers.delete(user_id);
        sessionIntents.delete(user_id);
        sessionTotalQuestions.delete(user_id);

        // â”€â”€ Capture v1 fallback in SmartIntentEngineResponse â”€â”€
        const numUserIdFb = /^\d+$/.test(String(user_id)) ? parseInt(String(user_id), 10) : null;
        const queryTextFb =
          (intent as any).user_intent || (intent as any).category || 'quiz-completed';
        insertSmartIntentRecord({
          userId: numUserIdFb,
          queryBy: String(user_id),
          queryText: queryTextFb,
          initialProductSuggestionText: `Quiz answers (v1-fallback): category=${(intent as any).category}`,
          intentEngineResponse: {
            answers,
            intent,
            products: fallbackProducts
              .slice(0, 5)
              .map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
            engine_version: 'v1-fallback',
          },
        }).catch((err) => console.error('[Learning] v1-fallback capture failed:', err.message));

        return NextResponse.json({
          updated_intent,
          products: fallbackProducts,
          ready: true,
          message: 'Recommendations ready',
        });
      }
    }

    return NextResponse.json({
      updated_intent,
      answers_collected: answeredCount,
      total_questions: TOTAL_QUESTIONS,
      ready: false,
    });
  } catch (error) {
    console.error('Answer question API error:', error);
    return NextResponse.json(
      { error: 'Failed to process answer. Please try again.' },
      { status: 500 }
    );
  }
}
