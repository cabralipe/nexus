import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def _upload_path(instance, filename):
    return f"uploads/{instance.school_id}/{instance.entity_type}/{filename}"


class School(models.Model):
    name = models.CharField(max_length=200)
    cnpj = models.CharField(max_length=20, blank=True, unique=True, null=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class UserProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_DIRECTOR = "director"
    ROLE_COORDINATOR = "coordinator"
    ROLE_TEACHER = "teacher"
    ROLE_STAFF = "staff"
    ROLE_FINANCE = "finance"
    ROLE_SUPPORT = "support"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Administrador"),
        (ROLE_DIRECTOR, "Diretor"),
        (ROLE_COORDINATOR, "Coordenador"),
        (ROLE_TEACHER, "Professor"),
        (ROLE_STAFF, "Equipe"),
        (ROLE_FINANCE, "Financeiro"),
        (ROLE_SUPPORT, "Suporte"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, blank=True)
    student = models.OneToOneField(
        "Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STAFF)
    department = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    admission_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"


class Classroom(models.Model):
    SHIFT_MORNING = "morning"
    SHIFT_AFTERNOON = "afternoon"
    SHIFT_EVENING = "evening"

    SHIFT_CHOICES = [
        (SHIFT_MORNING, "Manha"),
        (SHIFT_AFTERNOON, "Tarde"),
        (SHIFT_EVENING, "Noite"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    grade = models.CharField(max_length=50, blank=True)
    year = models.PositiveIntegerField()
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES, default=SHIFT_MORNING)
    capacity = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("school", "name", "year")]
        ordering = ["-year", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.year})"


class Student(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"
    STATUS_GRADUATED = "graduated"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Ativo"),
        (STATUS_INACTIVE, "Inativo"),
        (STATUS_GRADUATED, "Concluido"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=120, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    cpf = models.CharField(max_length=20, blank=True)
    main_address = models.TextField(blank=True)
    reserve_address = models.TextField(blank=True)
    health_allergies = models.JSONField(default=list, blank=True)
    health_medications = models.JSONField(default=list, blank=True)
    health_conditions = models.TextField(blank=True)
    blood_type = models.CharField(max_length=10, blank=True)
    enrollment_code = models.CharField(max_length=50, blank=True)
    tuition_status = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["school", "enrollment_code"]),
        ]
        ordering = ["first_name", "last_name"]

    def __str__(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.first_name


class Guardian(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    relation = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    cpf = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class EmergencyContact(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="emergency_contacts")
    name = models.CharField(max_length=120)
    relation = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_legal_guardian = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.student})"


class StudentParent(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="parents")
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("student", "guardian")]

    def __str__(self) -> str:
        return f"{self.student} - {self.guardian}"


class StudentGuardian(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("student", "guardian")]

    def __str__(self) -> str:
        return f"{self.student} - {self.guardian}"


class Enrollment(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_TRANSFERRED = "transferred"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Ativa"),
        (STATUS_TRANSFERRED, "Transferida"),
        (STATUS_CANCELLED, "Cancelada"),
        (STATUS_COMPLETED, "Concluida"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("student", "classroom", "start_date")]
        ordering = ["-start_date"]

    def __str__(self) -> str:
        return f"{self.student} - {self.classroom}"


class ClassroomTeacherAllocation(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="teacher_allocations")
    teacher = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    subject = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("classroom", "teacher", "subject")]

    def __str__(self) -> str:
        return f"{self.classroom} - {self.subject}"


