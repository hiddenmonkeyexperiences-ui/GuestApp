# Hidden Monkey Guest App - PRD

## Original Problem Statement
User deployed GuestApp on Railway at https://app.hiddenmonkeyhostels.com/ but "Things to Do", "Food to Eat" sections were not visible.

## Architecture
- **Frontend**: React SPA at https://app.hiddenmonkeyhostels.com
- **Backend**: FastAPI at https://api.hiddenmonkeyhostels.com  
- **Database**: MongoDB
- **Deployment**: Railway (separate services)

## Root Cause Analysis (Jan 2026)
The `things_to_do` and `food_to_try` arrays in the property-info collection were empty. The seed function doesn't auto-populate this data - it needs to be manually added via admin panel or API.

## Fix Applied (Jan 2026)
Added 5 "Things to Do" items and 5 "Food to Try" items to the Varanasi property via the `/api/property-info` POST endpoint.

## What's Been Implemented
- Full guest portal with experiences, food menu, requests
- Admin dashboard for property management  
- Staff management system
- WhatsApp notifications via Twilio
- Razorpay payment integration
- Property info with things_to_do and food_to_try sections

## Verified Working
- ✅ Things to Do section now displays 5 activities
- ✅ Where to Eat & What to Try section now displays 5 food recommendations
- ✅ All flip cards working with images and descriptions

## Backlog
- P1: Add similar data for Darjeeling properties
- P2: Allow admin to edit things_to_do/food_to_try from dashboard
- P2: Add more seasonal recommendations
