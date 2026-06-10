export interface Student {
  name: string;
  handle: string;
  regNo: string;
  addedAt: string;
}

export interface CFData {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  organization?: string;
  lastOnlineTimeSeconds?: number;
  registrationTimeSeconds?: number;
  offline?: boolean;
}

export interface FullStudent extends Student {
  cfData?: CFData;
}

export interface SolvedProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedAt: number;
}

export interface CFContest {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CFSubmissions {
  totalSolved: number;
  solvedProblems: SolvedProblem[];
  ratingDistribution: Record<number, number>;
  tagDistribution: Record<string, number>;
  offline?: boolean;
  lastUpdated: number;
}

export interface ProfileDetails {
  info: CFData;
  submissions: CFSubmissions;
  contests?: CFContest[];
}
