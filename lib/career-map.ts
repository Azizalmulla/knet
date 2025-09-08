// Exact mapping provided by the USER. Do NOT alter wording.
export const careerMapRows = [
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Operations",
    "Suggested Vacancies": "Bank Operations"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Operations",
    "Suggested Vacancies": "Payment Operations/Core Operations"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Customer Care",
    "Suggested Vacancies": "Customer Care/Disputes Management/Customer Experience Management"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Business Development",
    "Suggested Vacancies": "Business Relationship"
  },
  {
    "Field of Study": "Media/Marketing/PR",
    "Area of Interest": "Marketing",
    "Suggested Vacancies": "Marketing"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "Digital Transformation & Innovation",
    "Suggested Vacancies": "Business Intellegence"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Digital Transformation & Innovation",
    "Suggested Vacancies": "Innovation/Digital Transformation"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Digital Transformation & Innovation",
    "Suggested Vacancies": "Innovation/Digital Transformation/Business Intellegence"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "Finance\u00a0",
    "Suggested Vacancies": "Finance/Accounting"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "Supply Chain",
    "Suggested Vacancies": "Procurement and Inventory Management"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Supply Chain",
    "Suggested Vacancies": "Vendor Management"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "HR",
    "Suggested Vacancies": "Human Resources"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "HR",
    "Suggested Vacancies": "Human Resources"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Project Management\u00a0",
    "Suggested Vacancies": "Project Development"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Project Management\u00a0",
    "Suggested Vacancies": "Project Development"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "Strategy",
    "Suggested Vacancies": "Strategy"
  },
  {
    "Field of Study": "Business Management",
    "Area of Interest": "Strategy",
    "Suggested Vacancies": "Strategy"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Audit",
    "Suggested Vacancies": "IT Aduit"
  },
  {
    "Field of Study": "Finance and Accounting",
    "Area of Interest": "Audit",
    "Suggested Vacancies": "Finance Audit"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Risk Management",
    "Suggested Vacancies": "Operational Risk/technology Risk/Business Continuity"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Information Security",
    "Suggested Vacancies": "Information Security/Cyber Security"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Fraud Management ",
    "Suggested Vacancies": "Transaction Fraud/Enterprise Fraud"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "IT",
    "Suggested Vacancies": "Development/System Excellence/Application Support/Network Management/Data & Server Management/IT Support Center"
  },
  {
    "Field of Study": "Computer Engineering/Computer Science/Technology",
    "Area of Interest": "Security Operations ",
    "Suggested Vacancies": "Network Security/Application Security"
  },
  {
    "Field of Study": "Others ",
    "Area of Interest": "(as per the ebove)",
    "Suggested Vacancies": "(to be as er the area of interest and suggested vacancy)"
  }
];

export function getFields(): string[] {
  return Array.from(new Set(careerMapRows.map(r => r["Field of Study"])));
}

export function getAreasForField(field: string): string[] {
  return Array.from(
    new Set(
      careerMapRows
        .filter(r => r["Field of Study"] === field)
        .map(r => r["Area of Interest"]) 
    )
  );
}

export function matchSuggestedVacancies(field: string, area: string): string | null {
  const row = careerMapRows.find(r => r["Field of Study"] === field && r["Area of Interest"] === area);
  return row ? row["Suggested Vacancies"] : null;
}

export function findRowForAudit(field: string, area: string): typeof careerMapRows[0] | null {
  return careerMapRows.find(r => r["Field of Study"] === field && r["Area of Interest"] === area) || null;
}
