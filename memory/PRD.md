# Hidden Monkey Stays - Guest Portal

## Project Overview
A hospitality guest portal for Hidden Monkey Stays properties (Varanasi, Darjeeling) with food ordering, experience booking, and guest request management.

## Tech Stack
- **Frontend**: React 18 + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python 3.11)
- **Database**: MongoDB Atlas (cloud)
- **Notifications**: Twilio WhatsApp (sandbox)
- **Payments**: Razorpay (test mode)

## What's Been Implemented

### March 2026 Session

#### 1. Reports Enhancement
- Unit-level item entries (2 pieces = 2 rows)
- Net sales summary card
- Top 3 best selling items with revenue
- Download options: Summary, Orders, Unit Sales, Top Items

#### 2. MongoDB Atlas Integration
- Switched from local MongoDB to Atlas
- Data persisted: 3 properties, 36 menu items, 18 experiences, users

#### 3. MongoDB Connection Pooling (Production-Ready)
- FastAPI lifespan context manager for startup/shutdown
- Connection pool: 10-50 connections
- Proper async Motor driver usage
- Health check endpoint: `/api/health`

#### 4. Network Hardening (Frontend)
- 8-second API request timeout
- Network error interceptor with "Poor Network Connection" toast
- Cart persists to localStorage (survives browser refresh/crash)
- Pending order recovery (savePendingOrder/getPendingOrder)
- Network error banners with retry buttons

#### 5. Webhook Security (Production-Ready)
- Razorpay: HMAC-SHA256 signature verification using `X-Razorpay-Signature` header
- Twilio: RequestValidator signature verification using `X-Twilio-Signature` header
- Unauthorized requests rejected with 401 status code
- Signatures verified before processing any webhook payload

#### 6. Input Validation & Sanitization
- Guest name: alphanumeric + basic punctuation, 2-100 chars
- Room number: alphanumeric, 1-20 chars
- Phone/WhatsApp: 7-15 digits with formatting
- Notes: XSS, SQL injection, NoSQL injection patterns blocked
- HTML escaped on all user inputs
- Pydantic validators on all guest-facing models

#### 7. React Error Boundary
- Global ErrorBoundary wrapping entire app
- Graceful fallback UI instead of white screen
- "Try Again", "Go Home", "Reload" options
- Error logging for debugging

#### 8. Experience Booking Workflow (NEW)
- Guest books → Staff2 (Manager) notified to approve/reject
- Guest receives "team will connect" message
- On approval → Guest receives Razorpay payment link
- On payment → Both Staff2 and Guest receive confirmation
- Staff2 can mark as scheduled after coordinating

#### 9. Service Request Workflow (NEW)
- Guest raises request → Staff2 notified, Guest gets acknowledgment
- Staff2 acknowledges → Guest notified
- Staff2 resolves → Guest notified of resolution

#### 10. Feature Toggles (NEW)
- Admin can enable/disable Experiences feature
- Admin can enable/disable Requests feature
- Hidden from guest UI when disabled

#### 11. Configurable Message Templates
- 12 message templates fully customizable per property
- Default templates populated automatically
- Admin UI at `/admin/message-templates`
- Variable placeholders: `{guest_name}`, `{order_id}`, `{property_name}`, etc.

## Core Requirements
- Guest portal for hostel/homestay properties
- QR code-based access
- Food ordering with WhatsApp notifications
- Experience booking
- Guest request management (housekeeping, maintenance)
- Staff dashboard with order management
- Admin panel for property configuration

## User Personas
1. **Guest**: Scans QR, orders food, books experiences, submits requests
2. **Staff**: Manages orders, responds via WhatsApp
3. **Admin**: Configures menu, experiences, properties, staff

## Prioritized Backlog

### P0 (Critical)
- [x] MongoDB Atlas connection
- [x] Connection pooling
- [x] Network error handling
- [x] Cart persistence

### P1 (Important)
- [ ] Twilio WhatsApp production setup (currently sandbox)
- [ ] Razorpay live mode activation
- [ ] Custom domain configuration

### P2 (Nice to Have)
- [ ] Date range filters for reports
- [ ] Push notifications
- [ ] Multi-language support
- [ ] Offline mode support

## Deployment

### Recommended: Railway ($5/month)
- No cold starts
- Native Python/FastAPI support
- Both services in one dashboard

### Environment Variables
See `DEPLOYMENT_GUIDE.md` for complete list

## Files Structure
```
/app/
├── backend/
│   ├── server.py      # FastAPI app with MongoDB pooling
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.js    # Axios with 8s timeout
│   │   │   └── store.js  # Cart persistence
│   │   └── pages/
│   └── .env
├── render.yaml        # One-click Render deploy
└── DEPLOYMENT_GUIDE.md
```

## Testing
- Backend: 100% passed
- Frontend: 90% passed (network hardening verified)
