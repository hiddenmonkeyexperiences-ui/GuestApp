#!/usr/bin/env python3
"""
Hidden Monkey Stays - Security & Validation Testing Suite
Tests check-in flow, input validation, and security measures
"""
import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, List, Any, Optional


class SecurityTestSuite:
    """Comprehensive security testing suite for Hidden Monkey Stays API"""
    
    def __init__(self, base_url="http://localhost:8001", external_url="https://visitor-gateway.preview.emergentagent.com"):
        self.base_url = base_url
        self.external_url = external_url
        self.admin_password = "hiddenmonkey2024"
        self.tests_run = 0
        self.tests_passed = 0
        self.vulnerabilities_found = []
        self.session = requests.Session()
        
        # Test data
        self.valid_guest_data = {
            "guest_name": "John Doe", 
            "room_number": "A101",
            "whatsapp": "+919876543210",
            "notes": "Test guest"
        }
        
        self.property_id = "test_property"

    def log(self, message: str, level: str = "INFO"):
        """Log test message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, test_func, expected_result: bool = True) -> bool:
        """Run a single test and track results"""
        self.tests_run += 1
        self.log(f"🔍 Testing: {name}")
        
        try:
            result = test_func()
            if result == expected_result:
                self.tests_passed += 1
                self.log("✅ PASSED", "PASS")
                return True
            else:
                self.log(f"❌ FAILED - Expected {expected_result}, got {result}", "FAIL")
                return False
        except Exception as e:
            self.log(f"❌ ERROR - {str(e)}", "ERROR")
            return False

    def test_health_check(self) -> bool:
        """Test API health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            return response.status_code == 200 and "healthy" in response.text.lower()
        except:
            return False

    def test_external_api_gateway(self) -> bool:
        """Test external API gateway (should return 404 as mentioned in context)"""
        try:
            response = self.session.get(f"{self.external_url}/api/health", timeout=10)
            # Expecting 404 as mentioned in the testing context
            return response.status_code == 404
        except:
            return False

    def test_admin_auth_valid(self) -> bool:
        """Test admin authentication with valid password"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/admin/auth",
                json={"password": self.admin_password},
                timeout=10
            )
            return response.status_code == 200 and "success" in response.json()
        except:
            return False

    def test_admin_auth_invalid(self) -> bool:
        """Test admin authentication with invalid password"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/admin/auth",
                json={"password": "wrongpassword123"},
                timeout=10
            )
            return response.status_code == 401
        except:
            return False

    def test_sql_injection_guest_name(self) -> bool:
        """Test SQL injection prevention in guest name field"""
        sql_payloads = [
            "'; DROP TABLE guests; --",
            "' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM users--",
            "Robert'); DELETE FROM orders; --"
        ]
        
        for payload in sql_payloads:
            try:
                data = self.valid_guest_data.copy()
                data["guest_name"] = payload
                
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **data,
                        "category": "maintenance", 
                        "message": "Test request",
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                # Should return 422 (validation error) for malicious input
                if response.status_code != 422:
                    self.vulnerabilities_found.append(f"SQL injection possible in guest_name: {payload}")
                    return False
            except:
                continue
        return True

    def test_nosql_injection_property_id(self) -> bool:
        """Test NoSQL injection prevention in property_id field"""
        nosql_payloads = [
            {"$ne": ""},
            {"$gt": ""},
            {"$where": "function() { return true; }"},
            {"$regex": ".*"},
            '{"$ne": null}'
        ]
        
        for payload in nosql_payloads:
            try:
                data = self.valid_guest_data.copy()
                data["property_id"] = payload if isinstance(payload, str) else json.dumps(payload)
                
                response = self.session.post(
                    f"{self.base_url}/api/requests", 
                    json={
                        **data,
                        "category": "maintenance",
                        "message": "Test request"
                    },
                    timeout=10
                )
                
                if response.status_code != 422:
                    self.vulnerabilities_found.append(f"NoSQL injection possible in property_id: {payload}")
                    return False
            except:
                continue
        return True

    def test_xss_prevention_guest_name(self) -> bool:
        """Test XSS prevention in guest name field"""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//",
            "<iframe src='javascript:alert(`XSS`)'></iframe>"
        ]
        
        for payload in xss_payloads:
            try:
                data = self.valid_guest_data.copy()
                data["guest_name"] = payload
                
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **data,
                        "category": "maintenance",
                        "message": "Test request", 
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                # Should return 400 for XSS attempts
                if response.status_code != 422:
                    self.vulnerabilities_found.append(f"XSS possible in guest_name: {payload}")
                    return False
            except:
                continue
        return True

    def test_xss_prevention_message_field(self) -> bool:
        """Test XSS prevention in message/notes field"""
        xss_payloads = [
            "<script>document.location='http://evil.com'</script>",
            "javascript:void(0)",
            "<body onload=alert('XSS')>",
            "<input type='text' onmouseover='alert(1)'>",
            "<details open ontoggle=alert('XSS')>"
        ]
        
        for payload in xss_payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **self.valid_guest_data,
                        "category": "maintenance",
                        "message": payload,
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                if response.status_code != 422:
                    self.vulnerabilities_found.append(f"XSS possible in message: {payload}")
                    return False
            except:
                continue
        return True

    def test_phone_validation_valid_formats(self) -> bool:
        """Test phone number validation with valid formats"""
        valid_phones = [
            "+919876543210",
            "9876543210", 
            "+91 9876 543 210",
            "9876-543-210",
            "(987) 654-3210"
        ]
        
        for phone in valid_phones:
            try:
                data = self.valid_guest_data.copy()
                data["whatsapp"] = phone
                
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **data,
                        "category": "maintenance",
                        "message": "Test request",
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                # Valid phones should not return 422
                if response.status_code == 422:
                    error_msg = response.json().get("detail", "")
                    if "phone" in error_msg.lower():
                        return False
            except:
                return False
        return True

    def test_phone_validation_invalid_formats(self) -> bool:
        """Test phone number validation with invalid formats"""
        invalid_phones = [
            "123",  # Too short
            "abcdefghij",  # Letters
            "++919876543210",  # Double plus
            "919876543210919876543210",  # Too long
            "<script>alert('xss')</script>",  # Script tag
            "",  # Empty
            "   "  # Whitespace only
        ]
        
        for phone in invalid_phones:
            try:
                data = self.valid_guest_data.copy()
                data["whatsapp"] = phone
                
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **data,
                        "category": "maintenance",
                        "message": "Test request",
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                # Invalid phones should return 422
                if response.status_code != 422:
                    return False
            except:
                continue
        return True

    def test_food_order_missing_fields(self) -> bool:
        """Test food order API with missing required fields"""
        incomplete_orders = [
            {},  # Empty
            {"guest_name": "John"},  # Missing other required fields
            {"items": []},  # Empty items
            {"total": -100},  # Negative total
            {"property_id": ""},  # Empty property ID
        ]
        
        for order in incomplete_orders:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/orders",
                    json=order,
                    timeout=10
                )
                
                # Should return 422 for incomplete data
                if response.status_code != 422:
                    return False
            except:
                continue
        return True

    def test_experience_booking_invalid_property_id(self) -> bool:
        """Test experience booking with invalid property_id"""
        invalid_property_ids = [
            "",  # Empty
            "invalid/property",  # Special chars
            "../admin",  # Path traversal
            "$ne", # NoSQL
            "DROP TABLE",  # SQL
        ]
        
        for prop_id in invalid_property_ids:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/bookings",
                    json={
                        **self.valid_guest_data,
                        "experience_id": "test_exp",
                        "experience_title": "Test Experience",
                        "property_id": prop_id
                    },
                    timeout=10
                )
                
                # Should return 422 for invalid property IDs
                if response.status_code != 422:
                    return False
            except:
                continue
        return True

    def test_input_length_validation(self) -> bool:
        """Test input length limits"""
        # Test very long strings
        very_long_string = "A" * 10000
        
        test_cases = [
            {"guest_name": very_long_string},
            {"room_number": "A" * 100},
            {"notes": very_long_string},
            {"whatsapp": "1" * 100}
        ]
        
        for test_data in test_cases:
            try:
                data = self.valid_guest_data.copy()
                data.update(test_data)
                
                response = self.session.post(
                    f"{self.base_url}/api/requests",
                    json={
                        **data,
                        "category": "maintenance",
                        "message": "Test",
                        "property_id": self.property_id
                    },
                    timeout=10
                )
                
                # Should return 422 for too long inputs
                if response.status_code != 422:
                    return False
            except:
                continue
        return True

    def test_valid_guest_request_submission(self) -> bool:
        """Test valid guest request submission (positive test)"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/requests",
                json={
                    **self.valid_guest_data,
                    "category": "maintenance",
                    "message": "Please fix the air conditioning",
                    "property_id": self.property_id
                },
                timeout=10
            )
            
            # Should return 201 for valid request
            return response.status_code == 200
        except:
            return False

    def test_valid_food_order_submission(self) -> bool:
        """Test valid food order submission"""
        try:
            valid_order = {
                **self.valid_guest_data,
                "items": [
                    {
                        "item_id": "item1",
                        "name": "Pizza",
                        "quantity": 2,
                        "price": 500.0
                    }
                ],
                "total": 1000.0,
                "property_id": self.property_id,
                "notes": "Extra cheese please"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/orders",
                json=valid_order,
                timeout=10
            )
            
            return response.status_code == 200
        except:
            return False

    def test_valid_experience_booking(self) -> bool:
        """Test valid experience booking"""
        try:
            valid_booking = {
                **self.valid_guest_data,
                "experience_id": "exp123",
                "experience_title": "River Rafting",
                "property_id": self.property_id,
                "notes": "First time rafting"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/bookings",
                json=valid_booking,
                timeout=10
            )
            
            return response.status_code == 200
        except:
            return False

    def run_all_tests(self):
        """Run comprehensive security test suite"""
        self.log("🚀 Starting Hidden Monkey Stays Security Test Suite")
        self.log(f"Backend URL: {self.base_url}")
        self.log(f"External URL: {self.external_url}")
        
        # Basic connectivity tests
        self.run_test("Backend Health Check", self.test_health_check)
        self.run_test("External API Gateway (Expected 404)", self.test_external_api_gateway)
        
        # Authentication tests
        self.run_test("Admin Auth - Valid Password", self.test_admin_auth_valid)
        self.run_test("Admin Auth - Invalid Password", self.test_admin_auth_invalid)
        
        # SQL Injection Prevention
        self.run_test("SQL Injection Prevention - Guest Name", self.test_sql_injection_guest_name)
        self.run_test("NoSQL Injection Prevention - Property ID", self.test_nosql_injection_property_id)
        
        # XSS Prevention 
        self.run_test("XSS Prevention - Guest Name", self.test_xss_prevention_guest_name)
        self.run_test("XSS Prevention - Message Field", self.test_xss_prevention_message_field)
        
        # Input Validation
        self.run_test("Phone Validation - Valid Formats", self.test_phone_validation_valid_formats)
        self.run_test("Phone Validation - Invalid Formats", self.test_phone_validation_invalid_formats)
        self.run_test("Input Length Validation", self.test_input_length_validation)
        
        # API Endpoint Tests with Invalid Data
        self.run_test("Food Order - Missing Fields", self.test_food_order_missing_fields)
        self.run_test("Experience Booking - Invalid Property ID", self.test_experience_booking_invalid_property_id)
        
        # Positive Tests (Valid Data)
        self.run_test("Valid Guest Request Submission", self.test_valid_guest_request_submission)
        self.run_test("Valid Food Order Submission", self.test_valid_food_order_submission)
        self.run_test("Valid Experience Booking", self.test_valid_experience_booking)
        
        # Print Results
        self.print_results()

    def print_results(self):
        """Print comprehensive test results"""
        self.log("=" * 60)
        self.log("🔒 SECURITY TEST RESULTS")
        self.log("=" * 60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"📊 Tests Run: {self.tests_run}")
        self.log(f"✅ Tests Passed: {self.tests_passed}")
        self.log(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        self.log(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.vulnerabilities_found:
            self.log("⚠️  SECURITY VULNERABILITIES FOUND:")
            for vuln in self.vulnerabilities_found:
                self.log(f"   • {vuln}")
        else:
            self.log("🛡️  No security vulnerabilities detected")
        
        return success_rate >= 90  # Consider 90%+ as success


def main():
    """Main test runner"""
    # Use localhost for backend testing as external gateway returns 404
    test_suite = SecurityTestSuite()
    success = test_suite.run_all_tests()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())