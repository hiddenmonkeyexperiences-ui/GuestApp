from fastapi import FastAPI, APIRouter, HTTPException, Query, Form, Request, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from dotenv import load_dotenv
import qrcode
from io import BytesIO
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import os
import logging
import re
import time
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator, ValidationError
from typing import List, Optional, AsyncGenerator
from contextlib import asynccontextmanager
import uuid
from datetime import datetime, timezone, timedelta
import asyncio
import hmac
import hashlib
import html
import cloudinary
import cloudinary.utils
import cloudinary.uploader

# Configure logging to show INFO level
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ==================== Environment Variables Validation ====================
def validate_required_env_vars():
    """Validate required environment variables at startup"""
    required_vars = ['MONGO_URL', 'DB_NAME']
    missing = [var for var in required_vars if not os.environ.get(var)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")
    
    # Warn about optional but recommended variables
    optional_vars = ['BACKEND_URL', 'TWILIO_ACCOUNT_SID', 'RAZORPAY_KEY_ID']
    for var in optional_vars:
        if not os.environ.get(var):
            logging.warning(f"Optional environment variable {var} not set - some features may not work")

validate_required_env_vars()

# ==================== MongoDB Connection Manager ====================
class MongoDB:
    """MongoDB connection manager with connection pooling"""
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

mongodb = MongoDB()

async def connect_to_mongodb():
    """Initialize MongoDB connection with connection pooling during startup"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    # Connection pool settings for production
    mongodb.client = AsyncIOMotorClient(
        mongo_url,
        maxPoolSize=50,           # Maximum connections in pool
        minPoolSize=10,           # Minimum connections to maintain
        maxIdleTimeMS=30000,      # Close idle connections after 30s
        waitQueueTimeoutMS=5000,  # Timeout waiting for connection
        serverSelectionTimeoutMS=5000,  # Timeout for server selection
        connectTimeoutMS=10000,   # Connection timeout
        retryWrites=True,         # Retry failed writes
    )
    mongodb.db = mongodb.client[db_name]
    
    # Verify connection
    try:
        await mongodb.client.admin.command('ping')
        logger.info(f"✅ Connected to MongoDB: {db_name} (Pool: 10-50 connections)")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise

async def close_mongodb_connection():
    """Clean up MongoDB connection during shutdown"""
    if mongodb.client:
        mongodb.client.close()
        logger.info("✅ MongoDB connection closed")

def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency to get database instance"""
    if mongodb.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return mongodb.db

# Backward compatibility - global db reference for existing code
# Will be set during lifespan startup
db: AsyncIOMotorDatabase = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown events"""
    global db
    # Startup
    await connect_to_mongodb()
    db = mongodb.db
    logger.info("🚀 Application started")
    
    yield
    
    # Shutdown
    await close_mongodb_connection()
    logger.info("👋 Application shutdown complete")

# Twilio Configuration (placeholders - add your credentials)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')  # e.g., +14155238886

# Resend Configuration for email backup
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')

# Razorpay Configuration
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logging.info("Twilio client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Twilio client: {e}")

# Initialize Resend client
resend_client = None
if RESEND_API_KEY:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resend_client = resend
        logging.info("Resend client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Resend client: {e}")

# Initialize Razorpay client
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        import razorpay
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logging.info("Razorpay client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Razorpay client: {e}")

# Initialize Cloudinary
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    logging.info(f"Cloudinary configured: {CLOUDINARY_CLOUD_NAME}")
else:
    logging.warning("Cloudinary not configured - image upload will not work")

# ==================== Webhook Security ====================

def verify_razorpay_signature(payload_body: bytes, signature: str, secret: str) -> bool:
    """
    Verify Razorpay webhook signature using HMAC-SHA256.
    https://razorpay.com/docs/webhooks/validate-test/
    """
    if not signature or not secret:
        return False
    
    try:
        expected_signature = hmac.new(
            key=secret.encode('utf-8'),
            msg=payload_body,
            digestmod=hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)
    except Exception as e:
        logging.error(f"Razorpay signature verification error: {e}")
        return False

def verify_twilio_signature(request_url: str, params: dict, signature: str, auth_token: str) -> bool:
    """
    Verify Twilio webhook signature.
    https://www.twilio.com/docs/usage/security#validating-requests
    """
    if not signature or not auth_token:
        return False
    
    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(auth_token)
        return validator.validate(request_url, params, signature)
    except ImportError:
        logging.error("Twilio library not installed for signature validation")
        return False
    except Exception as e:
        logging.error(f"Twilio signature verification error: {e}")
        return False

# Create the main app with lifespan manager
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== Input Validation & Sanitization ====================

def render_message_template(template: str, variables: dict) -> str:
    """Render a message template with variable substitution.
    Variables use {variable_name} format.
    """
    if not template:
        return ""
    
    message = template
    for key, value in variables.items():
        placeholder = "{" + key + "}"
        message = message.replace(placeholder, str(value) if value else "")
    
    # Clean up any unreplaced placeholders
    import re
    message = re.sub(r'\{[a-z_]+\}', '', message)
    
    return message.strip()

class InputValidator:
    """Centralized input validation and sanitization"""
    
    # Patterns
    PHONE_PATTERN = re.compile(r'^[\d\s\+\-\(\)]{7,20}$')
    ROOM_PATTERN = re.compile(r'^[A-Za-z0-9\-\s]{1,20}$')
    NAME_PATTERN = re.compile(r'^[A-Za-z\s\.\'\-]{2,100}$')
    
    # Dangerous patterns to block
    SCRIPT_PATTERN = re.compile(r'<script|javascript:|on\w+\s*=', re.IGNORECASE)
    SQL_INJECTION_PATTERN = re.compile(r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*\b(FROM|INTO|SET|TABLE)\b)', re.IGNORECASE)
    NOSQL_INJECTION_PATTERN = re.compile(r'\$\w+|\{\s*\$', re.IGNORECASE)
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 500) -> str:
        """Sanitize a string input - escape HTML and trim"""
        if not value:
            return ""
        # Trim whitespace and limit length
        value = value.strip()[:max_length]
        # Escape HTML entities to prevent XSS
        value = html.escape(value)
        return value
    
    @staticmethod
    def validate_phone(phone: str) -> str:
        """Validate and sanitize phone number"""
        if not phone:
            raise ValueError("Phone number is required")
        phone = phone.strip()
        # Remove common formatting but keep digits and +
        cleaned = re.sub(r'[^\d\+]', '', phone)
        if len(cleaned) < 7 or len(cleaned) > 15:
            raise ValueError("Invalid phone number length")
        if not InputValidator.PHONE_PATTERN.match(phone):
            raise ValueError("Invalid phone number format")
        return phone
    
    @staticmethod
    def validate_room_number(room: str) -> str:
        """Validate room number"""
        if not room:
            raise ValueError("Room number is required")
        room = room.strip()[:20]
        if not InputValidator.ROOM_PATTERN.match(room):
            raise ValueError("Invalid room number format")
        return html.escape(room)
    
    @staticmethod
    def validate_guest_name(name: str) -> str:
        """Validate guest name"""
        if not name:
            raise ValueError("Guest name is required")
        name = name.strip()[:100]
        if len(name) < 2:
            raise ValueError("Name must be at least 2 characters")
        if not InputValidator.NAME_PATTERN.match(name):
            raise ValueError("Name contains invalid characters")
        return html.escape(name)
    
    @staticmethod
    def validate_notes(notes: str) -> str:
        """Validate and sanitize notes/messages"""
        if not notes:
            return ""
        notes = notes.strip()[:1000]
        # Check for injection attempts
        if InputValidator.SCRIPT_PATTERN.search(notes):
            raise ValueError("Invalid content detected")
        if InputValidator.SQL_INJECTION_PATTERN.search(notes):
            raise ValueError("Invalid content detected")
        if InputValidator.NOSQL_INJECTION_PATTERN.search(notes):
            raise ValueError("Invalid content detected")
        return html.escape(notes)
    
    @staticmethod
    def validate_property_id(property_id: str) -> str:
        """Validate property ID"""
        if not property_id:
            raise ValueError("Property ID is required")
        property_id = property_id.strip()[:50]
        # Only allow alphanumeric and hyphens
        if not re.match(r'^[a-zA-Z0-9\-_]+$', property_id):
            raise ValueError("Invalid property ID format")
        return property_id


def validate_guest_input(guest_name: str, room_number: str, whatsapp: str, notes: str = None) -> dict:
    """Validate all guest input fields and return sanitized values"""
    try:
        return {
            "guest_name": InputValidator.validate_guest_name(guest_name),
            "room_number": InputValidator.validate_room_number(room_number),
            "whatsapp": InputValidator.validate_phone(whatsapp),
            "notes": InputValidator.validate_notes(notes) if notes else ""
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== Models ====================

# Experience Models
class ExperienceBase(BaseModel):
    title: str
    description: str
    category: str  # wellness, culture, adventure, etc.
    image_url: str
    brochure_url: Optional[str] = None
    duration: Optional[str] = None
    price: Optional[str] = None
    is_active: bool = True
    property_id: str = "default"

class ExperienceCreate(ExperienceBase):
    pass

class Experience(ExperienceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Menu Item Models
class MenuItemBase(BaseModel):
    name: str
    description: str
    category: str  # Primary category for backward compatibility
    categories: List[str] = []  # Multiple categories support
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    is_vegetarian: bool = False
    property_id: str = "default"

class MenuItemCreate(MenuItemBase):
    pass

class MenuItem(MenuItemBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Category Settings Models
class CategoryTiming(BaseModel):
    start_time: str  # "07:00" format
    end_time: str    # "11:00" format

class CategorySettingBase(BaseModel):
    property_id: str
    category: str  # breakfast, lunch, dinner, snacks, beverages, desserts
    is_enabled: bool = True
    timing: Optional[CategoryTiming] = None
    use_timing: bool = False  # If false, category is always on when enabled

class CategorySettingCreate(CategorySettingBase):
    pass

class CategorySetting(CategorySettingBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Guest Request Models
class GuestRequestBase(BaseModel):
    guest_name: str
    room_number: str
    whatsapp: str
    category: str  # housekeeping, maintenance, amenities, other
    message: str
    property_id: str
    
    @field_validator('guest_name')
    @classmethod
    def validate_name(cls, v):
        return InputValidator.validate_guest_name(v)
    
    @field_validator('room_number')
    @classmethod
    def validate_room(cls, v):
        return InputValidator.validate_room_number(v)
    
    @field_validator('whatsapp')
    @classmethod
    def validate_phone(cls, v):
        return InputValidator.validate_phone(v)
    
    @field_validator('message')
    @classmethod
    def validate_msg(cls, v):
        return InputValidator.validate_notes(v)
    
    @field_validator('property_id')
    @classmethod
    def validate_prop(cls, v):
        return InputValidator.validate_property_id(v)
    
    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = ['housekeeping', 'maintenance', 'amenities', 'other']
        if v.lower() not in valid_categories:
            raise ValueError(f"Category must be one of: {', '.join(valid_categories)}")
        return v.lower()

class GuestRequestCreate(GuestRequestBase):
    pass

class GuestRequest(GuestRequestBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, approved, rejected, in_progress, completed
    timeline: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Experience Booking Models
class ExperienceBookingBase(BaseModel):
    guest_name: str
    room_number: str
    whatsapp: str
    experience_id: str
    experience_title: str
    property_id: str
    notes: Optional[str] = None
    
    @field_validator('guest_name')
    @classmethod
    def validate_name(cls, v):
        return InputValidator.validate_guest_name(v)
    
    @field_validator('room_number')
    @classmethod
    def validate_room(cls, v):
        return InputValidator.validate_room_number(v)
    
    @field_validator('whatsapp')
    @classmethod
    def validate_phone(cls, v):
        return InputValidator.validate_phone(v)
    
    @field_validator('notes')
    @classmethod
    def validate_notes_field(cls, v):
        return InputValidator.validate_notes(v) if v else ""
    
    @field_validator('property_id')
    @classmethod
    def validate_prop(cls, v):
        return InputValidator.validate_property_id(v)
    
    @field_validator('experience_title')
    @classmethod
    def validate_title(cls, v):
        return InputValidator.sanitize_string(v, 200)

class ExperienceBookingCreate(ExperienceBookingBase):
    pass

class ExperienceBooking(ExperienceBookingBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, approved, rejected, confirmed
    timeline: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Food Order Models
class OrderItemBase(BaseModel):
    item_id: str
    name: str
    quantity: int
    price: float
    
    @field_validator('name')
    @classmethod
    def validate_item_name(cls, v):
        return InputValidator.sanitize_string(v, 100)
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v):
        if v < 1 or v > 100:
            raise ValueError("Quantity must be between 1 and 100")
        return v
    
    @field_validator('price')
    @classmethod
    def validate_price(cls, v):
        if v < 0 or v > 100000:
            raise ValueError("Invalid price")
        return v

class FoodOrderBase(BaseModel):
    guest_name: str
    room_number: str
    whatsapp: str
    items: List[OrderItemBase]
    total: float
    property_id: str
    notes: Optional[str] = None
    
    @field_validator('guest_name')
    @classmethod
    def validate_name(cls, v):
        return InputValidator.validate_guest_name(v)
    
    @field_validator('room_number')
    @classmethod
    def validate_room(cls, v):
        return InputValidator.validate_room_number(v)
    
    @field_validator('whatsapp')
    @classmethod
    def validate_phone(cls, v):
        return InputValidator.validate_phone(v)
    
    @field_validator('notes')
    @classmethod
    def validate_notes_field(cls, v):
        return InputValidator.validate_notes(v) if v else ""
    
    @field_validator('property_id')
    @classmethod
    def validate_prop(cls, v):
        return InputValidator.validate_property_id(v)
    
    @field_validator('total')
    @classmethod
    def validate_total(cls, v):
        if v < 0 or v > 1000000:
            raise ValueError("Invalid total amount")
        return v
    
    @field_validator('items')
    @classmethod
    def validate_items(cls, v):
        if not v or len(v) == 0:
            raise ValueError("Order must have at least one item")
        if len(v) > 50:
            raise ValueError("Too many items in order")
        return v

class FoodOrderCreate(FoodOrderBase):
    pass

class FoodOrder(FoodOrderBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, approved, rejected, preparing, delivered
    timeline: List[dict] = Field(default_factory=list)  # Notification timeline
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Settings Model
class SettingsBase(BaseModel):
    property_id: str
    property_name: str
    property_slug: str = ""  # URL slug like VaranasiHostel
    property_location: str = ""  # Location description
    staff_whatsapp: str = ""  # Legacy field
    staff1_whatsapp: str = ""  # Legacy single number
    staff2_whatsapp: str = ""  # Legacy single number
    manager_numbers: List[str] = []  # Multiple manager (staff2) numbers
    kitchen_numbers: List[str] = []  # Multiple kitchen (staff1) numbers
    notification_email: str = ""  # Email backup
    upi_id: str = ""  # For payment info
    payment_qr_url: str = ""  # Payment QR image URL
    currency: str = "INR"
    # Feature toggles
    experiences_enabled: bool = True  # Toggle to enable/disable experiences
    requests_enabled: bool = True  # Toggle to enable/disable guest requests
    
    # Message Templates - Use {variable} placeholders
    # Variables: {guest_name}, {room_number}, {order_id}, {property_name}, {items_list}, {total}, {experience_title}, {experience_price}, {category}, {message}, {payment_link}, {amount}
    msg_food_order_staff: str = """🍽️ *New Food Order #{order_id}*

*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}

