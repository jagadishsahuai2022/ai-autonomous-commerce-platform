# API Keys & External Services Configuration

This document lists all API keys and external service integrations required to make DelegateCart MVP-ready.

---

## Required API Keys

### 1. Payment Gateway — Razorpay

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Key ID | `RAZORPAY_KEY_ID` | Public key for client-side checkout |
| Key Secret | `RAZORPAY_KEY_SECRET` | Server-side order verification |
| Webhook Secret | `RAZORPAY_WEBHOOK_SECRET` | Verify webhook signatures |

**Get keys at:** https://dashboard.razorpay.com/app/keys  
**Test mode prefix:** `rzp_test_*`  
**Live mode prefix:** `rzp_live_*`

```env
RAZORPAY_KEY_ID=rzp_test_SZMvk0O3vCYwWM
RAZORPAY_KEY_SECRET=BMlybh5tfzR0bpGTz2n4qiU6
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_SZMvk0O3vCYwWM
```

---

### 2. AI / LLM — Anthropic Claude

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| API Key | `ANTHROPIC_API_KEY` | Claude API access |
| Model | `ANTHROPIC_MODEL` | Model version (claude-3-opus-20240229) |

**Get keys at:** https://console.anthropic.com/settings/keys  

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_MODEL=claude-3-opus-20240229
```

---

### 3. WhatsApp Business API — Meta Cloud API

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Access Token | `WHATSAPP_ACCESS_TOKEN` | Send/receive WhatsApp messages |
| Phone Number ID | `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp business number |
| Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta Business account |
| Webhook Verify Token | `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification |

**Get keys at:** https://developers.facebook.com/apps → WhatsApp → API Setup  
**Test mode:** Use test phone number provided by Meta

```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210
WHATSAPP_WEBHOOK_VERIFY_TOKEN=delegatecart-verify-token
```

---

### 4. SMS — Twilio

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Account SID | `TWILIO_ACCOUNT_SID` | Account identifier |
| Auth Token | `TWILIO_AUTH_TOKEN` | API authentication |
| Phone Number | `TWILIO_PHONE_NUMBER` | Your Twilio phone number |

**Get keys at:** https://console.twilio.com  
**Test mode:** Use Twilio test credentials

```env
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

---

### 5. Email — SendGrid

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| API Key | `SENDGRID_API_KEY` | Send transactional emails |
| From Email | `SENDGRID_FROM_EMAIL` | Verified sender address |
| From Name | `SENDGRID_FROM_NAME` | Display name |

**Get keys at:** https://app.sendgrid.com/settings/api_keys  

```env
SENDGRID_API_KEY=SG.xxxxxx
SENDGRID_FROM_EMAIL=orders@delegatecart.com
SENDGRID_FROM_NAME=DelegateCart
```

---

### 6. Authentication — NextAuth.js

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Secret | `NEXTAUTH_SECRET` | JWT signing key (min 32 chars) |
| URL | `NEXTAUTH_URL` | Base URL of the app |

```env
NEXTAUTH_SECRET=delegatecart-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

---

### 7. Database — PostgreSQL

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Connection URL | `DATABASE_URL` | Full PostgreSQL connection string |

```env
DATABASE_URL=postgresql://admin:password@postgres:5432/delegatecart?schema=public
```

---

### 8. Redis (Caching & Queues)

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| URL | `REDIS_URL` | Redis connection string |

```env
REDIS_URL=redis://redis:6379
```

---

### 9. Kafka (Event Streaming)

| Key | Environment Variable | Description |
|-----|---------------------|-------------|
| Brokers | `KAFKA_BROKERS` | Comma-separated broker addresses |

```env
KAFKA_BROKERS=kafka:9092
```

---

## Optional / Future Integrations

| Service | Purpose | Environment Variable |
|---------|---------|---------------------|
| Google OAuth | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Sentry | Error tracking | `SENTRY_DSN` |
| AWS S3 | Image storage | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` |
| Elasticsearch | Product search | `ELASTICSEARCH_URL` |
| Firebase | Push notifications | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY` |

---

## Environment Setup

### Development (`.env.local`)
```bash
# Copy template
cp .env.example .env.local

# All test/sandbox keys are pre-configured in docker-compose.yml
# Just run:
docker compose up -d
```

### Production
```bash
# Generate strong NEXTAUTH_SECRET
openssl rand -base64 32

# Use live API keys for:
# - Razorpay (rzp_live_*)
# - SendGrid (verified domain)
# - Twilio (production number)
# - WhatsApp Business API (approved templates)
# - Anthropic (production API key)
```

---

## Security Notes

1. **Never commit API keys** to version control
2. Use `.env.local` for local development (git-ignored)
3. Use Docker secrets or environment injection for production
4. Rotate keys regularly (minimum every 90 days)
5. Use minimum-privilege API keys where possible
6. Enable IP allowlisting for production Razorpay keys
7. Set rate limits on all external API calls
