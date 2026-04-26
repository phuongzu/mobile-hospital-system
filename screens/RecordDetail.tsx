import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FlashMessage, { showMessage } from "react-native-flash-message";

const { width: screenWidth } = Dimensions.get("window");
const API_BASE_URL = "http://localhost:3000/api";

// ==================== COLOR PALETTE ====================
const COLORS = {
  primary: "#4A90E2",
  secondary: "#5CB85C",
  accent: "#FFB74D",
  danger: "#E57373",
  background: "#F5F7FA",
  card: "#FFFFFF",
  text: "#2C3E50",
  textLight: "#7F8C8D",
  border: "#E0E6ED",
  success: "#81C784",
  warning: "#FFD54F",
  info: "#64B5F6",
  // FIX: Màu mới cho trạng thái chờ bác sĩ duyệt
  awaitingReview: "#FF9800",
};

// ==================== TYPES ====================
interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
}

interface Doctor {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  specialty_id?: any;
}

interface TreatmentStep {
  _id?: string;
  stepNumber: number;
  title: string;
  description: string;
  status: string;
  medication?: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
  isPhysicalVisit?: boolean;
  requires_followup?: boolean;
  followup_reason?: string;
  reExaminationDate?: Date;
  reExaminationAppointmentId?: string;
  approval_requested?: boolean;
  approval_requested_at?: Date;
  patient_message?: string;
  patientMessage?: string;
  condition_description?: string;
  doctorNotes?: string;
  createdAt?: Date;
  completedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
}

// ==========================================================
// FIX 1: ĐỔI TÊN 'Record' → 'MedicalRecord'
//
// Nguyên nhân lỗi TypeScript:
//   error TS2315: Type 'Record' is not generic (dòng 348, 414)
//
// TypeScript có sẵn built-in type 'Record<K, V>' (utility type),
// khi bạn đặt tên interface là 'Record', nó xung đột với built-in.
// Bất cứ chỗ nào viết Record<string, any> sẽ bị hiểu nhầm là
// "gọi interface Record như generic type" → lỗi "not generic".
// ==========================================================
interface MedicalRecord {
  _id: string;
  user_id: User;
  doctor_id: Doctor;
  appointment_id?: any;
  diagnosis: string;
  symptoms?: string[];
  severity?: string;
  treatment_plan: TreatmentStep[];
  processes?: any[];
  current_step?: number;
  consultation_status: string;
  created_at: Date;
  updated_at: Date;
}

interface Message {
  _id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: string;
  read: boolean;
  timestamp: Date;
}

interface Appointment {
  _id: string;
  appointment_date: Date;
  time_slot: string;
  status: string;
  reason?: string;
  notes?: string;
  location?: string;
  clinic_location?: string;
  doctor_id: Doctor;
  user_id: User;
  created_at: Date;
}

// ==========================================================
// FIX 2: Type alias cho appointment map
//
// Nguyên nhân lỗi: error TS7006: Parameter 'prev' implicitly has 'any' type (dòng 443)
//
// Khi useState được khai báo với type xung đột (do Record interface),
// TypeScript không thể infer type của 'prev' trong setStepAppointments(prev => {...})
// → Fix: dùng explicit type alias thay vì { [key: string]: any } inline
// ==========================================================
type AppointmentMap = { [stepNumber: string]: any };

