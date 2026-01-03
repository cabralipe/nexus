import hashlib
import json
import secrets
import string
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

from django.contrib.auth import authenticate, get_user_model
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Avg, Count, F, Q, Sum
from django.http import JsonResponse
from django.conf import settings
from django.utils.dateparse import parse_date, parse_datetime, parse_time
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .gemini import generate_text
from .models import (
    ApiToken,
    AbsenceJustification,
    AcademicTarget,
    AttendanceRecord,
    ClassDiaryEntry,
    Classroom,
    ClassroomTeacherAllocation,
    ClassScheduleEntry,
    Conversation,
    EmergencyContact,
    ExamSubmission,
    Enrollment,
    FinancialTransaction,
    GradingConfig,
    GradeRecord,
    Guardian,
    InventoryItem,
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
    TimeSlot,
    TeacherAvailability,
    UploadAttachment,
    AuditLog,
    UserProfile,
)


SYSTEM_INSTRUCTION_INSIGHTS = (
    "You are an expert educational and financial data analyst for a school management SaaS. "
    "Keep answers concise, professional, and actionable. Use Markdown formatting."
)


def _parse_json(request) -> Dict[str, Any]:
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return {}


def _missing_fields(data: Dict[str, Any], required_fields) -> Dict[str, Any]:
    missing = [
        field
        for field in required_fields
        if field not in data or data.get(field) is None or data.get(field) == ""
    ]
    if missing:
        return {
            "error": "Missing required fields",
            "missing": missing,
        }
    return {}


def _get_token_from_request(request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Token "):
        return auth_header.replace("Token ", "", 1).strip()
    return ""


def _get_user_from_request(request) -> Optional[dict]:
    token_key = _get_token_from_request(request)
    if not token_key:
        return None
    token = ApiToken.objects.select_related("user").filter(key=token_key).first()
    if not token:
        return None
    token.touch()
    return {
        "user": token.user,
        "token": token,
    }


def _require_auth(request):
    auth = _get_user_from_request(request)
    if not auth:
        return None, JsonResponse({"error": "Unauthorized"}, status=401)
    return auth, None


def _require_profile_school(user):
    profile = UserProfile.objects.filter(user=user).select_related("school").first()
    if not profile or not profile.school:
        return None, JsonResponse({"error": "School not configured for user"}, status=400)
    return profile.school, None


def _require_roles(user, allowed_roles):
    profile = UserProfile.objects.filter(user=user).first()
    if not profile or profile.role not in allowed_roles:
        return JsonResponse({"error": "Forbidden"}, status=403)
    return None


def _paginate(request, queryset, serializer):
    try:
        page = int(request.GET.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.GET.get("page_size", 25))
    except (TypeError, ValueError):
        page_size = 25
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    paginator = Paginator(queryset, page_size)
    if paginator.count == 0:
        return {
            "data": [],
            "pagination": {
                "page": 1,
                "page_size": page_size,
                "total": 0,
                "total_pages": 0,
            },
        }
    try:
        page_obj = paginator.page(page)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)

    return {
        "data": [serializer(item) for item in page_obj.object_list],
        "pagination": {
            "page": page_obj.number,
            "page_size": page_size,
            "total": paginator.count,
            "total_pages": paginator.num_pages,
        },
    }


def _validate_choice(value, choices, field_name):
    valid_values = {choice for choice, _ in choices}
    if value not in valid_values:
        return JsonResponse(
            {"error": "Invalid value", "field": field_name, "allowed": sorted(valid_values)},
            status=400,
        )
    return None


def _parse_date_field(value, field_name):
    try:
        parsed = parse_date(value) if value else None
    except (TypeError, ValueError):
        parsed = None
    if value and not parsed:
        return None, JsonResponse({"error": "Invalid date", "field": field_name}, status=400)
    return parsed, None


def _parse_datetime_field(value, field_name):
    parsed = parse_datetime(value) if value else None
    if value and not parsed:
        return None, JsonResponse({"error": "Invalid datetime", "field": field_name}, status=400)
    return parsed, None


def _parse_decimal_field(value, field_name):
    if value is None:
        return None, JsonResponse({"error": "Invalid amount", "field": field_name}, status=400)
    try:
        return Decimal(str(value)), None
    except (InvalidOperation, ValueError):
        return None, JsonResponse({"error": "Invalid amount", "field": field_name}, status=400)


def _validate_password(value):
    if not value or len(value) < 8:
        return JsonResponse({"error": "Password too short", "min_length": 8}, status=400)
    return None


def _parse_grade_field(value, field_name):
    if value is None or value == "":
        return None, None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None, JsonResponse({"error": "Invalid grade", "field": field_name}, status=400)
    if parsed < 0 or parsed > 10:
        return None, JsonResponse({"error": "Grade out of range", "field": field_name}, status=400)
    return parsed, None


def _parse_time_field(value, field_name):
    parsed = parse_time(value) if value else None
    if value and not parsed:
        return None, JsonResponse({"error": "Invalid time", "field": field_name}, status=400)
    return parsed, None


def _validate_day_of_week(value):
    try:
        day = int(value)
    except (TypeError, ValueError):
        return None, JsonResponse({"error": "Invalid day_of_week"}, status=400)
    if day < 0 or day > 6:
        return None, JsonResponse({"error": "Invalid day_of_week"}, status=400)
    return day, None


def _check_schedule_conflicts(school, classroom, teacher, day_of_week, time_slot):
    conflict = ClassScheduleEntry.objects.filter(
        classroom__school=school,
        day_of_week=day_of_week,
        time_slot=time_slot,
    )
    if classroom:
        conflict = conflict.exclude(classroom=classroom)
    if conflict.exists():
        return JsonResponse({"error": "Classroom slot already occupied"}, status=400)
    if teacher:
        teacher_conflict = ClassScheduleEntry.objects.filter(
            classroom__school=school,
            teacher=teacher,
            day_of_week=day_of_week,
            time_slot=time_slot,
        )
        if classroom:
            teacher_conflict = teacher_conflict.exclude(classroom=classroom)
        if teacher_conflict.exists():
            return JsonResponse({"error": "Teacher slot already occupied"}, status=400)
        if TeacherAvailability.objects.filter(
            teacher=teacher,
            day_of_week=day_of_week,
            time_slot=time_slot,
        ).exists():
            return JsonResponse({"error": "Teacher unavailable in this slot"}, status=400)
    return None


def _log_action(user, school, action, detail, request):
    profile = UserProfile.objects.filter(user=user, school=school).first()
    ip_address = request.META.get("REMOTE_ADDR", "")
    AuditLog.objects.create(
        school=school,
        user=profile,
        action=action,
        detail=detail,
        ip_address=ip_address,
    )


def _calculate_term(config: Optional[GradingConfig], date_value):
    if not date_value:
        return ""
    month = date_value.month
    if config and config.system == GradingConfig.SYSTEM_TRIMESTRAL:
        if month <= 3:
            return "1"
        if month <= 6:
            return "2"
        if month <= 9:
            return "3"
        return "3"
    if month <= 2:
        return "1"
    if month <= 4:
        return "2"
    if month <= 6:
        return "3"
    if month <= 8:
        return "4"
    return "4"


def _calculate_final_grade(config: Optional[GradingConfig], grade1, grade2, recovery_grade):
    average = None
    if grade1 is not None and grade2 is not None:
        if config and config.calculation_method == GradingConfig.METHOD_WEIGHTED:
            weights = config.weights or {}
            exam_weight = Decimal(str(weights.get("exam", 50)))
            activities_weight = Decimal(str(weights.get("activities", 50)))
            total = exam_weight + activities_weight or Decimal("100")
            average = ((grade1 * exam_weight) + (grade2 * activities_weight)) / total
        else:
            average = (grade1 + grade2) / 2

    final_grade = average
    if recovery_grade is not None and average is not None:
        rule = (config.recovery_rule if config else "") or "replace"
        if rule == "average":
            final_grade = (average + recovery_grade) / 2
        elif rule == "max":
            final_grade = max(average, recovery_grade)
        else:
            final_grade = recovery_grade
    return average, final_grade


def _normalize_staff_role(value):
    if not value:
        return None
    mapping = {
        "teacher": UserProfile.ROLE_TEACHER,
        "student": UserProfile.ROLE_STUDENT,
        "coordinator": UserProfile.ROLE_COORDINATOR,
        "admin": UserProfile.ROLE_ADMIN,
        "support": UserProfile.ROLE_SUPPORT,
        "staff": UserProfile.ROLE_STAFF,
        "director": UserProfile.ROLE_DIRECTOR,
        "finance": UserProfile.ROLE_FINANCE,
    }
    normalized = str(value).strip().lower()
    return mapping.get(normalized, value)


def _staff_role_label(role):
    mapping = {
        UserProfile.ROLE_TEACHER: "Teacher",
        UserProfile.ROLE_STUDENT: "Student",
        UserProfile.ROLE_COORDINATOR: "Coordinator",
        UserProfile.ROLE_ADMIN: "Admin",
        UserProfile.ROLE_SUPPORT: "Support",
        UserProfile.ROLE_STAFF: "Support",
        UserProfile.ROLE_DIRECTOR: "Admin",
        UserProfile.ROLE_FINANCE: "Support",
    }
    return mapping.get(role, role)


def _normalize_tuition_status(value):
    if not value:
        return ""
    mapping = {
        "paid": "Paid",
        "late": "Late",
        "pending": "Pending",
    }
    normalized = str(value).strip().lower()
    return mapping.get(normalized, value)


def _serialize_school(school: School) -> Dict[str, Any]:
    return {
        "id": school.id,
        "name": school.name,
        "cnpj": school.cnpj,
        "email": school.email,
        "phone": school.phone,
        "address_line1": school.address_line1,
        "address_line2": school.address_line2,
        "city": school.city,
        "state": school.state,
        "postal_code": school.postal_code,
        "created_at": school.created_at.isoformat(),
    }


def _serialize_classroom(classroom: Classroom) -> Dict[str, Any]:
    return {
        "id": classroom.id,
        "school_id": classroom.school_id,
        "name": classroom.name,
        "grade": classroom.grade,
        "year": classroom.year,
        "gradeLevel": classroom.grade,
        "academicYear": classroom.year,
        "shift": classroom.shift,
        "capacity": classroom.capacity,
        "created_at": classroom.created_at.isoformat(),
    }


def _serialize_student(student: Student) -> Dict[str, Any]:
    return {
        "id": student.id,
        "school_id": student.school_id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "birth_date": student.birth_date.isoformat() if student.birth_date else None,
        "dob": student.birth_date.isoformat() if student.birth_date else None,
        "cpf": student.cpf,
        "main_address": student.main_address,
        "mainAddress": student.main_address,
        "reserve_address": student.reserve_address,
        "reserveAddress": student.reserve_address,
        "health_info": {
            "allergies": student.health_allergies or [],
            "medications": student.health_medications or [],
            "conditions": student.health_conditions,
            "bloodType": student.blood_type,
        },
        "enrollment_code": student.enrollment_code,
        "tuition_status": student.tuition_status,
        "tuitionStatus": student.tuition_status,
        "status": student.status,
        "emergency_contacts": [
            _serialize_emergency_contact(contact) for contact in student.emergency_contacts.all()
        ],
        "created_at": student.created_at.isoformat(),
    }


def _serialize_guardian(guardian: Guardian) -> Dict[str, Any]:
    return {
        "id": guardian.id,
        "school_id": guardian.school_id,
        "name": guardian.name,
        "relation": guardian.relation,
        "phone": guardian.phone,
        "email": guardian.email,
        "cpf": guardian.cpf,
        "created_at": guardian.created_at.isoformat(),
    }


def _serialize_parent_link(link: StudentParent) -> Dict[str, Any]:
    return {
        "id": link.id,
        "student_id": link.student_id,
        "guardian_id": link.guardian_id,
        "is_primary": link.is_primary,
        "created_at": link.created_at.isoformat(),
    }


def _serialize_emergency_contact(contact: EmergencyContact) -> Dict[str, Any]:
    return {
        "id": contact.id,
        "student_id": contact.student_id,
        "name": contact.name,
        "relation": contact.relation,
        "phone": contact.phone,
        "is_legal_guardian": contact.is_legal_guardian,
        "created_at": contact.created_at.isoformat(),
    }


def _serialize_enrollment(enrollment: Enrollment) -> Dict[str, Any]:
    return {
        "id": enrollment.id,
        "student_id": enrollment.student_id,
        "classroom_id": enrollment.classroom_id,
        "start_date": enrollment.start_date.isoformat(),
        "end_date": enrollment.end_date.isoformat() if enrollment.end_date else None,
        "status": enrollment.status,
        "created_at": enrollment.created_at.isoformat(),
    }


def _serialize_invoice(invoice: Invoice) -> Dict[str, Any]:
    return {
        "id": invoice.id,
        "student_id": invoice.student_id,
        "amount": str(invoice.amount),
        "due_date": invoice.due_date.isoformat(),
        "reference_month": invoice.reference_month.isoformat()
        if invoice.reference_month
        else None,
        "status": invoice.status,
        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
        "created_at": invoice.created_at.isoformat(),
    }


def _serialize_user(user, profile: Optional[UserProfile]) -> Dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "role": profile.role if profile else None,
        "school_id": profile.school_id if profile else None,
        "student_id": profile.student_id if profile else None,
        "department": profile.department if profile else None,
        "phone": profile.phone if profile else None,
        "admission_date": profile.admission_date.isoformat() if profile and profile.admission_date else None,
        "created_at": user.date_joined.isoformat() if user.date_joined else None,
    }


def _link_student_profile(profile: UserProfile, student: Student) -> Optional[JsonResponse]:
    if profile.school_id != student.school_id:
        return JsonResponse({"error": "Student does not belong to school"}, status=400)
    existing = UserProfile.objects.filter(student=student).exclude(id=profile.id).first()
    if existing:
        return JsonResponse({"error": "Student already linked to another user"}, status=409)
    profile.student = student
    profile.save(update_fields=["student"])
    return None


def _serialize_staff(profile: UserProfile) -> Dict[str, Any]:
    user = profile.user
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        "id": user.id,
        "name": name,
        "role": _staff_role_label(profile.role),
        "department": profile.department,
        "phone": profile.phone,
        "email": user.email,
        "admissionDate": profile.admission_date.isoformat() if profile.admission_date else None,
    }


def _serialize_allocation(allocation: ClassroomTeacherAllocation) -> Dict[str, Any]:
    return {
        "id": allocation.id,
        "classroom_id": allocation.classroom_id,
        "teacher_id": allocation.teacher.user_id,
        "subject": allocation.subject,
        "created_at": allocation.created_at.isoformat(),
    }


def _serialize_grade(record: GradeRecord) -> Dict[str, Any]:
    return {
        "id": record.id,
        "student_id": record.student_id,
        "classroom_id": record.classroom_id,
        "subject": record.subject,
        "term": record.term,
        "date": record.date.isoformat() if record.date else None,
        "grade1": float(record.grade1) if record.grade1 is not None else None,
        "grade2": float(record.grade2) if record.grade2 is not None else None,
        "recovery_grade": float(record.recovery_grade) if record.recovery_grade is not None else None,
        "average": float(record.average) if record.average is not None else None,
        "final_grade": float(record.final_grade) if record.final_grade is not None else None,
        "created_at": record.created_at.isoformat(),
    }


