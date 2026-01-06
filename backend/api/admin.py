from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import (
    AcademicTarget,
    AbsenceJustification,
    ApiToken,
    AttendanceRecord,
    AuditLog,
    Classroom,
    ClassroomTeacherAllocation,
    ClassDiaryEntry,
    ClassScheduleEntry,
    Conversation,
    EmergencyContact,
    Enrollment,
    ExamSubmission,
    FinancialTransaction,
    GradingConfig,
    GradeRecord,
    Guardian,
    InventoryItem,
    InventoryMovement,
    InventoryRequest,
    Invoice,
    LearningMaterial,
    Message,
    Notice,
    PasswordResetToken,
    School,
    Student,
    StudentGuardian,
    StudentParent,
    Syllabus,
    TeacherAvailability,
    TimeSlot,
    UploadAttachment,
    UserProfile,
)


User = get_user_model()

try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    extra = 0


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "is_active", "is_staff", "last_login")
    search_fields = ("username", "email", "first_name", "last_name")
    list_filter = ("is_active", "is_staff")
    inlines = [UserProfileInline]


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "cnpj", "city", "state", "created_at")
    search_fields = ("name", "cnpj", "email")
    list_filter = ("state",)


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "grade", "year", "shift", "capacity", "school")
    search_fields = ("name", "grade")
    list_filter = ("shift", "year")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "cpf", "tuition_status", "status", "school")
    search_fields = ("first_name", "last_name", "cpf")
    list_filter = ("status", "tuition_status")


@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "relation", "phone", "email", "school")
    search_fields = ("name", "email", "cpf")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "classroom", "start_date", "status")
    list_filter = ("status",)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "amount", "due_date", "status")
    list_filter = ("status",)


@admin.register(FinancialTransaction)
class FinancialTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "description", "transaction_type", "amount", "student", "status", "date", "school")
    list_filter = ("transaction_type", "status")
    search_fields = ("description", "category")


@admin.register(GradeRecord)
class GradeRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "classroom", "subject", "term", "final_grade")
    search_fields = ("student__first_name", "student__last_name", "subject")


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "classroom", "date", "subject", "status", "teacher")
    list_filter = ("status", "date")


@admin.register(AbsenceJustification)
class AbsenceJustificationAdmin(admin.ModelAdmin):
    list_display = ("id", "attendance", "status", "created_by", "decided_by", "created_at")
    list_filter = ("status",)
    search_fields = ("reason", "observation")


@admin.register(ClassDiaryEntry)
class ClassDiaryEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "classroom", "subject", "date", "teacher")
    search_fields = ("subject", "topic")


@admin.register(LearningMaterial)
class LearningMaterialAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "material_type", "date", "classroom")
    search_fields = ("title",)


@admin.register(Syllabus)
class SyllabusAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "grade_level", "school")
    search_fields = ("subject",)


@admin.register(GradingConfig)
class GradingConfigAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "system", "calculation_method", "min_passing_grade")


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "notice_type", "date", "school")
    search_fields = ("title",)
    list_filter = ("notice_type",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "school", "created_at")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender_type", "sent_at")
    search_fields = ("text",)


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "label", "start_time", "end_time", "school")
    list_filter = ("school",)


@admin.register(TeacherAvailability)
class TeacherAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("id", "teacher", "day_of_week", "time_slot")
    list_filter = ("day_of_week",)


@admin.register(ClassScheduleEntry)
class ClassScheduleEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "classroom", "subject", "day_of_week", "time_slot", "teacher")
    list_filter = ("day_of_week",)


@admin.register(UploadAttachment)
class UploadAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "entity_type", "entity_id", "original_name", "size", "created_at")
    list_filter = ("entity_type",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "user", "ip_address", "created_at")
    search_fields = ("action", "detail", "ip_address")


@admin.register(ApiToken)
class ApiTokenAdmin(admin.ModelAdmin):
    list_display = ("key", "user", "created_at", "last_used_at")
    search_fields = ("key", "user__username")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "expires_at", "used_at")
    list_filter = ("used_at",)


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "quantity", "min_quantity", "school")
    list_filter = ("category",)


@admin.register(InventoryRequest)
class InventoryRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "quantity", "status", "requested_by", "created_at")
    list_filter = ("status",)


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "movement_type", "quantity", "reason", "created_at")


@admin.register(AcademicTarget)
class AcademicTargetAdmin(admin.ModelAdmin):
    list_display = ("id", "month_label", "required_classes", "school")


@admin.register(ExamSubmission)
class ExamSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "subject", "exam_type", "status", "scheduled_date", "school")
    list_filter = ("status", "exam_type")
    search_fields = ("title", "subject", "student_name")


@admin.register(ClassroomTeacherAllocation)
class ClassroomTeacherAllocationAdmin(admin.ModelAdmin):
    list_display = ("id", "classroom", "teacher", "subject", "created_at")


@admin.register(StudentParent)
class StudentParentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "guardian", "is_primary", "created_at")


@admin.register(StudentGuardian)
class StudentGuardianAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "guardian", "is_primary", "created_at")


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "name", "relation", "phone", "is_legal_guardian")
