-- Idempotent seed for Sulyap catalog (presidents + artifacts + curator)
-- Curator login: curator@example.com / ChangeMeLocal12
-- Prefer letting FastAPI seed on startup; this SQL is for the Supabase SQL Editor.
-- Inserts missing RD codes even when some artifacts already exist.

INSERT INTO users (email, hashed_password, role, is_active)
SELECT 'curator@example.com', '$2b$12$xOTqObhvVv.cHjTVuzbpyu9X8DGK/PDl8Emt7CvHX.UUIQfjcVD9u', 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'curator@example.com');

INSERT INTO presidents (id, name, service, icon) SELECT 1, 'Br. Rafael S. Donato, FSC', '1987 - 1994', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 1 OR name = 'Br. Rafael S. Donato, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 2, 'Br. Gus Boquer, FSC', '1994 - 1999', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 2 OR name = 'Br. Gus Boquer, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 3, 'Br. Andrew B. Gonzalez, FSC', '1999 - 2001', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 3 OR name = 'Br. Andrew B. Gonzalez, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 4, 'Br. Rolando V. Dizon, FSC', '2001 - 2004', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 4 OR name = 'Br. Rolando V. Dizon, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 5, 'Br. Narciso S. Erguiza, FSC', '2004 - 2008', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 5 OR name = 'Br. Narciso S. Erguiza, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 6, 'Br. Armin A. Luistro, FSC', '2008 - 2010', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 6 OR name = 'Br. Armin A. Luistro, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 7, 'Dr. Carmelita R. Quebengco', '2010 - 2016', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 7 OR name = 'Dr. Carmelita R. Quebengco');
INSERT INTO presidents (id, name, service, icon) SELECT 8, 'Br. Geminiano M. Buenaventura, FSC', '2016 - 2019', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 8 OR name = 'Br. Geminiano M. Buenaventura, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 9, 'Br. Francisco "Sockie" dela Rosa VI, FSC', '2019 - 2024', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 9 OR name = 'Br. Francisco "Sockie" dela Rosa VI, FSC');
INSERT INTO presidents (id, name, service, icon) SELECT 10, 'Br. Iñigo Riola, FSC', '2024 - present', '👤' WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = 10 OR name = 'Br. Iñigo Riola, FSC');

SELECT setval(pg_get_serial_sequence('presidents', 'id'), (SELECT COALESCE(MAX(id), 1) FROM presidents));

