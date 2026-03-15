# Hidden Monkey Guest App - PRD

## Original Problem Statement
User deployed GuestApp on Railway at https://app.hiddenmonkeyhostels.com/ but "Things to Do", "Food to Eat" sections are not visible.

## Architecture
- **Frontend**: React SPA served via `npx serve`
- **Backend**: FastAPI Python server
- **Database**: MongoDB
- **Deployment**: Railway (separate services)

## Root Cause Analysis (Jan 2026)
The frontend and backend are deployed as separate Railway services. The frontend's `REACT_APP_BACKEND_URL` environment variable is not correctly configured to point to the backend service URL, causing all API calls to fail and return HTML.

## What's Been Implemented
- Full guest portal with experiences, food menu, requests
- Admin dashboard for property management
- Staff management system
- WhatsApp notifications via Twilio
- Razorpay payment integration

## Current Issue
- API routes (`/api/*`) returning HTML instead of JSON
- `things_to_do` and `food_to_try` arrays are empty because property-info API fails

## Fix Required
1. Set `REACT_APP_BACKEND_URL` in Railway frontend service to backend URL
2. Redeploy frontend

## Backlog
- P0: Fix Railway environment configuration
- P1: Verify API endpoints after deployment fix
- P2: Add health check monitoring