*Order:*
{items_list}

*Total:* ₹{total}
{notes_section}
━━━━━━━━━━━━━━━
↩️ *Reply to this message:*
*1* = ✅ Approve
*2* = ❌ Reject"""

    msg_food_order_guest: str = """🍽️ *Order Received!*

Hi {guest_name}, your order has been received!

*Order ID:* #{order_id}
*Total:* ₹{total}

Our kitchen is preparing your order. You'll be notified once it's ready.

Thank you for ordering with {property_name}! 🐒"""

    msg_booking_staff: str = """🎯 *New Experience Booking #{order_id}*

*Experience:* {experience_title}
*Price:* {experience_price}

*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}
{notes_section}
⚠️ Please check with guest about availability and details.

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Approve (sends payment link to guest)
*2* = ❌ Reject"""

    msg_booking_guest_received: str = """🎯 *Booking Received!*

Hi {guest_name}, thank you for booking *{experience_title}* with {property_name}!

*Booking ID:* #{order_id}

Our team will connect with you shortly to confirm availability and details.

💳 Once confirmed, you will receive a payment link. *Only online payment is accepted.*

Thank you! 🐒"""

    msg_booking_guest_approved: str = """✅ *Booking Approved!*

Hi {guest_name}, your booking for *{experience_title}* has been approved!

*Booking ID:* #{order_id}
*Amount:* {experience_price}

💳 *Please complete your payment:*
{payment_link}

⏰ Payment link expires in 24 hours.

Once payment is complete, you'll receive a confirmation with scheduling details.

Thank you for choosing {property_name}! 🐒"""

    msg_booking_payment_staff: str = """💳 *PAYMENT RECEIVED - Booking #{order_id}*

*Experience:* {experience_title}
*Guest:* {guest_name}
*Room:* {room_number}
*Amount Paid:* ₹{amount}

✅ Payment confirmed! Please:
1. Coordinate with guest for scheduling
2. Reply "SCHEDULED" when experience is scheduled

━━━━━━━━━━━━━━━
↩️ Reply *3* or *DONE* when experience is completed."""

    msg_booking_payment_guest: str = """💳 *Payment Confirmed!*

Hi {guest_name}, your payment of *₹{amount}* for *{experience_title}* has been received!

*Booking ID:* #{order_id}

Our team will contact you shortly to finalize the schedule.

Enjoy your experience with {property_name}! 🐒"""

    msg_request_staff: str = """📋 *New Service Request #{order_id}*

*Category:* {category}
*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}

*Request:*
{message}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Acknowledge (notifies guest)
*3* = ✅ Resolved (closes request)"""

    msg_request_guest_received: str = """📋 *Request Received!*

Hi {guest_name}, your {category} request has been received!

*Request ID:* #{order_id}

Our team has been notified and will attend to it shortly.

Thank you for staying with {property_name}! 🐒"""

    msg_request_guest_acknowledged: str = """✅ *Request Acknowledged!*

Hi {guest_name}, our team has acknowledged your request #{order_id}.

*Category:* {category}

We are working on it and will update you once it's resolved.

Thank you for your patience! 🐒"""

    msg_request_guest_resolved: str = """🎉 *Request Resolved!*

Hi {guest_name}, your {category} request #{order_id} has been resolved.

If you need any further assistance, please don't hesitate to raise another request.

Thank you for staying with {property_name}! 🐒"""

    msg_payment_link_guest: str = """💳 *Payment Link*

Hi {guest_name}, please complete your payment:

*Amount:* ₹{total}
*Link:* {payment_link}

⏰ This link expires in 24 hours.

Thank you! 🐒"""

    msg_order_approved_guest: str = """✅ *Order Approved!*

Hi {guest_name}, your order #{order_id} has been approved!

Our team is preparing it now. You'll be notified when it's ready.

Thank you! 🐒"""

    msg_order_rejected_guest: str = """❌ *Order Update*

Hi {guest_name}, unfortunately your order #{order_id} could not be fulfilled at this time.

Please contact our staff for assistance or try ordering again later.

We apologize for any inconvenience. 🐒"""

class SettingsCreate(SettingsBase):
    pass

class Settings(SettingsBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Notification Timeline Model
class NotificationEvent(BaseModel):
    timestamp: str
    event: str  # e.g., "order_placed", "staff1_notified", "approved", "rejected", "staff2_notified", "guest_notified"
    details: Optional[str] = None

# Admin Auth Model
class AdminAuth(BaseModel):
    password: str

# User/Staff Models for Authentication
class UserRole(BaseModel):
    role: str  # "admin", "manager", "kitchen"
    property_id: Optional[str] = None  # None for admin (all properties)

class UserBase(BaseModel):
    username: str
    role: str  # "admin", "manager", "kitchen"
    property_id: Optional[str] = None  # Property access (None = all for admin)
    whatsapp_numbers: List[str] = []  # Multiple phone numbers

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    current_password: Optional[str] = None  # Not needed for admin changing staff
    new_password: str
    secret_key: Optional[str] = None  # For admin password change

# OTP Password Reset Models
class OTPRequest(BaseModel):
    username: str  # Username or phone number
    
class OTPVerify(BaseModel):
    username: str
    otp: str
    new_password: str

# Property Info Model (for guest landing page)
class PropertyInfoBase(BaseModel):
    property_id: str
    checkin_time: str = "2:00 PM"
    checkout_time: str = "11:00 AM"
    wifi_name: str = ""
    wifi_password: str = ""
    today_events: List[dict] = []  # [{title, time, description}]
    things_to_do: List[dict] = []  # [{title, description, image_url}]
    food_to_try: List[dict] = []  # [{title, description, image_url}]
    welcome_message: str = "Welcome to Hidden Monkey Stays!"
    contact_phone: str = ""
    emergency_phone: str = ""
    
    # Configurable Header Images
    header_image: str = ""  # Main property header/banner image
    food_header_image: str = ""  # Food & Drinks section header
    experiences_header_image: str = ""  # Experiences section header
    requests_header_image: str = ""  # Requests section header
    
    # Check-in Form URL (Google Form embed link)
    checkin_form_url: str = ""

class PropertyInfoCreate(PropertyInfoBase):
    pass

class PropertyInfo(PropertyInfoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == password_hash

# Admin secret key for admin password changes
ADMIN_SECRET_KEY = os.environ.get('ADMIN_SECRET_KEY', 'hiddenmonkey_secret_2024')

# In-memory OTP storage (expires after 10 minutes)
otp_storage = {}  # {username: {"otp": "123456", "expires": datetime, "attempts": 0}}

def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    import random
    return str(random.randint(100000, 999999))

async def send_otp_whatsapp(phone: str, otp: str, username: str) -> bool:
    """Send OTP via WhatsApp"""
    message = f"""🔐 *Password Reset OTP*

Your OTP for resetting password for account *{username}* is:

*{otp}*

This OTP is valid for 10 minutes.
Do not share this with anyone.

- Hidden Monkey Stays"""
    
    result = await send_whatsapp(phone, message)
    return result.get("success", False)

async def send_otp_email(email: str, otp: str, username: str) -> bool:
    """Send OTP via Email"""
    if not resend_client:
        return False
    
    html_content = f"""
    <h2>Password Reset OTP</h2>
    <p>Your OTP for resetting password for account <strong>{username}</strong> is:</p>
    <h1 style="color: #2E7D32; font-size: 32px; letter-spacing: 5px;">{otp}</h1>
    <p>This OTP is valid for 10 minutes.</p>
    <p>Do not share this with anyone.</p>
    <br>
    <p>- Hidden Monkey Stays</p>
    """
    
    return await send_email(email, "Password Reset OTP - Hidden Monkey Stays", html_content)

def serialize_datetime(doc: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB storage"""
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    return doc

def deserialize_datetime(doc: dict, fields: List[str]) -> dict:
    """Convert ISO strings back to datetime objects"""
    for field in fields:
        if field in doc and isinstance(doc[field], str):
            doc[field] = datetime.fromisoformat(doc[field])
    return doc

def add_timeline_event(timeline: List[dict], event: str, details: str = None) -> List[dict]:
    """Add event to timeline"""
    timeline.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "details": details
    })
    return timeline

# ==================== WhatsApp & Email Notification Functions ====================

async def send_whatsapp(to_number: str, message: str) -> dict:
    """Send WhatsApp message via Twilio. Returns dict with success status and message_sid"""
    if not twilio_client or not TWILIO_WHATSAPP_NUMBER:
        logger.warning("Twilio not configured - WhatsApp message not sent")
        return {"success": False, "sid": None}
    
    try:
        # Clean phone number
        clean_number = ''.join(filter(str.isdigit, to_number))
        if not clean_number.startswith('91') and len(clean_number) == 10:
            clean_number = '91' + clean_number
        
        result = twilio_client.messages.create(
            body=message,
            from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            to=f"whatsapp:+{clean_number}"
        )
        logger.info(f"WhatsApp sent to +{clean_number}, SID: {result.sid}")
        return {"success": True, "sid": result.sid}
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {to_number}: {e}")
        return {"success": False, "sid": None}

async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email via Resend"""
    if not resend_client:
        logging.warning("Resend not configured - Email not sent")
        return False
    
    try:
        resend_client.Emails.send({
            "from": "Hidden Monkey <notifications@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        logging.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return False

def generate_order_id(full_id: str) -> str:
    """Generate short order ID for display"""
    return full_id[:8].upper()

async def notify_staff1_new_order(order: dict, settings: dict, order_type: str = "order"):
    """Send notification to Staff 1 (Manager) for new order/booking/request.
    Returns dict with success status and message_sid for reply tracking."""
    staff1_phone = settings.get("staff1_whatsapp") or settings.get("staff_whatsapp")
    if not staff1_phone:
        logger.warning("No Staff 1 phone configured")
        return {"success": False, "sid": None}
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        items_list = "\n".join([f"• {item['name']} x{item['quantity']} - ₹{item['price'] * item['quantity']}" for item in order.get("items", [])])
        message = f"""🍽️ *New Order #{order_id}*

*Guest:* {order['guest_name']}
*Room:* {order['room_number']}
*Phone:* {order['whatsapp']}

*Items:*
{items_list}

*Total:* ₹{order['total']}
{f"*Notes:* {order['notes']}" if order.get('notes') else ""}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Accept
*2* = ❌ Reject"""
    
    elif order_type == "booking":
        message = f"""🎯 *New Booking #{order_id}*

*Experience:* {order.get('experience_title', 'N/A')}
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}
*Phone:* {order['whatsapp']}
{f"*Notes:* {order['notes']}" if order.get('notes') else ""}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Accept
*2* = ❌ Reject"""
    
    else:  # request
        message = f"""📋 *New Request #{order_id}*

*Category:* {order.get('category', 'General')}
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}
*Phone:* {order['whatsapp']}

*Message:*
{order.get('message', 'N/A')}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Accept
*2* = ❌ Reject"""
    
    return await send_whatsapp(staff1_phone, message)

async def notify_staff2_approved(order: dict, settings: dict, order_type: str = "order"):
    """Send notification to Staff 2 (Billing) when order is approved"""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        logging.warning("No Staff 2 phone configured")
        return False
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        items_list = "\n".join([f"• {item['name']} x{item['quantity']} - ₹{item['price'] * item['quantity']}" for item in order.get("items", [])])
        message = f"""💰 *APPROVED - Add to Bill*

*Order #{order_id}*
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

*Items:*
{items_list}

*Amount to charge:* ₹{order['total']}

Please add to Room {order['room_number']} bill or collect payment."""
    
    elif order_type == "booking":
        message = f"""💰 *BOOKING APPROVED*

*Booking #{order_id}*
*Experience:* {order.get('experience_title', 'N/A')}
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

Please coordinate with guest for scheduling."""
    
    else:  # request
        message = f"""✅ *REQUEST APPROVED*

*Request #{order_id}*
*Category:* {order.get('category', 'General')}
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

*Request:* {order.get('message', 'N/A')}

