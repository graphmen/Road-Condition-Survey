export interface SurveyDraft {
  id: string;
  asset_category?: string;
  road_name: string;
  section_name: string;
  surveyor_name: string;
  survey_date: string;
  vegetation: string;
  gps: string; // "lat lng alt acc"
  image_SADC_compliant: "yes" | "no";
  photo?: string; // Optional Base64 data URL
  
  // Bridge optional fields
  bridge?: string;
  bridge_crossing?: string;
  bridge_type?: string;
  bridge_bearing?: string;
  bridge_joints?: string;
  bearings_state?: string;
  parapet?: string;
  chemical_effect?: string;
  vegetation_growth?: string;
  drainage?: string;
  bridge_condition?: string;

  // Culvert optional fields
  culvet_class?: string;
  culvet_type?: string;
  culvet_serviceability?: string;

  // Shelvet optional fields
  shelvets_type?: string;
  shelvet_condition?: string;

  // Sealed Roads optional fields
  paved_road_name?: string;
  paved_road_class?: string;
  paved_road_type?: string;
  paved_road_condition?: string;
  pothole_patches?: string;
  Road_Name_002?: string;
  Route_number_004?: string;
  Road_Class_002?: string;
  Road_Type?: string;
  Climate_Region_001?: string;
  Terrain_Type_002?: string;
  Datum_point_reference_description?: string;
  Authority_Name_002?: string;
  Number_of_Lanes_per_carriageway?: number;
  Road_Length_km?: number;
  Chainage_from_km_002?: number;
  Chainage_to_km_002?: number;
  Segment_Length_Km_002?: number;
  Road_width_m_002?: number;
  Shoulder_Width_m?: number;
  Drainage_Type_002_001?: string;
  servitude_vegetation_001?: string;
  Narrow_cracks_degree?: string;
  Wide_cracks_degree?: string;
  Pothole_patches_degree?: string;
  Rutting_degree?: string;
  Edge_breaks_Degree?: string;
  Edge_Drop_Degree?: string;
  Drainage_001?: string;
  Ravelling_Degree?: string;
  Riding_quality_degree_001?: string;
  Road_markings?: string;
  Road_studs?: string;
  Passability_002?: string;
  Grid?: string;
  Year_constructed_to_sealed_standard?: number;
  Last_surface_year?: number;

  // Gravel Roads optional fields
  gravel_road_name?: string;
  gravel_road_class?: string;
  gravel_thickness?: string;
  gravel_condition?: string;
  drainage_condition?: string;
  Road_Name?: string;
  Route_Number?: string;
  Road_Length?: number;
  Datum_point_description?: string;
  Road_Class?: string;
  Authority_Name?: string;
  servitude_vegetation?: string;
  Climate_Region?: string;
  Terrain_Type?: string;
  Chainage_From_km?: number;
  Chainage_To_km?: number;
  Segment_Length_km?: number;
  Road_Width_m?: number;
  Drainage_Type?: string;
  Cross_section?: string;
  Gravel_Thickness_mm?: string;
  Corrugations?: string;
  Riding_Quality_degree?: string;
  Potholes_Degree?: string;
  Passability?: string;
  Year_of_Counstruction?: number;
  Age_in_Years?: number;
  Last_year_of_re_gravelling?: number;
  Drainage_condition?: string;

  // Concrete Roads optional fields
  concrete_road_name?: string;
  concrete_road_class?: string;
  concrete_thickness?: string;
  concrete_condition?: string;
  joint_condition?: string;

  // Earth Roads optional fields
  earth_road_name?: string;
  earth_road_class?: string;
  earth_road_width?: number;
  earth_road_length?: number;
  earth_road_condition?: string;
  earth_road_passability?: string;
  earth_drainage_type?: string;
  earth_drainage_condition?: string;
  earth_terrain?: string;
  earth_climate?: string;
  earth_authority?: string;
  earth_year_constructed?: number;

  // Footbridge optional fields
  footbridge_name?: string;
  footbridge_type?: string;
  footbridge_condition?: string;
  footbridge_width?: number;
  footbridge_span?: number;
  footbridge_material?: string;
  footbridge_crossing?: string;

  // Rail Level Crossing optional fields
  rail_crossing_name?: string;
  rail_crossing_type?: string;
  rail_crossing_condition?: string;
  rail_crossing_control?: string;
  rail_crossing_road_class?: string;

  // Tollgate optional fields
  tollgate_name?: string;
  tollgate_type?: string;
  tollgate_condition?: string;
  tollgate_lanes?: number;
  tollgate_operational?: string;

  // Lay-by optional fields
  layby_condition?: string;
  layby_surface?: string;
  layby_length?: number;
  layby_drainage?: string;

  // Bus Stop optional fields
  busstop_type?: string;
  busstop_condition?: string;
  busstop_shelter?: string;
  busstop_drainage?: string;

  // Junction optional fields
  junction_type?: string;
  junction_condition?: string;
  junction_control?: string;
  junction_road_markings?: string;
  junction_signage?: string;

  // Road Sign optional fields
  sign_type?: string;
  sign_condition?: string;
  sign_sadc_compliant?: string;
  sign_visibility?: string;

  // Piped Causeway optional fields
  causeway_name?: string;
  causeway_condition?: string;
  causeway_pipe_material?: string;
  causeway_pipe_diameter?: string;
  causeway_drainage?: string;
  causeway_serviceability?: string;

  // Drift optional fields
  drift_name?: string;
  drift_condition?: string;
  drift_surface?: string;
  drift_passability?: string;
  drift_width?: number;

  // Grid optional fields
  grid_name?: string;
  grid_condition?: string;
  grid_material?: string;
  grid_operational?: string;

  // Traffic Lights optional fields
  traffic_lights_location?: string;
  traffic_lights_condition?: string;
  traffic_lights_operational?: string;
  traffic_lights_type?: string;
  traffic_lights_phases?: number;

  // Streetlights optional fields
  streetlight_type?: string;
  streetlight_condition?: string;
  streetlight_power_source?: string;
  streetlight_operational?: string;
  streetlight_count?: number;

  // Road Segment GPS Geometry (Sealed / Gravel / Earth roads)
  road_segment_points?: Array<{ lat: number; lng: number; alt?: number; acc: number; ts: number; orig_lat?: number; orig_lng?: number }>;
  road_segment_geojson?: string;         // GeoJSON Feature (LineString) string — PostGIS ready
  road_segment_length_m?: number;        // Haversine distance in metres
  road_segment_start_time?: string;      // ISO 8601
  road_segment_end_time?: string;        // ISO 8601
  road_segment_avg_accuracy_m?: number;  // Mean GPS accuracy (metres)
  road_segment_point_count?: number;     // Total GPS waypoints collected

  // Draft workflow status
  status?: "draft" | "queued";
  gps_accuracy_threshold?: number;
}

const STORAGE_KEY = "roads_survey_drafts";

export const db = {
  getDrafts(): SurveyDraft[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load drafts from LocalStorage", e);
      return [];
    }
  },

  saveDrafts(drafts: SurveyDraft[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch (e) {
      console.error("Failed to save drafts to LocalStorage", e);
    }
  },

  addDraft(draft: Omit<SurveyDraft, "id">): SurveyDraft {
    const newDraft: SurveyDraft = {
      ...draft,
      id: typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 9),
    };
    const drafts = this.getDrafts();
    drafts.push(newDraft);
    this.saveDrafts(drafts);
    return newDraft;
  },

  deleteDraft(id: string): void {
    const drafts = this.getDrafts();
    const filtered = drafts.filter((d) => d.id !== id);
    this.saveDrafts(filtered);
  },

  updateDraft(id: string, updatedFields: Partial<SurveyDraft>): SurveyDraft | null {
    const drafts = this.getDrafts();
    const index = drafts.findIndex((d) => d.id === id);
    if (index === -1) return null;
    drafts[index] = { ...drafts[index], ...updatedFields } as SurveyDraft;
    this.saveDrafts(drafts);
    return drafts[index];
  },

  clearDrafts(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  }
};
