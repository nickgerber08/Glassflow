#!/usr/bin/env python3
"""
GlassFlow Auto Glass Job Scheduler Backend API Tests
Tests all backend endpoints with realistic auto glass job data
"""

import requests
import json
import uuid
from datetime import datetime, timezone, timedelta
import subprocess
import sys
import os

# Get backend URL from frontend .env
BACKEND_URL = "https://glassflow-4.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.test_job_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def setup_test_user_and_session(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Setting up test user and session...")
        
        try:
            # Generate unique IDs
            timestamp = int(datetime.now().timestamp())
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            session_token = f"test_session_{timestamp}"
            email = f"test.user.{timestamp}@example.com"
            
            # MongoDB script to create test user and session
            mongo_script = f"""
use('test_database');
db.users.insertOne({{
  user_id: '{user_id}',
  email: '{email}',
  name: 'Test User {timestamp}',
  picture: 'https://via.placeholder.com/150',
  role: 'technician',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: '{user_id}',
  session_token: '{session_token}',
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Setup complete');
"""
            
            # Execute MongoDB script
            result = subprocess.run(
                ["mongosh", "--eval", mongo_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                self.session_token = session_token
                self.user_id = user_id
                self.log_result("Setup Test User", True, f"Created user {user_id} with session {session_token}")
                return True
            else:
                self.log_result("Setup Test User", False, f"MongoDB error: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_result("Setup Test User", False, f"Setup failed: {str(e)}")
            return False
    
    def test_auth_me(self):
        """Test GET /api/auth/me endpoint"""
        print("\n🔐 Testing Auth /me endpoint...")
        
        if not self.session_token:
            self.log_result("Auth Me", False, "No session token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                if "user_id" in user_data and user_data["user_id"] == self.user_id:
                    self.log_result("Auth Me", True, "Successfully retrieved user data", user_data)
                    return True
                else:
                    self.log_result("Auth Me", False, "Invalid user data returned", user_data)
                    return False
            else:
                self.log_result("Auth Me", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Auth Me", False, f"Request failed: {str(e)}")
            return False
    
    def test_create_job(self):
        """Test POST /api/jobs endpoint"""
        print("\n🚗 Testing Create Job endpoint...")
        
        if not self.session_token:
            self.log_result("Create Job", False, "No session token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            # Realistic auto glass job data
            job_data = {
                "customer_name": "Sarah Johnson",
                "phone": "(555) 123-4567",
                "address": "1234 Main Street, Austin, TX 78701",
                "lat": 30.2672,
                "lng": -97.7431,
                "vehicle_make": "Toyota",
                "vehicle_model": "Camry",
                "vehicle_year": "2020",
                "job_type": "windshield",
                "status": "pending",
                "notes": "Customer reports large crack on driver side of windshield",
                "appointment_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            }
            
            response = requests.post(f"{BACKEND_URL}/jobs", headers=headers, json=job_data, timeout=10)
            
            if response.status_code == 200:
                job = response.json()
                if "job_id" in job:
                    self.test_job_id = job["job_id"]
                    self.log_result("Create Job", True, f"Created job {self.test_job_id}", job)
                    return True
                else:
                    self.log_result("Create Job", False, "No job_id in response", job)
                    return False
            else:
                self.log_result("Create Job", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create Job", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_jobs(self):
        """Test GET /api/jobs endpoint"""
        print("\n📋 Testing Get Jobs endpoint...")
        
        if not self.session_token:
            self.log_result("Get Jobs", False, "No session token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/jobs", headers=headers, timeout=10)
            
            if response.status_code == 200:
                jobs = response.json()
                if isinstance(jobs, list):
                    self.log_result("Get Jobs", True, f"Retrieved {len(jobs)} jobs", {"count": len(jobs)})
                    return True
                else:
                    self.log_result("Get Jobs", False, "Response is not a list", jobs)
                    return False
            else:
                self.log_result("Get Jobs", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Get Jobs", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_specific_job(self):
        """Test GET /api/jobs/{job_id} endpoint"""
        print("\n🔍 Testing Get Specific Job endpoint...")
        
        if not self.session_token:
            self.log_result("Get Specific Job", False, "No session token available")
            return False
        
        if not self.test_job_id:
            self.log_result("Get Specific Job", False, "No test job ID available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/jobs/{self.test_job_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                job = response.json()
                if job.get("job_id") == self.test_job_id:
                    self.log_result("Get Specific Job", True, f"Retrieved job {self.test_job_id}", job)
                    return True
                else:
                    self.log_result("Get Specific Job", False, "Job ID mismatch", job)
                    return False
            else:
                self.log_result("Get Specific Job", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Get Specific Job", False, f"Request failed: {str(e)}")
            return False
    
    def test_update_job(self):
        """Test PATCH /api/jobs/{job_id} endpoint"""
        print("\n✏️ Testing Update Job endpoint...")
        
        if not self.session_token:
            self.log_result("Update Job", False, "No session token available")
            return False
        
        if not self.test_job_id:
            self.log_result("Update Job", False, "No test job ID available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            # Test different status updates
            statuses_to_test = ["scheduled", "in_progress", "completed"]
            
            for status in statuses_to_test:
                update_data = {
                    "status": status,
                    "notes": f"Job status updated to {status} during testing"
                }
                
                response = requests.patch(
                    f"{BACKEND_URL}/jobs/{self.test_job_id}", 
                    headers=headers, 
                    json=update_data, 
                    timeout=10
                )
                
                if response.status_code == 200:
                    job = response.json()
                    if job.get("status") == status:
                        self.log_result(f"Update Job Status to {status}", True, f"Successfully updated to {status}")
                    else:
                        self.log_result(f"Update Job Status to {status}", False, f"Status not updated correctly", job)
                        return False
                else:
                    self.log_result(f"Update Job Status to {status}", False, f"HTTP {response.status_code}: {response.text}")
                    return False
            
            return True
                
        except Exception as e:
            self.log_result("Update Job", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_users(self):
        """Test GET /api/users endpoint"""
        print("\n👥 Testing Get Users endpoint...")
        
        if not self.session_token:
            self.log_result("Get Users", False, "No session token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/users", headers=headers, timeout=10)
            
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list) and len(users) > 0:
                    # Check if our test user is in the list
                    test_user_found = any(user.get("user_id") == self.user_id for user in users)
                    if test_user_found:
                        self.log_result("Get Users", True, f"Retrieved {len(users)} users including test user")
                        return True
                    else:
                        self.log_result("Get Users", False, f"Test user not found in {len(users)} users")
                        return False
                else:
                    self.log_result("Get Users", False, "No users returned or invalid format", users)
                    return False
            else:
                self.log_result("Get Users", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Get Users", False, f"Request failed: {str(e)}")
            return False
    
    def test_create_comment(self):
        """Test POST /api/jobs/{job_id}/comments endpoint"""
        print("\n💬 Testing Create Comment endpoint...")
        
        if not self.session_token:
            self.log_result("Create Comment", False, "No session token available")
            return False
        
        if not self.test_job_id:
            self.log_result("Create Comment", False, "No test job ID available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            comment_data = {
                "comment": "Customer confirmed appointment time. Windshield replacement scheduled for tomorrow morning."
            }
            
            response = requests.post(
                f"{BACKEND_URL}/jobs/{self.test_job_id}/comments", 
                headers=headers, 
                json=comment_data, 
                timeout=10
            )
            
            if response.status_code == 200:
                comment = response.json()
                if "comment_id" in comment and comment.get("job_id") == self.test_job_id:
                    self.log_result("Create Comment", True, f"Created comment {comment['comment_id']}", comment)
                    return True
                else:
                    self.log_result("Create Comment", False, "Invalid comment response", comment)
                    return False
            else:
                self.log_result("Create Comment", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create Comment", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_comments(self):
        """Test GET /api/jobs/{job_id}/comments endpoint"""
        print("\n📝 Testing Get Comments endpoint...")
        
        if not self.session_token:
            self.log_result("Get Comments", False, "No session token available")
            return False
        
        if not self.test_job_id:
            self.log_result("Get Comments", False, "No test job ID available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/jobs/{self.test_job_id}/comments", headers=headers, timeout=10)
            
            if response.status_code == 200:
                comments = response.json()
                if isinstance(comments, list):
                    self.log_result("Get Comments", True, f"Retrieved {len(comments)} comments for job", {"count": len(comments)})
                    return True
                else:
                    self.log_result("Get Comments", False, "Response is not a list", comments)
                    return False
            else:
                self.log_result("Get Comments", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Get Comments", False, f"Request failed: {str(e)}")
            return False
    
    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        try:
            # MongoDB script to clean up test data
            mongo_script = f"""
use('test_database');
db.users.deleteMany({{email: /test\\.user\\./}});
db.user_sessions.deleteMany({{session_token: /test_session/}});
db.jobs.deleteMany({{created_by: '{self.user_id}'}});
db.job_comments.deleteMany({{job_id: '{self.test_job_id}'}});
print('Cleanup complete');
"""
            
            result = subprocess.run(
                ["mongosh", "--eval", mongo_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                self.log_result("Cleanup", True, "Test data cleaned up successfully")
            else:
                self.log_result("Cleanup", False, f"Cleanup failed: {result.stderr}")
                
        except Exception as e:
            self.log_result("Cleanup", False, f"Cleanup error: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting GlassFlow Backend API Tests")
        print(f"🌐 Testing against: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_user_and_session():
            print("❌ Setup failed, cannot continue with tests")
            return False
        
        # Run tests in order
        tests = [
            self.test_auth_me,
            self.test_create_job,
            self.test_get_jobs,
            self.test_get_specific_job,
            self.test_update_job,
            self.test_get_users,
            self.test_create_comment,
            self.test_get_comments
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Backend API is working correctly.")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed. Check the details above.")
            return False

def main():
    """Main test runner"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Print detailed results
    print("\n📋 Detailed Test Results:")
    for result in tester.test_results:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())