Please attend to this request."""
    
    return await send_whatsapp(staff2_phone, message)

async def notify_staff2_rejected(order: dict, settings: dict, order_type: str = "order"):
    """Send notification to Staff 2 when order is rejected"""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    type_label = {"order": "Order", "booking": "Booking", "request": "Request"}.get(order_type, "Order")
    
    message = f"""❌ *{type_label.upper()} REJECTED*

*{type_label} #{order_id}*
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

This {type_label.lower()} was rejected by manager."""
    
    return await send_whatsapp(staff2_phone, message)

async def notify_guest_approved(order: dict, settings: dict, order_type: str = "order"):
    """Send confirmation to guest when order is approved"""
    guest_phone = order.get("whatsapp")
    if not guest_phone:
        return False
    
    upi_id = settings.get("upi_id", "")
    payment_info = f"\n\n💳 *Pay via UPI:* {upi_id}" if upi_id else "\n\nPayment: Cash on delivery or at reception."
    
    if order_type == "order":
        message = f"""✅ *Order Confirmed!*

Hi {order['guest_name']}, your order has been confirmed.

*Total:* ₹{order['total']}{payment_info}

Delivering to Room {order['room_number']} shortly.

Thank you for ordering with Hidden Monkey Stays! 🐒"""
    
    elif order_type == "booking":
        message = f"""✅ *Booking Confirmed!*

Hi {order['guest_name']}, your booking for *{order.get('experience_title', 'the experience')}* has been confirmed.

Our team will contact you shortly to coordinate the schedule.

Thank you for booking with Hidden Monkey Stays! 🐒"""
    
    else:  # request
        message = f"""✅ *Request Received!*

Hi {order['guest_name']}, your request has been received and approved.

Our team will attend to it shortly.

Thank you for staying with Hidden Monkey Stays! 🐒"""
    
    return await send_whatsapp(guest_phone, message)

async def notify_guest_rejected(order: dict, settings: dict, order_type: str = "order"):
    """Send rejection notice to guest"""
    guest_phone = order.get("whatsapp")
    if not guest_phone:
        return False
    
    type_label = {"order": "order", "booking": "booking", "request": "request"}.get(order_type, "order")
    
    message = f"""❌ *{type_label.title()} Update*

Hi {order['guest_name']}, we're sorry but your {type_label} couldn't be processed at this time.

Please visit reception for assistance or try again later.

We apologize for any inconvenience.
- Hidden Monkey Stays Team"""
    
    return await send_whatsapp(guest_phone, message)

async def notify_guest_delivered(order: dict, settings: dict, order_type: str = "order"):
    """Send delivery confirmation to guest"""
    guest_phone = order.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        message = f"""🎉 *Order Delivered!*

Hi {order['guest_name']}, your order #{order_id} has been delivered to Room {order['room_number']}.

Enjoy your meal! 🍽️

Thank you for ordering with Hidden Monkey Stays! 🐒"""
    
    elif order_type == "booking":
        message = f"""🎉 *Experience Complete!*

Hi {order['guest_name']}, we hope you enjoyed your *{order.get('experience_title', 'experience')}*!

Thank you for exploring with Hidden Monkey Stays! 🐒"""
    
    else:  # request
        message = f"""✅ *Request Completed!*

Hi {order['guest_name']}, your request has been fulfilled.

Thank you for staying with Hidden Monkey Stays! 🐒"""
    
    return await send_whatsapp(guest_phone, message)

async def notify_staff2_delivered(order: dict, settings: dict, order_type: str = "order"):
    """Notify Staff 2 (Billing) when order is delivered"""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        return {"success": False, "sid": None}
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        message = f"""✅ *ORDER DELIVERED*

*Order #{order_id}*
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}
*Amount:* ₹{order.get('amount_paid', order.get('total', 0))}

Order has been delivered successfully."""
    
    elif order_type == "booking":
        message = f"""✅ *BOOKING COMPLETED*

*Booking #{order_id}*
*Experience:* {order.get('experience_title', 'N/A')}
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

Experience has been completed."""
    
    else:  # request
        message = f"""✅ *REQUEST FULFILLED*

*Request #{order_id}*
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

Request has been fulfilled."""
    
    return await send_whatsapp(staff2_phone, message)

async def send_email_notification(order: dict, settings: dict, order_type: str, status: str):
    """Send email notification as backup"""
    email = settings.get("notification_email")
    if not email:
        return False
    
    order_id = generate_order_id(order["id"])
    type_label = {"order": "Food Order", "booking": "Experience Booking", "request": "Guest Request"}.get(order_type, "Order")
    
    subject = f"[{status.upper()}] {type_label} #{order_id} - Room {order['room_number']}"
    
    html_content = f"""
    <h2>{type_label} #{order_id}</h2>
    <p><strong>Status:</strong> {status.upper()}</p>
    <p><strong>Guest:</strong> {order['guest_name']}</p>
    <p><strong>Room:</strong> {order['room_number']}</p>
    <p><strong>Phone:</strong> {order['whatsapp']}</p>
    """
    
    if order_type == "order":
        items_html = "".join([f"<li>{item['name']} x{item['quantity']} - ₹{item['price'] * item['quantity']}</li>" for item in order.get("items", [])])
        html_content += f"""
        <p><strong>Items:</strong></p>
        <ul>{items_html}</ul>
        <p><strong>Total:</strong> ₹{order['total']}</p>
        """
    elif order_type == "booking":
        html_content += f"<p><strong>Experience:</strong> {order.get('experience_title', 'N/A')}</p>"
    else:
        html_content += f"""
        <p><strong>Category:</strong> {order.get('category', 'N/A')}</p>
        <p><strong>Message:</strong> {order.get('message', 'N/A')}</p>
        """
    
    return await send_email(email, subject, html_content)

# ==================== NEW BOOKING & REQUEST WORKFLOW NOTIFICATIONS ====================

# Default message templates (used when not configured in settings)
DEFAULT_MSG_TEMPLATES = {
    "msg_booking_staff": """🎯 *New Experience Booking #{order_id}*

*Experience:* {experience_title}
*Price:* {experience_price}

*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}
{notes_section}
⚠️ Please check with guest about availability and details.

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Approve (sends payment link to guest)
*2* = ❌ Reject""",

    "msg_booking_guest_received": """🎯 *Booking Received!*

Hi {guest_name}, thank you for booking *{experience_title}* with {property_name}!

*Booking ID:* #{order_id}

Our team will connect with you shortly to confirm availability and details.

💳 Once confirmed, you will receive a payment link. *Only online payment is accepted.*

Thank you! 🐒""",

    "msg_booking_guest_approved": """✅ *Booking Approved!*

Hi {guest_name}, your booking for *{experience_title}* has been approved!

*Booking ID:* #{order_id}
*Amount:* {experience_price}

💳 *Please complete your payment:*
{payment_link}

⏰ Payment link expires in 24 hours.

Once payment is complete, you'll receive a confirmation with scheduling details.

Thank you for choosing {property_name}! 🐒""",

    "msg_booking_payment_staff": """💳 *PAYMENT RECEIVED - Booking #{order_id}*

*Experience:* {experience_title}
*Guest:* {guest_name}
*Room:* {room_number}
*Amount Paid:* ₹{amount}

✅ Payment confirmed! Please:
1. Coordinate with guest for scheduling
2. Reply "SCHEDULED" when experience is scheduled

━━━━━━━━━━━━━━━
↩️ Reply *3* or *DONE* when experience is completed.""",

    "msg_booking_payment_guest": """💳 *Payment Confirmed!*

Hi {guest_name}, your payment of *₹{amount}* for *{experience_title}* has been received!

*Booking ID:* #{order_id}

Our team will contact you shortly to finalize the schedule.

Enjoy your experience with {property_name}! 🐒""",

    "msg_request_staff": """📋 *New Service Request #{order_id}*

*Category:* {category}
*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}

*Request:*
{message}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Acknowledge (notifies guest)
*3* = ✅ Resolved (closes request)""",

    "msg_request_guest_received": """📋 *Request Received!*

Hi {guest_name}, your {category} request has been received!

*Request ID:* #{order_id}

Our team has been notified and will attend to it shortly.

Thank you for staying with {property_name}! 🐒""",

    "msg_request_guest_acknowledged": """✅ *Request Acknowledged!*

Hi {guest_name}, our team has acknowledged your request #{order_id}.

*Category:* {category}

We are working on it and will update you once it's resolved.

Thank you for your patience! 🐒""",

    "msg_request_guest_resolved": """🎉 *Request Resolved!*

Hi {guest_name}, your {category} request #{order_id} has been resolved.

If you need any further assistance, please don't hesitate to raise another request.

Thank you for staying with {property_name}! 🐒""",
}

async def notify_staff2_new_booking(booking: dict, settings: dict):
    """Send notification to Staff 2 (Manager) for new experience booking.
    Workflow: Guest books -> Manager gets notified to approve/reject -> Then payment link."""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        logger.warning("No Staff 2 (Manager) phone configured for booking")
        return {"success": False, "sid": None}
    
    order_id = generate_order_id(booking["id"])
    notes_section = f"*Notes:* {booking['notes']}" if booking.get('notes') else ""
    
    # Use template from settings or default
    template = settings.get("msg_booking_staff") or DEFAULT_MSG_TEMPLATES["msg_booking_staff"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": booking['guest_name'],
        "room_number": booking['room_number'],
        "whatsapp": booking['whatsapp'],
        "experience_title": booking.get('experience_title', 'N/A'),
        "experience_price": booking.get('experience_price', 'N/A'),
        "notes_section": notes_section,
        "property_name": settings.get('property_name', 'Hidden Monkey Stays')
    })
    
    return await send_whatsapp(staff2_phone, message)

async def notify_guest_booking_received(booking: dict, settings: dict):
    """Send initial notification to guest when booking is received."""
    guest_phone = booking.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(booking["id"])
    property_name = settings.get("property_name", "Hidden Monkey Stays")
    
    # Use template from settings or default
    template = settings.get("msg_booking_guest_received") or DEFAULT_MSG_TEMPLATES["msg_booking_guest_received"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": booking['guest_name'],
        "experience_title": booking.get('experience_title', 'the experience'),
        "property_name": property_name
    })
    
    return await send_whatsapp(guest_phone, message)

async def notify_guest_booking_approved_with_payment(booking: dict, settings: dict, payment_link: str):
    """Send approval notification to guest with payment link."""
    guest_phone = booking.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(booking["id"])
    property_name = settings.get("property_name", "Hidden Monkey Stays")
    
    # Use template from settings or default
    template = settings.get("msg_booking_guest_approved") or DEFAULT_MSG_TEMPLATES["msg_booking_guest_approved"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": booking['guest_name'],
        "experience_title": booking.get('experience_title', 'the experience'),
        "experience_price": booking.get('experience_price', 'N/A'),
        "payment_link": payment_link,
        "property_name": property_name
    })
    
    return await send_whatsapp(guest_phone, message)

async def notify_booking_payment_confirmed_staff2(booking: dict, settings: dict, amount: float):
    """Notify staff2 (manager) when booking payment is confirmed."""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        return False
    
    order_id = generate_order_id(booking["id"])
    
    # Use template from settings or default
    template = settings.get("msg_booking_payment_staff") or DEFAULT_MSG_TEMPLATES["msg_booking_payment_staff"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": booking['guest_name'],
        "room_number": booking['room_number'],
        "experience_title": booking.get('experience_title', 'N/A'),
        "amount": amount
    })
    
    return await send_whatsapp(staff2_phone, message)

async def notify_booking_payment_confirmed_guest(booking: dict, settings: dict, amount: float):
    """Notify guest when their booking payment is confirmed."""
    guest_phone = booking.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(booking["id"])
    property_name = settings.get("property_name", "Hidden Monkey Stays")
    
    # Use template from settings or default
    template = settings.get("msg_booking_payment_guest") or DEFAULT_MSG_TEMPLATES["msg_booking_payment_guest"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": booking['guest_name'],
        "experience_title": booking.get('experience_title', 'the experience'),
        "amount": amount,
        "property_name": property_name
    })
    
    return await send_whatsapp(guest_phone, message)

async def notify_staff2_new_request(request: dict, settings: dict):
    """Send notification to Staff 2 (Manager) for new service request."""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        logger.warning("No Staff 2 (Manager) phone configured for request")
        return {"success": False, "sid": None}
    
    order_id = generate_order_id(request["id"])
    
    # Use template from settings or default
    template = settings.get("msg_request_staff") or DEFAULT_MSG_TEMPLATES["msg_request_staff"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": request['guest_name'],
        "room_number": request['room_number'],
        "whatsapp": request['whatsapp'],
        "category": request.get('category', 'General').title(),
        "message": request.get('message', 'N/A')
    })
    
    return await send_whatsapp(staff2_phone, message)

async def notify_guest_request_received(request: dict, settings: dict):
    """Send notification to guest when request is received."""
    guest_phone = request.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(request["id"])
    property_name = settings.get("property_name", "Hidden Monkey Stays")
    
    # Use template from settings or default
    template = settings.get("msg_request_guest_received") or DEFAULT_MSG_TEMPLATES["msg_request_guest_received"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": request['guest_name'],
        "category": request.get('category', 'service').lower(),
        "property_name": property_name
    })
    
    return await send_whatsapp(guest_phone, message)

async def notify_guest_request_acknowledged(request: dict, settings: dict):
    """Notify guest when staff acknowledges the request."""
    guest_phone = request.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(request["id"])
    
    # Use template from settings or default
    template = settings.get("msg_request_guest_acknowledged") or DEFAULT_MSG_TEMPLATES["msg_request_guest_acknowledged"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": request['guest_name'],
        "category": request.get('category', 'Service').title()
    })
    
    return await send_whatsapp(guest_phone, message)

async def notify_guest_request_resolved(request: dict, settings: dict):
    """Notify guest when request is resolved."""
    guest_phone = request.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(request["id"])
    property_name = settings.get("property_name", "Hidden Monkey Stays")
    
    # Use template from settings or default
    template = settings.get("msg_request_guest_resolved") or DEFAULT_MSG_TEMPLATES["msg_request_guest_resolved"]
    
    message = render_message_template(template, {
        "order_id": order_id,
        "guest_name": request['guest_name'],
        "category": request.get('category', 'service').lower(),
        "property_name": property_name
    })
    
    return await send_whatsapp(guest_phone, message)

# ==================== Razorpay Payment Functions ====================

async def create_razorpay_payment_link(order: dict, settings: dict, order_type: str = "order"):
    """Create Razorpay payment link for the order"""
    if not razorpay_client:
        logging.warning("Razorpay not configured - payment link not created")
        return None
    
    try:
        order_id = generate_order_id(order["id"])
        
        # Determine amount based on order type
        if order_type == "order":
            amount = int(order.get("total", 0) * 100)  # Razorpay uses paise
            description = f"Food Order #{order_id} - Room {order['room_number']}"
        elif order_type == "booking":
            # Extract price from experience (remove ₹ symbol and convert)
            price_str = order.get("experience_price", "0")
            amount = int(float(price_str.replace("₹", "").replace(",", "").strip() or 0) * 100)
            description = f"Booking #{order_id} - {order.get('experience_title', 'Experience')}"
        else:
            amount = 0
            description = f"Request #{order_id}"
        
        if amount <= 0:
            logging.warning(f"Invalid amount for payment link: {amount}")
            return None
        
        # Create payment link
        payment_link_data = {
            "amount": amount,
            "currency": settings.get("currency", "INR"),
            "description": description,
            "customer": {
                "name": order["guest_name"],
                "contact": order["whatsapp"].replace(" ", "").replace("+", "")
            },
            "notify": {
                "sms": False,  # We'll send our own WhatsApp
                "email": False
            },
            "callback_url": f"{os.environ.get('BACKEND_URL', '')}/api/webhook/razorpay?order_id={order['id']}&order_type={order_type}",
            "callback_method": "get",
            "notes": {
                "order_id": order["id"],
                "order_type": order_type,
                "property_id": order.get("property_id", ""),
                "room_number": order["room_number"],
                "guest_name": order["guest_name"]
            }
        }
        
        payment_link = razorpay_client.payment_link.create(payment_link_data)
        logging.info(f"Razorpay payment link created: {payment_link.get('short_url')}")
        return payment_link
        
    except Exception as e:
        logging.error(f"Failed to create Razorpay payment link: {e}")
        return None

async def notify_guest_payment_link(order: dict, settings: dict, payment_link: str, order_type: str = "order"):
    """Send payment link to guest via WhatsApp"""
    guest_phone = order.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        items_list = "\n".join([f"• {item['name']} x{item['quantity']} - ₹{item['price'] * item['quantity']}" for item in order.get("items", [])])
        message = f"""✅ *Order Approved!*

