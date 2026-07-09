from fastapi import APIRouter, HTTPException
from backend.services import survey_utils, dual_storage, supabase_storage

router = APIRouter(prefix="/api/roads", tags=["roads"])

@router.get("")
async def get_roads():
    try:
        db_records = await supabase_storage.get_all_surveys()
        
        records = []
        for row in db_records:
            # Reconstruct the original record from raw_data or database columns
            record = row.get("raw_data")
            if not record or not isinstance(record, dict):
                record = {
                    "id": row.get("survey_id"),
                    "asset_category": row.get("asset_category"),
                    "road_name": row.get("road_name"),
                    "section_name": row.get("section_name"),
                    "surveyor_name": row.get("surveyor_name"),
                    "survey_date": row.get("survey_date"),
                    "gps": row.get("gps_point"),
                    "road_segment_geojson": row.get("segment_geojson"),
                    "road_segment_length_m": row.get("segment_length_m"),
                    "road_segment_point_count": row.get("segment_point_count"),
                    "road_segment_avg_accuracy_m": row.get("segment_avg_accuracy"),
                    "road_segment_start_time": row.get("segment_start_time"),
                    "road_segment_end_time": row.get("segment_end_time"),
                    "paved_road_condition": row.get("road_condition"),
                    "paved_road_class": row.get("road_class"),
                    "photo": row.get("photo"),
                }
            
            # Map dashboard specific keys if missing
            if "_id" not in record and record.get("id"):
                record["_id"] = record["id"]
            if "id" not in record and record.get("_id"):
                record["id"] = record["_id"]
                
            record = survey_utils.normalise_record(record)
            records.append(record)
            
        return {
            "count": len(records),
            "records": records,
            "source": "supabase"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def create_road_survey(record: dict):
    try:
        saved_record = await dual_storage.create_survey(record)
        return {"success": True, "record": saved_record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{record_id}")
async def delete_road_survey(record_id: str):
    try:
        success = await dual_storage.delete_survey(record_id)
        if not success:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"success": True, "message": f"Successfully deleted record {record_id}!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{record_id}")
async def update_road_survey(record_id: str, record: dict):
    try:
        updated_record = await dual_storage.update_survey(record_id, record)
        if not updated_record:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"success": True, "record": updated_record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