def _serialize_attendance(record: AttendanceRecord) -> Dict[str, Any]:
    justification = None
    try:
        justification_obj = record.justification
    except AbsenceJustification.DoesNotExist:
        justification_obj = None
    if justification_obj:
        justification = _serialize_justification(justification_obj)
    return {
        "id": record.id,
        "student_id": record.student_id,
        "classroom_id": record.classroom_id,
        "teacher_id": record.teacher_id,
        "date": record.date.isoformat(),
        "subject": record.subject,
        "status": record.status,
        "justification": justification,
        "justified": bool(justification and justification.get("status") == AbsenceJustification.STATUS_APPROVED),
        "created_at": record.created_at.isoformat(),
    }


def _serialize_diary(entry: ClassDiaryEntry) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "classroom_id": entry.classroom_id,
        "teacher_id": entry.teacher_id,
        "subject": entry.subject,
        "date": entry.date.isoformat(),
        "topic": entry.topic,
        "description": entry.description,
        "homework": entry.homework,
        "created_at": entry.created_at.isoformat(),
    }


def _serialize_material(material: LearningMaterial) -> Dict[str, Any]:
    return {
        "id": material.id,
        "classroom_id": material.classroom_id,
        "title": material.title,
        "type": material.material_type,
        "date": material.date.isoformat(),
        "size": material.size,
        "url": material.url,
        "created_at": material.created_at.isoformat(),
    }


def _serialize_syllabus(syllabus: Syllabus) -> Dict[str, Any]:
    return {
        "id": syllabus.id,
        "school_id": syllabus.school_id,
        "subject": syllabus.subject,
        "grade_level": syllabus.grade_level,
        "description": syllabus.description,
        "objectives": syllabus.objectives or [],
        "bibliography": syllabus.bibliography,
        "created_at": syllabus.created_at.isoformat(),
    }


def _serialize_grading_config(config: GradingConfig) -> Dict[str, Any]:
    return {
        "school_id": config.school_id,
        "system": config.system,
        "calculation_method": config.calculation_method,
        "min_passing_grade": str(config.min_passing_grade),
        "weights": config.weights or {},
        "recovery_rule": config.recovery_rule,
        "updated_at": config.updated_at.isoformat(),
    }


def _serialize_transaction(transaction: FinancialTransaction) -> Dict[str, Any]:
    return {
        "id": transaction.id,
        "school_id": transaction.school_id,
        "invoice_id": transaction.invoice_id,
        "description": transaction.description,
        "category": transaction.category,
        "amount": str(transaction.amount),
        "type": transaction.transaction_type,
        "status": transaction.status,
        "date": transaction.date.isoformat(),
        "created_at": transaction.created_at.isoformat(),
    }


def _serialize_inventory_item(item: InventoryItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "school_id": item.school_id,
        "name": item.name,
        "category": item.category,
        "quantity": item.quantity,
        "minQuantity": item.min_quantity,
        "unit": item.unit,
        "location": item.location,
        "lastUpdated": item.updated_at.isoformat(),
        "created_at": item.created_at.isoformat(),
    }


def _serialize_academic_target(target: AcademicTarget) -> Dict[str, Any]:
    return {
        "id": target.id,
        "school_id": target.school_id,
        "month": target.month_label,
        "requiredClasses": target.required_classes,
        "gradeSubmissionDeadline": target.grade_submission_deadline.isoformat(),
        "examSubmissionDeadline": target.exam_submission_deadline.isoformat(),
        "created_at": target.created_at.isoformat(),
    }


def _serialize_exam_submission(exam: ExamSubmission) -> Dict[str, Any]:
    teacher_name = ""
    if exam.submitted_by and exam.submitted_by.user:
        teacher_name = (
            f"{exam.submitted_by.user.first_name} {exam.submitted_by.user.last_name}".strip()
            or exam.submitted_by.user.username
        )
    attachments = UploadAttachment.objects.filter(
        entity_type=UploadAttachment.ENTITY_EXAM,
        entity_id=str(exam.id),
    ).order_by("-created_at")
    return {
        "id": exam.id,
        "school_id": exam.school_id,
        "title": exam.title,
        "subject": exam.subject,
        "gradeLevel": exam.grade_level,
        "type": exam.exam_type,
        "status": exam.status,
        "submittedDate": exam.submitted_at.date().isoformat(),
        "scheduledDate": exam.scheduled_date.isoformat() if exam.scheduled_date else None,
        "teacherName": teacher_name,
        "studentName": exam.student_name or None,
        "feedback": exam.feedback or None,
        "decidedAt": exam.decided_at.isoformat() if exam.decided_at else None,
        "attachments": [_serialize_upload(upload) for upload in attachments],
    }


def _serialize_notice(notice: Notice) -> Dict[str, Any]:
    author_name = ""
    if notice.author and notice.author.user:
        author_name = (
            f"{notice.author.user.first_name} {notice.author.user.last_name}".strip()
            or notice.author.user.username
        )
    return {
        "id": notice.id,
        "school_id": notice.school_id,
        "title": notice.title,
        "content": notice.content,
        "type": notice.notice_type,
        "author": author_name,
        "date": notice.date.isoformat(),
        "created_at": notice.created_at.isoformat(),
    }


def _serialize_conversation(conversation: Conversation) -> Dict[str, Any]:
    student_name = (
        f"{conversation.student.first_name} {conversation.student.last_name}".strip()
        or conversation.student.first_name
    )
    return {
        "id": conversation.id,
        "student_id": conversation.student_id,
        "student_name": student_name,
        "created_at": conversation.created_at.isoformat(),
    }


def _serialize_message(message: Message) -> Dict[str, Any]:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_type": message.sender_type,
        "sender_id": message.sender_profile.user_id if message.sender_profile else None,
        "text": message.text,
        "sent_at": message.sent_at.isoformat(),
    }


def _serialize_time_slot(slot: TimeSlot) -> Dict[str, Any]:
    return {
        "id": slot.id,
        "school_id": slot.school_id,
        "label": slot.label,
        "start_time": slot.start_time.strftime("%H:%M"),
        "end_time": slot.end_time.strftime("%H:%M"),
        "sort_order": slot.sort_order,
        "created_at": slot.created_at.isoformat(),
    }


def _serialize_availability(availability: TeacherAvailability) -> Dict[str, Any]:
    return {
        "id": availability.id,
        "teacher_id": availability.teacher.user_id,
        "time_slot_id": availability.time_slot_id,
        "day_of_week": availability.day_of_week,
        "created_at": availability.created_at.isoformat(),
    }


def _serialize_schedule(entry: ClassScheduleEntry) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "classroom_id": entry.classroom_id,
        "time_slot_id": entry.time_slot_id,
        "day_of_week": entry.day_of_week,
        "subject": entry.subject,
        "teacher_id": entry.teacher.user_id if entry.teacher else None,
        "created_at": entry.created_at.isoformat(),
    }


def _serialize_upload(upload: UploadAttachment) -> Dict[str, Any]:
    return {
        "id": upload.id,
        "school_id": upload.school_id,
        "entity_type": upload.entity_type,
        "entity_id": upload.entity_id,
        "url": upload.file.url if upload.file else "",
        "original_name": upload.original_name,
        "content_type": upload.content_type,
        "size": upload.size,
        "created_at": upload.created_at.isoformat(),
    }


def _serialize_audit_log(entry: AuditLog) -> Dict[str, Any]:
    user_name = ""
    if entry.user and entry.user.user:
        user_name = (
            f"{entry.user.user.first_name} {entry.user.user.last_name}".strip()
            or entry.user.user.username
        )
    return {
        "id": entry.id,
        "school_id": entry.school_id,
        "user": user_name,
        "action": entry.action,
        "detail": entry.detail,
        "ip": entry.ip_address,
        "created_at": entry.created_at.isoformat(),
    }


def _generate_password(length=10):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _serialize_justification(justification: AbsenceJustification) -> Dict[str, Any]:
    created_by_name = ""
    if justification.created_by and justification.created_by.user:
        created_by_name = (
            f"{justification.created_by.user.first_name} {justification.created_by.user.last_name}".strip()
            or justification.created_by.user.username
        )
    decided_by_name = ""
    if justification.decided_by and justification.decided_by.user:
        decided_by_name = (
            f"{justification.decided_by.user.first_name} {justification.decided_by.user.last_name}".strip()
            or justification.decided_by.user.username
        )
    return {
        "id": justification.id,
        "attendance_id": justification.attendance_id,
        "attendance_subject": justification.attendance.subject if justification.attendance else "",
        "reason": justification.reason,
        "observation": justification.observation,
        "status": justification.status,
        "created_by": created_by_name,
        "decided_by": decided_by_name,
        "decided_at": justification.decided_at.isoformat() if justification.decided_at else None,
        "created_at": justification.created_at.isoformat(),
        "updated_at": justification.updated_at.isoformat(),
    }

def _issue_password_reset_token(user):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = timezone.now() + timezone.timedelta(hours=1)
    PasswordResetToken.objects.filter(
        user=user, used_at__isnull=True, expires_at__gt=timezone.now()
    ).update(used_at=timezone.now())
    PasswordResetToken.objects.create(user=user, token_hash=token_hash, expires_at=expires_at)
    return token, expires_at


@csrf_exempt
@require_POST
def register_user(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["username", "email", "password"])
    if error:
        return JsonResponse(error, status=400)
    password_error = _validate_password(payload.get("password"))
    if password_error:
        return password_error

    User = get_user_model()
    if User.objects.filter(username=payload["username"]).exists():
        return JsonResponse({"error": "Username already exists"}, status=409)
    if User.objects.filter(email=payload["email"]).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)

    user = User.objects.create_user(
        username=payload["username"],
        email=payload["email"],
        password=payload["password"],
    )

    school = None
    school_name = payload.get("school_name")
    if school_name:
        school = School.objects.create(name=school_name)

    role = UserProfile.ROLE_ADMIN if school else UserProfile.ROLE_STAFF
    UserProfile.objects.create(user=user, school=school, role=role)

    token = ApiToken.issue_for_user(user)
    return JsonResponse(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": role,
                "school_id": school.id if school else None,
            },
        },
        status=201,
    )


@csrf_exempt
@require_POST
def login_user(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["username_or_email", "password"])
    if error:
        return JsonResponse(error, status=400)

    identifier = payload["username_or_email"]
    User = get_user_model()
    username = identifier
    if "@" in identifier:
        user = User.objects.filter(email=identifier).first()
        if user:
            username = user.username

    user = authenticate(request, username=username, password=payload["password"])
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    token = ApiToken.issue_for_user(user)
    profile = UserProfile.objects.filter(user=user).first()
    return JsonResponse(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": profile.role if profile else None,
                "school_id": profile.school_id if profile else None,
                "student_id": profile.student_id if profile else None,
            },
        }
    )


@csrf_exempt
@require_POST
def logout_user(request):
    auth = _get_user_from_request(request)
    if not auth:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    auth["token"].delete()
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def refresh_token(request):
    auth = _get_user_from_request(request)
    if not auth:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    auth["token"].delete()
    token = ApiToken.issue_for_user(auth["user"])
    return JsonResponse({"token": token.key})


@csrf_exempt
@require_POST
def request_password_reset(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["email"])
    if error:
        return JsonResponse(error, status=400)

    User = get_user_model()
    user = User.objects.filter(email=payload["email"]).first()
    response_payload = {"success": True}
    if user:
        token, expires_at = _issue_password_reset_token(user)
        if settings.DEBUG:
            response_payload["token"] = token
            response_payload["expires_at"] = expires_at.isoformat()
    return JsonResponse(response_payload)


@csrf_exempt
@require_POST
def confirm_password_reset(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["email", "token", "new_password"])
    if error:
        return JsonResponse(error, status=400)

    password_error = _validate_password(payload.get("new_password"))
    if password_error:
        return password_error

    User = get_user_model()
    user = User.objects.filter(email=payload["email"]).first()
    if not user:
        return JsonResponse({"error": "Invalid token"}, status=400)

    token_hash = hashlib.sha256(payload["token"].encode("utf-8")).hexdigest()
    reset_token = PasswordResetToken.objects.filter(
        user=user,
        token_hash=token_hash,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not reset_token:
        return JsonResponse({"error": "Invalid token"}, status=400)

    user.set_password(payload["new_password"])
    user.save()
    reset_token.used_at = timezone.now()
    reset_token.save(update_fields=["used_at"])
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def revoke_token(request):
    auth = _get_user_from_request(request)
    if not auth:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    payload = _parse_json(request)
    token_key = payload.get("token_key")
    if token_key:
        role_error = _require_roles(
            auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR]
        )
        if role_error:
            return role_error
        token = ApiToken.objects.filter(key=token_key).first()
        if not token:
            return JsonResponse({"error": "Not found"}, status=404)
        token.delete()
        return JsonResponse({"success": True})

    auth["token"].delete()
    return JsonResponse({"success": True})


@require_GET
def get_me(request):
    auth = _get_user_from_request(request)
    if not auth:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    user = auth["user"]
    profile = UserProfile.objects.filter(user=user).select_related("school").first()
    return JsonResponse(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": profile.role if profile else None,
            "student_id": profile.student_id if profile else None,
            "school": {
                "id": profile.school.id,
                "name": profile.school.name,
            }
            if profile and profile.school
            else None,
        }
    )


