from fastapi import FastAPI, APIRouter, HTTPException, Header, Response, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
# import socketio  # Disabled for now

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Expo Push Notification URL
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Note: Socket.IO disabled for initial setup, can be added later if needed
# sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')


# Pydantic Models
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "technician"  # admin or technician
    push_token: Optional[str] = None  # Expo push token
    created_at: datetime

class Notification(BaseModel):
    notification_id: str
    user_id: str  # recipient
    title: str
    body: str
    data: Optional[dict] = None
    read: bool = False
    created_at: datetime

class PushTokenRequest(BaseModel):
    push_token: str

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class Job(BaseModel):
    job_id: str
    customer_name: str
    phone: str
    address: str
    lat: float
    lng: float
    vehicle_make: str
    vehicle_model: str
    vehicle_year: str
    vin_or_lp: Optional[str] = None
    part_number: Optional[str] = None  # Part number for the job
    omega_invoice: Optional[str] = None  # Omega invoicing software reference
    payment_type: Optional[str] = None  # 'collect' or 'dealership_po'
    amount_to_collect: Optional[float] = None  # Amount tech needs to collect (if payment_type is 'collect')
    is_first_stop: bool = False  # Mark as first stop of the day for a technician
    job_type: str  # windshield, side_window, rear_window, chip_repair
    status: str = "pending"  # pending, scheduled, in_progress, completed, cancelled
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = None
    photos: List[str] = []  # base64 encoded images
    created_by: str  # user_id of creator
    created_by_name: Optional[str] = None  # name of creator (sales rep)
    created_at: datetime
    updated_at: datetime

class JobCreate(BaseModel):
    customer_name: str
    phone: str
    address: str
    lat: float
    lng: float
    vehicle_make: str
    vehicle_model: str
    vehicle_year: str
    vin_or_lp: Optional[str] = None
    part_number: Optional[str] = None
    omega_invoice: Optional[str] = None
    payment_type: Optional[str] = None  # 'collect' or 'dealership_po'
    amount_to_collect: Optional[float] = None
    is_first_stop: bool = False
    job_type: str
    status: str = "pending"
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = None
    photos: List[str] = []
    created_by_name: Optional[str] = None  # name of creator

class JobUpdate(BaseModel):
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vin_or_lp: Optional[str] = None
    part_number: Optional[str] = None
    omega_invoice: Optional[str] = None
    payment_type: Optional[str] = None
    amount_to_collect: Optional[float] = None
    is_first_stop: Optional[bool] = None
    job_type: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = None
    photos: Optional[List[str]] = None

class JobComment(BaseModel):
    comment_id: str
    job_id: str
    user_id: str
    user_name: str
    comment: str
    created_at: datetime

class JobCommentCreate(BaseModel):
    comment: str

class TechnicianCreate(BaseModel):
    name: str
    email: str

# Customer models for saved customers feature
class Customer(BaseModel):
    customer_id: str
    name: str
    phone: str
    address: str
    lat: float
    lng: float
    usage_count: int = 0  # Track how often this customer is used
    created_at: datetime
    updated_at: datetime

class CustomerCreate(BaseModel):
    name: str
    phone: str
    address: str
    lat: float
    lng: float

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

# Auth Helper Functions
async def get_current_user(request: Request) -> Optional[User]:
    # Try to get session_token from Authorization header first
    auth_header = request.headers.get("Authorization")
    session_token = None
    
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header.split(" ")[1]
    else:
        # Fallback to cookie
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        return None
    
    # Find session in database
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check if session is expired (with timezone handling)
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user data
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if user_doc:
        return User(**user_doc)
    
    return None

