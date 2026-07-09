"""
Supabase Storage Service
Primary database — PostgreSQL + PostGIS via Supabase
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None


def get_client():
    """Lazily initialise the Supabase client."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_ANON_KEY", "")
        if not url or not key:
            logger.warning("SUPABASE_URL or SUPABASE_ANON_KEY not set — Supabase writes disabled")
            return None
        from supabase import create_client
        _client = create_client(url, key)
    return _client


category_to_table = {
    "sealed": "survey_sealed_roads",
    "gravel": "survey_gravel_roads",
    "earth": "survey_earth_roads",
    "bridge": "survey_bridges",
    "footbridge": "survey_footbridges",
    "rail_crossing": "survey_rail_crossings",
    "tollgate": "survey_tollgates",
    "layby": "survey_laybys",
    "busstop": "survey_busstops",
    "junction": "survey_junctions",
    "sign": "survey_road_signs",
    "shelvet": "survey_shelvets",
    "culvert": "survey_culverts",
    "piped_causeway": "survey_piped_causeways",
    "drift": "survey_drifts",
    "grid": "survey_grids",
    "traffic_lights": "survey_traffic_lights",
    "streetlight": "survey_streetlights"
}


async def _get_category_by_id(survey_id: str) -> Optional[str]:
    """Helper to query the road_surveys union view to find a survey's category."""
    client = get_client()
    if client is None:
        return None
    try:
        response = (
            client.table("road_surveys")
            .select("asset_category")
            .eq("survey_id", survey_id)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return response.data[0].get("asset_category")
    except Exception as e:
        logger.error(f"Error resolving category for survey {survey_id}: {e}")
    return None


async def insert_survey(record: dict) -> dict:
    """
    Insert a road survey record into its category-specific table.
    Returns the inserted row on success, raises on failure.
    """
    client = get_client()
    if client is None:
        raise RuntimeError("Supabase client not configured")

    inner = record.get("record", record)
    category = inner.get("asset_category") or inner.get("section") or "sealed"
    table_name = category_to_table.get(category, "survey_sealed_roads")

    row = _build_row(record, table_name)

    response = client.table(table_name).insert(row).execute()

    if not response.data:
        raise RuntimeError(f"Supabase insert into {table_name} returned no data: {response}")

    logger.info(f"[Supabase] ✅ Inserted survey {row.get('survey_id')} into {table_name}")
    return response.data[0]


async def get_all_surveys(limit: int = 1000) -> list:
    """Fetch all road surveys from the union view, ordered by most recent first."""
    client = get_client()
    if client is None:
        return []
    response = (
        client.table("road_surveys")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data or []


async def update_survey(survey_id: str, record: dict) -> Optional[dict]:
    """Update an existing survey in its category-specific table."""
    client = get_client()
    if client is None:
        return None

    inner = record.get("record", record)
    category = inner.get("asset_category") or inner.get("section")
    if not category:
        category = await _get_category_by_id(survey_id)
    if not category:
        category = "sealed"

    table_name = category_to_table.get(category, "survey_sealed_roads")
    row = _build_row(record, table_name)

    response = (
        client.table(table_name)
        .update(row)
        .eq("survey_id", survey_id)
        .execute()
    )
    return response.data[0] if response.data else None


async def delete_survey(survey_id: str) -> bool:
    """Delete a survey from its category-specific table."""
    client = get_client()
    if client is None:
        return False

    category = await _get_category_by_id(survey_id)
    if not category:
        logger.warning(f"Survey {survey_id} not found in road_surveys view, skipping delete")
        return False

    table_name = category_to_table.get(category, "survey_sealed_roads")
    response = (
        client.table(table_name)
        .delete()
        .eq("survey_id", survey_id)
        .execute()
    )
    return bool(response.data)


def int_val(v):
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def float_val(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _build_row(record: dict, table_name: str) -> dict:
    """
    Map the mobile/dashboard draft fields onto the specific Supabase table columns.
    """
    from backend.services.survey_utils import normalise_record
    inner = record.get("record", record)  # handle wrapper if present
    inner = normalise_record(inner)

    # Common fields across all tables
    row = {
        "survey_id":            str(inner.get("id") or inner.get("_id")),
        "asset_category":       inner.get("asset_category") or inner.get("section"),
        "road_name":            inner.get("road_name") or inner.get("Road_Name"),
        "section_name":         inner.get("section_name") or inner.get("Section_Name"),
        "surveyor_name":        inner.get("surveyor_name") or inner.get("Surveyor_Name"),
        "survey_date":          inner.get("survey_date") or inner.get("Date"),
        "gps_point":            inner.get("gps"),
        "image_sadc_compliant": inner.get("image_SADC_compliant") or inner.get("image_sadc_compliant") or "yes",
        "photo":                inner.get("photo") or None,
        "raw_data":             inner,
        "source":               inner.get("source") or "mobile_app",
    }

    # Linear asset metadata for road tables
    is_road_table = table_name in ["survey_sealed_roads", "survey_gravel_roads", "survey_earth_roads"]
    if is_road_table:
        row["segment_geojson"] = inner.get("road_segment_geojson")
        row["segment_length_m"] = float_val(inner.get("road_segment_length_m"))
        row["segment_point_count"] = int_val(inner.get("road_segment_point_count"))
        row["segment_avg_accuracy"] = float_val(inner.get("road_segment_avg_accuracy_m"))
        row["segment_start_time"] = inner.get("road_segment_start_time")
        row["segment_end_time"] = inner.get("road_segment_end_time")

    # Table-specific columns mapping
    if table_name == "survey_sealed_roads":
        row["paved_road_name"] = inner.get("paved_road_name")
        row["paved_road_class"] = inner.get("paved_road_class")
        row["paved_road_type"] = inner.get("paved_road_type") or inner.get("Road_Type")
        row["paved_road_condition"] = inner.get("paved_road_condition")
        row["pothole_patches"] = inner.get("pothole_patches")
        row["road_name_002"] = inner.get("road_name_002") or inner.get("Road_Name_002")
        row["route_number_004"] = inner.get("route_number_004") or inner.get("Route_number_004")
        row["road_class_002"] = inner.get("road_class_002") or inner.get("Road_Class_002")
        row["road_type"] = inner.get("road_type") or inner.get("Road_Type")
        row["climate_region_001"] = inner.get("climate_region_001") or inner.get("Climate_Region_001")
        row["terrain_type_002"] = inner.get("terrain_type_002") or inner.get("Terrain_Type_002")
        row["datum_point_reference_description"] = inner.get("datum_point_reference_description") or inner.get("Datum_point_reference_description")
        row["authority_name_002"] = inner.get("authority_name_002") or inner.get("Authority_Name_002")
        row["number_of_lanes_per_carriageway"] = int_val(inner.get("number_of_lanes_per_carriageway") or inner.get("Number_of_Lanes_per_carriageway"))
        row["road_length_km"] = float_val(inner.get("road_length_km") or inner.get("Road_Length_km"))
        row["chainage_from_km_002"] = float_val(inner.get("chainage_from_km_002") or inner.get("Chainage_from_km_002"))
        row["chainage_to_km_002"] = float_val(inner.get("chainage_to_km_002") or inner.get("Chainage_to_km_002"))
        row["segment_length_km_002"] = float_val(inner.get("segment_length_km_002") or inner.get("Segment_Length_Km_002"))
        row["road_width_m_002"] = float_val(inner.get("road_width_m_002") or inner.get("Road_width_m_002"))
        row["shoulder_width_m"] = float_val(inner.get("shoulder_width_m") or inner.get("Shoulder_Width_m"))
        row["drainage_type_002_001"] = inner.get("drainage_type_002_001") or inner.get("Drainage_Type_002_001")
        row["servitude_vegetation_001"] = inner.get("servitude_vegetation_001")
        row["narrow_cracks_degree"] = inner.get("narrow_cracks_degree") or inner.get("Narrow_cracks_degree")
        row["wide_cracks_degree"] = inner.get("wide_cracks_degree") or inner.get("Wide_cracks_degree")
        row["pothole_patches_degree"] = inner.get("pothole_patches_degree") or inner.get("Pothole_patches_degree")
        row["rutting_degree"] = inner.get("rutting_degree") or inner.get("Rutting_degree")
        row["edge_breaks_degree"] = inner.get("edge_breaks_degree") or inner.get("Edge_breaks_Degree")
        row["edge_drop_degree"] = inner.get("edge_drop_degree") or inner.get("Edge_Drop_Degree")
        row["drainage_001"] = inner.get("drainage_001") or inner.get("Drainage_001")
        row["ravelling_degree"] = inner.get("ravelling_degree") or inner.get("Ravelling_Degree")
        row["riding_quality_degree_001"] = inner.get("riding_quality_degree_001") or inner.get("Riding_quality_degree_001")
        row["road_markings"] = inner.get("road_markings") or inner.get("Road_markings")
        row["road_studs"] = inner.get("road_studs") or inner.get("Road_studs")
        row["passability_002"] = inner.get("passability_002") or inner.get("Passability_002")
        row["grid"] = inner.get("grid") or inner.get("Grid")
        row["year_constructed_to_sealed_standard"] = int_val(inner.get("year_constructed_to_sealed_standard") or inner.get("Year_constructed_to_sealed_standard"))
        row["last_surface_year"] = int_val(inner.get("last_surface_year") or inner.get("Last_surface_year"))
        row["road_condition"] = inner.get("paved_road_condition")
        row["road_class"] = inner.get("paved_road_class")

    elif table_name == "survey_gravel_roads":
        row["gravel_road_name"] = inner.get("gravel_road_name")
        row["gravel_road_class"] = inner.get("gravel_road_class")
        row["gravel_thickness"] = inner.get("gravel_thickness") or inner.get("Gravel_Thickness_mm")
        row["gravel_condition"] = inner.get("gravel_condition")
        row["drainage_condition"] = inner.get("drainage_condition") or inner.get("Drainage_condition")
        row["road_name_gravel"] = inner.get("gravel_road_name") or inner.get("Road_Name")
        row["route_number"] = inner.get("route_number") or inner.get("Route_Number")
        row["road_length"] = float_val(inner.get("road_length") or inner.get("Road_Length"))
        row["datum_point_description"] = inner.get("datum_point_description") or inner.get("Datum_point_description")
        row["road_class_raw"] = inner.get("road_class_raw") or inner.get("Road_Class")
        row["authority_name"] = inner.get("authority_name") or inner.get("Authority_Name")
        row["servitude_vegetation"] = inner.get("servitude_vegetation")
        row["climate_region"] = inner.get("climate_region") or inner.get("Climate_Region")
        row["terrain_type"] = inner.get("terrain_type") or inner.get("Terrain_Type")
        row["chainage_from_km"] = float_val(inner.get("chainage_from_km") or inner.get("Chainage_From_km"))
        row["chainage_to_km"] = float_val(inner.get("chainage_to_km") or inner.get("Chainage_To_km"))
        row["segment_length_km"] = float_val(inner.get("segment_length_km") or inner.get("Segment_Length_km"))
        row["road_width_m"] = float_val(inner.get("road_width_m") or inner.get("Road_Width_m"))
        row["drainage_type"] = inner.get("drainage_type") or inner.get("Drainage_Type")
        row["cross_section"] = inner.get("cross_section") or inner.get("Cross_section")
        row["gravel_thickness_mm"] = inner.get("gravel_thickness_mm") or inner.get("Gravel_Thickness_mm")
        row["corrugations"] = inner.get("corrugations") or inner.get("Corrugations")
        row["riding_quality_degree"] = inner.get("riding_quality_degree") or inner.get("Riding_Quality_degree")
        row["potholes_degree"] = inner.get("potholes_degree") or inner.get("Potholes_Degree")
        row["passability"] = inner.get("passability") or inner.get("Passability")
        row["year_of_construction"] = int_val(inner.get("year_of_construction") or inner.get("Year_of_Counstruction"))
        row["age_in_years"] = int_val(inner.get("age_in_years") or inner.get("Age_in_Years"))
        row["last_year_of_re_gravelling"] = int_val(inner.get("last_year_of_re_gravelling") or inner.get("Last_year_of_re_gravelling"))
        row["drainage_condition_raw"] = inner.get("drainage_condition_raw") or inner.get("Drainage_condition")
        row["road_condition"] = inner.get("gravel_condition")
        row["road_class"] = inner.get("gravel_road_class")

    elif table_name == "survey_earth_roads":
        row["earth_road_name"] = inner.get("earth_road_name")
        row["earth_road_class"] = inner.get("earth_road_class")
        row["earth_road_width"] = float_val(inner.get("earth_road_width"))
        row["earth_road_length"] = float_val(inner.get("earth_road_length"))
        row["earth_road_condition"] = inner.get("earth_road_condition")
        row["earth_road_passability"] = inner.get("earth_road_passability")
        row["earth_drainage_type"] = inner.get("earth_drainage_type")
        row["earth_drainage_condition"] = inner.get("earth_drainage_condition")
        row["earth_terrain"] = inner.get("earth_terrain")
        row["earth_climate"] = inner.get("earth_climate")
        row["earth_authority"] = inner.get("earth_authority")
        row["earth_year_constructed"] = int_val(inner.get("earth_year_constructed"))
        row["road_condition"] = inner.get("earth_road_condition")
        row["road_class"] = inner.get("earth_road_class")

    elif table_name == "survey_bridges":
        row["bridge"] = inner.get("bridge")
        row["bridge_crossing"] = inner.get("bridge_crossing")
        row["bridge_type"] = inner.get("bridge_type")
        row["bridge_bearing"] = inner.get("bridge_bearing")
        row["bridge_joints"] = inner.get("bridge_joints")
        row["bearings_state"] = inner.get("bearings_state")
        row["parapet"] = inner.get("parapet")
        row["chemical_effect"] = inner.get("chemical_effect")
        row["vegetation_growth"] = inner.get("vegetation_growth")
        row["drainage"] = inner.get("drainage")
        row["bridge_condition"] = inner.get("bridge_condition")

    elif table_name == "survey_footbridges":
        row["footbridge_name"] = inner.get("footbridge_name")
        row["footbridge_type"] = inner.get("footbridge_type")
        row["footbridge_condition"] = inner.get("footbridge_condition")
        row["footbridge_width"] = float_val(inner.get("footbridge_width"))
        row["footbridge_span"] = float_val(inner.get("footbridge_span"))
        row["footbridge_material"] = inner.get("footbridge_material")
        row["footbridge_crossing"] = inner.get("footbridge_crossing")

    elif table_name == "survey_rail_crossings":
        row["rail_crossing_name"] = inner.get("rail_crossing_name")
        row["rail_crossing_type"] = inner.get("rail_crossing_type")
        row["rail_crossing_condition"] = inner.get("rail_crossing_condition")
        row["rail_crossing_control"] = inner.get("rail_crossing_control")
        row["rail_crossing_road_class"] = inner.get("rail_crossing_road_class")

    elif table_name == "survey_tollgates":
        row["tollgate_name"] = inner.get("tollgate_name")
        row["tollgate_type"] = inner.get("tollgate_type")
        row["tollgate_condition"] = inner.get("tollgate_condition")
        row["tollgate_lanes"] = int_val(inner.get("tollgate_lanes"))
        row["tollgate_operational"] = inner.get("tollgate_operational")

    elif table_name == "survey_laybys":
        row["layby_condition"] = inner.get("layby_condition")
        row["layby_surface"] = inner.get("layby_surface")
        row["layby_length"] = float_val(inner.get("layby_length"))
        row["layby_drainage"] = inner.get("layby_drainage")

    elif table_name == "survey_busstops":
        row["busstop_type"] = inner.get("busstop_type")
        row["busstop_condition"] = inner.get("busstop_condition")
        row["busstop_shelter"] = inner.get("busstop_shelter")
        row["busstop_drainage"] = inner.get("busstop_drainage")

    elif table_name == "survey_junctions":
        row["junction_type"] = inner.get("junction_type")
        row["junction_condition"] = inner.get("junction_condition")
        row["junction_control"] = inner.get("junction_control")
        row["junction_road_markings"] = inner.get("junction_road_markings")
        row["junction_signage"] = inner.get("junction_signage")

    elif table_name == "survey_road_signs":
        row["sign_name"] = inner.get("sign_name")
        row["sign_type"] = inner.get("sign_type")
        row["sign_condition"] = inner.get("sign_condition")
        row["sign_sadc_compliant"] = inner.get("sign_sadc_compliant") or inner.get("sadc_compliant")
        row["sign_visibility"] = inner.get("sign_visibility")

    elif table_name == "survey_shelvets":
        row["shelvets_type"] = inner.get("shelvets_type")
        row["shelvet_condition"] = inner.get("shelvet_condition")

    elif table_name == "survey_culverts":
        row["culvet_class"] = inner.get("culvet_class")
        row["culvet_type"] = inner.get("culvet_type")
        row["culvet_serviceability"] = inner.get("culvet_serviceability")

    elif table_name == "survey_piped_causeways":
        row["causeway_name"] = inner.get("causeway_name")
        row["causeway_condition"] = inner.get("causeway_condition")
        row["causeway_pipe_material"] = inner.get("causeway_pipe_material")
        row["causeway_pipe_diameter"] = inner.get("causeway_pipe_diameter")
        row["causeway_drainage"] = inner.get("causeway_drainage")
        row["causeway_serviceability"] = inner.get("causeway_serviceability")

    elif table_name == "survey_drifts":
        row["drift_name"] = inner.get("drift_name")
        row["drift_condition"] = inner.get("drift_condition")
        row["drift_surface"] = inner.get("drift_surface")
        row["drift_passability"] = inner.get("drift_passability")
        row["drift_width"] = float_val(inner.get("drift_width"))

    elif table_name == "survey_grids":
        row["grid_name"] = inner.get("grid_name")
        row["grid_condition"] = inner.get("grid_condition")
        row["grid_material"] = inner.get("grid_material")
        row["grid_operational"] = inner.get("grid_operational")

    elif table_name == "survey_traffic_lights":
        row["traffic_lights_location"] = inner.get("traffic_lights_location")
        row["traffic_lights_condition"] = inner.get("traffic_lights_condition")
        row["traffic_lights_operational"] = inner.get("traffic_lights_operational")
        row["traffic_lights_type"] = inner.get("traffic_lights_type")
        row["traffic_lights_phases"] = int_val(inner.get("traffic_lights_phases"))

    elif table_name == "survey_streetlights":
        row["streetlight_type"] = inner.get("streetlight_type")
        row["streetlight_condition"] = inner.get("streetlight_condition")
        row["streetlight_power_source"] = inner.get("streetlight_power_source")
        row["streetlight_operational"] = inner.get("streetlight_operational")
        row["streetlight_count"] = int_val(inner.get("streetlight_count"))

    return row

