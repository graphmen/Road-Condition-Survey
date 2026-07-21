"""
Dual Storage Orchestrator
Coordinates operations across:
1. Local Cache (via survey_utils.py)
2. Supabase (Primary PostgreSQL + PostGIS)
3. Firebase Firestore (Backup / Tier 2)
"""

import logging
from typing import Optional
from backend.services import survey_utils, supabase_storage, firebase_storage

logger = logging.getLogger(__name__)

async def create_survey(record: dict) -> dict:
    """
    Saves a new survey to:
    1. Local Cache (so current UI / maps display it instantly)
    2. Supabase (Primary)
    3. Firebase Firestore (Backup)
    """
    # 1. Local Cache (always write first as it's our local source of truth/mock)
    saved_record = survey_utils.add_new_survey(record)
    
    # 2. Supabase (Primary) - MUST succeed
    await supabase_storage.insert_survey(saved_record)

    # 3. Firebase (Backup) - secondary, log failure but don't block
    try:
        await firebase_storage.insert_survey(saved_record)
    except Exception as e:
        logger.error(f"Failed to write survey {saved_record.get('id')} to Firebase: {e}", exc_info=True)

    return saved_record

async def update_survey(survey_id: str, record: dict) -> Optional[dict]:
    """
    Updates a survey in:
    1. Local Cache
    2. Supabase
    3. Firebase Firestore
    """
    # 1. Local Cache
    updated_record = survey_utils.update_survey(survey_id, record)
    if not updated_record:
        return None

    # 2. Supabase (Primary) - MUST succeed
    await supabase_storage.update_survey(survey_id, updated_record)

    # 3. Firebase (Backup)
    try:
        await firebase_storage.update_survey(survey_id, updated_record)
    except Exception as e:
        logger.error(f"Failed to update survey {survey_id} in Firebase: {e}", exc_info=True)

    return updated_record

async def delete_survey(survey_id: str) -> bool:
    """
    Deletes a survey from:
    1. Local Cache
    2. Supabase
    3. Firebase Firestore
    """
    # 1. Local Cache
    local_deleted = survey_utils.delete_survey(survey_id)

    # 2. Supabase (Primary) - MUST succeed
    supabase_deleted = await supabase_storage.delete_survey(survey_id)

    # 3. Firebase (Backup)
    try:
        await firebase_storage.delete_survey(survey_id)
    except Exception as e:
        logger.error(f"Failed to delete survey {survey_id} from Firebase: {e}", exc_info=True)

    return local_deleted or supabase_deleted
