import os
import json
import math
from dotenv import load_dotenv

# Define coordinates for highways as list of points for distance classification
HIGHWAYS = {
    "A1 Highway (Harare - Chirundu)": [
        (-17.8292, 31.0522),  # Harare
        (-17.3606, 30.2014),  # Chinhoyi
        (-16.8833, 29.6167),  # Karoi
        (-16.0392, 28.8475)   # Chirundu
    ],
    "A2 Highway (Harare - Nyamapanda)": [
        (-17.8292, 31.0522),  # Harare
        (-17.4333, 32.2167),  # Mutoko
        (-16.9667, 32.8500)   # Nyamapanda
    ],
    "A3 Highway (Harare - Bulawayo)": [
        (-17.8292, 31.0522),  # Harare
        (-18.0833, 30.4500),  # Chegutu
        (-18.9167, 29.8167),  # Kwekwe
        (-19.4500, 29.8167),  # Gweru
        (-20.1500, 28.5833)   # Bulawayo
    ],
    "A4 Highway (Harare - Masvingo - Beitbridge)": [
        (-17.8292, 31.0522),  # Harare
        (-19.0167, 30.8833),  # Chivhu
        (-20.0833, 30.8333),  # Masvingo
        (-22.2178, 30.0000)   # Beitbridge
    ],
    "A5 Highway (Harare - Mutare)": [
        (-17.8292, 31.0522),  # Harare
        (-18.1833, 31.5500),  # Marondera
        (-18.5333, 32.1167),  # Rusape
        (-18.9667, 32.6333)   # Mutare
    ]
}

# Major hubs to classify Provinces and Districts in Zimbabwe
ZIM_LOCATIONS = [
    {"name": "Harare", "province": "Harare", "district": "Harare", "lat": -17.8292, "lng": 31.0522},
    {"name": "Chinhoyi", "province": "Mashonaland West", "district": "Makonde", "lat": -17.3606, "lng": 30.2014},
    {"name": "Karoi", "province": "Mashonaland West", "district": "Hurungwe", "lat": -16.8833, "lng": 29.6167},
    {"name": "Chirundu", "province": "Mashonaland West", "district": "Hurungwe", "lat": -16.0392, "lng": 28.8475},
    {"name": "Mutoko", "province": "Mashonaland East", "district": "Mutoko", "lat": -17.4333, "lng": 32.2167},
    {"name": "Nyamapanda", "province": "Mashonaland East", "district": "Mudzi", "lat": -16.9667, "lng": 32.8500},
    {"name": "Chegutu", "province": "Mashonaland West", "district": "Chegutu", "lat": -18.0833, "lng": 30.4500},
    {"name": "Kadoma", "province": "Mashonaland West", "district": "Sanyati", "lat": -18.3333, "lng": 29.9167},
    {"name": "Kwekwe", "province": "Midlands", "district": "Kwekwe", "lat": -18.9167, "lng": 29.8167},
    {"name": "Gweru", "province": "Midlands", "district": "Gweru", "lat": -19.4500, "lng": 29.8167},
    {"name": "Bulawayo", "province": "Bulawayo", "district": "Bulawayo", "lat": -20.1500, "lng": 28.5833},
    {"name": "Chivhu", "province": "Mashonaland East", "district": "Chikomba", "lat": -19.0167, "lng": 30.8833},
    {"name": "Mvuma", "province": "Midlands", "district": "Chirumhanzu", "lat": -19.2792, "lng": 30.2045},
    {"name": "Masvingo", "province": "Masvingo", "district": "Masvingo", "lat": -20.0833, "lng": 30.8333},
    {"name": "Beitbridge", "province": "Matabeleland South", "district": "Beitbridge", "lat": -22.2178, "lng": 30.0000},
    {"name": "Marondera", "province": "Mashonaland East", "district": "Marondera", "lat": -18.1833, "lng": 31.5500},
    {"name": "Rusape", "province": "Mashonaland East", "district": "Makoni", "lat": -18.5333, "lng": 32.1167},
    {"name": "Mutare", "province": "Manicaland", "district": "Mutare", "lat": -18.9667, "lng": 32.6333}
]

def classify_province_district(lat, lng):
    if lat is None or lng is None:
        return "Harare", "Harare"
    min_dist = float('inf')
    best_loc = ZIM_LOCATIONS[0]
    for loc in ZIM_LOCATIONS:
        dist = math.sqrt((lat - loc["lat"])**2 + (lng - loc["lng"])**2)
        if dist < min_dist:
            min_dist = dist
            best_loc = loc
    return best_loc["province"], best_loc["district"]

