import { NextRequest } from 'next/server';
import {
  validateSession,
  trackBehavior,
  trackAnalyticsEvent,
  getUserPreferences,
  getProductBehaviorStats,
  insertSmartIntentRecord,
  findLearnedResponse,
} from '@/lib/db';
import { scoreProducts, ScoredProduct } from '@/lib/ai-scoring';

export const runtime = 'nodejs';

// Parsed product data for AI scoring
interface ChatProduct {
  name: string;
  brand: string;
  price: number;
  rating: number;
  matchScore: number;
  estimatedDelivery: string;
  emiAvailable: boolean;
  url: string;
}

function parseProductEntry(entry: string): ChatProduct | null {
  // Parse "Brand Model (₹XX,XXX)" format
  const match = entry.match(/^(.+?)\s*\(₹([\d,]+)\)$/);
  if (!match) return null;
  const fullName = match[1].trim();
  const priceStr = match[2].replace(/,/g, '');
  const price = parseInt(priceStr, 10);
  if (isNaN(price) || price <= 0) return null;
  const brand = fullName.split(' ')[0];
  return {
    name: fullName,
    brand,
    price,
    rating: 4.2 + Math.random() * 0.6, // simulated
    matchScore: 80,
    estimatedDelivery: '2-5 days',
    emiAvailable: price > 10000,
    url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(fullName + ' buy online India')}`,
  };
}

function generateAIResponse(message: string): string {
  const msg = message.toLowerCase();

  const productMap: Record<string, { keywords: string[]; products: string[]; tips: string }> = {
    laptop: {
      keywords: ['laptop', 'macbook', 'chromebook'],
      products: [
        'MacBook Air M3 (₹1,14,990)',
        'Dell XPS 15 (₹89,990)',
        'HP Spectre x360 (₹79,990)',
        'Lenovo ThinkPad X1 Carbon (₹1,09,990)',
      ],
      tips: 'Consider RAM (16GB+), SSD (512GB+), and battery life when choosing.',
    },
    phone: {
      keywords: ['phone', 'mobile', 'smartphone', 'iphone', 'android'],
      products: [
        'Samsung Galaxy S24 (₹74,999)',
        'Apple iPhone 15 (₹79,990)',
        'OnePlus 12 (₹64,999)',
        'Google Pixel 8 (₹59,999)',
      ],
      tips: 'Look for 5G support, camera quality, and battery capacity.',
    },
    headphone: {
      keywords: ['headphone', 'earphone', 'earbuds', 'airpods', 'headset'],
      products: [
        'Sony WH-1000XM5 (₹24,999)',
        'Apple AirPods Pro (₹22,999)',
        'Bose QC45 (₹29,000)',
        'Sennheiser Momentum 4 (₹32,990)',
      ],
      tips: 'For ANC, Sony XM5 leads. For Apple users, AirPods Pro integrates best.',
    },
    tv: {
      keywords: ['tv', 'tvs', 'television', 'televisions', 'oled', 'qled', 'smart tv'],
      products: [
        'Samsung 55" QLED (₹55,990)',
        'LG OLED C3 55" (₹1,09,990)',
        'Sony Bravia XR 55" (₹89,990)',
        'OnePlus 55" Q2 Pro (₹44,999)',
      ],
      tips: 'OLED offers better contrast but QLED is brighter. Choose 4K resolution minimum.',
    },
    camera: {
      keywords: ['camera', 'dslr', 'mirrorless', 'gopro'],
      products: [
        'Canon EOS R50 (₹74,990)',
        'Sony ZV-E10 (₹55,990)',
        'Fujifilm X-T30 II (₹84,990)',
        'Nikon Z30 (₹69,990)',
      ],
      tips: 'Mirrorless cameras are lighter and have better autofocus than DSLRs.',
    },
    watch: {
      keywords: ['watch', 'smartwatch', 'fitness band', 'fitness tracker'],
      products: [
        'Apple Watch Series 9 (₹41,900)',
        'Samsung Galaxy Watch 6 (₹29,999)',
        'Garmin Venu 3 (₹44,990)',
        'Noise ColorFit Ultra 3 (₹4,999)',
      ],
      tips: 'For fitness tracking, Garmin excels. For ecosystem integration, stick to Apple or Samsung.',
    },
    speaker: {
      keywords: ['speaker', 'bluetooth speaker', 'soundbar', 'audio'],
      products: [
        'JBL Charge 5 (₹13,999)',
        'Sony SRS-XB43 (₹16,990)',
        'Bose SoundLink Max (₹39,990)',
        'Sonos Roam 2 (₹19,990)',
      ],
      tips: 'For portability, JBL is excellent. For room-filling sound, Sony XB43 is hard to beat.',
    },
    tablet: {
      keywords: ['tablet', 'ipad', 'tab'],
      products: [
        'Apple iPad Air M2 (₹59,900)',
        'Samsung Galaxy Tab S9 (₹72,999)',
        'OnePlus Pad 2 (₹39,999)',
        'Lenovo Tab P12 Pro (₹54,990)',
      ],
      tips: 'For creative work, iPad with Apple Pencil is ideal. For Android flexibility, Galaxy Tab S9.',
    },
    stationery: {
      keywords: [
        'pen',
        'pencil',
        'eraser',
        'notebook',
        'notepad',
        'diary',
        'ruler',
        'stapler',
        'marker',
        'highlighter',
        'stationery',
        'stationary',
        'ball pen',
        'bal pen',
        'gel pen',
        'ballpoint',
        'sketch',
        'crayon',
        'register',
        'folder',
        'binder',
      ],
      products: [
        'Cello Butterflow Ball Pen Pack of 10 (₹100)',
        'Reynolds Trimax Gel Pen Pack of 5 (₹150)',
        'Classmate Notebook 180 Pages Pack of 6 (₹270)',
        'Doms Y1+ Pencil Pack of 10 (₹60)',
        'Navneet Long Notebook 172 Pages Pack of 5 (₹225)',
      ],
      tips: 'For smooth writing, Cello Butterflow is a top choice. For gel pen lovers, Reynolds Trimax offers excellent ink flow. Classmate notebooks are durable and widely trusted.',
    },
    washing_machine: {
      keywords: ['washing machine', 'washer', 'laundry'],
      products: [
        'LG 8 Kg Front Load (₹28,990)',
        'Samsung 7 Kg Top Load (₹18,490)',
        'IFB 6.5 Kg Front Load (₹24,990)',
        'Bosch 7 Kg Front Load (₹31,990)',
      ],
      tips: 'Front-load machines are more efficient. Look for inverter technology for lower electricity bills.',
    },
    refrigerator: {
      keywords: ['fridge', 'refrigerator', 'freezer'],
      products: [
        'LG 260L Double Door (₹26,990)',
        'Samsung 253L Frost Free (₹23,990)',
        'Whirlpool 245L Double Door (₹21,490)',
      ],
      tips: 'Frost-free models require less maintenance. Inverter compressors save energy.',
    },
    ac: {
      keywords: ['ac', 'air conditioner', 'air conditioning', 'cooler'],
      products: [
        'Daikin 1.5 Ton 5-Star Inverter (₹42,990)',
        'Voltas 1.5 Ton 3-Star (₹29,990)',
        'Blue Star 1 Ton 5-Star Inverter (₹36,990)',
      ],
      tips: '5-star rated ACs save more energy. Inverter ACs are quieter and more efficient.',
    },
  };

  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.some((g) => msg.includes(g))) {
    return 'Hello! Welcome to DelegateCart AI Shopping Assistant 🛍️\n\nI can help you find the best products across all categories. Try asking me things like:\n• "Find me a good laptop under ₹80,000"\n• "Compare Sony vs Apple headphones"\n• "Best smartphones for photography"\n• "Recommend a budget smartwatch"\n\nWhat are you shopping for today?';
  }

  if (msg.includes('help') || msg.includes('what can you do')) {
    return "I'm your AI-powered shopping assistant! Here's what I can do:\n\n🔍 **Product Search** — Find products by category, brand, or features\n💰 **Price Comparison** — Compare prices across multiple sellers\n⭐ **Recommendations** — Get personalized picks based on your needs\n🤔 **Expert Advice** — Get tips on what to look for before buying\n\nJust tell me what you're looking for and your budget, and I'll find the best options!";
  }

  // Match product categories using keywords array (BEFORE budget keywords so
  // "laptop under 50000" matches laptop, not the generic budget tip)
  for (const [category, info] of Object.entries(productMap)) {
    if (info.keywords.some((kw) => msg.includes(kw))) {
      const productList = info.products.map((p, i) => `${i + 1}. ${p}`).join('\n');
      return `Great choice! Here are the top ${category === 'stationery' ? 'stationery items' : category + 's'} I recommend:\n\n${productList}\n\n💡 **Pro Tip:** ${info.tips}\n\nWould you like me to compare any of these in detail, or do you have a specific budget in mind?`;
    }
  }

  if (
    msg.includes('budget') ||
    msg.includes('cheap') ||
    msg.includes('affordable') ||
    msg.includes('under')
  ) {
    return "Great thinking on budget! Here are some tips for smart shopping:\n\n💡 **Budget Shopping Tips:**\n• Set a clear max price before browsing\n• Compare at least 3 options before buying\n• Check for ongoing sale events (Big Billion Days, Great Indian Festival)\n• Look for refurbished options for premium brands\n• Check EMI options for big purchases\n\nWhat specific product category are you looking in? I'll find the best value picks for your budget!";
  }

  if (
    msg.includes('compare') ||
    msg.includes('vs') ||
    msg.includes('versus') ||
    msg.includes('difference')
  ) {
    // Check if the comparison involves a specific product category first
    for (const [category, info] of Object.entries(productMap)) {
      if (info.keywords.some((kw) => msg.includes(kw))) {
        const productList = info.products.map((p, i) => `${i + 1}. ${p}`).join('\n');
        return `Great choice! Here are the top ${category === 'stationery' ? 'stationery items' : category + 's'} I recommend for comparison:\n\n${productList}\n\n💡 **Pro Tip:** ${info.tips}\n\nWould you like a detailed side-by-side comparison of any two products?`;
      }
    }
    return `I'll help you compare products! To give you the best comparison, please tell me:\n\n1. Which two products would you like to compare?\n2. What matters most to you? (Price, performance, battery, camera, etc.)\n\nFor example: "Compare Samsung S24 vs iPhone 15" or "Sony XM5 vs Bose QC45"\n\nI'll break down the key differences and help you decide!`;
  }

  if (
    msg.includes('recommend') ||
    msg.includes('suggest') ||
    msg.includes('best') ||
    msg.includes('top')
  ) {
    return "Happy to make recommendations! To find the perfect product for you, I'd like to know:\n\n1. **What category?** (Electronics, phones, laptops, etc.)\n2. **Your budget?** (Under ₹10K, ₹10K-50K, 50K+)\n3. **Key feature?** (Battery life, performance, camera quality, design)\n4. **Brand preference?** (Apple, Samsung, Sony, etc.) or open to all?\n\nThe more details you share, the better I can tailor my recommendations for you!";
  }

  // Generic helpful response
  return `I found that "${message}" is a popular search! 🔍\n\nHere's what I can help you with:\n\n• **Best deals** on ${message} products right now\n• **Price comparison** across top brands\n• **Feature breakdown** to help you decide\n• **Budget options** from ₹5,000 to premium range\n\nTo get more specific recommendations, try:\n• "Best ${message} under [your budget]"\n• "Compare [Brand A] vs [Brand B] ${message}"\n• "Features to look for in a ${message}"\n\nWhat would you like to explore?`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message || body.input || body.text || '';
    const bodyUserId = body.user_id || body.userId || null;

    if (!message.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve authenticated user
    const authHeader = request.headers.get('authorization') || '';
    const authToken =
      authHeader.replace('Bearer ', '').trim() || request.cookies.get('authToken')?.value || '';
    let userId: number | null = null;
    if (authToken) {
      try {
        const session = await validateSession(authToken);
        userId = (session as any)?.userId ?? null;
      } catch {
        /* anonymous */
      }
    }

    // ── Try Smart Intent Engine v2 first ─────────────────────────────────
    let aiResponse: string;
    let intentResult: any = null;
    try {
      const { processQuery, isSmartIntentV2Enabled } = await import('@/lib/smart-intent');
      if (isSmartIntentV2Enabled()) {
        const result = processQuery(message);
        intentResult = result;
        if (result.engine_version === 'v2' && result.initial_text) {
          // Use only the opening line of the v2 response — this avoids showing
          // synthetic/catalog product names in the chat text. Real DB products
          // are shown via the dedicated product carousel (from /api/intent/analyze).
          const firstLine = result.initial_text.split('\n')[0] || result.initial_text;
          aiResponse = firstLine.replace(/:$/, '.');

          // ── Self-Learning: Check for learned/enriched responses ──────────
          try {
            const learned = await findLearnedResponse(message);
            if (learned) {
              // Replace questions in the response text with learned ones
              const learnedData = learned.questions as any;
              if (learnedData?.questions && Array.isArray(learnedData.questions)) {
                // Override the engine's questions with learned ones
                result.questions = learnedData.questions;
              }
              if (learnedData?.response?.text) {
                // Use only the first line of learned responses too
                const learnedFirstLine =
                  (learnedData.response.text as string).split('\n')[0] || learnedData.response.text;
                aiResponse = learnedFirstLine.replace(/:$/, '.');
              }
            }
          } catch {
            /* learning lookup failed — continue with original */
          }
        } else {
          aiResponse = generateAIResponse(message);
        }
      } else {
        aiResponse = generateAIResponse(message);
      }
    } catch {
      aiResponse = generateAIResponse(message);
    }

    // ── Self-Learning: Capture query + response to DB (fire-and-forget) ──
    const userEmail = request.headers.get('x-user-email') || '';
    // Use auth-resolved userId if available; otherwise fall back to the body's user_id
    // (set from localStorage for anonymous browser sessions)
    const queryByLabel = userEmail || (userId ? `user-${userId}` : bodyUserId || 'anonymous');
    insertSmartIntentRecord({
      userId,
      queryBy: queryByLabel,
      queryText: message,
      initialProductSuggestionText: aiResponse.slice(0, 500),
      userEmail: userEmail || undefined,
      intentEngineResponse: intentResult
        ? {
            intent: intentResult.intent,
            questions: intentResult.questions,
            products: (intentResult.products || []).slice(0, 5).map((p: any) => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              price: p.price,
              relevanceScore: p.relevanceScore,
            })),
            response: intentResult.response,
            engine_version: intentResult.engine_version,
            processing_time_ms: intentResult.processing_time_ms,
          }
        : { raw_response: aiResponse.slice(0, 300), engine_version: 'v1' },
    }).catch((err) => console.error('[Learning] Failed to capture:', err.message));

    // Track chat behavior + analytics (fire-and-forget)
    if (userId) {
      trackBehavior(userId, message, 'search', { source: 'chat' }).catch(() => {});
    }
    trackAnalyticsEvent('chat_message', userId, null, { query: message.slice(0, 200) }).catch(
      () => {}
    );

    // Return as plain streaming text (word by word)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const words = aiResponse.split(' ');
        for (const word of words) {
          controller.enqueue(encoder.encode(word + ' '));
          await new Promise<void>((r) => setTimeout(r, 25));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-User-Id': String(userId || bodyUserId || 'anonymous'),
      },
    });
  } catch (error) {
    console.error('Chat message error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
