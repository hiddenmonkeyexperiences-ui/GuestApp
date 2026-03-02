import requests
import sys
import json
from datetime import datetime

class HiddenMonkeyAPITester:
    def __init__(self, base_url="https://visitor-gateway.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
    def log_result(self, test_name, success, status_code=None, response=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - Status: {status_code}")
        else:
            self.failed_tests.append({
                "test": test_name,
                "error": str(error) if error else f"Expected success but got {status_code}",
                "status_code": status_code,
                "response": response
            })
            print(f"❌ {test_name} - Status: {status_code}, Error: {error}")
            
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)
            
        print(f"\n🔍 Testing {name} - {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=request_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=request_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {"raw_response": response.text}
                
            self.log_result(name, success, response.status_code, response_data)
            return success, response_data
            
        except requests.exceptions.Timeout:
            self.log_result(name, False, error="Request timeout (10s)")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_result(name, False, error="Connection error")
            return False, {}
        except Exception as e:
            self.log_result(name, False, error=str(e))
            return False, {}
    
    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "/health", 200)
    
    def test_admin_auth(self):
        """Test admin authentication"""
        success, response = self.run_test(
            "Admin Authentication", 
            "POST", 
            "/admin/auth", 
            200, 
            {"password": "hiddenmonkey2024"}
        )
        if success and response.get("success"):
            print("✅ Admin authentication successful")
            return True
        return False
    
    def test_properties_list(self):
        """Test properties listing"""
        return self.run_test("Properties List", "GET", "/properties", 200)
    
    def test_menu_items(self):
        """Test menu items API with property_id"""
        return self.run_test("Menu Items", "GET", "/menu?property_id=varanasi", 200)
    
    def test_experiences(self):
        """Test experiences API with property_id"""
        return self.run_test("Experiences", "GET", "/experiences?property_id=varanasi", 200)
    
    def test_settings(self):
        """Test settings API"""
        return self.run_test("Settings", "GET", "/settings/varanasi", 200)
    
    def test_create_order(self):
        """Test creating a food order"""
        order_data = {
            "guest_name": "Test Guest",
            "room_number": "101",
            "whatsapp": "+919876543210",
            "items": [
                {
                    "item_id": "test-item-1",
                    "name": "Test Item",
                    "quantity": 2,
                    "price": 150.0
                }
            ],
            "total": 300.0,
            "property_id": "varanasi",
            "notes": "Test order"
        }
        return self.run_test("Create Food Order", "POST", "/orders", 201, order_data)
    
    def test_create_experience_booking(self):
        """Test creating an experience booking"""
        booking_data = {
            "guest_name": "Test Guest",
            "room_number": "101", 
            "whatsapp": "+919876543210",
            "experience_id": "test-exp-1",
            "experience_title": "Test Experience",
            "property_id": "varanasi",
            "notes": "Test booking"
        }
        return self.run_test("Create Experience Booking", "POST", "/bookings", 201, booking_data)
    
    def test_create_guest_request(self):
        """Test creating a guest request"""
        request_data = {
            "guest_name": "Test Guest",
            "room_number": "101",
            "whatsapp": "+919876543210", 
            "category": "housekeeping",
            "message": "Need extra towels please",
            "property_id": "varanasi"
        }
        return self.run_test("Create Guest Request", "POST", "/requests", 201, request_data)
    
    def test_active_menu(self):
        """Test active menu endpoint (time-based filtering)"""
        return self.run_test("Active Menu Items", "GET", "/menu-active?property_id=varanasi", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Hidden Monkey Stays API Testing...")
        print(f"🔗 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Basic health and auth tests
        self.test_health_check()
        self.test_admin_auth()
        
        # Data retrieval tests  
        self.test_properties_list()
        self.test_menu_items()
        self.test_experiences()
        self.test_settings()
        self.test_active_menu()
        
        # Creation workflow tests
        self.test_create_order()
        self.test_create_experience_booking()
        self.test_create_guest_request()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for fail in self.failed_tests:
                print(f"  • {fail['test']}: {fail['error']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HiddenMonkeyAPITester()
    all_passed = tester.run_all_tests()
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())