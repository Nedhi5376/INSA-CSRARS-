import { initializeAI, analyzeQuestion, getRiskLevel } from '@/lib/utils/ai';

type QuestionnaireLevel = 'operational' | 'tactical' | 'strategic';

type AnalyzerQuestion = {
    id: number;
    section: string;
    question: string;
    answer: string;
    level: QuestionnaireLevel;
};

type AnalyzerAnalysis = {
    likelihood: number;
    impact: number;
    riskScore: number;
    riskLevel: string;
    riskColor: string;
    gap: string;
    threat: string;
    mitigation: string;
    impactLabel?: string;
    likelihoodLabel?: string;
    impactDescription?: string;
};

type AnalyzerResultItem = {
    questionId: number;
    section: string;
    question: string;
    answer: string;
    level: QuestionnaireLevel;
    analysis: AnalyzerAnalysis & {
        inherentRiskScore: number;
        inherentRiskLevel: string;
        residualRiskScore: number;
        residualRiskLevel: string;
    };
    timestamp: Date;
};

type AnalyzerSummary = {
    totalQuestions: number;
    riskDistribution: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; VERY_LOW: number };
    averageRiskScore: number;
    averageInherentRiskScore: number;
    averageResidualRiskScore: number;
    topRisks: Array<{
        questionId: number;
        riskLevel: string;
        riskScore: number;
        gap: string;
    }>;
};

type AnalyzerOverallSummary = {
    totalQuestionsAnalyzed: number;
    riskDistribution: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; VERY_LOW: number };
    averageRiskScore: number;
    averageInherentRiskScore: number;
    averageResidualRiskScore: number;
};

type AnalyzerResults = {
    metadata: {
        timestamp: Date;
        totalQuestions: number;
        levels: {
            operational: number;
            tactical: number;
            strategic: number;
        };
    };
    operational: AnalyzerResultItem[];
    tactical: AnalyzerResultItem[];
    strategic: AnalyzerResultItem[];
    summary: {
        operational: AnalyzerSummary;
        tactical: AnalyzerSummary;
        strategic: AnalyzerSummary;
        overall: AnalyzerOverallSummary;
    };
};

const hasMeaningfulGap = (analysis: AnalyzerAnalysis) => {
    const gap = String(analysis?.gap || '').toLowerCase();
    const mitigation = String(analysis?.mitigation || '').toLowerCase();
    return gap !== '' &&
        gap !== 'no potential gap' &&
        mitigation !== 'current controls are adequate';
};

const buildRiskProfiles = (analysis: AnalyzerAnalysis) => {
    const residualRisk = getRiskLevel(analysis.likelihood, analysis.impact);
    const increasedLikelihood = hasMeaningfulGap(analysis)
        ? Math.min(5, analysis.likelihood + 1)
        : analysis.likelihood;
    const increasedImpact = hasMeaningfulGap(analysis)
        ? Math.min(5, analysis.impact + 1)
        : analysis.impact;
    const inherentRisk = getRiskLevel(increasedLikelihood, increasedImpact);

    return {
        inherentRiskScore: inherentRisk.riskScore,
        inherentRiskLevel: inherentRisk.riskLevel,
        residualRiskScore: residualRisk.riskScore,
        residualRiskLevel: residualRisk.riskLevel
    };
};

const createQuestionResult = (question: AnalyzerQuestion, analysis: AnalyzerAnalysis): AnalyzerResultItem => {
    const riskProfiles = buildRiskProfiles(analysis);
    return {
        questionId: question.id,
        section: question.section,
        question: question.question,
        answer: question.answer,
        level: question.level,
        analysis: {
            likelihood: analysis.likelihood,
            impact: analysis.impact,
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            riskColor: analysis.riskColor,
            inherentRiskScore: riskProfiles.inherentRiskScore,
            inherentRiskLevel: riskProfiles.inherentRiskLevel,
            residualRiskScore: riskProfiles.residualRiskScore,
            residualRiskLevel: riskProfiles.residualRiskLevel,
            gap: analysis.gap,
            threat: analysis.threat,
            mitigation: analysis.mitigation,
            impactLabel: analysis.impactLabel,
            likelihoodLabel: analysis.likelihoodLabel,
            impactDescription: analysis.impactDescription
        },
        timestamp: new Date()
    };
};