Hi {order['guest_name']}, your order has been approved.

*Order #{order_id}*
{items_list}

*Total: ₹{order['total']}*

💳 *Pay now:* {payment_link}

Your order will be prepared once payment is confirmed.

Thank you! 🐒"""
    
    elif order_type == "booking":
        message = f"""✅ *Booking Approved!*

Hi {order['guest_name']}, your booking for *{order.get('experience_title', 'Experience')}* has been approved!

*Booking #{order_id}*

💳 *Complete payment:* {payment_link}

We'll confirm your schedule once payment is received.

Thank you! 🐒"""
    
    else:
        return False  # Requests don't need payment
    
    return await send_whatsapp(guest_phone, message)

async def notify_payment_success_staff1(order: dict, settings: dict, order_type: str, amount: float):
    """Notify Staff 1 to start cooking/preparing after payment"""
    staff1_phone = settings.get("staff1_whatsapp") or settings.get("staff_whatsapp")
    if not staff1_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        items_list = "\n".join([f"• {item['name']} x{item['quantity']}" for item in order.get("items", [])])
        message = f"""🔥 *PAYMENT RECEIVED - START COOKING!*

*Order #{order_id}*
*Room:* {order['room_number']}
*Guest:* {order['guest_name']}

*Items to prepare:*
{items_list}

💰 *Paid:* ₹{amount}

Please start preparing the order! 🍳

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with *3* when delivered"""
    
    elif order_type == "booking":
        message = f"""✅ *BOOKING PAID - CONFIRMED!*

*Booking #{order_id}*
*Experience:* {order.get('experience_title', 'N/A')}
*Room:* {order['room_number']}
*Guest:* {order['guest_name']}
*Phone:* {order['whatsapp']}

💰 *Paid:* ₹{amount}

Please coordinate with guest for scheduling! 📅

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with *3* when complete"""
    
    else:
        return {"success": False, "sid": None}
    
    return await send_whatsapp(staff1_phone, message)

async def notify_payment_success_staff2(order: dict, settings: dict, order_type: str, amount: float):
    """Notify Staff 2 of payment received for records"""
    staff2_phone = settings.get("staff2_whatsapp")
    if not staff2_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    type_label = "Order" if order_type == "order" else "Booking"
    
    message = f"""💰 *PAYMENT RECEIVED*

*{type_label} #{order_id}*
*Guest:* {order['guest_name']}
*Room:* {order['room_number']}

*Amount Paid:* ₹{amount}
*Payment Status:* ✅ Confirmed

Please note in records."""
    
    return await send_whatsapp(staff2_phone, message)

async def notify_guest_payment_success(order: dict, settings: dict, order_type: str):
    """Notify guest that payment was successful and order is being prepared"""
    guest_phone = order.get("whatsapp")
    if not guest_phone:
        return False
    
    order_id = generate_order_id(order["id"])
    
    if order_type == "order":
        message = f"""🎉 *Payment Successful!*

Hi {order['guest_name']}, your payment for Order #{order_id} has been received!

Your order is now being prepared and will be delivered to Room {order['room_number']} shortly.

Thank you for ordering with Hidden Monkey Stays! 🐒"""
    
    elif order_type == "booking":
        message = f"""🎉 *Booking Confirmed!*

Hi {order['guest_name']}, your payment for *{order.get('experience_title', 'Experience')}* has been received!

Our team will contact you shortly to confirm the schedule.

Thank you for booking with Hidden Monkey Stays! 🐒"""
    
    else:
        return False
    
    return await send_whatsapp(guest_phone, message)

# ==================== Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Hidden Monkey Stays API"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint with connection pool status"""
    try:
        # Ping database to verify connection
        await mongodb.client.admin.command('ping')
        
        # Get server status for pool info
        server_info = await mongodb.client.server_info()
        
        return {
            "status": "healthy",
            "database": "connected",
            "mongodb_version": server_info.get("version", "unknown"),
            "pool_config": {
                "max_pool_size": 50,
                "min_pool_size": 10,
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

# Admin Auth - Simple password check (legacy)
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'hiddenmonkey2024')

# ==================== Cloudinary Upload ====================

@api_router.get("/cloudinary/signature")
async def get_cloudinary_signature(folder: str = "hidden_monkey"):
    """Generate a signature for secure client-side Cloudinary uploads"""
    if not CLOUDINARY_API_SECRET or not CLOUDINARY_API_KEY:
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    
    timestamp = int(time.time())
    
    # Parameters to sign
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "transformation": "q_auto,f_auto",  # Auto quality and format
    }
    
    # Generate signature
    signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET)
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "folder": folder,
    }

@api_router.post("/cloudinary/upload")
async def upload_to_cloudinary(request: Request):
    """Server-side upload to Cloudinary (for larger files or base64)"""
    if not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    
    try:
        data = await request.json()
        image_data = data.get("image")  # Can be URL or base64
        folder = data.get("folder", "hidden_monkey")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image provided")
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            image_data,
            folder=folder,
            transformation=[
                {"quality": "auto", "fetch_format": "auto"},
                {"width": 1200, "crop": "limit"}  # Max width 1200px
            ]
        )
        
        return {
            "success": True,
            "url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "width": result.get("width"),
            "height": result.get("height"),
        }
    except Exception as e:
        logging.error(f"Cloudinary upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/auth")
async def admin_auth(auth: AdminAuth):
    # First check if admin password was reset via OTP (stored in DB)
    admin_config = await db.admin_config.find_one({"key": "admin_password"}, {"_id": 0})
    if admin_config:
        # Use the DB stored password hash
        if verify_password(auth.password, admin_config.get("password_hash", "")):
            return {"success": True, "message": "Authentication successful", "role": "admin"}
    else:
        # Fallback to env variable password
        if auth.password == ADMIN_PASSWORD:
            return {"success": True, "message": "Authentication successful", "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid password")

# ==================== User/Staff Authentication ====================

@api_router.post("/auth/login")
async def user_login(login: UserLogin):
    """Login for admin, manager, or kitchen staff"""
    user = await db.users.find_one({"username": login.username, "is_active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Return user info without password
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "property_id": user.get("property_id"),
            "whatsapp_numbers": user.get("whatsapp_numbers", [])
        }
    }

@api_router.post("/auth/register")
async def register_user(user: UserCreate):
    """Register a new user (admin only endpoint)"""
    # Check if username exists
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user_obj = User(
        username=user.username,
        role=user.role,
        property_id=user.property_id,
        whatsapp_numbers=user.whatsapp_numbers,
        password_hash=hash_password(user.password)
    )
    doc = serialize_datetime(user_obj.model_dump())
    await db.users.insert_one(doc)
    
    return {"success": True, "user_id": user_obj.id}

@api_router.get("/users")
async def get_users(property_id: Optional[str] = None):
    """Get all users (admin only)"""
    query = {}
    if property_id:
        query["property_id"] = property_id
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    return users

@api_router.put("/users/{user_id}/password")
async def change_user_password(user_id: str, password_change: PasswordChange):
    """Change user password (admin can change any, user needs current password)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # For admin password change, verify secret key
    if user["role"] == "admin":
        if not password_change.secret_key or password_change.secret_key != ADMIN_SECRET_KEY:
            raise HTTPException(status_code=403, detail="Invalid secret key for admin password change")
    elif password_change.current_password:
        # Staff changing own password - verify current
        if not verify_password(password_change.current_password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    new_hash = hash_password(password_change.new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": new_hash}})
    
    return {"success": True, "message": "Password updated"}

# ==================== OTP Password Reset Endpoints ====================

@api_router.post("/auth/request-otp")
async def request_password_reset_otp(request: OTPRequest):
    """Request OTP for password reset - sends via WhatsApp"""
    username = request.username.strip()
    
    # Find user by username
    user = await db.users.find_one({"username": username}, {"_id": 0})
    
    # Also check if it's the admin
    is_admin = username.lower() == "admin"
    
    if not user and not is_admin:
        # Don't reveal if user exists - generic message
        raise HTTPException(status_code=404, detail="User not found. Contact admin.")
    
    # Get WhatsApp number for the user
    phone_number = None
    if is_admin:
        # For admin, get from settings (staff1 or staff2)
        settings = await db.settings.find_one({}, {"_id": 0})
        if settings:
            phone_number = settings.get("staff1_whatsapp") or settings.get("staff2_whatsapp")
    else:
        # For staff, get from their whatsapp_numbers or from property settings
        whatsapp_numbers = user.get("whatsapp_numbers", [])
        if whatsapp_numbers:
            phone_number = whatsapp_numbers[0]
        else:
            # Fallback to property settings
            property_id = user.get("property_id")
            if property_id:
                settings = await db.settings.find_one({"property_id": property_id}, {"_id": 0})
                if settings:
                    if user.get("role") == "kitchen":
                        phone_number = settings.get("staff1_whatsapp")
                    else:
                        phone_number = settings.get("staff2_whatsapp")
    
    if not phone_number:
        raise HTTPException(status_code=400, detail="No WhatsApp number configured for this user. Contact admin.")
    
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP with expiry (10 minutes)
    otp_storage[username] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
        "phone": phone_number
    }
    
    # Send OTP via WhatsApp
    success = await send_otp_whatsapp(phone_number, otp, username)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Try again later.")
    
    # Mask phone number for response
    masked_phone = phone_number[-4:].rjust(len(phone_number), '*')
    
    return {
        "success": True,
        "message": f"OTP sent to WhatsApp ending in {masked_phone[-4:]}",
        "expires_in": 600  # 10 minutes in seconds
    }

@api_router.post("/auth/verify-otp")
async def verify_otp_and_reset_password(request: OTPVerify):
    """Verify OTP and reset password"""
    username = request.username.strip()
    
    # Check if OTP exists
    if username not in otp_storage:
        raise HTTPException(status_code=400, detail="No OTP requested. Please request OTP first.")
    
    stored = otp_storage[username]
    
    # Check expiry
    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_storage[username]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Check attempts (max 3)
    if stored["attempts"] >= 3:
        del otp_storage[username]
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new OTP.")
    
    # Verify OTP
    if request.otp != stored["otp"]:
        otp_storage[username]["attempts"] += 1
        remaining = 3 - otp_storage[username]["attempts"]
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # OTP verified - update password
    is_admin = username.lower() == "admin"
    
    if is_admin:
        # Update admin password in environment (or you could store in DB)
        # For now, we'll update in a special admin_config collection
        new_hash = hash_password(request.new_password)
        await db.admin_config.update_one(
            {"key": "admin_password"},
            {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        logging.info("Admin password reset via OTP")
    else:
        # Update staff password
        new_hash = hash_password(request.new_password)
        result = await db.users.update_one(
            {"username": username},
            {"$set": {"password_hash": new_hash}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update password")
        logging.info(f"Password reset via OTP for user: {username}")
    
    # Clear OTP
    del otp_storage[username]
    
    # Send confirmation via WhatsApp
    await send_whatsapp(stored["phone"], f"✅ Password for *{username}* has been reset successfully.\n\nIf you didn't do this, contact admin immediately.")
    
    return {"success": True, "message": "Password reset successfully"}

@api_router.post("/auth/resend-otp")
async def resend_otp(request: OTPRequest):
    """Resend OTP for password reset"""
    username = request.username.strip()
    
    # Check if previous OTP exists and hasn't expired
    if username in otp_storage:
        stored = otp_storage[username]
        # Check if at least 1 minute has passed since last OTP
        time_since = datetime.now(timezone.utc) - (stored["expires"] - timedelta(minutes=10))
        if time_since < timedelta(minutes=1):
            raise HTTPException(status_code=429, detail="Please wait 1 minute before requesting new OTP")
    
    # Use the existing request-otp endpoint logic
    return await request_password_reset_otp(request)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user (admin only)"""
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user details (not password)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow password update through this endpoint
    updates.pop("password", None)
    updates.pop("password_hash", None)
    
    await db.users.update_one({"id": user_id}, {"$set": updates})
    return {"success": True}

