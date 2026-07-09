-- Enable PostGIS extension for spatial queries (LineString, Point, etc.)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------
-- Cleanup Existing
-- ---------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'road_surveys'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM pg_class c WHERE c.relname = 'road_surveys' AND c.relkind = 'v'
        ) THEN
            DROP VIEW road_surveys CASCADE;
        ELSE
            DROP TABLE road_surveys CASCADE;
        END IF;
    END IF;
END $$;

DROP TABLE IF EXISTS survey_sealed_roads CASCADE;
DROP TABLE IF EXISTS survey_gravel_roads CASCADE;
DROP TABLE IF EXISTS survey_earth_roads CASCADE;
DROP TABLE IF EXISTS survey_bridges CASCADE;
DROP TABLE IF EXISTS survey_footbridges CASCADE;
DROP TABLE IF EXISTS survey_rail_crossings CASCADE;
DROP TABLE IF EXISTS survey_tollgates CASCADE;
DROP TABLE IF EXISTS survey_laybys CASCADE;
DROP TABLE IF EXISTS survey_busstops CASCADE;
DROP TABLE IF EXISTS survey_junctions CASCADE;
DROP TABLE IF EXISTS survey_road_signs CASCADE;
DROP TABLE IF EXISTS survey_shelvets CASCADE;
DROP TABLE IF EXISTS survey_culverts CASCADE;
DROP TABLE IF EXISTS survey_piped_causeways CASCADE;
DROP TABLE IF EXISTS survey_drifts CASCADE;
DROP TABLE IF EXISTS survey_grids CASCADE;
DROP TABLE IF EXISTS survey_traffic_lights CASCADE;
DROP TABLE IF EXISTS survey_streetlights CASCADE;

-- ---------------------------------------------------------
-- Trigger Functions for Geometries
-- ---------------------------------------------------------
-- For Linear Assets (Sealed, Gravel, Earth Roads)
CREATE OR REPLACE FUNCTION update_road_segment_geom() 
RETURNS TRIGGER AS $$
DECLARE
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
BEGIN
    -- 1. Parse and update geom_point from gps_point string
    IF NEW.gps_point IS NOT NULL AND NEW.gps_point <> '' THEN
        BEGIN
            lat := split_part(NEW.gps_point, ' ', 1)::DOUBLE PRECISION;
            lng := split_part(NEW.gps_point, ' ', 2)::DOUBLE PRECISION;
            NEW.geom_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
        EXCEPTION WHEN OTHERS THEN
            NEW.geom_point := NULL;
        END;
    ELSE
        NEW.geom_point := NULL;
    END IF;

    -- 2. Parse and update geom_segment from segment_geojson
    IF NEW.segment_geojson IS NOT NULL AND NEW.segment_geojson <> '' THEN
        BEGIN
            NEW.geom_segment := ST_SetSRID(ST_GeomFromGeoJSON(NEW.segment_geojson), 4326);
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                NEW.geom_segment := ST_SetSRID(ST_GeomFromGeoJSON(NEW.raw_data->'road_segment_geojson'), 4326);
            EXCEPTION WHEN OTHERS THEN
                NEW.geom_segment := NULL;
            END;
        END;
    ELSE
        NEW.geom_segment := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- For Point Assets (Structures, Drainage, Lighting, Control, Amenities)
CREATE OR REPLACE FUNCTION update_point_asset_geom() 
RETURNS TRIGGER AS $$
DECLARE
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
BEGIN
    -- 1. Parse and update geom_point from gps_point string
    IF NEW.gps_point IS NOT NULL AND NEW.gps_point <> '' THEN
        BEGIN
            lat := split_part(NEW.gps_point, ' ', 1)::DOUBLE PRECISION;
            lng := split_part(NEW.gps_point, ' ', 2)::DOUBLE PRECISION;
            NEW.geom_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
        EXCEPTION WHEN OTHERS THEN
            NEW.geom_point := NULL;
        END;
    ELSE
        NEW.geom_point := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------