const calculateLevelSummary = (levelData: AnalyzerResultItem[]): AnalyzerSummary => {
    if (levelData.length === 0) {
        return {
            totalQuestions: 0,
            riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
            averageRiskScore: 0,
            averageInherentRiskScore: 0,
            averageResidualRiskScore: 0,
            topRisks: []
        };
    }

    const critical = levelData.filter(d => d.analysis.riskLevel === 'CRITICAL').length;
    const high = levelData.filter(d => d.analysis.riskLevel === 'HIGH').length;
    const medium = levelData.filter(d => d.analysis.riskLevel === 'MEDIUM').length;
    const low = levelData.filter(d => d.analysis.riskLevel === 'LOW').length;
    const veryLow = levelData.filter(d => d.analysis.riskLevel === 'VERY_LOW').length;
    const avgScore = (levelData.reduce((sum, d) => sum + d.analysis.riskScore, 0) / levelData.length).toFixed(2);
    const avgInherent = (
        levelData.reduce((sum, d) => sum + (d.analysis.inherentRiskScore || d.analysis.riskScore || 0), 0) / levelData.length
    ).toFixed(2);
    const avgResidual = (
        levelData.reduce((sum, d) => sum + (d.analysis.residualRiskScore || d.analysis.riskScore || 0), 0) / levelData.length
    ).toFixed(2);

    return {
        totalQuestions: levelData.length,
        riskDistribution: { CRITICAL: critical, HIGH: high, MEDIUM: medium, LOW: low, VERY_LOW: veryLow },
        averageRiskScore: parseFloat(avgScore),
        averageInherentRiskScore: parseFloat(avgInherent),
        averageResidualRiskScore: parseFloat(avgResidual),
        topRisks: levelData
            .sort((a, b) => b.analysis.riskScore - a.analysis.riskScore)
            .slice(0, 3)
            .map(d => ({
                questionId: d.questionId,
                riskLevel: d.analysis.riskLevel,
                riskScore: d.analysis.riskScore,
                gap: d.analysis.gap
            }))
    };
};

