"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Lang = "en" | "ar";

type Dict = Record<string, string>;

type Translations = Record<Lang, Dict>;

const translations: Translations = {
  en: {
    // Common
    ai_complete_button: 'Use AI to Complete (fill missing sections)',
    ai_improve_button: 'Use AI to Improve (polish for recruiters)',
    loading: 'Loading...',
    
    // Global
    lang_en: "EN",
    lang_ar: "AR",

    // Start (Student dashboard landing)
    student_dashboard: "Student Dashboard",
    home: "Home",
    build_cv_title: "Build a standout CV with KNET",
    build_cv_subtitle:
      "Choose an option below to upload your existing CV or let AI help you craft an ATS-friendly one. You can always manage submissions from the admin dashboard.",
    upload_your_cv: "Upload Your CV",
    upload_pdf: "Upload PDF",
    ai_cv_builder: "AI CV Builder",
    start_building: "Start Building",
    admin_dashboard: "Admin Dashboard",
    admin_dashboard_desc: "Review submissions, filter by field/interest, and download CVs.",
    privacy_notice: "Privacy Notice",
    privacy_text:
      "Your CV and personal information are processed by KNET for career matching and job recommendation purposes. Data is retained for 12 months and accessible only to authorized KNET staff. You may request export or deletion of your data by contacting {email}. By proceeding, you consent to this processing under Kuwait's data protection regulations.",

    // CV Builder Wizard
    ai_cv_builder_title: "AI CV Builder",
    step_personal: "Personal Info",
    step_education: "Education",
    step_experience: "Experience",
    step_projects: "Projects",
    step_skills: "Skills",
    step_review: "Review",
    step_indicator: "Step {current} of {total}",
    previous: "Previous",
    next: "Next",
    complete: "Complete",

    // Review step controls
    customize_cv: "Customize Your CV",
    template_label: "Template",
    language_label: "Language",
    template_minimal: "Minimal",
    template_modern: "Modern",
    template_creative: "Creative",
    english: "English",
    arabic: "Arabic",
    export_pdf: "Export PDF",
    export_docx: "Export DOCX",
    exporting: "Exporting...",
    preview: "Preview",
    complete_field_selection: "Complete field selection",
    submit_to_knet: "Submit to KNET",

    // Wizard field labels (Personal)
    label_location: "Location",
    label_summary: "Professional Summary",
    placeholder_location: "Kuwait City, Kuwait",
    placeholder_summary: "Brief overview of your professional background and career objectives...",

    // Wizard field labels (Education)
    edu_institution: "Institution",
    edu_degree: "Degree",
    edu_field: "Field of Study",
    edu_start_date: "Start Date",
    edu_end_date: "End Date",
    edu_gpa: "GPA (Optional)",
    edu_description: "Description",
    edu_currently_studying: "I'm currently studying",
    edu_add_education: "Add Education",
    edu_institution_placeholder: "University of Technology",
    edu_degree_placeholder: "Bachelor of Science in Computer Science",
    edu_field_placeholder: "Computer Science",
    edu_start_placeholder: "2020-09",
    edu_end_placeholder: "2024-05",
    edu_description_placeholder: "Relevant coursework, achievements, honors...",

    // Wizard field labels (Experience)
    exp_company: "Company",
    exp_position: "Position",
    exp_start_date: "Start Date",
    exp_end_date: "End Date",
    exp_current: "Currently working here",
    exp_raw_description: "Raw Description",
    exp_generate_bullets: "Generate ATS Bullets",
    exp_generating: "Generating...",
    exp_generated_bullets: "Generated Bullet Points",
    exp_add_experience: "Add Experience",
    exp_company_placeholder: "Tech Corp",
    exp_position_placeholder: "Software Engineer",
    exp_start_placeholder: "2020-01",
    exp_end_placeholder: "2023-12 or Present",

    // Wizard field labels (Projects)
    proj_name: "Project Name",
    proj_url: "URL (Optional)",
    proj_description: "Description",
    proj_generate_bullets: "Generate ATS Bullets",
    proj_generating: "Generating...",
    proj_technologies: "Technologies",
    proj_add: "Add",
    proj_add_project: "Add Project",
    proj_generated_bullets: "Generated Bullet Points",
    proj_add_tech_placeholder: "Add technology",
    proj_name_placeholder: "My Awesome Project",
    proj_url_placeholder: "https://github.com/user/project",
    proj_description_placeholder: "Describe what the project does and your role...",

    // Wizard field labels (Skills)
    skills_technical_title: "Technical Skills",
    skills_languages_title: "Languages",
    skills_soft_title: "Soft Skills",
    skills_add: "Add",
    skills_technical_placeholder: "JavaScript, Python, React...",
    skills_languages_placeholder: "English (Native), Arabic (Fluent)...",
    skills_soft_placeholder: "Leadership, Communication, Problem Solving...",

    // Admin Dashboard misc
    hide_pii_row: "Hide PII for this row",
    show_pii_row: "Show PII for this row",

    // Draft restore
    draft_found: "Draft Found",
    draft_unsaved_from: "You have unsaved changes from {age}",
    restore: "Restore",
    dismiss: "Dismiss",
    filter_by_vacancy: "Filter by suggested vacancy...",

    // Generic validation
    required: "This field is required",
    invalid_email: "Invalid email format",
    phone_min_10: "Phone number must be at least 10 characters",
    cv_required: "CV file is required",
    pdf_only: "Only PDF files are allowed",

    // Upload Page
    upload_title: "Upload Your CV",
    upload_subtitle: "Upload your existing CV and we'll suggest relevant vacancies based on your field of study and interests.",
    label_full_name: "Full Name",
    label_email: "Email",
    label_phone: "Phone",
    label_field_of_study: "Field of Study",
    label_area_of_interest: "Area of Interest",
    label_cv_upload: "CV Upload (PDF)",
    placeholder_full_name: "John Doe",
    placeholder_email: "john@mail.com",
    placeholder_phone: "+965 1234 5678",
    placeholder_select_field: "Select field",
    placeholder_select_interest: "Select interest",
    suggested_vacancies_title: "Suggested Vacancies",
    invalid_combo: "Invalid combination: No suggested vacancies found for this Field of Study and Area of Interest.",
    privacy_notice_upload_title: "Privacy Notice",
    privacy_notice_upload_p1: "By submitting your CV, you consent to KNET storing your personal information and CV data for up to 12 months for recruitment purposes.",
    privacy_notice_upload_p2: "For privacy inquiries, data deletion requests, or to exercise your GDPR rights, contact us.",
    submit_cv: "Submit CV",
    uploading: "Uploading...",
    complete_all_fields: "Complete all fields with valid suggestions",
    success_title: "CV Uploaded Successfully!",
    success_subtitle: "Your CV has been submitted to KNET.",
    back_to_dashboard: "Back to Dashboard",

    // Admin Dashboard
    admin_dashboard_subtitle: "Manage student CV submissions and downloads.",
    filters: "Filters",
    search_placeholder: "Search by name or email...",
    all_fields: "All Fields",
    all_interests: "All Interests",
    label_cv_type: "CV Type",
    all_types: "All Types",
    uploaded: "Uploaded",
    ai_generated: "AI Generated",
    clear_filters: "Clear Filters",
    export_csv: "Export CSV",
    privacy_mode: "Privacy Mode",
    pii_visible: "PII Visible",
    pii_masked: "PII Masked",
    show_pii: "Show PII",
    hide_pii: "Hide PII",
    total_submissions: "Total Submissions",
    uploaded_cvs: "Uploaded CVs",
    ai_generated_cvs: "AI Generated CVs",
    filtered_results: "Filtered Results",
    table_name: "Name",
    table_email: "Email",
    table_phone: "Phone",
    table_field: "Field",
    table_interest: "Interest",
    table_suggested_vacancies: "Suggested Vacancies",
    table_cv_type: "CV Type",
    table_submitted: "Submitted",
    table_actions: "Actions",
    download: "Download",
    no_students_found: "No students found matching your criteria.",
    student_submissions: "Student Submissions",

    // Admin Login
    admin_access: "Admin Access",
    admin_enter_key: "Enter your admin key to access the dashboard",
    admin_invalid_key: "Invalid key",
    admin_connection_failed: "Connection failed",
    admin_access_button: "Access Dashboard",
    admin_logout: "Logout",
    admin_loading: "Loading...",
    admin_session_expired: "Session expired due to inactivity. Please log in again.",
    enter_admin_key: "Enter admin key",
    admin_authenticating: "Authenticating...",
    system_error: "System Error",
    admin_error_message: "Something went wrong with the admin dashboard.",
    reload_page: "Reload Page",
  },
  ar: {
    // Common
    loading: 'جاري التحميل...',

    // Global
    lang_en: "إنجليزي",
    lang_ar: "عربي",

    // Start (Student dashboard landing)
    student_dashboard: "لوحة الطالب",
    home: "الرئيسية",
    build_cv_title: "أنشئ سيرة ذاتية مميزة مع KNET",
    build_cv_subtitle:
      "اختر خيارًا أدناه لتحميل سيرتك الذاتية أو دع الذكاء الاصطناعي يساعدك في صياغة سيرة متوافقة مع أنظمة التتبع. يمكنك دائمًا إدارة الطلبات من لوحة التحكم.",
    upload_your_cv: "تحميل السيرة الذاتية",
    upload_pdf: "رفع ملف PDF",
    ai_cv_builder: "منشئ السيرة الذاتية بالذكاء الاصطناعي",
    start_building: "ابدأ الآن",
    admin_dashboard: "لوحة التحكم",
    admin_dashboard_desc: "مراجعة الطلبات، التصفية حسب التخصص والاهتمام، وتنزيل السير الذاتية.",
    privacy_notice: "إشعار الخصوصية",
    privacy_text:
      "يتم استخدام سيرتك الذاتية ومعلوماتك الشخصية من قبل KNET لأغراض المواءمة الوظيفية والتوصية بالوظائف. تُحتفظ البيانات لمدة 12 شهرًا وتكون متاحة فقط لموظفي KNET المخوَّلين. يمكنك طلب تصدير أو حذف بياناتك عبر {email}. بالمتابعة، فإنك توافق على هذه المعالجة وفقًا للوائح حماية البيانات في الكويت.",

    // CV Builder Wizard
    ai_cv_builder_title: "منشئ السيرة الذاتية بالذكاء الاصطناعي",
    step_personal: "المعلومات الشخصية",
    step_education: "التعليم",
    step_experience: "الخبرات",
    step_projects: "المشاريع",
    step_skills: "المهارات",
    step_review: "المراجعة",
    step_indicator: "الخطوة {current} من {total}",
    previous: "السابق",
    next: "التالي",
    complete: "إنهاء",

    // Review step controls
    customize_cv: "خصّص سيرتك الذاتية",
    template_label: "القالب",
    language_label: "اللغة",
    template_minimal: "بسيط",
    template_modern: "حديث",
    template_creative: "إبداعي",
    english: "الإنجليزية",
    arabic: "العربية",
    export_pdf: "تصدير PDF",
    export_docx: "تصدير DOCX",
    exporting: "جاري التصدير...",
    preview: "المعاينة",
    complete_field_selection: "أكمل اختيار الحقول",
    submit_to_knet: "إرسال إلى KNET",

    // Draft restore
    draft_found: "تم العثور على مسودة",
    draft_unsaved_from: "لديك تغييرات غير محفوظة منذ {age}",
    restore: "استعادة",
    dismiss: "تجاهل",
    filter_by_vacancy: "تصفية حسب الوظيفة المقترحة...",

    // Generic validation
    required: "هذا الحقل مطلوب",
    invalid_email: "صيغة البريد الإلكتروني غير صحيحة",
    phone_min_10: "يجب أن يكون رقم الهاتف 10 أحرف على الأقل",
    cv_required: "ملف السيرة الذاتية مطلوب",
    pdf_only: "يسمح فقط بملفات PDF",

    // Upload Page
    upload_title: "تحميل السيرة الذاتية",
    upload_subtitle: "قم بتحميل سيرتك الذاتية الحالية وسنقترح شواغر مناسبة بناءً على تخصصك واهتماماتك.",
    label_full_name: "الاسم الكامل",
    label_email: "البريد الإلكتروني",
    label_phone: "رقم الهاتف",
    label_field_of_study: "مجال الدراسة",
    label_area_of_interest: "مجال الاهتمام",
    label_cv_upload: "رفع السيرة الذاتية (PDF)",
    placeholder_full_name: "أحمد محمد",
    placeholder_email: "ahmad@mail.com",
    placeholder_phone: "+965 1234 5678",
    placeholder_select_field: "اختر المجال",
    placeholder_select_interest: "اختر المجال الفرعي",
    suggested_vacancies_title: "الوظائف المقترحة",
    invalid_combo: "تركيبة غير صالحة: لا توجد وظائف مقترحة لهذا المجال ومجال الاهتمام.",
    privacy_notice_upload_title: "إشعار الخصوصية",
    privacy_notice_upload_p1: "بإرسال سيرتك الذاتية، فإنك توافق على احتفاظ KNET بمعلوماتك الشخصية وبيانات سيرتك لمدة تصل إلى 12 شهرًا لأغراض التوظيف.",
    privacy_notice_upload_p2: "للاستفسارات المتعلقة بالخصوصية أو طلبات حذف البيانات، تواصل معنا.",
    submit_cv: "إرسال السيرة الذاتية",
    uploading: "جاري الرفع...",
    complete_all_fields: "أكمل جميع الحقول مع اقتراحات صالحة",
    success_title: "تم رفع السيرة الذاتية بنجاح!",
    success_subtitle: "تم إرسال سيرتك الذاتية إلى KNET.",
    back_to_dashboard: "العودة للوحة الطالب",

    // Admin Dashboard
    admin_dashboard_subtitle: "إدارة طلبات السير الذاتية وتنزيلها.",
    filters: "الفلاتر",
    search_placeholder: "ابحث بالاسم أو البريد...",
    all_fields: "كل المجالات",
    all_interests: "كل الاهتمامات",
    label_cv_type: "نوع السيرة الذاتية",
    all_types: "كل الأنواع",
    uploaded: "مرفوعة",
    ai_generated: "مولدة بالذكاء الاصطناعي",
    clear_filters: "مسح التصفية",
    export_csv: "تصدير CSV",
    privacy_mode: "وضع الخصوصية",
    pii_visible: "إظهار البيانات الحساسة",
    pii_masked: "إخفاء البيانات الحساسة",
    show_pii: "إظهار البيانات الحساسة",
    hide_pii: "إخفاء البيانات الحساسة",
    total_submissions: "إجمالي الطلبات",
    uploaded_cvs: "السير المرفوعة",
    ai_generated_cvs: "السير المولدة بالذكاء الاصطناعي",
    filtered_results: "النتائج بعد التصفية",
    table_name: "الاسم",
    table_email: "البريد الإلكتروني",
    table_phone: "الهاتف",
    table_field: "المجال",
    table_interest: "الاهتمام",
    table_suggested_vacancies: "الوظائف المقترحة",
    table_cv_type: "نوع السيرة",
    table_submitted: "تاريخ التقديم",
    table_actions: "إجراءات",
    download: "تنزيل",
    no_students_found: "لا يوجد طلاب مطابقون لمعايير البحث.",
    student_submissions: "طلبات الطلاب",

    // AI Builder
    ai_complete_button: "استخدم الذكاء الاصطناعي للإكمال",
    ai_improve_button: "استخدم الذكاء الاصطناعي للتحسين",

    // Wizard field labels (Projects)
    proj_name: "اسم المشروع",
    proj_description: "الوصف",
    proj_generate_bullets: "توليد نقاط ATS",
    proj_generating: "جاري التوليد...",
    exp_generate_bullets: "توليد نقاط ATS",
    exp_generating: "جاري التوليد...",
    exp_generated_bullets: "النقاط المولدة",
    exp_add_experience: "إضافة خبرة",
    proj_technologies: "التقنيات",
    proj_add: "إضافة",
    proj_add_project: "إضافة مشروع",
    proj_generated_bullets: "نقاط مُولدة",
    proj_add_tech_placeholder: "أضف تقنية",
    proj_name_placeholder: "مشروعي المميز",
    proj_url_placeholder: "https://github.com/user/project",
    proj_description_placeholder: "صف ما يفعله المشروع ودورك فيه...",

    // Wizard field labels (Skills)
    skills_technical_title: "المهارات الفنية",
    skills_languages_title: "اللغات",
    skills_soft_title: "المهارات الناعمة",
    skills_add: "إضافة",
    skills_technical_placeholder: "JavaScript, Python, React...",
    skills_languages_placeholder: "الإنجليزية (الأصلية), العربية (الناطقة)...",
    skills_soft_placeholder: "القيادة, التواصل, حل المشكلات...",

  },
};

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "ar") {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", l);
    }
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const dict = translations[lang] || translations.en;
    let str = dict[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  };

  const value = useMemo(() => ({ lang, setLang, t }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
