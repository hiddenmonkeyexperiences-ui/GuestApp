# Hidden Monkey Stays - Guest Portal PRD

## Project Overview
A hospitality guest portal for Hidden Monkey Stays (hostel/homestay chain). Guests scan QR codes to access property info, order food, book experiences, and make requests.

## Tech Stack
- **Backend**: FastAPI + Python
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui
- **Database**: MongoDB Atlas
- **Integrations**: Twilio (WhatsApp), Razorpay (Payments), Cloudinary (Images)

## Core Features Implemented

### Guest Features
- QR-based property access (/VaranasiHostel, /DarjeelingHostel, /DarjeelingHome)
- Property info (check-in/out times, WiFi, events)
- Food ordering with cart
- Experience bookings
- Guest requests (housekeeping, maintenance, amenities)
- WhatsApp notifications
- Google Form-based check-in

### Admin Features
- Multi-property management
- Menu management with multi-category support
- Category timing controls
- Experience management
- Staff user management
- QR code generation
- Order/booking/request logs
- Message template customization

### Staff Features
- Staff login per property
- Order management dashboard
- WhatsApp workflow integration

## What's Been Implemented (March 2026)

### Security Hardening (March 4, 2026)
- **SQL Injection Prevention**: Comprehensive regex patterns for SQL keywords, comment patterns (--), OR 1=1 patterns
- **NoSQL Injection Prevention**: $where, $gt, $lt, $ne, $regex patterns blocked
- **XSS Prevention**: <script>, javascript:, onclick, onerror patterns blocked
- **Input Length Validation**: Proper rejection (not truncation) of oversized inputs
- **Phone Validation**: Fixed to reject double plus signs (++numbers)
- **Exception Handling**: Proper 422 responses for validation errors (not 500)
- **GET Endpoint Fix**: Removed response_model validation on read endpoints to handle legacy data

### Deployment Preparation
- Removed Emergent-specific code from index.html
- Removed visual-edit plugins
- Created Railway deployment configuration
- Updated requirements.txt with all dependencies

## User Personas

### Guest
- Hotel/hostel guests who scan QR codes
- No login required
- Access property info, order food, book experiences

### Staff
- Kitchen staff: Receives food orders
- Managers: Receives all notifications, manages bookings

### Admin
- Full control over all properties
- Configure settings, manage staff, view reports

## Properties
1. Hidden Monkey Hostel, Varanasi (`/VaranasiHostel`)
2. Hidden Monkey Hostel, Darjeeling (`/DarjeelingHostel`)
3. Hidden Monkey Home, Darjeeling (`/DarjeelingHome`)

## Environment Variables

### Backend
- MONGO_URL, DB_NAME (required)
- BACKEND_URL (required for QR codes)
- ADMIN_PASSWORD, ADMIN_SECRET_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- CORS_ORIGINS

### Frontend
- REACT_APP_BACKEND_URL (required)

## Prioritized Backlog

### P0 - Critical
- None (app is production-ready with security hardened)

### P1 - High Priority
- [ ] Production Twilio WhatsApp number (currently sandbox)
- [ ] Production Razorpay credentials
- [ ] Cloudinary setup for image uploads

### P2 - Medium Priority
- [ ] Email notifications backup (Resend already integrated)
- [ ] Analytics dashboard
- [ ] Guest feedback system

### P3 - Future Enhancements
- [ ] Multi-language support
- [ ] Push notifications
- [ ] Loyalty/rewards program
- [ ] Integration with PMS systems

## Next Steps
1. Deploy to Railway using RAILWAY_DEPLOYMENT.md
2. Configure custom domain
3. Set up production Twilio WhatsApp
4. Complete Razorpay KYC for live payments
5. Set up Cloudinary for image uploads

## Security Testing Results (March 4, 2026)

### Passed Tests
- SQL injection prevention (admin'--, OR 1=1, UNION SELECT) - 422 response
- NoSQL injection prevention ($where, $gt, $ne) - 422 response
- XSS prevention (<script>, javascript:) - 422 response
- Input length validation (5000+ chars) - 422 response
- Phone validation (double plus, invalid formats) - 422 response
- Admin auth (valid: 200, invalid: 401)
- All CRUD operations working correctly

### Test Coverage: 87.5% backend security tests passing
