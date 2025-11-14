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
        
    async def log_result(self, test_name: str, success: bool, details: str = "", data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if data and not success:
            print(f"   Data: {json.dumps(data, indent=2, default=str)}")
    
    async def test_create_stream_with_livepeer(self):
        """Test POST /api/streams - Create stream with Livepeer integration"""
        test_name = "POST /api/streams - Livepeer Integration"
        
        try:
            payload = {
                "user_id": TEST_USER_ID,
                "lat": TEST_LOCATION["lat"],
                "lng": TEST_LOCATION["lng"],
                "privacy_mode": "exact",
                "device_camera": "back"
            }
            
            response = await self.client.post(f"{BACKEND_URL}/streams", json=payload)
            
            if response.status_code not in [200, 201]:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return None
            
            data = response.json()
            
            # Verify required Livepeer fields are present
            required_fields = ["rtmp_ingest_url", "rtmp_stream_key", "livepeer_stream_id", "livepeer_playback_id"]
            missing_fields = []
            
            for field in required_fields:
                if field not in data or data[field] is None:
                    missing_fields.append(field)
            
            if missing_fields:
                await self.log_result(test_name, False, f"Missing Livepeer fields: {missing_fields}", data)
                return None
            
            # Verify field formats
            if not data["rtmp_ingest_url"].startswith("rtmp://"):
                await self.log_result(test_name, False, "Invalid RTMP ingest URL format", data)
                return None
            
            if not data["livepeer_stream_id"]:
                await self.log_result(test_name, False, "Empty livepeer_stream_id", data)
                return None
            
            if not data["livepeer_playback_id"]:
                await self.log_result(test_name, False, "Empty livepeer_playback_id", data)
                return None
            
            # Store for cleanup
            self.created_streams.append(data["id"])
            
            await self.log_result(test_name, True, "Stream created with all Livepeer credentials", {
                "stream_id": data["id"],
                "livepeer_stream_id": data["livepeer_stream_id"],
                "livepeer_playback_id": data["livepeer_playback_id"],
                "rtmp_ingest_url": data["rtmp_ingest_url"][:50] + "..." if len(data["rtmp_ingest_url"]) > 50 else data["rtmp_ingest_url"]
            })
            
            return data
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
            return None
    
    async def test_live_streams_include_playback_id(self):
        """Test GET /api/streams/live - Verify livepeer_playback_id is included"""
        test_name = "GET /api/streams/live - Livepeer Playback ID"
        
        try:
            response = await self.client.get(f"{BACKEND_URL}/streams/live")
            
            if response.status_code != 200:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            streams = data.get("streams", [])
            
            if not streams:
                await self.log_result(test_name, True, "No live streams to verify (expected if no streams created)")
                return
            
            # Check if any stream has livepeer_playback_id
            streams_with_playback_id = [s for s in streams if s.get("livepeer_playback_id")]
            
            if not streams_with_playback_id:
                await self.log_result(test_name, False, "No streams have livepeer_playback_id field", {
                    "total_streams": len(streams),
                    "sample_stream": streams[0] if streams else None
                })
                return
            
            await self.log_result(test_name, True, f"Found {len(streams_with_playback_id)} streams with livepeer_playback_id", {
                "total_streams": len(streams),
                "streams_with_playback_id": len(streams_with_playback_id)
            })
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def test_stream_playback_endpoint(self, stream_id: str):
        """Test GET /api/streams/{stream_id}/playback - New playback endpoint"""
        test_name = f"GET /api/streams/{stream_id}/playback - Playback URL Construction"
        
        try:
            response = await self.client.get(f"{BACKEND_URL}/streams/{stream_id}/playback")
            
            if response.status_code != 200:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            
            # Verify required fields
            required_fields = ["stream_id", "playback_url", "livepeer_playback_id", "status"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                await self.log_result(test_name, False, f"Missing fields: {missing_fields}", data)
                return
            
            # Verify playback URL format
            playback_url = data["playback_url"]
            expected_pattern = "https://livepeercdn.studio/hls/"
            
            if not playback_url or not playback_url.startswith(expected_pattern):
                await self.log_result(test_name, False, f"Invalid playback URL format. Expected to start with {expected_pattern}", data)
                return
            
            if not playback_url.endswith("/index.m3u8"):
                await self.log_result(test_name, False, "Playback URL should end with /index.m3u8", data)
                return
            
            await self.log_result(test_name, True, "Playback URL correctly constructed from livepeer_playback_id", {
                "playback_url": playback_url,
                "livepeer_playback_id": data["livepeer_playback_id"]
            })
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def test_event_streams_include_playback_id(self, event_id: str):
        """Test GET /api/events/{event_id} - Verify event streams include livepeer_playback_id"""
        test_name = f"GET /api/events/{event_id} - Event Streams Livepeer Playback ID"
        
        try:
            response = await self.client.get(f"{BACKEND_URL}/events/{event_id}")
            
            if response.status_code != 200:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            streams = data.get("streams", [])
            
            if not streams:
                await self.log_result(test_name, True, "No streams in event to verify")
                return
            
            # Check if streams have livepeer_playback_id
            streams_with_playback_id = [s for s in streams if s.get("livepeer_playback_id")]
            
            if not streams_with_playback_id:
                await self.log_result(test_name, False, "Event streams missing livepeer_playback_id field", {
                    "total_streams": len(streams),
                    "sample_stream": streams[0] if streams else None
                })
                return
            
            await self.log_result(test_name, True, f"Event streams include livepeer_playback_id", {
                "total_streams": len(streams),
                "streams_with_playback_id": len(streams_with_playback_id)
            })
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def test_livepeer_webhook_stream_started(self):
        """Test POST /api/webhooks/livepeer - stream.started event"""
        test_name = "POST /api/webhooks/livepeer - stream.started"
        
        try:
            payload = {
                "event": "stream.started",
                "id": "webhook-test-001",
                "payload": {
                    "id": "test-livepeer-stream-id",
                    "name": "test-stream",
                    "isActive": True
                }
            }
            
            response = await self.client.post(f"{BACKEND_URL}/webhooks/livepeer", json=payload)
            
            if response.status_code not in [200, 201]:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            
            if data.get("status") != "received":
                await self.log_result(test_name, False, "Webhook not properly received", data)
                return
            
            if data.get("event") != "stream.started":
                await self.log_result(test_name, False, "Webhook event type not preserved", data)
                return
            
            await self.log_result(test_name, True, "stream.started webhook processed successfully", data)
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def test_livepeer_webhook_stream_idle(self):
        """Test POST /api/webhooks/livepeer - stream.idle event"""
        test_name = "POST /api/webhooks/livepeer - stream.idle"
        
        try:
            payload = {
                "event": "stream.idle",
                "id": "webhook-test-002",
                "payload": {
                    "id": "test-livepeer-stream-id",
                    "name": "test-stream",
                    "isActive": False
                }
            }
            
            response = await self.client.post(f"{BACKEND_URL}/webhooks/livepeer", json=payload)
            
            if response.status_code not in [200, 201]:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            
            if data.get("status") != "received":
                await self.log_result(test_name, False, "Webhook not properly received", data)
                return
            
            if data.get("event") != "stream.idle":
                await self.log_result(test_name, False, "Webhook event type not preserved", data)
                return
            
            await self.log_result(test_name, True, "stream.idle webhook processed successfully", data)
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def test_livepeer_webhook_recording_ready(self):
        """Test POST /api/webhooks/livepeer - recording.ready event"""
        test_name = "POST /api/webhooks/livepeer - recording.ready"
        
        try:
            payload = {
                "event": "recording.ready",
                "id": "webhook-test-003",
                "payload": {
                    "id": "test-recording-id",
                    "downloadUrl": "https://livepeer.studio/recordings/test-recording.mp4",
                    "stream": {
                        "id": "test-livepeer-stream-id"
                    }
                }
            }
            
            response = await self.client.post(f"{BACKEND_URL}/webhooks/livepeer", json=payload)
            
            if response.status_code not in [200, 201]:
                await self.log_result(test_name, False, f"HTTP {response.status_code}", response.text)
                return
            
            data = response.json()
            
            if data.get("status") != "received":
                await self.log_result(test_name, False, "Webhook not properly received", data)
                return
            
            if data.get("event") != "recording.ready":
                await self.log_result(test_name, False, "Webhook event type not preserved", data)
                return
            
            await self.log_result(test_name, True, "recording.ready webhook processed successfully", data)
            
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")
    
    async def create_test_event(self):
        """Create a second stream to trigger event clustering"""
        try:
            # Create second stream nearby to trigger event clustering
            payload = {
                "user_id": f"{TEST_USER_ID}-2",
                "lat": TEST_LOCATION["lat"] + 0.0001,  # Very close to first stream
                "lng": TEST_LOCATION["lng"] + 0.0001,
                "privacy_mode": "exact",
                "device_camera": "front"
            }
            
            response = await self.client.post(f"{BACKEND_URL}/streams", json=payload)
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.created_streams.append(data["id"])
                
                # Check if event was created
                if data.get("event_id"):
                    self.created_events.append(data["event_id"])
                    return data["event_id"]
            
            return None
            
        except Exception as e:
            print(f"Error creating test event: {e}")
            return None
    
    async def cleanup_test_data(self):
        """Clean up created test streams"""
        print("\n🧹 Cleaning up test data...")
        
        for stream_id in self.created_streams:
            try:
                response = await self.client.post(f"{BACKEND_URL}/streams/{stream_id}/end")
                if response.status_code == 200:
                    print(f"   ✅ Ended stream {stream_id}")
                else:
                    print(f"   ⚠️  Failed to end stream {stream_id}: HTTP {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error ending stream {stream_id}: {e}")
    
    async def run_all_tests(self):
        """Run all Livepeer integration tests"""
        print("🚀 Starting Livepeer Integration Tests for Allsee MVP")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Location: Istanbul, Turkey ({TEST_LOCATION['lat']}, {TEST_LOCATION['lng']})")
        print(f"Test User: {TEST_USER_ID}")
        print("=" * 80)
        
        try:
            # Test 1: Create stream with Livepeer integration
            stream_data = await self.test_create_stream_with_livepeer()
            
            # Test 2: Verify live streams include playback ID
            await self.test_live_streams_include_playback_id()
            
            # Test 3: Test playback endpoint (if we have a stream)
            if stream_data and stream_data.get("id"):
                await self.test_stream_playback_endpoint(stream_data["id"])
            
            # Test 4: Create event and test event streams
            event_id = await self.create_test_event()
            if event_id:
                await self.test_event_streams_include_playback_id(event_id)
            
            # Test 5-7: Test webhook endpoints
            await self.test_livepeer_webhook_stream_started()
            await self.test_livepeer_webhook_stream_idle()
            await self.test_livepeer_webhook_recording_ready()
            
        finally:
            # Cleanup
            await self.cleanup_test_data()
            await self.client.aclose()
        
        # Print summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests

async def main():
    """Main test runner"""
    tester = LivepeerIntegrationTester()
    passed, failed = await tester.run_all_tests()
    
    # Exit with error code if tests failed
    if failed > 0:
        exit(1)
    else:
        print("\n🎉 All Livepeer integration tests passed!")
        exit(0)

if __name__ == "__main__":
    asyncio.run(main())