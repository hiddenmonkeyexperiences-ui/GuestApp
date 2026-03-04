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
- ✅ QR-based property access (/VaranasiHostel, /DarjeelingHostel, /DarjeelingHome)
- ✅ Property info (check-in/out times, WiFi, events)
- ✅ Food ordering with cart
- ✅ Experience bookings
- ✅ Guest requests (housekeeping, maintenance, amenities)
- ✅ WhatsApp notifications

### Admin Features
- ✅ Multi-property management
- ✅ Menu management with multi-category support
- ✅ Category timing controls
- ✅ Experience management
- ✅ Staff user management
- ✅ QR code generation
- ✅ Order/booking/request logs
- ✅ Message template customization

### Staff Features
- ✅ Staff login per property
- ✅ Order management dashboard
- ✅ WhatsApp workflow integration

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

## What's Been Implemented (March 2026)

### Backend
- All CRUD APIs for menu, experiences, orders, bookings, requests
- MongoDB Atlas integration with connection pooling
- Twilio WhatsApp integration
- Razorpay payment integration
- Cloudinary image upload
- Input validation and sanitization
- OTP-based password reset

### Frontend
- Complete guest portal UI
- Admin dashboard with all management pages
- Staff dashboard
- Responsive design
- Cart functionality

### Deployment Preparation
- Removed Emergent-specific code from index.html
- Removed visual-edit plugins
- Created Railway deployment configuration
- Updated requirements.txt with all dependencies

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
- None (app is production-ready)

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

## Files Structure
```
/app
├── backend/
│   ├── server.py        # All API endpoints (~2300 lines)
│   ├── requirements.txt # Python dependencies
│   ├── railway.toml     # Railway config
│   └── .env             # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js       # Routes
│   │   ├── pages/       # All pages
│   │   ├── components/  # UI components
│   │   └── lib/         # API client, store
│   ├── public/          # Static files
│   ├── railway.toml     # Railway config
│   └── package.json     # Node dependencies
├── RAILWAY_DEPLOYMENT.md # Deployment guide
└── memory/PRD.md        # This file
```
