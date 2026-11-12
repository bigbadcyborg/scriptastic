export type Translation = {
  id: string;
  label: string;
  name: string;
  year: string;
  note: string;
};

export const TRANSLATIONS: Translation[] = [
  { id: "kjv", label: "KJV", name: "King James Version", year: "1769", note: "The classic English text" },
  { id: "web", label: "WEB", name: "World English Bible", year: "updated", note: "Contemporary public-domain English" },
  { id: "asv", label: "ASV", name: "American Standard Version", year: "1901", note: "Formal and literal" },
  { id: "bbe", label: "BBE", name: "Bible in Basic English", year: "1965", note: "A small, clear vocabulary" },
  { id: "ylt", label: "YLT", name: "Young's Literal Translation", year: "1898", note: "Word-for-word English" },
  { id: "darby", label: "Darby", name: "Darby Translation", year: "1890", note: "Close, careful English" },
  { id: "gnv", label: "GNV", name: "Geneva Bible", year: "1599", note: "Reformation-era English" },
  { id: "dra", label: "DRA", name: "Douay-Rheims", year: "1899", note: "Traditional Catholic English" },
];

export function translationById(id: string): Translation {
  return TRANSLATIONS.find((item) => item.id === id) ?? TRANSLATIONS[0]!;
}
