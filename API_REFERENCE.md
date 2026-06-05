# Smart Buy Request - API Reference

## Base URL

```
Development: http://localhost:3001/api
Production: https://api.delegatecart.com/api
```

## Authentication

All requests require `userId` header:

```
Headers: {
  "userId": "1",
  "Content-Type": "application/json"
}
```

---

## Endpoints

### 1. POST /buy-request

Create a new buy request.

**Request:**

```http
POST /buy-request HTTP/1.1
Host: localhost:3001
Content-Type: application/json
userId: 1

{
  "productName": "Wireless Headphones",
  "description": "Premium over-ear headphones with noise cancelling",
  "budgetMin": 100,
  "budgetMax": 500,
  "qualityScore": 8,
  "preferredBrands": ["Sony", "Bose", "Apple"],
  "deliveryDate": "2026-04-15",
  "autoExecute": true,
  "notifyChannels": ["email", "whatsapp"]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium over-ear headphones with noise cancelling",
    "budgetMin": 100,
    "budgetMax": 500,
    "qualityScore": 8,
    "preferredBrands": ["Sony", "Bose", "Apple"],
    "deliveryDate": "2026-04-15T00:00:00.000Z",
    "autoExecute": true,
    "notifyChannels": ["email", "whatsapp"],
    "status": "pending",
    "matchedProducts": null,
    "createdAt": "2026-03-22T10:30:00.000Z",
    "updatedAt": "2026-03-22T10:30:00.000Z"
  },
  "message": "Buy request created successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Validation failed: budgetMin must not be greater than budgetMax"
}
```

**Error (400 Bad Request - Execution Settings):**

```json
{
  "success": false,
  "error": "Either autoExecute must be true or notifyChannels must contain at least one channel"
}
```

**Validation Rules:**

- `productName`: Required, 3-200 characters
- `budgetMin`: Required, >= 0
- `budgetMax`: Required, >= budgetMin
- `qualityScore`: Required, 1-10
- `deliveryDate`: Required, ISO 8601 format (YYYY-MM-DD or ISO string)
- `autoExecute`: Optional boolean
- `notifyChannels`: Optional array of ["email", "whatsapp", "sms", "push"]
- **Constraint**: Either `autoExecute=true` OR `notifyChannels` has ≥1 item
- `preferredBrands`: Optional array, max 10 brands

---

### 2. GET /buy-request/:id

Fetch a single buy request by ID.

**Request:**

```http
GET /buy-request/42 HTTP/1.1
Host: localhost:3001
userId: 1
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium over-ear headphones with noise cancelling",
    "budgetMin": 100,
    "budgetMax": 500,
    "qualityScore": 8,
    "preferredBrands": ["Sony", "Bose", "Apple"],
    "deliveryDate": "2026-04-15T00:00:00.000Z",
    "autoExecute": true,
    "notifyChannels": ["email", "whatsapp"],
    "status": "pending",
    "matchedProducts": null,
    "createdAt": "2026-03-22T10:30:00.000Z",
    "updatedAt": "2026-03-22T10:30:00.000Z"
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Buy request with id 99 not found"
}
```

**Error (403 Forbidden):**

```json
{
  "success": false,
  "error": "Unauthorized access to this buy request"
}
```

---

### 3. GET /buy-request

List all buy requests for the authenticated user (with optional filtering).

**Request:**

