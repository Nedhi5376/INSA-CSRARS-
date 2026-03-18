# CSRARS 

## Features

- **Automated Risk Analysis**: AI-powered analysis of risk assessment questionnaires using advanced language models via OpenRouter
- **Real-time Updates**: Server-sent events (SSE) for live dashboard updates during analysis processing
- **Multi-format Reporting**: Generate professional reports in Excel (.xlsx), PDF, Word (.docx), formats
- **Risk Visualization**: Interactive risk matrices and charts for data-driven insights and decision making
- **Enterprise Authentication**: Secure authentication system with role-based access control using NextAuth.js
- **Questionnaire Management**: Import, process, and analyze structured risk assessment questionnaires with validation

### 3. Environment Configuration

`.env.local` file in the root directory with the following required variables:



# AI Integration 
OPENROUTER_API_KEY=your-openrouter-api-key-here



### API Endpoints

The application provides RESTful API endpoints organized by functionality:

#### Questionnaire Management
- `GET /api/questionnaires/list` - Retrieve available questionnaires
- `POST /api/questionnaires/fetch` - Import new questionnaires
- `GET /api/questionnaires/[id]` - Get specific questionnaire details

#### Risk Analysis
- `POST /api/analysis/process` - Trigger risk analysis processing
- `GET /api/analysis/[id]` - Retrieve analysis results
- `POST /api/analysis/reanalyze` - Re-run analysis for existing questionnaire

#### Reporting
- `GET /api/reports/list` - List available reports
- `POST /api/reports/generate` - Generate new reports
- `GET /api/reports/export` - Export reports in various formats

#### Real-time Updates
- `GET /api/notifications/stream` - Server-sent events for real-time updates

### Questionnaire Data Format

Questionnaires must be submitted in the following JSON structure:

```json
{
  "id": "unique-questionnaire-id",
  "title": "Security Assessment Q4 2025",
  "company_name": "Example Company Name",
  "filled_by": "Person Name",
  "role": "Person Role in Company",
  "filled_date": "2025-11-26",
  "questions": [
    {
      "id": 1,
      "question": "Are all data center entry points protected?",
      "answer": "Partially Implemented",
      "section": "Physical Security Controls",
      "level": "operational"
    }
  ]
}
```



- **Frontend Framework**: Next.js 14 with App Router
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with credentials provider
- **AI Integration**: OpenRouter SDK for LLM-powered analysis
- **Real-time Communication**: Server-Sent Events (SSE)
- **Report Generation**: ExcelJS, jsPDF, docx, pptxgenjs

### Key Architectural Components

#### Risk Analysis Engine
- **Location**: `lib/services/riskAnalyzer.ts`
- **Function**: Automated processing using AI models for risk assessment
- **Integration**: OpenRouter API with configurable model selection

#### Analysis Lock System
- **Location**: `lib/services/analysisLock.ts`, `models/AnalysisLock.ts`
- **Function**: Prevents duplicate analysis runs and ensures data consistency
- **Mechanism**: MongoDB-based distributed locking with expiration

#### Real-time Event System
- **Location**: `lib/sseHub.ts`, `app/api/notifications/stream/route.ts`
- **Function**: Broadcasts analysis updates to connected dashboard clients
- **Protocol**: Server-Sent Events for efficient real-time communication

#### Report Generation Services
- **Location**: `lib/services/reportService.ts`
- **Function**: Multi-format report export functionality
- **Supported Formats**: Excel, PDF, Word


#### Current Implementation Notes
- **Dashboard Download Logic**: Assessment download functionality is currently implemented in `components/RiskCharts.tsx` considering our time limit for a implementation addtional code section at lib/services for this web .
- **Variable Naming**: Some variables and functions may lack descriptive names. Review and improve naming conventions during code refactoring.
- **AI Model Configuration**: The current AI analysis uses OpenRouter's GPT-4o Mini model. Model selection can be modified in `lib/utils/ai.ts` (lines ~293-301):

```typescript
const completion = await openRouter.chat.send({
  model: 'openai/gpt-4o-mini', // Modify this line for different models
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  temperature: 0,
  max_tokens: 500,
});
```

## personal note
 
 ### please consider we are intern so our code base will not be clear and precise so if theres a quetion that you have about the project contact as through telegram at this username @novat123

