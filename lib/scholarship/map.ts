import { flattenAdditionalRequirements, findAnswer } from "./flatten";
import type {
  RegisteredRecord,
  AppliedOrDraftRecord,
  ScholarshipApplicationRow,
} from "./types";

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function mapRegistered(record: RegisteredRecord): ScholarshipApplicationRow {
  return {
    source_id: record.uniqueId || record._id,
    record_type: "registered",
    first_name: record.firstName ?? null,
    last_name: record.lastName ?? null,
    email: record.email ?? null,
    phone_number: record.phoneNumber ?? null,
    date_of_birth: null,
    gender: null,
    category: null,
    state: null,
    district: null,
    pincode: null,
    address: null,
    employment_status: null,
    education_status: null,
    education_qualification: null,
    dgca_medical_class2: null,
    dgca_computer_number: null,
    registration_date: toDateOnly(record.registrationDate ?? record.createdAt),
    applied_date: null,
    answers: {},
    tracking_status: [],
  };
}

/** Shared by both "applied" and "draft" API types — same nested shape,
 * only record_type differs.
 *
 * Note on trackingStatus: despite the field being named "applied", the
 * real API uses status "Submitted" for both applied AND draft records
 * (confirmed against live data — "Applied" never actually appears), so
 * that's what we match on for the applied_date.
 *
 * Note on education fields: the source form has two genuinely distinct
 * questions that are easy to conflate — "What is your education status?"
 * (Completed education / Pursuing education) vs. "What is your highest
 * qualification?" (Undergraduate / Postgraduate / Higher secondary / …) —
 * mapped to education_status and education_qualification respectively.
 */
export function mapAppliedOrDraft(
  record: AppliedOrDraftRecord,
): ScholarshipApplicationRow {
  const flat = flattenAdditionalRequirements(record.additionalRequirements);
  const answers = Object.fromEntries(flat.entries());

  const trackingStatus = record.trackingStatus ?? [];
  const submittedEntry = trackingStatus.find((t) => /submitted/i.test(t.status));

  return {
    source_id: record.applicationId || record.uniqueId || "",
    record_type: record.draft === "Draft" ? "draft" : "applied",
    first_name: record.basicInfo?.firstName ?? null,
    last_name: record.basicInfo?.lastName ?? null,
    email: record.basicInfo?.email ?? null,
    phone_number: record.basicInfo?.mobileNumber ?? null,
    date_of_birth: toDateOnly(record.basicInfo?.dateOfBirth),
    gender: record.basicInfo?.gender ?? null,
    category: record.basicInfo?.category ?? null,
    state: record.currentAddress?.state ?? null,
    district: record.currentAddress?.district ?? null,
    pincode: record.currentAddress?.pincode ?? null,
    address: record.currentAddress?.address ?? null,
    employment_status: findAnswer(flat, "employment status", "employment"),
    education_status: findAnswer(flat, "education status"),
    education_qualification: findAnswer(flat, "highest qualification", "qualification"),
    dgca_medical_class2: findAnswer(
      flat,
      "dgca medical assessment class 2",
      "dgca medical class 2",
      "medical class 2",
      "dgca medical",
    ),
    dgca_computer_number: findAnswer(flat, "dgca computer number", "computer number"),
    registration_date: null,
    applied_date: toDateOnly(submittedEntry?.dateTime),
    answers,
    tracking_status: trackingStatus,
  };
}
