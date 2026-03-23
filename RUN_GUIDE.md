# Cyber Security Risk Analysis & Reporting System (CSRARS)

## Installation Guide

1. **Clone the project**
   ```bash
   git clone <repository-url>
   cd INSA-CSRARS-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root folder and add the following:
   ```env
   MONGODB_URI=mongodb+srv://INSATEAM:1234@cluster0.gpje1sd.mongodb.net/?appName=Cluster0
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret-here
   OPENAI_API_KEY=your-openai-api-key-here
   ```

4. **Initialize Metadata**
   The project uses MongoDB Collections: `users`, `questionnaires`, `riskanalyses`, `reports`.

5. **Run Development Server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## User Roles
- **Risk Analyst**: Full system access, all dashboards, all reports.
- **Director**: Strategic executive dashboard only.
- **Division Head**: Tactical management dashboard only.
- **Staff**: Operational technical dashboard only.

## Exporting Reports
Navigate to the Dashboard, filter your results, and click on **Generate Strategic/Tactical/Operational Report** to download in PDF, DOCX, or PPTX format.
