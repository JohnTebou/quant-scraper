export interface Problem {
  id?: string;
  name: string;
  link: string;
  difficulty: Difficulty;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type Difficulty = "Easy" | "Medium" | "Hard" | "Unknown";

export interface ScrapedProblem {
  name: string;
  link: string;
  difficulty: Difficulty;
  tags?: string[];
}

