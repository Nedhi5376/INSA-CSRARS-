import { OpenRouter } from '@openrouter/sdk';
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
      range: [1, 3],
      color: '#10b981',
      label: 'Very Low',
      action: 'Acceptable',
      priority: 'Monitor',
      timeline: '12+ months',
    },
    LOW: {
      range: [4, 8],
      color: '#f59e0b',
      label: 'Low',
      action: 'Monitor',
      priority: 'Low',
      timeline: '6-12 months',
    },
    MEDIUM: {
      range: [9, 15],
      color: '#f97316',
      label: 'Medium',
      action: 'Address Soon',
      priority: 'Medium',
      timeline: '3-6 months',
    },
    HIGH: {
      range: [16, 20],
      color: '#ef4444',
      label: 'High',
      action: 'Priority Action',
      priority: 'High',
      timeline: '30-90 days',
    },
    CRITICAL: {
      range: [21, 25],
      color: '#dc2626',
      label: 'Critical',
      action: 'Immediate Action',
      priority: 'Critical',
      timeline: 'Within 30 days',
    },
  },
};
export interface RiskAnalysisResult {
  likelihood: number; 
  impact: number; 
  gap: string; 
  threat: string;
  mitigation: string;
  impactDescription?: string;

  // Calculated parameters
  riskScore: number;
  riskLevel: string;
  riskColor: string;
  riskLabel: string;
  riskAction: string;
  riskPriority: string;
  riskTimeline: string;

  // Additional metadata
  likelihoodLabel: string;
  impactLabel: string;
  category?: string;
  section?: string;
}

export interface AnalysisQuestion {
  question: string;
  answer: string;
  section: string;
  category?: string;
}
/**
 * Calculate raw risk score from likelihood and impact
 */
export const calculateRiskScore = (likelihood: number, impact: number): number => {
  const validLikelihood = Math.min(5, Math.max(1, likelihood));
  const validImpact = Math.min(5, Math.max(1, impact));
  return validLikelihood * validImpact;
};

/**
 * Get comprehensive risk level information based on likelihood and impact
 */
export const getRiskLevel = (
  likelihood: number,
  impact: number
): Omit<RiskAnalysisResult, 'gap' | 'threat' | 'mitigation' | 'question' | 'answer'> => {
  const riskScore = calculateRiskScore(likelihood, impact);
  const validLikelihood = Math.min(5, Math.max(1, likelihood));
  const validImpact = Math.min(5, Math.max(1, impact));

  let levelKey: keyof typeof RISK_MATRIX_CONFIG.riskLevels;

  if (riskScore >= 21) levelKey = 'CRITICAL';
  else if (riskScore >= 16) levelKey = 'HIGH';
  else if (riskScore >= 9) levelKey = 'MEDIUM';
  else if (riskScore >= 4) levelKey = 'LOW';
  else levelKey = 'VERY_LOW';

  const levelConfig = RISK_MATRIX_CONFIG.riskLevels[levelKey];
  const likelihoodLabel =
    RISK_MATRIX_CONFIG.likelihoodScale[validLikelihood as 1 | 2 | 3 | 4 | 5].label;
  const impactLabel = RISK_MATRIX_CONFIG.impactScale[validImpact as 1 | 2 | 3 | 4 | 5].label;

  return {
    likelihood: validLikelihood,
    impact: validImpact,
    riskScore,
    riskLevel: levelKey,
    riskColor: levelConfig.color,
    riskLabel: levelConfig.label,
    riskAction: levelConfig.action,
    riskPriority: levelConfig.priority,
    riskTimeline: levelConfig.timeline,
    likelihoodLabel,
    impactLabel,
  };
};

/**
 * Get risk matrix position (for 5x5 matrix visualization)
 */
export const getRiskMatrixPosition = (
  likelihood: number,
  impact: number
): { row: number; col: number; score: number; level: string } => {
  const validLikelihood = Math.min(5, Math.max(1, likelihood));
  const validImpact = Math.min(5, Math.max(1, impact));
  const riskScore = calculateRiskScore(validLikelihood, validImpact);

  let level = 'VERY_LOW';
  if (riskScore >= 21) level = 'CRITICAL';
  else if (riskScore >= 16) level = 'HIGH';
  else if (riskScore >= 9) level = 'MEDIUM';
  else if (riskScore >= 4) level = 'LOW';

  return {
    row: validLikelihood,
    col: validImpact,
    score: riskScore,
    level,
  };
};

