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

# Note: Socket.IO disabled for initial setup, can be added later if needed
# sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')


# Pydantic Models
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "technician"  # admin or technician
    created_at: datetime

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
    job_type: str  # windshield, side_window, rear_window, chip_repair
    status: str = "pending"  # pending, scheduled, in_progress, completed, cancelled
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = None
    photos: List[str] = []  # base64 encoded images
    created_by: str
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
    job_type: str
    status: str = "pending"
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = None
    photos: List[str] = []

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
        "job_type": job_data.job_type,
        "status": job_data.status,
        "assigned_to": job_data.assigned_to,
        "assigned_to_name": assigned_to_name,
        "appointment_time": job_data.appointment_time,
        "notes": job_data.notes,
        "photos": job_data.photos,
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.jobs.insert_one(job)
    
    # Real-time updates disabled for now
    # await sio.emit('job_created', job)
    
    return Job(**job)

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