const calculateOverallSummary = (allData: AnalyzerResultItem[]): AnalyzerOverallSummary => {
    if (allData.length === 0) {
        return {
            totalQuestionsAnalyzed: 0,
            riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
            averageRiskScore: 0,
            averageInherentRiskScore: 0,
            averageResidualRiskScore: 0
        };
    }

    const allCritical = allData.filter(d => d.analysis.riskLevel === 'CRITICAL').length;
    const allHigh = allData.filter(d => d.analysis.riskLevel === 'HIGH').length;
    const allMedium = allData.filter(d => d.analysis.riskLevel === 'MEDIUM').length;
    const allLow = allData.filter(d => d.analysis.riskLevel === 'LOW').length;
    const allVeryLow = allData.filter(d => d.analysis.riskLevel === 'VERY_LOW').length;
    const overallAvg = (allData.reduce((sum, d) => sum + d.analysis.riskScore, 0) / allData.length).toFixed(2);
    const overallInherentAvg = (
        allData.reduce((sum, d) => sum + (d.analysis.inherentRiskScore || d.analysis.riskScore || 0), 0) / allData.length
    ).toFixed(2);
    const overallResidualAvg = (
        allData.reduce((sum, d) => sum + (d.analysis.residualRiskScore || d.analysis.riskScore || 0), 0) / allData.length
    ).toFixed(2);

    return {
        totalQuestionsAnalyzed: allData.length,
        riskDistribution: {
            CRITICAL: allCritical,
            HIGH: allHigh,
            MEDIUM: allMedium,
            LOW: allLow,
            VERY_LOW: allVeryLow
        },
        averageRiskScore: parseFloat(overallAvg),
        averageInherentRiskScore: parseFloat(overallInherentAvg),
        averageResidualRiskScore: parseFloat(overallResidualAvg)
    };
};
export const performRiskAnalysis = async (questionnaireData: AnalyzerQuestion[], apiKey: string): Promise<AnalyzerResults> => {
    const useStub = !apiKey;
    const openai = useStub ? undefined : initializeAI(apiKey as string);

    const emptySummary: AnalyzerSummary = {
        totalQuestions: 0,
        riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
        averageRiskScore: 0,
        averageInherentRiskScore: 0,
        averageResidualRiskScore: 0,
        topRisks: []
    };

    const results: AnalyzerResults = {
        metadata: {
            timestamp: new Date(),
            totalQuestions: questionnaireData.length,
            levels: {
                operational: questionnaireData.filter(q => q.level === 'operational').length,
                tactical: questionnaireData.filter(q => q.level === 'tactical').length,
                strategic: questionnaireData.filter(q => q.level === 'strategic').length
            }
        },
        operational: [],
        tactical: [],
        strategic: [],
        summary: {
            operational: emptySummary,
            tactical: emptySummary,
            strategic: emptySummary,
            overall: {
                totalQuestionsAnalyzed: 0,
                riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
                averageRiskScore: 0,
                averageInherentRiskScore: 0,
                averageResidualRiskScore: 0
            }
        }
    };

    for (const level of ['operational', 'tactical', 'strategic'] as const) {
        const levelQuestions = questionnaireData.filter(q => q.level === level);

        for (let i = 0; i < levelQuestions.length; i++) {
            const question = levelQuestions[i];
            console.log(`📊 Analyzing ${level} question ${i + 1}/${levelQuestions.length}...`);

            let analysis: AnalyzerAnalysis;
            if (useStub) {
                const ans = String(question.answer || '').toLowerCase();
                const qtext = String(question.question || '').toLowerCase();
                const lvl = String(question.level || 'operational').toLowerCase();

                let likelihood = 3;
                if (ans.match(/\b(no|not|none|never|don't|dont|partial|partially)\b/)) likelihood = 4;
                else if (ans.match(/\b(yes|always|every)\b/)) likelihood = 2;
                else if (qtext.match(/vulnerab|vuln|risk|threat/)) likelihood = 4;

                let impact = lvl === 'strategic' ? 4 : lvl === 'tactical' ? 3 : 2;
                const num = parseFloat(ans.replace(/[^0-9.\-]/g, ''));
                if (!isNaN(num)) {
                    if (num > 100) impact = Math.max(impact, 5);
                    else if (num > 50) impact = Math.max(impact, 4);
                    else if (num > 10) impact = Math.max(impact, 3);
                }

                const jitter = Math.random() < 0.2 ? 1 : 0;
                likelihood = Math.min(5, Math.max(1, likelihood + jitter));
                impact = Math.min(5, Math.max(1, impact));

                const score = likelihood * impact;
                const riskLevel = score >= 16 ? 'CRITICAL' : score >= 12 ? 'HIGH' : score >= 6 ? 'MEDIUM' : score >= 2 ? 'LOW' : 'VERY_LOW';
                const riskColor = riskLevel === 'CRITICAL' ? '#dc2626' : riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MEDIUM' ? '#f97316' : '#10b981';

                const impactLabels = ['Minimal', 'Low', 'Moderate', 'High', 'Critical'];
                const likelihoodLabels = ['Remote', 'Low', 'Moderate', 'High', 'Almost Certain'];
                const impactDescriptions = [
                    'Minor inconvenience with minimal business impact',
                    'Slight disruption to operations',
                    'Significant disruption requiring attention',
                    'Severe impact on business operations',
                    'Catastrophic consequences for the organization'
                ];

                analysis = {
                    likelihood,
                    impact,
                    gap: 'Manual review suggested',
                    threat: 'Not assessed (no API)',
                    mitigation: 'Review controls',
                    riskScore: score,
                    riskLevel,
                    riskColor,
                    impactLabel: impactLabels[impact - 1] || 'Moderate',
                    likelihoodLabel: likelihoodLabels[likelihood - 1] || 'Moderate',
                    impactDescription: impactDescriptions[impact - 1] || 'Requires manual impact assessment'
                };
            } else {
                const analysisResult = await analyzeQuestion(openai, question);
                analysis = analysisResult;
            }
            const result = createQuestionResult(question, analysis);
            results[level].push(result);

            if (i < levelQuestions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        results.summary[level] = calculateLevelSummary(results[level]);
    }

    const allData = [...results.operational, ...results.tactical, ...results.strategic];
    results.summary.overall = calculateOverallSummary(allData);

    return results;
};
