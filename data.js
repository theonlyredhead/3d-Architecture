// ══════════════════════════════════════════════════════════
//  COCO Data Platform — architecture data
//  Edit this file to add / remove connectors and use cases.
//  No rebuild needed — just refresh the browser.
// ══════════════════════════════════════════════════════════

const ENT_COL = {
  Development:  '#FBBF24',
  Construction: '#60A5FA',
  BTR:          '#A78BFA',
  Enterprise:   '#34D399',
  Output:       '#FB7185',
};

const SYNC_COL = {
  realtime: '#34D399',
  hourly:   '#FBBF24',
  nightly:  '#475569',
  manual:   '#334155',
};

const SYNC_LBL = {
  realtime: 'REAL-TIME',
  hourly:   'HOURLY',
  nightly:  'NIGHTLY',
  manual:   'MANUAL',
};

const KIND_LABEL = {
  source: 'Source Connector',
  output: 'Output Connector',
  api:    'Core API',
  db:     'Central Database',
  ai:     'AI Engine',
};

const KIND_COL = {
  source: '#64748B',
  output: '#FB7185',
  api:    '#3B82F6',
  db:     '#10B981',
  ai:     '#FB923C',
};

// ── Source connectors ─────────────────────────────────────
const SOURCES = [
  {
    id: 'hubspot', name: 'HubSpot', type: 'CRM & Sales',
    ent: 'Development', hex: '#FBBF24', sync: 'hourly', w: 6,
    desc: 'Sales pipeline, buyer lifecycle, marketing automation, and lead scoring across all development projects.',
    uc: [
      { t: 'Sales Pipeline & Conversion', a: 'Development Director', d: 'Live buyer pipeline from enquiry to settlement. Conversion by stage, channel, and agent.', ai: 'AI generates weekly pipeline summary with movement highlights emailed to leadership.', imp: 'Forecast settlement revenue with confidence' },
      { t: 'Settlement Tracker', a: 'Dev Director / CFO', d: 'Every lot in settlement. Finance approval, sunset risk, receipt forecasts.', ai: 'Flags at-risk settlements where buyer finance approval is overdue.', imp: 'No settlement surprises, accurate cash receipts forecast' },
      { t: 'Marketing ROI', a: 'Marketing Manager', d: 'Spend vs enquiry volume, quality, and conversion. Cost per lead and per sale.', ai: 'Multi-touch attribution allocates credit across the full buyer journey.', imp: 'Spend marketing dollars where they actually convert' },
      { t: 'Buyer Demographics', a: 'Development Director', d: 'Age, location, buyer type, unit preference, price sensitivity.', ai: 'Clusters buyer profiles and maps preferences to unit types.', imp: 'Design products people actually want' },
      { t: 'Lead Source Attribution', a: 'Marketing Manager', d: 'First and multi-touch attribution by channel.', ai: 'ML identifies lead sources that produce fastest time-to-sale.', imp: 'Invest in channels that produce buyers not browsers' },
      { t: 'Campaign Performance', a: 'Marketing Manager', d: 'Every campaign: spend, impressions, clicks, enquiries, conversions.', ai: 'Predictive lead scoring ranks enquiries by likelihood to convert.', imp: 'Know exactly which campaigns drive revenue' },
    ],
  },
  {
    id: 'acumatica', name: 'Acumatica', type: 'Finance & ERP',
    ent: 'Enterprise', hex: '#34D399', sync: 'nightly', w: 5,
    desc: 'Core ERP across all four entities. P&L, AP, AR, intercompany reconciliation, and treasury.',
    uc: [
      { t: 'Group Financial Oversight', a: 'CEO / CFO / Board', d: 'Consolidated P&L, cash flow, budget vs actual. Refreshed daily.', ai: 'Anomaly detection flags unusual cost movements before month-end close.', imp: 'Single source of truth for group financials' },
      { t: 'Cash Flow Forecasting', a: 'CFO / Treasury', d: 'Rolling 12-month forecast: drawdowns, settlements, BTR rental, capital calls.', ai: 'Predictive modelling adjusts forecasts based on historical patterns.', imp: 'Avoid cash surprises, plan drawdowns with confidence' },
      { t: 'Intercompany Reconciliation', a: 'CFO / Finance', d: 'Automated matching across all entities. Unmatched items flagged daily.', ai: 'Pattern matching identifies systematic miscodings.', imp: 'Cut month-end close time' },
      { t: 'Tax & BAS Compliance', a: 'CFO / Tax', d: 'GST position, BAS lodgement, input tax credit reconciliation.', ai: 'Flags transactions with incorrect GST coding before BAS lodgement.', imp: 'Lodge BAS with confidence, reduce ATO risk' },
      { t: 'Debt Covenant Monitoring', a: 'CFO / Treasury', d: 'Live tracking of all debt covenants: LVR, ICR, DSCR.', ai: 'Early warning alerts when covenant metrics trend toward breach.', imp: 'Maintain lender confidence' },
    ],
  },
  {
    id: 'ipm', name: 'IPM Global', type: 'Cost Mgmt / Investor',
    ent: 'Development', hex: '#38BDF8', sync: 'nightly', w: 3,
    desc: 'Cost management, investor reporting, capital call tracking, GFA and yield management.',
    uc: [
      { t: 'Capital Allocation Review', a: 'CEO / CFO / Board', d: 'Where is capital deployed? Returns by project, fund, and asset class.', ai: 'Scenario modelling: redeploy capital from land bank to BTR?', imp: 'Deploy capital where returns are highest' },
      { t: 'Investor Fund Reporting', a: 'CEO / Fund Manager', d: 'Automated investor packs: IRR, equity multiples, distributions.', ai: 'AI drafts narrative commentary on fund performance.', imp: 'Investor packs in hours not weeks' },
      { t: 'Development Fund Waterfall', a: 'CFO / Fund Manager', d: 'Automated waterfall: preferred returns, catch-up, carried interest.', ai: 'Scenario modelling shows waterfall impact of exit timing.', imp: 'Transparent investor returns' },
    ],
  },
  {
    id: 'excel', name: 'Excel Models', type: 'Feasibility & Acquisitions',
    ent: 'Development', hex: '#E879F9', sync: 'manual', w: 3,
    desc: 'Feasibility models, acquisitions analysis, residual land value, and sensitivity analysis.',
    uc: [
      { t: 'Feasibility Model Registry', a: 'Development Director', d: 'Central register: version history, approval status, key assumptions.', ai: 'AI detects when a model has not been updated in line with cost changes.', imp: 'One place to find every feasibility, always current' },
      { t: 'Assumption Benchmarking', a: 'Dev Director / CFO', d: 'Compare assumptions across all projects. Flags outliers vs actuals.', ai: 'Benchmarks assumptions and flags those outside one standard deviation.', imp: 'Stop optimistic assumptions surviving into approved feasibilities' },
      { t: 'Sensitivity Dashboard', a: 'Directors / Board', d: 'Standardised sensitivity: cost +5%, prices -10%, programme +3 months.', ai: 'Monte Carlo simulation produces probability-weighted return ranges.', imp: 'Understand downside risk before committing capital' },
    ],
  },
  {
    id: 'jobpac', name: 'Jobpac', type: 'Project Costing',
    ent: 'Construction', hex: '#60A5FA', sync: 'nightly', w: 4,
    desc: 'Construction cost management, subcontractor payments, variation tracking.',
    uc: [
      { t: 'Project Cost Performance', a: 'Construction Director', d: 'Cost-to-complete, committed vs actual, forecast final cost.', ai: 'Natural language Q&A over live construction data.', imp: 'Protect margins with early intervention' },
      { t: 'Variation & Claims Exposure', a: 'Construction Director / CFO', d: 'Total variation exposure: approved, pending, disputed.', ai: 'Clusters variation patterns to identify systemic design gaps.', imp: 'Quantify risk exposure at any point' },
      { t: 'Subcontractor Performance', a: 'Construction Director', d: 'Payment status, retention, defect rates, programme compliance.', ai: 'Subcontractor scoring model for future tender shortlisting.', imp: 'Better subbie selection, fewer defects' },
      { t: 'Earned Value Analysis', a: 'Construction Director', d: 'Planned vs earned vs actual. SPI and CPI auto-calculated.', ai: 'EAC projections auto-calculated, flagging over-budget projects.', imp: 'Industry-standard measurement, no spreadsheets' },
    ],
  },
  {
    id: 'aconex', name: 'Oracle Aconex', type: 'Document Control',
    ent: 'Construction', hex: '#818CF8', sync: 'hourly', w: 3,
    desc: 'Document control, RFI tracking, hold points, and compliance certification.',
    uc: [
      { t: 'Design Documentation Progress', a: 'Construction Director', d: 'Document issue status mapped against programme milestones.', ai: 'Predicts programme impact of late documentation.', imp: 'Stop documentation delays becoming programme delays' },
      { t: 'QA Audit Trail', a: 'Construction Director', d: 'Inspection results, NCRs, hold points, rectification status.', ai: 'Identifies which trades consistently fail first inspection.', imp: 'Systemic quality improvement, fewer defects at handover' },
      { t: 'Lessons Learned Repository', a: 'All PMs', d: 'Searchable database of project lessons.', ai: 'AI retrieves relevant lessons for new projects.', imp: 'Stop repeating the same mistakes' },
    ],
  },
  {
    id: 'asta', name: 'Asta / MS Project', type: 'Programme & Resources',
    ent: 'Construction', hex: '#A3E635', sync: 'nightly', w: 3,
    desc: 'Construction programme management, critical path, resource loading.',
    uc: [
      { t: 'Programme Slippage', a: 'Construction Director', d: 'Which activities slipped? Baseline vs current, float analysis.', ai: 'Identifies delay patterns across projects.', imp: 'Intervene before delays compound' },
      { t: 'Resource Loading', a: 'Construction Director', d: 'Planned vs actual resource allocation. Bottlenecks flagged.', ai: 'Capacity planning flags conflicts when multiple projects peak.', imp: 'Right people on the right projects' },
      { t: 'OC Readiness', a: 'Construction Director', d: 'Stage 1 OC: inspections, certs, services commissioned.', ai: 'AI assesses OC readiness probability.', imp: 'Hit OC dates, start earning income sooner' },
    ],
  },
  {
    id: 'propertytree', name: 'PropertyTree', type: 'Property Management',
    ent: 'BTR', hex: '#A78BFA', sync: 'hourly', w: 3,
    desc: 'BTR leasing, arrears, maintenance, tenant lifecycle, rental income.',
    uc: [
      { t: 'Portfolio Performance', a: 'BTR Director / Investors', d: 'Occupancy, rental income, opex per unit, NOI, resident satisfaction.', ai: 'Benchmarks each asset against portfolio averages.', imp: 'Maximise NOI and investor confidence' },
      { t: 'Leasing Velocity & Vacancy', a: 'BTR Director', d: 'Days on market, enquiry-to-lease conversion, upcoming expiries.', ai: 'Dynamic pricing recommendations based on demand signals.', imp: 'Minimise vacancy loss, optimise rental pricing' },
      { t: 'Rent Arrears & Collections', a: 'BTR Director / Finance', d: 'Arrears by asset, unit, age. Collection effectiveness.', ai: 'Prioritises collection effort and predicts escalation to bad debt.', imp: 'Minimise arrears, protect rental income' },
    ],
  },
  {
    id: 'connecx', name: 'ConnecX', type: 'Resident Services',
    ent: 'BTR', hex: '#C084FC', sync: 'realtime', w: 2,
    desc: 'Resident portal for maintenance, amenity bookings, communication.',
    uc: [
      { t: 'Resident Experience & Retention', a: 'BTR Director', d: 'Satisfaction scores, complaint categories, renewal rates.', ai: 'Sentiment analysis identifies emerging issues before they trend.', imp: 'Higher retention, lower turnover cost' },
      { t: 'Common Area Utilisation', a: 'BTR Director', d: 'Gym, pool, co-working, rooftop usage by time and season.', ai: 'Identifies underutilised amenities and suggests programming changes.', imp: 'Invest in amenities residents actually use' },
    ],
  },
  {
    id: 'blogix', name: 'BLogix', type: 'Building Systems',
    ent: 'BTR', hex: '#22D3EE', sync: 'realtime', w: 2,
    desc: 'Energy, utilities, access control, HVAC, and IoT sensors.',
    uc: [
      { t: 'Energy & Utilities Management', a: 'BTR Director / Facilities', d: 'Consumption, water, utility costs by asset, floor, common area.', ai: 'Anomaly detection identifies unusual consumption spikes.', imp: 'Reduce utility costs and environmental footprint' },
      { t: 'ESG Reporting', a: 'CEO / Board / Investors', d: 'Energy ratings, waste diversion, green certifications.', ai: 'AI maps operational data to ESG frameworks (GRESB, NABERS).', imp: 'Investor-grade ESG reporting from operational data' },
    ],
  },
  {
    id: 'elmo', name: 'ELMO', type: 'HR & Payroll',
    ent: 'Enterprise', hex: '#4ADE80', sync: 'nightly', w: 2,
    desc: 'HR, payroll, performance, learning, compliance training.',
    uc: [
      { t: 'Workforce Analytics', a: 'COO / HR', d: 'Headcount, turnover, leave liability, workforce cost by entity.', ai: 'Attrition risk scoring highlights retention concerns before resignation.', imp: 'Data-driven workforce planning' },
      { t: 'Compliance & Certification', a: 'COO / Risk', d: 'Expiring licences, mandatory training, WHS compliance.', ai: 'Automated alerts when certifications approach expiry.', imp: 'Never be caught with an expired licence on site' },
    ],
  },
];

