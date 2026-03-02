# Hidden Monkey Stays - Railway Deployment Guide

## Overview
This is a full-stack hospitality guest portal for Hidden Monkey Stays. The app consists of:
- **Backend**: FastAPI (Python) 
- **Frontend**: React with Tailwind CSS
- **Database**: MongoDB Atlas (already configured)

## Quick Deploy to Railway

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up / Login with GitHub

### Step 2: Deploy Backend Service

1. Click **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Configure the service:
   - **Service name**: `hiddenmonkey-api`
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

4. Add Environment Variables (click **Variables** tab):
```
MONGO_URL=mongodb+srv://hiddenmonkeystays:hiddenMonkey%4009@cluster0.mp2x5rm.mongodb.net/?retryWrites=true&w=majority
DB_NAME=hidden_monkey_stays
ADMIN_PASSWORD=hiddenmonkey2024
ADMIN_SECRET_KEY=hiddenmonkey_secret_2024
TWILIO_ACCOUNT_SID=ACcff645f83859673f9933e4a89da97e69
TWILIO_AUTH_TOKEN=9a718d67ded74f8017bd56f78bec0e06
TWILIO_WHATSAPP_NUMBER=+14155238886
RAZORPAY_KEY_ID=rzp_test_SLuLjhlTiTZexx
RAZORPAY_KEY_SECRET=2uuLTcs2wh61bDeEFdVDx2C9
```

5. After deployment, copy the backend URL (e.g., `https://hiddenmonkey-api.up.railway.app`)

6. Add one more variable:
```
BACKEND_URL=https://hiddenmonkey-api.up.railway.app
CORS_ORIGINS=https://hiddenmonkey-guest.up.railway.app
```

### Step 3: Deploy Frontend Service

1. In the same project, click **New** → **GitHub Repo** 
2. Select the same repository
3. Configure:
   - **Service name**: `hiddenmonkey-guest`
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn install && yarn build`
   - **Start Command**: `npx serve -s build -l $PORT`

4. Add Environment Variable:
```
REACT_APP_BACKEND_URL=https://hiddenmonkey-api.up.railway.app
```
(Use your actual backend URL from Step 2)

### Step 4: Generate Domain URLs

1. For each service, go to **Settings** → **Networking** → **Generate Domain**
2. You'll get URLs like:
   - Backend: `https://hiddenmonkey-api.up.railway.app`
   - Frontend: `https://hiddenmonkey-guest.up.railway.app`

### Step 5: Update CORS (Important!)

Go back to Backend service → Variables, update:
```
CORS_ORIGINS=https://hiddenmonkey-guest.up.railway.app
```

---

## Environment Variables Reference

### Backend Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB Atlas connection string |
| `DB_NAME` | Yes | Database name (hidden_monkey_stays) |
| `BACKEND_URL` | Yes | Your Railway backend URL |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `ADMIN_SECRET_KEY` | Yes | Secret key for admin operations |
| `CORS_ORIGINS` | Yes | Frontend URL for CORS |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | No | Twilio WhatsApp number |
| `RAZORPAY_KEY_ID` | No | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | No | Razorpay Key Secret |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |

### Frontend Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Backend API URL |

---

## Testing After Deployment

1. **Health Check**: `https://your-backend.up.railway.app/api/health`
2. **Guest Portal**: `https://your-frontend.up.railway.app/VaranasiHostel`
3. **Admin Panel**: `https://your-frontend.up.railway.app/admin` (password: hiddenmonkey2024)

---

## Twilio Webhook Setup (For WhatsApp)

After deployment, configure the webhook in Twilio Console:
1. Go to: Twilio Console → Messaging → WhatsApp → Sandbox Settings
2. Set "When a message comes in" URL:
   ```
   https://your-backend.up.railway.app/api/webhook/whatsapp
   ```
3. Method: POST

---

## Cost Estimate

| Service | Railway Plan | Cost |
|---------|-------------|------|
| Backend | Hobby ($5/month) | ~$2-5/month |
| Frontend | Hobby ($5/month) | ~$1-2/month |
| **Total** | | **~$3-7/month** |

Railway offers $5 free credits monthly for new users.

---

## Troubleshooting

### Backend not starting?
- Check logs in Railway dashboard
- Ensure all required environment variables are set
- Verify MONGO_URL is correct

### Frontend shows blank page?
- Check if REACT_APP_BACKEND_URL is set correctly
- Verify backend is running and accessible
- Check browser console for errors

### CORS errors?
- Ensure CORS_ORIGINS in backend matches your frontend URL exactly
- Include the full URL with https://

### WhatsApp not working?
- Verify Twilio credentials are correct
- Check if webhook URL is configured in Twilio Console
- For sandbox, recipients must have joined the sandbox first