@require_GET
def dashboard_admin(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_FINANCE,
            UserProfile.ROLE_COORDINATOR,
        ],
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    today = timezone.localdate()
    start_month = today.replace(day=1)

    students_count = Student.objects.filter(school=school).count()
    staff_count = UserProfile.objects.filter(school=school).count()
    classrooms_count = Classroom.objects.filter(school=school).count()

    invoices_qs = Invoice.objects.filter(student__school=school)
    invoices_total = invoices_qs.count()
    invoices_overdue = invoices_qs.filter(status=Invoice.STATUS_OVERDUE).count()
    invoices_open = invoices_qs.filter(status=Invoice.STATUS_OPEN).count()

    income = (
        FinancialTransaction.objects.filter(
            school=school,
            transaction_type=FinancialTransaction.TYPE_INCOME,
            date__gte=start_month,
            date__lte=today,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )
    expense = (
        FinancialTransaction.objects.filter(
            school=school,
            transaction_type=FinancialTransaction.TYPE_EXPENSE,
            date__gte=start_month,
            date__lte=today,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )

    attendance_summary = AttendanceRecord.objects.filter(
        classroom__school=school, date=today
    ).values("status").annotate(count=Count("id"))
    attendance_by_status = {item["status"]: item["count"] for item in attendance_summary}

    recent_notices = Notice.objects.filter(school=school).order_by("-date", "-created_at")[:5]

    enrollment_counts = (
        Enrollment.objects.filter(classroom__school=school, status=Enrollment.STATUS_ACTIVE)
        .values("classroom__grade")
        .annotate(total=Count("id"))
        .order_by("classroom__grade")
    )
    enrollment_by_grade = [
        {"name": item["classroom__grade"] or "Sem serie", "value": item["total"]}
        for item in enrollment_counts
    ]

    start_period = (today.replace(day=1) - timezone.timedelta(days=180)).replace(day=1)
    finance_qs = FinancialTransaction.objects.filter(
        school=school,
        date__gte=start_period,
        date__lte=today,
    )
    finance_monthly = {}
    for item in finance_qs.values("date", "transaction_type").annotate(total=Sum("amount")):
        month_key = item["date"].strftime("%Y-%m")
        finance_monthly.setdefault(month_key, {"income": Decimal("0"), "expense": Decimal("0")})
        if item["transaction_type"] == FinancialTransaction.TYPE_INCOME:
            finance_monthly[month_key]["income"] += item["total"] or Decimal("0")
        else:
            finance_monthly[month_key]["expense"] += item["total"] or Decimal("0")

    finance_series = [
        {
            "name": key,
            "income": float(values["income"]),
            "expense": float(values["expense"]),
        }
        for key, values in sorted(finance_monthly.items())
    ]

    delinquency_rate = (
        (invoices_overdue / invoices_total) * 100 if invoices_total else 0
    )

    return JsonResponse(
        {
            "counts": {
                "students": students_count,
                "staff": staff_count,
                "classrooms": classrooms_count,
            },
            "invoices": {
                "total": invoices_total,
                "open": invoices_open,
                "overdue": invoices_overdue,
                "delinquency_rate": round(delinquency_rate, 2),
            },
            "finance_month": {
                "income": str(income),
                "expense": str(expense),
                "net": str(income - expense),
            },
            "finance_series": finance_series,
            "enrollment_by_grade": enrollment_by_grade,
            "attendance_today": attendance_by_status,
            "recent_notices": [_serialize_notice(notice) for notice in recent_notices],
        }
    )


@require_GET
def dashboard_teacher(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_TEACHER, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    if not profile:
        return JsonResponse({"error": "User profile not found"}, status=404)

    allocations = ClassroomTeacherAllocation.objects.filter(teacher=profile).select_related(
        "classroom"
    )
    classes_count = allocations.values("classroom_id").distinct().count()
    subjects_count = allocations.values("subject").distinct().count()

    schedule_entries = (
        ClassScheduleEntry.objects.filter(teacher=profile, classroom__school=school)
        .select_related("classroom", "time_slot")
        .order_by("day_of_week", "time_slot__sort_order")
    )
    schedule = [
        {
            "id": entry.id,
            "classroom": entry.classroom.name,
            "subject": entry.subject,
            "day_of_week": entry.day_of_week,
            "time_slot": {
                "label": entry.time_slot.label,
                "start_time": entry.time_slot.start_time.strftime("%H:%M"),
                "end_time": entry.time_slot.end_time.strftime("%H:%M"),
            },
        }
        for entry in schedule_entries
    ]

    today = timezone.localdate()
    today_entries = [
        entry
        for entry in schedule_entries
        if entry.day_of_week == today.weekday()
    ]
    today_schedule = [
        {
            "id": entry.id,
            "classroom": entry.classroom.name,
            "subject": entry.subject,
            "time": f"{entry.time_slot.start_time.strftime('%H:%M')} - {entry.time_slot.end_time.strftime('%H:%M')}",
            "room": entry.classroom.name,
        }
        for entry in today_entries
    ]

    week_start = timezone.localdate() - timezone.timedelta(days=7)
    diary_last7 = ClassDiaryEntry.objects.filter(
        teacher=profile, classroom__school=school, date__gte=week_start
    ).count()

    recent_notices = Notice.objects.filter(school=school).order_by("-date", "-created_at")[:3]

    pending_diary = max(0, classes_count * 5 - diary_last7)

    return JsonResponse(
        {
            "counts": {
                "classes": classes_count,
                "subjects": subjects_count,
                "diary_entries_last7": diary_last7,
                "pending_diary": pending_diary,
            },
            "schedule": schedule,
            "today_schedule": today_schedule,
            "recent_notices": [_serialize_notice(notice) for notice in recent_notices],
        }
    )


@require_GET
def dashboard_student(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_STUDENT,
        ],
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    student_id = request.GET.get("student_id")
    if not student_id:
        profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
        if profile and profile.student_id:
            student_id = str(profile.student_id)
    if not student_id:
        return JsonResponse({"error": "student_id is required"}, status=400)
    student = Student.objects.filter(id=student_id, school=school).first()
    if not student:
        return JsonResponse({"error": "Student not found"}, status=404)

    attendance_summary = AttendanceRecord.objects.filter(student=student).values("status").annotate(
        count=Count("id")
    )
    attendance_by_status = {item["status"]: item["count"] for item in attendance_summary}

    grades = GradeRecord.objects.filter(student=student)
    average_final_grade = grades.aggregate(avg=Avg("final_grade"))["avg"]

    invoices = Invoice.objects.filter(student=student).order_by("-due_date")[:5]
    next_invoice = (
        Invoice.objects.filter(student=student, status=Invoice.STATUS_OPEN)
        .order_by("due_date")
        .first()
    )
    upcoming_exams = ExamSubmission.objects.filter(
        school=school,
        scheduled_date__gte=timezone.localdate(),
    ).order_by("scheduled_date")[:5]
    recent_notices = Notice.objects.filter(school=school).order_by("-date", "-created_at")[:3]

    return JsonResponse(
        {
            "student": _serialize_student(student),
            "attendance": attendance_by_status,
            "grades": {
                "average_final": float(average_final_grade)
                if average_final_grade is not None
                else None
            },
            "invoices": [_serialize_invoice(invoice) for invoice in invoices],
            "next_invoice": _serialize_invoice(next_invoice) if next_invoice else None,
            "upcoming_events": [
                {
                    "date": exam.scheduled_date.isoformat() if exam.scheduled_date else None,
                    "subject": exam.subject,
                    "type": "Prova" if exam.exam_type == ExamSubmission.TYPE_STANDARD else "Prova Adaptada",
                    "status": exam.status,
                }
                for exam in upcoming_exams
            ],
            "recent_notices": [_serialize_notice(notice) for notice in recent_notices],
        }
    )


@require_GET
def teacher_activities(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
        ],
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    now = timezone.now()
    teachers = UserProfile.objects.select_related("user").filter(
        school=school, role=UserProfile.ROLE_TEACHER
    )
    allocations = ClassroomTeacherAllocation.objects.filter(
        classroom__school=school, teacher__in=teachers
    ).select_related("classroom", "teacher")
    allocations_by_teacher = {}
    for alloc in allocations:
        allocations_by_teacher.setdefault(alloc.teacher_id, []).append(alloc)

    data = []
    for profile in teachers:
        user = profile.user
        name = f"{user.first_name} {user.last_name}".strip() or user.username
        subject = ""
        teacher_allocs = allocations_by_teacher.get(profile.id, [])
        if teacher_allocs:
            subject = ", ".join(sorted({alloc.subject for alloc in teacher_allocs}))

        last_diary = (
            ClassDiaryEntry.objects.filter(teacher=profile, classroom__school=school)
            .order_by("-date")
            .first()
        )
        last_attendance = (
            AttendanceRecord.objects.filter(teacher=profile)
            .order_by("-date")
            .first()
        )

        last_login = user.last_login
        last_activity = max(
            [
                dt
                for dt in [
                    last_login.date() if last_login else None,
                    last_diary.date if last_diary else None,
                    last_attendance.date if last_attendance else None,
                ]
                if dt
            ],
            default=None,
        )

        status = "Idle"
        if last_activity:
            delta_days = (now.date() - last_activity).days
            if delta_days <= 7:
                status = "Active"
            elif delta_days <= 14:
                status = "Warning"
            else:
                status = "Idle"

        data.append(
            {
                "id": profile.id,
                "name": name,
                "subject": subject or "Sem disciplina",
                "lastLogin": last_login.isoformat() if last_login else None,
                "lastDiaryUpdate": last_diary.date.isoformat() if last_diary else None,
                "lastAttendanceUpdate": last_attendance.date.isoformat() if last_attendance else None,
                "status": status,
            }
        )

    summary = {
        "active": sum(1 for item in data if item["status"] == "Active"),
        "warning": sum(1 for item in data if item["status"] == "Warning"),
        "idle": sum(1 for item in data if item["status"] == "Idle"),
        "total": len(data),
    }
    return JsonResponse({"summary": summary, "data": data})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def users(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR])
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = UserProfile.objects.select_related("user").filter(school=school).order_by(
            "user__username"
        )
        if "school_id" in request.GET and str(school.id) != str(request.GET.get("school_id")):
            return JsonResponse({"error": "Forbidden"}, status=403)
        if "role" in request.GET:
            items = items.filter(role=request.GET.get("role"))
        if "q" in request.GET:
            search = request.GET.get("q")
            items = items.filter(
                Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
            )
        return JsonResponse(
            _paginate(request, items, lambda profile: _serialize_user(profile.user, profile))
        )

    payload = _parse_json(request)
    error = _missing_fields(payload, ["username", "email", "password", "role"])
    if error:
        return JsonResponse(error, status=400)
    if "role" in payload:
        payload["role"] = _normalize_staff_role(payload["role"])
        role_error = _validate_choice(payload["role"], UserProfile.ROLE_CHOICES, "role")
        if role_error:
            return role_error
    password_error = _validate_password(payload.get("password"))
    if password_error:
        return password_error

    User = get_user_model()
    if User.objects.filter(username=payload["username"]).exists():
        return JsonResponse({"error": "Username already exists"}, status=409)
    if User.objects.filter(email=payload["email"]).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)

    user = User.objects.create_user(
        username=payload["username"],
        email=payload["email"],
        password=payload["password"],
    )
    school_id = payload.get("school_id")
    if school_id and str(school.id) != str(school_id):
        return JsonResponse({"error": "Forbidden"}, status=403)
    if school_id and not School.objects.filter(id=school_id).exists():
        return JsonResponse({"error": "Invalid school"}, status=400)

    profile = UserProfile.objects.create(
        user=user,
        school=school,
        role=payload["role"],
    )
    if payload.get("student_id"):
        student = Student.objects.filter(id=payload.get("student_id"), school=school).first()
        if not student:
            return JsonResponse({"error": "Invalid student"}, status=400)
        link_error = _link_student_profile(profile, student)
        if link_error:
            return link_error
    _log_action(
        auth["user"],
        school,
        "user_created",
        str(user.id),
        request,
    )
    return JsonResponse({"data": _serialize_user(user, profile)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def user_detail(request, user_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR])
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    User = get_user_model()
    user = User.objects.filter(id=user_id).first()
    if not user:
        return JsonResponse({"error": "Not found"}, status=404)
    profile = UserProfile.objects.filter(user=user).first()
    if profile and profile.school_id != school.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_user(user, profile)})
    if request.method == "DELETE":
        if user == auth["user"]:
            return JsonResponse({"error": "Cannot delete current user"}, status=400)
        user.delete()
        _log_action(
            auth["user"],
            school,
            "user_deleted",
            str(user_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "email" in payload and User.objects.exclude(id=user.id).filter(email=payload["email"]).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)
    if "username" in payload and User.objects.exclude(id=user.id).filter(
        username=payload["username"]
    ).exists():
        return JsonResponse({"error": "Username already exists"}, status=409)
    if "password" in payload:
        password_error = _validate_password(payload.get("password"))
        if password_error:
            return password_error
        user.set_password(payload["password"])
    if "username" in payload:
        user.username = payload["username"]
    if "email" in payload:
        user.email = payload["email"]
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])
    user.save()

    if profile:
        if "role" in payload:
            payload["role"] = _normalize_staff_role(payload["role"])
            role_error = _validate_choice(payload["role"], UserProfile.ROLE_CHOICES, "role")
            if role_error:
                return role_error
            profile.role = payload["role"]
        if "student_id" in payload:
            if payload["student_id"]:
                student = Student.objects.filter(id=payload["student_id"], school=school).first()
                if not student:
                    return JsonResponse({"error": "Invalid student"}, status=400)
                link_error = _link_student_profile(profile, student)
                if link_error:
                    return link_error
            else:
                profile.student = None
        if "school_id" in payload:
            if str(school.id) != str(payload["school_id"]):
                return JsonResponse({"error": "Forbidden"}, status=403)
            if not School.objects.filter(id=payload["school_id"]).exists():
                return JsonResponse({"error": "Invalid school"}, status=400)
            profile.school = school
        profile.save()
    _log_action(
        auth["user"],
        school,
        "user_updated",
        str(user.id),
        request,
    )
    return JsonResponse({"data": _serialize_user(user, profile)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def staff(request):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR]
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = UserProfile.objects.select_related("user").filter(school=school)
        if "role" in request.GET:
            role = _normalize_staff_role(request.GET.get("role"))
            items = items.filter(role=role)
        if "q" in request.GET:
            search = request.GET.get("q")
            items = items.filter(
                Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(department__icontains=search)
            )
        items = items.order_by("user__first_name", "user__last_name")
        return JsonResponse(_paginate(request, items, _serialize_staff))

    payload = _parse_json(request)
    error = _missing_fields(payload, ["name", "email", "role"])
    if error:
        return JsonResponse(error, status=400)
    role_value = _normalize_staff_role(payload.get("role"))
    if role_value:
        role_error = _validate_choice(role_value, UserProfile.ROLE_CHOICES, "role")
        if role_error:
            return role_error
    auto_password = payload.get("auto_password", True)
    password = payload.get("password") if not auto_password else _generate_password()
    password_error = _validate_password(password)
    if password_error:
        return password_error

    User = get_user_model()
    if User.objects.filter(email=payload["email"]).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)

    base_username = payload.get("username") or payload["email"].split("@")[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        counter += 1
        username = f"{base_username}-{counter}"

    name_parts = payload.get("name", "").split(" ", 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    user = User.objects.create_user(
        username=username,
        email=payload["email"],
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    admission_date, date_error = _parse_date_field(
        payload.get("admissionDate") or payload.get("admission_date"), "admissionDate"
    )
    if date_error:
        return date_error
    profile = UserProfile.objects.create(
        user=user,
        school=school,
        role=role_value or UserProfile.ROLE_STAFF,
        department=payload.get("department", ""),
        phone=payload.get("phone", ""),
        admission_date=admission_date,
    )
    _log_action(
        auth["user"],
        school,
        "staff_created",
        str(profile.user_id),
        request,
    )
    return JsonResponse(
        {
            "data": _serialize_staff(profile),
            "user_credentials": {
                "username": user.username,
                "password": password,
                "user_id": user.id,
                "profile_id": profile.id,
            },
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def staff_detail(request, staff_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    role_error = _require_roles(
        auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR]
    )
    if role_error:
        return role_error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    User = get_user_model()
    user = User.objects.filter(id=staff_id).first()
    if not user:
        return JsonResponse({"error": "Not found"}, status=404)
    profile = UserProfile.objects.filter(user=user, school=school).first()
    if not profile:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_staff(profile)})
    if request.method == "DELETE":
        if user == auth["user"]:
            return JsonResponse({"error": "Cannot delete current user"}, status=400)
        user.delete()
        _log_action(
            auth["user"],
            school,
            "staff_deleted",
            str(staff_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "email" in payload and User.objects.exclude(id=user.id).filter(email=payload["email"]).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)
    if "username" in payload and User.objects.exclude(id=user.id).filter(
        username=payload["username"]
    ).exists():
        return JsonResponse({"error": "Username already exists"}, status=409)
    if "password" in payload:
        password_error = _validate_password(payload.get("password"))
        if password_error:
            return password_error
        user.set_password(payload["password"])
    if "name" in payload:
        name_parts = payload.get("name", "").split(" ", 1)
        user.first_name = name_parts[0] if name_parts else ""
        user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    if "email" in payload:
        user.email = payload["email"]
    if "username" in payload:
        user.username = payload["username"]
    user.save()

    if "role" in payload:
        role_value = _normalize_staff_role(payload.get("role"))
        role_error = _validate_choice(role_value, UserProfile.ROLE_CHOICES, "role")
        if role_error:
            return role_error
        profile.role = role_value
    if "department" in payload:
        profile.department = payload["department"]
    if "phone" in payload:
        profile.phone = payload["phone"]
    if "admissionDate" in payload or "admission_date" in payload:
        admission_date, date_error = _parse_date_field(
            payload.get("admissionDate") or payload.get("admission_date"), "admissionDate"
        )
        if date_error:
            return date_error
        profile.admission_date = admission_date
    profile.save()
    _log_action(
        auth["user"],
        school,
        "staff_updated",
        str(profile.user_id),
        request,
    )
    return JsonResponse({"data": _serialize_staff(profile)})
@csrf_exempt
@require_http_methods(["GET", "POST"])
def schools(request):
    auth, error = _require_auth(request)
    if error:
        return error
    if request.method == "GET":
        profile = UserProfile.objects.filter(user=auth["user"]).select_related("school").first()
        if not profile or not profile.school:
            return JsonResponse({"data": [], "pagination": {"page": 1, "page_size": 25, "total": 0, "total_pages": 0}})
        return JsonResponse(
            {
                "data": [_serialize_school(profile.school)],
                "pagination": {"page": 1, "page_size": 25, "total": 1, "total_pages": 1},
            }
        )

    payload = _parse_json(request)
    error = _missing_fields(payload, ["name"])
    if error:
        return JsonResponse(error, status=400)
    role_error = _require_roles(
        auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR]
    )
    if role_error:
        return role_error

    school = School.objects.create(
        name=payload["name"],
        cnpj=payload.get("cnpj") or None,
        email=payload.get("email", ""),
        phone=payload.get("phone", ""),
        address_line1=payload.get("address_line1", ""),
        address_line2=payload.get("address_line2", ""),
        city=payload.get("city", ""),
        state=payload.get("state", ""),
        postal_code=payload.get("postal_code", ""),
    )
    _log_action(
        auth["user"],
        school,
        "school_created",
        school.name,
        request,
    )

    UserProfile.objects.update_or_create(
        user=auth["user"], defaults={"school": school, "role": UserProfile.ROLE_ADMIN}
    )
    return JsonResponse({"data": _serialize_school(school)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def school_detail(request, school_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    profile = UserProfile.objects.filter(user=auth["user"]).first()
    if not profile or profile.school_id != school_id:
        return JsonResponse({"error": "Forbidden"}, status=403)
    role_error = _require_roles(
        auth["user"], [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR]
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    School.objects.filter(id=school_id).update(
        name=payload.get("name", profile.school.name),
        cnpj=payload.get("cnpj", profile.school.cnpj),
        email=payload.get("email", profile.school.email),
        phone=payload.get("phone", profile.school.phone),
        address_line1=payload.get("address_line1", profile.school.address_line1),
        address_line2=payload.get("address_line2", profile.school.address_line2),
        city=payload.get("city", profile.school.city),
        state=payload.get("state", profile.school.state),
        postal_code=payload.get("postal_code", profile.school.postal_code),
    )
    profile.refresh_from_db(fields=["school"])
    _log_action(
        auth["user"],
        profile.school,
        "school_updated",
        str(profile.school.id),
        request,
    )
    return JsonResponse({"data": _serialize_school(profile.school)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def classrooms(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Classroom.objects.filter(school=school)
        if "year" in request.GET:
            items = items.filter(year=request.GET.get("year"))
        if "shift" in request.GET:
            items = items.filter(shift=request.GET.get("shift"))
        if "grade" in request.GET:
            items = items.filter(grade__icontains=request.GET.get("grade"))
        if "name" in request.GET:
            items = items.filter(name__icontains=request.GET.get("name"))
        items = items.order_by("-year", "name")
        return JsonResponse(_paginate(request, items, _serialize_classroom))

    payload = _parse_json(request)
    if not payload.get("name") or not (payload.get("year") or payload.get("academicYear")):
        return JsonResponse(
            {"error": "Missing required fields", "missing": ["name", "year"]}, status=400
        )
    year_value = payload.get("year") or payload.get("academicYear")
    try:
        year_value = int(year_value)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid year"}, status=400)

    if "shift" in payload:
        shift_error = _validate_choice(payload["shift"], Classroom.SHIFT_CHOICES, "shift")
        if shift_error:
            return shift_error
    if "capacity" in payload:
        try:
            capacity = int(payload["capacity"])
            if capacity <= 0:
                return JsonResponse({"error": "Invalid capacity"}, status=400)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid capacity"}, status=400)
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error
    classroom = Classroom.objects.create(
        school=school,
        name=payload["name"],
        grade=payload.get("grade") or payload.get("gradeLevel", ""),
        year=year_value,
        shift=payload.get("shift", Classroom.SHIFT_MORNING),
        capacity=int(payload.get("capacity", 30)),
    )
    _log_action(
        auth["user"],
        school,
        "classroom_created",
        str(classroom.id),
        request,
    )
    return JsonResponse({"data": _serialize_classroom(classroom)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def classroom_detail(request, classroom_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    classroom = Classroom.objects.filter(id=classroom_id, school=school).first()
    if not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_classroom(classroom)})
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error
    if request.method == "DELETE":
        classroom.delete()
        _log_action(
            auth["user"],
            school,
            "classroom_deleted",
            str(classroom_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "shift" in payload:
        shift_error = _validate_choice(payload["shift"], Classroom.SHIFT_CHOICES, "shift")
        if shift_error:
            return shift_error
    if "capacity" in payload:
        try:
            capacity = int(payload["capacity"])
            if capacity <= 0:
                return JsonResponse({"error": "Invalid capacity"}, status=400)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid capacity"}, status=400)
    if "name" in payload:
        classroom.name = payload["name"]
    if "grade" in payload or "gradeLevel" in payload:
        classroom.grade = payload.get("grade") or payload.get("gradeLevel", "")
    if "year" in payload or "academicYear" in payload:
        try:
            classroom.year = int(payload.get("year") or payload.get("academicYear"))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid year"}, status=400)
    if "shift" in payload:
        classroom.shift = payload["shift"]
    if "capacity" in payload:
        classroom.capacity = int(payload["capacity"])
    classroom.save()
    _log_action(
        auth["user"],
        school,
        "classroom_updated",
        str(classroom.id),
        request,
    )
    return JsonResponse({"data": _serialize_classroom(classroom)})


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def classroom_allocations(request, classroom_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error
    classroom = Classroom.objects.filter(id=classroom_id, school=school).first()
    if not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        allocations = ClassroomTeacherAllocation.objects.filter(classroom=classroom).order_by(
            "subject"
        )
        return JsonResponse({"data": [_serialize_allocation(a) for a in allocations]})

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["subject", "teacher_id"])
    if error:
        return JsonResponse(error, status=400)

    teacher = UserProfile.objects.filter(
        Q(id=payload["teacher_id"]) | Q(user_id=payload["teacher_id"]),
        school=school,
    ).first()
    if not teacher or teacher.role != UserProfile.ROLE_TEACHER:
        return JsonResponse({"error": "Invalid teacher"}, status=400)

    subject = payload.get("subject", "").strip()
    if not subject:
        return JsonResponse({"error": "Invalid subject"}, status=400)

    if request.method == "DELETE":
        ClassroomTeacherAllocation.objects.filter(
            classroom=classroom, teacher=teacher, subject=subject
        ).delete()
        _log_action(
            auth["user"],
            school,
            "allocation_deleted",
            f"classroom={classroom.id} teacher={teacher.id} subject={subject}",
            request,
        )
        return JsonResponse({"success": True})

    allocation, _ = ClassroomTeacherAllocation.objects.get_or_create(
        classroom=classroom,
        teacher=teacher,
        subject=subject,
    )
    _log_action(
        auth["user"],
        school,
        "allocation_set",
        f"classroom={classroom.id} teacher={teacher.id} subject={subject}",
        request,
    )
    return JsonResponse({"data": _serialize_allocation(allocation)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def classroom_students(request, classroom_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    classroom = Classroom.objects.filter(id=classroom_id, school=school).first()
    if not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        enrollments = Enrollment.objects.filter(classroom=classroom, student__school=school)
        student_ids = [enrollment.student_id for enrollment in enrollments]
        return JsonResponse({"data": student_ids})

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id"])
    if error:
        return JsonResponse(error, status=400)

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "DELETE":
        Enrollment.objects.filter(student=student, classroom=classroom).delete()
        _log_action(
            auth["user"],
            school,
            "classroom_student_removed",
            f"classroom={classroom.id} student={student.id}",
            request,
        )
        return JsonResponse({"success": True})

    start_date, date_error = _parse_date_field(
        payload.get("start_date") or timezone.now().date().isoformat(), "start_date"
    )
    if date_error:
        return date_error
    enrollment = Enrollment.objects.create(
        student=student,
        classroom=classroom,
        start_date=start_date,
        status=Enrollment.STATUS_ACTIVE,
    )
    _log_action(
        auth["user"],
        school,
        "classroom_student_added",
        f"classroom={classroom.id} student={student.id}",
        request,
    )
    return JsonResponse({"data": _serialize_enrollment(enrollment)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def students(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Student.objects.filter(school=school).prefetch_related("emergency_contacts")
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "name" in request.GET:
            name_filter = request.GET.get("name")
            items = items.filter(
                Q(first_name__icontains=name_filter) | Q(last_name__icontains=name_filter)
            )
        if "enrollment_code" in request.GET:
            items = items.filter(enrollment_code__icontains=request.GET.get("enrollment_code"))
        items = items.order_by("first_name", "last_name")
        return JsonResponse(_paginate(request, items, _serialize_student))

    payload = _parse_json(request)
    error = _missing_fields(payload, ["first_name"])
    if error:
        return JsonResponse(error, status=400)
    if "status" in payload:
        status_error = _validate_choice(payload["status"], Student.STATUS_CHOICES, "status")
        if status_error:
            return status_error
    if "tuition_status" in payload:
        payload["tuition_status"] = _normalize_tuition_status(payload["tuition_status"])
        if payload["tuition_status"] not in ["Paid", "Late", "Pending", ""]:
            return JsonResponse({"error": "Invalid tuition_status"}, status=400)
    birth_date, date_error = _parse_date_field(
        payload.get("birth_date") or payload.get("dob"), "birth_date"
    )
    if date_error:
        return date_error
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    student = Student.objects.create(
        school=school,
        first_name=payload["first_name"],
        last_name=payload.get("last_name", ""),
        birth_date=birth_date,
        cpf=payload.get("cpf", ""),
        main_address=payload.get("main_address") or payload.get("mainAddress", ""),
        reserve_address=payload.get("reserve_address") or payload.get("reserveAddress", ""),
        health_allergies=(payload.get("health_info") or payload.get("healthInfo") or {}).get(
            "allergies", []
        ),
        health_medications=(payload.get("health_info") or payload.get("healthInfo") or {}).get(
            "medications", []
        ),
        health_conditions=(payload.get("health_info") or payload.get("healthInfo") or {}).get(
            "conditions", ""
        ),
        blood_type=(payload.get("health_info") or payload.get("healthInfo") or {}).get(
            "bloodType", ""
        ),
        enrollment_code=payload.get("enrollment_code", ""),
        tuition_status=payload.get("tuition_status", ""),
        status=payload.get("status", Student.STATUS_ACTIVE),
    )
    if payload.get("user_id") or payload.get("user_email") or payload.get("username"):
        user_filter = Q()
        if payload.get("user_id"):
            user_filter |= Q(id=payload.get("user_id"))
        if payload.get("user_email"):
            user_filter |= Q(email=payload.get("user_email"))
        if payload.get("username"):
            user_filter |= Q(username=payload.get("username"))
        user = get_user_model().objects.filter(user_filter).first()
        if user:
            profile = UserProfile.objects.filter(user=user, school=school).first()
            if profile:
                link_error = _link_student_profile(profile, student)
                if link_error:
                    return link_error
    for contact in payload.get("emergency_contacts", []):
        if not contact.get("name"):
            continue
        EmergencyContact.objects.create(
            student=student,
            name=contact.get("name", ""),
            relation=contact.get("relation", ""),
            phone=contact.get("phone", ""),
            is_legal_guardian=bool(contact.get("is_legal_guardian") or contact.get("isLegalGuardian")),
        )
    _log_action(
        auth["user"],
        school,
        "student_created",
        f"{student.id}",
        request,
    )
    user_credentials = None
    if payload.get("auto_create_user", True):
        User = get_user_model()
        cpf_digits = "".join(filter(str.isdigit, student.cpf or ""))
        base_username = cpf_digits or f"student-{student.id}"
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            counter += 1
            username = f"{base_username}-{counter}"
        password = payload.get("password") or _generate_password()
        password_error = _validate_password(password)
        if password_error:
            return password_error
        email = payload.get("email") or payload.get("user_email") or ""
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        profile = UserProfile.objects.create(
            user=user,
            school=school,
            role=UserProfile.ROLE_STUDENT,
            student=student,
        )
        user_credentials = {
            "username": user.username,
            "password": password,
            "user_id": user.id,
            "profile_id": profile.id,
        }
    return JsonResponse({"data": _serialize_student(student), "user_credentials": user_credentials}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def student_detail(request, student_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    student = (
        Student.objects.filter(id=student_id, school=school)
        .prefetch_related("emergency_contacts")
        .first()
    )
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_student(student)})
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error
    if request.method == "DELETE":
        student.delete()
        _log_action(
            auth["user"],
            school,
            "student_deleted",
            str(student_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "status" in payload:
        status_error = _validate_choice(payload["status"], Student.STATUS_CHOICES, "status")
        if status_error:
            return status_error
    if "tuition_status" in payload:
        payload["tuition_status"] = _normalize_tuition_status(payload["tuition_status"])
        if payload["tuition_status"] not in ["Paid", "Late", "Pending", ""]:
            return JsonResponse({"error": "Invalid tuition_status"}, status=400)
    birth_date, date_error = _parse_date_field(
        payload.get("birth_date") or payload.get("dob"), "birth_date"
    )
    if date_error:
        return date_error
    for field in ["first_name", "last_name", "enrollment_code", "status", "cpf", "tuition_status"]:
        if field in payload:
            setattr(student, field, payload[field])
    if "main_address" in payload or "mainAddress" in payload:
        student.main_address = payload.get("main_address") or payload.get("mainAddress", "")
    if "reserve_address" in payload or "reserveAddress" in payload:
        student.reserve_address = payload.get("reserve_address") or payload.get("reserveAddress", "")
    if "birth_date" in payload:
        student.birth_date = birth_date
    if "health_info" in payload or "healthInfo" in payload:
        health_info = payload.get("health_info") or payload.get("healthInfo") or {}
        student.health_allergies = health_info.get("allergies", [])
        student.health_medications = health_info.get("medications", [])
        student.health_conditions = health_info.get("conditions", "")
        student.blood_type = health_info.get("bloodType", "")
    student.save()
    _log_action(
        auth["user"],
        school,
        "student_updated",
        str(student.id),
        request,
    )
    return JsonResponse({"data": _serialize_student(student)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def student_contacts(request, student_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    student = Student.objects.filter(id=student_id, school=school).first()
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        contacts = EmergencyContact.objects.filter(student=student).order_by("created_at")
        return JsonResponse({"data": [_serialize_emergency_contact(c) for c in contacts]})

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["name"])
    if error:
        return JsonResponse(error, status=400)
    contact = EmergencyContact.objects.create(
        student=student,
        name=payload.get("name", ""),
        relation=payload.get("relation", ""),
        phone=payload.get("phone", ""),
        is_legal_guardian=bool(payload.get("is_legal_guardian") or payload.get("isLegalGuardian")),
    )
    _log_action(
        auth["user"],
        school,
        "emergency_contact_created",
        str(contact.id),
        request,
    )
    return JsonResponse({"data": _serialize_emergency_contact(contact)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def emergency_contact_detail(request, contact_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    contact = EmergencyContact.objects.select_related("student").filter(id=contact_id).first()
    if not contact or contact.student.school_id != school.id:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        contact.delete()
        _log_action(
            auth["user"],
            school,
            "emergency_contact_deleted",
            str(contact_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    for field in ["name", "relation", "phone"]:
        if field in payload:
            setattr(contact, field, payload[field])
    if "is_legal_guardian" in payload or "isLegalGuardian" in payload:
        contact.is_legal_guardian = bool(
            payload.get("is_legal_guardian") or payload.get("isLegalGuardian")
        )
    contact.save()
    _log_action(
        auth["user"],
        school,
        "emergency_contact_updated",
        str(contact.id),
        request,
    )
    return JsonResponse({"data": _serialize_emergency_contact(contact)})


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def student_parents(request, student_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    student = Student.objects.filter(id=student_id, school=school).first()
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        links = StudentParent.objects.filter(student=student).order_by("-created_at")
        return JsonResponse({"data": [_serialize_parent_link(link) for link in links]})

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["guardian_id"])
    if error:
        return JsonResponse(error, status=400)

    guardian = Guardian.objects.filter(id=payload["guardian_id"], school=school).first()
    if not guardian:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "DELETE":
        StudentParent.objects.filter(student=student, guardian=guardian).delete()
        _log_action(
            auth["user"],
            school,
            "student_parent_deleted",
            f"student={student.id} guardian={guardian.id}",
            request,
        )
        return JsonResponse({"success": True})

    is_primary = bool(payload.get("is_primary"))
    link, _ = StudentParent.objects.update_or_create(
        student=student, guardian=guardian, defaults={"is_primary": is_primary}
    )
    _log_action(
        auth["user"],
        school,
        "student_parent_set",
        f"student={student.id} guardian={guardian.id}",
        request,
    )
    return JsonResponse({"data": _serialize_parent_link(link)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def guardians(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Guardian.objects.filter(school=school)
        if "name" in request.GET:
            items = items.filter(name__icontains=request.GET.get("name"))
        if "cpf" in request.GET:
            items = items.filter(cpf__icontains=request.GET.get("cpf"))
        items = items.order_by("name")
        return JsonResponse(_paginate(request, items, _serialize_guardian))

    payload = _parse_json(request)
    error = _missing_fields(payload, ["name"])
    if error:
        return JsonResponse(error, status=400)
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    guardian = Guardian.objects.create(
        school=school,
        name=payload["name"],
        relation=payload.get("relation", ""),
        phone=payload.get("phone", ""),
        email=payload.get("email", ""),
        cpf=payload.get("cpf", ""),
    )
    _log_action(
        auth["user"],
        school,
        "guardian_created",
        str(guardian.id),
        request,
    )
    return JsonResponse({"data": _serialize_guardian(guardian)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def guardian_detail(request, guardian_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    guardian = Guardian.objects.filter(id=guardian_id, school=school).first()
    if not guardian:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_guardian(guardian)})
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error
    if request.method == "DELETE":
        guardian.delete()
        _log_action(
            auth["user"],
            school,
            "guardian_deleted",
            str(guardian_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    for field in ["name", "relation", "phone", "email", "cpf"]:
        if field in payload:
            setattr(guardian, field, payload[field])
    guardian.save()
    _log_action(
        auth["user"],
        school,
        "guardian_updated",
        str(guardian.id),
        request,
    )
    return JsonResponse({"data": _serialize_guardian(guardian)})


@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def student_guardian_link(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id", "guardian_id"])
    if error:
        return JsonResponse(error, status=400)

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    guardian = Guardian.objects.filter(id=payload["guardian_id"], school=school).first()
    if not student or not guardian:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "DELETE":
        StudentGuardian.objects.filter(student=student, guardian=guardian).delete()
        _log_action(
            auth["user"],
            school,
            "student_guardian_deleted",
            f"student={student.id} guardian={guardian.id}",
            request,
        )
        return JsonResponse({"success": True})

    is_primary = bool(payload.get("is_primary", False))
    link, _ = StudentGuardian.objects.update_or_create(
        student=student,
        guardian=guardian,
        defaults={"is_primary": is_primary},
    )
    _log_action(
        auth["user"],
        school,
        "student_guardian_set",
        f"student={student.id} guardian={guardian.id}",
        request,
    )
    return JsonResponse(
        {
            "data": {
                "student_id": link.student_id,
                "guardian_id": link.guardian_id,
                "is_primary": link.is_primary,
            }
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def enrollments(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Enrollment.objects.filter(student__school=school)
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "student_id" in request.GET:
            items = items.filter(student_id=request.GET.get("student_id"))
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        items = items.order_by("-start_date")
        return JsonResponse(_paginate(request, items, _serialize_enrollment))

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id", "classroom_id", "start_date"])
    if error:
        return JsonResponse(error, status=400)
    if "status" in payload:
        status_error = _validate_choice(payload["status"], Enrollment.STATUS_CHOICES, "status")
        if status_error:
            return status_error
    start_date, start_error = _parse_date_field(payload.get("start_date"), "start_date")
    if start_error:
        return start_error
    end_date, end_error = _parse_date_field(payload.get("end_date"), "end_date")
    if end_error:
        return end_error
    if end_date and start_date and end_date < start_date:
        return JsonResponse({"error": "End date before start date"}, status=400)
    if payload.get("status") == Enrollment.STATUS_COMPLETED and not end_date:
        return JsonResponse({"error": "end_date required when status is completed"}, status=400)
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
    if not student or not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    enrollment = Enrollment.objects.create(
        student=student,
        classroom=classroom,
        start_date=start_date,
        end_date=end_date,
        status=payload.get("status", Enrollment.STATUS_ACTIVE),
    )
    _log_action(
        auth["user"],
        school,
        "enrollment_created",
        str(enrollment.id),
        request,
    )
    return JsonResponse({"data": _serialize_enrollment(enrollment)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def enrollment_detail(request, enrollment_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    enrollment = (
        Enrollment.objects.select_related("student", "classroom")
        .filter(id=enrollment_id, student__school=school)
        .first()
    )
    if not enrollment:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_enrollment(enrollment)})
    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error
    if request.method == "DELETE":
        enrollment.delete()
        _log_action(
            auth["user"],
            school,
            "enrollment_deleted",
            str(enrollment_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "status" in payload:
        status_error = _validate_choice(payload["status"], Enrollment.STATUS_CHOICES, "status")
        if status_error:
            return status_error
        enrollment.status = payload["status"]
    if "start_date" in payload:
        start_date, start_error = _parse_date_field(payload.get("start_date"), "start_date")
        if start_error:
            return start_error
        enrollment.start_date = start_date
    if "end_date" in payload:
        end_date, end_error = _parse_date_field(payload.get("end_date"), "end_date")
        if end_error:
            return end_error
        enrollment.end_date = end_date
    if enrollment.end_date and enrollment.start_date and enrollment.end_date < enrollment.start_date:
        return JsonResponse({"error": "End date before start date"}, status=400)
    if enrollment.status == Enrollment.STATUS_COMPLETED and not enrollment.end_date:
        return JsonResponse({"error": "end_date required when status is completed"}, status=400)
    if "classroom_id" in payload:
        classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
        if not classroom:
            return JsonResponse({"error": "Invalid classroom"}, status=400)
        enrollment.classroom = classroom
    enrollment.save()
    _log_action(
        auth["user"],
        school,
        "enrollment_updated",
        str(enrollment.id),
        request,
    )
    return JsonResponse({"data": _serialize_enrollment(enrollment)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def invoices(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Invoice.objects.filter(student__school=school)
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "student_id" in request.GET:
            items = items.filter(student_id=request.GET.get("student_id"))
        if "due_date_from" in request.GET:
            items = items.filter(due_date__gte=request.GET.get("due_date_from"))
        if "due_date_to" in request.GET:
            items = items.filter(due_date__lte=request.GET.get("due_date_to"))
        items = items.order_by("-due_date")
        return JsonResponse(_paginate(request, items, _serialize_invoice))

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id", "amount", "due_date"])
    if error:
        return JsonResponse(error, status=400)
    if "status" in payload:
        status_error = _validate_choice(payload["status"], Invoice.STATUS_CHOICES, "status")
        if status_error:
            return status_error
    amount, amount_error = _parse_decimal_field(payload.get("amount"), "amount")
    if amount_error:
        return amount_error
    due_date, due_error = _parse_date_field(payload.get("due_date"), "due_date")
    if due_error:
        return due_error
    reference_month, ref_error = _parse_date_field(payload.get("reference_month"), "reference_month")
    if ref_error:
        return ref_error
    paid_at, paid_error = _parse_datetime_field(payload.get("paid_at"), "paid_at")
    if paid_error:
        return paid_error
    if payload.get("status") == Invoice.STATUS_PAID and not paid_at:
        return JsonResponse({"error": "paid_at required when status is paid"}, status=400)
    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_FINANCE],
    )
    if role_error:
        return role_error

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    invoice = Invoice.objects.create(
        student=student,
        amount=amount,
        due_date=due_date,
        reference_month=reference_month,
        status=payload.get("status", Invoice.STATUS_OPEN),
        paid_at=paid_at,
    )
    _log_action(
        auth["user"],
        school,
        "invoice_created",
        str(invoice.id),
        request,
    )
    return JsonResponse({"data": _serialize_invoice(invoice)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def invoice_detail(request, invoice_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    invoice = Invoice.objects.filter(id=invoice_id, student__school=school).first()
    if not invoice:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": _serialize_invoice(invoice)})
    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_FINANCE],
    )
    if role_error:
        return role_error
    if request.method == "DELETE":
        invoice.delete()
        _log_action(
            auth["user"],
            school,
            "invoice_deleted",
            str(invoice_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    for field in ["amount", "due_date", "status"]:
        if field in payload:
            if field == "status":
                status_error = _validate_choice(payload["status"], Invoice.STATUS_CHOICES, "status")
                if status_error:
                    return status_error
                invoice.status = payload["status"]
            elif field == "amount":
                amount, amount_error = _parse_decimal_field(payload.get("amount"), "amount")
                if amount_error:
                    return amount_error
                invoice.amount = amount
            elif field == "due_date":
                due_date, due_error = _parse_date_field(payload.get("due_date"), "due_date")
                if due_error:
                    return due_error
                invoice.due_date = due_date
    if "reference_month" in payload:
        reference_month, ref_error = _parse_date_field(payload.get("reference_month"), "reference_month")
        if ref_error:
            return ref_error
        invoice.reference_month = reference_month
    if "paid_at" in payload:
        paid_at, paid_error = _parse_datetime_field(payload.get("paid_at"), "paid_at")
        if paid_error:
            return paid_error
        invoice.paid_at = paid_at
    if "status" in payload and invoice.status == Invoice.STATUS_PAID and not invoice.paid_at:
        return JsonResponse({"error": "paid_at required when status is paid"}, status=400)
    invoice.save()
    _log_action(
        auth["user"],
        school,
        "invoice_updated",
        str(invoice.id),
        request,
    )
    return JsonResponse({"data": _serialize_invoice(invoice)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def grades(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = GradeRecord.objects.filter(student__school=school)
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        if "student_id" in request.GET:
            items = items.filter(student_id=request.GET.get("student_id"))
        if "subject" in request.GET:
            items = items.filter(subject__icontains=request.GET.get("subject"))
        if "term" in request.GET:
            items = items.filter(term=request.GET.get("term"))
        items = items.order_by("-created_at")
        return JsonResponse(_paginate(request, items, _serialize_grade))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id", "classroom_id", "subject"])
    if error:
        return JsonResponse(error, status=400)

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
    if not student or not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    grade1, grade1_error = _parse_grade_field(payload.get("grade1"), "grade1")
    if grade1_error:
        return grade1_error
    grade2, grade2_error = _parse_grade_field(payload.get("grade2"), "grade2")
    if grade2_error:
        return grade2_error
    recovery_grade, recovery_error = _parse_grade_field(
        payload.get("recovery_grade"), "recovery_grade"
    )
    if recovery_error:
        return recovery_error

    config = GradingConfig.objects.filter(school=school).first()
    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error
    if not date_value:
        date_value = timezone.now().date()
    term_value = payload.get("term") or _calculate_term(config, date_value)
    average, final_grade = _calculate_final_grade(config, grade1, grade2, recovery_grade)

    record, _ = GradeRecord.objects.update_or_create(
        student=student,
        classroom=classroom,
        subject=payload.get("subject", ""),
        term=term_value,
        defaults={
            "grade1": grade1,
            "grade2": grade2,
            "recovery_grade": recovery_grade,
            "average": average,
            "final_grade": final_grade,
            "date": date_value,
        },
    )
    _log_action(
        auth["user"],
        school,
        "grade_upserted",
        str(record.id),
        request,
    )
    return JsonResponse({"data": _serialize_grade(record)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def grade_detail(request, grade_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    record = GradeRecord.objects.filter(id=grade_id, student__school=school).first()
    if not record:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        record.delete()
        _log_action(
            auth["user"],
            school,
            "grade_deleted",
            str(grade_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "grade1" in payload:
        grade1, grade1_error = _parse_grade_field(payload.get("grade1"), "grade1")
        if grade1_error:
            return grade1_error
        record.grade1 = grade1
    if "grade2" in payload:
        grade2, grade2_error = _parse_grade_field(payload.get("grade2"), "grade2")
        if grade2_error:
            return grade2_error
        record.grade2 = grade2
    if "recovery_grade" in payload:
        recovery_grade, recovery_error = _parse_grade_field(
            payload.get("recovery_grade"), "recovery_grade"
        )
        if recovery_error:
            return recovery_error
        record.recovery_grade = recovery_grade
    if "subject" in payload:
        record.subject = payload.get("subject", "")
    if "term" in payload:
        record.term = payload.get("term", "")
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        record.date = date_value

    config = GradingConfig.objects.filter(school=school).first()
    record.average, record.final_grade = _calculate_final_grade(
        config, record.grade1, record.grade2, record.recovery_grade
    )
    if not record.term:
        record.term = _calculate_term(config, record.date)
    record.save()
    _log_action(
        auth["user"],
        school,
        "grade_updated",
        str(record.id),
        request,
    )
    return JsonResponse({"data": _serialize_grade(record)})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def grading_config(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    config, _ = GradingConfig.objects.get_or_create(
        school=school,
        defaults={
            "system": GradingConfig.SYSTEM_BIMESTRAL,
            "calculation_method": GradingConfig.METHOD_ARITHMETIC,
            "min_passing_grade": Decimal("6"),
            "weights": {"exam": 50, "activities": 50, "participation": 0},
            "recovery_rule": "replace",
        },
    )

    if request.method == "GET":
        return JsonResponse({"data": _serialize_grading_config(config)})

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    if "system" in payload:
        system_error = _validate_choice(payload.get("system"), GradingConfig.SYSTEM_CHOICES, "system")
        if system_error:
            return system_error
        config.system = payload.get("system")
    if "calculation_method" in payload:
        method_error = _validate_choice(
            payload.get("calculation_method"), GradingConfig.METHOD_CHOICES, "calculation_method"
        )
        if method_error:
            return method_error
        config.calculation_method = payload.get("calculation_method")
    if "min_passing_grade" in payload:
        min_grade, min_error = _parse_decimal_field(payload.get("min_passing_grade"), "min_passing_grade")
        if min_error:
            return min_error
        config.min_passing_grade = min_grade
    if "weights" in payload:
        weights = payload.get("weights")
        if not isinstance(weights, dict):
            return JsonResponse({"error": "Invalid weights"}, status=400)
        config.weights = weights
    if "recovery_rule" in payload:
        config.recovery_rule = payload.get("recovery_rule", "")
    config.save()
    _log_action(
        auth["user"],
        school,
        "grading_config_updated",
        str(school.id),
        request,
    )
    return JsonResponse({"data": _serialize_grading_config(config)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def uploads(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = UploadAttachment.objects.filter(school=school)
        if "entity_type" in request.GET:
            items = items.filter(entity_type=request.GET.get("entity_type"))
        if "entity_id" in request.GET:
            items = items.filter(entity_id=request.GET.get("entity_id"))
        return JsonResponse(_paginate(request, items, _serialize_upload))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    entity_type = request.POST.get("entity_type")
    entity_id = request.POST.get("entity_id")
    if not entity_type or not entity_id:
        return JsonResponse({"error": "Missing required fields"}, status=400)

    type_error = _validate_choice(entity_type, UploadAttachment.ENTITY_CHOICES, "entity_type")
    if type_error:
        return type_error

    if entity_type == UploadAttachment.ENTITY_EXAM:
        exam = ExamSubmission.objects.filter(id=entity_id, school=school).first()
        if not exam:
            return JsonResponse({"error": "Exam submission not found"}, status=404)

    if "file" not in request.FILES:
        return JsonResponse({"error": "File is required"}, status=400)
    uploaded_file = request.FILES["file"]

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    upload = UploadAttachment.objects.create(
        school=school,
        uploaded_by=profile,
        entity_type=entity_type,
        entity_id=str(entity_id),
        file=uploaded_file,
        original_name=uploaded_file.name,
        content_type=getattr(uploaded_file, "content_type", ""),
        size=uploaded_file.size or 0,
    )
    _log_action(
        auth["user"],
        school,
        "upload_created",
        f"{entity_type}:{entity_id}",
        request,
    )
    return JsonResponse({"data": _serialize_upload(upload)}, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def upload_detail(request, upload_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    upload = UploadAttachment.objects.filter(id=upload_id, school=school).first()
    if not upload:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    upload.file.delete(save=False)
    upload.delete()
    _log_action(
        auth["user"],
        school,
        "upload_deleted",
        str(upload_id),
        request,
    )
    return JsonResponse({"success": True})


@csrf_exempt
@require_http_methods(["GET"])
def audit_logs(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR],
    )
    if role_error:
        return role_error

    items = AuditLog.objects.filter(school=school)
    if "action" in request.GET:
        items = items.filter(action__icontains=request.GET.get("action"))
    if "user" in request.GET:
        items = items.filter(user__user__username__icontains=request.GET.get("user"))
    if "date_from" in request.GET:
        items = items.filter(created_at__date__gte=request.GET.get("date_from"))
    if "date_to" in request.GET:
        items = items.filter(created_at__date__lte=request.GET.get("date_to"))
    return JsonResponse(_paginate(request, items, _serialize_audit_log))


@csrf_exempt
@require_http_methods(["GET"])
def cashflow_summary(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    items = FinancialTransaction.objects.filter(school=school)
    if "date_from" in request.GET:
        items = items.filter(date__gte=request.GET.get("date_from"))
    if "date_to" in request.GET:
        items = items.filter(date__lte=request.GET.get("date_to"))

    income = items.filter(transaction_type=FinancialTransaction.TYPE_INCOME).aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0")
    expense = items.filter(transaction_type=FinancialTransaction.TYPE_EXPENSE).aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0")

    monthly = {}
    for entry in items.values("date", "transaction_type").annotate(total=Sum("amount")):
        month_key = entry["date"].strftime("%Y-%m")
        if month_key not in monthly:
            monthly[month_key] = {"income": Decimal("0"), "expense": Decimal("0")}
        if entry["transaction_type"] == FinancialTransaction.TYPE_INCOME:
            monthly[month_key]["income"] += entry["total"]
        else:
            monthly[month_key]["expense"] += entry["total"]

    def _format_decimal(value):
        return f"{value:.2f}"

    return JsonResponse(
        {
            "summary": {
                "income": _format_decimal(income),
                "expense": _format_decimal(expense),
                "net": _format_decimal(income - expense),
            },
            "monthly": [
                {
                    "month": key,
                    "income": _format_decimal(value["income"]),
                    "expense": _format_decimal(value["expense"]),
                }
                for key, value in sorted(monthly.items())
            ],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def reconcile_invoices(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_FINANCE],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    status_filter = payload.get("status", Invoice.STATUS_PAID)
    invoices = Invoice.objects.filter(student__school=school, status=status_filter)
    if "invoice_ids" in payload:
        invoices = invoices.filter(id__in=payload.get("invoice_ids"))

    created = 0
    for invoice in invoices:
        exists = FinancialTransaction.objects.filter(invoice=invoice).exists()
        if exists:
            continue
        FinancialTransaction.objects.create(
            school=school,
            invoice=invoice,
            description=f"Mensalidade {invoice.student}",
            category="Mensalidade",
            amount=invoice.amount,
            transaction_type=FinancialTransaction.TYPE_INCOME,
            status=FinancialTransaction.STATUS_PAID,
            date=invoice.paid_at.date() if invoice.paid_at else invoice.due_date,
        )
        created += 1

    _log_action(
        auth["user"],
        school,
        "invoice_reconciled",
        f"created={created}",
        request,
    )
    return JsonResponse({"created": created})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def justifications(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = AbsenceJustification.objects.filter(attendance__student__school=school)
        if "student_id" in request.GET:
            items = items.filter(attendance__student_id=request.GET.get("student_id"))
        if "classroom_id" in request.GET:
            items = items.filter(attendance__classroom_id=request.GET.get("classroom_id"))
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "date" in request.GET:
            items = items.filter(attendance__date=request.GET.get("date"))
        items = items.select_related("attendance", "created_by__user", "decided_by__user").order_by(
            "-created_at"
        )
        return JsonResponse(_paginate(request, items, _serialize_justification))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["attendance_id", "reason"])
    if error:
        return JsonResponse(error, status=400)

    status_value = payload.get("status") or AbsenceJustification.STATUS_APPROVED
    status_error = _validate_choice(
        status_value, AbsenceJustification.STATUS_CHOICES, "status"
    )
    if status_error:
        return status_error

    attendance = AttendanceRecord.objects.filter(
        id=payload["attendance_id"], student__school=school
    ).first()
    if not attendance:
        return JsonResponse({"error": "Attendance record not found"}, status=404)

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    justification, created = AbsenceJustification.objects.update_or_create(
        attendance=attendance,
        defaults={
            "reason": payload.get("reason"),
            "observation": payload.get("observation", ""),
            "status": status_value,
            "created_by": profile,
        },
    )

    if status_value in [AbsenceJustification.STATUS_APPROVED, AbsenceJustification.STATUS_REJECTED]:
        justification.decided_by = profile
        justification.decided_at = timezone.now()
        justification.save(update_fields=["decided_by", "decided_at", "updated_at"])

    if status_value == AbsenceJustification.STATUS_APPROVED:
        attendance.status = AttendanceRecord.STATUS_EXCUSED
        attendance.save(update_fields=["status"])
    elif status_value == AbsenceJustification.STATUS_REJECTED:
        attendance.status = AttendanceRecord.STATUS_ABSENT
        attendance.save(update_fields=["status"])

    _log_action(
        auth["user"],
        school,
        "absence_justification_created" if created else "absence_justification_updated",
        str(justification.id),
        request,
    )
    return JsonResponse({"data": _serialize_justification(justification)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def justification_detail(request, justification_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    justification = AbsenceJustification.objects.filter(
        id=justification_id, attendance__student__school=school
    ).select_related("attendance").first()
    if not justification:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        attendance = justification.attendance
        was_approved = justification.status == AbsenceJustification.STATUS_APPROVED
        justification.delete()
        if was_approved and attendance.status == AttendanceRecord.STATUS_EXCUSED:
            attendance.status = AttendanceRecord.STATUS_ABSENT
            attendance.save(update_fields=["status"])
        _log_action(
            auth["user"],
            school,
            "absence_justification_deleted",
            str(justification_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "reason" in payload:
        justification.reason = payload.get("reason")
    if "observation" in payload:
        justification.observation = payload.get("observation", "")
    if "status" in payload:
        status_value = payload.get("status")
        status_error = _validate_choice(
            status_value, AbsenceJustification.STATUS_CHOICES, "status"
        )
        if status_error:
            return status_error
        justification.status = status_value
        profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
        if status_value in [
            AbsenceJustification.STATUS_APPROVED,
            AbsenceJustification.STATUS_REJECTED,
        ]:
            justification.decided_by = profile
            justification.decided_at = timezone.now()
        else:
            justification.decided_by = None
            justification.decided_at = None

        if status_value == AbsenceJustification.STATUS_APPROVED:
            justification.attendance.status = AttendanceRecord.STATUS_EXCUSED
            justification.attendance.save(update_fields=["status"])
        elif status_value == AbsenceJustification.STATUS_REJECTED:
            justification.attendance.status = AttendanceRecord.STATUS_ABSENT
            justification.attendance.save(update_fields=["status"])

    justification.save()
    _log_action(
        auth["user"],
        school,
        "absence_justification_updated",
        str(justification.id),
        request,
    )
    return JsonResponse({"data": _serialize_justification(justification)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def attendance(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = AttendanceRecord.objects.filter(student__school=school)
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        if "student_id" in request.GET:
            items = items.filter(student_id=request.GET.get("student_id"))
        if "teacher_id" in request.GET:
            items = items.filter(teacher_id=request.GET.get("teacher_id"))
        if "date" in request.GET:
            items = items.filter(date=request.GET.get("date"))
        if "subject" in request.GET:
            items = items.filter(subject=request.GET.get("subject"))
        items = items.order_by("-date")
        return JsonResponse(_paginate(request, items, _serialize_attendance))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id", "classroom_id", "date", "status"])
    if error:
        return JsonResponse(error, status=400)

    status_error = _validate_choice(payload.get("status"), AttendanceRecord.STATUS_CHOICES, "status")
    if status_error:
        return status_error
    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
    if not student or not classroom:
        return JsonResponse({"error": "Not found"}, status=404)

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    teacher_profile = profile
    if "teacher_id" in payload and profile and profile.role in [
        UserProfile.ROLE_ADMIN,
        UserProfile.ROLE_DIRECTOR,
        UserProfile.ROLE_COORDINATOR,
    ]:
        teacher_profile = UserProfile.objects.filter(
            Q(user_id=payload.get("teacher_id")) | Q(id=payload.get("teacher_id")),
            school=school,
            role=UserProfile.ROLE_TEACHER,
        ).first()
    record, _ = AttendanceRecord.objects.update_or_create(
        student=student,
        classroom=classroom,
        date=date_value,
        subject=payload.get("subject", ""),
        defaults={
            "status": payload.get("status"),
            "teacher": teacher_profile,
        },
    )
    _log_action(
        auth["user"],
        school,
        "attendance_upserted",
        str(record.id),
        request,
    )
    return JsonResponse({"data": _serialize_attendance(record)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def attendance_detail(request, attendance_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    record = AttendanceRecord.objects.filter(id=attendance_id, student__school=school).first()
    if not record:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        record.delete()
        _log_action(
            auth["user"],
            school,
            "attendance_deleted",
            str(attendance_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "subject" in payload:
        record.subject = payload.get("subject", "")
    if "teacher_id" in payload:
        teacher_profile = UserProfile.objects.filter(
            user_id=payload.get("teacher_id"), school=school
        ).first()
        if teacher_profile:
            record.teacher = teacher_profile
    if "status" in payload:
        status_error = _validate_choice(payload.get("status"), AttendanceRecord.STATUS_CHOICES, "status")
        if status_error:
            return status_error
        record.status = payload.get("status")
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        record.date = date_value
    record.save()
    _log_action(
        auth["user"],
        school,
        "attendance_updated",
        str(record.id),
        request,
    )
    return JsonResponse({"data": _serialize_attendance(record)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def diary_entries(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = ClassDiaryEntry.objects.filter(classroom__school=school)
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        if "subject" in request.GET:
            items = items.filter(subject__icontains=request.GET.get("subject"))
        if "date" in request.GET:
            items = items.filter(date=request.GET.get("date"))
        items = items.order_by("-date")
        return JsonResponse(_paginate(request, items, _serialize_diary))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["classroom_id", "subject", "date", "topic"])
    if error:
        return JsonResponse(error, status=400)

    classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
    if not classroom:
        return JsonResponse({"error": "Not found"}, status=404)
    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()

    entry = ClassDiaryEntry.objects.create(
        classroom=classroom,
        teacher=profile,
        subject=payload.get("subject", ""),
        date=date_value,
        topic=payload.get("topic", ""),
        description=payload.get("description", ""),
        homework=payload.get("homework", ""),
    )
    _log_action(
        auth["user"],
        school,
        "diary_created",
        str(entry.id),
        request,
    )
    return JsonResponse({"data": _serialize_diary(entry)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def diary_entry_detail(request, diary_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    entry = ClassDiaryEntry.objects.filter(id=diary_id, classroom__school=school).first()
    if not entry:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        entry.delete()
        _log_action(
            auth["user"],
            school,
            "diary_deleted",
            str(diary_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "subject" in payload:
        entry.subject = payload.get("subject", "")
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        entry.date = date_value
    if "topic" in payload:
        entry.topic = payload.get("topic", "")
    if "description" in payload:
        entry.description = payload.get("description", "")
    if "homework" in payload:
        entry.homework = payload.get("homework", "")
    entry.save()
    _log_action(
        auth["user"],
        school,
        "diary_updated",
        str(entry.id),
        request,
    )
    return JsonResponse({"data": _serialize_diary(entry)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def materials(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = LearningMaterial.objects.filter(classroom__school=school)
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        if "type" in request.GET:
            items = items.filter(material_type__icontains=request.GET.get("type"))
        if "title" in request.GET:
            items = items.filter(title__icontains=request.GET.get("title"))
        items = items.order_by("-date")
        return JsonResponse(_paginate(request, items, _serialize_material))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["classroom_id", "title", "date"])
    if error:
        return JsonResponse(error, status=400)

    classroom = Classroom.objects.filter(id=payload["classroom_id"], school=school).first()
    if not classroom:
        return JsonResponse({"error": "Not found"}, status=404)
    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error

    material = LearningMaterial.objects.create(
        classroom=classroom,
        title=payload.get("title", ""),
        material_type=payload.get("type", ""),
        date=date_value,
        size=payload.get("size", ""),
        url=payload.get("url", ""),
    )
    _log_action(
        auth["user"],
        school,
        "material_created",
        str(material.id),
        request,
    )
    return JsonResponse({"data": _serialize_material(material)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def material_detail(request, material_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    material = LearningMaterial.objects.filter(id=material_id, classroom__school=school).first()
    if not material:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        material.delete()
        _log_action(
            auth["user"],
            school,
            "material_deleted",
            str(material_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "title" in payload:
        material.title = payload.get("title", "")
    if "type" in payload:
        material.material_type = payload.get("type", "")
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        material.date = date_value
    if "size" in payload:
        material.size = payload.get("size", "")
    if "url" in payload:
        material.url = payload.get("url", "")
    material.save()
    _log_action(
        auth["user"],
        school,
        "material_updated",
        str(material.id),
        request,
    )
    return JsonResponse({"data": _serialize_material(material)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def syllabi(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Syllabus.objects.filter(school=school)
        if "subject" in request.GET:
            items = items.filter(subject__icontains=request.GET.get("subject"))
        if "grade_level" in request.GET:
            items = items.filter(grade_level__icontains=request.GET.get("grade_level"))
        items = items.order_by("subject")
        return JsonResponse(_paginate(request, items, _serialize_syllabus))

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["subject"])
    if error:
        return JsonResponse(error, status=400)

    objectives = payload.get("objectives")
    if objectives is None:
        objectives = []
    if not isinstance(objectives, list):
        return JsonResponse({"error": "Invalid objectives"}, status=400)

    syllabus = Syllabus.objects.create(
        school=school,
        subject=payload.get("subject", ""),
        grade_level=payload.get("grade_level", ""),
        description=payload.get("description", ""),
        objectives=objectives,
        bibliography=payload.get("bibliography", ""),
    )
    _log_action(
        auth["user"],
        school,
        "syllabus_created",
        syllabus.subject,
        request,
    )
    return JsonResponse({"data": _serialize_syllabus(syllabus)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def syllabus_detail(request, syllabus_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    syllabus = Syllabus.objects.filter(id=syllabus_id, school=school).first()
    if not syllabus:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        syllabus.delete()
        _log_action(
            auth["user"],
            school,
            "syllabus_deleted",
            str(syllabus_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "subject" in payload:
        syllabus.subject = payload.get("subject", "")
    if "grade_level" in payload:
        syllabus.grade_level = payload.get("grade_level", "")
    if "description" in payload:
        syllabus.description = payload.get("description", "")
    if "objectives" in payload:
        objectives = payload.get("objectives")
        if not isinstance(objectives, list):
            return JsonResponse({"error": "Invalid objectives"}, status=400)
        syllabus.objectives = objectives
    if "bibliography" in payload:
        syllabus.bibliography = payload.get("bibliography", "")
    syllabus.save()
    _log_action(
        auth["user"],
        school,
        "syllabus_updated",
        str(syllabus.id),
        request,
    )
    return JsonResponse({"data": _serialize_syllabus(syllabus)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def transactions(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = FinancialTransaction.objects.filter(school=school)
        if "type" in request.GET:
            items = items.filter(transaction_type=request.GET.get("type"))
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "category" in request.GET:
            items = items.filter(category__icontains=request.GET.get("category"))
        if "date_from" in request.GET:
            items = items.filter(date__gte=request.GET.get("date_from"))
        if "date_to" in request.GET:
            items = items.filter(date__lte=request.GET.get("date_to"))
        items = items.order_by("-date")
        return JsonResponse(_paginate(request, items, _serialize_transaction))

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_FINANCE],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["description", "amount", "date", "type"])
    if error:
        return JsonResponse(error, status=400)

    type_error = _validate_choice(
        payload.get("type"), FinancialTransaction.TYPE_CHOICES, "type"
    )
    if type_error:
        return type_error
    status = payload.get("status", FinancialTransaction.STATUS_OPEN)
    status_error = _validate_choice(
        status, FinancialTransaction.STATUS_CHOICES, "status"
    )
    if status_error:
        return status_error
    amount, amount_error = _parse_decimal_field(payload.get("amount"), "amount")
    if amount_error:
        return amount_error
    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error

    invoice = None
    if payload.get("invoice_id"):
        invoice = Invoice.objects.filter(id=payload.get("invoice_id"), student__school=school).first()
        if not invoice:
            return JsonResponse({"error": "Invalid invoice"}, status=400)

    transaction = FinancialTransaction.objects.create(
        school=school,
        invoice=invoice,
        description=payload.get("description", ""),
        category=payload.get("category", ""),
        amount=amount,
        transaction_type=payload.get("type"),
        status=status,
        date=date_value,
    )
    _log_action(
        auth["user"],
        school,
        "transaction_created",
        f"{transaction.description} ({transaction.transaction_type})",
        request,
    )
    return JsonResponse({"data": _serialize_transaction(transaction)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def transaction_detail(request, transaction_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    transaction = FinancialTransaction.objects.filter(id=transaction_id, school=school).first()
    if not transaction:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_FINANCE],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        transaction.delete()
        _log_action(
            auth["user"],
            school,
            "transaction_deleted",
            str(transaction_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "type" in payload:
        type_error = _validate_choice(
            payload.get("type"), FinancialTransaction.TYPE_CHOICES, "type"
        )
        if type_error:
            return type_error
        transaction.transaction_type = payload.get("type")
    if "status" in payload:
        status_error = _validate_choice(
            payload.get("status"), FinancialTransaction.STATUS_CHOICES, "status"
        )
        if status_error:
            return status_error
        transaction.status = payload.get("status")
    if "amount" in payload:
        amount, amount_error = _parse_decimal_field(payload.get("amount"), "amount")
        if amount_error:
            return amount_error
        transaction.amount = amount
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        transaction.date = date_value
    if "description" in payload:
        transaction.description = payload.get("description", "")
    if "category" in payload:
        transaction.category = payload.get("category", "")
    if "invoice_id" in payload:
        invoice = Invoice.objects.filter(id=payload.get("invoice_id"), student__school=school).first()
        if not invoice:
            return JsonResponse({"error": "Invalid invoice"}, status=400)
        transaction.invoice = invoice
    transaction.save()
    _log_action(
        auth["user"],
        school,
        "transaction_updated",
        str(transaction.id),
        request,
    )
    return JsonResponse({"data": _serialize_transaction(transaction)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def inventory_items(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = InventoryItem.objects.filter(school=school)
        if "category" in request.GET:
            items = items.filter(category=request.GET.get("category"))
        if request.GET.get("low_stock") in ["1", "true", "True"]:
            items = items.filter(quantity__lte=F("min_quantity"))
        if "q" in request.GET:
            items = items.filter(name__icontains=request.GET.get("q"))
        return JsonResponse(_paginate(request, items.order_by("name"), _serialize_inventory_item))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_SUPPORT,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_FINANCE,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["name", "category"])
    if error:
        return JsonResponse(error, status=400)

    category_error = _validate_choice(
        payload.get("category"), InventoryItem.CATEGORY_CHOICES, "category"
    )
    if category_error:
        return category_error

    item = InventoryItem.objects.create(
        school=school,
        name=payload.get("name"),
        category=payload.get("category"),
        quantity=int(payload.get("quantity") or 0),
        min_quantity=int(payload.get("min_quantity") or payload.get("minQuantity") or 0),
        unit=payload.get("unit", ""),
        location=payload.get("location", ""),
    )
    _log_action(
        auth["user"],
        school,
        "inventory_created",
        str(item.id),
        request,
    )
    return JsonResponse({"data": _serialize_inventory_item(item)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def inventory_item_detail(request, item_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    item = InventoryItem.objects.filter(id=item_id, school=school).first()
    if not item:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_SUPPORT,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_FINANCE,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        item.delete()
        _log_action(
            auth["user"],
            school,
            "inventory_deleted",
            str(item_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "name" in payload:
        item.name = payload.get("name")
    if "category" in payload:
        category_error = _validate_choice(
            payload.get("category"), InventoryItem.CATEGORY_CHOICES, "category"
        )
        if category_error:
            return category_error
        item.category = payload.get("category")
    if "quantity" in payload:
        item.quantity = int(payload.get("quantity") or 0)
    if "min_quantity" in payload or "minQuantity" in payload:
        item.min_quantity = int(payload.get("min_quantity") or payload.get("minQuantity") or 0)
    if "unit" in payload:
        item.unit = payload.get("unit") or ""
    if "location" in payload:
        item.location = payload.get("location") or ""
    item.save()
    _log_action(
        auth["user"],
        school,
        "inventory_updated",
        str(item.id),
        request,
    )
    return JsonResponse({"data": _serialize_inventory_item(item)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def academic_targets(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = AcademicTarget.objects.filter(school=school)
        return JsonResponse(_paginate(request, items, _serialize_academic_target))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(
        payload,
        ["month", "requiredClasses", "gradeSubmissionDeadline", "examSubmissionDeadline"],
    )
    if error:
        return JsonResponse(error, status=400)

    grade_deadline, grade_error = _parse_date_field(
        payload.get("gradeSubmissionDeadline"), "gradeSubmissionDeadline"
    )
    if grade_error:
        return grade_error
    exam_deadline, exam_error = _parse_date_field(
        payload.get("examSubmissionDeadline"), "examSubmissionDeadline"
    )
    if exam_error:
        return exam_error

    target = AcademicTarget.objects.create(
        school=school,
        month_label=payload.get("month"),
        required_classes=int(payload.get("requiredClasses") or 0),
        grade_submission_deadline=grade_deadline,
        exam_submission_deadline=exam_deadline,
    )
    _log_action(
        auth["user"],
        school,
        "academic_target_created",
        str(target.id),
        request,
    )
    return JsonResponse({"data": _serialize_academic_target(target)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def academic_target_detail(request, target_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    target = AcademicTarget.objects.filter(id=target_id, school=school).first()
    if not target:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        target.delete()
        _log_action(
            auth["user"],
            school,
            "academic_target_deleted",
            str(target_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "month" in payload:
        target.month_label = payload.get("month")
    if "requiredClasses" in payload:
        target.required_classes = int(payload.get("requiredClasses") or 0)
    if "gradeSubmissionDeadline" in payload:
        grade_deadline, grade_error = _parse_date_field(
            payload.get("gradeSubmissionDeadline"), "gradeSubmissionDeadline"
        )
        if grade_error:
            return grade_error
        target.grade_submission_deadline = grade_deadline
    if "examSubmissionDeadline" in payload:
        exam_deadline, exam_error = _parse_date_field(
            payload.get("examSubmissionDeadline"), "examSubmissionDeadline"
        )
        if exam_error:
            return exam_error
        target.exam_submission_deadline = exam_deadline
    target.save()
    _log_action(
        auth["user"],
        school,
        "academic_target_updated",
        str(target.id),
        request,
    )
    return JsonResponse({"data": _serialize_academic_target(target)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def exam_submissions(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = ExamSubmission.objects.filter(school=school)
        if "status" in request.GET:
            items = items.filter(status=request.GET.get("status"))
        if "type" in request.GET:
            items = items.filter(exam_type=request.GET.get("type"))
        if "teacher_id" in request.GET:
            items = items.filter(submitted_by__user_id=request.GET.get("teacher_id"))
        if "grade_level" in request.GET:
            items = items.filter(grade_level=request.GET.get("grade_level"))
        if "scheduled_from" in request.GET:
            items = items.filter(scheduled_date__gte=request.GET.get("scheduled_from"))
        if "scheduled_to" in request.GET:
            items = items.filter(scheduled_date__lte=request.GET.get("scheduled_to"))
        items = items.select_related("submitted_by__user").order_by("-submitted_at")
        return JsonResponse(_paginate(request, items, _serialize_exam_submission))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["title", "subject"])
    if error:
        return JsonResponse(error, status=400)

    exam_type = payload.get("type", ExamSubmission.TYPE_STANDARD)
    type_error = _validate_choice(exam_type, ExamSubmission.TYPE_CHOICES, "type")
    if type_error:
        return type_error
    status_value = payload.get("status", ExamSubmission.STATUS_PENDING)
    status_error = _validate_choice(status_value, ExamSubmission.STATUS_CHOICES, "status")
    if status_error:
        return status_error

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    scheduled_date = None
    if payload.get("scheduledDate"):
        scheduled_date, date_error = _parse_date_field(
            payload.get("scheduledDate"), "scheduledDate"
        )
        if date_error:
            return date_error

    exam = ExamSubmission.objects.create(
        school=school,
        title=payload.get("title"),
        subject=payload.get("subject"),
        grade_level=payload.get("gradeLevel", ""),
        exam_type=exam_type,
        status=status_value,
        student_name=payload.get("studentName", ""),
        feedback=payload.get("feedback", ""),
        scheduled_date=scheduled_date,
        submitted_by=profile,
    )
    _log_action(
        auth["user"],
        school,
        "exam_submission_created",
        str(exam.id),
        request,
    )
    return JsonResponse({"data": _serialize_exam_submission(exam)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def exam_submission_detail(request, exam_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    exam = ExamSubmission.objects.filter(id=exam_id, school=school).first()
    if not exam:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        exam.delete()
        _log_action(
            auth["user"],
            school,
            "exam_submission_deleted",
            str(exam_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "title" in payload:
        exam.title = payload.get("title")
    if "subject" in payload:
        exam.subject = payload.get("subject")
    if "gradeLevel" in payload:
        exam.grade_level = payload.get("gradeLevel", "")
    if "type" in payload:
        type_error = _validate_choice(payload.get("type"), ExamSubmission.TYPE_CHOICES, "type")
        if type_error:
            return type_error
        exam.exam_type = payload.get("type")
    if "status" in payload:
        status_error = _validate_choice(
            payload.get("status"), ExamSubmission.STATUS_CHOICES, "status"
        )
        if status_error:
            return status_error
        exam.status = payload.get("status")
    if "studentName" in payload:
        exam.student_name = payload.get("studentName", "")
    if "feedback" in payload:
        exam.feedback = payload.get("feedback", "")
    if "scheduledDate" in payload:
        scheduled_date, date_error = _parse_date_field(
            payload.get("scheduledDate"), "scheduledDate"
        )
        if date_error:
            return date_error
        exam.scheduled_date = scheduled_date

    if "status" in payload or "feedback" in payload:
        profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
        exam.decided_by = profile
        exam.decided_at = timezone.now()

    exam.save()
    _log_action(
        auth["user"],
        school,
        "exam_submission_updated",
        str(exam.id),
        request,
    )
    return JsonResponse({"data": _serialize_exam_submission(exam)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def notices(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Notice.objects.filter(school=school)
        if "type" in request.GET:
            items = items.filter(notice_type=request.GET.get("type"))
        if "date_from" in request.GET:
            items = items.filter(date__gte=request.GET.get("date_from"))
        if "date_to" in request.GET:
            items = items.filter(date__lte=request.GET.get("date_to"))
        if "q" in request.GET:
            items = items.filter(title__icontains=request.GET.get("q"))
        items = items.order_by("-date", "-created_at")
        return JsonResponse(_paginate(request, items, _serialize_notice))

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["title", "content"])
    if error:
        return JsonResponse(error, status=400)

    notice_type = payload.get("type", Notice.TYPE_GENERAL)
    type_error = _validate_choice(notice_type, Notice.TYPE_CHOICES, "type")
    if type_error:
        return type_error

    date_value, date_error = _parse_date_field(payload.get("date"), "date")
    if date_error:
        return date_error
    if not date_value:
        date_value = timezone.now().date()

    author = UserProfile.objects.filter(user=auth["user"], school=school).first()
    notice = Notice.objects.create(
        school=school,
        author=author,
        title=payload.get("title", ""),
        content=payload.get("content", ""),
        notice_type=notice_type,
        date=date_value,
    )
    _log_action(
        auth["user"],
        school,
        "notice_created",
        notice.title,
        request,
    )
    return JsonResponse({"data": _serialize_notice(notice)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def notice_detail(request, notice_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    notice = Notice.objects.filter(id=notice_id, school=school).first()
    if not notice:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        notice.delete()
        _log_action(
            auth["user"],
            school,
            "notice_deleted",
            str(notice_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "title" in payload:
        notice.title = payload.get("title", "")
    if "content" in payload:
        notice.content = payload.get("content", "")
    if "type" in payload:
        type_error = _validate_choice(payload.get("type"), Notice.TYPE_CHOICES, "type")
        if type_error:
            return type_error
        notice.notice_type = payload.get("type")
    if "date" in payload:
        date_value, date_error = _parse_date_field(payload.get("date"), "date")
        if date_error:
            return date_error
        notice.date = date_value
    notice.save()
    _log_action(
        auth["user"],
        school,
        "notice_updated",
        notice.title,
        request,
    )
    return JsonResponse({"data": _serialize_notice(notice)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversations(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = Conversation.objects.filter(school=school).select_related("student")
        if "student_id" in request.GET:
            items = items.filter(student_id=request.GET.get("student_id"))
        items = items.order_by("-created_at")
        return JsonResponse(_paginate(request, items, _serialize_conversation))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_id"])
    if error:
        return JsonResponse(error, status=400)

    student = Student.objects.filter(id=payload["student_id"], school=school).first()
    if not student:
        return JsonResponse({"error": "Not found"}, status=404)

    conversation, created = Conversation.objects.get_or_create(school=school, student=student)
    if created:
        _log_action(
            auth["user"],
            school,
            "conversation_created",
            str(conversation.id),
            request,
        )
    return JsonResponse({"data": _serialize_conversation(conversation)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversation_messages(request, conversation_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    conversation = Conversation.objects.filter(id=conversation_id, school=school).first()
    if not conversation:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        items = Message.objects.filter(conversation=conversation).order_by("sent_at")
        return JsonResponse(_paginate(request, items, _serialize_message))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["text"])
    if error:
        return JsonResponse(error, status=400)

    sender_type = payload.get("sender_type", Message.SENDER_SCHOOL)
    sender_error = _validate_choice(sender_type, Message.SENDER_CHOICES, "sender_type")
    if sender_error:
        return sender_error

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    message = Message.objects.create(
        conversation=conversation,
        sender_type=sender_type,
        sender_profile=profile if sender_type == Message.SENDER_SCHOOL else None,
        text=payload.get("text", ""),
    )
    _log_action(
        auth["user"],
        school,
        "message_sent",
        str(message.id),
        request,
    )
    return JsonResponse({"data": _serialize_message(message)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def time_slots(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = TimeSlot.objects.filter(school=school).order_by("sort_order", "start_time")
        return JsonResponse(_paginate(request, items, _serialize_time_slot))

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["start_time", "end_time"])
    if error:
        return JsonResponse(error, status=400)

    start_time, start_error = _parse_time_field(payload.get("start_time"), "start_time")
    if start_error:
        return start_error
    end_time, end_error = _parse_time_field(payload.get("end_time"), "end_time")
    if end_error:
        return end_error
    if end_time <= start_time:
        return JsonResponse({"error": "end_time must be after start_time"}, status=400)

    sort_order = payload.get("sort_order", 0)
    try:
        sort_order = int(sort_order)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid sort_order"}, status=400)

    slot = TimeSlot.objects.create(
        school=school,
        label=payload.get("label", ""),
        start_time=start_time,
        end_time=end_time,
        sort_order=sort_order,
    )
    _log_action(
        auth["user"],
        school,
        "time_slot_created",
        slot.label,
        request,
    )
    return JsonResponse({"data": _serialize_time_slot(slot)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def time_slot_detail(request, slot_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    slot = TimeSlot.objects.filter(id=slot_id, school=school).first()
    if not slot:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [UserProfile.ROLE_ADMIN, UserProfile.ROLE_DIRECTOR, UserProfile.ROLE_COORDINATOR],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        slot.delete()
        _log_action(
            auth["user"],
            school,
            "time_slot_deleted",
            str(slot_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "label" in payload:
        slot.label = payload.get("label", "")
    if "start_time" in payload:
        start_time, start_error = _parse_time_field(payload.get("start_time"), "start_time")
        if start_error:
            return start_error
        slot.start_time = start_time
    if "end_time" in payload:
        end_time, end_error = _parse_time_field(payload.get("end_time"), "end_time")
        if end_error:
            return end_error
        slot.end_time = end_time
    if slot.end_time <= slot.start_time:
        return JsonResponse({"error": "end_time must be after start_time"}, status=400)
    if "sort_order" in payload:
        try:
            slot.sort_order = int(payload.get("sort_order"))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid sort_order"}, status=400)
    slot.save()
    _log_action(
        auth["user"],
        school,
        "time_slot_updated",
        slot.label,
        request,
    )
    return JsonResponse({"data": _serialize_time_slot(slot)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def availability(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    profile = UserProfile.objects.filter(user=auth["user"], school=school).first()
    if not profile:
        return JsonResponse({"error": "User profile not found"}, status=404)

    if request.method == "GET":
        items = TeacherAvailability.objects.filter(teacher__school=school).select_related(
            "teacher", "time_slot"
        )
        if "teacher_id" in request.GET:
            items = items.filter(teacher__user_id=request.GET.get("teacher_id"))
        if "day_of_week" in request.GET:
            day, day_error = _validate_day_of_week(request.GET.get("day_of_week"))
            if day_error:
                return day_error
            items = items.filter(day_of_week=day)
        items = items.order_by("day_of_week", "time_slot__sort_order")
        return JsonResponse(_paginate(request, items, _serialize_availability))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["teacher_id", "time_slot_id", "day_of_week"])
    if error:
        return JsonResponse(error, status=400)

    day, day_error = _validate_day_of_week(payload.get("day_of_week"))
    if day_error:
        return day_error

    if profile.role == UserProfile.ROLE_TEACHER:
        teacher = profile
    else:
        try:
            teacher_id = int(payload["teacher_id"])
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid teacher"}, status=400)
        teacher = UserProfile.objects.filter(
            Q(user_id=teacher_id) | Q(id=teacher_id),
            school=school,
            role=UserProfile.ROLE_TEACHER,
        ).first()
    if not teacher:
        return JsonResponse({"error": "Invalid teacher"}, status=400)

    try:
        slot_id = int(payload["time_slot_id"])
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid time slot"}, status=400)
    slot = TimeSlot.objects.filter(id=slot_id, school=school).first()
    if not slot:
        return JsonResponse({"error": "Invalid time slot"}, status=400)

    availability_record, _ = TeacherAvailability.objects.get_or_create(
        teacher=teacher,
        time_slot=slot,
        day_of_week=day,
    )
    _log_action(
        auth["user"],
        school,
        "availability_set",
        f"teacher={teacher.id} day={day} slot={slot.id}",
        request,
    )
    return JsonResponse({"data": _serialize_availability(availability_record)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def availability_detail(request, availability_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    availability_record = TeacherAvailability.objects.filter(
        id=availability_id, teacher__school=school
    ).first()
    if not availability_record:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error
    if availability_record.teacher.user_id != auth["user"].id:
        teacher_role = UserProfile.objects.filter(
            user=auth["user"], school=school, role=UserProfile.ROLE_TEACHER
        ).exists()
        if teacher_role:
            return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "DELETE":
        availability_record.delete()
        _log_action(
            auth["user"],
            school,
            "availability_deleted",
            str(availability_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "day_of_week" in payload:
        day, day_error = _validate_day_of_week(payload.get("day_of_week"))
        if day_error:
            return day_error
        availability_record.day_of_week = day
    if "time_slot_id" in payload:
        slot = TimeSlot.objects.filter(id=payload["time_slot_id"], school=school).first()
        if not slot:
            return JsonResponse({"error": "Invalid time slot"}, status=400)
        availability_record.time_slot = slot
    availability_record.save()
    _log_action(
        auth["user"],
        school,
        "availability_updated",
        str(availability_record.id),
        request,
    )
    return JsonResponse({"data": _serialize_availability(availability_record)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def schedules(request):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    if request.method == "GET":
        items = ClassScheduleEntry.objects.filter(classroom__school=school)
        if "classroom_id" in request.GET:
            items = items.filter(classroom_id=request.GET.get("classroom_id"))
        if "teacher_id" in request.GET:
            items = items.filter(teacher__user_id=request.GET.get("teacher_id"))
        if "day_of_week" in request.GET:
            day, day_error = _validate_day_of_week(request.GET.get("day_of_week"))
            if day_error:
                return day_error
            items = items.filter(day_of_week=day)
        items = items.order_by("day_of_week", "time_slot__sort_order")
        return JsonResponse(_paginate(request, items, _serialize_schedule))

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_TEACHER,
        ],
    )
    if role_error:
        return role_error

    payload = _parse_json(request)
    error = _missing_fields(payload, ["classroom_id", "time_slot_id", "day_of_week", "subject"])
    if error:
        return JsonResponse(error, status=400)

    day, day_error = _validate_day_of_week(payload.get("day_of_week"))
    if day_error:
        return day_error

    try:
        classroom_id = int(payload["classroom_id"])
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid classroom"}, status=400)
    classroom = Classroom.objects.filter(id=classroom_id, school=school).first()
    if not classroom:
        return JsonResponse({"error": "Invalid classroom"}, status=400)

    try:
        slot_id = int(payload["time_slot_id"])
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid time slot"}, status=400)
    slot = TimeSlot.objects.filter(id=slot_id, school=school).first()
    if not slot:
        return JsonResponse({"error": "Invalid time slot"}, status=400)

    teacher = None
    if payload.get("teacher_id"):
        try:
            teacher_id = int(payload["teacher_id"])
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid teacher"}, status=400)
        teacher = UserProfile.objects.filter(
            Q(user_id=teacher_id) | Q(id=teacher_id),
            school=school,
            role=UserProfile.ROLE_TEACHER,
        ).first()
        if not teacher:
            return JsonResponse({"error": "Invalid teacher"}, status=400)

    conflict_error = _check_schedule_conflicts(school, classroom, teacher, day, slot)
    if conflict_error:
        return conflict_error

    entry, _ = ClassScheduleEntry.objects.update_or_create(
        classroom=classroom,
        time_slot=slot,
        day_of_week=day,
        defaults={"subject": payload.get("subject", ""), "teacher": teacher},
    )
    _log_action(
        auth["user"],
        school,
        "schedule_set",
        f"classroom={classroom.id} day={day} slot={slot.id}",
        request,
    )
    return JsonResponse({"data": _serialize_schedule(entry)}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
def teacher_schedule(request, teacher_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    items = ClassScheduleEntry.objects.filter(
        classroom__school=school,
        teacher__user_id=teacher_id,
    ).order_by("day_of_week", "time_slot__sort_order")
    return JsonResponse(_paginate(request, items, _serialize_schedule))


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def schedule_detail(request, schedule_id: int):
    auth, error = _require_auth(request)
    if error:
        return error
    school, error = _require_profile_school(auth["user"])
    if error:
        return error

    entry = ClassScheduleEntry.objects.filter(id=schedule_id, classroom__school=school).first()
    if not entry:
        return JsonResponse({"error": "Not found"}, status=404)

    role_error = _require_roles(
        auth["user"],
        [
            UserProfile.ROLE_ADMIN,
            UserProfile.ROLE_DIRECTOR,
            UserProfile.ROLE_COORDINATOR,
            UserProfile.ROLE_STAFF,
        ],
    )
    if role_error:
        return role_error

    if request.method == "DELETE":
        entry.delete()
        _log_action(
            auth["user"],
            school,
            "schedule_deleted",
            str(schedule_id),
            request,
        )
        return JsonResponse({"success": True})

    payload = _parse_json(request)
    if "day_of_week" in payload:
        day, day_error = _validate_day_of_week(payload.get("day_of_week"))
        if day_error:
            return day_error
        entry.day_of_week = day
    if "time_slot_id" in payload:
        try:
            slot_id = int(payload["time_slot_id"])
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid time slot"}, status=400)
        slot = TimeSlot.objects.filter(id=slot_id, school=school).first()
        if not slot:
            return JsonResponse({"error": "Invalid time slot"}, status=400)
        entry.time_slot = slot
    if "subject" in payload:
        entry.subject = payload.get("subject", "")
    if "teacher_id" in payload:
        if payload.get("teacher_id"):
            try:
                teacher_id = int(payload["teacher_id"])
            except (TypeError, ValueError):
                return JsonResponse({"error": "Invalid teacher"}, status=400)
            teacher = UserProfile.objects.filter(
                Q(user_id=teacher_id) | Q(id=teacher_id),
                school=school,
                role=UserProfile.ROLE_TEACHER,
            ).first()
            if not teacher:
                return JsonResponse({"error": "Invalid teacher"}, status=400)
            entry.teacher = teacher
        else:
            entry.teacher = None
    conflict_error = _check_schedule_conflicts(
        school, entry.classroom, entry.teacher, entry.day_of_week, entry.time_slot
    )
    if conflict_error:
        return conflict_error
    entry.save()
    _log_action(
        auth["user"],
        school,
        "schedule_updated",
        str(entry.id),
        request,
    )
    return JsonResponse({"data": _serialize_schedule(entry)})

@csrf_exempt
@require_POST
def generate_insight(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["prompt"])
    if error:
        return JsonResponse(error, status=400)
    text = generate_text(payload["prompt"], system_instruction=SYSTEM_INSTRUCTION_INSIGHTS)
    return JsonResponse({"text": text})


@csrf_exempt
@require_POST
def generate_lesson_plan(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["subject", "topic", "duration"])
    if error:
        return JsonResponse(error, status=400)
    prompt = (
        "Create a structured lesson plan for {subject} on the topic \"{topic}\". "
        "Duration: {duration}. Include Learning Objectives, Activities, and Assessment. "
        "Format as Markdown."
    ).format(
        subject=payload["subject"],
        topic=payload["topic"],
        duration=payload["duration"],
    )
    text = generate_text(prompt)
    return JsonResponse({"text": text})


@csrf_exempt
@require_POST
def analyze_financial_health(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["data"])
    if error:
        return JsonResponse(error, status=400)
    data = payload["data"]
    if isinstance(data, (dict, list)):
        data = json.dumps(data, ensure_ascii=False)
    prompt = (
        "Analyze this financial summary JSON and provide 3 key bullet points for the school director "
        "regarding cash flow and delinquency risks: {data}"
    ).format(data=data)
    text = generate_text(prompt)
    return JsonResponse({"text": text})


@csrf_exempt
@require_POST
def generate_school_document(request):
    payload = _parse_json(request)
    error = _missing_fields(payload, ["student_name", "doc_type", "details"])
    if error:
        return JsonResponse(error, status=400)
    prompt = (
        "Atue como secretario escolar. Redija um documento oficial do tipo \"{doc_type}\" "
        "para o aluno \"{student_name}\". Contexto/Detalhes: \"{details}\". "
        "O documento deve ter cabecalho formal (EduSaaS Nexus), corpo do texto juridico/administrativo, "
        "local e data (use a data de hoje), e espaco para assinatura. Use formatacao Markdown."
    ).format(
        doc_type=payload["doc_type"],
        student_name=payload["student_name"],
        details=payload["details"],
    )
    text = generate_text(prompt)
    return JsonResponse({"text": text})
