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
    date_format_hint: 'Format: month/year',
    ai_wait_message: 'Wait 10s...',
    missing_label: 'Missing',
    go_fix: 'Go fix',
    
    // Global
    lang_en: "EN",
    lang_ar: "AR",

    // Landing Page
    hero_title_line1: "Careers made smarter.",
    hero_title_line2: "Hiring made easier.",
    hero_subtitle: "Redefining how careers and hiring work: smarter CVs, effortless submissions, and AI-powered tools for the modern workforce.",
    enter_app: "Enter App",
    career_dashboard: "Career Dashboard",
    job_finder: "Smart Job Search",
    privacy_first: "Privacy-first",
    bilingual_ready: "Bilingual-ready",
    secure_storage: "Secure storage",
    contact: "Contact",
    admin_login: "Admin Login",
    get_to_know: "Get to know Wathefni AI",
    company_name: "Wathefni AI",
    
    // Benefits
    ai_cv_builder_benefit: "AI CV Builder",
    ai_cv_builder_desc: "Create a polished, ATS-friendly CV in minutes.",
    instant_parsing: "Instant parsing",
    instant_parsing_desc: "We extract your info and surface key skills.",
    privacy_first_benefit: "Privacy-first",
    privacy_first_desc: "Your data stays secure and under your control.",
    
    // Audience sections
    choose_your_path: "Choose your path",
    choose_path_desc: "Two ways to get value from Wathefni AI. No extra fluff.",
    students: "Students",
    students_desc: "Build professional CVs with AI, browse jobs, and apply to multiple companies at once. 100% free.",
    ai_cv_improvements: "AI CV improvements",
    browse_jobs: "Browse 100+ jobs",
    multi_company_apply: "Multi-company apply",
    start_as_student: "Start as Student",
    hr_teams: "HR Teams",
    hr_teams_desc: "Post jobs, find qualified candidates with AI, and manage applications in one dashboard.",
    post_job_openings: "Post job openings",
    ai_recruiting_agent: "AI recruiting agent",
    track_applications: "Track applications",
    talk_to_ai_recruiter: "Talk to Your AI Recruiter",
    ai_recruiter_example: "Find senior developers with React and Node.js experience",
    ranks_candidates: "Ranks candidates",
    sends_emails: "Sends emails",
    natural_language: "Natural language",
    for_hr_teams: "For HR Teams",
    how_it_works: "How Wathefni AI works",
    
    // Student Login
    welcome_to: "Welcome to Wathefni AI",
    sign_in_to_manage: "Sign in to manage your applications",
    continue_with_google: "Continue with Google",
    continue_with_microsoft: "Continue with Microsoft",
    or_continue_with: "Or continue with",
    email_address: "Email address",
    send_magic_link: "Send Magic Link",
    by_signing_in: "By signing in, you agree to our",
    terms_of_service: "Terms of Service",
    and: "and",
    privacy_policy: "Privacy Policy",
    are_you_admin: "Are you an admin?",
    go_to_admin_login: "Go to admin login",
    access_denied: "Access was denied. Please try again.",
    error_during_signin: "An error occurred during sign in",
    failed_to_send_magic_link: "Failed to send magic link",
    check_email_for_link: "Check your email for a sign-in link!",
    something_went_wrong: "Something went wrong. Please try again.",
    failed_to_sign_in: "Failed to sign in",
    
    // Start (Student dashboard landing)
    student_dashboard: "Student Dashboard",
    home: "Home",
    build_cv_title: "Build a standout CV with Wathefni AI",
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
      "Your CV and personal information are processed for career matching and job recommendation purposes. Data is retained for 12 months and accessible only to authorized staff. You may request export or deletion of your data by contacting {email}. By proceeding, you consent to this processing under applicable data protection regulations.",

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
    // Experience & Projects header/microcopy
    experience_projects_title: "Experience & Projects",
    experience_projects_subtitle: "Add your work experience and project accomplishments",

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
    jd_helper: "Paste a job description only if you want AI to tailor your wording.",
    smart_assist_helper: "Polishes wording and expands bullets without adding new facts.",
    complete_field_selection: "Complete field selection",
    submit_to_knet: "Submit CV",
    // Profile classification (Review step)
    profile_classification_required: "Profile Classification (Required)",
    degree_watheefti: "Degree",
    yoe_watheefti: "Years of Experience",
    aoi_watheefti: "Area of Interest",
    select_degree: "Select degree",
    select_yoe: "Select years of experience",
    select_area: "Select area of interest",
    please_choose_option: "Please choose an option",

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
    edu_gpa: "GPA",
    edu_description: "Description",
    edu_currently_studying: "I'm currently studying",
    edu_add_education: "Add Education",
    edu_institution_placeholder: "University of Technology",
    edu_degree_placeholder: "Bachelor of Science in Computer Science",
    edu_field_placeholder: "Computer Science",
    edu_start_placeholder: "2020-09",
    edu_end_placeholder: "2024-05",
    edu_description_placeholder: "Relevant coursework, achievements, honors...",
    edu_gpa_achievements_label: "Add GPA & Achievements (optional)",
    edu_achievements_placeholder: "Dean’s List, Honors in Math, Senior Project on AI.",

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
    type_label: "Type",
    work_experience_option: "Work Experience",
    project_option: "Project",
    add_example_project: "Add Example Project",
    has_url: "Has URL",
    exp_company_placeholder: "Tech Corp",
    exp_position_placeholder: "Software Engineer",
    exp_start_placeholder: "2020-01",
    exp_end_placeholder: "2023-12 or Present",
    exp_description_placeholder: "What did you do and why it mattered? e.g., Built React components, worked with designers, reduced page load by ~30%.",

    // Wizard field labels (Projects)
    proj_name: "Project Name",
    proj_url: "URL (Optional)",
    proj_description: "Description",
    proj_current: "Currently ongoing",
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
    allowed_file_types: "Allowed file types: PDF, DOC/DOCX, JPG, PNG",
    file_too_large: "File size must be less than 10MB",
    date_range_invalid: "End date must be after start date",

    // Upload Page
    upload_title: "Upload Your CV",
    upload_subtitle: "Upload your existing CV and we'll suggest relevant vacancies based on your field of study and interests.",
    label_full_name: "Full Name",
    label_email: "Email",
    label_phone: "Phone",
    label_field_of_study: "Field of Study",
    label_area_of_interest: "Area of Interest",
    label_cv_upload: "CV Upload (PDF)",
    label_gpa: "GPA",
    placeholder_gpa: "e.g., 3.50",
    placeholder_full_name: "John Doe",
    placeholder_email: "john@mail.com",
    placeholder_phone: "+965 1234 5678",
    placeholder_select_field: "Select field",
    placeholder_select_interest: "Select interest",
    suggested_vacancies_title: "Suggested Vacancies",
    invalid_combo: "Invalid combination: No suggested vacancies found for this Field of Study and Area of Interest.",
    privacy_notice_upload_title: "Privacy Notice",
    privacy_notice_upload_p1: "By submitting your CV, you consent to Wathefni AI storing your personal information and CV data for up to 12 months for recruitment purposes.",
    privacy_notice_upload_p2: "For privacy inquiries, data deletion requests, or to exercise your GDPR rights, contact us.",
    submit_cv: "Submit CV",
    uploading: "Uploading...",
    complete_all_fields: "Complete all fields with valid suggestions",
    success_title: "CV Uploaded Successfully!",
    success_subtitle: "Your CV has been submitted successfully.",
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
    new_this_week: "New This Week",
    recent_uploads_7d: "Recent Uploads (7d)",
    parsed_today: "Parsed Today",
    inbox_unread: "Inbox Unread",
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

    // Global actions
    back: "Back",
    cancel: "Cancel",

    // Header tabs
    student_cvs: "Student CVs",
    ai_agent: "AI Agent",

    // Telemetry
    events_today: "Events Today",
    loading_telemetry: "Loading telemetry…",
    no_events_today: "No events recorded today yet.",

    // Chat UI
    role_you: "You",
    role_ai_agent: "AI Agent",
    role_system: "System",
    project_highlights: "Project Highlights",
    copy_shortlist: "Copy shortlist",
    thinking: "Thinking...",
    chat_placeholder: "Ask anything… (Shift+Enter for new line)",
    gpa: "GPA",
    experience: "Experience",
    score: "Score",
    ai_found_matches: "Found matching candidates",
    raw_label: "Raw:",

    // Auth messages
    too_many_attempts: "Too many login attempts",
    login_failed: "Login failed",

    // Quick replies
    quick_cs_high_gpa: "CS students with GPA > 3.5",
    quick_recent_webdev: "Recent Web Dev grads",
    quick_with_internships: "With internships",
  },
  ar: {
    // Common
    loading: 'جاري التحميل...',
    date_format_hint: 'التنسيق: شهر/سنة',
    ai_wait_message: 'انتظر 10 ثوانٍ... ',
    missing_label: 'مفقود',
    go_fix: 'إصلاح',

    // Global
    lang_en: "إنجليزي",
    lang_ar: "عربي",

    // Landing Page
    hero_title_line1: "مسارات مهنية أذكى.",
    hero_title_line2: "توظيف أسهل.",
    hero_subtitle: "إعادة تعريف كيفية عمل المسارات المهنية والتوظيف: سير ذاتية أذكى، تقديمات سلسة، وأدوات مدعومة بالذكاء الاصطناعي للقوى العاملة الحديثة.",
    enter_app: "دخول التطبيق",
    career_dashboard: "لوحة المسار المهني",
    job_finder: "البحث الذكي عن وظائف",
    privacy_first: "الخصوصية أولاً",
    bilingual_ready: "ثنائي اللغة",
    secure_storage: "تخزين آمن",
    contact: "تواصل معنا",
    admin_login: "تسجيل دخول المسؤول",
    get_to_know: "تعرف على Wathefni AI",
    company_name: "Wathefni AI",
    
    // Benefits
    ai_cv_builder_benefit: "منشئ السيرة الذاتية بالذكاء الاصطناعي",
    ai_cv_builder_desc: "أنشئ سيرة ذاتية احترافية متوافقة مع ATS في دقائق.",
    instant_parsing: "تحليل فوري",
    instant_parsing_desc: "نستخرج معلوماتك ونبرز المهارات الرئيسية.",
    privacy_first_benefit: "الخصوصية أولاً",
    privacy_first_desc: "بياناتك آمنة وتحت سيطرتك.",
    
    // Audience sections
    choose_your_path: "اختر مسارك",
    choose_path_desc: "طريقتان للاستفادة من Wathefni AI. بدون تعقيدات.",
    students: "الطلاب",
    students_desc: "أنشئ سيرة ذاتية احترافية بالذكاء الاصطناعي، تصفح الوظائف، وقدّم لعدة شركات دفعة واحدة. مجاني 100%.",
    ai_cv_improvements: "تحسينات السيرة الذاتية بالذكاء الاصطناعي",
    browse_jobs: "تصفح أكثر من 100 وظيفة",
    multi_company_apply: "التقديم لعدة شركات",
    start_as_student: "ابدأ كطالب",
    hr_teams: "فرق الموارد البشرية",
    hr_teams_desc: "انشر الوظائف، ابحث عن المرشحين المؤهلين بالذكاء الاصطناعي، وأدر الطلبات من لوحة واحدة.",
    post_job_openings: "نشر الوظائف",
    ai_recruiting_agent: "وكيل التوظيف بالذكاء الاصطناعي",
    track_applications: "تتبع الطلبات",
    talk_to_ai_recruiter: "تحدث مع وكيل التوظيف الذكي",
    ai_recruiter_example: "ابحث عن مطورين كبار لديهم خبرة في React و Node.js",
    ranks_candidates: "يرتب المرشحين",
    sends_emails: "يرسل رسائل البريد",
    natural_language: "لغة طبيعية",
    for_hr_teams: "لفرق الموارد البشرية",
    how_it_works: "كيف يعمل Wathefni AI",
    
    // Student Login
    welcome_to: "مرحباً بك في Wathefni AI",
    sign_in_to_manage: "سجّل الدخول لإدارة طلباتك",
    continue_with_google: "المتابعة مع Google",
    continue_with_microsoft: "المتابعة مع Microsoft",
    or_continue_with: "أو المتابعة مع",
    email_address: "عنوان البريد الإلكتروني",
    send_magic_link: "إرسال رابط الدخول",
    by_signing_in: "بتسجيل الدخول، فإنك توافق على",
    terms_of_service: "شروط الخدمة",
    and: "و",
    privacy_policy: "سياسة الخصوصية",
    are_you_admin: "هل أنت مسؤول؟",
    go_to_admin_login: "انتقل لتسجيل دخول المسؤول",
    access_denied: "تم رفض الوصول. يرجى المحاولة مرة أخرى.",
    error_during_signin: "حدث خطأ أثناء تسجيل الدخول",
    failed_to_send_magic_link: "فشل إرسال رابط الدخول",
    check_email_for_link: "تحقق من بريدك الإلكتروني للحصول على رابط الدخول!",
    something_went_wrong: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    failed_to_sign_in: "فشل تسجيل الدخول",

    // Start (Student dashboard landing)
    student_dashboard: "لوحة الطالب",
    home: "الرئيسية",
    build_cv_title: "أنشئ سيرة ذاتية مميزة مع Wathefni AI",
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
      "تُستخدم سيرتك الذاتية ومعلوماتك الشخصية لأغراض المواءمة الوظيفية والتوصية بالوظائف. تُحتفظ البيانات لمدة 12 شهرًا وتكون متاحة فقط للموظفين المخوّلين. يمكنك طلب تصدير أو حذف بياناتك عبر {email}. بالمتابعة، فإنك توافق على هذه المعالجة وفقًا للوائح حماية البيانات المعمول بها.",

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
    // Experience & Projects header/microcopy
    experience_projects_title: "الخبرات والمشاريع",
    experience_projects_subtitle: "أضف خبراتك العملية وإنجازات مشاريعك",

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
    jd_helper: "الصق وصفًا وظيفيًا فقط إذا كنت تريد من الذكاء الاصطناعي تحسين صياغتك.",
    smart_assist_helper: "يحسن الصياغة ويُوسّع النقاط دون إضافة حقائق جديدة.",
    complete_field_selection: "أكمل اختيار الحقول",
    submit_to_knet: "إرسال السيرة الذاتية",
    // Profile classification (Review step)
    profile_classification_required: "تصنيف الملف (إلزامي)",
    degree_watheefti: "المؤهل",
    yoe_watheefti: "سنوات الخبرة",
    aoi_watheefti: "مجال الاهتمام",
    select_degree: "اختر المؤهل",
    select_yoe: "اختر سنوات الخبرة",
    select_area: "اختر مجال الاهتمام",
    please_choose_option: "يرجى اختيار خيار",

    // Wizard field labels (Personal)
    label_location: "الموقع",
    label_summary: "الملخص المهني",
    placeholder_location: "مدينة الكويت، الكويت",
    placeholder_summary: "نظرة عامة موجزة عن خلفيتك المهنية وأهدافك الوظيفية...",

    // Wizard field labels (Education)
    edu_institution: "المؤسسة التعليمية",
    edu_degree: "الدرجة العلمية",
    edu_field: "مجال الدراسة",
    edu_start_date: "تاريخ البدء",
    edu_end_date: "تاريخ الانتهاء",
    edu_gpa: "المعدل التراكمي",
    edu_description: "الوصف",
    edu_currently_studying: "أدرس حاليًا",
    edu_add_education: "إضافة تعليم",

    // Wizard field placeholders (Education)
    edu_institution_placeholder: "جامعة التكنولوجيا",
    edu_degree_placeholder: "بكالوريوس علوم الحاسوب",
    edu_field_placeholder: "علوم الحاسوب",
    edu_start_placeholder: "2020-09",
    edu_end_placeholder: "2024-05",
    edu_description_placeholder: "مقررات ذات صلة، إنجازات، تكريم...",
    edu_gpa_achievements_label: "أضف المعدل والإنجازات (اختياري)",
    edu_achievements_placeholder: "قائمة الشرف، تكريم في الرياضيات، مشروع التخرج في الذكاء الاصطناعي.",

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
    allowed_file_types: "الملفات المسموح بها: PDF و DOC/DOCX و JPG و PNG",
    file_too_large: "يجب أن يكون حجم الملف أقل من 10 ميجابايت",
    date_range_invalid: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء",

    // Upload Page
    upload_title: "تحميل السيرة الذاتية",
    upload_subtitle: "قم بتحميل سيرتك الذاتية الحالية وسنقترح شواغر مناسبة بناءً على تخصصك واهتماماتك.",
    label_full_name: "الاسم الكامل",
    label_email: "البريد الإلكتروني",
    label_phone: "رقم الهاتف",
    label_field_of_study: "مجال الدراسة",
    label_area_of_interest: "مجال الاهتمام",
    label_cv_upload: "رفع السيرة الذاتية (PDF)",
    label_gpa: "المعدل التراكمي",
    placeholder_gpa: "مثال: 3.50",
    placeholder_full_name: "أحمد محمد",
    placeholder_email: "ahmad@mail.com",
    placeholder_phone: "+965 1234 5678",
    placeholder_select_field: "اختر المجال",
    placeholder_select_interest: "اختر المجال الفرعي",
    suggested_vacancies_title: "الوظائف المقترحة",
    invalid_combo: "تركيبة غير صالحة: لا توجد وظائف مقترحة لهذا المجال ومجال الاهتمام.",
    privacy_notice_upload_title: "إشعار الخصوصية",
    privacy_notice_upload_p1: "بإرسال سيرتك الذاتية، فإنك توافق على احتفاظ Wathefni AI بمعلوماتك الشخصية وبيانات سيرتك لمدة تصل إلى 12 شهرًا لأغراض التوظيف.",
    privacy_notice_upload_p2: "للاستفسارات المتعلقة بالخصوصية أو طلبات حذف البيانات، تواصل معنا.",
    submit_cv: "إرسال السيرة الذاتية",
    uploading: "جاري الرفع...",
    complete_all_fields: "أكمل جميع الحقول مع اقتراحات صالحة",
    success_title: "تم رفع السيرة الذاتية بنجاح!",
    success_subtitle: "تم إرسال سيرتك الذاتية بنجاح.",
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
    new_this_week: "جديد هذا الأسبوع",
    recent_uploads_7d: "عمليات الرفع خلال 7 أيام",
    parsed_today: "تم التحليل اليوم",
    inbox_unread: "الرسائل غير المقروءة",
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
    exp_current: "أعمل هنا حاليًا",
    exp_company: "الشركة",
    exp_position: "المسمى الوظيفي",
    exp_start_date: "تاريخ البدء",
    exp_end_date: "تاريخ الانتهاء",
    proj_current: "مستمر حاليًا",
    type_label: "النوع",
    work_experience_option: "خبرة عملية",
    project_option: "مشروع",
    add_example_project: "إضافة مشروع مثال",
    has_url: "يحتوي على رابط",
    proj_url: "الرابط (اختياري)",
    // Wizard field placeholders (Experience)
    exp_company_placeholder: "شركة تقنية",
    exp_position_placeholder: "مهندس برمجيات",
    exp_start_placeholder: "2020-01",
    exp_end_placeholder: "2023-12 أو الآن",
    exp_description_placeholder: "ماذا فعلت ولماذا كان ذلك مهمًا؟ مثال: بناء مكونات React، التعاون مع المصممين، تقليل وقت التحميل ~30%.",
    exp_raw_description: "الوصف الخام",
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
      // Also set body class for font switching
      document.body.classList.remove('lang-en', 'lang-ar');
      document.body.classList.add(`lang-${lang}`);
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", l);
      // Add/remove lang class and dir attribute on body
      document.body.classList.remove('lang-en', 'lang-ar');
      document.body.classList.add(`lang-${l}`);
      document.documentElement.setAttribute('lang', l);
      document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
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

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
