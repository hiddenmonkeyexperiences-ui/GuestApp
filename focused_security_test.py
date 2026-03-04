#!/usr/bin/env python3
"""
Focused Security Testing - Investigating specific failing tests
"""
import requests
import json

def test_phone_validation_detailed():
    """Test phone validation with detailed feedback"""
    print("🔍 Testing Phone Validation (Detailed)")
    
    base_url = "http://localhost:8001"
    valid_guest_data = {
        "guest_name": "John Doe", 
        "room_number": "A101",
        "whatsapp": "+919876543210",
        "notes": "Test guest"
    }
    property_id = "test_property"
    
    invalid_phones = [
        "123",  # Too short
        "abcdefghij",  # Letters
        "++919876543210",  # Double plus
        "919876543210919876543210",  # Too long
        "<script>alert('xss')</script>",  # Script tag
        "",  # Empty
        "   "  # Whitespace only
    ]
    
    session = requests.Session()
    
    for phone in invalid_phones:
        try:
            data = valid_guest_data.copy()
            data["whatsapp"] = phone
            
            response = session.post(
                f"{base_url}/api/requests",
                json={
                    **data,
                    "category": "maintenance",
                    "message": "Test request",
                    "property_id": property_id
                },
                timeout=10
            )
            
            print(f"Phone: '{phone}' -> Status: {response.status_code}")
            if response.status_code != 422:
                print(f"  ❌ Expected 422, got {response.status_code}")
                try:
                    print(f"  Response: {response.json()}")
                except:
                    print(f"  Response text: {response.text}")
            else:
                print(f"  ✅ Correctly rejected")
                
        except Exception as e:
            print(f"Phone: '{phone}' -> ERROR: {e}")

def test_input_length_detailed():
    """Test input length validation with detailed feedback"""
    print("\n🔍 Testing Input Length Validation (Detailed)")
    
    base_url = "http://localhost:8001"
    valid_guest_data = {
        "guest_name": "John Doe", 
        "room_number": "A101",
        "whatsapp": "+919876543210",
        "notes": "Test guest"
    }
    property_id = "test_property"
    
    # Test very long strings
    very_long_string = "A" * 10000
    
    test_cases = [
        ("guest_name", very_long_string),
        ("room_number", "A" * 100),
        ("notes", very_long_string),
        ("whatsapp", "1" * 100)
    ]
    
    session = requests.Session()
    
    for field, test_value in test_cases:
        try:
            data = valid_guest_data.copy()
            data[field] = test_value
            
            response = session.post(
                f"{base_url}/api/requests",
                json={
                    **data,
                    "category": "maintenance",
                    "message": "Test",
                    "property_id": property_id
                },
                timeout=10
            )
            
            print(f"Field: '{field}' (length: {len(test_value)}) -> Status: {response.status_code}")
            if response.status_code != 422:
                print(f"  ❌ Expected 422, got {response.status_code}")
                try:
                    print(f"  Response: {response.json()}")
                except:
                    print(f"  Response text: {response.text}")
            else:
                print(f"  ✅ Correctly rejected")
                
        except Exception as e:
            print(f"Field: '{field}' -> ERROR: {e}")

def test_specific_sql_injection_patterns():
    """Test the specific SQL injection patterns mentioned in the review request"""
    print("\n🔍 Testing Specific SQL Injection Patterns")
    
    base_url = "http://localhost:8001"
    valid_guest_data = {
        "guest_name": "John Doe", 
        "room_number": "A101",
        "whatsapp": "+919876543210",
        "notes": "Test guest"
    }
    property_id = "test_property"
    
    # Specific patterns from the review request
    sql_patterns = [
        "admin'--",
        "OR 1=1",
        "'OR 1=1'",
        "' OR 1=1 --",
        "admin'; DROP TABLE users; --"
    ]
    
    session = requests.Session()
    
    for pattern in sql_patterns:
        try:
            data = valid_guest_data.copy()
            data["guest_name"] = pattern
            
            response = session.post(
                f"{base_url}/api/requests",
                json={
                    **data,
                    "category": "maintenance",
                    "message": "Test request",
                    "property_id": property_id
                },
                timeout=10
            )
            
            print(f"SQL Pattern: '{pattern}' -> Status: {response.status_code}")
            if response.status_code == 500:
                print(f"  ❌ CRITICAL: Still returns 500 (should be 422)")
                try:
                    print(f"  Response: {response.json()}")
                except:
                    print(f"  Response text: {response.text}")
            elif response.status_code == 422:
                print(f"  ✅ Correctly returns 422")
            else:
                print(f"  ⚠️ Unexpected status: {response.status_code}")
                
        except Exception as e:
            print(f"SQL Pattern: '{pattern}' -> ERROR: {e}")

if __name__ == "__main__":
    test_specific_sql_injection_patterns()
    test_phone_validation_detailed()
    test_input_length_detailed()