def point_to_segment_distance(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.sqrt((px - x1)**2 + (py - y1)**2)
    t = ((px - x1) * dx + (py - y1) * dy) / (dx*dx + dy*dy)
    t = max(0, min(1, t))
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    return math.sqrt((px - closest_x)**2 + (py - closest_y)**2)

def point_to_path_distance(px, py, path):
    min_dist = float('inf')
    for i in range(len(path) - 1):
        dist = point_to_segment_distance(px, py, path[i][0], path[i][1], path[i+1][0], path[i+1][1])
        if dist < min_dist:
            min_dist = dist
    return min_dist

def classify_highway(lat, lng):
    if lat is None or lng is None:
        return "A4 Highway (Harare - Masvingo - Beitbridge)"
    min_dist = float('inf')
    best_highway = "A4 Highway (Harare - Masvingo - Beitbridge)"
    for name, path in HIGHWAYS.items():
        dist = point_to_path_distance(lat, lng, path)
        if dist < min_dist:
            min_dist = dist
            best_highway = name
    return best_highway

load_dotenv()

OFFLINE_MODE = os.getenv("OFFLINE_MODE", "false").lower() == "true"

def get_cache_path():
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "roads-data.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "roads-data.json")),
        os.path.abspath(os.path.join(os.getcwd(), "public", "roads-data.json")),
        os.path.abspath(os.path.join(os.getcwd(), "..", "public", "roads-data.json")),
    ]
    for p in possible_paths:
        if os.path.exists(os.path.dirname(p)):
            return p
    return None

def load_local_cache():
    p = get_cache_path()
    if p and os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading local cache: {e}")
    return {"count": 0, "records": []}

def save_local_cache(data):
    p = get_cache_path()
    if p:
        try:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving to cache file: {e}")
    return False

def normalise_record(record):
    out = {}
    for k, v in record.items():
        out[k] = v
        # Normalise group path keys
        if "/" in k and not k.startswith("_"):
            short = k.split("/")[-1]
            if short not in out:
                out[short] = v
                
    # Parse GPS into _geolocation array if present
    if not out.get("_geolocation") and out.get("gps"):
        parts = str(out["gps"]).split()
        if len(parts) >= 2:
            try:
                out["_geolocation"] = [float(parts[0]), float(parts[1])]
            except ValueError:
                pass
                
    # Standardise names
    if not out.get("road_name") and out.get("road"):
        out["road_name"] = out["road"]
    if not out.get("section_name") and out.get("section"):
        out["section_name"] = out["section"]
    if not out.get("surveyor_name") and out.get("surveyor"):
        out["surveyor_name"] = out["surveyor"]
    if not out.get("survey_date") and out.get("date"):
        out["survey_date"] = out["date"]
        
    # Classify province and district if not already set and geolocation is available
    if not out.get("province") or not out.get("district"):
        geo = out.get("_geolocation")
        if geo and len(geo) >= 2 and geo[0] is not None and geo[1] is not None:
            prov_val, dist_val = classify_province_district(geo[0], geo[1])
            if not out.get("province"):
                out["province"] = prov_val
            if not out.get("district"):
                out["district"] = dist_val
        else:
            # Fallback if no geolocation available
            if not out.get("province"):
                out["province"] = "Harare"
            if not out.get("district"):
                out["district"] = "Harare"
                
    return out

