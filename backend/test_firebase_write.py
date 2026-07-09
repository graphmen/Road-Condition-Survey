import asyncio
import os
from dotenv import load_dotenv
from services.firebase_storage import insert_survey

load_dotenv()

async def test_write():
    test_record = {
        "id": "test-survey-uuid-firebase-123",
        "asset_category": "sealed",
        "road_name": "A4 Highway (Harare - Masvingo - Beitbridge)",
        "section_name": "Test Section Firebase ZINGSA",
        "surveyor_name": "Eng. Test Firebase ZINGSA",
        "survey_date": "2026-05-29",
        "gps": "-17.8292 31.0522 1200 3",
        "road_segment_points": [],
        "road_segment_geojson": "",
        "road_segment_length_m": 0,
        "road_segment_point_count": 0,
        "road_segment_avg_accuracy_m": 0,
        "paved_road_condition": "good",
        "paved_road_class": "primary"
    }

    print("Attempting to insert test record into Firebase Firestore...")
    try:
        res = await insert_survey(test_record)
        print("[SUCCESS] Firebase Firestore write succeeded! Return data:", res)
    except Exception as e:
        print("[ERROR] Firebase Firestore write failed with error:", e)

if __name__ == "__main__":
    asyncio.run(test_write())