# ==================== Property Info (Guest Landing Page Content) ====================

@api_router.get("/property-info/{property_id}")
async def get_property_info(property_id: str):
    """Get property info for guest landing page"""
    info = await db.property_info.find_one({"property_id": property_id}, {"_id": 0})
    if not info:
        # Return default info
        return PropertyInfoBase(property_id=property_id).model_dump()
    return info

@api_router.post("/property-info")
async def create_or_update_property_info(info: PropertyInfoCreate):
    """Create or update property info"""
    existing = await db.property_info.find_one({"property_id": info.property_id})
    
    if existing:
        update_data = info.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.property_info.update_one({"property_id": info.property_id}, {"$set": update_data})
    else:
        info_obj = PropertyInfo(**info.model_dump())
        doc = serialize_datetime(info_obj.model_dump())
        await db.property_info.insert_one(doc)
    
    return {"success": True}

# ==================== Experiences ====================

@api_router.get("/experiences", response_model=List[Experience])
async def get_experiences(property_id: Optional[str] = None, active_only: bool = True):
    query = {}
    if active_only:
        query["is_active"] = True
    if property_id:
        query["property_id"] = property_id
    experiences = await db.experiences.find(query, {"_id": 0}).to_list(100)
    for exp in experiences:
        deserialize_datetime(exp, ['created_at'])
    return experiences

@api_router.get("/experiences/{experience_id}", response_model=Experience)
async def get_experience(experience_id: str):
    experience = await db.experiences.find_one({"id": experience_id}, {"_id": 0})
    if not experience:
        raise HTTPException(status_code=404, detail="Experience not found")
    deserialize_datetime(experience, ['created_at'])
    return experience

@api_router.post("/experiences", response_model=Experience)
async def create_experience(experience: ExperienceCreate):
    exp_obj = Experience(**experience.model_dump())
    doc = serialize_datetime(exp_obj.model_dump())
    await db.experiences.insert_one(doc)
    return exp_obj

