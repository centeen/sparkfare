-- N12 (tracking plan): the visitor class and the event shape's version become columns, so queries stop matching on the JSON text of `meta`.
-- Existing rows: ua_class is filled from meta; schema_version defaults to 1 (every current event is version 1). The Worker also adds the columns on first use.
ALTER TABLE events ADD COLUMN ua_class TEXT;
ALTER TABLE events ADD COLUMN schema_version INTEGER DEFAULT 1;
UPDATE events SET ua_class = json_extract(meta, '$.ua_class')
  WHERE ua_class IS NULL AND meta IS NOT NULL AND json_valid(meta) AND json_extract(meta, '$.ua_class') IN ('bot', 'human', 'none');