// ==================== HELPER: Status Display Logic ====================
//
// LUỒNG STATUS (quan trọng để hiểu bug):
//   pending
//     → patient bấm "Start" → in-progress
//     → patient gửi báo cáo → completed (approval_requested=true) ← CHƯA xong, chờ bác sĩ
//     → bác sĩ duyệt → approved ← Mới thực sự xong
//     → bác sĩ từ chối → rejected
//
// BUG CŨ:
//   SimpleStatusBadge chỉ nhìn vào 'status'.
//   'completed' → hiển thị "Completed" với màu xanh lá ✓
//   → SAI vì bác sĩ chưa duyệt, patient hiểu nhầm là xong rồi
//
// FIX:
//   Khi status='completed' VÀ approval_requested=true → "Awaiting Review" (màu cam)
//   Chỉ khi status='approved' → mới hiển thị "Completed" (màu xanh)
//
const getDisplayStatus = (
  step: TreatmentStep,
): {
  label: string;
  color: string;
  icon: string;
} => {
  const statusLower = step.status.toLowerCase();

  // Trường hợp đặc biệt: patient đã submit báo cáo, chờ bác sĩ review
  if (statusLower === "completed" && step.approval_requested === true) {
    return {
      color: COLORS.awaitingReview,
      icon: "hourglass-outline",
      label: "Awaiting Review",
    };
  }

  switch (statusLower) {
    case "approved":
      return {
        color: COLORS.success,
        icon: "checkmark-circle",
        label: "Completed",
      };
    case "completed":
      // completed nhưng approval_requested=false (hiếm, edge case)
      return {
        color: COLORS.success,
        icon: "checkmark-circle",
        label: "Completed",
      };
    case "in-progress":
    case "in_progress":
      return {
        color: COLORS.warning,
        icon: "time-outline",
        label: "In Progress",
      };
    case "scheduled":
      return {
        color: COLORS.info,
        icon: "calendar-outline",
        label: "Scheduled",
      };
    case "pending":
      return {
        color: COLORS.textLight,
        icon: "hourglass-outline",
        label: "Pending",
      };
    case "rejected":
      return { color: COLORS.danger, icon: "close-circle", label: "Rejected" };
    default:
      return {
        color: COLORS.textLight,
        icon: "help-circle-outline",
        label: "Unknown",
      };
  }
};

// ==================== HELPER COMPONENTS ====================

// FIX: SimpleStatusBadge nhận TreatmentStep (không chỉ status string)
// để kiểm tra được cả approval_requested flag
const SimpleStatusBadge: React.FC<{ step: TreatmentStep }> = ({ step }) => {
  const config = useMemo(
    () => getDisplayStatus(step),
    [step.status, step.approval_requested],
  );

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
      <Ionicons name={config.icon as any} size={18} color="#FFF" />
      <Text style={styles.statusBadgeText}>{config.label}</Text>
    </View>
  );
};

const SimpleAppointmentCard: React.FC<{
  appointment: Appointment | any;
  step: TreatmentStep;
  onCheckIn?: () => void;
}> = ({ appointment, step, onCheckIn }) => {
  const effectiveAppointment =
    appointment ||
    (step.reExaminationDate
      ? {
          _id: `mock_${step.stepNumber}`,
          appointment_date: step.reExaminationDate,
          time_slot: "09:00",
          status: step.status === "scheduled" ? "scheduled" : "confirmed",
          reason:
            step.followup_reason || step.description || "Follow-up Examination",
          notes: step.doctorNotes || "",
          location: "Clinic",
          clinic_location: "Clinic - Room 101",
        }
      : null);

  if (!effectiveAppointment) return null;

  const appointmentDate = effectiveAppointment.appointment_date
    ? new Date(effectiveAppointment.appointment_date)
    : step.reExaminationDate
      ? new Date(step.reExaminationDate)
      : null;

  if (!appointmentDate) return null;

  const now = new Date();
  const isToday = appointmentDate.toDateString() === now.toDateString();
  const status = effectiveAppointment.status?.toLowerCase() || "scheduled";

  const formattedDate = appointmentDate.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeSlot =
    effectiveAppointment.time_slot ||
    appointmentDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const cardColor = isToday
    ? COLORS.accent
    : status === "confirmed"
      ? COLORS.success
      : COLORS.info;

  return (
    <View style={[styles.appointmentCard, { borderLeftColor: cardColor }]}>
      <View style={styles.appointmentHeader}>
        <Ionicons
          name={isToday ? "today" : "calendar"}
          size={24}
          color={cardColor}
        />
        <Text style={styles.appointmentTitle}>
          {isToday ? "🔔 Today's Appointment" : "📅 Follow-up Appointment"}
        </Text>
      </View>

      <View style={styles.appointmentRow}>
        <Text style={styles.appointmentLabel}>Date:</Text>
        <Text style={styles.appointmentValue}>{formattedDate}</Text>
      </View>

      <View style={styles.appointmentRow}>
        <Text style={styles.appointmentLabel}>Time:</Text>
        <Text style={styles.appointmentValue}>{timeSlot}</Text>
      </View>

      {effectiveAppointment.location && (
        <View style={styles.appointmentRow}>
          <Text style={styles.appointmentLabel}>Location:</Text>
          <Text style={styles.appointmentValue}>
            {effectiveAppointment.location}
          </Text>
        </View>
      )}

      {effectiveAppointment.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{effectiveAppointment.reason}</Text>
        </View>
      )}

      {status === "scheduled" &&
        onCheckIn &&
        !effectiveAppointment._id?.startsWith("mock_") && (
          <TouchableOpacity style={styles.checkInButton} onPress={onCheckIn}>
            <Ionicons name="checkmark-circle" size={22} color="#FFF" />
            <Text style={styles.checkInButtonText}>Confirm Arrival</Text>
          </TouchableOpacity>
        )}

      {status === "pending" && (
        <View style={styles.pendingBox}>
          <Ionicons name="time-outline" size={20} color={COLORS.warning} />
          <Text style={styles.pendingText}>⏳ Pending Confirmation</Text>
        </View>
      )}
      {status === "confirmed" && (
        <View style={styles.confirmedBox}>
          <Ionicons
            name="checkmark-done-circle"
            size={20}
            color={COLORS.success}
          />
          <Text style={styles.confirmedText}>
            ✓ Confirmed - Waiting to see doctor
          </Text>
        </View>
      )}
      {status === "completed" && (
        <View style={styles.completedBox}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.completedText}>✓ Appointment Completed</Text>
        </View>
      )}

      {effectiveAppointment._id?.startsWith("mock_") && (
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={COLORS.info}
          />
          <Text style={styles.infoText}>
            The clinic will contact to confirm specific appointment details
          </Text>
        </View>
      )}
    </View>
  );
};