async def require_auth(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# Auth Routes
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response, x_session_id: str = Header(...)):
    """Exchange session_id for session_token"""
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id},
                timeout=10.0
            )
            auth_response.raise_for_status()
            user_data = auth_response.json()
        
        # Parse response
        session_data = SessionDataResponse(**user_data)
        
        # Check if user exists
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        existing_user = await db.users.find_one(
            {"email": session_data.email},
            {"_id": 0}
        )
        
        if existing_user:
            user_id = existing_user["user_id"]
        else:
            # Create new user
            new_user = {
                "user_id": user_id,
                "email": session_data.email,
                "name": session_data.name,
                "picture": session_data.picture,
                "role": "technician",  # Default role
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(new_user)
        
        # Store session in database
        session_doc = {
            "user_id": user_id,
            "session_token": session_data.session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_data.session_token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="none",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        # Get updated user data
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {
            "user": user,
            "session_token": session_data.session_token
        }
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Auth error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await require_auth(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# Push Notification Helper
async def send_push_notifications(tokens: List[str], title: str, body: str, data: dict = None):
    """Send push notifications to multiple Expo push tokens"""
    if not tokens:
        return
    
    messages = []
    for token in tokens:
        if token and token.startswith("ExponentPushToken"):
            message = {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
            }
            if data:
                message["data"] = data
            messages.append(message)
    
    if messages:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Content-Type": "application/json"}
                )
                logging.info(f"Push notification response: {response.status_code}")
        except Exception as e:
            logging.error(f"Error sending push notifications: {e}")

async def create_notification_for_all_users(title: str, body: str, data: dict = None, exclude_user_id: str = None):
    """Create in-app notifications for all users and send push notifications"""
    # Get all users
    users = await db.users.find({}, {"user_id": 1, "push_token": 1}).to_list(1000)
    
    now = datetime.now(timezone.utc)
    notifications = []
    push_tokens = []
    
    for user in users:
        if exclude_user_id and user["user_id"] == exclude_user_id:
            continue
            
        # Create in-app notification
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "title": title,
            "body": body,
            "data": data,
            "read": False,
            "created_at": now
        }
        notifications.append(notification)
        
        # Collect push tokens
        if user.get("push_token"):
            push_tokens.append(user["push_token"])
    
    # Insert all notifications
    if notifications:
        await db.notifications.insert_many(notifications)
    
    # Send push notifications (non-blocking)
    if push_tokens:
        asyncio.create_task(send_push_notifications(push_tokens, title, body, data))

# Push Token Registration
@api_router.post("/push-token")
async def register_push_token(token_data: PushTokenRequest, request: Request):
    """Register or update push token for current user"""
    user = await require_auth(request)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"push_token": token_data.push_token}}
    )
    
    return {"message": "Push token registered successfully"}