class Invoice(models.Model):
    STATUS_OPEN = "open"
    STATUS_PAID = "paid"
    STATUS_OVERDUE = "overdue"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Aberta"),
        (STATUS_PAID, "Paga"),
        (STATUS_OVERDUE, "Vencida"),
        (STATUS_CANCELLED, "Cancelada"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    reference_month = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-due_date"]

    def __str__(self) -> str:
        return f"{self.student} - {self.amount}"


class FinancialTransaction(models.Model):
    TYPE_INCOME = "income"
    TYPE_EXPENSE = "expense"

    STATUS_OPEN = "open"
    STATUS_PAID = "paid"

    TYPE_CHOICES = [
        (TYPE_INCOME, "Receita"),
        (TYPE_EXPENSE, "Despesa"),
    ]
    STATUS_CHOICES = [
        (STATUS_OPEN, "Aberta"),
        (STATUS_PAID, "Paga"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.description} - {self.amount}"


class InventoryItem(models.Model):
    CATEGORY_STATIONERY = "Stationery"
    CATEGORY_CLEANING = "Cleaning"
    CATEGORY_ELECTRONICS = "Electronics"
    CATEGORY_DIDACTIC = "Didactic"

    CATEGORY_CHOICES = [
        (CATEGORY_STATIONERY, "Papelaria"),
        (CATEGORY_CLEANING, "Limpeza"),
        (CATEGORY_ELECTRONICS, "Eletronicos"),
        (CATEGORY_DIDACTIC, "Didatico"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    quantity = models.PositiveIntegerField(default=0)
    min_quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=40, blank=True)
    location = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class GradeRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    subject = models.CharField(max_length=120)
    term = models.CharField(max_length=30, blank=True)
    date = models.DateField(null=True, blank=True)
    grade1 = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade2 = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    recovery_grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    final_grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("student", "classroom", "subject", "term")]

    def __str__(self) -> str:
        return f"{self.student} - {self.subject}"


class AttendanceRecord(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_EXCUSED = "excused"

    STATUS_CHOICES = [
        (STATUS_PRESENT, "Presente"),
        (STATUS_ABSENT, "Falta"),
        (STATUS_EXCUSED, "Justificada"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    teacher = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    subject = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("student", "classroom", "date", "subject")]

    def __str__(self) -> str:
        return f"{self.student} - {self.date}"


class AbsenceJustification(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pendente"),
        (STATUS_APPROVED, "Aprovada"),
        (STATUS_REJECTED, "Rejeitada"),
    ]

    attendance = models.OneToOneField(
        AttendanceRecord,
        on_delete=models.CASCADE,
        related_name="justification",
    )
    reason = models.CharField(max_length=200)
    observation = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="absence_justifications_created",
    )
    decided_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="absence_justifications_decided",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.attendance_id} - {self.status}"


class ClassDiaryEntry(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    teacher = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.CharField(max_length=120)
    date = models.DateField()
    topic = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    homework = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.classroom} - {self.subject} - {self.date}"


class LearningMaterial(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    material_type = models.CharField(max_length=50, blank=True)
    date = models.DateField()
    size = models.CharField(max_length=30, blank=True)
    url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self) -> str:
        return self.title


class Syllabus(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    subject = models.CharField(max_length=120)
    grade_level = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)
    bibliography = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["subject"]

    def __str__(self) -> str:
        return self.subject


class GradingConfig(models.Model):
    SYSTEM_BIMESTRAL = "bimestral"
    SYSTEM_TRIMESTRAL = "trimestral"
    METHOD_ARITHMETIC = "arithmetic"
    METHOD_WEIGHTED = "weighted"

    SYSTEM_CHOICES = [
        (SYSTEM_BIMESTRAL, "Bimestral"),
        (SYSTEM_TRIMESTRAL, "Trimestral"),
    ]
    METHOD_CHOICES = [
        (METHOD_ARITHMETIC, "Media aritmetica"),
        (METHOD_WEIGHTED, "Media ponderada"),
    ]

    school = models.OneToOneField(School, on_delete=models.CASCADE)
    system = models.CharField(max_length=20, choices=SYSTEM_CHOICES, default=SYSTEM_BIMESTRAL)
    calculation_method = models.CharField(
        max_length=20, choices=METHOD_CHOICES, default=METHOD_ARITHMETIC
    )
    min_passing_grade = models.DecimalField(max_digits=5, decimal_places=2, default=6)
    weights = models.JSONField(default=dict, blank=True)
    recovery_rule = models.CharField(max_length=50, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.school} - Config"


class AcademicTarget(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    month_label = models.CharField(max_length=100)
    required_classes = models.PositiveIntegerField(default=0)
    grade_submission_deadline = models.DateField()
    exam_submission_deadline = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-grade_submission_deadline", "-exam_submission_deadline"]

    def __str__(self) -> str:
        return f"{self.school} - {self.month_label}"


class ExamSubmission(models.Model):
    TYPE_STANDARD = "Standard"
    TYPE_ADAPTED = "Adapted"

    STATUS_PENDING = "Pending"
    STATUS_APPROVED = "Approved"
    STATUS_CHANGES_REQUESTED = "ChangesRequested"

    TYPE_CHOICES = [
        (TYPE_STANDARD, "Padrao"),
        (TYPE_ADAPTED, "Adaptada"),
    ]

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pendente"),
        (STATUS_APPROVED, "Aprovada"),
        (STATUS_CHANGES_REQUESTED, "Revisao Solicitada"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=120)
    grade_level = models.CharField(max_length=80, blank=True)
    exam_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_STANDARD)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    student_name = models.CharField(max_length=120, blank=True)
    feedback = models.TextField(blank=True)
    scheduled_date = models.DateField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exam_submissions",
    )
    decided_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exam_submissions_decided",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self) -> str:
        return self.title


class Notice(models.Model):
    TYPE_GENERAL = "general"
    TYPE_URGENT = "urgent"
    TYPE_ACADEMIC = "academic"

    TYPE_CHOICES = [
        (TYPE_GENERAL, "Geral"),
        (TYPE_URGENT, "Urgente"),
        (TYPE_ACADEMIC, "Academico"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    author = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=200)
    content = models.TextField()
    notice_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_GENERAL)
    date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self) -> str:
        return self.title


