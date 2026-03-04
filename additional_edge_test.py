#!/usr/bin/env python3
"""
Additional edge case testing for comprehensive coverage
"""
import requests
import json

def test_additional_edge_cases():
    """Test additional security edge cases"""
    print("🔍 Testing Additional Edge Cases")
    
    base_url = "http://localhost:8001"
    valid_guest_data = {
        "guest_name": "John Doe", 
        "room_number": "A101",
        "whatsapp": "+919876543210",
        "notes": "Test guest"
    }
    property_id = "test_property"
    
    session = requests.Session()
    
    # Test XSS in different fields
    xss_payload = "<script>alert('XSS')</script>"
    
    fields_to_test = ["guest_name", "room_number", "notes", "whatsapp"]
    
    print("\n--- XSS Prevention Test ---")
    for field in fields_to_test:
        try:
            data = valid_guest_data.copy()
            data[field] = xss_payload
            
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
            
            print(f"XSS in {field}: Status {response.status_code} {'✅' if response.status_code == 422 else '❌'}")
            
        except Exception as e:
            print(f"XSS in {field}: ERROR - {e}")
    
    # Test NoSQL injection patterns
    print("\n--- NoSQL Injection Prevention Test ---")
    nosql_patterns = ['{"$ne": null}', '$where', '$gt', '$regex']
    
    for pattern in nosql_patterns:
        try:
            data = valid_guest_data.copy()
            data["property_id"] = pattern
            
            response = session.post(
                f"{base_url}/api/requests",
                json={
                    **data,
                    "category": "maintenance",
                    "message": "Test request"
                },
                timeout=10
            )
            
            print(f"NoSQL pattern '{pattern}': Status {response.status_code} {'✅' if response.status_code == 422 else '❌'}")
            
        except Exception as e:
            print(f"NoSQL pattern '{pattern}': ERROR - {e}")

    # Test food order validation
    print("\n--- Food Order Validation Test ---")
    try:
        # Valid order
        valid_order = {
            **valid_guest_data,
            "items": [
                {"item_id": "item1", "name": "Pizza", "quantity": 1, "price": 500.0}
            ],
            "total": 500.0,
            "property_id": property_id
        }
        
        response = session.post(f"{base_url}/api/orders", json=valid_order, timeout=10)
        print(f"Valid food order: Status {response.status_code} {'✅' if response.status_code == 200 else '❌'}")
        
        # Invalid order with XSS in item name
        invalid_order = {
            **valid_guest_data,
            "items": [
                {"item_id": "item1", "name": "<script>alert('XSS')</script>", "quantity": 1, "price": 500.0}
            ],
            "total": 500.0,
            "property_id": property_id
        }
        
        response = session.post(f"{base_url}/api/orders", json=invalid_order, timeout=10)
        print(f"XSS in food item name: Status {response.status_code} {'✅' if response.status_code == 422 else '❌'}")
        
    except Exception as e:
        print(f"Food order test: ERROR - {e}")

if __name__ == "__main__":
    test_additional_edge_cases()