-- 1. Sealed Roads (Linear)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_sealed_roads (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    road_condition TEXT,
    road_class TEXT,
    
    -- Linear Geometry Columns
    geom_segment GEOMETRY(LineString, 4326),
    segment_geojson TEXT,
    segment_length_m DOUBLE PRECISION,
    segment_point_count INTEGER,
    segment_avg_accuracy DOUBLE PRECISION,
    segment_start_time TEXT,
    segment_end_time TEXT,
    
    -- Specific fields
    paved_road_name TEXT,
    paved_road_class TEXT,
    paved_road_type TEXT,
    paved_road_condition TEXT,
    pothole_patches TEXT,
    road_name_002 TEXT,
    route_number_004 TEXT,
    road_class_002 TEXT,
    road_type TEXT,
    climate_region_001 TEXT,
    terrain_type_002 TEXT,
    datum_point_reference_description TEXT,
    authority_name_002 TEXT,
    number_of_lanes_per_carriageway INTEGER,
    road_length_km DOUBLE PRECISION,
    chainage_from_km_002 DOUBLE PRECISION,
    chainage_to_km_002 DOUBLE PRECISION,
    segment_length_km_002 DOUBLE PRECISION,
    road_width_m_002 DOUBLE PRECISION,
    shoulder_width_m DOUBLE PRECISION,
    drainage_type_002_001 TEXT,
    servitude_vegetation_001 TEXT,
    narrow_cracks_degree TEXT,
    wide_cracks_degree TEXT,
    pothole_patches_degree TEXT,
    rutting_degree TEXT,
    edge_breaks_degree TEXT,
    edge_drop_degree TEXT,
    drainage_001 TEXT,
    ravelling_degree TEXT,
    riding_quality_degree_001 TEXT,
    road_markings TEXT,
    road_studs TEXT,
    passability_002 TEXT,
    grid TEXT,
    year_constructed_to_sealed_standard INTEGER,
    last_surface_year INTEGER
);

-- ---------------------------------------------------------
-- 2. Gravel Roads (Linear)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_gravel_roads (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    road_condition TEXT,
    road_class TEXT,
    
    -- Linear Geometry Columns
    geom_segment GEOMETRY(LineString, 4326),
    segment_geojson TEXT,
    segment_length_m DOUBLE PRECISION,
    segment_point_count INTEGER,
    segment_avg_accuracy DOUBLE PRECISION,
    segment_start_time TEXT,
    segment_end_time TEXT,
    
    -- Specific fields
    gravel_road_name TEXT,
    gravel_road_class TEXT,
    gravel_thickness TEXT,
    gravel_condition TEXT,
    drainage_condition TEXT,
    road_name_gravel TEXT,
    route_number TEXT,
    road_length DOUBLE PRECISION,
    datum_point_description TEXT,
    road_class_raw TEXT,
    authority_name TEXT,
    servitude_vegetation TEXT,
    climate_region TEXT,
    terrain_type TEXT,
    chainage_from_km DOUBLE PRECISION,
    chainage_to_km DOUBLE PRECISION,
    segment_length_km DOUBLE PRECISION,
    road_width_m DOUBLE PRECISION,
    drainage_type TEXT,
    cross_section TEXT,
    gravel_thickness_mm TEXT,
    corrugations TEXT,
    riding_quality_degree TEXT,
    potholes_degree TEXT,
    passability TEXT,
    year_of_construction INTEGER,
    age_in_years INTEGER,
    last_year_of_re_gravelling INTEGER,
    drainage_condition_raw TEXT
);

-- ---------------------------------------------------------
-- 3. Earth Roads (Linear)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_earth_roads (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    road_condition TEXT,
    road_class TEXT,
    
    -- Linear Geometry Columns
    geom_segment GEOMETRY(LineString, 4326),
    segment_geojson TEXT,
    segment_length_m DOUBLE PRECISION,
    segment_point_count INTEGER,
    segment_avg_accuracy DOUBLE PRECISION,
    segment_start_time TEXT,
    segment_end_time TEXT,
    
    -- Specific fields
    earth_road_name TEXT,
    earth_road_class TEXT,
    earth_road_width DOUBLE PRECISION,
    earth_road_length DOUBLE PRECISION,
    earth_road_condition TEXT,
    earth_road_passability TEXT,
    earth_drainage_type TEXT,
    earth_drainage_condition TEXT,
    earth_terrain TEXT,
    earth_climate TEXT,
    earth_authority TEXT,
    earth_year_constructed INTEGER
);

