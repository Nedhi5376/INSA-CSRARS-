import { initializeAI, analyzeQuestion } from '@/lib/utils/ai';

const createQuestionResult = (question: any, analysis: any) => {
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

const calculateLevelSummary = (levelData: any[]) => {
    if (levelData.length === 0) {
        return {
            totalQuestions: 0,
            riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
            averageRiskScore: 0,
            topRisks: []
        };
    }

    const critical = levelData.filter(d => d.analysis.riskLevel === 'CRITICAL').length;
    const high = levelData.filter(d => d.analysis.riskLevel === 'HIGH').length;
    const medium = levelData.filter(d => d.analysis.riskLevel === 'MEDIUM').length;
    const low = levelData.filter(d => d.analysis.riskLevel === 'LOW').length;
    const veryLow = levelData.filter(d => d.analysis.riskLevel === 'VERY_LOW').length;
    const avgScore = (levelData.reduce((sum, d) => sum + d.analysis.riskScore, 0) / levelData.length).toFixed(2);

    return {
        totalQuestions: levelData.length,
        riskDistribution: { CRITICAL: critical, HIGH: high, MEDIUM: medium, LOW: low, VERY_LOW: veryLow },
        averageRiskScore: parseFloat(avgScore),
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

const calculateOverallSummary = (allData: any[]) => {
    if (allData.length === 0) {
        return {
            totalQuestionsAnalyzed: 0,
            riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
            averageRiskScore: 0
        };
    }

    const allCritical = allData.filter(d => d.analysis.riskLevel === 'CRITICAL').length;
    const allHigh = allData.filter(d => d.analysis.riskLevel === 'HIGH').length;
    const allMedium = allData.filter(d => d.analysis.riskLevel === 'MEDIUM').length;
    const allLow = allData.filter(d => d.analysis.riskLevel === 'LOW').length;
    const allVeryLow = allData.filter(d => d.analysis.riskLevel === 'VERY_LOW').length;
    const overallAvg = (allData.reduce((sum, d) => sum + d.analysis.riskScore, 0) / allData.length).toFixed(2);

    return {
        totalQuestionsAnalyzed: allData.length,
        riskDistribution: {
            CRITICAL: allCritical,
            HIGH: allHigh,
            MEDIUM: allMedium,
            LOW: allLow,
            VERY_LOW: allVeryLow
        },
        averageRiskScore: parseFloat(overallAvg)
    };
};
export const performRiskAnalysis = async (questionnaireData: any[], apiKey: string) => {
    const useStub = !apiKey;
    const openai = useStub ? undefined : initializeAI(apiKey as string);

    const results: any = {
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
            operational: {},
            tactical: {},
            strategic: {},
            overall: {}
        }
    };

    for (const level of ['operational', 'tactical', 'strategic']) {
        const levelQuestions = questionnaireData.filter(q => q.level === level);

        for (let i = 0; i < levelQuestions.length; i++) {
            const question = levelQuestions[i];
            console.log(`📊 Analyzing ${level} question ${i + 1}/${levelQuestions.length}...`);

            let analysis: any;
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
                const analysisResult = await analyzeQuestion(openai!, question);
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
