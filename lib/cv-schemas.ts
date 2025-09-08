import { z } from 'zod';

// Personal Info Step
export const personalInfoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  location: z.string().min(1, 'Location is required'),
  summary: z.string().optional(),
});

// Education Step
export const educationSchema = z.object({
  education: z.array(z.object({
    institution: z.string().min(1, 'Institution is required'),
    degree: z.string().min(1, 'Degree is required'),
    field: z.string().min(1, 'Field of study is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
    description: z.string().optional(),
  })).min(1, 'At least one education entry is required'),
});

// Experience Step
export const experienceSchema = z.object({
  experience: z.array(z.object({
    company: z.string().min(1, 'Company is required'),
    position: z.string().min(1, 'Position is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    current: z.boolean().default(false),
    description: z.string().optional(),
    bullets: z.array(z.string()).default([]),
  })).default([]),
});

// Projects Step
export const projectsSchema = z.object({
  projects: z.array(z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().min(1, 'Description is required'),
    technologies: z.array(z.string()).default([]),
    url: z.string().optional(),
    bullets: z.array(z.string()).default([]),
  })).default([]),
});

// Skills Step
export const skillsSchema = z.object({
  skills: z.object({
    technical: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([]),
  }),
});

// Complete CV Schema
export const cvSchema = z.object({
  ...personalInfoSchema.shape,
  ...educationSchema.shape,
  ...experienceSchema.shape,
  ...projectsSchema.shape,
  ...skillsSchema.shape,
  template: z.enum(['minimal', 'modern', 'creative']).default('minimal'),
  language: z.enum(['en', 'ar']).default('en'),
});

export type PersonalInfo = z.infer<typeof personalInfoSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Projects = z.infer<typeof projectsSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type CVData = z.infer<typeof cvSchema>;