def flatten_and_normalise_records(raw_submissions):
    flat_records = []
    
    for r in raw_submissions:
        # Check if this is a nested submission structure
        section = r.get("section")
        has_repeats = any(k.startswith("repeat_") for k in r.keys())
        
        # If it doesn't look like a nested repeat structure, treat as already flat
        if not section or not has_repeats:
            flat_records.append(normalise_record(r))
            continue
            
        # Determine appropriate repeat group key based on the survey section
        repeat_key = None
        if section == "bridge": repeat_key = "repeat_bridges"
        elif section == "culvet": repeat_key = "repeat_culvets"
        elif section == "rsign": repeat_key = "repeat_road_sign"
        elif section == "bstop": repeat_key = "repeat_bus_stop"
        elif section == "gv": repeat_key = "repeat_gravel"
        elif section == "jxn": repeat_key = "repeat_junction"
        elif section == "sl": repeat_key = "repeat_group_ub9az10"
        elif section == "sr": repeat_key = "repeat_group_ui4fh40"
        
        items = r.get(repeat_key, []) if repeat_key else []
        if not items:
            continue
            
        for idx, item in enumerate(items):
            flat = {}
            submission_id = r.get("_id")
            flat["_id"] = f"{submission_id}_{section}_{idx}"
            
            # Map default metadata
            flat["survey_date"] = r.get("_submission_time", "").split("T")[0]
            flat["surveyor_name"] = f"Eng. {str(r.get('_submitted_by', 'zingsa')).capitalize()}"
            flat["section_name"] = "Main Highway Section"
            flat["vegetation"] = "none"
            flat["image_SADC_compliant"] = "yes"
            
            # Find GPS coordinates within the repeat item
            gps_val = None
            for ik, iv in item.items():
                if any(x in ik for x in ["location", "coordinates", "road_sign_001", "Mark_Location"]):
                    gps_val = iv
                    break
            
            if gps_val:
                flat["gps"] = gps_val
                parts = gps_val.split()
                if len(parts) >= 2:
                    try:
                        lat = float(parts[0])
                        lng = float(parts[1])
                        flat["_geolocation"] = [lat, lng]
                        # Classify nearest highway using GPS coordinates
                        flat["road_name"] = classify_highway(lat, lng)
                    except ValueError:
                        pass
            
            # Fallback road name if no coordinates or classification succeeded
            if "road_name" not in flat:
                for ik, iv in item.items():
                    if "Road_Name" in ik or "Road_Name_001" in ik or "Road_Name_002" in ik:
                        flat["road_name"] = iv
                        break
                if "road_name" not in flat:
                    flat["road_name"] = "A4 Highway (Harare - Masvingo - Beitbridge)"
                    
            # Copy all fields from the repeat item, shortening key names
            for ik, iv in item.items():
                short_key = ik.split("/")[-1]
                if short_key not in ["location", "coordinates", "road_sign_001", "Mark_Location"]:
                    flat[short_key] = iv
            
            # Map fields to frontend expected schemas based on asset category
            if section == "bridge":
                flat["bridge"] = flat.get("bridge") or "Bridge Structure"
                btype = flat.get("btype")
                if btype == "single_lane":
                    flat["bridge_type"] = "slc"
                elif btype == "high_level":
                    flat["bridge_type"] = "hldc"
                else:
                    flat["bridge_type"] = btype or "hldc"
                parapet_val = flat.get("parapet")
                if parapet_val == "no":
                    flat["parapet"] = "undamaged"
                elif parapet_val == "yes":
                    flat["parapet"] = "damaged"
                else:
                    flat["parapet"] = parapet_val or "undamaged"
                chem = flat.get("chemical_effect")
                if chem == "fair":
                    flat["chemical_effect"] = "mild"
                elif chem == "poor":
                    flat["chemical_effect"] = "severe"
                else:
                    flat["chemical_effect"] = chem or "none"
                
                flat["bridge_joints"] = flat.get("bridge_joints", "good")
                flat["bearings_state"] = flat.get("bearings_state", "good")
                flat["bridge_crossing"] = flat.get("crossing", "river")
                
                drain = flat.get("drainage")
                if drain == "poor":
                    flat["drainage"] = "clogged"
                else:
                    flat["drainage"] = drain or "good"
                
                conds = [flat["bridge_joints"], flat["bearings_state"], flat["drainage"]]
                if "poor" in conds or "clogged" in conds:
                    flat["bridge_condition"] = "poor"
                elif "fair" in conds:
                    flat["bridge_condition"] = "fair"
                else:
                    flat["bridge_condition"] = "good"
                    
            elif section == "culvet":
                cclass = flat.get("culvet_class")
                if cclass == "pipe":
                    flat["culvet_class"] = "pipe_culvert"
                elif cclass == "box":
                    flat["culvet_class"] = "box_culvert"
                else:
                    flat["culvet_class"] = cclass or "pipe_culvert"
                flat["culvet_type"] = flat.get("culvet_type", "concrete")
                flat["culvet_serviceability"] = flat.get("culvet_serviceability", "good")
                
            elif section == "rsign":
                flat["image_SADC_compliant"] = flat.get("sadc_compliant", "yes")
                flat["sign_condition"] = flat.get("Condition", "good")
                flat["sign_name"] = flat.get("Signage_Name", "SADC Sign")
                
            elif section == "jxn":
                flat["junction_type"] = flat.get("What_is_the_type_of_junction", "t_junction")
                flat["junction_condition"] = flat.get("junction_condition", "good")
                flat["kerbs"] = flat.get("Kerbs", "no")
                flat["junction_sign"] = flat.get("junction_sign", "no")
                
            elif section == "bstop":
                flat["bus_stop_present"] = flat.get("bus_stop_present", "yes")
                flat["bus_stop_condition"] = flat.get("Condition_001", "good")
                flat["route_number"] = flat.get("Route_number_010", "")
                
            elif section == "gv":
                flat["gravel_road_name"] = flat.get("Road_Name", "Gravel Road Segment")
                flat["gravel_road_class"] = flat.get("Road_Class", "urban_collector")
                flat["gravel_thickness"] = flat.get("Gravel_Thickness_mm", "")
                flat["gravel_condition"] = flat.get("Riding_Quality_degree", "good")
                flat["drainage_condition"] = flat.get("Drainage_condition", "good")
                flat["vegetation"] = flat.get("servitude_vegetation", "none")
                
            elif section == "sr":
                flat["paved_road_name"] = flat.get("Road_Name_002", "Paved Road Segment")
                flat["paved_road_class"] = flat.get("Road_Class_002", "secondary")
                flat["paved_road_type"] = flat.get("Road_Type", "")
                flat["paved_road_condition"] = flat.get("Riding_quality_degree_001", "good")
                flat["pothole_patches"] = flat.get("Pothole_patches_degree", "none")
                flat["vegetation"] = flat.get("servitude_vegetation_001", "none")
                
            # Ensure province/district classification for repeat group records
            if not flat.get("province") or not flat.get("district"):
                geo = flat.get("_geolocation")
                if geo and len(geo) >= 2 and geo[0] is not None and geo[1] is not None:
                    prov_val, dist_val = classify_province_district(geo[0], geo[1])
                    if not flat.get("province"):
                        flat["province"] = prov_val
                    if not flat.get("district"):
                        flat["district"] = dist_val
                else:
                    if not flat.get("province") and r.get("province"):
                        flat["province"] = r.get("province")
                    if not flat.get("district") and r.get("district"):
                        flat["district"] = r.get("district")
            
            if not flat.get("province"):
                flat["province"] = "Harare"
            if not flat.get("district"):
                flat["district"] = "Harare"
                
            flat_records.append(flat)
            
    return flat_records

