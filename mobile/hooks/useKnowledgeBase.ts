// mobile/hooks/useKnowledgeBase.ts
// FE-15: Knowledge Base — search, categories, articles

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface KBCategory {
  id: string;
  label: string;
  icon: string;
  article_count: number;
}

export interface KBArticle {
  id: string;
  title: string;
  category_id: string;
  summary: string;
  content: string;          // markdown body
  tags: string[];
  reading_time_minutes: number;
  published_at: string;
  is_pinned?: boolean;
}

export function useKBCategories() {
  return useQuery<KBCategory[]>({
    queryKey: ["kb-categories"],
    queryFn: async () => {
      const { data } = await api.get<KBCategory[]>("/knowledge-base/categories");
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 min — rarely changes
  });
}

export function useKBArticles(categoryId?: string, search?: string) {
  return useQuery<KBArticle[]>({
    queryKey: ["kb-articles", categoryId, search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (categoryId) params.category_id = categoryId;
      if (search)     params.q = search;
      const { data } = await api.get<KBArticle[]>("/knowledge-base/articles", { params });
      return data;
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useKBArticle(id: string) {
  return useQuery<KBArticle>({
    queryKey: ["kb-article", id],
    queryFn: async () => {
      const { data } = await api.get<KBArticle>(`/knowledge-base/articles/${id}`);
      return data;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!id,
  });
}

// ── Static fallback content (when API is not yet implemented) ─────────────────
export const STATIC_CATEGORIES: KBCategory[] = [
  { id: "burs",   label: "BURS & Tax",        icon: "account-balance", article_count: 8  },
  { id: "cipa",   label: "CIPA & Companies",  icon: "business",        article_count: 5  },
  { id: "labour", label: "Labour Act",         icon: "groups",          article_count: 6  },
  { id: "vat",    label: "VAT",                icon: "receipt-long",    article_count: 4  },
  { id: "tips",   label: "Compliance Tips",    icon: "lightbulb",       article_count: 10 },
];

export const STATIC_ARTICLES: KBArticle[] = [
  {
    id: "vat-registration",
    title: "When must a business register for VAT?",
    category_id: "vat",
    summary: "In Botswana, VAT registration is compulsory once your annual taxable supplies exceed BWP 1,000,000.",
    content: `## VAT Registration Threshold\n\nIn Botswana, **VAT registration is compulsory** once your annual taxable supplies exceed **BWP 1,000,000**.\n\nVoluntary registration is allowed below this threshold.\n\n## Key Deadlines\n- Register within **21 days** of exceeding the threshold.\n- First return due within **25 days** after the end of your first tax period.\n\n## Penalties for Late Registration\nBURS may impose a fine of **BWP 2,000** plus interest for late registration.\n\n## How to Register\n1. Visit the BURS e-Services portal: [etax.burs.org.bw](https://etax.burs.org.bw)\n2. Complete Form VAT 1\n3. Submit supporting documents (ID, business registration, bank statement)`,
    tags: ["VAT", "registration", "BURS", "threshold"],
    reading_time_minutes: 3,
    published_at: "2024-01-15T00:00:00Z",
    is_pinned: true,
  },
  {
    id: "cipa-annual-return",
    title: "CIPA Annual Return — what it is and when to file",
    category_id: "cipa",
    summary: "Every registered company must file an Annual Return with CIPA within 30 days of its anniversary date.",
    content: `## What is a CIPA Annual Return?\n\nEvery company registered in Botswana must file an **Annual Return** with CIPA confirming that the company is still active and that its details are up to date.\n\n## Filing Deadline\n- Due within **30 days** of the company's anniversary date (the date it was incorporated).\n\n## What You Need\n- Updated list of directors and shareholders\n- Registered office address\n- CIPA filing fee (varies by company type)\n\n## Penalty for Late Filing\n**BWP 500** per month overdue, accruing until the return is filed.\n\n## How to File\nVisit the CIPA online portal or a CIPA office. You'll need your company registration number.`,
    tags: ["CIPA", "annual return", "companies"],
    reading_time_minutes: 4,
    published_at: "2024-02-01T00:00:00Z",
    is_pinned: true,
  },
  {
    id: "paye-employer",
    title: "PAYE obligations for employers in Botswana",
    category_id: "burs",
    summary: "Employers must deduct PAYE from employee salaries monthly and remit to BURS by the 15th of the following month.",
    content: `## Employer PAYE Obligations\n\nAs an employer, you are required to:\n\n1. **Register** as an employer with BURS.\n2. **Deduct PAYE** from employee salaries each month using the current tax tables.\n3. **Remit** the deducted PAYE to BURS by the **15th of the following month**.\n4. **File a monthly PAYE return** (Form ITW 6).\n5. **Issue IRP5 certificates** to employees by 30 April each year.\n\n## Tax-Free Threshold (2024/25)\nThe first **BWP 48,000** per annum is tax-free.\n\n## Penalties\n- Late payment: **1.5% per month** interest\n- Late filing: **BWP 500** fixed penalty`,
    tags: ["PAYE", "employer", "payroll", "BURS"],
    reading_time_minutes: 5,
    published_at: "2024-01-20T00:00:00Z",
  },
  {
    id: "tax-clearance",
    title: "How to obtain a Tax Clearance Certificate",
    category_id: "burs",
    summary: "A Tax Clearance Certificate (TCC) is required for government tenders and is valid for 12 months.",
    content: `## What is a Tax Clearance Certificate?\n\nA **Tax Clearance Certificate (TCC)** is issued by BURS confirming that a taxpayer is up to date with all tax obligations.\n\n## When You Need a TCC\n- Government and parastatal **tenders**\n- Renewing a **trade licence**\n- Opening certain types of **bank accounts**\n\n## How to Apply\n1. Ensure all returns are filed and taxes are paid.\n2. Log in to **BURS e-Services** at etax.burs.org.bw\n3. Submit the TCC application online.\n4. Allow **5–10 working days** for processing.\n\n## Validity\nA TCC is valid for **12 months** from the date of issue. Set an expiry reminder in your Evidence Locker.\n\n## Upload Your TCC\nOnce received, upload it to your Evidence Locker and set the expiry date so you receive an alert before it expires.`,
    tags: ["TCC", "tax clearance", "tenders", "BURS"],
    reading_time_minutes: 3,
    published_at: "2024-03-01T00:00:00Z",
  },
  {
    id: "minimum-wage-2024",
    title: "Botswana minimum wage rates 2024",
    category_id: "labour",
    summary: "The Wages Council Act sets minimum wages by sector. Most sectors saw increases effective April 2024.",
    content: `## 2024 Minimum Wage Rates\n\nMinimum wages in Botswana are set by the **Wages Council** under the Wages Council Act.\n\n| Sector | Daily Rate (BWP) |\n|--------|------------------|\n| General workers | BWP 30.00 |\n| Retail/wholesale | BWP 35.00 |\n| Building & construction | BWP 33.00 |\n| Agriculture | BWP 28.00 |\n| Security | BWP 32.00 |\n\n*Rates are illustrative — always verify against the latest Government Gazette.*\n\n## Compliance Requirement\nEmployers must **display the applicable wage notice** at their premises and maintain wage records for **5 years**.\n\n## Penalties for Non-Compliance\nFines of up to **BWP 10,000** and/or imprisonment for serious breaches.`,
    tags: ["minimum wage", "labour", "employment"],
    reading_time_minutes: 3,
    published_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "cit-filing",
    title: "Corporate Income Tax — filing deadlines and rates",
    category_id: "burs",
    summary: "CIT is due 4 months after your financial year end. The standard rate is 22% for most companies.",
    content: `## Corporate Income Tax (CIT)\n\nCompanies registered in Botswana are subject to **Corporate Income Tax (CIT)**.\n\n## Tax Rates (2024/25)\n| Company Type | Rate |\n|---|---|\n| Standard companies | **22%** |\n| Financial institutions | **30%** |\n| Approved manufacturing | **15%** |\n| IFSC companies | **15%** |\n\n## Filing Deadline\n- CIT return and payment due **4 months** after the company's financial year end.\n- Provisional tax paid in **two instalments**: 6 months and 9 months into the tax year.\n\n## Penalties\n- Late filing: **BWP 2,000** fixed penalty\n- Late payment: **1.5% per month** interest on outstanding tax\n\n## Useful Tool\nUse BURS's **e-Services portal** to file your CIT return online and pay via EFT.`,
    tags: ["CIT", "corporate tax", "BURS", "company"],
    reading_time_minutes: 4,
    published_at: "2024-02-15T00:00:00Z",
  },
];