```http
GET /buy-request?status=pending&skip=0&take=10 HTTP/1.1
Host: localhost:3001
userId: 1
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | (all) | Filter: pending, matched, purchased, cancelled |
| `skip` | number | No | 0 | Pagination offset |
| `take` | number | No | 10 | Items per page (max: 100) |

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "userId": 1,
      "productName": "Wireless Headphones",
      "description": "Premium over-ear headphones with noise cancelling",
      "budgetMin": 100,
      "budgetMax": 500,
      "qualityScore": 8,
      "preferredBrands": ["Sony", "Bose", "Apple"],
      "deliveryDate": "2026-04-15T00:00:00.000Z",
      "autoExecute": true,
      "notifyChannels": ["email", "whatsapp"],
      "status": "pending",
      "matchedProducts": null,
      "createdAt": "2026-03-22T10:30:00.000Z",
      "updatedAt": "2026-03-22T10:30:00.000Z"
    },
    {
      "id": 41,
      "userId": 1,
      "productName": "Laptop Stand",
      "description": null,
      "budgetMin": 20,
      "budgetMax": 100,
      "qualityScore": 6,
      "preferredBrands": null,
      "deliveryDate": "2026-03-25T00:00:00.000Z",
      "autoExecute": false,
      "notifyChannels": ["email"],
      "status": "matched",
      "matchedProducts": [
        {
          "id": 1,
          "name": "Adjustable Laptop Stand",
          "price": 45,
          "quality": 7
        }
      ],
      "createdAt": "2026-03-20T14:20:00.000Z",
      "updatedAt": "2026-03-21T09:15:00.000Z"
    }
  ],
  "count": 2
}
```

**Response (Empty List):**

```json
{
  "success": true,
  "data": [],
  "count": 0
}
```

---

### 4. PATCH /buy-request/:id

Update a buy request (partial update).

**Request:**

```http
PATCH /buy-request/42 HTTP/1.1
Host: localhost:3001
Content-Type: application/json
userId: 1

{
  "budgetMax": 600,
  "qualityScore": 7,
  "notifyChannels": ["email", "sms"]
}
```

**Fields That Can Be Updated:**

- `productName`
- `description`
- `budgetMin`
- `budgetMax`
- `qualityScore`
- `preferredBrands`
- `deliveryDate`
- `autoExecute`
- `notifyChannels`
- `status` (usually done by system)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium over-ear headphones with noise cancelling",
    "budgetMin": 100,
    "budgetMax": 600,
    "qualityScore": 7,
    "preferredBrands": ["Sony", "Bose", "Apple"],
    "deliveryDate": "2026-04-15T00:00:00.000Z",
    "autoExecute": false,
    "notifyChannels": ["email", "sms"],
    "status": "pending",
    "matchedProducts": null,
    "createdAt": "2026-03-22T10:30:00.000Z",
    "updatedAt": "2026-03-22T11:45:00.000Z"
  },
  "message": "Buy request updated successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Validation failed: budgetMin must not be greater than budgetMax"
}
```

---

### 5. DELETE /buy-request/:id

Cancel a buy request (soft delete - sets status to "cancelled").

**Request:**

```http
DELETE /buy-request/42 HTTP/1.1
Host: localhost:3001
userId: 1
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium over-ear headphones with noise cancelling",
    "budgetMin": 100,
    "budgetMax": 600,
    "qualityScore": 7,
    "preferredBrands": ["Sony", "Bose", "Apple"],
    "deliveryDate": "2026-04-15T00:00:00.000Z",
    "autoExecute": true,
    "notifyChannels": ["email", "whatsapp"],
    "status": "cancelled",
    "matchedProducts": null,
    "createdAt": "2026-03-22T10:30:00.000Z",
    "updatedAt": "2026-03-22T11:50:00.000Z"
  },
  "message": "Buy request cancelled successfully"
}
```

---

## Status Codes Reference

| Code | Meaning      | Common Causes                    |
| ---- | ------------ | -------------------------------- |
| 200  | OK           | Successful GET, PATCH, or DELETE |
| 201  | Created      | Successful POST                  |
| 400  | Bad Request  | Invalid input, validation failed |
| 403  | Forbidden    | User doesn't own the resource    |
| 404  | Not Found    | Resource doesn't exist           |
| 500  | Server Error | Unexpected server error          |

---

## Data Types

### BuyRequest Object

```typescript
{
  id: number;                    // Auto-incremented ID
  userId: number;                // Owner's user ID
  productName: string;           // 3-200 chars
  description: string | null;    // Optional, max 1000 chars
  budgetMin: number;             // >= 0
  budgetMax: number;             // >= budgetMin
  qualityScore: number;          // 1-10
  preferredBrands: string[] | null;  // Array or null
  deliveryDate: string;          // ISO 8601 datetime
  autoExecute: boolean;          // True for auto-buy
  notifyChannels: string[] | null;   // ["email", "whatsapp", "sms", "push"]
  status: "pending" | "matched" | "purchased" | "cancelled";
  matchedProducts: object[] | null;  // Array of matched items
  createdAt: string;             // ISO 8601 datetime
  updatedAt: string;             // ISO 8601 datetime
}
```

---

## Common Use Cases

### 1. Create a Buy Request (Auto-Execute)

```bash
curl -X POST http://localhost:3001/api/buy-request \
  -H "userId: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Gaming Mouse",
    "budgetMin": 30,
    "budgetMax": 150,
    "qualityScore": 8,
    "preferredBrands": ["Logitech", "Razer"],
    "deliveryDate": "2026-04-01",
    "autoExecute": true
  }'
