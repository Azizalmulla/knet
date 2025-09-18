import { z } from 'zod';

// Personal Info Step
export const personalInfoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  location: z.string().min(1, 'Location is required'),
  summary: z.string().optional(),
});

// Education Step
export const educationSchema = z.object({
  education: z.array(z.object({
    institution: z.string().min(1, 'Institution is required'),
    degree: z.string().min(1, 'Degree is required'),
    fieldOfStudy: z.string().min(1, 'Field of study is required'),
    graduationDate: z.string().min(1, 'Graduation date is required'),
    endDate: z.string().optional(),
    currentlyStudying: z.boolean().default(false),
    gpa: z.string().optional(),
    description: z.string().optional(),
  })).min(1, 'At least one education entry is required'),
});

// Combined Experience & Projects Step
export const experienceProjectsSchema = z.object({
  experienceProjects: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('experience'),
      company: z.string().min(1, 'Required'),
      position: z.string().min(1, 'Required'),
      startDate: z.string().min(1, 'Required'),
      endDate: z.string().optional(),
      current: z.boolean().default(false),
      description: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    }),
    z.object({
      type: z.literal('project'),
      name: z.string().min(1, 'Required'),
      description: z.string().min(1, 'Required'),
      technologies: z.array(z.string()).default([]),
      url: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    }),
  ])).default([]),
});

// Legacy schemas for backwards compatibility
export const experienceSchema = z.object({
  experience: z.array(z.object({
    company: z.string().min(1, 'Required'),
    position: z.string().min(1, 'Required'),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().optional(),
    current: z.boolean().default(false),
    description: z.string().optional(),
    bullets: z.array(z.string()).default([]),
  })).default([]),
});

export const projectsSchema = z.object({
  projects: z.array(z.object({
    name: z.string().min(1, 'Required'),
    description: z.string().min(1, 'Required'),
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
  ...experienceProjectsSchema.shape,
  // Keep legacy fields for backwards compatibility
  experience: z.array(z.any()).default([]),
  projects: z.array(z.any()).default([]),
  ...skillsSchema.shape,
  template: z.enum(['minimal', 'modern', 'creative']).default('minimal'),
  language: z.enum(['en', 'ar']).default('en'),
});

// Groups of fields per step for targeted validation with trigger([...])
export const stepFields = {
  0: ['fullName', 'email', 'phone', 'location'] as const,
  1: ['education.0.institution', 'education.0.degree', 'education.0.fieldOfStudy', 'education.0.graduationDate'] as const,
  2: [] as const, // experienceProjects step - validation handled in component
  3: [] as const, // skills step
  4: [] as const, // review step
};

export type CVData = z.infer<typeof cvSchema>;

// Convenience: default values to avoid undefined making false errors
export const defaultCVValues: CVData = {
  fullName: '',
  email: '',
  phone: '+965 ',
  location: '',
  summary: '',
  education: [
    {
      institution: '',
      degree: '',
      fieldOfStudy: '',
      graduationDate: '',
      endDate: '',
      currentlyStudying: false,
      gpa: '',
      description: '',
    },
  ],
  experienceProjects: [],
  // Legacy fields for backwards compatibility
  experience: [],
  projects: [],
  skills: {
    technical: [],
    languages: [],
    soft: [],
  },
  template: 'minimal',
  language: 'en',
};

export type PersonalInfo = z.infer<typeof personalInfoSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Projects = z.infer<typeof projectsSchema>;
export type Skills = z.infer<typeof skillsSchema>;

// Factory to create a localized CV schema for client-side validation
export function createLocalizedCvSchema(t: (key: string) => string) {
  const localizedPersonal = z.object({
    fullName: z.string().min(1, t('required')),
    email: z.string().email(t('invalid_email')),
    phone: z.string().min(10, t('phone_min_10')),
    location: z.string().min(1, t('required')),
    summary: z.string().optional(),
  });

  const localizedEducation = z.object({
    education: z.array(z.object({
      institution: z.string().min(1, t('required')),
      degree: z.string().min(1, t('required')),
      fieldOfStudy: z.string().min(1, t('required')),
      graduationDate: z.string().min(1, t('required')),
      endDate: z.string().optional(),
      currentlyStudying: z.boolean().default(false),
      gpa: z.string().optional(),
      description: z.string().optional(),
    })).min(1, t('required')),
  });

  const localizedExperienceProjects = z.object({
    experienceProjects: z.array(z.discriminatedUnion('type', [
      z.object({
        type: z.literal('experience'),
        company: z.string().min(1, t('required')),
        position: z.string().min(1, t('required')),
        startDate: z.string().min(1, t('required')),
        endDate: z.string().optional(),
        current: z.boolean().default(false),
        description: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
      z.object({
        type: z.literal('project'),
        name: z.string().min(1, t('required')),
        description: z.string().min(1, t('required')),
        technologies: z.array(z.string()).default([]),
        url: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
    ])).default([]),
  });

  // Legacy schemas for backwards compatibility  
  const localizedExperience = z.object({
    experience: z.array(z.object({
      company: z.string().min(1, t('required')),
      position: z.string().min(1, t('required')),
      startDate: z.string().min(1, t('required')),
      endDate: z.string().optional(),
      current: z.boolean().default(false),
      description: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    })).default([]),
  });

  const localizedProjects = z.object({
    projects: z.array(z.object({
      name: z.string().min(1, t('required')),
      description: z.string().min(1, t('required')),
      technologies: z.array(z.string()).default([]),
      url: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    })).default([]),
  });

  const localizedSkills = skillsSchema; // no required messages here

  return z.object({
    ...localizedPersonal.shape,
    ...localizedEducation.shape,
    ...localizedExperienceProjects.shape,
    // Keep legacy fields for backwards compatibility
    experience: z.array(z.any()).default([]),
    projects: z.array(z.any()).default([]),
    ...localizedSkills.shape,
    template: z.enum(['minimal', 'modern', 'creative']).default('minimal'),
    language: z.enum(['en', 'ar']).default('en'),
  });
}
