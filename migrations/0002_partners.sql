CREATE TABLE partners (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  url_template TEXT NOT NULL,
  commission_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, live, blocked_legal, declined
  status_reason TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE partner_conversions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES partners(slug),
  month TEXT NOT NULL, -- e.g. "2026-09"
  reported_conversions INTEGER DEFAULT 0,
  reported_revenue REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(slug, month)
);

-- Seed Data
INSERT INTO partners (slug, name, category, url_template, commission_note, status) VALUES
  ('safetywing', 'SafetyWing', 'Insurance', 'https://safetywing.com/nomad-insurance?referenceID=26593442&utm_source=26593442&utm_medium=Ambassador', '10% recurring on subscriptions', 'live'),
  ('airhelp', 'AirHelp', 'Flight Delay/Cancellation', 'https://airhelp.tpo.lu/znw4dRjM', '', 'live'),
  ('yesim', 'Yesim', 'eSIM', 'https://yesim.tpo.lu/DaBlyOCx', '', 'live'),
  ('wise', 'Wise', 'FinTech', 'https://wise.prf.hn/click/camref:1011l5R5kP', '', 'live'),
  ('us-global-mail', 'US Global Mail', 'Virtual Mailbox', 'https://www.usglobalmail.com/?via=coby', '', 'live'),
  ('nordvpn', 'NordVPN', 'VPN/Security', 'https://go.nordvpn.net/aff_c?aff_id=2495&offer_id=314&url_id=7264', '', 'live'),
  ('bounce', 'Bounce', 'Luggage Storage', 'https://go.bounce.com/SPARKFARE96253961631', '', 'live'),
  ('rocket-languages', 'Rocket Languages', 'Language Learning', 'https://www.rocketlanguages.com/?click=sparkfare', '', 'live'),
  ('rover', 'Rover', 'Pet Care', 'https://www.rover.com/?utm_source=sparkfare', '', 'pending'),
  ('pet-gear', 'Travel Gear', 'Retail', 'https://amazon.com/pet-travel-gear', '', 'pending'),
  ('timekettle', 'Timekettle', 'Travel Gear', 'https://www.awin1.com/cread.php?awinmid=97799&awinaffid=3086775&ued=https%3A%2F%2Ftimekettle.co', 'Awin', 'live'),
  ('parking-access', 'Parking Access', 'Parking', 'https://parkingaccess.com/go/{IATA}?rfid=UoznfWZeo8', '', 'live'),
  ('holafly', 'Holafly', 'eSIM', 'https://holafly.com', '', 'pending');
