/\*\*

- Wallet System - Integration Guide
-
- This file shows how to integrate the Wallet System into your NestJS application
- Copy this configuration into your app.module.ts
  \*/

// Add to app.module.ts imports:
// import { WalletModule } from './modules/wallet/wallet.module';

/\*\*

- In the AppModule @Module decorator, add WalletModule to imports:
  \*/
  export const WalletModuleExample = {
  comment: 'Add to AppModule imports array',
  addition: `     @Module({
      imports: [
        // ... existing modules
        WalletModule,
      ],
    })
    export class AppModule {}
  `,
  };

/\*\*

- API Endpoints Overview
- All endpoints require JWT authentication via Bearer token
  \*/
  export const APIEndpoints = {
  BASE: '/wallet',
  GET_WALLET: 'GET /wallet',
  ADD_MONEY: 'POST /wallet/add',
  SET_LIMITS: 'PUT /wallet/limits',
  AUTHORIZE_AI: 'POST /wallet/authorize-ai',
  CREATE_AUTHORIZATION: 'POST /wallet/authorize',
  DEBIT_WALLET: 'POST /wallet/debit',
  GET_TRANSACTIONS: 'GET /wallet/transactions',
  };

/\*\*

- Example Usage
  \*/
  export const UsageExamples = {
  addMoney: {
  endpoint: '/wallet/add',
  method: 'POST',
  headers: {
  Authorization: 'Bearer <jwt_token>',
  'Content-Type': 'application/json',
  },
  body: {
  amount: 50000, // Amount in cents (₹500.00)
  paymentMethodId: 'credit_card_4242',
  referenceId: 'unique-txn-id-12345',
  description: 'Top up wallet balance',
  },
  },

setLimits: {
endpoint: '/wallet/limits',
method: 'PUT',
headers: {
Authorization: 'Bearer <jwt_token>',
'Content-Type': 'application/json',
},
body: {
maxPerOrder: 100000, // Max ₹1000 per transaction
dailyLimit: 500000, // Max ₹5000 per day
aiSpendingLimit: 50000, // Max ₹500 for AI per transaction
reason: 'Security policy',
},
},

authorizeAI: {
endpoint: '/wallet/authorize-ai',
method: 'POST',
headers: {
Authorization: 'Bearer <jwt_token>',
'Content-Type': 'application/json',
},
body: {
authorized: true,
spendingLimit: 50000, // ₹500 max per AI transaction
reason: 'Enable AI shopping assistant',
},
},

authorizeSpending: {
endpoint: '/wallet/authorize',
method: 'POST',
headers: {
Authorization: 'Bearer <jwt_token>',
'Content-Type': 'application/json',
},
body: {
amount: 75000, // Request ₹750
purpose: 'product_purchase',
proposedProducts: [
{
id: 1,
name: 'Laptop',
price: 75000,
quantity: 1,
},
],
expiresIn: 3600, // Valid for 1 hour
aiRequestId: 'ai-req-12345',
},
},

debitWallet: {
endpoint: '/wallet/debit',
method: 'POST',
headers: {
Authorization: 'Bearer <jwt_token>',
'Content-Type': 'application/json',
},
body: {
amount: 75000, // Debit ₹750
type: 'purchase',
orderId: 123,
reason: 'Purchase order #123',
isAiAuthorized: true,
aiRequestId: 'ai-req-12345',
metadata: {
productIds: [1],
source: 'ai_shopping_assistant',
},
},
},

getWallet: {
endpoint: '/wallet',
method: 'GET',
headers: {
Authorization: 'Bearer <jwt_token>',
},
},

getTransactions: {
endpoint: '/wallet/transactions?limit=50&offset=0',
method: 'GET',
headers: {
Authorization: 'Bearer <jwt_token>',
},
},
};

/\*\*

- Security Features Implemented
  \*/
  export const SecurityFeatures = [
  '✅ JWT authentication required for all endpoints',
  '✅ Max per order limit enforcement',
  '✅ Daily spending limit with automatic reset',
  '✅ Separate AI authorization with per-transaction limits',
  '✅ Wallet locking for suspicious activity',
  '✅ Complete audit trail of all transactions',
  '✅ IP address logging for all activities',
  '✅ Authorization tokens with expiry times',
  '✅ Balance verification before debit',
  '✅ Idempotency support via referenceId',
  ];

/\*\*

- Audit Trail Features
  \*/
  export const AuditFeatures = [
  'All transactions stored with before/after balance snapshots',
  'WalletAuditLog tracks all balance changes with performer info',
  'WalletAuthorization tracking for AI approvals',
  'WalletTransaction complete transaction history',
  'IP address and User Agent logging',
  'Reason/purpose tracking for all actions',
  'Kafka events for real-time analytics',
  ];

/\*\*

- Database Models
  \*/
  export const DatabaseModels = {
  Wallet: 'Main wallet instance per user',
  WalletTransaction: 'Transaction history (topup, purchase, refund)',
  WalletAuthorization: 'AI spending authorizations',
  WalletSpendingLimit: 'User-defined spending limit rules',
  WalletAuditLog: 'Complete audit trail',
  };
