import { NextRequest, NextResponse } from 'next/server';
import {
  getSmartIntentRecords,
  updateSupervisedResponse,
  updateAIEnrichedResponse,
  deleteSmartIntentRecord,
  getUnenrichedRecordsForModel,
  toggleSmartIntentActive,
} from '@/lib/db';
import { enrichWithRealLLM, LLM_MODELS, checkModelConnectivity } from '@/lib/llm-enrichment';

export const runtime = 'nodejs';

const ADMIN_EMAILS = ['admin@delegatecart.com', 'admin@example.com'];
const LEARNING_EMAILS = [
  'admin@delegatecart.com', 'admin@example.com',
  'supervisedlearning@delegatecart.com',  // legacy alias
  'reenforcedlearning@delegatecart.com',  // current DEMO_USERS entry
  'reinforcedlearning@delegatecart.com',  // alternate spelling
  'observability@delegatecart.com',
  'analytics@delegatecart.com',
];

// LLM model configuration
const DEFAULT_MODEL = 'gemini-flash';

function isAdmin(request: NextRequest): boolean {
  const email = request.headers.get('x-user-email') || '';
  return LEARNING_EMAILS.includes(email.toLowerCase());
}

/** GET — Fetch all learning records (paginated, admin only) OR list available LLM models */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Handle models endpoint
  if (action === 'models') {
    return NextResponse.json({
      models: LLM_MODELS,
      default: DEFAULT_MODEL,
      description: 'Select an LLM model for batch enrichment',
    });
  }

  // Handle connectivity check endpoint
  if (action === 'check-connectivity') {
    const modelId = url.searchParams.get('model') || DEFAULT_MODEL;
    try {
      const connectivity = await checkModelConnectivity(modelId);
      const status = connectivity.connected ? 200 : 503;
      return NextResponse.json(connectivity, { status });
    } catch (err: any) {
      return NextResponse.json(
        { modelId, connected: false, error: `Connectivity check failed: ${err.message}`, apiKeyConfigured: false, provider: 'unknown' },
        { status: 503 }
      );
    }
  }

  // Handle general records fetch
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const search = url.searchParams.get('search') || undefined;
  const sortField = url.searchParams.get('sortField') || 'id';
  const sortDir = url.searchParams.get('sortDir') || 'desc';
  const filterActiveRaw = url.searchParams.get('filterActive');
  const filterAIRaw = url.searchParams.get('filterAI');
  const filterActive = filterActiveRaw === 'active' || filterActiveRaw === 'inactive' ? filterActiveRaw : undefined;
  const filterAI = filterAIRaw === 'enriched' || filterAIRaw === 'unenriched' ? filterAIRaw : undefined;
  // Per-column filters — passed from the grid popup filters for server-side filtering
  const filterQueryBy = url.searchParams.get('filterQueryBy') || undefined;
  const filterQueryText = url.searchParams.get('filterQueryText') || undefined;

  try {
    const result = await getSmartIntentRecords(limit, offset, search, sortField, sortDir, filterActive, filterAI, filterQueryBy, filterQueryText);
    return NextResponse.json(result);
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[Learning API] GET error:', errorMsg);
    console.error('[Learning API] Stack:', errorStack);
    
    // Return error response instead of silently falling back to demo data
    return NextResponse.json(
      {
        error: 'Failed to fetch learning records from database',
        details: errorMsg,
        dbUnavailable: true,
        records: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

/** PATCH — Update supervised or AI-enriched response */
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const adminEmail = request.headers.get('x-user-email') || 'system';

  try {
    const body = await request.json();
    const { id, supervisedResponse, aiEnrichedResponse, isActive } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let record = null;
    if (typeof isActive === 'boolean') {
      record = await toggleSmartIntentActive(id, isActive, adminEmail);
    } else if (aiEnrichedResponse !== undefined) {
      record = await updateAIEnrichedResponse(id, aiEnrichedResponse, adminEmail);
    } else if (supervisedResponse !== undefined) {
      record = await updateSupervisedResponse(id, supervisedResponse, adminEmail);
    } else {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('[Learning API] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}

/** DELETE — Remove a learning record */
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const deleted = await deleteSmartIntentRecord(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Learning API] DELETE error:', error.message);
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
  }
}


/** POST — Batch AI enrichment with REAL LLM (Claude or GPT) + Active filter */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'enrich-batch') {
      const batchSize = Math.min(body.batchSize || 10, 100);
      const selectedModel = body.model || DEFAULT_MODEL;
      const forceRealLLM = body.realLLMOnly !== false; // Default: use real LLM
      const selectedIds: number[] | undefined = Array.isArray(body.selectedIds) && body.selectedIds.length > 0
        ? body.selectedIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
        : undefined;

      // Validate model selection
      const modelInfo = LLM_MODELS.find(m => m.id === selectedModel);
      if (!modelInfo) {
        return NextResponse.json(
          { error: `Unknown model: ${selectedModel}. Available: ${LLM_MODELS.map(m => m.id).join(', ')}` },
          { status: 400 }
        );
      }

      // ── PRE-FLIGHT CONNECTIVITY CHECK ────────────────────────────────────────
      // Verify the selected LLM is reachable BEFORE touching any DB records.
      // If unavailable, return detailed error immediately — no data is changed.
      const connectivity = await checkModelConnectivity(selectedModel);
      if (!connectivity.connected) {
        console.warn(`[Learning API] LLM connectivity check failed for ${selectedModel}:`, connectivity.error);
        return NextResponse.json(
          {
            error: 'LLM model is not available. No records were processed.',
            model: selectedModel,
            provider: modelInfo.provider,
            connectivity: {
              connected: false,
              apiKeyConfigured: connectivity.apiKeyConfigured,
              errorDetail: connectivity.error,
              resolution: !connectivity.apiKeyConfigured
                ? `Set ${modelInfo.apiKeyEnv} environment variable and restart the server.`
                : 'Check API key validity, rate limits, or network connectivity.',
            },
          },
          { status: 503 }
        );
      }
      console.log(`[Learning API] LLM connectivity OK: ${selectedModel} (${connectivity.latencyMs}ms)`);
      // ─────────────────────────────────────────────────────────────────────────

      // Fetch ONLY ACTIVE + UNENRICHED records (30 days recent), or specific selected IDs
      const records = await getUnenrichedRecordsForModel(batchSize, selectedModel, selectedIds);

      if (records.length === 0) {
        return NextResponse.json({
          message: 'No active unenriched records found in last 30 days',
          enriched: 0,
          model: selectedModel,
          provider: modelInfo.provider,
        });
      }

      let enrichedCount = 0;
      let totalTokensUsed = 0;
      const errors: Array<{ recordId: number; error: string }> = [];
      const enrichmentSources: Record<string, number> = {};

      console.log(
        `[Learning API] Starting batch enrichment: ${records.length} records with ${selectedModel}`
      );

      // Process each ACTIVE record through REAL LLM enrichment
      const adminEmail = request.headers.get('x-user-email') || 'system';
      for (const record of records) {
        try {
          const result = await enrichWithRealLLM(
            record.queryText,
            record.intentEngineResponse as Record<string, unknown>,
            selectedModel,
            forceRealLLM
          );

          if (result && result.enriched) {
            await updateAIEnrichedResponse(record.id, result.enriched, adminEmail);
            enrichedCount++;
            totalTokensUsed += result.tokensUsed || 0;

            // Track enrichment source
            enrichmentSources[result.source] = (enrichmentSources[result.source] || 0) + 1;

            console.log(`[Learning API] ✓ Record ${record.id} enriched by ${result.source}`);
          }
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          console.error(`[Learning API] ✗ Failed to enrich record ${record.id}:`, errorMsg);
          errors.push({ recordId: record.id, error: errorMsg });
        }
      }

      // Calculate estimated cost
      const estimatedCost = (totalTokensUsed / 1000000) * modelInfo.costPerMTok;

      const response = {
        message: `Enriched ${enrichedCount}/${records.length} active records using ${modelInfo.name}`,
        enriched: enrichedCount,
        total: records.length,
        model: selectedModel,
        provider: modelInfo.provider,
        tokensUsed: totalTokensUsed,
        estimatedCost: Number(estimatedCost.toFixed(6)),
        costCurrency: 'USD',
        enrichmentSources,
        isActive: true,
        errors: errors.length > 0 ? errors : undefined,
      };

      return NextResponse.json(response);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Learning API] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// Old enrichment functions removed - now using real LLM enrichment from /lib/llm-enrichment.ts
// See enrichWithRealLLM() which supports Claude 3 Opus, GPT-4 Turbo, and GPT-3.5-turbo