```

### 2. Create a Buy Request (Notify)

```bash
curl -X POST http://localhost:3001/api/buy-request \
  -H "userId: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Mechanical Keyboard",
    "budgetMin": 75,
    "budgetMax": 200,
    "qualityScore": 7,
    "deliveryDate": "2026-03-30",
    "notifyChannels": ["email", "whatsapp"]
  }'
```

### 3. List All Pending Requests

```bash
curl -X GET "http://localhost:3001/api/buy-request?status=pending&take=20" \
  -H "userId: 1"
```

### 4. Update Budget

```bash
curl -X PATCH http://localhost:3001/api/buy-request/42 \
  -H "userId: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "budgetMax": 180
  }'
```

### 5. Get Request Details

```bash
curl -X GET http://localhost:3001/api/buy-request/42 \
  -H "userId: 1"
```

### 6. Cancel Request

```bash
curl -X DELETE http://localhost:3001/api/buy-request/42 \
  -H "userId: 1"
```

---

## Pagination Examples

### Get first 10 pending requests

```
GET /buy-request?status=pending&skip=0&take=10
```

### Get next 10 pending requests

```
GET /buy-request?status=pending&skip=10&take=10
```

### Get all requests (up to 100 per page)

```
GET /buy-request?skip=0&take=100
```

---

## Error Handling Examples

### Validation Error

```json
{
  "success": false,
  "error": "Product name must be at least 3 characters long"
}
```

### Authorization Error

```json
{
  "success": false,
  "error": "Unauthorized access to this buy request"
}
```

### Not Found Error

```json
{
  "success": false,
  "error": "Buy request with id 999 not found"
}
```

### Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Request/Response Examples

### JavaScript/Fetch

```javascript
// Create
const response = await fetch('/api/buy-request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    userId: '1',
  },
  body: JSON.stringify({
    productName: 'Monitor',
    budgetMin: 200,
    budgetMax: 500,
    qualityScore: 8,
    deliveryDate: '2026-04-01',
    autoExecute: true,
  }),
});

const data = await response.json();
if (data.success) {
  console.log('Created:', data.data);
} else {
  console.error('Error:', data.error);
}
```

### Python/Requests

```python
import requests

# List
headers = {'userId': '1'}
response = requests.get(
    'http://localhost:3001/api/buy-request',
    params={'status': 'pending', 'take': 20},
    headers=headers
)
data = response.json()
print(f"Found {data['count']} pending requests")
```

### cURL

```bash
# Create
curl -X POST http://localhost:3001/api/buy-request \
  -H "Content-Type: application/json" \
  -H "userId: 1" \
  -d @- << EOF
{
  "productName": "External SSD",
  "budgetMin": 80,
  "budgetMax": 200,
  "qualityScore": 8,
  "deliveryDate": "2026-04-05",
  "autoExecute": true
}
EOF
```

---

## Rate Limiting

Currently no rate limiting. Plan to implement:

- 100 requests per minute per user
- 10 requests per second burst

---

## Versioning

Current API Version: **v1** (implicit in `/api/...` routes)

Future versions will be under `/api/v2/...`

---

## Support

For issues or questions:

1. Check this reference document
2. Review TESTING_GUIDE.md for examples
3. Check backend logs: `npm run start:dev`
4. Verify database: `npx prisma studio`

---

**Last Updated**: March 22, 2026  
**Status**: ✅ Production Ready
