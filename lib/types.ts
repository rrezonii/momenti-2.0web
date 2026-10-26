export type Article = {
  id: number;
  title: string;
  slug: string;
  category: "Lajme" | "Politikë" | "Bota" | "Magazinë" | "Sport";
  date: string;
  time?: string;
  publishedAt?: string;
  modifiedAt?: string;
  image: string;
  excerpt?: string;
  terms?: string[];
  content?: string;
  author?: string;
};