# Notification Routes
@api_router.get("/notifications")
async def get_notifications(request: Request, limit: int = 50):
    """Get notifications for current user"""
    user = await require_auth(request)
    
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(request: Request):
    """Get unread notification count for current user"""
    user = await require_auth(request)
    
    count = await db.notifications.count_documents({
        "user_id": user.user_id,
        "read": False
    })
    
    return {"unread_count": count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    user = await require_auth(request)
    
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read for current user"""
    user = await require_auth(request)
    
    await db.notifications.update_many(
        {"user_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "All notifications marked as read"}

# User Routes
@api_router.get("/users", response_model=List[User])
async def get_users(request: Request):
    """Get all users (for assignment)"""
    await require_auth(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.post("/users/create-tech")
async def create_technician(tech_data: TechnicianCreate, request: Request):
    """Create a new technician user"""
    current_user = await require_auth(request)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if user with email already exists
    existing = await db.users.find_one({"email": tech_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create new technician
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_tech = {
        "user_id": user_id,
        "email": tech_data.email,
        "name": tech_data.name,
        "picture": None,
        "role": "technician",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(new_tech)
    
    return {"message": "Technician created successfully", "user_id": user_id}

@api_router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, request: Request):
    """Update user role (admin only)"""
    current_user = await require_auth(request)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )
    return {"message": "Role updated successfully"}

# Job Routes
@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate, request: Request):
    """Create a new job"""
    user = await require_auth(request)
    
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Get assigned user name if assigned
    assigned_to_name = None
    if job_data.assigned_to:
        assigned_user = await db.users.find_one(
            {"user_id": job_data.assigned_to},
            {"_id": 0}
        )
        if assigned_user:
            assigned_to_name = assigned_user["name"]
    
    job = {
        "job_id": job_id,
        "customer_name": job_data.customer_name,
        "phone": job_data.phone,
        "address": job_data.address,
        "lat": job_data.lat,
        "lng": job_data.lng,
        "vehicle_make": job_data.vehicle_make,
        "vehicle_model": job_data.vehicle_model,
        "vehicle_year": job_data.vehicle_year,
        "vin_or_lp": job_data.vin_or_lp,
        "part_number": job_data.part_number,
        "omega_invoice": job_data.omega_invoice,
        "payment_type": job_data.payment_type,
        "amount_to_collect": job_data.amount_to_collect,
        "is_first_stop": job_data.is_first_stop,
        "job_type": job_data.job_type,
        "status": job_data.status,
        "assigned_to": job_data.assigned_to,
        "assigned_to_name": job_data.assigned_to_name or assigned_to_name,
        "appointment_time": job_data.appointment_time,
        "notes": job_data.notes,
        "photos": job_data.photos,
        "created_by": user.user_id,
        "created_by_name": user.name,  # Automatically set from logged-in user
        "created_at": now,
        "updated_at": now
    }
    
    # Check first stop limit if marking as first stop
    if job_data.is_first_stop and job_data.appointment_time:
        # Get start and end of the appointment day
        apt_date = job_data.appointment_time.replace(hour=0, minute=0, second=0, microsecond=0)
        apt_date_end = apt_date + timedelta(days=1)
        
        # Count existing first stops for that day
        first_stop_count = await db.jobs.count_documents({
            "is_first_stop": True,
            "appointment_time": {"$gte": apt_date, "$lt": apt_date_end}
        })
        
        if first_stop_count >= 3:
            raise HTTPException(status_code=400, detail="Maximum 3 first stops already scheduled for this day")
    
    await db.jobs.insert_one(job)
    
    # Send notifications to all users about the new job
    appointment_str = ""
    if job_data.appointment_time:
        apt_time = job_data.appointment_time
        if apt_time.hour < 12:
            appointment_str = " - Today 9-12 AM"
        else:
            appointment_str = " - Today 1-4 PM"
    
    notification_title = "🚗 New Job Added"
    notification_body = f"{job_data.customer_name} - {job_data.job_type.replace('_', ' ').title()}{appointment_str}"
    
    # Create notifications for all users (don't exclude the creator so they get confirmation too)
    await create_notification_for_all_users(
        title=notification_title,
        body=notification_body,
        data={"job_id": job_id, "type": "new_job"}
    )
    
    return Job(**job)

# Endpoint to check first stop count for a given date
@api_router.get("/jobs/first-stop-count")
async def get_first_stop_count(request: Request, date: str):
    """Get count of first stops for a given date"""
    await require_auth(request)
    
    try:
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        count = await db.jobs.count_documents({
            "is_first_stop": True,
            "appointment_time": {"$gte": day_start, "$lt": day_end}
        })
        
        return {"count": count, "max": 3, "can_add": count < 3}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(request: Request, status: Optional[str] = None):
    """Get all jobs with optional status filter"""
    await require_auth(request)
    
    query = {}
    if status:
        query["status"] = status
    
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Job(**job) for job in jobs]

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str, request: Request):
    """Get a specific job"""
    await require_auth(request)
    
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return Job(**job)

@api_router.patch("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_update: JobUpdate, request: Request):
    """Update a job"""
    await require_auth(request)
    
    # Build update dict
    update_data = job_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Get the current job to check first stop logic
    current_job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not current_job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check first stop limit when marking as first stop
    if update_data.get("is_first_stop") == True and not current_job.get("is_first_stop"):
        # Determine the appointment date (use update or existing)
        apt_time = update_data.get("appointment_time") or current_job.get("appointment_time")
        if apt_time:
            if isinstance(apt_time, str):
                apt_time = datetime.fromisoformat(apt_time.replace('Z', '+00:00'))
            
            day_start = apt_time.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            # Count existing first stops for that day (excluding this job)
            first_stop_count = await db.jobs.count_documents({
                "is_first_stop": True,
                "job_id": {"$ne": job_id},
                "appointment_time": {"$gte": day_start, "$lt": day_end}
            })
            
            if first_stop_count >= 3:
                raise HTTPException(status_code=400, detail="Maximum 3 first stops already scheduled for this day")
    
    # Get assigned user name if assigned_to is being updated
    if "assigned_to" in update_data and update_data["assigned_to"]:
        assigned_user = await db.users.find_one(
            {"user_id": update_data["assigned_to"]},
            {"_id": 0}
        )
        if assigned_user:
            update_data["assigned_to_name"] = assigned_user["name"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.jobs.update_one(
        {"job_id": job_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get updated job
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    
    # Real-time updates disabled for now
    # await sio.emit('job_updated', job)
    
    return Job(**job)

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, request: Request):
    """Delete a job"""
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.jobs.delete_one({"job_id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Real-time updates disabled for now
    # await sio.emit('job_deleted', {"job_id": job_id})
    
    return {"message": "Job deleted successfully"}

# Job Comments Routes
@api_router.post("/jobs/{job_id}/comments", response_model=JobComment)
async def create_comment(job_id: str, comment_data: JobCommentCreate, request: Request):
    """Add a comment to a job"""
    user = await require_auth(request)
    
    comment_id = f"comment_{uuid.uuid4().hex[:12]}"
    comment = {
        "comment_id": comment_id,
        "job_id": job_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "comment": comment_data.comment,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.job_comments.insert_one(comment)
    
    # Real-time updates disabled for now
    # await sio.emit('comment_added', comment)
    
    return JobComment(**comment)

@api_router.get("/jobs/{job_id}/comments", response_model=List[JobComment])
async def get_comments(job_id: str, request: Request):
    """Get all comments for a job"""
    await require_auth(request)
    
    comments = await db.job_comments.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return [JobComment(**comment) for comment in comments]

# ============== CUSTOMER ENDPOINTS ==============

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, request: Request):
    """Create a new saved customer"""
    user = await require_auth(request)
    
    # Check if customer with same name and address already exists
    existing = await db.customers.find_one({
        "name": customer_data.name,
        "address": customer_data.address
    })
    
    if existing:
        # Update the existing customer and return it
        await db.customers.update_one(
            {"customer_id": existing["customer_id"]},
            {"$set": {
                "phone": customer_data.phone,
                "lat": customer_data.lat,
                "lng": customer_data.lng,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        updated = await db.customers.find_one({"customer_id": existing["customer_id"]}, {"_id": 0})
        return Customer(**updated)
    
    now = datetime.now(timezone.utc)
    customer = Customer(
        customer_id=f"cust_{uuid.uuid4().hex[:12]}",
        name=customer_data.name,
        phone=customer_data.phone,
        address=customer_data.address,
        lat=customer_data.lat,
        lng=customer_data.lng,
        usage_count=0,
        created_at=now,
        updated_at=now
    )
    
    await db.customers.insert_one(customer.model_dump())
    return customer

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(request: Request, search: Optional[str] = None):
    """Get all saved customers, optionally filtered by search query"""
    await require_auth(request)
    
    query = {}
    if search:
        # Search by name or address (case-insensitive)
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"address": {"$regex": search, "$options": "i"}}
            ]
        }
    
    customers = await db.customers.find(
        query,
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    return [Customer(**c) for c in customers]

@api_router.get("/customers/frequent", response_model=List[Customer])
async def get_frequent_customers(request: Request, limit: int = 5):
    """Get most frequently used customers"""
    await require_auth(request)
    
    customers = await db.customers.find(
        {},
        {"_id": 0}
    ).sort("usage_count", -1).limit(limit).to_list(limit)
    
    return [Customer(**c) for c in customers]

@api_router.post("/customers/{customer_id}/increment-usage")
async def increment_customer_usage(customer_id: str, request: Request):
    """Increment usage count when customer is used for a job"""
    await require_auth(request)
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {
            "$inc": {"usage_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"success": True}

@api_router.patch("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerUpdate, request: Request):
    """Update a saved customer"""
    await require_auth(request)
    
    update_data = {k: v for k, v in customer_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = await db.customers.find_one({"customer_id": customer_id}, {"_id": 0})
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, request: Request):
    """Delete a saved customer"""
    await require_auth(request)
    
    result = await db.customers.delete_one({"customer_id": customer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"success": True}

# Socket.IO events disabled for now
# @sio.event
# async def connect(sid, environ):
#     logging.info(f"Client {sid} connected")

# @sio.event
# async def disconnect(sid):
#     logging.info(f"Client {sid} disconnected")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()