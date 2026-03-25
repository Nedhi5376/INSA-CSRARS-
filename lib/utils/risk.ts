export type RiskLevelKey = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevelLabel = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Critical';

export const RISK_MATRIX_CONFIG = {
  likelihoodScale: {
    1: { label: 'Remote', description: 'Very unlikely to happen', score: 1 },
    2: { label: 'Low', description: 'Could happen but rare', score: 2 },
    3: { label: 'Moderate', description: 'Could happen sometimes', score: 3 },
    4: { label: 'High', description: 'Likely to happen', score: 4 },
    5: { label: 'Almost Certain', description: 'Very likely to happen', score: 5 },
  },
  impactScale: {
    1: { label: 'Minimal', description: 'Minor inconvenience', score: 1 },
    2: { label: 'Low', description: 'Slight disruption', score: 2 },
    3: { label: 'Moderate', description: 'Significant disruption', score: 3 },
    4: { label: 'High', description: 'Severe loss', score: 4 },
    5: { label: 'Critical', description: 'Catastrophic impact', score: 5 },
  },
  riskLevels: {
    VERY_LOW: {
      threshold: [1, 3],
      color: '#10b981',
      label: 'Very Low',
      action: 'Monitor',
      priority: 'Monitor',
      timeline: '12+ months',
    },
    LOW: {
      threshold: [4, 8],
      color: '#f59e0b',
      label: 'Low',
      action: 'Monitor',
      priority: 'Low',
      timeline: '6-12 months',
    },
    MEDIUM: {
      threshold: [9, 15],
      color: '#f97316',
      label: 'Medium',
      action: 'Address Soon',
      priority: 'Medium',
      timeline: '3-6 months',
    },
    HIGH: {
      threshold: [16, 20],
      color: '#ef4444',
      label: 'High',
      action: 'Priority Action',
      priority: 'High',
      timeline: '30-90 days',
    },
    CRITICAL: {
      threshold: [21, 25],
      color: '#dc2626',
      label: 'Critical',
      action: 'Immediate Action',
      priority: 'Critical',
      timeline: 'Within 30 days',
    },
  } as Record<RiskLevelKey, {
    threshold: [number, number];
    color: string;
    label: RiskLevelLabel;
    action: string;
    priority: string;
    timeline: string;
  }>
};

export interface RiskLevelInfo {
  riskScore: number;
  riskLevel: RiskLevelKey;
  riskLabel: RiskLevelLabel;
  riskColor: string;
  riskAction: string;
  riskPriority: string;
  riskTimeline: string;
}

export const calculateRiskScore = (likelihood: number, impact: number): number => {
  const validLikelihood = Math.min(5, Math.max(1, Math.round(likelihood)));
  const validImpact = Math.min(5, Math.max(1, Math.round(impact)));
  return validLikelihood * validImpact;
};

export const getRiskLevelByScore = (score: number): RiskLevelInfo => {
  const normalizedScore = Math.min(25, Math.max(1, Math.round(score)));

  let level: RiskLevelKey = 'VERY_LOW';
  for (const key of Object.keys(RISK_MATRIX_CONFIG.riskLevels) as RiskLevelKey[]) {
    const conf = RISK_MATRIX_CONFIG.riskLevels[key];
    if (normalizedScore >= conf.threshold[0] && normalizedScore <= conf.threshold[1]) {
      level = key;
      break;
    }
  }

  const levelConfig = RISK_MATRIX_CONFIG.riskLevels[level];

  return {
    riskScore: normalizedScore,
    riskLevel: level,
    riskLabel: levelConfig.label,
    riskColor: levelConfig.color,
    riskAction: levelConfig.action,
    riskPriority: levelConfig.priority,
    riskTimeline: levelConfig.timeline,
  };
};

export const getRiskLevel = (likelihood: number, impact: number): RiskLevelInfo => {
  const validatedLikelihood = Math.min(5, Math.max(1, Math.round(likelihood)));
  const validatedImpact = Math.min(5, Math.max(1, Math.round(impact)));
  const score = validatedLikelihood * validatedImpact;
  return getRiskLevelByScore(score);
};
