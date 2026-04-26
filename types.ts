export enum StepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  APPROVED = "approved",
  REJECTED = "rejected",
  SCHEDULED = "scheduled",
  MISSED = "missed",
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string;
  icon: string;
}

export interface VitalSign {
  label: string;
  value: string;
  unit: string;
  trend: "up" | "down" | "stable";
  status: "normal" | "warning" | "critical";
  icon: string;
}

export interface TreatmentStep {
  _id?: string;
  stepNumber: number;
  title: string;
  description: string;
  medication?: string; // String for simple display
  medications?: Medication[]; // Array for complex plans
  dosage?: string;
  duration?: string;
  instructions?: string;
  status: StepStatus;
  isPhysicalVisit: boolean;
  createdAt?: string;
  reExaminationDate?: string;
  reExaminationAppointmentId?: string;
  arrivalConfirmed?: boolean;
  arrivalConfirmedAt?: string;
  doctorNotes?: string;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  patient_message?: string;
  condition_description?: string;
  rejectionReason?: string;
  clinicAddress?: string;
  requiredDocuments?: string[];
}

export interface Doctor {
  _id: string;
  name: string;
  title?: string;
  specialty_id: {
    name: string;
  };
  avatar?: string;
  rating?: number;
}

export interface Patient {
  _id: string;
  name: string;
  avatar?: string;
  age?: number;
  bloodType?: string;
}

export interface MedicalRecord {
  _id: string;
  diagnosis: string;
  diagnosisDetail?: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  created_at: string;
  updated_at: string;
  doctor_id: Doctor;
  user_id: Patient;
  treatment_plan: TreatmentStep[];
  vitals?: VitalSign[];
  notes?: string;
  consultation_status: "in-progress" | "completed";
}

export interface Message {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: "text" | "image" | "file";
  timestamp: string;
  read: boolean;
  medical_record_id?: string;
}

export interface Record {
  _id: string;
  diagnosis: string;
  diagnosisDetail?: string;
  treatment_plan: TreatmentStep[];
  consultation_status: "in-progress" | "completed";
  status: "active" | "resolved" | "follow_up" | "chronic";
  severity?: "mild" | "moderate" | "severe" | "critical";
  doctor_id: {
    _id: string;
    name: string;
    title?: string;
    specialty_id?: { name: string };
    avatar?: string;
    rating?: number;
  };
  user_id: {
    _id: string;
    name: string;
    avatar?: string;
    age?: number;
    bloodType?: string;
  };
  vitals?: VitalSign[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  _id: string;
  user_id: string;
  doctor_id: string;
  specialty_id?: string;
  appointment_date: string;
  time_slot: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  reason?: string;
  notes?: string;
  created_at: string;
}