/**
 * Initialize OpenRouter client
 */
export const initializeAI = (apiKey: string): OpenRouter => {
  return new OpenRouter({ apiKey });
};

/**
 * Parse AI response to extract structured risk parameters
 */
const parseAIResponse = (response: string): Partial<RiskAnalysisResult> => {
  const lines = response.split('\n').filter((line) => line.trim());
  const data: Partial<RiskAnalysisResult> = {};

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('likelihood:')) {
      const match = line.match(/LIKELIHOOD:\s*(\d)/i);
      data.likelihood = match ? Math.min(5, Math.max(1, parseInt(match[1]))) : 3;
    }

    if (lowerLine.includes('impact:')) {
      const match = line.match(/IMPACT:\s*(\d)/i);
      data.impact = match ? Math.min(5, Math.max(1, parseInt(match[1]))) : 3;
    }

    if (lowerLine.includes('gap:')) {
      data.gap = line.replace(/GAP:/i, '').trim();
    }

    if (lowerLine.includes('threat:')) {
      data.threat = line.replace(/THREAT:/i, '').trim();
    }

    if (lowerLine.includes('mitigation:')) {
      data.mitigation = line.replace(/MITIGATION:/i, '').trim();
    }

    if (lowerLine.includes('impact_description:') || lowerLine.includes('impact description:')) {
      data.impactDescription = line.replace(/IMPACT[_\s]DESCRIPTION:/i, '').trim();
      console.log('[AI Parser] Found impact description:', data.impactDescription);
    }
  });

  console.log('[AI Parser] Final parsed data:', {
    likelihood: data.likelihood,
    impact: data.impact,
    hasGap: !!data.gap,
    hasThreat: !!data.threat,
    hasMitigation: !!data.mitigation,
    hasImpactDescription: !!data.impactDescription,
    impactDescription: data.impactDescription
  });

  // Calculate risk metrics
  const likelihood = data.likelihood || 3;
  const impact = data.impact || 3;
  const riskMetrics = getRiskLevel(likelihood, impact);

  return {
    ...data,
    ...riskMetrics,
  };
};

/**
 * Analyze a single security control question using OpenRouter
 */
