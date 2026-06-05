import { NextRequest, NextResponse } from 'next/server';

// API_INTERNAL_URL (http://api:3001) is set in docker-compose for server-to-server calls.
// Fallback chain: API_INTERNAL_URL → NEXT_PUBLIC_API_URL → localhost:3001
const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Strip trailing /api/v1 if present — the backend listens at /products not /api/v1/products
const API_URL = API_BASE.replace(/^\/api\/v1\/?$/, 'http://localhost:3001').replace(
  /\/api\/v1\/?$/,
  ''
);

// PUBLIC_API_URL transforms relative /uploads/ image paths for browser consumption.
// When NEXT_PUBLIC_API_URL is relative (/api/v1, Docker prod), keep paths same-origin.
const _rawPublic = process.env.NEXT_PUBLIC_API_URL || API_URL;
const PUBLIC_API_URL = _rawPublic.startsWith('/')
  ? '' // relative — image becomes same-origin path (served via /uploads/ Next.js rewrite)
  : _rawPublic.replace(/\/api\/v1\/?$/, '').replace('http://api:3001', 'http://localhost:3001');

function toPublicImageUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${PUBLIC_API_URL}${raw}`;
  return null;
}

const CATEGORY_IMAGES: Record<string, string[]> = {
  Smartphones: [
    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&q=80',
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80',
    'https://images.unsplash.com/photo-1534307671554-9a6d81f4d629?w=600&q=80',
    'https://images.unsplash.com/photo-1545093149-618ce3bcf49d?w=600&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80',
    'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=600&q=80',
    'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&q=80',
  ],
  Laptops: [
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&q=80',
    'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80',
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&q=80',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&q=80',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&q=80',
    'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=600&q=80',
    'https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?w=600&q=80',
  ],
  Headphones: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80',
    'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=600&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&q=80',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80',
    'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600&q=80',
    'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80',
    'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=600&q=80',
  ],
  'Smart Watches': [
    'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=600&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
    'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=600&q=80',
    'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&q=80',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80',
    'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=600&q=80',
    'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&q=80',
    'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=600&q=80',
    'https://images.unsplash.com/photo-1510017803350-df700f89b8f1?w=600&q=80',
    'https://images.unsplash.com/photo-1558126319-c9feecbf57ee?w=600&q=80',
  ],
  Tablets: [
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
    'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600&q=80',
    'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&q=80',
    'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&q=80',
    'https://images.unsplash.com/photo-1632882765546-1ee75f53becb?w=600&q=80',
    'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=600&q=80',
    'https://images.unsplash.com/photo-1623126908029-58cb08a2b272?w=600&q=80',
    'https://images.unsplash.com/photo-1587033411391-5d9e51cce126?w=600&q=80',
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
    'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600&q=80',
  ],
  Cameras: [
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80',
    'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=600&q=80',
    'https://images.unsplash.com/photo-1495745966610-2a67f2297e5e?w=600&q=80',
    'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=600&q=80',
    'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=600&q=80',
    'https://images.unsplash.com/photo-1581591524425-c7e0978865fc?w=600&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80',
  ],
  'Air Purifiers': [
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
  ],
  Refrigerators: [
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80',
  ],
  Staples: [
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
    'https://images.unsplash.com/photo-1584473457406-6240486418e9?w=600&q=80',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80',
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
    'https://images.unsplash.com/photo-1584473457406-6240486418e9?w=600&q=80',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80',
  ],
  'Packaged Foods': [
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
    'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80',
    'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=600&q=80',
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
    'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80',
    'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=600&q=80',
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
  ],
  'Personal Care': [
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80',
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80',
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&q=80',
  ],
  "Men's Clothing": [
    'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=80',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80',
    'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=80',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80',
    'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=80',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80',
  ],
  "Women's Clothing": [
    'https://images.unsplash.com/photo-1434389677669-e08b4cda3a20?w=600&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80',
    'https://images.unsplash.com/photo-1558171813-01eda332a7a6?w=600&q=80',
    'https://images.unsplash.com/photo-1434389677669-e08b4cda3a20?w=600&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80',
    'https://images.unsplash.com/photo-1558171813-01eda332a7a6?w=600&q=80',
    'https://images.unsplash.com/photo-1434389677669-e08b4cda3a20?w=600&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
  ],
  Footwear: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600&q=80',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600&q=80',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80',
  ],
  Cookware: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&q=80',
    'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c0?w=600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&q=80',
    'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c0?w=600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&q=80',
    'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c0?w=600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
  ],
  Appliances: [
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&q=80',
  ],
  Furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
  ],
  Cricket: [
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
    'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&q=80',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&q=80',
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
    'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&q=80',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&q=80',
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
    'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&q=80',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&q=80',
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
  ],
  Fitness: [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=600&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=600&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=600&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
  ],
  'Self Help & Business': [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=80',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=80',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=80',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
  ],
  'Academic & Competitive': [
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80',
    'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80',
    'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80',
    'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80',
  ],
};

function getProductImage(subCat: string, pairIdx: number): string {
  const images = CATEGORY_IMAGES[subCat];
  if (images) return images[pairIdx % images.length];
  return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80';
}

function getMultipleImages(subCat: string, pairIdx: number): string[] {
  if (CATEGORY_IMAGES[subCat]) {
    const base = CATEGORY_IMAGES[subCat];
    const imgs: string[] = [];
    for (let i = 0; i < 4; i++) {
      imgs.push(base[(pairIdx + i) % base.length]);
    }
    return imgs;
  }
  const fallback = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80';
  return [fallback, fallback, fallback, fallback];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const strictProd = request.nextUrl.searchParams.get('strictProd') === 'true';

  // Try the NestJS backend first (handles numeric IDs reliably)
  try {
    const response = await fetch(`${API_URL}/products/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.id) {
        const dbImage = toPublicImageUrl(data.image) || toPublicImageUrl(data.imageUrl);
        if (dbImage) {
          data.image = dbImage;
          if (!Array.isArray(data.images) || data.images.length === 0) {
            data.images = [dbImage];
          }
        }

        // Last-resort fill only when DB has no image at all.
        if (!data.image) {
          const numId =
            typeof data.id === 'number'
              ? data.id
              : parseInt(String(data.id).replace(/\D/g, '') || '0', 10);
          const pairIdx = numId % 10;
          const subCat = String(data.subCategory || data.category || '');
          data.image = getProductImage(subCat, pairIdx);
          data.images = getMultipleImages(subCat, pairIdx);
        }
        return NextResponse.json(
          { ...data, dataSource: 'database' },
          { headers: { 'Cache-Control': 'public, max-age=60' } }
        );
      }
    }
  } catch {
    /* backend not available, fall through */
  }

  // For non-numeric (name-based) IDs, try a direct PostgreSQL name lookup.
  // This handles products linked by name from Smart Delegate catalog fallback.
  const isNumericId = /^\d+$/.test(id);
  if (!isNumericId) {
    try {
      const { query: dbQuery } = await import('@/lib/db');
      const searchName = decodeURIComponent(id).toLowerCase().trim();
      // Try exact name match first, then partial match
      const rows = (await dbQuery(
        `SELECT id, name, price, category, description, "imageUrl", "genericName",
                "categoryId", "subCategoryId",
                "eligibleForReplacement", "eligibleForReturn", "eligibleForVirtualTryOn",
                "createdAt"
         FROM "Product"
         WHERE LOWER(name) = $1
            OR LOWER(COALESCE("genericName",'')) = $1
         LIMIT 1`,
        [searchName]
      )) as any[];

      if (!rows || rows.length === 0) {
        // Fuzzy: any word in the search name matches product name
        const tokens = searchName.split(/\s+/).filter((t: string) => t.length >= 3);
        if (tokens.length > 0) {
          const likeClauses = tokens
            .map((_: string, i: number) => `LOWER(name) LIKE $${i + 1}`)
            .join(' OR ');
          const likeArgs = tokens.map((t: string) => `%${t}%`);
          const fuzzyRows = (await dbQuery(
            `SELECT id, name, price, category, description, "imageUrl", "genericName",
                    "categoryId", "subCategoryId",
                    "eligibleForReplacement", "eligibleForReturn", "eligibleForVirtualTryOn",
                    "createdAt"
             FROM "Product"
             WHERE ${likeClauses}
             ORDER BY name ASC
             LIMIT 1`,
            likeArgs
          )) as any[];
          if (fuzzyRows && fuzzyRows.length > 0) rows.push(...fuzzyRows);
        }
      }

      if (rows && rows.length > 0) {
        const p = rows[0];
        const numId = p.id;
        const subCat = p.category || '';
        const pairIdx = numId % 10;
        const image = toPublicImageUrl(p.imageUrl) || getProductImage(subCat, pairIdx);
        const images = getMultipleImages(subCat, pairIdx);
        return NextResponse.json(
          {
            id: numId,
            name: p.name,
            genericName: p.genericName || null,
            price: p.price,
            category: p.category,
            categoryId: p.categoryId || null,
            subCategoryId: p.subCategoryId || null,
            description: p.description || `${p.name} — ${p.category} product.`,
            image,
            images,
            imageUrl: image,
            dataSource: 'database',
            eligibleForReplacement: p.eligibleForReplacement ?? true,
            eligibleForReturn: p.eligibleForReturn ?? true,
            eligibleForVirtualTryOn: p.eligibleForVirtualTryOn ?? false,
            rating: 4.2,
            reviewCount: 120 + (numId % 500),
            stock: 50 + (numId % 200),
            brand: p.name.split(' ')[0] || 'Unknown',
          },
          { headers: { 'Cache-Control': 'public, max-age=60' } }
        );
      }
    } catch (dbErr) {
      console.error('[products/[id]] DB name lookup failed:', dbErr);
    }

    // Not found in DB — return a "catalog preview" response so the UI can show a graceful page
    if (!strictProd) {
      return NextResponse.json(
        {
          id: null,
          name: decodeURIComponent(id),
          price: null,
          category: null,
          description:
            'This product was shown as a demo recommendation. It is not currently in our live catalog.',
          image: null,
          images: [],
          dataSource: 'catalog-preview',
          isCatalogPreview: true,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  // Product not found in database
  return NextResponse.json({ error: 'Product not found', dataSource: 'database' }, { status: 404 });
}
