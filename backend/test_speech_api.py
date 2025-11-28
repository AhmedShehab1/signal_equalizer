#!/usr/bin/env python3
"""
Quick manual test of speech separation endpoints.
Tests the endpoints without pytest dependency.
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app

def test_api_info():
    """Test that API info includes speech endpoints"""
    print("=" * 80)
    print("TEST 1: API Info Endpoint")
    print("=" * 80)
    
    client = TestClient(app)
    response = client.get("/api/info")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    print(f"✅ API Info Response: {json.dumps(data, indent=2)}")
    
    assert "endpoints" in data
    assert "speech_separate" in data["endpoints"]
    assert "speech_sample" in data["endpoints"]
    
    print("✅ Speech endpoints found in API info")
    return True

def test_speech_separate_validation():
    """Test speech-separate endpoint validation"""
    print("\n" + "=" * 80)
    print("TEST 2: Speech Separation Endpoint Validation")
    print("=" * 80)
    
    client = TestClient(app)
    
    # Test missing file
    print("\nTesting missing file...")
    response = client.post("/api/audio/speech-separate")
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    print("✅ Correctly rejects missing file")
    
    # Test invalid max_duration
    print("\nTesting invalid max_duration...")
    response = client.get("/api/audio/speech-sample?max_duration=-1")
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    print("✅ Correctly validates max_duration parameter")
    
    return True

def test_speech_sample():
    """Test speech sample endpoint"""
    print("\n" + "=" * 80)
    print("TEST 3: Speech Sample Endpoint")
    print("=" * 80)
    
    client = TestClient(app)
    
    print("\nTesting speech sample with max_duration=3, no spectrograms...")
    response = client.get("/api/audio/speech-sample?max_duration=3&spectrograms=false")
    
    if response.status_code == 404:
        print("⚠️  Speech sample file not found, skipping test")
        return True
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    print(f"\n📊 Response structure:")
    print(f"  - sample_rate: {data.get('sample_rate')}")
    print(f"  - num_sources: {data.get('num_sources')}")
    print(f"  - sources: {list(data.get('sources', {}).keys())}")
    
    # Verify structure
    assert "sample_rate" in data
    assert data["sample_rate"] == 8000
    assert "num_sources" in data
    assert "sources" in data
    
    # Verify no spectrograms when spectrograms=false
    for source_name, source_data in data["sources"].items():
        assert "spectrogram" not in source_data, f"Source {source_name} should not have spectrogram"
    
    print("✅ Speech sample endpoint works correctly")
    return True

def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("SPEECH SEPARATION ENDPOINTS - QUICK TEST SUITE")
    print("=" * 80)
    
    tests = [
        ("API Info", test_api_info),
        ("Validation", test_speech_separate_validation),
        ("Speech Sample", test_speech_sample),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ Test '{test_name}' failed: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("=" * 80)
    
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
