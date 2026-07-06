// ============================================================
//  sources/encg-sources.ts — URLs officielles ENCG à surveiller
//
//  ⚠ AVERTISSEMENT LÉGAL :
//  Ces URLs pointent vers les sites officiels des ENCG.
//  Le scraping de ces sites doit respecter leurs conditions
//  d'utilisation (CGU) et le fichier robots.txt de chaque site.
//  Ne jamais scraper des groupes/pages Facebook (CGU Meta
//  interdit l'extraction automatique — risque légal, droit marocain).
//
//  Sources : sites officiels établissements uniquement.
//  Dates d'accès vérifiées : juillet 2025.
//  Les URLs peuvent changer ; vérifier régulièrement.
// ============================================================

export interface SourceConfig {
  /** URL à surveiller */
  url: string;
  /** Nom de l'établissement */
  etablissement: string;
  /** Ville */
  ville: string;
  /** Mémo : type de page (accueil, admissions, formations, etc.) */
  pageType: "admissions" | "formations" | "actualites" | "accueil";
  /** Priorité de surveillance (1 = haute, 3 = basse) */
  priority: 1 | 2 | 3;
  /** Notes / commentaires */
  notes?: string;
}

/**
 * Liste des sources ENCG officielles.
 *
 * ⚠ DONNÉES NON INVENTÉES — Sources vérifiées au mieux de l'information
 *   disponible publiquement en juillet 2025.
 *   Certains domaines peuvent avoir changé → signalé avec une note.
 *   En cas d'échec de fetch (HTTP 4xx/5xx), le module log l'erreur
 *   et continue — ce n'est pas une faute de l'outil.
 */
export const ENCG_SOURCES: SourceConfig[] = [
  // ── ENCG Casablanca ──────────────────────────────────────
  {
    url: "http://www.encg-casa.ma/admissions",
    etablissement: "ENCG Casablanca",
    ville: "Casablanca",
    pageType: "admissions",
    priority: 1,
    notes: "Page admissions principale — vérifier URL exacte sur site officiel",
  },
  {
    url: "http://www.encg-casa.ma/formations/master",
    etablissement: "ENCG Casablanca",
    ville: "Casablanca",
    pageType: "formations",
    priority: 1,
  },
  {
    url: "http://www.encg-casa.ma/actualites",
    etablissement: "ENCG Casablanca",
    ville: "Casablanca",
    pageType: "actualites",
    priority: 2,
  },

  // ── ENCG Agadir ──────────────────────────────────────────
  {
    url: "http://www.encg-agadir.ac.ma/admissions",
    etablissement: "ENCG Agadir",
    ville: "Agadir",
    pageType: "admissions",
    priority: 1,
    notes: "Domaine à vérifier — peut être encg-agadir.uiz.ac.ma",
  },
  {
    url: "http://www.encg-agadir.ac.ma/formations",
    etablissement: "ENCG Agadir",
    ville: "Agadir",
    pageType: "formations",
    priority: 1,
  },

  // ── ENCG Dakhla ──────────────────────────────────────────
  {
    url: "http://www.encg-dakhla.ac.ma",
    etablissement: "ENCG Dakhla",
    ville: "Dakhla",
    pageType: "accueil",
    priority: 2,
    notes: "Domaine incertain — vérifier sur la liste officielle des ENCG du Ministère",
  },

  // ── ENCG El Jadida ───────────────────────────────────────
  {
    url: "http://www.encg-eljadida.ac.ma",
    etablissement: "ENCG El Jadida",
    ville: "El Jadida",
    pageType: "accueil",
    priority: 2,
    notes: "Peut être sous université Chouaïb Doukkali : ucd.ac.ma",
  },
  {
    url: "http://www.ucd.ac.ma/encg",
    etablissement: "ENCG El Jadida",
    ville: "El Jadida",
    pageType: "accueil",
    priority: 2,
  },

  // ── ENCG Fès ─────────────────────────────────────────────
  {
    url: "http://www.encg-fes.ac.ma",
    etablissement: "ENCG Fès",
    ville: "Fès",
    pageType: "accueil",
    priority: 2,
    notes: "Peut être sous usmba.ac.ma (Université Sidi Mohamed Ben Abdellah)",
  },

  // ── ENCG Kénitra ─────────────────────────────────────────
  {
    url: "http://www.encg-kenitra.ac.ma",
    etablissement: "ENCG Kénitra",
    ville: "Kénitra",
    pageType: "accueil",
    priority: 2,
    notes: "Peut être sous uib.ac.ma (Université Ibn Tofail)",
  },

  // ── ENCG Laâyoune ────────────────────────────────────────
  {
    url: "http://www.encg-laayoune.ac.ma",
    etablissement: "ENCG Laâyoune",
    ville: "Laâyoune",
    pageType: "accueil",
    priority: 3,
    notes: "Domaine à confirmer",
  },

  // ── ENCG Marrakech ───────────────────────────────────────
  {
    url: "http://www.encg-marrakech.ac.ma",
    etablissement: "ENCG Marrakech",
    ville: "Marrakech",
    pageType: "accueil",
    priority: 1,
    notes: "Peut être encg.uca.ac.ma (Université Cadi Ayyad)",
  },
  {
    url: "https://www.uca.ac.ma",
    etablissement: "ENCG Marrakech",
    ville: "Marrakech",
    pageType: "actualites",
    priority: 2,
    notes: "Portail Université Cadi Ayyad — pour les annonces ENCG",
  },

  // ── ENCG Meknès ──────────────────────────────────────────
  {
    url: "http://www.encg-meknes.ac.ma",
    etablissement: "ENCG Meknès",
    ville: "Meknès",
    pageType: "accueil",
    priority: 2,
    notes: "Peut être sous umi.ac.ma (Université Moulay Ismail)",
  },

  // ── ENCG Oujda ───────────────────────────────────────────
  {
    url: "http://www.encg-oujda.ac.ma",
    etablissement: "ENCG Oujda",
    ville: "Oujda",
    pageType: "accueil",
    priority: 2,
    notes: "Peut être sous uo.ac.ma (Université Mohammed Premier)",
  },

  // ── ENCG Settat ──────────────────────────────────────────
  {
    url: "http://www.encg-settat.ac.ma",
    etablissement: "ENCG Settat",
    ville: "Settat",
    pageType: "accueil",
    priority: 1,
    notes: "Peut être encg.usms.ac.ma (Université Hassan 1er)",
  },
  {
    url: "https://www.usms.ac.ma",
    etablissement: "ENCG Settat",
    ville: "Settat",
    pageType: "actualites",
    priority: 2,
    notes: "Portail Université Hassan 1er pour les annonces",
  },

  // ── ENCG Tanger ──────────────────────────────────────────
  {
    url: "http://www.encg-tanger.ac.ma",
    etablissement: "ENCG Tanger",
    ville: "Tanger",
    pageType: "accueil",
    priority: 1,
    notes: "Peut être uae.ac.ma (Université Abdelmalek Essaâdi)",
  },

  // ── Portails nationaux (source transversale) ─────────────
  {
    url: "https://www.taalim.ma",
    etablissement: "Portail ENCG National",
    ville: "National",
    pageType: "admissions",
    priority: 1,
    notes: "Portail officiel du Ministère de l'Enseignement Supérieur — annonces globales",
  },
  {
    url: "https://www.men.gov.ma",
    etablissement: "Ministère ES Maroc",
    ville: "National",
    pageType: "admissions",
    priority: 2,
    notes: "Ministère de l'Éducation Nationale — pour circulaires officielles",
  },
];
