/**
 * Sokchad category tree (sokchad-v1) — fixed IDs, AR/FR names, 2–3 levels.
 * Sources: owner-approved category guide (20 families). Root IDs of the existing
 * catalog are PRESERVED (electronics, fashion, shoes, home_garden, vehicles,
 * agriculture, services, real_estate, sports). Children use sc-… style fixed ids.
 * Buyer UI shows only families/branches that have published listings; seller
 * picker shows all enabled ones (same list, is_active in DB).
 */

export interface CatNode {
  id: string;
  parentId?: string;
  nameAr: string;
  nameFr: string;
  sort: number;
  icon?: string;
  color?: string;
  image?: any; // require() asset (roots only, optional)
}

export const CATEGORY_TREE: CatNode[] = [
  // ===== 01 Electronics (existing root id preserved) =====
  { id: 'electronics', nameAr: 'إلكترونيات', nameFr: 'Électronique', sort: 1, icon: 'devices', color: '#3B82F6' },
  { id: 'electronics_phones', parentId: 'electronics', nameAr: 'هواتف وأجهزة لوحية', nameFr: 'Téléphones et tablettes', sort: 1, icon: 'smartphone', color: '#3B82F6' },
  { id: 'electronics_phone_accessories', parentId: 'electronics', nameAr: 'ملحقات الهواتف', nameFr: 'Accessoires téléphoniques', sort: 2, icon: 'battery-charging-full', color: '#3B82F6' },
  { id: 'electronics_computers', parentId: 'electronics', nameAr: 'الحواسيب', nameFr: 'Ordinateurs', sort: 3, icon: 'computer', color: '#3B82F6' },
  { id: 'electronics_peripherals', parentId: 'electronics', nameAr: 'ملحقات الحاسوب', nameFr: 'Périphériques informatiques', sort: 3, icon: 'keyboard', color: '#3B82F6' },
  { id: 'electronics_networks', parentId: 'electronics', nameAr: 'الشبكات', nameFr: 'Réseaux', sort: 4, icon: 'router', color: '#3B82F6' },
  { id: 'electronics_audio', parentId: 'electronics', nameAr: 'الصوتيات', nameFr: 'Audio', sort: 4, icon: 'headphones', color: '#3B82F6' },
  { id: 'electronics_tv', parentId: 'electronics', nameAr: 'التلفزيون والعرض', nameFr: 'TV et vidéo', sort: 5, icon: 'tv', color: '#3B82F6' },
  { id: 'electronics_photo', parentId: 'electronics', nameAr: 'التصوير', nameFr: 'Photo et vidéo', sort: 6, icon: 'photo-camera', color: '#3B82F6' },
  { id: 'electronics_gaming', parentId: 'electronics', nameAr: 'ألعاب الفيديو', nameFr: 'Jeux vidéo', sort: 7, icon: 'sports-esports', color: '#3B82F6' },
  { id: 'electronics_wearables', parentId: 'electronics', nameAr: 'أجهزة قابلة للارتداء', nameFr: 'Objets connectés', sort: 8, icon: 'watch', color: '#3B82F6' },
  // 3rd level for computers branch
  { id: 'electronics_computers_laptops', parentId: 'electronics_computers', nameAr: 'لابتوبات', nameFr: 'Ordinateurs portables', sort: 1, icon: 'laptop', color: '#3B82F6' },
  { id: 'electronics_computers_desktops', parentId: 'electronics_computers', nameAr: 'حواسيب مكتبية', nameFr: 'Ordinateurs de bureau', sort: 2, icon: 'desktop-windows', color: '#3B82F6' },
  { id: 'electronics_computers_alloff', parentId: 'electronics_computers', nameAr: 'الكل في واحد', nameFr: 'Tout-en-un', sort: 3, icon: 'desktop-mac', color: '#3B82F6' },

  // ===== 02 Clothing (existing root id 'fashion' preserved) =====
  { id: 'fashion', nameAr: 'ملابس', nameFr: 'Vêtements', sort: 2, icon: 'checkroom', color: '#EC4899' },
  { id: 'fashion_women', parentId: 'fashion', nameAr: 'نسائية', nameFr: 'Femme', sort: 1, icon: 'woman', color: '#EC4899' },
  { id: 'fashion_men', parentId: 'fashion', nameAr: 'رجالية', nameFr: 'Homme', sort: 2, icon: 'man', color: '#EC4899' },
  { id: 'fashion_kids', parentId: 'fashion', nameAr: 'أطفال', nameFr: 'Enfant', sort: 3, icon: 'child-care', color: '#EC4899' },
  { id: 'fashion_traditional', parentId: 'fashion', nameAr: 'ملابس تقليدية', nameFr: 'Tenues traditionnelles', sort: 4, icon: 'local-offer', color: '#EC4899' },
  { id: 'fashion_professional', parentId: 'fashion', nameAr: 'ملابس مهنية', nameFr: 'Vêtements professionnels', sort: 4, icon: 'work', color: '#EC4899' },
  { id: 'fashion_headwear', parentId: 'fashion', nameAr: 'أغطية الرأس', nameFr: 'Couvre-chefs', sort: 5, icon: 'face', color: '#EC4899' },

  // ===== 03 Shoes (existing root id preserved) =====
  { id: 'shoes', nameAr: 'أحذية', nameFr: 'Chaussures', sort: 3, icon: 'hiking', color: '#F59E0B' },
  { id: 'shoes_men', parentId: 'shoes', nameAr: 'رجالية', nameFr: 'Homme', sort: 1, icon: 'man', color: '#F59E0B' },
  { id: 'shoes_women', parentId: 'shoes', nameAr: 'نسائية', nameFr: 'Femme', sort: 2, icon: 'woman', color: '#F59E0B' },
  { id: 'shoes_kids', parentId: 'shoes', nameAr: 'أطفال', nameFr: 'Enfant', sort: 2, icon: 'child-friendly', color: '#F59E0B' },
  { id: 'shoes_professional', parentId: 'shoes', nameAr: 'أحذية مهنية', nameFr: 'Chaussures professionnelles', sort: 3, icon: 'engineering', color: '#F59E0B' },
  { id: 'shoes_accessories', parentId: 'shoes', nameAr: 'ملحقات الأحذية', nameFr: 'Accessoires chaussures', sort: 3, icon: 'auto-fix-high', color: '#F59E0B' },

  // ===== 04 Bags & accessories (new family) =====
  { id: 'bags_accessories', nameAr: 'الحقائب والإكسسوارات', nameFr: 'Sacs et accessoires', sort: 4, icon: 'shopping-bag', color: '#8B5CF6' },
  { id: 'bags', parentId: 'bags_accessories', nameAr: 'الحقائب', nameFr: 'Sacs', sort: 1, icon: 'backpack', color: '#8B5CF6' },
  { id: 'accessories_personal', parentId: 'bags_accessories', nameAr: 'إكسسوارات شخصية', nameFr: 'Accessoires personnels', sort: 2, icon: 'watch', color: '#8B5CF6' },

  // ===== 05 Beauty (new) =====
  { id: 'beauty', nameAr: 'التجميل والعناية الشخصية', nameFr: 'Beauté et soins personnels', sort: 5, icon: 'spa', color: '#F472B6' },
  { id: 'beauty_skin', parentId: 'beauty', nameAr: 'البشرة والجسم', nameFr: 'Peau et corps', sort: 1, icon: 'spa', color: '#F472B6' },
  { id: 'beauty_hair', parentId: 'beauty', nameAr: 'الشعر', nameFr: 'Cheveux', sort: 2, icon: 'content-cut', color: '#F472B6' },
  { id: 'beauty_makeup', parentId: 'beauty', nameAr: 'المكياج', nameFr: 'Maquillage', sort: 2, icon: 'brush', color: '#F472B6' },
  { id: 'beauty_perfumes', parentId: 'beauty', nameAr: 'العطور', nameFr: 'Parfums', sort: 3, icon: 'air', color: '#F472B6' },
  { id: 'beauty_hygiene', parentId: 'beauty', nameAr: 'النظافة والحلاقة', nameFr: 'Hygiène et rasage', sort: 4, icon: 'soap', color: '#F472B6' },

  // ===== 06 Mother & baby (new) =====
  { id: 'baby', nameAr: 'الأم والطفل', nameFr: 'Bébé et puériculture', sort: 6, icon: 'child-friendly', color: '#14B8A6' },
  { id: 'baby_care', parentId: 'baby', nameAr: 'العناية بالرضيع', nameFr: 'Soins bébé', sort: 1, icon: 'baby-changing-station', color: '#14B8A6' },
  { id: 'baby_feeding', parentId: 'baby', nameAr: 'الرضاعة والطعام', nameFr: 'Repas bébé', sort: 2, icon: 'restaurant', color: '#14B8A6' },
  { id: 'baby_mobility', parentId: 'baby', nameAr: 'التنقل', nameFr: 'Sorties bébé', sort: 3, icon: 'stroller', color: '#14B8A6' },
  { id: 'baby_sleep', parentId: 'baby', nameAr: 'النوم والسلامة', nameFr: 'Sommeil et sécurité', sort: 3, icon: 'nights_stay', color: '#14B8A6' },
  { id: 'baby_clothes', parentId: 'baby', nameAr: 'ملابس الرضّع', nameFr: 'Vêtements bébé', sort: 4, icon: 'checkroom', color: '#14B8A6' },

  // ===== 07 Home & kitchen (existing root id 'home_garden' → split) =====
  { id: 'home_kitchen', nameAr: 'المنزل والمطبخ', nameFr: 'Maison et cuisine', sort: 7, icon: 'kitchen', color: '#10B981' },
  { id: 'home_cooking', parentId: 'home_kitchen', nameAr: 'الطبخ', nameFr: 'Cuisson', sort: 1, icon: 'soup-kitchen', color: '#10B981' },
  { id: 'home_table', parentId: 'home_kitchen', nameAr: 'المائدة', nameFr: 'Arts de la table', sort: 2, icon: 'restaurant-menu', color: '#10B981' },
  { id: 'home_storage', parentId: 'home_kitchen', nameAr: 'التخزين', nameFr: 'Rangement', sort: 2, icon: 'inventory-2', color: '#10B981' },
  { id: 'home_linen', parentId: 'home_kitchen', nameAr: 'المفروشات', nameFr: 'Linge de maison', sort: 3, icon: 'bed', color: '#10B981' },
  { id: 'home_decor', parentId: 'home_kitchen', nameAr: 'الديكور', nameFr: 'Décoration', sort: 4, icon: 'chair', color: '#10B981' },
  { id: 'home_cleaning', parentId: 'home_kitchen', nameAr: 'النظافة المنزلية', nameFr: 'Entretien ménager', sort: 5, icon: 'cleaning-services', color: '#10B981' },

  // ===== 08 Furniture (new) =====
  { id: 'furniture', nameAr: 'الأثاث', nameFr: 'Meubles', sort: 8, icon: 'weekend', color: '#0EA5E9' },
  { id: 'furniture_salon', parentId: 'furniture', nameAr: 'غرفة المعيشة', nameFr: 'Salon', sort: 1, icon: 'weekend', color: '#0EA5E9' },
  { id: 'furniture_bedroom', parentId: 'furniture', nameAr: 'غرفة النوم', nameFr: 'Chambre', sort: 2, icon: 'bed', color: '#0EA5E9' },
  { id: 'furniture_dining', parentId: 'furniture', nameAr: 'الطعام', nameFr: 'Salle à manger', sort: 2, icon: 'table-restaurant', color: '#0EA5E9' },
  { id: 'furniture_office', parentId: 'furniture', nameAr: 'المكتب والتخزين', nameFr: 'Bureau et rangement', sort: 3, icon: 'desk', color: '#0EA5E9' },
  { id: 'furniture_outdoor', parentId: 'furniture', nameAr: 'خارجي', nameFr: 'Extérieur', sort: 3, icon: 'deck', color: '#0EA5E9' },

  // ===== 09 Home appliances (new) =====
  { id: 'electromenager', nameAr: 'الأجهزة المنزلية', nameFr: 'Électroménager', sort: 9, icon: 'kitchen', color: '#64748B' },
  { id: 'electromenager_froid', parentId: 'electromenager', nameAr: 'التبريد', nameFr: 'Froid', sort: 1, icon: 'ac-unit', color: '#64748B' },
  { id: 'electromenager_clim', parentId: 'electromenager', nameAr: 'التهوية والتكييف', nameFr: 'Climatisation et ventilation', sort: 2, icon: 'mode-fan', color: '#64748B' },
  { id: 'electromenager_cooking', parentId: 'electromenager', nameAr: 'الطبخ الكهربائي والغاز', nameFr: 'Appareils de cuisson', sort: 3, icon: 'microwave', color: '#64748B' },
  { id: 'electromenager_small', parentId: 'electromenager', nameAr: 'أجهزة مطبخ صغيرة', nameFr: 'Petit électroménager', sort: 4, icon: 'blender', color: '#64748B' },
  { id: 'electromenager_care', parentId: 'electromenager', nameAr: 'العناية بالمنزل', nameFr: 'Entretien de la maison', sort: 4, icon: 'local-laundry-service', color: '#64748B' },

  // ===== 10 Electricity & solar (new) =====
  { id: 'energy', nameAr: 'الكهرباء والطاقة الشمسية', nameFr: 'Électricité et énergie solaire', sort: 10, icon: 'bolt', color: '#F59E0B' },
  { id: 'energy_solar', parentId: 'energy', nameAr: 'الطاقة الشمسية', nameFr: 'Solaire', sort: 1, icon: 'solar-power', color: '#F59E0B' },
  { id: 'energy_backup', parentId: 'energy', nameAr: 'الطاقة الاحتياطية', nameFr: 'Alimentation de secours', sort: 2, icon: 'power', color: '#F59E0B' },
  { id: 'energy_install', parentId: 'energy', nameAr: 'التركيبات الكهربائية', nameFr: 'Installation électrique', sort: 3, icon: 'electrical-services', color: '#F59E0B' },
  { id: 'energy_lighting', parentId: 'energy', nameAr: 'الإنارة', nameFr: 'Éclairage', sort: 4, icon: 'lightbulb', color: '#F59E0B' },

  // ===== 11 Construction & tools (new) =====
  { id: 'construction', nameAr: 'البناء والأدوات', nameFr: 'Bricolage et construction', sort: 11, icon: 'construction', color: '#EA580C' },
  { id: 'construction_hand', parentId: 'construction', nameAr: 'أدوات يدوية', nameFr: 'Outils manuels', sort: 1, icon: 'handyman', color: '#EA580C' },
  { id: 'construction_power', parentId: 'construction', nameAr: 'أدوات كهربائية', nameFr: 'Outillage électroportatif', sort: 2, icon: 'hardware', color: '#EA580C' },
  { id: 'construction_plumbing', parentId: 'construction', nameAr: 'السباكة', nameFr: 'Plomberie', sort: 3, icon: 'plumbing', color: '#EA580C' },
  { id: 'construction_materials', parentId: 'construction', nameAr: 'مواد بناء', nameFr: 'Matériaux', sort: 4, icon: 'foundation', color: '#EA580C' },
  { id: 'construction_finish', parentId: 'construction', nameAr: 'التشطيب والحماية', nameFr: 'Finition et protection', sort: 5, icon: 'format-paint', color: '#EA580C' },

  // ===== 12 Auto & moto (existing root id preserved) =====
  { id: 'vehicles', nameAr: 'السيارات والدراجات', nameFr: 'Auto et moto', sort: 12, icon: 'directions-car', color: '#EF4444' },
  { id: 'vehicles_parts', parentId: 'vehicles', nameAr: 'قطع غيار', nameFr: 'Pièces détachées', sort: 1, icon: 'settings', color: '#EF4444' },
  { id: 'vehicles_wheels', parentId: 'vehicles', nameAr: 'عجلات وبطاريات', nameFr: 'Roues et batteries', sort: 2, icon: 'tire-repair', color: '#EF4444' },
  { id: 'vehicles_accessories', parentId: 'vehicles', nameAr: 'ملحقات وعناية', nameFr: 'Accessoires et entretien', sort: 3, icon: 'car-wash', color: '#EF4444' },
  { id: 'vehicles_gear', parentId: 'vehicles', nameAr: 'تجهيزات راكب', nameFr: 'Équipement du motard', sort: 4, icon: 'sports-motorsports', color: '#EF4444' },

  // ===== 13 Agriculture (existing root id preserved) =====
  { id: 'agriculture', nameAr: 'الزراعة والبستنة وتربية الحيوان', nameFr: 'Agriculture, jardin et élevage', sort: 13, icon: 'grass', color: '#84CC16' },
  { id: 'agriculture_culture', parentId: 'agriculture', nameAr: 'الزراعة', nameFr: 'Culture', sort: 1, icon: 'eco', color: '#84CC16' },
  { id: 'agriculture_irrigation', parentId: 'agriculture', nameAr: 'الري', nameFr: 'Irrigation', sort: 2, icon: 'water-drop', color: '#84CC16' },
  { id: 'agriculture_machinery', parentId: 'agriculture', nameAr: 'معدات زراعية', nameFr: 'Matériel agricole', sort: 3, icon: 'agriculture', color: '#84CC16' },
  { id: 'agriculture_livestock', parentId: 'agriculture', nameAr: 'مستلزمات التربية', nameFr: 'Fournitures d’élevage', sort: 4, icon: 'pets', color: '#84CC16' },
  { id: 'agriculture_garden', parentId: 'agriculture', nameAr: 'الحديقة', nameFr: 'Jardin', sort: 5, icon: 'yard', color: '#84CC16' },

  // ===== 14 Grocery (new) =====
  { id: 'grocery', nameAr: 'البقالة والمشروبات', nameFr: 'Alimentation et boissons', sort: 14, icon: 'shopping-cart', color: '#D97706' },
  { id: 'grocery_cereals', parentId: 'grocery', nameAr: 'الحبوب والبقول', nameFr: 'Céréales et légumineuses', sort: 1, icon: 'grain', color: '#D97706' },
  { id: 'grocery_epicerie', parentId: 'grocery', nameAr: 'أساسيات الطبخ', nameFr: 'Épicerie', sort: 2, icon: 'kitchen', color: '#D97706' },
  { id: 'grocery_breakfast', parentId: 'grocery', nameAr: 'الإفطار والحلويات', nameFr: 'Petit-déjeuner et gourmandises', sort: 3, icon: 'coffee', color: '#D97706' },
  { id: 'grocery_drinks', parentId: 'grocery', nameAr: 'مشروبات', nameFr: 'Boissons', sort: 3, icon: 'local-drink', color: '#D97706' },

  // ===== 15 Office & school (new) =====
  { id: 'office_school', nameAr: 'المكتب والمدرسة', nameFr: 'Bureau et fournitures scolaires', sort: 15, icon: 'school', color: '#0EA5E9' },
  { id: 'office_writing', parentId: 'office_school', nameAr: 'كتابة وورق', nameFr: 'Écriture et papier', sort: 1, icon: 'edit', color: '#0EA5E9' },
  { id: 'office_organize', parentId: 'office_school', nameAr: 'تنظيم', nameFr: 'Classement', sort: 2, icon: 'folder', color: '#0EA5E9' },
  { id: 'office_equipment', parentId: 'office_school', nameAr: 'تجهيزات مكتب', nameFr: 'Équipement de bureau', sort: 3, icon: 'print', color: '#0EA5E9' },
  { id: 'school_supplies', parentId: 'office_school', nameAr: 'مستلزمات دراسة', nameFr: 'Accessoires scolaires', sort: 4, icon: 'school', color: '#0EA5E9' },

  // ===== 16 Sport & outdoor (existing root id preserved) =====
  { id: 'sports', nameAr: 'الرياضة والرحلات', nameFr: 'Sport et plein air', sort: 16, icon: 'sports-soccer', color: '#22C55E' },
  { id: 'sports_team', parentId: 'sports', nameAr: 'رياضات جماعية', nameFr: 'Sports collectifs', sort: 1, icon: 'sports-soccer', color: '#22C55E' },
  { id: 'sports_fitness', parentId: 'sports', nameAr: 'لياقة', nameFr: 'Fitness', sort: 2, icon: 'fitness-center', color: '#22C55E' },
  { id: 'sports_cycling', parentId: 'sports', nameAr: 'دراجات', nameFr: 'Cyclisme', sort: 3, icon: 'pedal-bike', color: '#22C55E' },
  { id: 'sports_camping', parentId: 'sports', nameAr: 'رحلات', nameFr: 'Camping', sort: 4, icon: 'forest', color: '#22C55E' },

  // ===== 17 Toys & hobbies (new) =====
  { id: 'toys', nameAr: 'الألعاب والهوايات', nameFr: 'Jouets et loisirs créatifs', sort: 17, icon: 'toys', color: '#A855F7' },
  { id: 'toys_kids', parentId: 'toys', nameAr: 'ألعاب أطفال', nameFr: 'Jouets', sort: 1, icon: 'toys', color: '#A855F6' },
  { id: 'toys_board', parentId: 'toys', nameAr: 'ألعاب جماعية', nameFr: 'Jeux de société', sort: 2, icon: 'casino', color: '#A855F6' },
  { id: 'toys_crafts', parentId: 'toys', nameAr: 'فنون وحرف', nameFr: 'Arts et loisirs créatifs', sort: 3, icon: 'palette', color: '#A855F6' },

  // ===== 18 Books & music (new) =====
  { id: 'books_music', nameAr: 'الكتب والموسيقى', nameFr: 'Livres et musique', sort: 18, icon: 'menu-book', color: '#7C3AED' },
  { id: 'books', parentId: 'books_music', nameAr: 'الكتب', nameFr: 'Livres', sort: 1, icon: 'auto-stories', color: '#7C3AED' },
  { id: 'music_instruments', parentId: 'books_music', nameAr: 'آلات موسيقية', nameFr: 'Instruments de musique', sort: 2, icon: 'music-note', color: '#7C3AED' },

  // ===== 19 Pets (new) =====
  { id: 'pets', nameAr: 'مستلزمات الحيوانات الأليفة', nameFr: 'Animalerie', sort: 19, icon: 'pets', color: '#059669' },
  { id: 'pets_food', parentId: 'pets', nameAr: 'أغذية', nameFr: 'Alimentation animale', sort: 1, icon: 'restaurant', color: '#059669' },
  { id: 'pets_care', parentId: 'pets', nameAr: 'عناية وتجهيزات', nameFr: 'Soins et accessoires', sort: 2, icon: 'pets', color: '#059669' },

  // ===== 20 Trade & sewing equipment (new) =====
  { id: 'trade_equipment', nameAr: 'معدات التجارة والخياطة', nameFr: 'Équipement professionnel et couture', sort: 20, icon: 'storefront', color: '#DC2626' },
  { id: 'trade_shop', parentId: 'trade_equipment', nameAr: 'تجهيز المتاجر', nameFr: 'Équipement de magasin', sort: 1, icon: 'storefront', color: '#DC2626' },
  { id: 'trade_packaging', parentId: 'trade_equipment', nameAr: 'تغليف', nameFr: 'Emballage', sort: 2, icon: 'inventory', color: '#DC2626' },
  { id: 'trade_restaurant', parentId: 'trade_equipment', nameAr: 'تجهيز المطاعم', nameFr: 'Équipement de restauration', sort: 3, icon: 'restaurant-menu', color: '#DC2626' },
  { id: 'trade_sewing', parentId: 'trade_equipment', nameAr: 'الخياطة', nameFr: 'Couture', sort: 4, icon: 'content-cut', color: '#DC2626' },
    // ===== Real estate (existing DB family, deferred rollout but id preserved) =====
  { id: 'real_estate', nameAr: 'عقارات', nameFr: 'Immobilier', sort: 21, icon: 'home-work', color: '#6B7280' },

  // ===== Services (existing root id preserved — SEPARATE domain from shopping) =====
  { id: 'services', nameAr: 'خدمات', nameFr: 'Services', sort: 22, icon: 'build', color: '#8B5CF6' },
];