-- ---------------------------------------------------------
-- 4. Bridges (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_bridges (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    bridge TEXT,
    bridge_crossing TEXT,
    bridge_type TEXT,
    bridge_bearing TEXT,
    bridge_joints TEXT,
    bearings_state TEXT,
    parapet TEXT,
    chemical_effect TEXT,
    vegetation_growth TEXT,
    drainage TEXT,
    bridge_condition TEXT
);

-- ---------------------------------------------------------
-- 5. Footbridges (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_footbridges (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    footbridge_name TEXT,
    footbridge_type TEXT,
    footbridge_condition TEXT,
    footbridge_width DOUBLE PRECISION,
    footbridge_span DOUBLE PRECISION,
    footbridge_material TEXT,
    footbridge_crossing TEXT
);

-- ---------------------------------------------------------
-- 6. Rail Crossings (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_rail_crossings (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    rail_crossing_name TEXT,
    rail_crossing_type TEXT,
    rail_crossing_condition TEXT,
    rail_crossing_control TEXT,
    rail_crossing_road_class TEXT
);

-- ---------------------------------------------------------
-- 7. Tollgates (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_tollgates (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    tollgate_name TEXT,
    tollgate_type TEXT,
    tollgate_condition TEXT,
    tollgate_lanes INTEGER,
    tollgate_operational TEXT
);

-- ---------------------------------------------------------
-- 8. Laybys (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_laybys (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    layby_condition TEXT,
    layby_surface TEXT,
    layby_length DOUBLE PRECISION,
    layby_drainage TEXT
);

-- ---------------------------------------------------------
-- 9. Busstops (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_busstops (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    busstop_type TEXT,
    busstop_condition TEXT,
    busstop_shelter TEXT,
    busstop_drainage TEXT
);

-- ---------------------------------------------------------
-- 10. Junctions (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_junctions (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    junction_type TEXT,
    junction_condition TEXT,
    junction_control TEXT,
    junction_road_markings TEXT,
    junction_signage TEXT
);

-- ---------------------------------------------------------
-- 11. Road Signs (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_road_signs (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    sign_name TEXT,
    sign_type TEXT,
    sign_condition TEXT,
    sign_sadc_compliant TEXT,
    sign_visibility TEXT
);

-- ---------------------------------------------------------
-- 12. Shelvets (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_shelvets (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    shelvets_type TEXT,
    shelvet_condition TEXT
);

-- ---------------------------------------------------------
-- 13. Culverts (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_culverts (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    culvet_class TEXT,
    culvet_type TEXT,
    culvet_serviceability TEXT
);

-- ---------------------------------------------------------
-- 14. Piped Causeways (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_piped_causeways (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    causeway_name TEXT,
    causeway_condition TEXT,
    causeway_pipe_material TEXT,
    causeway_pipe_diameter TEXT,
    causeway_drainage TEXT,
    causeway_serviceability TEXT
);

-- ---------------------------------------------------------
-- 15. Drifts (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_drifts (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    drift_name TEXT,
    drift_condition TEXT,
    drift_surface TEXT,
    drift_passability TEXT,
    drift_width DOUBLE PRECISION
);

-- ---------------------------------------------------------
-- 16. Grids (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_grids (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    grid_name TEXT,
    grid_condition TEXT,
    grid_material TEXT,
    grid_operational TEXT
);

-- ---------------------------------------------------------
-- 17. Traffic Lights (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_traffic_lights (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    traffic_lights_location TEXT,
    traffic_lights_condition TEXT,
    traffic_lights_operational TEXT,
    traffic_lights_type TEXT,
    traffic_lights_phases INTEGER
);

-- ---------------------------------------------------------
-- 18. Streetlights (Point)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_streetlights (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    
    -- Specific fields
    streetlight_type TEXT,
    streetlight_condition TEXT,
    streetlight_power_source TEXT,
    streetlight_operational TEXT,
    streetlight_count INTEGER
);

-- ---------------------------------------------------------
-- Disable RLS to allow direct anonymous writes (matching previous table rules)
-- ---------------------------------------------------------
ALTER TABLE survey_sealed_roads DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_gravel_roads DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_earth_roads DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_bridges DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_footbridges DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_rail_crossings DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_tollgates DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_laybys DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_busstops DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_junctions DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_road_signs DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_shelvets DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_culverts DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_piped_causeways DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_drifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_grids DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_traffic_lights DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_streetlights DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- Create GIS Indices
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sealed_geom_point ON survey_sealed_roads USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_sealed_geom_segment ON survey_sealed_roads USING GIST (geom_segment);
CREATE INDEX IF NOT EXISTS idx_gravel_geom_point ON survey_gravel_roads USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_gravel_geom_segment ON survey_gravel_roads USING GIST (geom_segment);
CREATE INDEX IF NOT EXISTS idx_earth_geom_point ON survey_earth_roads USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_earth_geom_segment ON survey_earth_roads USING GIST (geom_segment);
CREATE INDEX IF NOT EXISTS idx_bridges_geom_point ON survey_bridges USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_footbridges_geom_point ON survey_footbridges USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_rail_crossings_geom_point ON survey_rail_crossings USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_tollgates_geom_point ON survey_tollgates USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_laybys_geom_point ON survey_laybys USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_busstops_geom_point ON survey_busstops USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_junctions_geom_point ON survey_junctions USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_road_signs_geom_point ON survey_road_signs USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_shelvets_geom_point ON survey_shelvets USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_culverts_geom_point ON survey_culverts USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_piped_causeways_geom_point ON survey_piped_causeways USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_drifts_geom_point ON survey_drifts USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_grids_geom_point ON survey_grids USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_traffic_lights_geom_point ON survey_traffic_lights USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_streetlights_geom_point ON survey_streetlights USING GIST (geom_point);

-- ---------------------------------------------------------
-- Apply Triggers
-- ---------------------------------------------------------
CREATE OR REPLACE TRIGGER trigger_update_sealed_geom BEFORE INSERT OR UPDATE ON survey_sealed_roads FOR EACH ROW EXECUTE FUNCTION update_road_segment_geom();
CREATE OR REPLACE TRIGGER trigger_update_gravel_geom BEFORE INSERT OR UPDATE ON survey_gravel_roads FOR EACH ROW EXECUTE FUNCTION update_road_segment_geom();
CREATE OR REPLACE TRIGGER trigger_update_earth_geom BEFORE INSERT OR UPDATE ON survey_earth_roads FOR EACH ROW EXECUTE FUNCTION update_road_segment_geom();
CREATE OR REPLACE TRIGGER trigger_update_bridges_geom BEFORE INSERT OR UPDATE ON survey_bridges FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_footbridges_geom BEFORE INSERT OR UPDATE ON survey_footbridges FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_rail_crossings_geom BEFORE INSERT OR UPDATE ON survey_rail_crossings FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_tollgates_geom BEFORE INSERT OR UPDATE ON survey_tollgates FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_laybys_geom BEFORE INSERT OR UPDATE ON survey_laybys FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_busstops_geom BEFORE INSERT OR UPDATE ON survey_busstops FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_junctions_geom BEFORE INSERT OR UPDATE ON survey_junctions FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_road_signs_geom BEFORE INSERT OR UPDATE ON survey_road_signs FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_shelvets_geom BEFORE INSERT OR UPDATE ON survey_shelvets FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_culverts_geom BEFORE INSERT OR UPDATE ON survey_culverts FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_piped_causeways_geom BEFORE INSERT OR UPDATE ON survey_piped_causeways FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_drifts_geom BEFORE INSERT OR UPDATE ON survey_drifts FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_grids_geom BEFORE INSERT OR UPDATE ON survey_grids FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_traffic_lights_geom BEFORE INSERT OR UPDATE ON survey_traffic_lights FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();
CREATE OR REPLACE TRIGGER trigger_update_streetlights_geom BEFORE INSERT OR UPDATE ON survey_streetlights FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();

-- ---------------------------------------------------------
-- Create Unified View for GET Compatibility
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW road_surveys AS
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_sealed_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_gravel_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_earth_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, bridge_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_bridges
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, footbridge_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_footbridges
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, rail_crossing_condition AS road_condition, rail_crossing_road_class AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_rail_crossings
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, tollgate_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_tollgates
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, layby_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_laybys
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, busstop_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_busstops
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, junction_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_junctions
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, sign_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_road_signs
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, shelvet_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_shelvets
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, culvet_serviceability AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_culverts
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, causeway_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_piped_causeways
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, drift_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_drifts
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, grid_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_grids
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, traffic_lights_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_traffic_lights
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, streetlight_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_streetlights;
