-- Transition policy for OLD seed ids absorbed by sokchad-v1 tree:
-- * Same-id nodes that exist in the new tree keep id+parent (labels aligned) and stay ACTIVE.
-- * True orphans (electronics_laptops=computers duplicate, shoes_sneakers/formal,
--   vehicles_sedans/suvs) are soft-DISABLED (never deleted) so any product referencing
--   them keeps a valid reference; new fixed-ID branches take over the buyer view.
UPDATE categories SET is_active=0 WHERE id IN
 ('electronics_laptops','shoes_sneakers','shoes_formal','vehicles_sedans','vehicles_suvs');
-- Align shared ids with the new tree wording (same ids, same parents)
UPDATE categories SET name_ar='هواتف وأجهزة لوحية', name_fr='Téléphones et tablettes', name_en='Phones & tablets' WHERE id='electronics_phones';
UPDATE categories SET name_ar='الصوتيات', name_fr='Audio', name_en='Audio' WHERE id='electronics_audio';
UPDATE categories SET name_ar='التلفزيون والعرض', name_fr='TV et vidéo', name_en='TV & video' WHERE id='electronics_tv';
UPDATE categories SET name_ar='رجالية', name_fr='Homme', name_en='Homme' WHERE id='fashion_men';
UPDATE categories SET name_ar='نسائية', name_fr='Femme', name_en='Femme' WHERE id='fashion_women';
UPDATE categories SET name_ar='أطفال', name_fr='Enfant', name_en='Enfant' WHERE id='fashion_kids';
