import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/search/image
 *
 * Accepts a multipart/form-data request with an "image" file field.
 * Analyses the image filename and basic metadata to derive a search query.
 * In production this would integrate with a Vision API (e.g. Google Vision,
 * AWS Rekognition, or a TensorFlow.js model). For now we perform smart
 * filename-based classification with a product-category heuristic and return
 * a structured search query that the products page can use directly.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mobile: [
    'phone',
    'smartphone',
    'iphone',
    'samsung',
    'pixel',
    'redmi',
    'oneplus',
    'oppo',
    'realme',
    'vivo',
    'nokia',
    'motorola',
  ],
  laptop: [
    'laptop',
    'macbook',
    'thinkpad',
    'notebook',
    'chromebook',
    'dell',
    'hp',
    'lenovo',
    'asus',
    'acer',
  ],
  tablet: ['ipad', 'tablet', 'galaxy tab', 'surface'],
  camera: ['camera', 'dslr', 'mirrorless', 'nikon', 'canon', 'sony', 'fuji', 'lens', 'gopro'],
  headphone: ['headphone', 'earphone', 'earbuds', 'airpods', 'earpod', 'buds', 'speaker', 'audio'],
  watch: ['watch', 'smartwatch', 'fitbit', 'garmin', 'timepiece', 'fossil'],
  tv: ['television', 'tv', 'monitor', 'screen', 'display', 'oled', 'qled', 'led'],
  shoe: [
    'shoe',
    'sneaker',
    'boot',
    'sandal',
    'slipper',
    'footwear',
    'nike',
    'adidas',
    'puma',
    'reebok',
  ],
  shirt: ['shirt', 'tshirt', 't-shirt', 'polo', 'kurta', 'top', 'blouse'],
  keyboard: ['keyboard', 'mouse', 'trackpad', 'gamepad', 'controller'],
  book: ['book', 'novel', 'textbook', 'guide', 'manual'],
};

function inferQueryFromImage(
  filename: string,
  mimeType: string
): { query: string; category: string } {
  const name = filename.toLowerCase().replace(/[_\-\.]/g, ' ');

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (name.includes(kw)) {
        return { query: kw, category };
      }
    }
  }

  // Fallback: strip extension and use trimmed words as query
  const withoutExt = name.replace(/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/, '').trim();
  const words = withoutExt
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);
  const query = words.join(' ') || 'product';
  return { query, category: 'general' };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const filename = (file as File).name || 'image.jpg';
    const mimeType = (file as File).type || 'image/jpeg';

    // File-size guard — max 5 MB
    const MAX_BYTES = 5 * 1024 * 1024;
    if ((file as File).size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 413 });
    }

    const { query, category } = inferQueryFromImage(filename, mimeType);

    return NextResponse.json(
      {
        query,
        category,
        message: 'Image analysed successfully',
        // Tell the client what was inferred so it can display it
        inferred: { filename, mimeType, category },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[image-search] error:', err);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