const MedicationCard: React.FC<{ step: TreatmentStep }> = ({ step }) => {
  if (!step.medication && !step.duration) return null;

  return (
    <View style={styles.medicationCard}>
      <View style={styles.medicationHeader}>
        <Ionicons name="medical" size={22} color={COLORS.primary} />
        <Text style={styles.medicationTitle}>Medication and Prescription</Text>
      </View>

      {step.medication && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>💊 Medication:</Text>
          <Text style={styles.medicationValue}>{step.medication}</Text>
        </View>
      )}
      {step.dosage && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>📏 Dosage:</Text>
          <Text style={styles.medicationValue}>{step.dosage}</Text>
        </View>
      )}
      {step.duration && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>⏱️ Duration:</Text>
          <Text style={styles.medicationValue}>{step.duration}</Text>
        </View>
      )}
      {step.instructions && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>📋 Instructions:</Text>
          <Text style={styles.instructionsText}>{step.instructions}</Text>
        </View>
      )}
    </View>
  );
};

// ==================== MAIN COMPONENT ====================

const MedicalRecordDetail: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();

  const initialRecord = route.params?.record;

  // FIX: Dùng MedicalRecord thay vì Record
  const [record, setRecord] = useState<MedicalRecord>(initialRecord);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // FIX: Dùng AppointmentMap (fix lỗi TS2315 dòng 348 + 414)
  const [stepAppointments, setStepAppointments] = useState<AppointmentMap>({});

  const [showChat, setShowChat] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TreatmentStep | null>(null);
  const [conditionDesc, setConditionDesc] = useState("");
  const [patientMsg, setPatientMsg] = useState("");
  const [directAppointments, setDirectAppointments] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // FIX: Chỉ tính 'approved' là đã hoàn thành
  // 'completed' = patient gửi rồi nhưng bác sĩ chưa duyệt → KHÔNG tính vào progress
  const completionPercentage = useMemo(() => {
    if (!record?.treatment_plan?.length) return 0;
    const approvedSteps = record.treatment_plan.filter(
      (step) => step.status.toLowerCase() === "approved",
    );
    return Math.round(
      (approvedSteps.length / record.treatment_plan.length) * 100,
    );
  }, [record]);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("authToken");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await axios.get(
        `${API_BASE_URL}/medical-records/my-records`,
        { headers },
      );

      if (res.data && Array.isArray(res.data)) {
        // FIX: Dùng MedicalRecord trong find callback
        const current = res.data.find(
          (r: MedicalRecord) => r._id === record._id,
        );
        if (current) {
          setRecord(current);
          await fetchAllAppointments(current);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch record:", error);
      if (error.response?.status === 401) {
        showMessage({
          message: "Session expired. Please login again.",
          type: "danger",
        });
        navigation.navigate("Login" as never);
      } else {
        showMessage({
          message: "Cannot load record information",
          type: "danger",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // FIX: Dùng MedicalRecord thay vì Record trong signature
  const fetchAllAppointments = async (currentRecord: MedicalRecord) => {
    try {
      const headers = await getAuthHeaders();

      const [allAppointmentsRes, reExamRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/patient/appointments/history`, { headers }),
        axios.get(
          `${API_BASE_URL}/medical-records/${currentRecord._id}/re-examination/appointments`,
          { headers },
        ),
      ]);

      // FIX: Dùng AppointmentMap thay vì Record<string, any> (fix lỗi TS2315 dòng 414)
      const appointments: AppointmentMap = {};

      if (reExamRes.status === "fulfilled" && reExamRes.value.data?.success) {
        const stepAppointmentsData =
          reExamRes.value.data.data?.stepAppointments || [];
        stepAppointmentsData.forEach((item: any) => {
          if (item.appointment && item.stepNumber) {
            appointments[item.stepNumber] = item.appointment;
          }
        });
      }

      if (
        allAppointmentsRes.status === "fulfilled" &&
        Array.isArray(allAppointmentsRes.value.data)
      ) {
        const allAppointments = allAppointmentsRes.value.data;
        setDirectAppointments(allAppointments);

        currentRecord.treatment_plan.forEach((step) => {
          if (
            step.status.toLowerCase() === "scheduled" &&
            !appointments[step.stepNumber]
          ) {
            const matched = findMatchingAppointment(
              step,
              allAppointments,
              currentRecord,
            );
            if (matched) appointments[step.stepNumber] = matched;
          }
        });
      }

      // FIX: Explicit type cho 'prev' parameter (fix lỗi TS7006 dòng 443)
      setStepAppointments((prev: AppointmentMap) => {
        const prevKeys = Object.keys(prev).sort().join(",");
        const newKeys = Object.keys(appointments).sort().join(",");
        if (prevKeys !== newKeys) return appointments;

        const hasChanges = Object.keys(appointments).some(
          (key) =>
            JSON.stringify(prev[key]) !== JSON.stringify(appointments[key]),
        );
        return hasChanges ? appointments : prev;
      });
    } catch (error) {
      console.error("Error in fetchAllAppointments:", error);
    }
  };

  // FIX: Dùng MedicalRecord thay vì Record
  const findMatchingAppointment = (
    step: TreatmentStep,
    appointments: any[],
    currentRecord: MedicalRecord,
  ): any => {
    const stepUniqueKey = `${currentRecord._id}-${step.stepNumber}`;

    const matchedByUniqueKey = appointments.find(
      (app) =>
        app.metadata?.step_unique_key === stepUniqueKey ||
        (app.metadata?.medical_record_id === currentRecord._id &&
          app.metadata?.step_number === step.stepNumber),
    );
    if (matchedByUniqueKey) return matchedByUniqueKey;

    if (step.reExaminationAppointmentId) {
      const directMatch = appointments.find(
        (app) => app._id === step.reExaminationAppointmentId,
      );
      if (directMatch) return directMatch;
    }

    if (step._id) {
      const directStepMatch = appointments.find(
        (app) =>
          app.re_examination_step_id?.toString() === step._id?.toString(),
      );
      if (directStepMatch) return directStepMatch;
    }

    const recordIdShort = currentRecord._id.slice(-6);
    return (
      appointments.find(
        (app) =>
          app.reason?.includes(recordIdShort) ||
          app.reason?.includes(currentRecord._id) ||
          app.notes?.includes(recordIdShort) ||
          app.notes?.includes(currentRecord._id),
      ) || null
    );
  };

  const loadMessages = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(
        `${API_BASE_URL}/messages/record/${record._id}`,
        { headers },
      );
      setMessages(res.data?.data?.messages || []);
    } catch (error: any) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendChat = async () => {
    if (!newMessage.trim()) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_BASE_URL}/messages/send`,
        {
          receiver_id: record.doctor_id._id,
          message: newMessage,
          medical_record_id: record._id,
          message_type: "text",
        },
        { headers },
      );
      setNewMessage("");
      loadMessages();
      showMessage({ message: "Message sent", type: "success" });
    } catch (error) {
      showMessage({ message: "Cannot send message", type: "danger" });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecordDetails();
    setRefreshing(false);
  };

  const handleStepAction = async (
    action: "activate" | "complete" | "confirm",
    stepNumber: number,
  ) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      let url = "";
      let payload = {};

      switch (action) {
        case "activate":
          url = `${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/activate`;
          break;
        case "complete":
          url = `${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/complete-with-message`;
          payload = {
            patientMessage: patientMsg,
            conditionDescription: conditionDesc,
          };
          break;
        case "confirm":
          const appointment = stepAppointments[stepNumber];
          if (appointment && !appointment._id?.startsWith("mock_")) {
            url = `${API_BASE_URL}/patient/appointments/${appointment._id}/check-in`;
          } else {
            throw new Error("Appointment not found or is a mock appointment");
          }
          break;
      }

      if (!url) throw new Error("Invalid action");

      const response = await axios({
        method: "PATCH",
        url,
        data: payload,
        headers,
      });
      showMessage({
        message: response.data.message || "Action successful",
        type: "success",
      });

      if (action === "complete") {
        setShowReport(false);
        setConditionDesc("");
        setPatientMsg("");
      }

      await fetchRecordDetails();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || error.message || "Action failed";
      showMessage({ message: errorMsg, type: "danger", duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER TREATMENT STEP ====================
  const renderTreatmentStep = (step: TreatmentStep, index: number) => {
    const appointment = stepAppointments[step.stepNumber];
    const statusLower = step.status.toLowerCase();

    const isScheduled = statusLower === "scheduled";
    const isInProgress =
      statusLower === "in-progress" || statusLower === "in_progress";
    const isPending = statusLower === "pending";
    const isRejected = statusLower === "rejected";
    const isApproved = statusLower === "approved";

    // FIX: Trạng thái quan trọng nhất - patient đã submit, chờ bác sĩ duyệt
    const isAwaitingReview =
      statusLower === "completed" && step.approval_requested === true;

    return (
      <View key={step._id || index} style={styles.stepContainer}>
        {/* Header: Step number + Badge */}
        <View style={styles.stepNumberBox}>
          <Text style={styles.stepNumberText}>Step {step.stepNumber}</Text>
          {/* FIX: Truyền toàn bộ step object để badge có thể kiểm tra approval_requested */}
          <SimpleStatusBadge step={step} />
        </View>

        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        {/* Appointment card (khi step là physical visit) */}
        {isScheduled && (
          <SimpleAppointmentCard
            appointment={appointment}
            step={step}
            onCheckIn={() => handleStepAction("confirm", step.stepNumber)}
          />
        )}

        {/* Medication info */}
        {!isScheduled && <MedicationCard step={step} />}

        {/* Doctor's notes */}
        {step.doctorNotes && (
          <View style={styles.doctorNotesBox}>
            <View style={styles.doctorNotesHeader}>
              <Ionicons
                name="chatbox-ellipses"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.doctorNotesTitle}>Doctor's Message</Text>
            </View>
            <Text style={styles.doctorNotesText}>{step.doctorNotes}</Text>
          </View>
        )}

        {/* FIX: Hiển thị "Waiting for Doctor Review" box */}
        {isAwaitingReview && (
          <View style={styles.awaitingReviewBox}>
            <Ionicons
              name="hourglass-outline"
              size={22}
              color={COLORS.awaitingReview}
            />
            <View style={styles.awaitingReviewContent}>
              <Text style={styles.awaitingReviewTitle}>
                ⏳ Waiting for Doctor Review
              </Text>
              <Text style={styles.awaitingReviewSubtext}>
                Your report has been submitted. The doctor will review and
                approve your progress soon.
              </Text>
            </View>
          </View>
        )}

        {/* Hiển thị báo cáo patient đã gửi */}
        {(isAwaitingReview || isApproved) &&
          (step.condition_description ||
            (step.patientMessage && step.patientMessage !== "completed")) && (
            <View style={styles.patientReportBox}>
              <Text style={styles.patientReportLabel}>
                📝 Your Submitted Report:
              </Text>
              {step.condition_description ? (
                <Text style={styles.patientReportText}>
                  {step.condition_description}
                </Text>
              ) : null}
              {step.patientMessage && step.patientMessage !== "completed" ? (
                <Text style={styles.patientMessageText}>
                  Message: {step.patientMessage}
                </Text>
              ) : null}
            </View>
          )}

        {/* Rejected status */}
        {isRejected && (
          <View style={styles.rejectedBox}>
            <Ionicons name="close-circle" size={20} color={COLORS.danger} />
            <Text style={styles.rejectedText}>
              ❌ Step Rejected - Please contact your doctor for next steps
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isPending && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => handleStepAction("activate", step.stepNumber)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={24} color="#FFF" />
                  <Text style={styles.buttonText}>Start This Step</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* FIX: Chỉ hiện "Report Condition" khi đang in-progress
              KHÔNG hiện khi đã submit báo cáo (isAwaitingReview)
              vì backend sẽ từ chối nếu step không còn 'in-progress' */}
          {isInProgress && !isAwaitingReview && (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => {
                setSelectedStep(step);
                setShowReport(true);
              }}
              disabled={loading}
            >
              <Ionicons name="document-text" size={24} color="#FFF" />
              <Text style={styles.buttonText}>Report Condition</Text>
            </TouchableOpacity>
          )}
        </View>

        {index < record.treatment_plan.length - 1 && (
          <View style={styles.stepDivider} />
        )}
      </View>
    );
  };

  // Effects
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (record?._id) fetchRecordDetails();
    }, [record?._id]),
  );

  if (!record) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <FlashMessage position="top" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setShowChat(true);
            loadMessages();
          }}
          style={styles.chatButton}
        >
          <Ionicons name="chatbubbles" size={26} color={COLORS.primary} />
          {messages.filter((m) => m.sender_id !== record.user_id._id && !m.read)
            .length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>
                {
                  messages.filter(
                    (m) => m.sender_id !== record.user_id._id && !m.read,
                  ).length
                }
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card */}
        <Animated.View style={[styles.progressCard, { opacity: fadeAnim }]}>
          <View style={styles.progressHeader}>
            <Ionicons name="ribbon" size={36} color={COLORS.primary} />
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressTitle}>Treatment Progress</Text>
              <Text style={styles.progressPercentage}>
                {completionPercentage}%
              </Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${completionPercentage}%` as any },
              ]}
            />
          </View>

          {/* FIX: Chỉ đếm 'approved' steps, không đếm 'completed' */}
          <Text style={styles.progressSubtitle}>
            Doctor approved{" "}
            {
              record.treatment_plan?.filter(
                (s) => s.status.toLowerCase() === "approved",
              ).length
            }{" "}
            / {record.treatment_plan?.length} steps
          </Text>
        </Animated.View>

        {/* Diagnosis Card */}
        <View style={styles.diagnosisCard}>
          <View style={styles.diagnosisHeader}>
            <Ionicons name="medical" size={28} color={COLORS.primary} />
            <Text style={styles.diagnosisTitle}>Doctor's Diagnosis</Text>
          </View>

          <Text style={styles.diagnosisText}>{record.diagnosis}</Text>

          <View style={styles.doctorInfoRow}>
            <Ionicons name="person-circle" size={20} color={COLORS.textLight} />
            <Text style={styles.doctorInfoText}>
              Attending Doctor: {record.doctor_id?.name || "Not specified"}
            </Text>
          </View>

          {record.severity && (
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>Severity:</Text>
              <View
                style={[
                  styles.severityBadge,
                  {
                    backgroundColor:
                      record.severity.toLowerCase() === "mild"
                        ? COLORS.warning
                        : record.severity.toLowerCase() === "moderate"
                          ? COLORS.accent
                          : COLORS.danger,
                  },
                ]}
              >
                <Text style={styles.severityText}>
                  {record.severity.toLowerCase() === "mild"
                    ? "Mild"
                    : record.severity.toLowerCase() === "moderate"
                      ? "Moderate"
                      : "Severe"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Treatment Steps */}
        <View style={styles.treatmentSection}>
          <Text style={styles.sectionTitle}>📋 Treatment Steps</Text>
          {record.treatment_plan?.map((step, index) =>
            renderTreatmentStep(step, index),
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={showReport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Health Condition Report</Text>
                <TouchableOpacity onPress={() => setShowReport(false)}>
                  <Ionicons
                    name="close-circle"
                    size={32}
                    color={COLORS.textLight}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                How are you feeling? (Required){" "}
                <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                placeholder="Example: Pain reduced, still have mild cough..."
                value={conditionDesc}
                onChangeText={setConditionDesc}
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={styles.inputLabel}>
                Message for doctor (Optional)
              </Text>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                multiline
                placeholder="Example: I want to ask about medication dosage..."
                value={patientMsg}
                onChangeText={setPatientMsg}
                placeholderTextColor={COLORS.textLight}
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!conditionDesc || loading) && styles.disabledButton,
                ]}
                disabled={!conditionDesc || loading}
                onPress={() =>
                  selectedStep &&
                  handleStepAction("complete", selectedStep.stepNumber)
                }
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={22} color="#FFF" />
                    <Text style={styles.submitButtonText}>Send Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.modalNote}>
                💡 After submitting, your doctor will review and approve your
                progress
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChat} animationType="slide">
        <SafeAreaView style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => setShowChat(false)}
              style={styles.chatCloseButton}
            >
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatDoctorName}>💬 Message Doctor</Text>
              <Text style={styles.chatDoctorSubtitle}>
                Dr. {record.doctor_id?.name || "Not specified"}
              </Text>
            </View>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(item) => item._id || Math.random().toString()}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => {
              const isMine = item.sender_id === record.user_id._id;
              return (
                <View
                  style={[
                    styles.messageBubble,
                    isMine ? styles.myMessage : styles.doctorMessage,
                  ]}
                >
                  {!isMine && (
                    <View style={styles.doctorAvatar}>
                      <Ionicons
                        name="person-circle"
                        size={24}
                        color={COLORS.primary}
                      />
                    </View>
                  )}
                  <View style={styles.messageContent}>
                    <Text
                      style={[
                        styles.messageText,
                        isMine
                          ? styles.myMessageText
                          : styles.doctorMessageText,
                      ]}
                    >
                      {item.message}
                    </Text>
                    <Text style={styles.messageTime}>
                      {new Date(item.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={64}
                  color={COLORS.border}
                />
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>
                  Send a message to communicate with doctor
                </Text>
              </View>
            }
          />

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type your message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !newMessage.trim() && styles.disabledSendButton,
              ]}
              onPress={handleSendChat}
              disabled={!newMessage.trim()}
            >
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  loadingContainer: { alignItems: "center", flex: 1, justifyContent: "center" },
  loadingText: {
    color: COLORS.textLight,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
  },

  header: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { alignItems: "center", flexDirection: "row", gap: 8 },
  backText: { color: COLORS.text, fontSize: 18, fontWeight: "600" },
  chatButton: { padding: 8, position: "relative" },
  chatBadge: {
    alignItems: "center",
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 4,
    position: "absolute",
    right: 4,
    top: 4,
  },
  chatBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  scrollContent: { padding: 20, paddingBottom: 40 },

  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    elevation: 4,
    marginBottom: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  progressTextContainer: { flex: 1 },
  progressTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  progressPercentage: {
    color: COLORS.primary,
    fontSize: 36,
    fontWeight: "900",
  },
  progressBarContainer: {
    backgroundColor: COLORS.border,
    borderRadius: 6,
    height: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    height: "100%",
  },
  progressSubtitle: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },

  diagnosisCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    elevation: 4,
    marginBottom: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  diagnosisHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  diagnosisTitle: { color: COLORS.text, fontSize: 20, fontWeight: "700" },
  diagnosisText: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 20,
  },
  doctorInfoRow: {
    alignItems: "center",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingTop: 16,
  },
  doctorInfoText: { color: COLORS.textLight, fontSize: 16, fontWeight: "600" },
  severityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  severityLabel: { color: COLORS.textLight, fontSize: 16, fontWeight: "600" },
  severityBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  severityText: { color: "#FFF", fontSize: 15, fontWeight: "700" },

  treatmentSection: { marginTop: 8 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },

  stepContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    elevation: 4,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  stepNumberBox: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  stepNumberText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    marginBottom: 12,
  },
  stepDescription: {
    color: COLORS.textLight,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  stepDivider: { backgroundColor: COLORS.border, height: 1, marginTop: 20 },

  statusBadge: {
    alignItems: "center",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusBadgeText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

  // === FIX: Styles mới cho Awaiting Review ===
  awaitingReviewBox: {
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    borderLeftColor: COLORS.awaitingReview,
    borderLeftWidth: 4,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    padding: 16,
  },
  awaitingReviewContent: { flex: 1 },
  awaitingReviewTitle: {
    color: COLORS.awaitingReview,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  awaitingReviewSubtext: {
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 20,
  },

  patientReportBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginBottom: 16,
    padding: 14,
  },
  patientReportLabel: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  patientReportText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  patientMessageText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 6,
  },

  rejectedBox: {
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    padding: 14,
  },
  rejectedText: {
    color: COLORS.danger,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },

  appointmentCard: {
    backgroundColor: "#F0F9FF",
    borderLeftWidth: 5,
    borderRadius: 16,
    marginBottom: 20,
    padding: 20,
  },
  appointmentHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  appointmentTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  appointmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  appointmentLabel: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: "600",
  },
  appointmentValue: {
    color: COLORS.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  reasonBox: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginTop: 12,
    padding: 14,
  },
  reasonLabel: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  reasonText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  checkInButton: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 16,
  },
  checkInButtonText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  confirmedBox: {
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  confirmedText: { color: COLORS.success, fontSize: 16, fontWeight: "600" },
  infoBox: {
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoText: { color: COLORS.info, flex: 1, fontSize: 14, fontWeight: "500" },

  medicationCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 16,
    marginBottom: 20,
    padding: 20,
  },
  medicationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  medicationTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  medicationRow: { marginBottom: 12 },
  medicationLabel: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  medicationValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  instructionsBox: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginTop: 12,
    padding: 14,
  },
  instructionsLabel: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  instructionsText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },

  doctorNotesBox: {
    backgroundColor: "#E8EAF6",
    borderRadius: 16,
    marginBottom: 20,
    padding: 20,
  },
  doctorNotesHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  doctorNotesTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  doctorNotesText: {
    color: COLORS.text,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
  },

  actionButtons: { gap: 12 },
  startButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 18,
  },
  reportButton: {
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 18,
  },
  buttonText: { color: "#FFF", fontSize: 17, fontWeight: "700" },

  modalOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    padding: 28,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  inputLabel: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 20,
  },
  required: { color: COLORS.danger },
  textInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    height: 120,
    padding: 18,
    textAlignVertical: "top",
  },
  messageInput: { height: 100 },
  submitButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 28,
    paddingVertical: 18,
  },
  submitButtonText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  disabledButton: { backgroundColor: COLORS.border },
  modalNote: {
    color: COLORS.textLight,
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 16,
    textAlign: "center",
  },

  chatContainer: { backgroundColor: COLORS.background, flex: 1 },
  chatHeader: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  chatCloseButton: { padding: 4 },
  chatHeaderInfo: { flex: 1 },
  chatDoctorName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  chatDoctorSubtitle: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: "500",
  },
  chatList: { padding: 20 },
  messageBubble: { flexDirection: "row", marginBottom: 16, maxWidth: "85%" },
  myMessage: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  doctorMessage: { alignSelf: "flex-start" },
  doctorAvatar: { marginRight: 10 },
  messageContent: { flex: 1 },
  messageText: { borderRadius: 18, fontSize: 16, lineHeight: 24, padding: 16 },
  myMessageText: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    color: "#FFF",
  },
  doctorMessageText: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
    color: COLORS.text,
  },
  messageTime: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 16,
    marginTop: 6,
  },
  emptyChat: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    marginTop: 100,
  },
  emptyChatText: { color: COLORS.textLight, fontSize: 18, fontWeight: "600" },
  emptyChatSubtext: { color: COLORS.textLight, fontSize: 15 },
  chatInputContainer: {
    alignItems: "flex-end",
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  chatInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  disabledSendButton: { backgroundColor: COLORS.border },
  completedBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedText: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  pendingBox: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingText: { color: COLORS.warning, fontSize: 14, fontWeight: "700" },
});

export default MedicalRecordDetail;
