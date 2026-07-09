export function getRecordStatus(record: any): "good" | "fair" | "poor" {
  if (!record) return "good";

  // Specific point parameter condition checks
  if (record.bridge_condition) return record.bridge_condition as any;
  if (record.footbridge_condition) return record.footbridge_condition as any;
  if (record.rail_crossing_condition) return record.rail_crossing_condition as any;
  if (record.tollgate_condition) return record.tollgate_condition as any;
  if (record.layby_condition) return record.layby_condition as any;
  if (record.busstop_condition) return record.busstop_condition as any;
  if (record.bus_stop_condition) return record.bus_stop_condition as any;
  if (record.junction_condition) return record.junction_condition as any;
  if (record.sign_condition) return record.sign_condition as any;
  if (record.shelvet_condition) return record.shelvet_condition as any;
  
  if (record.culvet_serviceability) {
    const s = record.culvet_serviceability;
    if (s === "good" || s === "operational") return "good";
    if (s === "partially_blocked" || s === "fair") return "fair";
    return "poor";
  }
  
  if (record.causeway_condition) return record.causeway_condition as any;
  if (record.causeway_serviceability) {
    const s = record.causeway_serviceability;
    if (s === "good" || s === "operational") return "good";
    if (s === "partially_blocked" || s === "fair") return "fair";
    return "poor";
  }
  
  if (record.drift_condition) return record.drift_condition as any;
  if (record.grid_condition) return record.grid_condition as any;
  if (record.traffic_lights_condition) return record.traffic_lights_condition as any;
  if (record.streetlight_condition) return record.streetlight_condition as any;
  
  // Roads condition checks
  if (record.gravel_condition) {
    const s = record.gravel_condition;
    if (s === "good" || s === "excellent") return "good";
    if (s === "fair") return "fair";
    return "poor";
  }
  if (record.paved_road_condition) {
    const s = record.paved_road_condition;
    if (s === "good" || s === "excellent") return "good";
    if (s === "fair") return "fair";
    return "poor";
  }
  if (record.earth_road_condition) {
    const s = record.earth_road_condition;
    if (s === "good" || s === "excellent") return "good";
    if (s === "fair") return "fair";
    return "poor";
  }
  if (record.road_condition) {
    const s = record.road_condition;
    if (s === "good" || s === "excellent" || s === "working" || s === "active") return "good";
    if (s === "fair" || s === "partially_blocked") return "fair";
    return "poor";
  }
  
  if (record.Status_001) {
    const s = record.Status_001.toLowerCase();
    if (s === "working" || s === "good" || s === "active") return "good";
    if (s === "not_working" || s === "poor" || s === "inactive") return "poor";
    return "fair";
  }
  
  return "good";
}

export function getAssetType(record: any): string {
  if (!record) return "Asset";
  
  const cat = record.asset_category;
  if (cat) {
    const mapping: Record<string, string> = {
      sealed: "Sealed Road",
      gravel: "Gravel Road",
      earth: "Earth Road",
      bridge: "Bridge",
      footbridge: "Foot Bridge",
      rail_crossing: "Rail Crossing",
      tollgate: "Tollgate",
      layby: "Lay By",
      busstop: "Bus Stop",
      junction: "Junction",
      sign: "Road Sign",
      shelvet: "Shelvet",
      culvert: "Culvert",
      piped_causeway: "Piped Causeway",
      drift: "Drift",
      grid: "Grid",
      traffic_lights: "Traffic Lights",
      streetlight: "Streetlight"
    };
    if (mapping[cat]) return mapping[cat];
  }

  // Fallbacks
  if (record.bridge) return "Bridge";
  if (record.culvet_class) return "Culvert";
  if (record.shelvets_type) return "Shelvet";
  if (record.junction_type) return "Junction";
  if (record.bus_stop_present || record.busstop_type) return "Bus Stop";
  if (record.gravel_road_name) return "Gravel Road";
  if (record.paved_road_name) {
    if (record.paved_road_type === "concrete_pavement" || record.Road_Type === "concrete_pavement") return "Concrete Road";
    return "Sealed Road";
  }
  if (record.earth_road_name) return "Earth Road";
  if (record.Status_001 || record.Power_Source_001 || record.streetlight_type) return "Street Light";
  return "Road Sign";
}

export function getAssetName(record: any): string {
  if (!record) return "Asset Name";
  
  const cat = record.asset_category;
  if (record.bridge) return record.bridge;
  if (record.footbridge_name) return record.footbridge_name;
  if (record.rail_crossing_name) return record.rail_crossing_name;
  if (record.tollgate_name) return record.tollgate_name;
  if (record.causeway_name) return record.causeway_name;
  if (record.drift_name) return record.drift_name;
  if (record.grid_name) return record.grid_name;
  if (record.traffic_lights_location) return record.traffic_lights_location;
  if (record.gravel_road_name) return record.gravel_road_name;
  if (record.paved_road_name) return record.paved_road_name;
  if (record.earth_road_name) return record.earth_road_name;
  
  if (record.culvet_class) {
    return String(record.culvet_class)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (record.shelvets_type) {
    return `Shelvet (${String(record.shelvets_type).toUpperCase()})`;
  }
  if (record.junction_type) {
    return `Junction (${String(record.junction_type).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())})`;
  }
  if (record.bus_stop_present || record.busstop_type) {
    return record.route_number || record.busstop_type ? `Bus Stop (${record.route_number || record.busstop_type})` : "Bus Stop";
  }
  if (record.Status_001 || record.Power_Source_001 || record.streetlight_type) {
    return `Street Light (${String(record.Power_Source_001 || record.streetlight_power_source || "Solar").toUpperCase()})`;
  }
  return record.sign_name || record.sign_type ? `${String(record.sign_type || "SADC").toUpperCase()} Road Sign` : "SADC Road Sign";
}

export function getCategoryKey(record: any): string {
  if (!record) return "sign";
  if (record.asset_category) return record.asset_category;
  
  const type = getAssetType(record);
  if (type === "Sealed Road" || type === "Concrete Road") return "sealed";
  if (type === "Gravel Road") return "gravel";
  if (type === "Earth Road") return "earth";
  if (type === "Bridge") return "bridge";
  if (type === "Foot Bridge") return "footbridge";
  if (type === "Rail Crossing") return "rail_crossing";
  if (type === "Tollgate") return "tollgate";
  if (type === "Lay By" || type === "Layby") return "layby";
  if (type === "Bus Stop") return "busstop";
  if (type === "Junction") return "junction";
  if (type === "Road Sign") return "sign";
  if (type === "Shelvet") return "shelvet";
  if (type === "Culvert") return "culvert";
  if (type === "Piped Causeway") return "piped_causeway";
  if (type === "Drift") return "drift";
  if (type === "Grid") return "grid";
  if (type === "Traffic Lights") return "traffic_lights";
  if (type === "Streetlight" || type === "Street Light") return "streetlight";
  return "sign"; // default fallback
}