def add_new_survey(record: dict):
    cache = load_local_cache()
    
    # Generate new ID if not present
    max_id = 1000
    for r in cache.get("records", []):
        try:
            r_id_str = str(r.get("_id", 0))
            if "_" in r_id_str:
                r_id_str = r_id_str.split("_")[0]
            r_id = int(r_id_str)
            if r_id > max_id:
                max_id = r_id
        except ValueError:
            pass
            
    new_id = max_id + 1
    if "_id" not in record:
        record["_id"] = new_id
        
    if not record.get("_geolocation") and record.get("gps"):
        parts = str(record["gps"]).split()
        if len(parts) >= 2:
            try:
                record["_geolocation"] = [float(parts[0]), float(parts[1])]
            except ValueError:
                pass
                
    cache.setdefault("records", [])
    cache["records"].insert(0, record)
    cache["count"] = len(cache["records"])
    
    save_local_cache(cache)
    return record

def delete_survey(record_id: str):
    cache = load_local_cache()
    records = cache.get("records", [])
    
    new_records = [r for r in records if str(r.get("_id")) != str(record_id)]
    if len(new_records) == len(records):
        return False
        
    cache["records"] = new_records
    cache["count"] = len(new_records)
    save_local_cache(cache)
    return True

def update_survey(record_id: str, record: dict):
    cache = load_local_cache()
    records = cache.get("records", [])
    
    for idx, r in enumerate(records):
        if str(r.get("_id")) == str(record_id):
            updated = {**r, **record}
            
            if record.get("gps"):
                parts = str(record["gps"]).split()
                if len(parts) >= 2:
                    try:
                        lat = float(parts[0])
                        lng = float(parts[1])
                        updated["_geolocation"] = [lat, lng]
                        updated["road_name"] = classify_highway(lat, lng)
                    except ValueError:
                        pass
                        
            updated = normalise_record(updated)
            records[idx] = updated
            cache["records"] = records
            save_local_cache(cache)
            return updated
            
    return None
