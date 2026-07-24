/** Raw shapes as returned by the Scholarship Portal external API — see
 * lib/scholarship/api.ts for the endpoint this comes from. */

export type ScholarshipApiType = "registered" | "applied" | "draft";

export type RegisteredRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  uniqueId: string;
  email?: string;
  phoneNumber?: string;
  registrationDate?: string;
  createdAt?: string;
};

export type QAResponse = {
  question: string;
  answer: unknown;
  answerType: string;
  nestedAnswers?: QAResponse[];
};

export type RequirementSection = {
  sectionName: string;
  responses: QAResponse[];
};

export type BasicInfo = {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  category?: string;
};

export type CurrentAddress = {
  state?: string;
  district?: string;
  pincode?: string;
  address?: string;
};

export type TrackingStatusEntry = {
  status: string;
  dateTime: string;
};

export type AppliedOrDraftRecord = {
  applicationId: string;
  uniqueId?: string;
  draft: "Applied" | "Draft";
  basicInfo?: BasicInfo;
  currentAddress?: CurrentAddress;
  additionalRequirements?: RequirementSection[];
  trackingStatus?: TrackingStatusEntry[];
  requiredDocuments?: unknown[];
};

export type ScholarshipApiResponse<T> = {
  status: unknown;
  message?: string;
  data: {
    type: ScholarshipApiType;
    users?: T[];
    applications?: T[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
};

/** The row shape written to the scholarship_applications table — matches
 * the migration's columns exactly (see supabase/migrations/0024_*.sql). */
export type ScholarshipApplicationRow = {
  source_id: string;
  record_type: ScholarshipApiType;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  category: string | null;
  state: string | null;
  district: string | null;
  pincode: string | null;
  address: string | null;
  employment_status: string | null;
  education_status: string | null;
  education_qualification: string | null;
  dgca_medical_class2: string | null;
  dgca_computer_number: string | null;
  registration_date: string | null;
  applied_date: string | null;
  answers: Record<string, string>;
  tracking_status: TrackingStatusEntry[];
};

export type ScholarshipSyncResult = {
  registered: number;
  applied: number;
  draft: number;
  total: number;
};
