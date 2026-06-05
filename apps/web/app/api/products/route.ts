import { NextRequest, NextResponse } from 'next/server';

// Server-side: prefer Docker-internal URL so web container can reach API container directly.
// API_INTERNAL_URL is set in docker-compose (http://api:3001).
// Fallback chain: API_INTERNAL_URL → NEXT_PUBLIC_API_URL → localhost:3001
const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// NestJS exposes products at /products (no /api/v1 prefix)
const API_URL = API_BASE.replace(/^\/api\/v1\/?$/, 'http://localhost:3001').replace(
  /\/api\/v1\/?$/,
  ''
);

// PUBLIC_API_URL is used to transform relative image paths returned by the API
const _rawPublic = process.env.NEXT_PUBLIC_API_URL || API_URL;
const PUBLIC_API_URL = _rawPublic.startsWith('/')
  ? ''
  : _rawPublic.replace(/\/api\/v1\/?$/, '').replace('http://api:3001', 'http://localhost:3001');

function toPublicImageUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${PUBLIC_API_URL}${raw}`;
  return null;
}

// Category images used as last-resort placeholder for real DB products missing imageUrl.
const CATEGORY_IMAGES: Record<string, string[]> = {
  Smartphones: [
    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&q=80',
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80',
    'https://images.unsplash.com/photo-1534307671554-9a6d81f4d629?w=400&q=80',
    'https://images.unsplash.com/photo-1545093149-618ce3bcf49d?w=400&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&q=80',
    'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=400&q=80',
    'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&q=80',
  ],
  Laptops: [
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&q=80',
    'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80',
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&q=80',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&q=80',
    'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=400&q=80',
    'https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?w=400&q=80',
  ],
  Headphones: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
    'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=400&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&q=80',
    'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=400&q=80',
    'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80',
    'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=400&q=80',
  ],
  Smartwatches: [
    'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
    'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=400&q=80',
    'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&q=80',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&q=80',
    'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=400&q=80',
    'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&q=80',
    'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=400&q=80',
    'https://images.unsplash.com/photo-1510017803350-df700f89b8f1?w=400&q=80',
    'https://images.unsplash.com/photo-1558126319-c9feecbf57ee?w=400&q=80',
  ],
  Tablets: [
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80',
    'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=400&q=80',
    'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400&q=80',
    'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=400&q=80',
    'https://images.unsplash.com/photo-1632882765546-1ee75f53becb?w=400&q=80',
    'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=400&q=80',
    'https://images.unsplash.com/photo-1623126908029-58cb08a2b272?w=400&q=80',
    'https://images.unsplash.com/photo-1587033411391-5d9e51cce126?w=400&q=80',
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80',
    'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=400&q=80',
  ],
  Cameras: [
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80',
    'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=400&q=80',
    'https://images.unsplash.com/photo-1495745966610-2a67f2297e5e?w=400&q=80',
    'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=400&q=80',
    'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=400&q=80',
    'https://images.unsplash.com/photo-1581591524425-c7e0978865fc?w=400&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80',
  ],
  Televisions: [
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400&q=80',
    'https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=400&q=80',
    'https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=400&q=80',
    'https://images.unsplash.com/photo-1615655406736-b37892a25083?w=400&q=80',
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400&q=80',
    'https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=400&q=80',
    'https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=400&q=80',
    'https://images.unsplash.com/photo-1615655406736-b37892a25083?w=400&q=80',
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400&q=80',
    'https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=400&q=80',
  ],
  Gaming: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
  ],
  'Home Appliances': [
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&q=80',
  ],
  'Kitchen Appliances': [
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=400&q=80',
    'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c0?w=400&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=400&q=80',
    'https://images.unsplash.com/photo-1584990347449-a2d4c2c044c0?w=400&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
  ],
  Furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=400&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=400&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80',
  ],
  'Computer Accessories': [
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80',
    'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=400&q=80',
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80',
    'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=400&q=80',
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80',
    'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=400&q=80',
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80',
  ],
  'Storage Devices': [
    'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=400&q=80',
    'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80',
    'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=400&q=80',
    'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80',
    'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=400&q=80',
    'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80',
    'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=400&q=80',
    'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80',
    'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=400&q=80',
    'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80',
  ],
  Networking: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
  ],
  Printers: [
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&q=80',
  ],
  'Personal Care': [
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80',
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80',
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80',
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400&q=80',
  ],
  'Fitness Equipment': [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=400&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=400&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=400&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
  ],
  'Office Supplies': [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
  ],
  Stationery: [
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
  ],
  Speakers: [
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80',
  ],
};

function getProductImage(subCat: string, pairIdx: number): string {
  const images = CATEGORY_IMAGES[subCat];
  if (images) return images[pairIdx % images.length];
  return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skipParam = searchParams.get('skip');
  const takeParam = searchParams.get('take');
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const take = Math.min(
    Math.max(1, parseInt(takeParam || searchParams.get('limit') || '20', 10) || 20),
    100
  );
  const skip =
    skipParam != null ? Math.max(0, parseInt(skipParam || '0', 10) || 0) : (pageParam - 1) * take;

  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search') || undefined;
  const minPrice = searchParams.get('minPrice') || undefined;
  const maxPrice = searchParams.get('maxPrice') || undefined;
  const minRating = searchParams.get('minRating') || undefined;
  const minDiscount = searchParams.get('minDiscount') || undefined;
  const freeDelivery = searchParams.get('freeDelivery') || undefined;
  const expressDelivery = searchParams.get('expressDelivery') || undefined;
  const codAvailable = searchParams.get('codAvailable') || undefined;
  const sortBy = searchParams.get('sortBy') || undefined;

  try {
    const queryParams = new URLSearchParams({ skip: String(skip), take: String(take) });
    if (category) queryParams.set('category', category);
    if (search) queryParams.set('search', search);
    if (minPrice) queryParams.set('minPrice', minPrice);
    if (maxPrice) queryParams.set('maxPrice', maxPrice);
    if (minRating) queryParams.set('minRating', minRating);
    if (minDiscount) queryParams.set('minDiscount', minDiscount);
    if (freeDelivery) queryParams.set('freeDelivery', freeDelivery);
    if (expressDelivery) queryParams.set('expressDelivery', expressDelivery);
    if (codAvailable) queryParams.set('codAvailable', codAvailable);
    if (sortBy) queryParams.set('sortBy', sortBy);

    const response = await fetch(`${API_URL}/products?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Backend returned error');

    if (data && (Array.isArray(data.products) || Array.isArray(data.data))) {
      const rawList: any[] = data.products ?? data.data ?? [];
      const withImages = rawList.map((p: any, idx: number) => {
        const directImage = toPublicImageUrl(p.image) || toPublicImageUrl(p.imageUrl);
        if (directImage) return { ...p, image: directImage };

        const numId =
          typeof p.id === 'number'
            ? p.id
            : parseInt(String(p.id).replace(/\D/g, '') || String(idx), 10);
        const pairIdx = numId % 10;
        const subCat = String(p.subCategory || p.category || '');
        return { ...p, image: getProductImage(subCat, pairIdx) };
      });
      const enriched = { ...data, products: withImages, data: withImages };
      return NextResponse.json(enriched, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
      });
    }

    throw new Error('Empty response from backend');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Product service unavailable';
    return NextResponse.json(
      {
        products: [],
        data: [],
        total: 0,
        skip,
        take,
        totalPages: 0,
        error: errorMessage,
        dataSource: 'database',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}