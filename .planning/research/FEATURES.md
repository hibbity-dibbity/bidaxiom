# Feature Landscape

**Domain:** Construction SaaS (Commercial Contractors - GCs and Subcontractors)
**Researched:** 2026-02-10
**Confidence:** MEDIUM (based on training data - web verification tools unavailable)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Project Management Core** |
| Project creation and setup | Foundation for all other features | Low | Project name, location, type, dates, team |
| Project dashboard | Central hub for project status | Medium | Shows budget, schedule, RFIs, submittals at-a-glance |
| Document management | Construction generates massive paper trails | Medium | Folder structure, version control, permissions |
| Drawing management | Plans are the source of truth | High | Version control, markup, sheet navigation critical |
| **Financial Management** |
| Budget tracking | Contractors live/die by budget control | High | Line-item detail, cost codes, variance tracking |
| Change order management | Changes are inevitable in construction | High | Approval workflow, budget impact, tracking |
| Pay application (G702/G703) | Industry-standard billing format | High | AIA forms, stored materials, retainage, lien waivers |
| Cost codes (CSI divisions) | Standard categorization system | Medium | 16 or 50 division formats, custom codes |
| Invoice tracking | Track what's owed/paid | Medium | AP/AR, aging reports |
| Commitment tracking | Track subcontracts and POs | High | Budget vs committed vs actual |
| **Bidding/Procurement** |
| RFQ creation and distribution | Core pre-construction activity | Medium | Template-based, multi-sub distribution |
| Bid collection and comparison | Evaluate competing bids | Medium | Side-by-side comparison, scope leveling |
| Subcontractor directory | Maintain qualified sub database | Low | Contact info, trades, past performance |
| Bid package management | Organize scope for bidding | Medium | Drawings, specs, addenda tracking |
| **Communication** |
| RFI management | Questions are constant on jobs | Medium | Numbered tracking, response workflow, closeout |
| Submittal management | Product approval workflow | Medium | Spec section tracking, review workflow, status |
| Email integration | Construction still runs on email | Medium | Two-way sync, associate to projects |
| Team directory | Know who to contact | Low | Contact info, roles, companies |
| **Compliance/Administration** |
| User permissions/roles | Control who sees what | Medium | Company-level, project-level, feature-level |
| Audit trails | Track who changed what | Medium | Financial transactions especially critical |
| Lien waiver collection | Legal requirement for payment | Medium | Conditional/unconditional, tracking |
| Certified payroll (Davis-Bacon) | Required for public/prevailing wage work | High | Complex compliance rules |
| Contract management | Store and track agreements | Medium | Dates, values, parties, amendments |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI/Automation** |
| AI-assisted document drafting | Saves hours on RFQ/email writing | High | Context-aware, learns project specifics |
| Auto-extract cost codes from invoices | Eliminate manual data entry | High | OCR + classification, accuracy critical |
| Predictive budget variance alerts | Proactive vs reactive management | High | ML-based, requires historical data |
| Smart bid leveling | Auto-identify scope gaps in bids | High | NLP to compare inclusions/exclusions |
| **Collaboration** |
| JV bid sharing | Enable formal partnerships | Medium | Shared budgets, split responsibilities |
| Real-time co-editing | Multiple users editing simultaneously | High | Conflict resolution, sync |
| External client portals | Give owners view without full access | Medium | White-labeled, controlled visibility |
| Subcontractor self-service | Subs update their own data | Low | Reduces GC admin burden |
| **Financial Intelligence** |
| Cash flow forecasting | Know when money in/out | High | Based on pay app schedule, payment terms |
| Profit fade tracking | Early warning of margin erosion | Medium | Compare forecast to actual over time |
| Real-time project financial dashboard | Live P&L by project | High | Requires integration of all financial data |
| Multi-project portfolio view | See all projects in one view | Medium | Roll-up reporting, filtering |
| **Integration Ecosystem** |
| QuickBooks bidirectional sync | Eliminate double entry | High | Push/pull projects, invoices, bills |
| Calendar integration (Google/Outlook) | Meetings in one place | Low | Read/write calendar events |
| Banking integration (Plaid) | Auto-match payments | Medium | Connect bank feeds to pay apps |
| Estimating software integration | Bring estimates into projects | Medium | Import line items, cost codes |
| **Workflow Optimization** |
| Custom approval workflows | Match company processes | High | Configurable stages, parallel/serial |
| Template library | Standardize documents | Low | RFQs, contracts, checklists |
| Bulk actions | Process multiple items at once | Low | Mass email, status updates |
| Mobile-first field updates | Update from job site | High | Offline mode, photo sync |
| **Pricing Model Innovation** |
| Freemium for subcontractors | Grow user base, network effects | Medium | Limited features, upsell path |
| Usage-based pricing | Pay for what you use | Medium | Track usage, billing complexity |
| Volume discounts for multi-project | Incentivize larger customers | Low | Tiered pricing by project count |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| CPM scheduling (Gantt charts) | Procore/Buildertrend own this, high complexity, v1 scope creep | Simple milestone tracking, integrate with P6/MS Project later |
| Native mobile app | Expensive to maintain iOS/Android, PWA suffices for v1 | Responsive web app, offline PWA |
| Time tracking/timesheets | Feature bloat, payroll complexity, compliance minefield | Focus on project financials, integrate with Procore/ADP if needed |
| Equipment tracking | Niche need, hardware dependencies (GPS/IoT) | Let specialized tools handle this |
| Safety management | Highly regulated, liability concerns, specialized domain | Basic incident logging only, defer full safety module |
| Quality control/inspections | Procore's differentiator, complex workflows | Basic punch list, defer QA/QC checklists |
| HR/payroll | Outside core competency, high compliance risk | Integration with QuickBooks/ADP |
| Bid parsing/AI reading PDFs | Accuracy challenges, over-promising risk for v1 | Manual entry with smart templates, defer to v2 |
| BIM/3D model viewing | Extremely complex, niche for commercial, heavy infra | Link to external BIM tools if needed |
| Accounting general ledger | QuickBooks exists, don't compete | Integrate, don't replace |
| CRM pipeline management | Procore upsell, pre-pre-construction bloat | Simple lead tracking if anything |
| Warranty tracking | Post-construction, different user needs | Defer to v2+ if customer demand |
| Inventory management | Operational complexity, not project-focused | Track commitments/POs, not warehouse stock |