@api_router.put("/experiences/{experience_id}", response_model=Experience)
async def update_experience(experience_id: str, experience: ExperienceCreate):
    existing = await db.experiences.find_one({"id": experience_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    update_data = experience.model_dump()
    await db.experiences.update_one({"id": experience_id}, {"$set": update_data})
    
    updated = await db.experiences.find_one({"id": experience_id}, {"_id": 0})
    deserialize_datetime(updated, ['created_at'])
    return updated

@api_router.delete("/experiences/{experience_id}")
async def delete_experience(experience_id: str):
    result = await db.experiences.delete_one({"id": experience_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Experience not found")
    return {"success": True, "message": "Experience deleted"}

# ==================== Menu Items ====================

@api_router.get("/menu", response_model=List[MenuItem])
async def get_menu_items(property_id: Optional[str] = None, category: Optional[str] = None, available_only: bool = True):
    query = {}
    if available_only:
        query["is_available"] = True
    if category:
        query["category"] = category
    if property_id:
        query["property_id"] = property_id
    items = await db.menu_items.find(query, {"_id": 0}).to_list(200)
    for item in items:
        deserialize_datetime(item, ['created_at'])
    return items

@api_router.get("/menu/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    deserialize_datetime(item, ['created_at'])
    return item

@api_router.post("/menu", response_model=MenuItem)
async def create_menu_item(item: MenuItemCreate):
    item_obj = MenuItem(**item.model_dump())
    doc = serialize_datetime(item_obj.model_dump())
    await db.menu_items.insert_one(doc)
    return item_obj

@api_router.put("/menu/{item_id}", response_model=MenuItem)
async def update_menu_item(item_id: str, item: MenuItemCreate):
    existing = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    update_data = item.model_dump()
    await db.menu_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    deserialize_datetime(updated, ['created_at'])
    return updated

@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str):
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"success": True, "message": "Menu item deleted"}

# ==================== Category Settings ====================

def is_category_active(setting: dict) -> bool:
    """Check if a category is currently active based on timing"""
    if not setting.get("is_enabled", True):
        return False
    
    if not setting.get("use_timing", False):
        return True
    
    timing = setting.get("timing")
    if not timing:
        return True
    
    now = datetime.now(timezone.utc)
    # Convert to IST (UTC+5:30) for Indian time
    ist_offset = timedelta(hours=5, minutes=30)
    ist_time = now + ist_offset
    current_time = ist_time.strftime("%H:%M")
    
    start_time = timing.get("start_time", "00:00")
    end_time = timing.get("end_time", "23:59")
    
    # Handle overnight ranges (e.g., 22:00 to 06:00)
    if start_time <= end_time:
        return start_time <= current_time <= end_time
    else:
        return current_time >= start_time or current_time <= end_time

@api_router.get("/category-settings/{property_id}")
async def get_category_settings(property_id: str):
    """Get all category settings for a property"""
    settings = await db.category_settings.find({"property_id": property_id}, {"_id": 0}).to_list(20)
    
    # If no settings exist, create defaults
    if not settings:
        default_categories = [
            {"category": "breakfast", "timing": {"start_time": "07:00", "end_time": "11:00"}},
            {"category": "lunch", "timing": {"start_time": "12:00", "end_time": "15:00"}},
            {"category": "dinner", "timing": {"start_time": "19:00", "end_time": "23:00"}},
            {"category": "snacks", "timing": {"start_time": "00:00", "end_time": "23:59"}},
            {"category": "beverages", "timing": {"start_time": "00:00", "end_time": "23:59"}},
            {"category": "desserts", "timing": {"start_time": "00:00", "end_time": "23:59"}},
        ]
        settings = []
        for cat in default_categories:
            setting = CategorySetting(
                property_id=property_id,
                category=cat["category"],
                is_enabled=True,
                timing=CategoryTiming(**cat["timing"]),
                use_timing=cat["category"] in ["breakfast", "lunch", "dinner"]
            )
            doc = serialize_datetime(setting.model_dump())
            await db.category_settings.insert_one(doc)
            settings.append(setting.model_dump())
    
    # Add is_active status to each setting
    for s in settings:
        s["is_active"] = is_category_active(s)
        deserialize_datetime(s, ['updated_at'])
    
    return settings

@api_router.post("/category-settings")
async def save_category_setting(setting: CategorySettingCreate):
    """Create or update a category setting"""
    existing = await db.category_settings.find_one({
        "property_id": setting.property_id,
        "category": setting.category
    })
    
    setting_obj = CategorySetting(**setting.model_dump())
    doc = serialize_datetime(setting_obj.model_dump())
    
    if existing:
        await db.category_settings.update_one(
            {"property_id": setting.property_id, "category": setting.category},
            {"$set": {**doc, "id": existing["id"]}}
        )
        doc["id"] = existing["id"]
    else:
        await db.category_settings.insert_one(doc)
    
    doc["is_active"] = is_category_active(doc)
    return doc

@api_router.get("/menu-active")
async def get_active_menu_items(property_id: str):
    """Get menu items filtered by currently active categories"""
    # Get category settings
    cat_settings = await db.category_settings.find({"property_id": property_id}, {"_id": 0}).to_list(20)
    
    # Determine active categories
    active_categories = set()
    for s in cat_settings:
        if is_category_active(s):
            active_categories.add(s["category"])
    
    # If no settings, show all
    if not cat_settings:
        active_categories = {"breakfast", "lunch", "dinner", "snacks", "beverages", "desserts"}
    
    # Get menu items
    items = await db.menu_items.find({
        "property_id": property_id,
        "is_available": True
    }, {"_id": 0}).to_list(200)
    
    # Filter items based on active categories
    active_items = []
    for item in items:
        item_categories = item.get("categories", [])
        # Fallback to single category if categories list is empty
        if not item_categories:
            item_categories = [item.get("category", "")]
        
        # Check if any of the item's categories is active
        if any(cat in active_categories for cat in item_categories):
            # Set display_category to the first active category
            for cat in item_categories:
                if cat in active_categories:
                    item["display_category"] = cat
                    break
            deserialize_datetime(item, ['created_at'])
            active_items.append(item)
    
    return {
        "items": active_items,
        "active_categories": list(active_categories)
    }

# ==================== Guest Requests ====================

@api_router.post("/requests", response_model=GuestRequest)
async def create_request(request: GuestRequestCreate):
    req_obj = GuestRequest(**request.model_dump())
    req_obj.timeline = add_timeline_event([], "request_placed", f"Request submitted by {request.guest_name}")
    doc = serialize_datetime(req_obj.model_dump())
    await db.requests.insert_one(doc)
    
    # Send notifications - NEW WORKFLOW: Goes to Staff2 (Manager)
    settings = await db.settings.find_one({"property_id": request.property_id}, {"_id": 0})
    if settings:
        # 1. Notify Staff2 (Manager)
        result = await notify_staff2_new_request(doc, settings)
        if result.get("success"):
            update_data = {
                "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "staff2_notified", "details": "Manager notified via WhatsApp"}}
            }
            if result.get("sid"):
                update_data["$set"] = {"notification_sid": result["sid"]}
            await db.requests.update_one({"id": req_obj.id}, update_data)
        
        # 2. Notify Guest that request is received
        await notify_guest_request_received(doc, settings)
        await db.requests.update_one(
            {"id": req_obj.id},
            {"$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "guest_notified", "details": "Confirmation sent to guest"}}}
        )
        
        await send_email_notification(doc, settings, "request", "new")
    
    return req_obj

@api_router.get("/requests", response_model=List[GuestRequest])
async def get_requests(property_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if property_id:
        query["property_id"] = property_id
    if status:
        query["status"] = status
    requests = await db.requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for req in requests:
        deserialize_datetime(req, ['created_at'])
    return requests

@api_router.put("/requests/{request_id}/status")
async def update_request_status(request_id: str, status: str = Query(...)):
    # Get the request first
    request_doc = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get settings for notifications
    settings = await db.settings.find_one({"property_id": request_doc.get("property_id")}, {"_id": 0})
    
    # Update status and timeline
    timeline_event = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": f"status_{status}", "details": f"Status changed to {status}"}
    
    await db.requests.update_one(
        {"id": request_id}, 
        {"$set": {"status": status}, "$push": {"timeline": timeline_event}}
    )
    
    # Send notifications based on status - NEW WORKFLOW
    if settings:
        if status == "approved" or status == "acknowledged":
            # Staff2 acknowledged the request - notify guest
            await notify_guest_request_acknowledged(request_doc, settings)
            await db.requests.update_one(
                {"id": request_id},
                {"$set": {"status": "in_progress"}, "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "acknowledged", "details": "Request acknowledged by staff"}}}
            )
        elif status == "resolved" or status == "completed":
            # Staff2 resolved the request - notify guest
            await notify_guest_request_resolved(request_doc, settings)
            await send_email_notification(request_doc, settings, "request", "completed")
        elif status == "rejected":
            await notify_guest_rejected(request_doc, settings, "request")
            await send_email_notification(request_doc, settings, "request", "rejected")
    
    return {"success": True, "message": "Status updated"}

# ==================== Experience Bookings ====================

@api_router.post("/bookings", response_model=ExperienceBooking)
async def create_booking(booking: ExperienceBookingCreate):
    # Get experience price for the booking
    experience = await db.experiences.find_one({"id": booking.experience_id}, {"_id": 0})
    
    booking_obj = ExperienceBooking(**booking.model_dump())
    booking_obj.timeline = add_timeline_event([], "booking_placed", f"Booking submitted by {booking.guest_name}")
    doc = serialize_datetime(booking_obj.model_dump())
    
    # Add experience price to doc for payment link
    if experience:
        doc["experience_price"] = experience.get("price", "0")
    
    await db.bookings.insert_one(doc)
    
    # Send notifications - NEW WORKFLOW: Goes to Staff2 (Manager) first
    settings = await db.settings.find_one({"property_id": booking.property_id}, {"_id": 0})
    if settings:
        # 1. Notify Staff2 (Manager) to check and approve/reject
        result = await notify_staff2_new_booking(doc, settings)
        if result.get("success"):
            update_data = {
                "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "staff2_notified", "details": "Manager notified via WhatsApp"}}
            }
            if result.get("sid"):
                update_data["$set"] = {"notification_sid": result["sid"]}
            await db.bookings.update_one({"id": booking_obj.id}, update_data)
        
        # 2. Notify Guest that booking is received, team will connect
        await notify_guest_booking_received(doc, settings)
        await db.bookings.update_one(
            {"id": booking_obj.id},
            {"$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "guest_notified", "details": "Confirmation sent to guest"}}}
        )
        
        await send_email_notification(doc, settings, "booking", "new")
    
    return booking_obj

@api_router.get("/bookings", response_model=List[ExperienceBooking])
async def get_bookings(property_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if property_id:
        query["property_id"] = property_id
    if status:
        query["status"] = status
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for booking in bookings:
        deserialize_datetime(booking, ['created_at'])
    return bookings

@api_router.put("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str = Query(...)):
    # Get the booking first
    booking_doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking_doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get settings for notifications
    settings = await db.settings.find_one({"property_id": booking_doc.get("property_id")}, {"_id": 0})
    
    # Update status and timeline
    timeline_event = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": f"status_{status}", "details": f"Status changed to {status}"}
    
    await db.bookings.update_one(
        {"id": booking_id}, 
        {"$set": {"status": status}, "$push": {"timeline": timeline_event}}
    )
    
    # Send notifications based on status - NEW WORKFLOW
    if settings:
        if status == "approved":
            # Create Razorpay payment link and send to guest with new message
            payment_link = await create_razorpay_payment_link(booking_doc, settings, "booking")
            if payment_link and payment_link.get("short_url"):
                await notify_guest_booking_approved_with_payment(booking_doc, settings, payment_link["short_url"])
                await db.bookings.update_one(
                    {"id": booking_id},
                    {"$set": {"payment_link": payment_link["short_url"], "payment_link_id": payment_link.get("id")},
                     "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "payment_link_sent", "details": "Payment link sent to guest"}}}
                )
            else:
                # Fallback if Razorpay not configured
                await notify_guest_approved(booking_doc, settings, "booking")
            await send_email_notification(booking_doc, settings, "booking", "approved")
        elif status == "rejected":
            await notify_guest_rejected(booking_doc, settings, "booking")
            await send_email_notification(booking_doc, settings, "booking", "rejected")
        elif status == "scheduled":
            # Staff2 has scheduled the experience - notify guest
            guest_phone = booking_doc.get("whatsapp")
            if guest_phone:
                order_id = generate_order_id(booking_doc["id"])
                await send_whatsapp(guest_phone, f"""📅 *Experience Scheduled!*

Hi {booking_doc['guest_name']}, your *{booking_doc.get('experience_title', 'experience')}* has been scheduled!

*Booking ID:* #{order_id}

Our team will share the details with you. Get ready for an amazing experience! 🐒""")
    
    return {"success": True, "message": "Status updated"}

# ==================== Food Orders ====================

@api_router.post("/orders", response_model=FoodOrder)
async def create_order(order: FoodOrderCreate):
    logging.info(f"=== CREATE_ORDER CALLED === property: {order.property_id}")
    
    order_obj = FoodOrder(**order.model_dump())
    order_obj.timeline = add_timeline_event([], "order_placed", f"Order submitted by {order.guest_name}")
    doc = serialize_datetime(order_obj.model_dump())
    await db.orders.insert_one(doc)
    
    # Send notifications
    settings = await db.settings.find_one({"property_id": order.property_id}, {"_id": 0})
    
    if settings:
        result = await notify_staff1_new_order(doc, settings, "order")
        if result.get("success"):
            # Store the message SID for reply tracking
            update_data = {
                "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "staff1_notified", "details": "Manager notified via WhatsApp"}}
            }
            if result.get("sid"):
                update_data["$set"] = {"notification_sid": result["sid"]}
            await db.orders.update_one({"id": order_obj.id}, update_data)
        await send_email_notification(doc, settings, "order", "new")
    else:
        logger.warning(f"No settings found for property {order.property_id}")
    
    return order_obj

@api_router.get("/orders", response_model=List[FoodOrder])
async def get_orders(property_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if property_id:
        query["property_id"] = property_id
    if status:
        query["status"] = status
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for order in orders:
        deserialize_datetime(order, ['created_at'])
    return orders

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str = Query(...)):
    # Get the order first
    order_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get settings for notifications
    settings = await db.settings.find_one({"property_id": order_doc.get("property_id")}, {"_id": 0})
    
    # Update status and timeline
    timeline_event = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": f"status_{status}", "details": f"Status changed to {status}"}
    
    await db.orders.update_one(
        {"id": order_id}, 
        {"$set": {"status": status}, "$push": {"timeline": timeline_event}}
    )
    
    # Send notifications based on status
    if settings:
        if status == "approved":
            # Create Razorpay payment link and send to guest
            payment_link = await create_razorpay_payment_link(order_doc, settings, "order")
            if payment_link and payment_link.get("short_url"):
                await notify_guest_payment_link(order_doc, settings, payment_link["short_url"], "order")
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"payment_link": payment_link["short_url"], "payment_link_id": payment_link.get("id")},
                     "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "payment_link_sent", "details": "Payment link sent to guest"}}}
                )
            else:
                # Fallback if Razorpay not configured - use old flow with UPI
                await notify_guest_approved(order_doc, settings, "order")
                await notify_staff2_approved(order_doc, settings, "order")
            await send_email_notification(order_doc, settings, "order", "approved")
        elif status == "rejected":
            await notify_staff2_rejected(order_doc, settings, "order")
            await notify_guest_rejected(order_doc, settings, "order")
            await send_email_notification(order_doc, settings, "order", "rejected")
    
    return {"success": True, "message": "Status updated"}

# ==================== Twilio Webhook for WhatsApp Replies ====================

@api_router.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    """Handle incoming WhatsApp messages from staff with signature verification"""
    # Get signature from header
    twilio_signature = request.headers.get("X-Twilio-Signature", "")
    
    # Get the raw body for signature verification
    body_bytes = await request.body()
    
    # Parse form data
    from urllib.parse import parse_qs
    form_dict = parse_qs(body_bytes.decode('utf-8'))
    params = {k: v[0] if len(v) == 1 else v for k, v in form_dict.items()}
    
    # Construct request URL for validation
    backend_url = os.environ.get('BACKEND_URL', '')
    request_url = f"{backend_url}/api/webhook/whatsapp"
    
    # Verify Twilio signature (MUST pass before processing)
    if TWILIO_AUTH_TOKEN:
        if not verify_twilio_signature(request_url, params, twilio_signature, TWILIO_AUTH_TOKEN):
            logging.warning(f"Twilio webhook signature verification failed. URL: {request_url}")
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid Twilio signature")
    else:
        logging.warning("Twilio webhook received but TWILIO_AUTH_TOKEN not configured - skipping signature verification")
    
    try:
        # Extract form data
        from_number = params.get("From", "").replace("whatsapp:", "")
        body = params.get("Body", "").strip()
        body_lower = body.lower()
        
        # Check for reply context - this tells us which message staff replied to
        original_message_sid = params.get("OriginalRepliedMessageSid")
        
        logging.info(f"WhatsApp webhook received from {from_number}: {body}, reply_to: {original_message_sid}")
        
        # Parse order ID and action from message
        # Format: "ORDER_ID ACTION" e.g., "A1B2C3D4 1" or just "1" for most recent
        parts = body.upper().split()
        order_code = None
        action_text = body_lower
        
        if len(parts) >= 2:
            # First part might be order code, second is action
            potential_code = parts[0]
            if len(potential_code) == 8 and potential_code.isalnum():
                order_code = potential_code
                action_text = parts[1].lower()
        elif len(parts) == 1:
            # Could be just action or order code
            if parts[0].isalnum() and len(parts[0]) == 8:
                # Looks like order code alone - ask for action
                await send_whatsapp(from_number, f"Please include action: {parts[0]} 1 (accept), {parts[0]} 2 (reject), or {parts[0]} 3 (delivered)")
                return {"status": "need_action", "message": "Order code received, need action"}
            action_text = parts[0].lower()
        
        # Determine action (1/accept = approve, 2/reject = reject, 3/done/delivered = delivered)
        if action_text in ["1", "accept", "yes", "approve", "a", "y"]:
            action = "approved"
        elif action_text in ["2", "reject", "no", "decline", "r", "n"]:
            action = "rejected"
        elif action_text in ["3", "done", "delivered", "complete", "d"]:
            action = "delivered"
        else:
            # Unknown command - send help
            logging.info(f"Unknown command from {from_number}: {body}")
            await send_whatsapp(from_number, "↩️ Reply to the order message with:\n\n*1* = Accept\n*2* = Reject\n*3* = Delivered")
            return {"status": "ignored", "message": "Unknown command"}
        
        # Find the most recent pending order/booking/request for this staff member
        # Check which property this staff belongs to
        clean_number = ''.join(filter(str.isdigit, from_number))
        
        # Find settings where this number is staff1
        settings = await db.settings.find_one({
            "$or": [
                {"staff1_whatsapp": {"$regex": clean_number[-10:]}},
                {"staff_whatsapp": {"$regex": clean_number[-10:]}}
            ]
        }, {"_id": 0})
        
        if not settings:
            logging.warning(f"No settings found for staff number {from_number}")
            return {"status": "error", "message": "Staff not found"}
        
        property_id = settings.get("property_id")
        
        item_doc = None
        item_type = None
        collection = None
        
        # PRIORITY 1: If staff replied to a specific message, find order by notification_sid
        if original_message_sid:
            logging.info(f"Looking up order by notification_sid: {original_message_sid}")
            
            # Check orders
            item_doc = await db.orders.find_one({"notification_sid": original_message_sid}, {"_id": 0})
            if item_doc:
                item_type = "order"
                collection = db.orders
            
            # Check bookings
            if not item_doc:
                item_doc = await db.bookings.find_one({"notification_sid": original_message_sid}, {"_id": 0})
                if item_doc:
                    item_type = "booking"
                    collection = db.bookings
            
            # Check requests
            if not item_doc:
                item_doc = await db.requests.find_one({"notification_sid": original_message_sid}, {"_id": 0})
                if item_doc:
                    item_type = "request"
                    collection = db.requests
            
            if item_doc:
                logging.info(f"Found {item_type} {item_doc['id']} by reply context")
        
        # PRIORITY 2: If order code provided, find that specific order
        if not item_doc and order_code:
            # Search for order with matching short ID
            
            # Check orders
            all_orders = await db.orders.find({"property_id": property_id}, {"_id": 0}).to_list(100)
            for o in all_orders:
                if o["id"][:8].upper() == order_code:
                    item_doc = o
                    item_type = "order"
                    collection = db.orders
                    break
            
            # Check bookings
            if not item_doc:
                all_bookings = await db.bookings.find({"property_id": property_id}, {"_id": 0}).to_list(100)
                for b in all_bookings:
                    if b["id"][:8].upper() == order_code:
                        item_doc = b
                        item_type = "booking"
                        collection = db.bookings
                        break
            
            # Check requests
            if not item_doc:
                all_requests = await db.requests.find({"property_id": property_id}, {"_id": 0}).to_list(100)
                for r in all_requests:
                    if r["id"][:8].upper() == order_code:
                        item_doc = r
                        item_type = "request"
                        collection = db.requests
                        break
            
            if not item_doc:
                await send_whatsapp(from_number, f"❌ Order #{order_code} not found. Please check the order ID.")
                return {"status": "not_found", "message": f"Order {order_code} not found"}
        
        # PRIORITY 3: Fall back to most recent pending item
        if not item_doc:
            # Find the most recent pending item (order, booking, or request) - legacy behavior
            # For "delivered" action, look for "paid" or "approved" status
            if action == "delivered":
                status_filter = {"$in": ["paid", "approved", "preparing"]}
            else:
                status_filter = "pending"
            
            pending_order = await db.orders.find_one(
                {"property_id": property_id, "status": status_filter},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            pending_booking = await db.bookings.find_one(
                {"property_id": property_id, "status": status_filter if action != "delivered" else {"$in": ["paid", "approved"]}},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            pending_request = await db.requests.find_one(
                {"property_id": property_id, "status": status_filter if action != "delivered" else "approved"},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            
            # Find the most recent one
            items = []
            if pending_order:
                items.append(("order", pending_order, db.orders))
            if pending_booking:
                items.append(("booking", pending_booking, db.bookings))
            if pending_request:
                items.append(("request", pending_request, db.requests))
            
            if not items:
                logging.info(f"No items found for property {property_id} with status for action {action}")
                await send_whatsapp(from_number, f"No {'pending' if action != 'delivered' else 'active'} orders found.")
                return {"status": "no_pending", "message": "No items found"}
            
            # Sort by created_at and get the most recent
            items.sort(key=lambda x: x[1].get("created_at", ""), reverse=True)
            item_type, item_doc, collection = items[0]
        
        # Update status
        timeline_event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": f"staff1_{action}",
            "details": f"Staff 1 {action} via WhatsApp"
        }
        
        await collection.update_one(
            {"id": item_doc["id"]},
            {"$set": {"status": action}, "$push": {"timeline": timeline_event}}
        )
        
        # Send notifications based on action
        if action == "approved":
            # For orders and bookings, create payment link
            if item_type in ["order", "booking"]:
                payment_link = await create_razorpay_payment_link(item_doc, settings, item_type)
                if payment_link and payment_link.get("short_url"):
                    await notify_guest_payment_link(item_doc, settings, payment_link["short_url"], item_type)
                    await collection.update_one(
                        {"id": item_doc["id"]},
                        {"$set": {"payment_link": payment_link["short_url"], "payment_link_id": payment_link.get("id")},
                         "$push": {"timeline": {"timestamp": datetime.now(timezone.utc).isoformat(), "event": "payment_link_sent", "details": "Payment link sent to guest"}}}
                    )
                else:
                    # Fallback if Razorpay not configured
                    await notify_guest_approved(item_doc, settings, item_type)
                    await notify_staff2_approved(item_doc, settings, item_type)
            else:
                # For requests, no payment needed
                await notify_staff2_approved(item_doc, settings, item_type)
                await notify_guest_approved(item_doc, settings, item_type)
            await send_email_notification(item_doc, settings, item_type, "approved")
        elif action == "rejected":
            await notify_staff2_rejected(item_doc, settings, item_type)
            await notify_guest_rejected(item_doc, settings, item_type)
            await send_email_notification(item_doc, settings, item_type, "rejected")
        elif action == "delivered":
            # Notify guest and staff2 that order is delivered
            await notify_guest_delivered(item_doc, settings, item_type)
            await notify_staff2_delivered(item_doc, settings, item_type)
            await send_email_notification(item_doc, settings, item_type, "delivered")
        
        # Send confirmation to staff1
        order_id = generate_order_id(item_doc["id"])
        confirm_msg = f"✅ {item_type.title()} #{order_id} marked as {action.upper()}. Notifications sent."
        await send_whatsapp(from_number, confirm_msg)
        
        logging.info(f"Processed {action} for {item_type} {item_doc['id']} via WhatsApp")
        return {"status": "success", "action": action, "item_type": item_type, "item_id": item_doc["id"]}
        
    except Exception as e:
        logging.error(f"WhatsApp webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== Razorpay Webhook for Payment Confirmation ====================

@api_router.get("/webhook/razorpay")
async def razorpay_webhook_get(request: Request, order_id: str = None, order_type: str = "order"):
    """Handle Razorpay payment callback (redirect after payment)"""
    try:
        # Get query params
        params = dict(request.query_params)
        razorpay_payment_id = params.get("razorpay_payment_id")
        razorpay_payment_link_status = params.get("razorpay_payment_link_status")
        
        logging.info(f"Razorpay callback: order_id={order_id}, type={order_type}, status={razorpay_payment_link_status}, payment_id={razorpay_payment_id}")
        
        if razorpay_payment_link_status != "paid":
            # Payment not completed
            return HTMLResponse(content="""
                <html>
                <head><title>Payment Pending</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>⏳ Payment Pending</h1>
                    <p>Your payment is being processed. Please wait or try again.</p>
                </body>
                </html>
            """)
        
        # Find the order/booking
        if order_type == "order":
            collection = db.orders
        elif order_type == "booking":
            collection = db.bookings
        else:
            return HTMLResponse(content="Invalid order type", status_code=400)
        
        item_doc = await collection.find_one({"id": order_id}, {"_id": 0})
        if not item_doc:
            return HTMLResponse(content="Order not found", status_code=404)
        
        # Get payment amount from Razorpay
        amount = 0
        if razorpay_client and razorpay_payment_id:
            try:
                payment = razorpay_client.payment.fetch(razorpay_payment_id)
                amount = payment.get("amount", 0) / 100  # Convert from paise
            except Exception:
                amount = item_doc.get("total", 0)
        else:
            amount = item_doc.get("total", 0)
        
        # Update order status to paid
        timeline_event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "payment_received",
            "details": f"Payment of ₹{amount} received via Razorpay (ID: {razorpay_payment_id})"
        }
        
        await collection.update_one(
            {"id": order_id},
            {"$set": {"status": "paid", "payment_id": razorpay_payment_id, "amount_paid": amount},
             "$push": {"timeline": timeline_event}}
        )
        
        # Get settings and send notifications
        settings = await db.settings.find_one({"property_id": item_doc.get("property_id")}, {"_id": 0})
        if settings:
            # Notify Staff 1 to start cooking/preparing - store SID for reply tracking
            result = await notify_payment_success_staff1(item_doc, settings, order_type, amount)
            if result.get("sid"):
                await collection.update_one(
                    {"id": order_id},
                    {"$set": {"notification_sid": result["sid"]}}  # Update to latest message SID
                )
            # Notify Staff 2 for records
            await notify_payment_success_staff2(item_doc, settings, order_type, amount)
            # Notify Guest
            await notify_guest_payment_success(item_doc, settings, order_type)
            # Email notification
            await send_email_notification(item_doc, settings, order_type, "paid")
        
        # Return success page
        order_short_id = generate_order_id(order_id)
        return HTMLResponse(content=f"""
            <html>
            <head>
                <title>Payment Successful</title>
                <style>
                    body {{ font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; background: #F9F7F2; }}
                    .container {{ max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }}
                    h1 {{ color: #2A9D8F; }}
                    .amount {{ font-size: 2em; color: #264653; margin: 20px 0; }}
                    .order-id {{ color: #6B705C; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 Payment Successful!</h1>
                    <p class="order-id">Order #{order_short_id}</p>
                    <p class="amount">₹{amount}</p>
                    <p>Your {"order is being prepared" if order_type == "order" else "booking is confirmed"}!</p>
                    <p>You'll receive a WhatsApp confirmation shortly.</p>
                    <br>
                    <p style="color: #6B705C;">Thank you for staying with Hidden Monkey Stays! 🐒</p>
                </div>
            </body>
            </html>
        """)
        
    except Exception as e:
        logging.error(f"Razorpay webhook error: {e}")
        return HTMLResponse(content=f"Error processing payment: {str(e)}", status_code=500)

@api_router.post("/webhook/razorpay")
async def razorpay_webhook_post(request: Request):
    """Handle Razorpay webhook (server-to-server notification) with signature verification"""
    # Get signature from header
    razorpay_signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Get raw body for signature verification
    payload_body = await request.body()
    
    # Verify Razorpay signature (MUST pass before processing)
    if RAZORPAY_KEY_SECRET:
        if not verify_razorpay_signature(payload_body, razorpay_signature, RAZORPAY_KEY_SECRET):
            logging.warning(f"Razorpay webhook signature verification failed")
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid Razorpay signature")
    else:
        logging.warning("Razorpay webhook received but RAZORPAY_KEY_SECRET not configured - skipping signature verification")
    
    try:
        # Parse JSON payload
        import json
        payload = json.loads(payload_body.decode('utf-8'))
        event = payload.get("event")
        
        logging.info(f"Razorpay webhook POST (verified): event={event}")
        
        if event == "payment_link.paid":
            payment_link = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
            notes = payment_link.get("notes", {})
            
            order_id = notes.get("order_id")
            order_type = notes.get("order_type", "order")
            amount = payment_link.get("amount_paid", 0) / 100
            
            if not order_id:
                return {"status": "error", "message": "No order_id in notes"}
            
            # Find the order/booking
            if order_type == "order":
                collection = db.orders
            elif order_type == "booking":
                collection = db.bookings
            else:
                return {"status": "error", "message": "Invalid order type"}
            
            item_doc = await collection.find_one({"id": order_id}, {"_id": 0})
            if not item_doc:
                return {"status": "error", "message": "Order not found"}
            
            # Check if already processed
            if item_doc.get("status") == "paid":
                return {"status": "already_processed"}
            
            # Update order status
            timeline_event = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": "payment_received",
                "details": f"Payment of ₹{amount} received via Razorpay webhook"
            }
            
            await collection.update_one(
                {"id": order_id},
                {"$set": {"status": "paid", "amount_paid": amount},
                 "$push": {"timeline": timeline_event}}
            )
            
            # Send notifications - Use NEW booking notifications for booking type
            settings = await db.settings.find_one({"property_id": item_doc.get("property_id")}, {"_id": 0})
            if settings:
                if order_type == "booking":
                    # Use new booking payment notifications
                    await notify_booking_payment_confirmed_staff2(item_doc, settings, amount)
                    await notify_booking_payment_confirmed_guest(item_doc, settings, amount)
                else:
                    # Use existing notifications for orders
                    await notify_payment_success_staff1(item_doc, settings, order_type, amount)
                    await notify_payment_success_staff2(item_doc, settings, order_type, amount)
                    await notify_guest_payment_success(item_doc, settings, order_type)
            
            return {"status": "success", "order_id": order_id}
        
        return {"status": "ignored", "event": event}
        
    except Exception as e:
        logging.error(f"Razorpay webhook POST error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== Settings ====================

@api_router.get("/settings")
async def get_all_settings():
    """Get all property settings"""
    settings_list = await db.settings.find({}, {"_id": 0}).to_list(100)
    for s in settings_list:
        deserialize_datetime(s, ['updated_at'])
    return settings_list

@api_router.get("/settings/{property_id}", response_model=Settings)
async def get_settings(property_id: str):
    settings = await db.settings.find_one({"property_id": property_id}, {"_id": 0})
    if not settings:
        # Return default settings
        return Settings(
            property_id=property_id,
            property_name="Hidden Monkey Stays",
            staff_whatsapp="",
            currency="INR"
        )
    deserialize_datetime(settings, ['updated_at'])
    return settings

@api_router.post("/settings", response_model=Settings)
async def save_settings(settings: SettingsCreate):
    existing = await db.settings.find_one({"property_id": settings.property_id})
    
    settings_obj = Settings(**settings.model_dump())
    doc = serialize_datetime(settings_obj.model_dump())
    
    if existing:
        await db.settings.update_one(
            {"property_id": settings.property_id},
            {"$set": doc}
        )
    else:
        await db.settings.insert_one(doc)
    
    return settings_obj

# ==================== QR Code Generation ====================

@api_router.get("/qr/{property_slug}")
async def generate_qr_code(property_slug: str, base_url: Optional[str] = None):
    """Generate QR code for a property URL"""
    # Use provided base_url or get from environment
    if not base_url:
        backend_url = os.environ.get('BACKEND_URL')
        if not backend_url:
            raise HTTPException(status_code=500, detail="BACKEND_URL not configured")
        # Remove /api if present and use the base
        base_url = backend_url.replace('/api', '')
    
    # Generate the property URL
    property_url = f"{base_url}/{property_slug}"
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(property_url)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to bytes buffer
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={property_slug}_qr.png"}
    )

@api_router.get("/qr-codes")
async def get_all_qr_codes():
    """Get QR code URLs for all properties"""
    settings_list = await db.settings.find({}, {"_id": 0, "property_id": 1, "property_slug": 1, "property_name": 1}).to_list(100)
    
    backend_url = os.environ.get('BACKEND_URL')
    if not backend_url:
        raise HTTPException(status_code=500, detail="BACKEND_URL not configured")
    base_url = backend_url.replace('/api', '')
    
    qr_codes = []
    for s in settings_list:
        slug = s.get('property_slug', '')
        if slug:
            qr_codes.append({
                "property_id": s.get('property_id'),
                "property_name": s.get('property_name', 'Unknown'),
                "property_slug": slug,
                "property_url": f"{base_url}/{slug}",
                "qr_url": f"{backend_url}/api/qr/{slug}"
            })
    
    return qr_codes

# ==================== Admin Logs (Combined View) ====================

@api_router.get("/logs")
async def get_all_logs(property_id: Optional[str] = None, limit: int = 50):
    query = {}
    if property_id:
        query["property_id"] = property_id
    
    # Fetch all types of submissions
    requests = await db.requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Add type field and deserialize
    for req in requests:
        req["type"] = "request"
        deserialize_datetime(req, ['created_at'])
    for booking in bookings:
        booking["type"] = "booking"
        deserialize_datetime(booking, ['created_at'])
    for order in orders:
        order["type"] = "order"
        deserialize_datetime(order, ['created_at'])
    
    # Combine and sort by created_at
    all_logs = requests + bookings + orders
    all_logs.sort(key=lambda x: x['created_at'], reverse=True)
    
    return all_logs[:limit]

# ==================== Reports ====================

@api_router.get("/reports/monthly")
async def get_monthly_report(
    property_id: str = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020)
):
    """Get monthly report for a property - all data"""
    from calendar import monthrange
    
    # Calculate date range for the month
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    last_day = monthrange(year, month)[1]
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Fetch all data for the month
    query = {
        "property_id": property_id,
        "created_at": {"$gte": start_str, "$lte": end_str}
    }
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(1000)
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    requests = await db.requests.find(query, {"_id": 0}).to_list(1000)
    
    # Get property info
    settings = await db.settings.find_one({"property_id": property_id}, {"_id": 0})
    property_name = settings.get("property_name", property_id) if settings else property_id
    
    # Calculate stats
    total_orders = len(orders)
    total_bookings = len(bookings)
    total_requests = len(requests)
    
    # Order stats by status
    order_stats = {
        "pending": len([o for o in orders if o.get("status") == "pending"]),
        "approved": len([o for o in orders if o.get("status") == "approved"]),
        "paid": len([o for o in orders if o.get("status") == "paid"]),
        "preparing": len([o for o in orders if o.get("status") == "preparing"]),
        "delivered": len([o for o in orders if o.get("status") == "delivered"]),
        "rejected": len([o for o in orders if o.get("status") == "rejected"]),
    }
    
    # Booking stats
    booking_stats = {
        "pending": len([b for b in bookings if b.get("status") == "pending"]),
        "approved": len([b for b in bookings if b.get("status") == "approved"]),
        "completed": len([b for b in bookings if b.get("status") == "completed"]),
        "rejected": len([b for b in bookings if b.get("status") == "rejected"]),
    }
    
    # Request stats
    request_stats = {
        "pending": len([r for r in requests if r.get("status") == "pending"]),
        "in_progress": len([r for r in requests if r.get("status") == "in_progress"]),
        "completed": len([r for r in requests if r.get("status") == "completed"]),
        "rejected": len([r for r in requests if r.get("status") == "rejected"]),
    }
    
    return {
        "property_id": property_id,
        "property_name": property_name,
        "month": month,
        "year": year,
        "period": f"{start_date.strftime('%B %Y')}",
        "summary": {
            "total_orders": total_orders,
            "total_bookings": total_bookings,
            "total_requests": total_requests,
        },
        "order_stats": order_stats,
        "booking_stats": booking_stats,
        "request_stats": request_stats,
        "orders": orders,
        "bookings": bookings,
        "requests": requests,
    }

@api_router.get("/reports/sales")
async def get_sales_report(
    property_id: str = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020)
):
    """Get actual sales report - only paid/delivered orders"""
    from calendar import monthrange
    
    # Calculate date range
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    last_day = monthrange(year, month)[1]
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Get property info
    settings = await db.settings.find_one({"property_id": property_id}, {"_id": 0})
    property_name = settings.get("property_name", property_id) if settings else property_id
    
    # Fetch only paid/delivered orders (actual sales)
    paid_statuses = ["paid", "preparing", "delivered"]
    orders = await db.orders.find({
        "property_id": property_id,
        "created_at": {"$gte": start_str, "$lte": end_str},
        "status": {"$in": paid_statuses}
    }, {"_id": 0}).to_list(1000)
    
    # Fetch approved/completed bookings
    bookings = await db.bookings.find({
        "property_id": property_id,
        "created_at": {"$gte": start_str, "$lte": end_str},
        "status": {"$in": ["approved", "completed"]}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate revenue
    total_food_revenue = sum(o.get("total", 0) for o in orders)
    
    # Parse booking prices (they might be strings like "₹500")
    def parse_price(price_str):
        if not price_str:
            return 0
        try:
            return float(''.join(filter(lambda x: x.isdigit() or x == '.', str(price_str))))
        except:
            return 0
    
    total_experience_revenue = sum(parse_price(b.get("experience_price")) for b in bookings)
    total_revenue = total_food_revenue + total_experience_revenue
    
    # Daily breakdown
    daily_sales = {}
    for order in orders:
        date_str = order.get("created_at", "")[:10]
        if date_str not in daily_sales:
            daily_sales[date_str] = {"food": 0, "experiences": 0, "count": 0}
        daily_sales[date_str]["food"] += order.get("total", 0)
        daily_sales[date_str]["count"] += 1
    
    for booking in bookings:
        date_str = booking.get("created_at", "")[:10]
        if date_str not in daily_sales:
            daily_sales[date_str] = {"food": 0, "experiences": 0, "count": 0}
        daily_sales[date_str]["experiences"] += parse_price(booking.get("experience_price"))
        daily_sales[date_str]["count"] += 1
    
    # Top selling items (aggregated)
    item_sales = {}
    for order in orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            price = item.get("price", 0)
            if name not in item_sales:
                item_sales[name] = {"quantity": 0, "revenue": 0, "price": price}
            item_sales[name]["quantity"] += qty
            item_sales[name]["revenue"] += qty * price
    
    top_items = sorted(item_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)[:10]
    top_3_items = sorted(item_sales.items(), key=lambda x: x[1]["quantity"], reverse=True)[:3]
    
    # Unit-level item entries - one row per unit sold
    unit_items = []
    for order in orders:
        order_id = order.get("id", "")[:8].upper()
        order_date = order.get("created_at", "")[:10]
        guest_name = order.get("guest_name", "")
        room_number = order.get("room_number", "")
        
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            price = item.get("price", 0)
            
            # Create one entry per unit
            for unit_num in range(1, qty + 1):
                unit_items.append({
                    "order_id": order_id,
                    "date": order_date,
                    "guest_name": guest_name,
                    "room_number": room_number,
                    "item_name": name,
                    "unit_number": unit_num,
                    "quantity_in_order": qty,
                    "unit_price": price,
                })
    
    # Calculate total units sold
    total_units_sold = len(unit_items)
    
    return {
        "property_id": property_id,
        "property_name": property_name,
        "month": month,
        "year": year,
        "period": f"{start_date.strftime('%B %Y')}",
        "revenue": {
            "food_orders": total_food_revenue,
            "experiences": total_experience_revenue,
            "total": total_revenue,
        },
        "counts": {
            "paid_orders": len(orders),
            "completed_bookings": len(bookings),
            "total_units_sold": total_units_sold,
        },
        "daily_breakdown": [
            {"date": k, **v} for k, v in sorted(daily_sales.items())
        ],
        "top_selling_items": [
            {"name": name, **data} for name, data in top_items
        ],
        "top_3_items": [
            {"name": name, "quantity": data["quantity"], "revenue": data["revenue"]} for name, data in top_3_items
        ],
        "unit_items": unit_items,
        "orders": orders,
        "bookings": bookings,
    }

# ==================== Seed Data ====================

@api_router.post("/seed")
async def seed_data(property_id: str = "varanasi"):
    """Seed initial data for a property"""
    
    # Check if data already exists for this property
    exp_count = await db.experiences.count_documents({"property_id": property_id})
    menu_count = await db.menu_items.count_documents({"property_id": property_id})
    
    if exp_count > 0 and menu_count > 0:
        return {"message": f"Data already seeded for property: {property_id}"}
    
    # Seed Experiences for this property
    experiences = [
        {
            "id": str(uuid.uuid4()),
            "title": "Morning Yoga Session",
            "description": "Start your day with a rejuvenating yoga session overlooking the Ganges. Our certified instructor will guide you through traditional asanas and breathing exercises.",
            "category": "wellness",
            "image_url": "https://images.unsplash.com/photo-1583635658408-1f93b11d7941?crop=entropy&cs=srgb&fm=jpg&q=85",
            "brochure_url": "https://example.com/yoga-brochure.pdf",
            "duration": "1.5 hours",
            "price": "₹500",
            "is_active": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Heritage Walking Tour",
            "description": "Explore the ancient streets and hidden gems of the city with our expert local guide. Discover centuries-old temples, bustling markets, and authentic local life.",
            "category": "culture",
            "image_url": "https://images.pexels.com/photos/6761094/pexels-photo-6761094.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "brochure_url": "https://example.com/heritage-tour.pdf",
            "duration": "3 hours",
            "price": "₹800",
            "is_active": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Sunrise Boat Ride",
            "description": "Experience the magical sunrise over the ghats from a traditional wooden boat. Witness the morning rituals and the city coming alive.",
            "category": "adventure",
            "image_url": "https://images.unsplash.com/photo-1590091014590-70dfccb5295e?crop=entropy&cs=srgb&fm=jpg&q=85",
            "brochure_url": "",
            "duration": "2 hours",
            "price": "₹600",
            "is_active": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Seed Menu Items for this property
    menu_items = [
        {
            "id": str(uuid.uuid4()),
            "name": "Masala Chai",
            "description": "Traditional Indian spiced tea brewed with fresh ginger and cardamom",
            "category": "beverages",
            "price": 50,
            "image_url": "https://images.pexels.com/photos/5946630/pexels-photo-5946630.jpeg?auto=compress&cs=tinysrgb&w=600",
            "is_available": True,
            "is_vegetarian": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Aloo Paratha",
            "description": "Stuffed potato flatbread served with curd and pickle",
            "category": "breakfast",
            "price": 120,
            "image_url": "https://images.pexels.com/photos/7420939/pexels-photo-7420939.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "is_available": True,
            "is_vegetarian": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Paneer Tikka",
            "description": "Grilled cottage cheese marinated in aromatic spices",
            "category": "snacks",
            "price": 180,
            "image_url": "https://images.pexels.com/photos/12696395/pexels-photo-12696395.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "is_available": True,
            "is_vegetarian": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dal Makhani",
            "description": "Creamy black lentils slow-cooked with butter and cream",
            "category": "lunch",
            "price": 200,
            "image_url": "https://images.pexels.com/photos/9609835/pexels-photo-9609835.jpeg?auto=compress&cs=tinysrgb&w=600",
            "is_available": True,
            "is_vegetarian": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Fresh Lime Soda",
            "description": "Refreshing lime juice with soda, your choice of sweet or salted",
            "category": "beverages",
            "price": 60,
            "image_url": "https://images.pexels.com/photos/2109099/pexels-photo-2109099.jpeg?auto=compress&cs=tinysrgb&w=600",
            "is_available": True,
            "is_vegetarian": True,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Butter Chicken",
            "description": "Tender chicken in a rich tomato and butter gravy",
            "category": "dinner",
            "price": 280,
            "image_url": "https://images.pexels.com/photos/7625056/pexels-photo-7625056.jpeg?auto=compress&cs=tinysrgb&w=600",
            "is_available": True,
            "is_vegetarian": False,
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Seed default settings for this property
    default_settings = {
        "id": str(uuid.uuid4()),
        "property_id": property_id,
        "property_name": f"Hidden Monkey Stays - {property_id.title()}",
        "staff_whatsapp": "+919876543210",
        "currency": "INR",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if exp_count == 0:
        await db.experiences.insert_many(experiences)
    if menu_count == 0:
        await db.menu_items.insert_many(menu_items)
    
    settings_count = await db.settings.count_documents({"property_id": property_id})
    if settings_count == 0:
        await db.settings.insert_one(default_settings)
    
    return {"message": f"Data seeded successfully for property: {property_id}"}

# Clone property endpoint
@api_router.post("/properties/clone")
async def clone_property(source_property_id: str, target_property_id: str):
    """Clone all data from one property to create a new property"""
    
    # Check if target already exists
    target_exp_count = await db.experiences.count_documents({"property_id": target_property_id})
    if target_exp_count > 0:
        raise HTTPException(status_code=400, detail=f"Property {target_property_id} already exists")
    
    # Clone experiences
    source_experiences = await db.experiences.find({"property_id": source_property_id}, {"_id": 0}).to_list(100)
    if source_experiences:
        for exp in source_experiences:
            exp["id"] = str(uuid.uuid4())
            exp["property_id"] = target_property_id
            exp["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.experiences.insert_many(source_experiences)
    
    # Clone menu items
    source_menu = await db.menu_items.find({"property_id": source_property_id}, {"_id": 0}).to_list(200)
    if source_menu:
        for item in source_menu:
            item["id"] = str(uuid.uuid4())
            item["property_id"] = target_property_id
            item["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.menu_items.insert_many(source_menu)
    
    # Clone settings with new property name
    source_settings = await db.settings.find_one({"property_id": source_property_id}, {"_id": 0})
    if source_settings:
        source_settings["id"] = str(uuid.uuid4())
        source_settings["property_id"] = target_property_id
        source_settings["property_name"] = f"Hidden Monkey Stays - {target_property_id.title()}"
        source_settings["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.insert_one(source_settings)
    
    return {
        "message": "Property cloned successfully",
        "source": source_property_id,
        "target": target_property_id,
        "experiences_cloned": len(source_experiences) if source_experiences else 0,
        "menu_items_cloned": len(source_menu) if source_menu else 0
    }

# Get all properties
@api_router.get("/properties")
async def get_properties():
    """Get list of all configured properties"""
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    properties = []
    for s in settings:
        exp_count = await db.experiences.count_documents({"property_id": s["property_id"]})
        menu_count = await db.menu_items.count_documents({"property_id": s["property_id"]})
        properties.append({
            "property_id": s["property_id"],
            "property_name": s["property_name"],
            "property_slug": s.get("property_slug", ""),
            "property_location": s.get("property_location", ""),
            "staff_whatsapp": s.get("staff_whatsapp", ""),
            "experiences_count": exp_count,
            "menu_items_count": menu_count
        })
    return properties

# Seed all default properties
@api_router.post("/seed-all-properties")
async def seed_all_properties():
    """Seed all three default properties with correct configuration"""
    properties_config = [
        {
            "property_id": "varanasi",
            "property_name": "Hidden Monkey Hostel, Varanasi",
            "property_slug": "VaranasiHostel",
            "property_location": "Chet Singh Ghat, Varanasi",
            "staff1_whatsapp": "9928441808",
            "staff2_whatsapp": "8945006683"
        },
        {
            "property_id": "darjeeling-hostel",
            "property_name": "Hidden Monkey Hostel, Darjeeling",
            "property_slug": "DarjeelingHostel",
            "property_location": "Near Railway Station, Darjeeling",
            "staff1_whatsapp": "",
            "staff2_whatsapp": ""
        },
        {
            "property_id": "darjeeling-home",
            "property_name": "Hidden Monkey Home, Darjeeling",
            "property_slug": "DarjeelingHome",
            "property_location": "Batasia Loop, Darjeeling",
            "staff1_whatsapp": "",
            "staff2_whatsapp": ""
        }
    ]
    
    results = []
    for config in properties_config:
        # Create or update settings
        existing = await db.settings.find_one({"property_id": config["property_id"]})
        if existing:
            await db.settings.update_one(
                {"property_id": config["property_id"]},
                {"$set": config}
            )
        else:
            config["id"] = str(uuid.uuid4())
            config["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.settings.insert_one(config)
        
        # Seed data for this property
        await seed_data(config["property_id"])
        results.append(config["property_id"])
    
    # Create default admin user if not exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password_hash": hash_password("hiddenmonkey2024"),
            "role": "admin",
            "property_id": None,
            "whatsapp_numbers": [],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
    
    return {"message": "All properties seeded", "properties": results}


# ==================== Check-in Form Webhook ====================
@api_router.post("/webhook/checkin")
async def checkin_webhook(request: Request):
    """
    Webhook endpoint for Google Forms check-in notifications.
    Can be called from Google Apps Script when a form is submitted.
    """
    try:
        data = await request.json()
        guest_name = data.get("guest_name", "Guest")
        room_number = data.get("room_number", "N/A")
        property_id = data.get("property_id", "varanasi")
        phone = data.get("phone", "")
        
        # Get property settings to find manager contact
        settings = await db.settings.find_one({"property_id": property_id})
        if not settings:
            settings = await db.settings.find_one({})
        
        manager_phone = settings.get("manager_whatsapp", "") if settings else ""
        property_name = settings.get("property_name", "Hidden Monkey Stays") if settings else "Hidden Monkey Stays"
        
        if manager_phone:
            # Send WhatsApp notification to manager
            message = f"🎉 *New Check-in Alert!*\n\n"
            message += f"👤 Guest: {guest_name}\n"
            message += f"🚪 Room: {room_number}\n"
            if phone:
                message += f"📱 Phone: {phone}\n"
            message += f"🏨 Property: {property_name}\n"
            message += f"⏰ Time: {datetime.now(timezone.utc).strftime('%I:%M %p, %d %b %Y')}"
            
            await send_whatsapp_message(manager_phone, message)
            logging.info(f"Check-in notification sent for {guest_name} at {property_id}")
        
        return {"success": True, "message": "Check-in recorded and manager notified"}
    except Exception as e:
        logging.error(f"Check-in webhook error: {e}")
        return {"success": False, "error": str(e)}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note: Logging already configured at top of file
# MongoDB connection managed via lifespan context manager
