-- Additive migration: filter lanes on survey_junctions.
-- Safe to run on an existing database.

ALTER TABLE survey_junctions
  ADD COLUMN IF NOT EXISTS junction_has_filter_lanes TEXT;

ALTER TABLE survey_junctions
  ADD COLUMN IF NOT EXISTS junction_filter_lanes JSONB;