## Feature Dependencies

```
Project Creation
  └─> Budget Setup
       ├─> Cost Codes (required)
       ├─> Change Orders (modifies budget)
       └─> Commitments (subcontracts/POs against budget)
            └─> Pay Applications (bill against commitments)
                 └─> Lien Waivers (required for payment)

RFQ Creation
  ├─> Subcontractor Directory (distribution list)
  ├─> Bid Package Management (what to include)
  └─> Cost Codes (for budget line items)
       └─> Bid Collection (responses mapped to codes)
            └─> Budget Setup (winning bids become budget)

JV Bid Sharing
  ├─> RFQ Creation (what's being bid)
  ├─> Budget Setup (shared cost allocation)
  └─> User Permissions (JV partner access)

AI Document Drafting
  ├─> Project Context (what project, scope, history)
  ├─> Template Library (starting structure)
  └─> User Permissions (who can use AI)

QuickBooks Integration
  ├─> Cost Codes (map to QB classes/accounts)
  ├─> Budget Setup (projects → jobs)
  └─> Pay Applications (invoices) / Commitments (bills)

Freemium Sub Accounts
  ├─> User Permissions (restricted feature set)
  ├─> RFQ Response (core free feature)
  └─> Upgrade Path (paid sub features visible but locked)
```

## MVP Recommendation

### Phase 1: Core Financial Lifecycle (Table Stakes)
**Prioritize:**
1. **Project creation and setup** - Foundation
2. **Budget tracking with cost codes** - Core value prop
3. **Change order management** - Budget modifications
4. **Commitment tracking** - Subcontracts and POs
5. **Pay application (G702/G703)** - Billing foundation
6. **Basic document management** - Store contracts, invoices
7. **User permissions** - Multi-company security

**Rationale:** Smallest feature set that delivers "full project financial lifecycle" promise. Users can track a project from budget to payment.

### Phase 2: Bidding Workflow (Table Stakes + Differentiator)
**Add:**
1. **RFQ creation and distribution** - Core pre-construction
2. **Bid collection and comparison** - Evaluate subs
3. **Subcontractor directory** - Manage sub database
4. **JV bid sharing** - Differentiator for partnerships
5. **Freemium sub accounts** - Network effect growth

**Rationale:** Completes "RFQ/bidding workflow" promise. JV sharing is unique differentiator.