// ── Output connectors ─────────────────────────────────────
const OUTPUTS = [
  {
    id: 'pbi', name: 'Power BI', type: 'Executive Dashboards',
    ent: 'Output', hex: '#F43F5E', w: 6,
    desc: '100+ dashboards across all business areas. Role-filtered by entity and seniority.',
    uc: [
      { t: 'Strategic KPI Dashboard', a: 'CEO / Board', d: 'Top-level KPIs: revenue, margin, pipeline, occupancy, cash, headcount.', ai: 'Auto-generates board narrative from live KPIs.', imp: 'Board meetings driven by live data' },
      { t: 'Project Scorecards', a: 'Directors / Board', d: 'One-page per project: programme, cost, sales, risks.', ai: 'Auto-generates project status narrative.', imp: 'Consistent comparable reporting across the portfolio' },
      { t: 'BTR Portfolio View', a: 'BTR Director / Investors', d: 'NOI, occupancy, arrears, resident satisfaction.', ai: 'Benchmarks each asset with trend overlays.', imp: 'Investor-grade BTR reporting from a single screen' },
      { t: 'Financial Oversight', a: 'CFO / CEO', d: 'Consolidated P&L, cash flow, budget vs actual. Daily refresh.', ai: 'Anomaly detection surfaces unusual movements.', imp: 'One set of numbers, refreshed daily' },
      { t: 'Construction Dashboard', a: 'Construction Director', d: 'Cost performance, programme, variation exposure, OC readiness.', ai: 'Natural language Q&A over live construction data.', imp: 'Board-level visibility of every project' },
      { t: 'Sales Pipeline Dashboard', a: 'Development Director', d: 'Live buyer pipeline, settlement tracker, marketing ROI.', ai: 'AI-generated weekly pipeline narrative.', imp: 'Forecast settlement revenue with confidence' },
    ],
  },
  {
    id: 'ai_assist', name: 'AI Assistant', type: 'Conversational Q&A',
    ent: 'Output', hex: '#E879F9', w: 3,
    desc: 'Plain-English Q&A over all company data via API.',
    uc: [
      { t: 'Cross-system queries', a: 'All staff / Leadership', d: '"What is the margin on Project X vs original feasibility?"', ai: 'Claude joins all connector data to answer in plain English.', imp: 'Questions that took analysts hours, done in seconds' },
      { t: 'Policy & compliance Q&A', a: 'All staff', d: 'HR policies, privacy obligations, procurement rules, safety.', ai: 'RAG retrieval surfaces policy documents with clause-level citations.', imp: 'Staff self-serve compliance answers' },
      { t: 'Contract review', a: 'Legal / Directors', d: 'Upload a contract: key risks, comparison to standard terms.', ai: 'Claude analyses terms against COCO standard positions.', imp: 'Faster contract review, fewer missed clauses' },
    ],
  },
  {
    id: 'reports', name: 'Auto-Reports', type: 'Scheduled Delivery',
    ent: 'Output', hex: '#FB923C', w: 2,
    desc: 'Automated generation of board packs, investor updates, management accounts.',
    uc: [
      { t: 'Monthly Board Pack', a: 'CEO / Secretary', d: 'Automated assembly: financials, projects, sales, BTR, risk, people.', ai: 'Claude drafts each section, highlights material changes.', imp: 'Board pack from days to hours' },
      { t: 'Weekly Investor Update', a: 'Fund Manager', d: 'Fund performance and distribution updates.', ai: 'Claude personalises language per investor relationship.', imp: 'Investor comms at scale without manual effort' },
    ],
  },
  {
    id: 'briefing', name: 'Board Intelligence', type: 'AI Executive Briefings',
    ent: 'Output', hex: '#A78BFA', w: 2,
    desc: 'Monday AI-generated executive briefing — KPIs, movements, risks, actions.',
    uc: [
      { t: 'Monday Morning Briefing', a: 'CEO / Directors', d: 'Material KPI movements across the group from the prior week.', ai: 'Claude identifies the 5 most significant movements as narrative.', imp: 'Leadership starts Monday informed not catching up' },
      { t: 'Risk Alerts', a: 'CEO / Risk', d: 'Real-time alerts when data triggers thresholds.', ai: 'Continuous monitoring triggers Claude to generate contextual alerts.', imp: 'Issues surfaced in minutes not at month-end' },
    ],
  },
];

// ── Derived collections ───────────────────────────────────
const ALL = [...SOURCES, ...OUTPUTS];

const ALL_UCS = [];
ALL.forEach(n => {
  if (n.uc) n.uc.forEach(u => ALL_UCS.push({ ...u, srcNode: n }));
});