export const analyzeQuestion = async (
  openRouter: OpenRouter,
  question: AnalysisQuestion
): Promise<RiskAnalysisResult> => {
  const systemPrompt = `You are an expert cybersecurity risk analyst with deep knowledge of industry standards (ISO 27001, NIST, CIS Controls), compliance frameworks (GDPR, HIPAA, SOC 2), and current threat landscape.

ANALYSIS APPROACH:
Before providing your assessment, consider:
1. Industry best practices and security frameworks
2. Common attack vectors and real-world breach scenarios
3. Regulatory compliance requirements
4. Business impact and operational context
5. Current threat intelligence and vulnerability trends
6. Defense-in-depth principles
7. Risk cascading effects (how one weakness can amplify others)

Format your response EXACTLY like this (NO OTHER TEXT):
LIKELIHOOD: [number 1-5]
IMPACT: [number 1-5]
GAP: [One line description of security gap, or "No potential gap" if controls are adequate]
THREAT: [One line description of main threat, or "No significant threat" if controls are adequate]
MITIGATION: [One line recommended control or mitigation strategy, or "Current controls are adequate" if no improvement needed]
IMPACT_DESCRIPTION: [One line description of potential business/security consequences, or "Minimal impact - controls are effective" if low risk]

SCORING GUIDELINES:
LIKELIHOOD (probability of exploitation):
- 1 (Remote): Strong controls, industry best practices followed, multiple layers of defense
- 2 (Low): Good controls but minor gaps, some best practices missing
- 3 (Moderate): Basic controls present but significant gaps, common attack vectors possible
- 4 (High): Weak or missing controls, known vulnerabilities, easy to exploit
- 5 (Almost Certain): Critical gaps, no controls, actively targeted by attackers

IMPACT (business/security consequences):
- 1 (Minimal): Minor inconvenience, no data exposure, quick recovery
- 2 (Low): Limited disruption, minimal data exposure, moderate recovery effort
- 3 (Moderate): Significant operational impact, some sensitive data at risk, compliance concerns
- 4 (High): Major business disruption, substantial data breach, regulatory penalties likely
- 5 (Critical): Catastrophic failure, massive data breach, business survival threatened, severe legal/financial consequences

RESPONSE RULES:
- If controls are STRONG and align with best practices: Use likelihood 1-2, impact 1-2, respond with "No potential gap"
- If controls are ADEQUATE but could improve: Use likelihood 2-3, impact 2-3, provide specific improvement recommendations
- If controls are WEAK or MISSING: Use likelihood 3-5, impact 3-5, clearly identify gaps and threats
- Consider the CONTEXT: A missing control in a critical system is worse than in a low-risk area
- Be REALISTIC: Not every "No" answer is critical - assess actual business risk
- Reference STANDARDS when relevant (e.g., "Violates NIST SP 800-53 AC-2")

Be precise, evidence-based, and concise. Only output the 6 lines above.`;

  const userPrompt = `Analyze this security control and identify the risk:

Question: ${question.question}
Answer: ${question.answer}
Control Area: ${question.section}
${question.category ? `Category: ${question.category}` : ''}

Evaluate the security posture and provide risk assessment in the exact format specified.`;

  try {
    console.log(`[AI Analysis] Analyzing: ${question.question.substring(0, 50)}...`);

    const completion = await openRouter.chat.send({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    // Extract response content safely from OpenRouter completion
    const anyCompletion: any = completion;
    const choice = anyCompletion?.choices?.[0] ?? anyCompletion?.choice ?? null;
    const raw = choice?.message?.content ?? choice?.text ?? anyCompletion?.text ?? null;

    let responseText = '';
    if (!raw) {
      responseText = '';
    } else if (typeof raw === 'string') {
      responseText = raw;
    } else if (Array.isArray(raw)) {
      responseText = raw.map((r: any) => (typeof r === 'string' ? r : r.text || '')).join('\n');
    } else if (typeof raw === 'object') {
      responseText = raw.text || JSON.stringify(raw);
    } else {
      responseText = String(raw);
    }

    // Parse response
    const parsed = parseAIResponse(responseText || '');

    // Ensure all required fields are present
    const result: RiskAnalysisResult = {
      likelihood: parsed.likelihood || 3,
      impact: parsed.impact || 3,
      gap: parsed.gap || 'Analysis error occurred',
      threat: parsed.threat || 'Unable to analyze threat',
      mitigation: parsed.mitigation || 'Manual review required',
      impactDescription: parsed.impactDescription || 'Impact assessment requires manual review',
      riskScore: parsed.riskScore || calculateRiskScore(3, 3),
      riskLevel: parsed.riskLevel || 'MEDIUM',
      riskColor: parsed.riskColor || RISK_MATRIX_CONFIG.riskLevels.MEDIUM.color,
      riskLabel: parsed.riskLabel || RISK_MATRIX_CONFIG.riskLevels.MEDIUM.label,
      riskAction: parsed.riskAction || RISK_MATRIX_CONFIG.riskLevels.MEDIUM.action,
      riskPriority: parsed.riskPriority || RISK_MATRIX_CONFIG.riskLevels.MEDIUM.priority,
      riskTimeline: parsed.riskTimeline || RISK_MATRIX_CONFIG.riskLevels.MEDIUM.timeline,
      likelihoodLabel: parsed.likelihoodLabel || 'Moderate',
      impactLabel: parsed.impactLabel || 'Moderate',
      category: question.category,
      section: question.section,
    };

    console.log(
      `[AI Analysis] ✓ Risk Score: ${result.riskScore} (${result.riskLabel})`
    );

    return result;
  } catch (error) {
    console.error('[AI Analysis] Error:', error);

    // Return safe default result
    const defaultLikelihood = 3;
    const defaultImpact = 3;
    const defaultMetrics = getRiskLevel(defaultLikelihood, defaultImpact);

    return {
      likelihood: defaultLikelihood,
      impact: defaultImpact,
      gap: 'Analysis error occurred - manual review required',
      threat: 'Unable to analyze threat automatically',
      mitigation: 'Please review control manually and define mitigation',
      impactDescription: 'Impact assessment requires manual review',
      riskScore: defaultMetrics.riskScore,
      riskLevel: defaultMetrics.riskLevel,
      riskColor: defaultMetrics.riskColor,
      riskLabel: defaultMetrics.riskLabel,
      riskAction: defaultMetrics.riskAction,
      riskPriority: defaultMetrics.riskPriority,
      riskTimeline: defaultMetrics.riskTimeline,
      likelihoodLabel: defaultMetrics.likelihoodLabel,
      impactLabel: defaultMetrics.impactLabel,
      category: question.category,
      section: question.section,
    };
  }
};

/**
 * Analyze multiple questions in batch
 */
export const analyzeQuestionnaireBatch = async (
  openRouter: OpenRouter,
  questions: AnalysisQuestion[]
): Promise<RiskAnalysisResult[]> => {
  console.log(`[Batch Analysis] Starting analysis of ${questions.length} questions...`);

  const results: RiskAnalysisResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    console.log(`[Batch Analysis] Processing ${i + 1}/${questions.length}...`);
    const result = await analyzeQuestion(openRouter, questions[i]);
    results.push(result);

    // Add small delay between API calls to avoid rate limiting
    if (i < questions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
};


/**
 * Generate risk summary statistics
 */
export const generateRiskSummary = (results: RiskAnalysisResult[]) => {
  const totalItems = results.length;
  const criticalCount = results.filter((r) => r.riskLevel === 'CRITICAL').length;
  const highCount = results.filter((r) => r.riskLevel === 'HIGH').length;
  const mediumCount = results.filter((r) => r.riskLevel === 'MEDIUM').length;
  const lowCount = results.filter((r) => r.riskLevel === 'LOW').length;
  const veryLowCount = results.filter((r) => r.riskLevel === 'VERY_LOW').length;

  const averageRiskScore =
    results.length > 0 ? results.reduce((sum, r) => sum + r.riskScore, 0) / results.length : 0;

  const highestRisk = results.reduce((max, r) =>
    r.riskScore > max.riskScore ? r : max
  ) || null;

  return {
    totalItems,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    veryLowCount,
    averageRiskScore: Math.round(averageRiskScore * 100) / 100,
    highestRisk,
    overallRiskLevel:
      criticalCount > 0
        ? 'CRITICAL'
        : highCount > 0
          ? 'HIGH'
          : mediumCount > 0
            ? 'MEDIUM'
            : 'LOW',
  };
};

/**
 * Generate markdown risk report
 */
export const generateRiskReport = (
  results: RiskAnalysisResult[],
  organizationName: string = 'Organization'
): string => {
  const summary = generateRiskSummary(results);
  const sortedByRisk = [...results].sort((a, b) => b.riskScore - a.riskScore);

  let markdown = `# Cybersecurity Risk Assessment Report

**Organization:** ${organizationName}  
**Report Date:** ${new Date().toLocaleDateString()}  
**Total Controls Assessed:** ${summary.totalItems}

---

## Executive Summary

### Risk Overview

| Metric | Value |
|--------|-------|
| **Overall Risk Level** | ${summary.overallRiskLevel} |
| **Critical Risks** | ${summary.criticalCount} 🔴 |
| **High Risks** | ${summary.highCount} 🟠 |
| **Medium Risks** | ${summary.mediumCount} 🟡 |
| **Low Risks** | ${summary.lowCount} 🟢 |
| **Very Low Risks** | ${summary.veryLowCount} |
| **Average Risk Score** | ${summary.averageRiskScore.toFixed(2)} / 25 |

---

## Risk Summary by Level

\`\`\`
Critical (21-25):  ${Array(summary.criticalCount).fill('🔴').join('')} (${summary.criticalCount})
High (16-20):      ${Array(summary.highCount).fill('🟠').join('')} (${summary.highCount})
Medium (9-15):     ${Array(summary.mediumCount).fill('🟡').join('')} (${summary.mediumCount})
Low (4-8):         ${Array(summary.lowCount).fill('🟢').join('')} (${summary.lowCount})
Very Low (1-3):    ${Array(summary.veryLowCount).fill('🔵').join('')} (${summary.veryLowCount})
\`\`\`

---

## Top 10 Priority Risks

${sortedByRisk
      .slice(0, 10)
      .map(
        (r, i) => `
### ${i + 1}. ${r.gap}

- **Risk Score:** ${r.riskScore}/25 (${r.riskLabel})
- **Likelihood:** ${r.likelihood}/5 (${r.likelihoodLabel})
- **Impact:** ${r.impact}/5 (${r.impactLabel})
- **Primary Threat:** ${r.threat}
- **Recommended Control:** ${r.mitigation}
- **Priority:** ${r.riskPriority}
- **Implementation Timeline:** ${r.riskTimeline}
- **Control Area:** ${r.section}
${r.category ? `- **Category:** ${r.category}` : ''}
`
      )
      .join('\n')}

---

## Detailed Risk Matrix

| # | Control | Risk Score | Level | Likelihood | Impact | Threat | Mitigation |
|---|---------|-----------|-------|-----------|--------|--------|-----------|
${sortedByRisk
      .map(
        (r, i) =>
          `| ${i + 1} | ${r.gap.substring(0, 20)}... | ${r.riskScore} | ${r.riskLabel} | ${r.likelihood}/5 | ${r.impact}/5 | ${r.threat.substring(0, 15)}... | ${r.mitigation.substring(0, 15)}... |`
      )
      .join('\n')}

---

## Risk Distribution Analysis

### By Risk Level
- **Critical (Immediate Action):** ${summary.criticalCount} controls
- **High (Priority Action):** ${summary.highCount} controls
- **Medium (Address Soon):** ${summary.mediumCount} controls
- **Low (Monitor):** ${summary.lowCount} controls
- **Very Low (Acceptable):** ${summary.veryLowCount} controls

### By Category
${Array.from(new Set(results.map((r) => r.category || 'Uncategorized')))
      .map((cat) => {
        const count = results.filter((r) => (r.category || 'Uncategorized') === cat).length;
        const avgScore =
          results
            .filter((r) => (r.category || 'Uncategorized') === cat)
            .reduce((sum, r) => sum + r.riskScore, 0) / count;
        return `- **${cat}:** ${count} controls (Avg Risk: ${avgScore.toFixed(2)})`;
      })
      .join('\n')
    }

---

## Recommendations

### Immediate Actions (Next 30 Days)
${sortedByRisk
      .filter((r) => r.riskLevel === 'CRITICAL')
      .slice(0, 5)
      .map(
        (r, i) => `${i + 1}. **${r.gap}**\n   - Action: ${r.mitigation}\n   - Timeline: ${r.riskTimeline}`
      )
      .join('\n\n') || 'No critical risks identified'}

### Short-term Actions (30-90 Days)
${sortedByRisk
      .filter((r) => r.riskLevel === 'HIGH')
      .slice(0, 5)
      .map(
        (r, i) => `${i + 1}. **${r.gap}**\n   - Action: ${r.mitigation}\n   - Timeline: ${r.riskTimeline}`
      )
      .join('\n\n') || 'No high risks identified'}

---

## Conclusion

This assessment identified **${summary.totalItems} controls** with an overall risk profile of **${summary.overallRiskLevel}**.

**Key Findings:**
- ${summary.criticalCount} critical risks requiring immediate remediation
- ${summary.highCount} high-priority risks requiring action within 90 days
- ${summary.mediumCount} medium-priority risks requiring planned remediation
- Average risk score: ${summary.averageRiskScore.toFixed(2)}/25

**Next Steps:**
1. Address all critical risks within 30 days
2. Create remediation plan for high-priority risks
3. Schedule quarterly reassessments
4. Track remediation progress

---

**Report Generated:** ${new Date().toLocaleString()}  
**Assessment Tool:** OpenRouter Risk Analysis Engine
`;

  return markdown;
};

