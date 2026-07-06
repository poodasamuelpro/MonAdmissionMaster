// ============================================================
//  sources/universites-sources.ts — URLs officielles universités
//  publiques classiques (FSJES et autres) à surveiller
//
//  ⚠ AVERTISSEMENT LÉGAL :
//  Ces URLs pointent exclusivement vers des sources officielles.
//  Aucune source Facebook / réseaux sociaux — risque légal CGU Meta
//  et droit marocain interdit l'extraction automatique.
//
//  Sources : sites officiels FSJES, universités, portails officiels.
//  Dates vérifiées : juillet 2025.
// ============================================================

import type { SourceConfig } from "./encg-sources.js";

export type { SourceConfig };

/**
 * Liste des sources universités publiques officielles.
 * Cible : Masters Finance (cat. 1-4) en S7, accès Bac+3/Bac+4.
 */
export const UNIVERSITES_SOURCES: SourceConfig[] = [
  // ══════════════════════════════════════════════════════════
  // RÉGION CASABLANCA-SETTAT
  // ══════════════════════════════════════════════════════════

  // Université Hassan II Casablanca
  {
    url: "https://www.fsjesk.ac.ma",
    etablissement: "FSJES Ain Sebaa Hay Mohammadi",
    ville: "Casablanca",
    pageType: "formations",
    priority: 1,
    notes: "FSJES Ain Sebaa — Master Finance — domaine à vérifier",
  },
  {
    url: "https://www.fsjes-uhii.ac.ma",
    etablissement: "FSJES Mohammedia",
    ville: "Mohammedia",
    pageType: "formations",
    priority: 1,
    notes: "Université Hassan II — FSJES Mohammedia",
  },
  {
    url: "https://www.uh2c.ac.ma",
    etablissement: "Université Hassan II Casablanca",
    ville: "Casablanca",
    pageType: "admissions",
    priority: 1,
    notes: "Portail central UH2C — annonces Masters",
  },
  {
    url: "https://www.fsjescasa.ac.ma",
    etablissement: "FSJES Casablanca",
    ville: "Casablanca",
    pageType: "formations",
    priority: 1,
  },

  // Université Hassan 1er Settat
  {
    url: "https://www.fsjesk.usms.ac.ma",
    etablissement: "FSJES Khouribga",
    ville: "Khouribga",
    pageType: "formations",
    priority: 2,
    notes: "FSJES Khouribga — sous Université Hassan 1er",
  },
  {
    url: "https://www.fsjess.usms.ac.ma",
    etablissement: "FSJES Settat",
    ville: "Settat",
    pageType: "formations",
    priority: 1,
    notes: "FSJES Settat — Masters Finance ciblés",
  },

  // ══════════════════════════════════════════════════════════
  // RÉGION RABAT-SALÉ-KÉNITRA
  // ══════════════════════════════════════════════════════════

  // Université Mohammed V Rabat
  {
    url: "https://www.fsjeso.um5.ac.ma",
    etablissement: "FSJES Rabat Océan",
    ville: "Rabat",
    pageType: "formations",
    priority: 1,
    notes: "UM5 — FSJES Rabat Océan — Masters Finance réputés",
  },
  {
    url: "https://www.fsjes-agdal.um5.ac.ma",
    etablissement: "FSJES Rabat Agdal",
    ville: "Rabat",
    pageType: "formations",
    priority: 1,
    notes: "UM5 — FSJES Agdal — nombreux Masters Finance",
  },
  {
    url: "https://www.um5.ac.ma",
    etablissement: "Université Mohammed V Rabat",
    ville: "Rabat",
    pageType: "admissions",
    priority: 1,
    notes: "Portail UM5 — annonces formations et admissions",
  },

  // Université Ibn Tofail Kénitra
  {
    url: "https://www.fsjeskenitra.uib.ac.ma",
    etablissement: "FSJES Kénitra",
    ville: "Kénitra",
    pageType: "formations",
    priority: 2,
  },

  // ══════════════════════════════════════════════════════════
  // RÉGION FÈS-MEKNÈS
  // ══════════════════════════════════════════════════════════

  // Université Sidi Mohamed Ben Abdellah Fès
  {
    url: "https://www.fsjesfes.usmba.ac.ma",
    etablissement: "FSJES Fès",
    ville: "Fès",
    pageType: "formations",
    priority: 1,
    notes: "USMBA — FSJES Fès — Master Finance et Banque reconnu",
  },
  {
    url: "https://www.usmba.ac.ma",
    etablissement: "Université SIDI Mohamed Ben Abdellah",
    ville: "Fès",
    pageType: "admissions",
    priority: 2,
  },

  // Université Moulay Ismail Meknès
  {
    url: "https://www.fsjesmeknes.umi.ac.ma",
    etablissement: "FSJES Meknès",
    ville: "Meknès",
    pageType: "formations",
    priority: 2,
  },

  // ══════════════════════════════════════════════════════════
  // RÉGION MARRAKECH-SAFI
  // ══════════════════════════════════════════════════════════

  // Université Cadi Ayyad Marrakech
  {
    url: "https://www.fsjes-gueli.uca.ac.ma",
    etablissement: "FSJES Guéliz",
    ville: "Marrakech",
    pageType: "formations",
    priority: 1,
    notes: "UCA — FSJES Guéliz — Masters Finance actifs",
  },
  {
    url: "https://www.uca.ac.ma",
    etablissement: "Université Cadi Ayyad",
    ville: "Marrakech",
    pageType: "admissions",
    priority: 2,
    notes: "Portail UCA — annonces formations",
  },

  // ══════════════════════════════════════════════════════════
  // RÉGION SOUSS-MASSA
  // ══════════════════════════════════════════════════════════

  // Université Ibn Zohr Agadir
  {
    url: "https://www.fsjes-agadir.uiz.ac.ma",
    etablissement: "FSJES Agadir",
    ville: "Agadir",
    pageType: "formations",
    priority: 1,
    notes: "UIZ — FSJES Agadir — Master Finance Internationale",
  },
  {
    url: "https://www.uiz.ac.ma",
    etablissement: "Université Ibn Zohr",
    ville: "Agadir",
    pageType: "admissions",
    priority: 2,
  },

  // ══════════════════════════════════════════════════════════
  // RÉGION ORIENTAL
  // ══════════════════════════════════════════════════════════

  // Université Mohammed Premier Oujda
  {
    url: "https://www.fsjes-oujda.ump.ac.ma",
    etablissement: "FSJES Oujda",
    ville: "Oujda",
    pageType: "formations",
    priority: 2,
  },

  // ══════════════════════════════════════════════════════════
  // PORTAILS NATIONAUX TRANSVERSAUX
  // ══════════════════════════════════════════════════════════
  {
    url: "https://www.taalim.ma",
    etablissement: "Portail National Enseignement Supérieur",
    ville: "National",
    pageType: "admissions",
    priority: 1,
    notes: "Portail officiel Ministère — annonces admissions Master national",
  },
  {
    url: "https://inscription.men.gov.ma",
    etablissement: "Inscription.men.gov.ma",
    ville: "National",
    pageType: "admissions",
    priority: 1,
    notes: "Portail officiel inscription nationale — Master et autres",
  },
];
