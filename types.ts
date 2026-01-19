
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
  trend: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical';
  icon: string;
}

export interface TreatmentStep {
  stepNumber: number;
  title: string;
  description: string;
  // Added medication property to match usage in RecordDetail.tsx
  medication?: string;
  medications?: Medication[];
  dosage?: string;
  duration?: string;
  instructions?: string;
  status: 'pending' | 'in-progress' | 'scheduled' | 'completed' | 'approved' | 'rejected' | 'missed';
  completedAt?: Date | string;
  startedAt?: Date | string;
  patient_message?: string;
  condition_description?: string;
  doctorNotes?: string;
  approval_requested?: boolean;
  isPhysicalVisit?: boolean;
  reExaminationScheduled?: boolean;
  reExaminationDate?: Date | string;
  arrivalConfirmed?: boolean;
  arrivalConfirmedAt?: Date | string;
  rejectionReason?: string;
  clinicAddress?: string;
  requiredDocuments?: string[];
  _id?: string;
}

export interface Record {
  _id: string;
  diagnosis: string;
  diagnosisDetail?: string;
  treatment_plan: TreatmentStep[];
  consultation_status: 'in-progress' | 'completed';
  status: 'active' | 'resolved' | 'follow_up' | 'chronic';
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
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

export interface Message {
  _id?: string;
  sender_id: string | any;
  receiver_id: string | any;
  message: string;
  message_type: 'text' | 'image' | 'file';
  timestamp: Date;
  read: boolean;
  medical_record_id?: string;
}