class Conversation(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("school", "student")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.school} - {self.student}"


class Message(models.Model):
    SENDER_SCHOOL = "school"
    SENDER_PARENT = "parent"

    SENDER_CHOICES = [
        (SENDER_SCHOOL, "Escola"),
        (SENDER_PARENT, "Responsavel"),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES)
    sender_profile = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    text = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self) -> str:
        return f"{self.conversation} - {self.sender_type}"


class TimeSlot(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    label = models.CharField(max_length=50, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "start_time"]

    def __str__(self) -> str:
        return self.label or f"{self.start_time} - {self.end_time}"


class TeacherAvailability(models.Model):
    DAY_CHOICES = [
        (0, "Segunda"),
        (1, "Terca"),
        (2, "Quarta"),
        (3, "Quinta"),
        (4, "Sexta"),
        (5, "Sabado"),
        (6, "Domingo"),
    ]

    teacher = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("teacher", "time_slot", "day_of_week")]

    def __str__(self) -> str:
        return f"{self.teacher} - {self.day_of_week}"


class ClassScheduleEntry(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    day_of_week = models.PositiveSmallIntegerField(choices=TeacherAvailability.DAY_CHOICES)
    subject = models.CharField(max_length=120)
    teacher = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("classroom", "time_slot", "day_of_week")]
        ordering = ["day_of_week", "time_slot__sort_order"]

    def __str__(self) -> str:
        return f"{self.classroom} - {self.subject}"


class UploadAttachment(models.Model):
    ENTITY_MATERIAL = "material"
    ENTITY_JUSTIFICATION = "justification"
    ENTITY_EXAM = "exam"
    ENTITY_MESSAGE = "message"

    ENTITY_CHOICES = [
        (ENTITY_MATERIAL, "Material"),
        (ENTITY_JUSTIFICATION, "Justificativa"),
        (ENTITY_EXAM, "Prova"),
        (ENTITY_MESSAGE, "Mensagem"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    entity_type = models.CharField(max_length=30, choices=ENTITY_CHOICES)
    entity_id = models.CharField(max_length=100)
    file = models.FileField(upload_to=_upload_path)
    original_name = models.CharField(max_length=200)
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.original_name


class AuditLog(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    user = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    detail = models.TextField(blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.action


class ApiToken(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

    @classmethod
    def issue_for_user(cls, user):
        key = secrets.token_urlsafe(32)
        return cls.objects.create(key=key, user=user)

    def touch(self):
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at"])


class PasswordResetToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=128, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "expires_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.expires_at.isoformat()}"