### Phase 3: AI-Enhanced Productivity (Differentiator)
**Add:**
1. **AI-assisted RFQ drafting** - Speed up bid packages
2. **AI-assisted email writing** - Communication efficiency
3. **AI-assisted report generation** - Executive summaries

**Rationale:** Leverage AI for competitive advantage once core workflows proven.

### Phase 4: Integration & Polish (Table Stakes)
**Add:**
1. **QuickBooks integration** - Eliminate double entry
2. **Calendar integration** - Meeting coordination
3. **Drawing management** - Plans and versions
4. **RFI management** - Field questions
5. **Submittal management** - Product approvals

**Rationale:** Rounds out table stakes, reduces friction with existing tools.

### Defer to v2+
- **CPM scheduling** - Integrate with P6/MS Project instead
- **Native mobile app** - Use responsive PWA first, validate need
- **Time tracking** - Out of scope, payroll complexity
- **Equipment tracking** - Niche need, hardware required
- **Safety management** - Specialized domain, liability
- **Bid parsing AI** - Accuracy risk, defer until core solid

### Feature Complexity vs Value

| Tier | Features | Build Priority |
|------|----------|----------------|
| **High Value, Low Complexity** | Project setup, cost codes, sub directory, freemium accounts | **Build first** |
| **High Value, Medium Complexity** | RFQ workflow, budget tracking, change orders, commitments, JV sharing | **Build second** |
| **High Value, High Complexity** | Pay applications, AI drafting, QuickBooks sync, drawing management | **Build third** |
| **Medium Value, High Complexity** | CPM scheduling, bid parsing, BIM viewing | **Defer or avoid** |

## Market Positioning Notes

### What Makes This Product Different

1. **JV bid sharing** - Unique collaboration model not in Procore/Buildertrend
2. **AI-assisted drafting** - Emerging category, early mover advantage
3. **Freemium sub model** - Network effects, not common in construction SaaS
4. **Focused financial lifecycle** - Not trying to be all things (no scheduling, time tracking, equipment)

### What Makes This Product Viable

1. **Table stakes covered** - Budget, change orders, pay apps, RFQs
2. **Integrates with incumbents** - QuickBooks for accounting, not competing with ERP
3. **Right-sized complexity** - Small/mid commercial, not enterprise or residential
4. **Clear upgrade path** - Free subs → paid subs, basic GC → full GC

### Competitive Landscape Gaps

| Competitor | Strong At | Weak At |
|------------|-----------|---------|
| **Procore** | Enterprise features, scheduling, everything | Expensive, complex for small/mid, no freemium |
| **Buildertrend** | Residential, client communication | Commercial workflows, weak financials |
| **CoConstruct** | Residential custom homes, client selection | Not for commercial |
| **Proest/On-Center** | Estimating, takeoff | Weak project management, no bidding collaboration |
| **BuilderTrend Bidding** | Simple bid collection | No JV sharing, no AI, basic financials |

**This product fits:** Commercial GC/sub market between Buildertrend (too residential) and Procore (too expensive/complex), with JV and AI differentiation.

## Feature Validation Sources

**CONFIDENCE: MEDIUM (training data only - web verification unavailable)**

This research is based on:
- Training data knowledge of Procore, Buildertrend, CoConstruct, Viewpoint, Sage, CMiC
- Understanding of AIA contract documents (G702/G703)
- Construction industry workflows (pre-construction through closeout)
- CSI MasterFormat cost code standards

**GAPS:**
- Unable to verify 2026 current feature sets of competitors
- Unable to verify latest AI/automation trends in construction SaaS
- Unable to verify current pricing models and freemium adoption
- Unable to verify recent JV collaboration tool adoption

**RECOMMENDATION:**
- Validate table stakes list with 3-5 target users (GCs and subs)
- Demo Procore, Buildertrend, BuilderTrend Bidding to confirm competitive gaps
- Survey target market on JV bid sharing need (is this real or assumed?)
- Test AI drafting value prop with actual RFQ/email writing tasks

## Sources

**NOTE:** Web search tools were unavailable during research. All findings based on training data knowledge (cutoff January 2025). Confidence level: MEDIUM.

Recommend validating with:
- Procore official documentation (procore.com/products)
- Buildertrend feature list (buildertrend.com/features)
- AIA Contract Documents (aiacontracts.org)
- CSI MasterFormat (csiresources.org)
- Target user interviews (3-5 GCs, 3-5 subs in commercial construction)
