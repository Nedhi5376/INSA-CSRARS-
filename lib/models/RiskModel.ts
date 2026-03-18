export interface Risk {
  riskId: string;
  riskName: string;
  category: string;
  status: "open" | "closed" | "mitigated" | "accepted" | "transferred";
  type: "risk" | "issue";
  threat: string;
  level: "low" | "medium" | "high" | "critical";
  preProbability: number;
  preImpact: number;
  preScore: number;
  costPre: number;
  postProbability: number;
  postImpact: number;
  postScore: number;
  costPost: number;
  score: number;
  description: string;
  company?: string;
  batchId?: string;
  likelihood?: number;
  impact?: number;
  owner?: string;
  gap?: string;
  mitigation?: string;
  impactDescription?: string;
  questionnaireId?: string | null;
  createdAt?: string;
}
