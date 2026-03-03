export type ResumeContact = {
  id: string;
  resumeSourceId: string;
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedIn: string | null;
  website: string | null;
  summary: string | null;
};

export type ResumeEducation = {
  id: string;
  resumeSourceId: string;
  institution: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  gpa: string | null;
  honors: string | null;
  notes: string | null;
  sortOrder: number;
};

export type ResumeWorkSubsection = {
  id: string;
  workExperienceId: string;
  label: string;
  bullets: string[];
  sortOrder: number;
};

export type ResumeWorkExperience = {
  id: string;
  resumeSourceId: string;
  company: string;
  title: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  alternateTitles: string[];
  sortOrder: number;
  subsections: ResumeWorkSubsection[];
};

export type ResumeSkill = {
  id: string;
  resumeSourceId: string;
  category: string;
  items: string[];
  sortOrder: number;
};

export type ResumePublication = {
  id: string;
  resumeSourceId: string;
  title: string;
  publisher: string | null;
  date: string | null;
  url: string | null;
  description: string | null;
  sortOrder: number;
};

export type ResumeCustomSection = {
  id: string;
  resumeSourceId: string;
  title: string;
  content: string;
  sortOrder: number;
};

export type ResumeSourceData = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  contact: ResumeContact | null;
  education: ResumeEducation[];
  experiences: ResumeWorkExperience[];
  skills: ResumeSkill[];
  publications: ResumePublication[];
  customSections: ResumeCustomSection[];
  miscellaneous: string | null;
};