DO $$
DECLARE curator_id INTEGER;
BEGIN
  SELECT id INTO curator_id FROM users WHERE email = 'curator@example.com';
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD204') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Founding Plaque', 'Commemorative plaque marking a foundational period in the institution''s growth.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD204', 'Br. Rafael S. Donato, FSC', '1987', 'From the first expansion era', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD244') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Presidential Trophy', 'Trained scanner class RD244. Curatorial copy will deepen as catalog records are edited.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD244', 'Br. Gus Boquer, FSC', '1998', 'Award', '🏆', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD246') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Excellence Trophy', 'Trophy recognizing sustained excellence in academic and community programs.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD246', 'Br. Gus Boquer, FSC', '1996', 'Institutional achievement marker', '🏆', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD301') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Presidential Portrait', 'Formal portrait representing presidential leadership.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD301', 'Br. Andrew B. Gonzalez, FSC', '2000', 'Official museum collection', '🖼️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD302') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Accreditation Medallion', 'Medallion issued in connection with accreditation milestones.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD302', 'Br. Rolando V. Dizon, FSC', '2003', 'Quality standards milestone', '🎖️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD303') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Charter Document', 'Governance charter document preserved in the memorabilia gallery.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD303', 'Br. Narciso S. Erguiza, FSC', '2006', 'Historic governance record', '📜', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD304') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Campus Expansion Blueprint', 'Historical planning document from the expansion era.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD304', 'Br. Armin A. Luistro, FSC', '2009', 'Planning records', '📐', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD305') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Leadership Citation', 'Citation recognizing institutional leadership initiatives.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD305', 'Dr. Carmelita R. Quebengco', '2012', 'Recognition program', '📋', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD306') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Library Dedication Plaque', 'Dedication plaque associated with Information Resource Center history.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD306', 'Br. Geminiano M. Buenaventura, FSC', '2017', 'IRC milestone', '🏛️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD307') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Strategic Plan Binder', 'Binder representing strategic planning during the early 2020s.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD307', 'Br. Francisco "Sockie" dela Rosa VI, FSC', '2021', 'Governance records', '📚', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD309') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Inauguration Program', 'Program from the same presidential era as other 2003 memorabilia.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD309', 'Br. Rolando V. Dizon, FSC', '2003', 'Ceremonial print', '📰', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD310') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Campus Master Plan Folio', 'Planning folio from the accreditation-era collection.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD310', 'Br. Rolando V. Dizon, FSC', '2003', 'Planning records', '🗂️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD311') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Guest Lecture Poster', 'Poster from the same year cluster as other 2003 items.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD311', 'Br. Rolando V. Dizon, FSC', '2003', 'Academic event', '🖼️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD312') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Scholarship Certificate', 'Certificate from the 2012 recognition program cluster.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD312', 'Dr. Carmelita R. Quebengco', '2012', 'Recognition program', '📜', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD313') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Faculty Assembly Notes', 'Typed notes from the same presidential term.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD313', 'Dr. Carmelita R. Quebengco', '2012', 'Governance records', '📝', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD314') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Library Bookmark Set', 'Bookmark set linked to the same tag cluster.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD314', 'Dr. Carmelita R. Quebengco', '2012', 'IRC milestone', '🔖', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD315') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Presidential Seal Replica', 'Replica sharing year and president with the portrait.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD315', 'Br. Andrew B. Gonzalez, FSC', '2000', 'Official museum collection', '🏅', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD316') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Campus Photo Album', 'Photo album from the same collection cluster.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD316', 'Br. Andrew B. Gonzalez, FSC', '2000', 'Official museum collection', '📷', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD317') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Lasallian Values Poster', 'Poster sharing 2024 and president tags.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD317', 'Br. Iñigo Riola, FSC', '2024', 'Printed institutional text', '📋', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD318') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Mission Week Banner', 'Banner from Mission Week displays.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD318', 'Br. Iñigo Riola, FSC', '2024', 'Printed institutional text', '🎗️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD319') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Heritage Lecture Ticket', 'Ticket stub sharing the 1987 tag with the founding plaque.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD319', 'Br. Rafael S. Donato, FSC', '1987', 'Academic event', '🎫', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD320') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Foundation Day Medal', 'Medal from the same-era related browsing cluster.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD320', 'Br. Rafael S. Donato, FSC', '1987', 'From the first expansion era', '🎖️', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD321') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'IRC Newsletter Vol. 2', 'Newsletter sharing subtitle theme with the dedication plaque.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD321', 'Br. Geminiano M. Buenaventura, FSC', '2017', 'IRC milestone', '📰', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD322') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Lasallian Mission Statement', 'Printed statement of Lasallian mission used in gallery displays.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD322', 'Br. Iñigo Riola, FSC', '2024', 'Printed institutional text', '📄', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD323') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Strategic Retreat Binder', 'Binder sharing governance subtitle tag.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD323', 'Br. Francisco "Sockie" dela Rosa VI, FSC', '2021', 'Governance records', '📚', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD324') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Alumni Homecoming Pin', 'Pin sharing year with the blueprint era.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD324', 'Br. Armin A. Luistro, FSC', '2009', 'Recognition program', '📌', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD325') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD325', 'Published catalog record for scanner class RD325. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD325', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD327') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD327', 'Published catalog record for scanner class RD327. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD327', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD328') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD328', 'Published catalog record for scanner class RD328. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD328', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD330') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD330', 'Published catalog record for scanner class RD330. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD330', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD331') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD331', 'Published catalog record for scanner class RD331. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD331', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD333') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD333', 'Published catalog record for scanner class RD333. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD333', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD336') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD336', 'Published catalog record for scanner class RD336. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD336', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD337') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD337', 'Published catalog record for scanner class RD337. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD337', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD338') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD338', 'Published catalog record for scanner class RD338. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD338', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD340') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD340', 'Published catalog record for scanner class RD340. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD340', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD341') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD341', 'Published catalog record for scanner class RD341. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD341', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD342') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD342', 'Published catalog record for scanner class RD342. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD342', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD346') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD346', 'Published catalog record for scanner class RD346. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD346', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD347') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD347', 'Published catalog record for scanner class RD347. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD347', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD348') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD348', 'Published catalog record for scanner class RD348. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD348', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD351') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD351', 'Published catalog record for scanner class RD351. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD351', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD353') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD353', 'Published catalog record for scanner class RD353. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD353', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD356') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD356', 'Published catalog record for scanner class RD356. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD356', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD358') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD358', 'Published catalog record for scanner class RD358. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD358', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD360') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD360', 'Published catalog record for scanner class RD360. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD360', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD364') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD364', 'Published catalog record for scanner class RD364. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD364', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD365') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD365', 'Published catalog record for scanner class RD365. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD365', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD366') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD366', 'Published catalog record for scanner class RD366. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD366', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD372') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD372', 'Published catalog record for scanner class RD372. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD372', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD374') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD374', 'Published catalog record for scanner class RD374. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD374', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD376') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD376', 'Published catalog record for scanner class RD376. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD376', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD381') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD381', 'Published catalog record for scanner class RD381. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD381', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD393') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD393', 'Published catalog record for scanner class RD393. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD393', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD399') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD399', 'Published catalog record for scanner class RD399. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD399', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD400') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD400', 'Published catalog record for scanner class RD400. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD400', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD401') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD401', 'Published catalog record for scanner class RD401. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD401', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD406') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD406', 'Published catalog record for scanner class RD406. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD406', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD408') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD408', 'Published catalog record for scanner class RD408. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD408', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD409') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD409', 'Published catalog record for scanner class RD409. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD409', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = 'RD413') THEN
    INSERT INTO artifacts (owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) VALUES (curator_id, 'Memorabilia RD413', 'Published catalog record for scanner class RD413. Curators can edit this title and description in Curator Desk.', 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png', 'RD413', 'DLSU-D Presidents'' Gallery', '', 'Scanner catalog entry', '🏺', TRUE);
  END IF;
END $$;
