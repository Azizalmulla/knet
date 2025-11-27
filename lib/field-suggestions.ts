// Common field of study suggestions for autocomplete
// Users can still type anything they want

// Grouped fields of study for better UX
export const GROUPED_FIELDS_OF_STUDY = {
  "💻 Technology": [
    "Computer Science",
    "Information Technology",
    "Software Engineering",
    "Data Science",
    "Cybersecurity",
    "Information Systems",
  ],
  "🏗️ Engineering": [
    "Civil Engineering",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Chemical Engineering",
    "Petroleum Engineering",
    "Industrial Engineering",
    "Aerospace Engineering",
    "Biomedical Engineering",
  ],
  "💼 Business & Economics": [
    "Business Administration",
    "Business Management",
    "Finance",
    "Accounting",
    "Economics",
    "Marketing",
    "International Business",
    "Entrepreneurship",
  ],
  "🏥 Health Sciences": [
    "Medicine",
    "Nursing",
    "Pharmacy",
    "Dentistry",
    "Public Health",
    "Physical Therapy",
    "Medical Laboratory Science",
  ],
  "🔬 Sciences": [
    "Biology",
    "Chemistry",
    "Physics",
    "Mathematics",
    "Environmental Science",
    "Geology",
  ],
  "📚 Arts & Humanities": [
    "English Literature",
    "Psychology",
    "Political Science",
    "Sociology",
    "History",
    "Philosophy",
  ],
  "⚖️ Law": [
    "Law",
    "Legal Studies",
    "Sharia Law",
  ],
  "🎓 Education": [
    "Education",
    "Early Childhood Education",
    "Special Education",
  ],
  "📺 Media & Design": [
    "Mass Communication",
    "Journalism",
    "Public Relations",
    "Media Studies",
    "Graphic Design",
    "Architecture",
    "Interior Design",
  ],
  "📦 Other": [
    "Others",
  ],
};

// Flat list for backwards compatibility
export const COMMON_FIELDS_OF_STUDY = Object.values(GROUPED_FIELDS_OF_STUDY).flat();

// Grouped areas of interest for better UX
export const GROUPED_AREAS_OF_INTEREST = {
  "💻 Technology": [
    "Software Development",
    "Web Development",
    "Mobile Development",
    "Data Science",
    "Data Analysis",
    "Cybersecurity",
    "Cloud Computing",
    "DevOps",
    "IT Support",
    "Network Administration",
  ],
  "💼 Business & Management": [
    "Business Development",
    "Project Management",
    "Product Management",
    "Operations Management",
    "Supply Chain Management",
    "Quality Assurance",
    "Strategy",
    "Consulting",
  ],
  "💰 Finance & Accounting": [
    "Finance",
    "Accounting",
    "Financial Analysis",
    "Investment Banking",
    "Audit",
    "Tax",
  ],
  "📢 Marketing & Sales": [
    "Marketing",
    "Digital Marketing",
    "Social Media Marketing",
    "Content Marketing",
    "Sales",
    "Brand Management",
  ],
  "👥 Human Resources": [
    "Human Resources",
    "Talent Acquisition",
    "Training & Development",
    "HR Operations",
  ],
  "🎧 Customer Service": [
    "Customer Service",
    "Customer Experience",
    "Customer Support",
    "Client Relations",
  ],
  "🏥 Healthcare": [
    "Healthcare",
    "Clinical Practice",
    "Medical Research",
    "Public Health",
    "Healthcare Administration",
  ],
  "🏗️ Engineering": [
    "Engineering",
    "R&D",
    "Manufacturing",
    "Construction",
    "Maintenance",
  ],
  "⚖️ Legal": [
    "Legal",
    "Corporate Law",
    "Litigation",
    "Compliance",
  ],
  "🎓 Education": [
    "Teaching",
    "Training",
    "Education",
    "Curriculum Development",
  ],
  "🎨 Creative & Design": [
    "Graphic Design",
    "UI/UX Design",
    "Video Production",
    "Content Creation",
  ],
  "📦 Other": [
    "Other",
  ],
};

// Flat list for backwards compatibility
export const COMMON_AREAS_OF_INTEREST = Object.values(GROUPED_AREAS_OF_INTEREST).flat();

// Smart linking: suggest relevant areas based on field of study
export const FIELD_TO_AREA_MAP: Record<string, string[]> = {
  "Computer Science": ["Software Development", "Web Development", "Mobile Development", "Data Science", "Cybersecurity"],
  "Information Technology": ["IT Support", "Network Administration", "Cybersecurity", "Cloud Computing", "DevOps"],
  "Software Engineering": ["Software Development", "Web Development", "Mobile Development", "DevOps", "Quality Assurance"],
  "Data Science": ["Data Science", "Data Analysis", "Business Intelligence", "Machine Learning"],
  "Business Administration": ["Business Development", "Project Management", "Operations Management", "Strategy", "Consulting"],
  "Finance": ["Finance", "Financial Analysis", "Investment Banking", "Accounting"],
  "Accounting": ["Accounting", "Audit", "Tax", "Finance"],
  "Marketing": ["Marketing", "Digital Marketing", "Social Media Marketing", "Brand Management", "Sales"],
  "Medicine": ["Clinical Practice", "Medical Research", "Healthcare", "Public Health"],
  "Law": ["Legal", "Corporate Law", "Litigation", "Compliance"],
  "Engineering": ["Engineering", "R&D", "Manufacturing", "Construction"],
  "Education": ["Teaching", "Training", "Education", "Curriculum Development"],
};
