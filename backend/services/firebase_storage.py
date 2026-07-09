"""
Firebase Firestore Storage Service
Secondary database / backup storage
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

_db: Optional[firestore.firestore.Client] = None
_initialized = False


def get_db() -> Optional[firestore.firestore.Client]:
    """Lazily initialise the Firebase Admin Firestore client."""
    global _db, _initialized
    if _initialized:
        return _db

    try:
        # Check if already initialized in default app
        try:
            app = firebase_admin.get_app()
        except ValueError:
            # Not initialized yet, initialize it
            cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if cred_path:
                # Auto-resolve path if it doesn't match CWD exactly
                if not os.path.exists(cred_path):
                    if cred_path.startswith("backend/") and os.path.exists(cred_path[8:]):
                        cred_path = cred_path[8:]
                    elif not cred_path.startswith("backend/") and os.path.exists(os.path.join("backend", cred_path)):
                        cred_path = os.path.join("backend", cred_path)
                    else:
                        script_dir = os.path.dirname(__file__)
                        possible_paths = [
                            os.path.abspath(os.path.join(script_dir, "..", os.path.basename(cred_path))),
                            os.path.abspath(os.path.join(script_dir, "..", "..", cred_path))
                        ]
                        for path_candidate in possible_paths:
                            if os.path.exists(path_candidate):
                                cred_path = path_candidate
                                break

            if cred_path and os.path.exists(cred_path):
                logger.info(f"Initializing Firebase with service account file: {cred_path}")
                cred = credentials.Certificate(cred_path)
                app = firebase_admin.initialize_app(cred)
            else:
                # Try to initialize with environment credentials / default credentials
                # Or try using credentials from JSON string
                cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_RAW")
                if cred_json:
                    try:
                        logger.info("Initializing Firebase with raw credentials from env")
                        cred_dict = json.loads(cred_json)
                        cred = credentials.Certificate(cred_dict)
                        app = firebase_admin.initialize_app(cred)
                    except Exception as json_err:
                        logger.error(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_RAW: {json_err}")
                        app = None
                else:
                    logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON file not found or not set. Attempting default credentials.")
                    try:
                        app = firebase_admin.initialize_app()
                    except Exception as e:
                        logger.warning(f"Could not initialize Firebase application: {e}. Firebase backup disabled.")
                        app = None

        if app:
            db_id = os.getenv("FIREBASE_DATABASE_ID")
            if db_id:
                _db = firestore.client(database_id=db_id)
                logger.info(f"Firebase Firestore client initialized successfully with database: {db_id}")
            else:
                _db = firestore.client()
                logger.info("Firebase Firestore client initialized successfully with default database.")
        _initialized = True
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin SDK: {e}")
        _initialized = True  # Avoid retrying continuously on every call if it fails

    return _db


async def insert_survey(record: dict) -> dict:
    """Insert a survey record into the category-specific Firestore collection."""
    db = get_db()
    if db is None:
        raise RuntimeError("Firebase client not configured")

    inner = record.get("record", record)
    survey_id = inner.get("id") or inner.get("_id")
    if not survey_id:
        raise ValueError("Record must have an 'id'")

    category = inner.get("asset_category") or inner.get("section") or "sealed"
    from backend.services.supabase_storage import category_to_table, _build_row
    table_name = category_to_table.get(category, "survey_sealed_roads")

    row = _build_row(record, table_name)
    row["created_at"] = firestore.SERVER_TIMESTAMP

    doc_ref = db.collection(table_name).document(str(survey_id))
    doc_ref.set(row)
    logger.info(f"[Firebase] ✅ Backed up survey {survey_id} to Firestore collection {table_name}")
    return row


async def get_all_surveys(limit: int = 1000) -> list:
    """Fetch all surveys from Firestore across all collections (merged)."""
    db = get_db()
    if db is None:
        return []
    
    from backend.services.supabase_storage import category_to_table
    all_records = []
    # Fetch from each collection up to limit, then sort
    for col_name in category_to_table.values():
        try:
            docs = db.collection(col_name).order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
            for doc in docs:
                data = doc.to_dict()
                # convert Firestore timestamp to string representation for consistency
                if "created_at" in data and data["created_at"]:
                    try:
                        data["created_at"] = str(data["created_at"])
                    except Exception:
                        pass
                all_records.append(data)
        except Exception as e:
            logger.error(f"Error fetching from Firestore collection {col_name}: {e}")
            
    # Sort by created_at desc (with null safety)
    all_records.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return all_records[:limit]


async def update_survey(survey_id: str, record: dict) -> Optional[dict]:
    """Update a survey in its category-specific Firestore collection."""
    db = get_db()
    if db is None:
        return None

    inner = record.get("record", record)
    category = inner.get("asset_category") or inner.get("section")
    from backend.services.supabase_storage import category_to_table, _get_category_by_id, _build_row
    if not category:
        category = await _get_category_by_id(survey_id)
    if not category:
        category = "sealed"

    table_name = category_to_table.get(category, "survey_sealed_roads")
    doc_ref = db.collection(table_name).document(str(survey_id))
    if not doc_ref.get().exists:
        return None
        
    row = _build_row(record, table_name)
    doc_ref.update(row)
    logger.info(f"[Firebase] ✅ Updated survey {survey_id} in Firestore collection {table_name}")
    return row


async def delete_survey(survey_id: str) -> bool:
    """Delete a survey from its category-specific Firestore collection."""
    db = get_db()
    if db is None:
        return False

    from backend.services.supabase_storage import category_to_table, _get_category_by_id
    category = await _get_category_by_id(survey_id)
    if not category:
        logger.warning(f"[Firebase] Survey {survey_id} category not found, cannot delete from Firestore")
        return False

    table_name = category_to_table.get(category, "survey_sealed_roads")
    doc_ref = db.collection(table_name).document(str(survey_id))
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    logger.info(f"[Firebase] ✅ Deleted survey {survey_id} from Firestore collection {table_name}")
    return True

