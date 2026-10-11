-- Additive migration: Road Rupture amenity point table.
-- Safe to run on an existing database (does not drop other tables).

CREATE TABLE IF NOT EXISTS survey_road_ruptures (
    survey_id TEXT PRIMARY KEY,
    asset_category TEXT,
    road_name TEXT,
    section_name TEXT,
    surveyor_name TEXT,
    survey_date TEXT,
    gps_point TEXT,
    image_sadc_compliant TEXT,
    photo TEXT,
    photos JSONB,
    raw_data JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    geom_point GEOMETRY(Point, 4326),
    road_condition TEXT,
    rupture_kind TEXT,
    rupture_cause TEXT,
    rupture_detour TEXT,
    rupture_condition TEXT
);

ALTER TABLE survey_road_ruptures DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_road_ruptures_geom_point
  ON survey_road_ruptures USING GIST (geom_point);

CREATE OR REPLACE TRIGGER trigger_update_road_ruptures_geom
  BEFORE INSERT OR UPDATE ON survey_road_ruptures
  FOR EACH ROW EXECUTE FUNCTION update_point_asset_geom();

CREATE OR REPLACE VIEW road_surveys AS
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_sealed_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_gravel_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, segment_geojson, segment_length_m, segment_point_count, segment_avg_accuracy, segment_start_time, segment_end_time, road_condition, road_class, raw_data, source, created_at, geom_point, geom_segment FROM survey_earth_roads
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, bridge_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_bridges
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, footbridge_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_footbridges
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, rail_crossing_condition AS road_condition, rail_crossing_road_class AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_rail_crossings
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, tollgate_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_tollgates
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, layby_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_laybys
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, busstop_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_busstops
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, junction_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_junctions
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, sign_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_road_signs
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, shelvet_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_shelvets
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, culvet_serviceability AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_culverts
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, causeway_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_piped_causeways
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, drift_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_drifts
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, grid_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_grids
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, traffic_lights_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_traffic_lights
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, streetlight_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_streetlights
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, catchpit_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_catchpits
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, traffic_calming_condition AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_traffic_calming
UNION ALL
SELECT survey_id, asset_category, road_name, section_name, surveyor_name, survey_date, gps_point, photo, photos, NULL AS segment_geojson, NULL::DOUBLE PRECISION AS segment_length_m, NULL::INTEGER AS segment_point_count, NULL::DOUBLE PRECISION AS segment_avg_accuracy, NULL AS segment_start_time, NULL AS segment_end_time, COALESCE(rupture_condition, road_condition) AS road_condition, NULL AS road_class, raw_data, source, created_at, geom_point, NULL::GEOMETRY(LineString, 4326) AS geom_segment FROM survey_road_ruptures;
