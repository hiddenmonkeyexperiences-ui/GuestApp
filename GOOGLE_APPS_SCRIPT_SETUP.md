# Google Apps Script Setup for Check-in Notifications

This guide explains how to set up Google Apps Script to send check-in notifications to your backend when a guest submits the Google Form.

## Prerequisites
1. A Google Form for guest check-in
2. Your backend deployed and accessible (e.g., `https://your-backend.up.railway.app`)
3. Manager WhatsApp number configured in Admin Settings

## Step 1: Open Apps Script

1. Open your Google Form in edit mode
2. Click on the **three dots menu (⋮)** in the top right
3. Select **Script editor** (or go to **Extensions > Apps Script**)

## Step 2: Add the Script

Replace the default code with:

```javascript
/**
 * Hidden Monkey Stays - Check-in Form Webhook
 * Sends notification to backend when guest submits check-in form
 */

// CONFIGURATION - Update this URL to your backend
const BACKEND_URL = "https://your-backend.up.railway.app/api/webhook/checkin";
const DEFAULT_PROPERTY_ID = "varanasi"; // Change to your property ID

/**
 * Triggered when form is submitted
 */
function onFormSubmit(e) {
  try {
    // Get form responses
    const response = e.response;
    const itemResponses = response.getItemResponses();
    
    // Map form fields to our data structure
    // Update these indexes based on your form question order (0-based)
    const data = {
      guest_name: getResponseByTitle(itemResponses, "Name") || getResponseByTitle(itemResponses, "Full Name") || getResponseByIndex(itemResponses, 0),
      room_number: getResponseByTitle(itemResponses, "Room") || getResponseByTitle(itemResponses, "Room Number") || getResponseByIndex(itemResponses, 1),
      phone: getResponseByTitle(itemResponses, "Phone") || getResponseByTitle(itemResponses, "WhatsApp") || getResponseByTitle(itemResponses, "Mobile") || getResponseByIndex(itemResponses, 2),
      email: getResponseByTitle(itemResponses, "Email") || "",
      checkin_date: getResponseByTitle(itemResponses, "Check-in Date") || getResponseByTitle(itemResponses, "Arrival Date") || "",
      checkout_date: getResponseByTitle(itemResponses, "Check-out Date") || getResponseByTitle(itemResponses, "Departure Date") || "",
      property_id: getResponseByTitle(itemResponses, "Property") || DEFAULT_PROPERTY_ID
    };
    
    // Send to backend
    const options = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    const result = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = result.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log("Check-in notification sent successfully for: " + data.guest_name);
    } else {
      Logger.log("Failed to send notification. Response code: " + responseCode);
      Logger.log("Response: " + result.getContentText());
    }
    
  } catch (error) {
    Logger.log("Error in onFormSubmit: " + error.toString());
  }
}

/**
 * Get response by question title (case-insensitive partial match)
 */
function getResponseByTitle(itemResponses, title) {
  const titleLower = title.toLowerCase();
  for (let i = 0; i < itemResponses.length; i++) {
    const questionTitle = itemResponses[i].getItem().getTitle().toLowerCase();
    if (questionTitle.includes(titleLower)) {
      return itemResponses[i].getResponse();
    }
  }
  return "";
}

/**
 * Get response by index (fallback)
 */
function getResponseByIndex(itemResponses, index) {
  if (index < itemResponses.length) {
    return itemResponses[index].getResponse();
  }
  return "";
}

/**
 * Test function - run this manually to test the webhook
 */
function testWebhook() {
  const testData = {
    guest_name: "Test Guest",
    room_number: "101",
    phone: "+919876543210",
    email: "test@example.com",
    checkin_date: "2026-03-04",
    checkout_date: "2026-03-07",
    property_id: DEFAULT_PROPERTY_ID
  };
  
  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(testData),
    muteHttpExceptions: true
  };
  
  const result = UrlFetchApp.fetch(BACKEND_URL, options);
  Logger.log("Response Code: " + result.getResponseCode());
  Logger.log("Response: " + result.getContentText());
}
```

## Step 3: Update Configuration

1. Replace `BACKEND_URL` with your actual backend URL:
   ```javascript
   const BACKEND_URL = "https://hiddenmonkey-api.up.railway.app/api/webhook/checkin";
   ```

2. Update `DEFAULT_PROPERTY_ID` to match your property:
   - `"varanasi"` for Varanasi Hostel
   - `"darjeeling-hostel"` for Darjeeling Hostel
   - `"darjeeling-home"` for Darjeeling Home

## Step 4: Set Up the Trigger

1. In the Apps Script editor, click on **Triggers** (clock icon) in the left sidebar
2. Click **+ Add Trigger** in the bottom right
3. Configure the trigger:
   - **Choose which function to run:** `onFormSubmit`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `From form`
   - **Select event type:** `On form submit`
4. Click **Save**
5. You may need to authorize the script - follow the prompts

## Step 5: Test the Integration

1. In Apps Script, select `testWebhook` from the function dropdown
2. Click **Run**
3. Check the **Execution Log** (View > Logs) for results
4. Verify the manager receives a WhatsApp notification

## Troubleshooting

### No notification received?
1. Check that manager WhatsApp number is configured in Admin > Settings
2. Verify the `BACKEND_URL` is correct and accessible
3. Check the Apps Script execution logs for errors
4. Test the webhook endpoint directly:
   ```bash
   curl -X POST https://your-backend/api/webhook/checkin \
     -H "Content-Type: application/json" \
     -d '{"guest_name":"Test","room_number":"101","property_id":"varanasi"}'
   ```

### Form field mapping issues?
The script tries to match form questions by title. If your form uses different question titles, update the `getResponseByTitle` calls or use index-based matching.

### Authorization errors?
When first running, Google will ask for permissions. Make sure to:
1. Click "Review Permissions"
2. Select your Google account
3. Click "Advanced" > "Go to [Project Name]"
4. Click "Allow"

## Form Question Recommendations

For best results, use these question titles in your Google Form:
- "Full Name" or "Name"
- "Room Number" or "Room"
- "Phone" or "WhatsApp" or "Mobile Number"
- "Email"
- "Check-in Date"
- "Check-out Date"

## Expected Webhook Payload

The backend expects this JSON structure:
```json
{
  "guest_name": "John Doe",
  "room_number": "101",
  "phone": "+919876543210",
  "email": "john@example.com",
  "checkin_date": "2026-03-04",
  "checkout_date": "2026-03-07",
  "property_id": "varanasi"
}
```

## WhatsApp Notification Format

When triggered, the manager receives:
```
🎉 *New Check-in Alert!*

👤 *Guest:* John Doe
🚪 *Room:* 101
📱 *Phone:* +919876543210
📧 *Email:* john@example.com
📅 *Check-in:* 2026-03-04
📅 *Check-out:* 2026-03-07
🏨 *Property:* Hidden Monkey Hostel, Varanasi
⏰ *Time:* 02:30 PM, 04 Mar 2026
```
