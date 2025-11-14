#!/usr/bin/env python3
"""
Backend API Testing for Allsee MVP - Livepeer Integration
Tests the new Livepeer integration endpoints and functionality.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Test configuration
BACKEND_URL = "https://social-mapview.preview.emergentagent.com/api"
TEST_USER_ID = "demo-user"
TEST_LOCATION = {
    "lat": 41.0082,  # Istanbul, Turkey
    "lng": 28.9784
}

class LivepeerIntegrationTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.created_streams = []
        self.created_events = []
        
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2, default=str)}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
                
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
                
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
    
    def test_1_sanity_check(self):
        """Test 1: Sanity check - GET /api/ should return Hello World"""
        success, data, status_code = self.make_request('GET', '/api/')
        
        if success and data.get('message') == 'Hello World':
            self.log_result("Sanity Check", True, f"API responding correctly (status: {status_code})", data)
        else:
            self.log_result("Sanity Check", False, f"API not responding as expected (status: {status_code})", data)
    
    def test_2_create_stream_a(self):
        """Test 2: Create Stream A with exact privacy in Istanbul"""
        payload = {
            "user_id": "user_istanbul_1",
            "lat": 41.0082,
            "lng": 28.9784,
            "privacy_mode": "exact",
            "device_camera": "back"
        }
        
        success, data, status_code = self.make_request('POST', '/api/streams', payload)
        
        if success and status_code == 200:
            if 'id' in data and data.get('status') == 'live':
                self.stream_a_id = data['id']
                # Verify coordinates are exact (not masked)
                if abs(data.get('lat', 0) - 41.0082) < 0.0001 and abs(data.get('lng', 0) - 28.9784) < 0.0001:
                    self.log_result("Create Stream A", True, f"Stream created successfully with exact coordinates (ID: {self.stream_a_id})", data)
                else:
                    self.log_result("Create Stream A", False, "Stream created but coordinates are not exact as expected", data)
            else:
                self.log_result("Create Stream A", False, "Stream created but missing required fields", data)
        else:
            self.log_result("Create Stream A", False, f"Failed to create stream (status: {status_code})", data)
    
    def test_3_create_stream_b(self):
        """Test 3: Create Stream B near A (within 50m) to trigger clustering"""
        # Wait a moment to ensure different timestamps
        time.sleep(1)
        
        payload = {
            "user_id": "user_istanbul_2", 
            "lat": 41.00825,  # ~5m north of Stream A
            "lng": 28.97845,  # ~5m east of Stream A
            "privacy_mode": "masked_100m",
            "device_camera": "front"
        }
        
        success, data, status_code = self.make_request('POST', '/api/streams', payload)
        
        if success and status_code == 200:
            if 'id' in data and data.get('status') == 'live':
                self.stream_b_id = data['id']
                # Check if event_id is set (clustering should have occurred)
                if data.get('event_id'):
                    self.event_id = data['event_id']
                    # Verify coordinates are masked (should be different from exact input)
                    coord_diff = abs(data.get('lat', 0) - 41.00825) + abs(data.get('lng', 0) - 28.97845)
                    if coord_diff > 0.0001:  # Should be masked
                        self.log_result("Create Stream B", True, f"Stream created with clustering (ID: {self.stream_b_id}, Event: {self.event_id}), coordinates properly masked", data)
                    else:
                        self.log_result("Create Stream B", False, "Stream created with clustering but coordinates not masked as expected", data)
                else:
                    self.log_result("Create Stream B", False, "Stream created but no event_id set - clustering may have failed", data)
            else:
                self.log_result("Create Stream B", False, "Stream created but missing required fields", data)
        else:
            self.log_result("Create Stream B", False, f"Failed to create stream (status: {status_code})", data)
    
    def test_4_list_live_streams(self):
        """Test 4: List live streams in bbox around Istanbul"""
        params = {
            'ne': '41.02,29.0',
            'sw': '41.0,28.95'
        }
        
        success, data, status_code = self.make_request('GET', '/api/streams/live', params=params)
        
        if success and status_code == 200:
            streams = data.get('streams', [])
            if len(streams) >= 2:
                # Check if our streams are in the list
                stream_ids = [s.get('id') for s in streams]
                has_stream_a = self.stream_a_id in stream_ids
                has_stream_b = self.stream_b_id in stream_ids
                
                if has_stream_a and has_stream_b:
                    # Verify masking is applied correctly
                    masked_stream = next((s for s in streams if s.get('privacy_mode') == 'masked_100m'), None)
                    exact_stream = next((s for s in streams if s.get('privacy_mode') == 'exact'), None)
                    
                    masking_correct = True
                    if masked_stream:
                        # Masked coordinates should be different from original
                        coord_diff = abs(masked_stream.get('lat', 0) - 41.00825) + abs(masked_stream.get('lng', 0) - 28.97845)
                        if coord_diff < 0.0001:
                            masking_correct = False
                    
                    if masking_correct:
                        self.log_result("List Live Streams", True, f"Found {len(streams)} streams with proper masking", data)
                    else:
                        self.log_result("List Live Streams", False, f"Found {len(streams)} streams but masking not applied correctly", data)
                else:
                    self.log_result("List Live Streams", False, f"Found {len(streams)} streams but missing our test streams", data)
            else:
                self.log_result("List Live Streams", False, f"Expected at least 2 streams, found {len(streams)}", data)
        else:
            self.log_result("List Live Streams", False, f"Failed to list streams (status: {status_code})", data)
    
    def test_5_list_live_events(self):
        """Test 5: List live events in bbox around Istanbul"""
        params = {
            'ne': '41.02,29.0',
            'sw': '41.0,28.95'
        }
        
        success, data, status_code = self.make_request('GET', '/api/events/live', params=params)
        
        if success and status_code == 200:
            if isinstance(data, list) and len(data) >= 1:
                event = data[0]
                if event.get('stream_count', 0) >= 2:
                    # Store event_id if we don't have it
                    if not self.event_id:
                        self.event_id = event.get('id')
                    self.log_result("List Live Events", True, f"Found 1 live event with {event.get('stream_count')} streams", data)
                else:
                    self.log_result("List Live Events", False, f"Found event but stream_count is {event.get('stream_count')}, expected >= 2", data)
            else:
                self.log_result("List Live Events", False, f"Expected at least 1 event, found {len(data) if isinstance(data, list) else 0}", data)
        else:
            self.log_result("List Live Events", False, f"Failed to list events (status: {status_code})", data)
    
    def test_6_get_event_details(self):
        """Test 6: Get event details"""
        if not self.event_id:
            self.log_result("Get Event Details", False, "No event_id available for testing", None)
            return
            
        success, data, status_code = self.make_request('GET', f'/api/events/{self.event_id}')
        
        if success and status_code == 200:
            event = data.get('event', {})
            streams = data.get('streams', [])
            
            if event and len(streams) >= 2:
                # Verify masking in streams
                masked_streams = [s for s in streams if s.get('privacy_mode') == 'masked_100m']
                exact_streams = [s for s in streams if s.get('privacy_mode') == 'exact']
                
                masking_correct = True
                for masked_stream in masked_streams:
                    # Check if coordinates are actually masked
                    coord_diff = abs(masked_stream.get('lat', 0) - 41.00825) + abs(masked_stream.get('lng', 0) - 28.97845)
                    if coord_diff < 0.0001:
                        masking_correct = False
                        break
                
                if masking_correct:
                    self.log_result("Get Event Details", True, f"Event details retrieved with {len(streams)} streams, masking applied correctly", data)
                else:
                    self.log_result("Get Event Details", False, f"Event details retrieved but masking not applied correctly", data)
            else:
                self.log_result("Get Event Details", False, f"Event details incomplete - event: {bool(event)}, streams: {len(streams)}", data)
        else:
            self.log_result("Get Event Details", False, f"Failed to get event details (status: {status_code})", data)
    
    def test_7_end_streams(self):
        """Test 7: End both streams and verify event status"""
        # End Stream A
        if self.stream_a_id:
            success_a, data_a, status_a = self.make_request('POST', f'/api/streams/{self.stream_a_id}/end')
            if success_a and status_a == 200:
                self.log_result("End Stream A", True, f"Stream A ended successfully", data_a)
            else:
                self.log_result("End Stream A", False, f"Failed to end Stream A (status: {status_a})", data_a)
        
        # End Stream B
        if self.stream_b_id:
            success_b, data_b, status_b = self.make_request('POST', f'/api/streams/{self.stream_b_id}/end')
            if success_b and status_b == 200:
                self.log_result("End Stream B", True, f"Stream B ended successfully", data_b)
            else:
                self.log_result("End Stream B", False, f"Failed to end Stream B (status: {status_b})", data_b)
        
        # Wait a moment for event status to update
        time.sleep(2)
        
        # Check event status
        if self.event_id:
            success, data, status_code = self.make_request('GET', f'/api/events/{self.event_id}')
            if success and status_code == 200:
                event = data.get('event', {})
                if event.get('status') == 'ended':
                    self.log_result("Event Auto-End", True, "Event status correctly updated to 'ended' after all streams ended", data)
                else:
                    self.log_result("Event Auto-End", False, f"Event status is '{event.get('status')}', expected 'ended'", data)
            else:
                self.log_result("Event Auto-End", False, f"Failed to check event status (status: {status_code})", data)
        
        # Verify event no longer appears in live events
        params = {'ne': '41.02,29.0', 'sw': '41.0,28.95'}
        success, data, status_code = self.make_request('GET', '/api/events/live', params=params)
        if success and status_code == 200:
            live_events = data if isinstance(data, list) else []
            event_ids = [e.get('id') for e in live_events]
            if self.event_id not in event_ids:
                self.log_result("Event Removed from Live", True, "Event no longer appears in live events list", data)
            else:
                self.log_result("Event Removed from Live", False, "Event still appears in live events list", data)
        else:
            self.log_result("Event Removed from Live", False, f"Failed to check live events (status: {status_code})", data)
    
    def validate_date_fields(self):
        """Validate that date fields are ISO strings in responses"""
        date_validation_passed = True
        date_issues = []
        
        for result in self.results:
            if result.get('response_data') and result['success']:
                data = result['response_data']
                
                # Check various date fields
                date_fields_to_check = []
                
                if isinstance(data, dict):
                    # Stream responses
                    if 'started_at' in data:
                        date_fields_to_check.append(('started_at', data['started_at']))
                    if 'ended_at' in data and data['ended_at']:
                        date_fields_to_check.append(('ended_at', data['ended_at']))
                    
                    # Event responses
                    if 'created_at' in data:
                        date_fields_to_check.append(('created_at', data['created_at']))
                    
                    # Nested structures
                    if 'streams' in data:
                        for stream in data['streams']:
                            if 'started_at' in stream:
                                date_fields_to_check.append(('stream.started_at', stream['started_at']))
                    
                    if 'event' in data and isinstance(data['event'], dict):
                        event = data['event']
                        if 'created_at' in event:
                            date_fields_to_check.append(('event.created_at', event['created_at']))
                
                elif isinstance(data, list):
                    # List of events/streams
                    for item in data:
                        if isinstance(item, dict):
                            if 'started_at' in item:
                                date_fields_to_check.append(('item.started_at', item['started_at']))
                            if 'created_at' in item:
                                date_fields_to_check.append(('item.created_at', item['created_at']))
                
                # Validate each date field
                for field_name, date_value in date_fields_to_check:
                    if isinstance(date_value, str):
                        try:
                            datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                        except ValueError:
                            date_validation_passed = False
                            date_issues.append(f"{result['test']}: {field_name} = '{date_value}' is not valid ISO format")
                    else:
                        date_validation_passed = False
                        date_issues.append(f"{result['test']}: {field_name} is not a string (type: {type(date_value)})")
        
        if date_validation_passed:
            self.log_result("Date Field Validation", True, "All date fields are properly formatted as ISO strings", None)
        else:
            self.log_result("Date Field Validation", False, f"Date field issues found: {'; '.join(date_issues)}", None)
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Tests for Allsee MVP")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Run tests in sequence
        self.test_1_sanity_check()
        self.test_2_create_stream_a()
        self.test_3_create_stream_b()
        self.test_4_list_live_streams()
        self.test_5_list_live_events()
        self.test_6_get_event_details()
        self.test_7_end_streams()
        
        # Validate date fields
        self.validate_date_fields()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['details']}")
        
        # Critical issues
        critical_failures = [r for r in self.results if not r['success'] and r['test'] in [
            'Sanity Check', 'Create Stream A', 'Create Stream B', 'List Live Events'
        ]]
        
        if critical_failures:
            print(f"\n🚨 CRITICAL ISSUES FOUND ({len(critical_failures)}):")
            for failure in critical_failures:
                print(f"   ❌ {failure['test']}: {failure['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)