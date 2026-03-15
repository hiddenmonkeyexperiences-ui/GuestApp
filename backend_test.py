#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime
import time

class HiddenMonkeyAPITester:
    def __init__(self, base_url="https://api.hiddenmonkeyhostels.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.property_id = "varanasi"
        
    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")
        if success:
            self.tests_passed += 1
        print()

    def test_health_check(self):
        """Test API health check endpoint"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {response.text[:100]}"
            self.log_test("API Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("API Health Check", False, f"Exception: {str(e)}")
            return False

    def test_staff_login(self, username="admin", password="admin123"):
        """Test staff login and JWT token generation"""
        try:
            response = requests.post(
                f"{self.api_url}/auth/login", 
                json={"username": username, "password": password},
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    details += f", Token received (length: {len(self.token)})"
                    details += f", User: {data.get('user', {}).get('username', 'N/A')}"
                else:
                    success = False
                    details += ", No token in response"
            else:
                details += f", Response: {response.text[:200]}"
            
            self.log_test("Staff Login (JWT Authentication)", success, details)
            return success
        except Exception as e:
            self.log_test("Staff Login (JWT Authentication)", False, f"Exception: {str(e)}")
            return False

    def test_unauthorized_protected_endpoint(self):
        """Test that protected endpoints reject requests without valid JWT"""
        try:
            # Try to access property-info POST without token (should be protected)
            response = requests.post(
                f"{self.api_url}/property-info",
                json={"property_id": self.property_id, "welcome_message": "test"},
                timeout=10
            )
            
            success = response.status_code == 401
            details = f"Status: {response.status_code} (Expected: 401 Unauthorized)"
            if not success:
                details += f", Response: {response.text[:200]}"
            
            self.log_test("Unauthorized Access Rejection", success, details)
            return success
        except Exception as e:
            self.log_test("Unauthorized Access Rejection", False, f"Exception: {str(e)}")
            return False

    def test_authorized_protected_endpoint(self):
        """Test that protected endpoints accept requests with valid JWT"""
        if not self.token:
            self.log_test("Authorized Access Test", False, "No token available (staff login failed)")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(
                f"{self.api_url}/property-info/{self.property_id}",
                headers=headers,
                timeout=10
            )
            
            success = response.status_code in [200, 404]  # 200 if exists, 404 if not found (both valid)
            details = f"Status: {response.status_code}"
            if success and response.status_code == 200:
                data = response.json()
                details += f", Property: {data.get('property_id', 'N/A')}"
            
            self.log_test("Authorized Access with JWT", success, details)
            return success
        except Exception as e:
            self.log_test("Authorized Access with JWT", False, f"Exception: {str(e)}")
            return False

    def test_get_experiences(self):
        """Test fetching experiences list (public endpoint)"""
        try:
            response = requests.get(
                f"{self.api_url}/experiences?property_id={self.property_id}&active_only=true",
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Count: {len(data)} experiences"
                if data:
                    sample = data[0]
                    details += f", Sample: {sample.get('title', 'N/A')[:30]}"
            else:
                details += f", Response: {response.text[:200]}"
            
            self.log_test("Get Experiences List", success, details)
            return success
        except Exception as e:
            self.log_test("Get Experiences List", False, f"Exception: {str(e)}")
            return False

    def test_get_food_menu(self):
        """Test fetching food menu (public endpoint)"""
        try:
            response = requests.get(
                f"{self.api_url}/menu?property_id={self.property_id}&available_only=true",
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Count: {len(data)} menu items"
                if data:
                    sample = data[0]
                    details += f", Sample: {sample.get('name', 'N/A')[:30]}"
                    details += f", Price: ₹{sample.get('price', 'N/A')}"
            else:
                details += f", Response: {response.text[:200]}"
            
            self.log_test("Get Food Menu", success, details)
            return success
        except Exception as e:
            self.log_test("Get Food Menu", False, f"Exception: {str(e)}")
            return False

    def test_guest_food_order(self):
        """Test guest placing a food order (public endpoint)"""
        try:
            order_data = {
                "guest_name": "Test Guest",
                "room_number": "101",
                "whatsapp": "+919876543210",
                "items": [
                    {
                        "item_id": "test-item-1",
                        "name": "Test Burger",
                        "quantity": 2,
                        "price": 150.0
                    }
                ],
                "total": 300.0,
                "property_id": self.property_id,
                "notes": "Test order from API testing"
            }
            
            response = requests.post(
                f"{self.api_url}/orders",
                json=order_data,
                timeout=15
            )
            
            success = response.status_code in [200, 201]
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Order ID: {data.get('id', 'N/A')[:8]}"
                details += f", Status: {data.get('status', 'N/A')}"
            else:
                details += f", Response: {response.text[:300]}"
            
            self.log_test("Guest Food Order Submission", success, details)
            return success
        except Exception as e:
            self.log_test("Guest Food Order Submission", False, f"Exception: {str(e)}")
            return False

    def test_guest_request(self):
        """Test guest submitting a service request (public endpoint)"""
        try:
            request_data = {
                "guest_name": "Test Guest",
                "room_number": "101",
                "whatsapp": "+919876543210",
                "category": "housekeeping",
                "message": "Please clean the room and provide fresh towels",
                "property_id": self.property_id
            }
            
            response = requests.post(
                f"{self.api_url}/requests",
                json=request_data,
                timeout=15
            )
            
            success = response.status_code in [200, 201]
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Request ID: {data.get('id', 'N/A')[:8]}"
                details += f", Status: {data.get('status', 'N/A')}"
                details += f", Category: {data.get('category', 'N/A')}"
            else:
                details += f", Response: {response.text[:300]}"
            
            self.log_test("Guest Service Request Submission", success, details)
            return success
        except Exception as e:
            self.log_test("Guest Service Request Submission", False, f"Exception: {str(e)}")
            return False

    def test_guest_experience_booking(self):
        """Test guest booking an experience (public endpoint)"""
        try:
            booking_data = {
                "guest_name": "Test Guest",
                "room_number": "101",
                "whatsapp": "+919876543210",
                "experience_id": "test-exp-1",
                "experience_title": "Test Experience",
                "property_id": self.property_id,
                "notes": "Looking forward to this experience!"
            }
            
            response = requests.post(
                f"{self.api_url}/bookings",
                json=booking_data,
                timeout=15
            )
            
            success = response.status_code in [200, 201]
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Booking ID: {data.get('id', 'N/A')[:8]}"
                details += f", Status: {data.get('status', 'N/A')}"
                details += f", Experience: {data.get('experience_title', 'N/A')[:30]}"
            else:
                details += f", Response: {response.text[:300]}"
            
            self.log_test("Guest Experience Booking", success, details)
            return success
        except Exception as e:
            self.log_test("Guest Experience Booking", False, f"Exception: {str(e)}")
            return False

    def test_get_property_info(self):
        """Test getting property info for guest landing page (public endpoint)"""
        try:
            response = requests.get(
                f"{self.api_url}/property-info/{self.property_id}",
                timeout=10
            )
            
            success = response.status_code in [200, 404]  # Both are valid responses
            details = f"Status: {response.status_code}"
            
            if response.status_code == 200:
                data = response.json()
                details += f", Property: {data.get('property_id', 'N/A')}"
                details += f", Checkin: {data.get('checkin_time', 'N/A')}"
                details += f", Things to do: {len(data.get('things_to_do', []))}"
            elif response.status_code == 404:
                details += " (Property info not configured - normal for new setup)"
            else:
                details += f", Response: {response.text[:200]}"
            
            self.log_test("Get Property Info (Guest Home)", success, details)
            return success
        except Exception as e:
            self.log_test("Get Property Info (Guest Home)", False, f"Exception: {str(e)}")
            return False

def main():
    print("🐒 Hidden Monkey Guest App - Backend API Testing")
    print("=" * 60)
    print(f"Backend URL: https://api.hiddenmonkeyhostels.com")
    print(f"Property ID: varanasi")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    tester = HiddenMonkeyAPITester()
    
    # Run all tests in order
    print("🔍 Running Backend API Tests...")
    print("-" * 40)
    
    # Basic connectivity
    tester.test_health_check()
    
    # Authentication flow
    tester.test_staff_login()
    tester.test_unauthorized_protected_endpoint()
    tester.test_authorized_protected_endpoint()
    
    # Public guest endpoints
    tester.test_get_property_info()
    tester.test_get_experiences()
    tester.test_get_food_menu()
    
    # Guest actions
    tester.test_guest_food_order()
    tester.test_guest_request()
    tester.test_guest_experience_booking()
    
    # Summary
    print("=" * 60)
    print(f"📊 Test Results Summary:")
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    print()
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        failed_count = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed_count} test(s) failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())