/** Map of category id -> image asset (reused from existing category images). */
export const CATEGORY_IMAGE_BY_ID: Record<string, any> = {
  electronics: require('@/assets/images/categories/electronics.png'),
  fashion: require('@/assets/images/categories/fashion.png'),
  shoes: require('@/assets/images/categories/shoes.png'),
  home_garden: require('@/assets/images/categories/home_garden.png'),
  home_kitchen: require('@/assets/images/categories/home_garden.png'),
  vehicles: require('@/assets/images/categories/vehicles.png'),
  agriculture: require('@/assets/images/categories/agriculture.png'),
  services: require('@/assets/images/categories/services.png'),
  real_estate: require('@/assets/images/categories/real_estate.png'),
};

/**
 * Dry-run product migration preview (v1):
 * Each entry: product id -> (from, to, rationale, confidence).
 * Only CLEAR mappings are listed (from the product's own title/description).
 * Ambiguous ones are NOT guessed and stay in review list.
 */
export const PRODUCT_MIGRATION_PREVIEW: Array<{
  productId: string; from: string; to: string; reason: string; confidence: 'clear' | 'review';
}> = [
  { productId: 'p1', from: 'electronics', to: 'electronics_phones', reason: 'Samsung Galaxy A54 = smartphone', confidence: 'clear' },
  { productId: 'p2', from: 'electronics', to: 'electronics_phones', reason: 'iPhone 14 Pro Max = smartphone', confidence: 'clear' },
  { productId: 'p13', from: 'electronics', to: 'electronics_audio', reason: 'JBL Bluetooth speaker = audio', confidence: 'clear' },
  { productId: 'p14', from: 'electronics', to: 'electronics_computers_laptops', reason: 'HP Laptop = laptops leaf', confidence: 'clear' },
  { productId: 'p20', from: 'electronics', to: 'electronics_tv', reason: 'Samsung Smart TV = TV branch', confidence: 'clear' },
  { productId: 'p3', from: 'shoes', to: 'vehicles', reason: 'DATA BUG: Toyota Corolla is a car, was miscategorized under shoes; moved to vehicles root (full vehicle, deferred family)', confidence: 'clear' },
  { productId: 'p15', from: 'vehicles', to: 'vehicles', reason: 'Suzuki Alto = vehicle root (vehicles family deferred for listing UX)', confidence: 'clear' },
  { productId: 'p4', from: 'shoes', to: 'shoes_men', reason: 'Adidas Ultraboost running shoes, size 42 (mens style)', confidence: 'clear' },
  { productId: 'p6', from: 'shoes', to: 'shoes_men', reason: 'Nike Air Max size 42 EU', confidence: 'clear' },
  { productId: 'p5', from: 'fashion', to: 'fashion_traditional', reason: 'Traditional Boubou', confidence: 'clear' },
  { productId: 'p16', from: 'fashion', to: 'fashion_women', reason: "Women's Abaya Collection", confidence: 'clear' },
  { productId: 'p9', from: 'home_garden', to: 'energy_solar', reason: 'Solar panel kit 300W = solar branch', confidence: 'clear' },
  { productId: 'p10', from: 'home_garden', to: 'furniture_salon', reason: 'Leather sofa set = living room furniture', confidence: 'clear' },
  { productId: 'p11', from: 'agriculture', to: 'agriculture_machinery', reason: 'Tractor spare parts', confidence: 'clear' },
  { productId: 'p12', from: 'agriculture', to: 'agriculture_irrigation', reason: 'Water irrigation pump', confidence: 'clear' },
  { productId: 'p19', from: 'agriculture', to: 'agriculture_culture', reason: 'Organic seeds = culture/seeds', confidence: 'clear' },
  { productId: 'p18', from: 'home_garden', to: 'electromenager_froid', reason: 'Chest freezer = froid branch', confidence: 'clear' },
  { productId: 'p22', from: 'home_garden', to: 'energy_backup', reason: 'Generator 5KVA = backup power', confidence: 'clear' },
  { productId: 'p7', from: 'real_estate', to: 'real_estate', reason: 'House for sale — stays at real_estate root (family deferred)', confidence: 'clear' },
  { productId: 'p8', from: 'real_estate', to: 'real_estate', reason: 'Studio for rent — stays at real_estate root', confidence: 'clear' },
  { productId: 'p17', from: 'real_estate', to: 'real_estate', reason: 'Commercial space — stays at real_estate root', confidence: 'clear' },
  { productId: 'p21', from: 'services', to: 'services', reason: 'Wedding decoration SERVICE stays in services domain (not a product)', confidence: 'clear' },
];

/** Products whose category cannot be resolved without the seller: NONE in current data.
 *  (kept as explicit empty list per rule "don't guess unclear products") */
export const PRODUCT_MIGRATION_UNRESOLVED: Array<{ productId: string; note: string }> = [];

/** Descendant lookup: all children+grandchildren of a category (for rollup counts). */
export function descendantsOf(tree: CatNode[], id: string): string[] {
  const kids = tree.filter(n => n.parentId === id);
  return kids.flatMap(k => [k.id, ...descendantsOf(tree, k.id)]);
}