export const categoryPaths = {
  Lajme: "lajme",
  Politikë: "politike",
  Bota: "bota",
  Magazinë: "magazina",
  Sport: "sport",
} as const;

export type MomentiCategory = keyof typeof categoryPaths;

export function getCategoryPath(category: MomentiCategory) {
  return categoryPaths[category];
}
