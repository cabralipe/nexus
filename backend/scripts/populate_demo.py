import os
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

import django

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexus_backend.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.utils import timezone  # noqa: E402

from api.models import (  # noqa: E402
    AcademicTarget,
    AttendanceRecord,
    Classroom,
    ClassroomTeacherAllocation,
    ClassDiaryEntry,
    ClassScheduleEntry,
    Conversation,
    EmergencyContact,
    ExamSubmission,
    Enrollment,
    FinancialTransaction,
    GradeRecord,
    GradingConfig,
    Guardian,
    InventoryItem,
    InventoryMovement,
    InventoryRequest,
    Invoice,
    LearningMaterial,
    LessonPlan,
    Notice,
    School,
    Student,
    StudentGuardian,
    StudentParent,
    Syllabus,
    TeacherAvailability,
    TimeSlot,
    UserProfile,
)


DEFAULT_PASSWORD = "Nexus@123"
SCHOOL_NAME = "Escola Nexus Demo"


def ensure_user(username, email, role, school, first_name, last_name, student=None):
    User = get_user_model()
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "is_active": True,
            "date_joined": timezone.now(),
        },
    )
    if created:
        user.set_password(DEFAULT_PASSWORD)
        user.save()

    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={"school": school, "role": role, "student": student},
    )
    updated = False
    if profile.school_id != school.id:
        profile.school = school
        updated = True
    if profile.role != role:
        profile.role = role
        updated = True
    if student and profile.student_id != student.id:
        profile.student = student
        updated = True
    if updated:
        profile.save()
    return profile


def ensure_time_slot(school, label, start_h, start_m, end_h, end_m, sort_order):
    slot, _ = TimeSlot.objects.get_or_create(
        school=school,
        label=label,
        defaults={
            "start_time": time(start_h, start_m),
            "end_time": time(end_h, end_m),
            "sort_order": sort_order,
        },
    )
    slot.start_time = time(start_h, start_m)
    slot.end_time = time(end_h, end_m)
    slot.sort_order = sort_order
    slot.save()
    return slot


def main():
    school, _ = School.objects.get_or_create(
        name=SCHOOL_NAME,
        defaults={
            "cnpj": "12.345.678/0001-90",
            "email": "contato@nexus.demo",
            "phone": "(11) 9999-9999",
            "address_line1": "Rua da Educacao, 100",
            "city": "Sao Paulo",
            "state": "SP",
            "postal_code": "01000-000",
        },
    )

    today = timezone.localdate()
    this_year = today.year

    students = []
    for idx, (first, last) in enumerate(
        [
            ("Ana", "Silva"),
            ("Bruno", "Santos"),
            ("Carla", "Oliveira"),
            ("Diego", "Ferreira"),
            ("Elisa", "Melo"),
            ("Fabio", "Almeida"),
        ],
        start=1,
    ):
        student, _ = Student.objects.get_or_create(
            school=school,
            first_name=first,
            last_name=last,
            defaults={
                "cpf": f"000.000.000-0{idx}",
                "birth_date": date(this_year - 12, 5, min(20, idx + 10)),
                "enrollment_code": f"NEX-{this_year}-{idx:03d}",
                "tuition_status": "Paid" if idx % 2 == 0 else "Pending",
            },
        )
        students.append(student)

        guardian, _ = Guardian.objects.get_or_create(
            school=school,
            name=f"Responsavel {first}",
            defaults={"relation": "Mae", "phone": "(11) 90000-0000"},
        )
        StudentParent.objects.get_or_create(student=student, guardian=guardian, defaults={"is_primary": True})
        StudentGuardian.objects.get_or_create(student=student, guardian=guardian, defaults={"is_primary": True})
        EmergencyContact.objects.get_or_create(
            student=student,
            name=guardian.name,
            defaults={"relation": guardian.relation, "phone": guardian.phone, "is_legal_guardian": True},
        )

    admin = ensure_user("admin.demo", "admin@nexus.demo", UserProfile.ROLE_ADMIN, school, "Admin", "Demo")
    coordinator = ensure_user("coord.demo", "coord@nexus.demo", UserProfile.ROLE_COORDINATOR, school, "Lia", "Coordenadora")
    teacher_math = ensure_user("prof.math", "math@nexus.demo", UserProfile.ROLE_TEACHER, school, "Marcos", "Mathias")
    teacher_port = ensure_user("prof.port", "port@nexus.demo", UserProfile.ROLE_TEACHER, school, "Paula", "Porto")
    finance = ensure_user("finance.demo", "finance@nexus.demo", UserProfile.ROLE_FINANCE, school, "Felipe", "Financeiro")
    support = ensure_user("support.demo", "support@nexus.demo", UserProfile.ROLE_SUPPORT, school, "Sofia", "Suporte")
    student_user = ensure_user(
        "student.demo",
        "student@nexus.demo",
        UserProfile.ROLE_STUDENT,
        school,
        "Aluno",
        "Demo",
        student=students[0],
    )

    teacher_math.department = "Matematica"
    teacher_math.phone = "(11) 93333-1111"
    teacher_math.admission_date = date(this_year - 3, 2, 1)
    teacher_math.save()

    teacher_port.department = "Portugues"
    teacher_port.phone = "(11) 94444-2222"
    teacher_port.admission_date = date(this_year - 2, 3, 1)
    teacher_port.save()

    classrooms = [
        Classroom.objects.get_or_create(
            school=school,
            name="6º Ano A",
            year=this_year,
            defaults={"grade": "6º Ano", "shift": Classroom.SHIFT_MORNING, "capacity": 30},
        )[0],
        Classroom.objects.get_or_create(
            school=school,
            name="7º Ano B",
            year=this_year,
            defaults={"grade": "7º Ano", "shift": Classroom.SHIFT_AFTERNOON, "capacity": 30},
        )[0],
    ]

    for idx, student in enumerate(students):
        classroom = classrooms[idx % len(classrooms)]
        Enrollment.objects.update_or_create(
            student=student,
            classroom=classroom,
            start_date=date(this_year, 2, 1),
            defaults={"status": Enrollment.STATUS_ACTIVE},
        )

    allocations = [
        (classrooms[0], teacher_math, "Matematica"),
        (classrooms[0], teacher_port, "Portugues"),
        (classrooms[1], teacher_math, "Matematica"),
        (classrooms[1], teacher_port, "Portugues"),
    ]
    for classroom, teacher, subject in allocations:
        ClassroomTeacherAllocation.objects.get_or_create(
            classroom=classroom,
            teacher=teacher,
            subject=subject,
        )

    slots = [
        ensure_time_slot(school, "1º Tempo", 8, 0, 8, 50, 1),
        ensure_time_slot(school, "2º Tempo", 9, 0, 9, 50, 2),
        ensure_time_slot(school, "3º Tempo", 10, 0, 10, 50, 3),
    ]

    for teacher in [teacher_math, teacher_port]:
        for day in range(0, 5):
            for slot in slots:
                TeacherAvailability.objects.get_or_create(
                    teacher=teacher,
                    time_slot=slot,
                    day_of_week=day,
                )

    for classroom in classrooms:
        for day in range(0, 5):
            for idx, slot in enumerate(slots):
                allocation = allocations[(idx + day) % len(allocations)]
                subject = allocation[2]
                teacher = allocation[1]
                ClassScheduleEntry.objects.update_or_create(
                    classroom=classroom,
                    time_slot=slot,
                    day_of_week=day,
                    defaults={"subject": subject, "teacher": teacher},
                )

    GradingConfig.objects.update_or_create(
        school=school,
        defaults={
            "system": GradingConfig.SYSTEM_BIMESTRAL,
            "calculation_method": GradingConfig.METHOD_WEIGHTED,
            "min_passing_grade": 7,
            "weights": {"exam": 60, "activities": 30, "participation": 10},
            "recovery_type": GradingConfig.RECOVERY_GRADE,
            "recovery_rule": "average",
        },
    )

    for classroom, teacher, subject in allocations:
        for student in Student.objects.filter(enrollment__classroom=classroom):
            GradeRecord.objects.update_or_create(
                student=student,
                classroom=classroom,
                subject=subject,
                term="1",
                defaults={
                    "date": today,
                    "grade1": 7,
                    "grade2": 8,
                },
            )

            AttendanceRecord.objects.update_or_create(
                student=student,
                classroom=classroom,
                date=today,
                subject=subject,
                defaults={"status": AttendanceRecord.STATUS_PRESENT, "teacher": teacher},
            )

        ClassDiaryEntry.objects.update_or_create(
            classroom=classroom,
            teacher=teacher,
            subject=subject,
            date=today,
            defaults={
                "topic": f"Aula de {subject}",
                "description": "Revisao dos conceitos principais e exercicios guiados.",
                "homework": "Lista de exercicios 1 a 5.",
            },
        )

        LearningMaterial.objects.update_or_create(
            classroom=classroom,
            title=f"Material {subject}",
            defaults={
                "subject": subject,
                "material_type": "PDF",
                "date": today,
                "size": "1.2 MB",
                "url": "https://example.com/material.pdf",
            },
        )

    Syllabus.objects.update_or_create(
        school=school,
        subject="Matematica",
        defaults={
            "grade_level": "6º Ano",
            "description": "Conceitos basicos de numeros, operacoes e geometria.",
            "objectives": ["Identificar numeros inteiros", "Resolver problemas simples"],
            "bibliography": "Livro Matematica Basica, Vol. 1",
        },
    )
    Syllabus.objects.update_or_create(
        school=school,
        subject="Portugues",
        defaults={
            "grade_level": "7º Ano",
            "description": "Leitura, interpretacao e producao de textos.",
            "objectives": ["Analisar textos narrativos", "Produzir resumos"],
            "bibliography": "Livro Lingua Portuguesa, Vol. 2",
        },
    )

    AcademicTarget.objects.update_or_create(
        school=school,
        month_label=today.strftime("%B %Y"),
        defaults={
            "required_classes": 20,
            "grade_submission_deadline": today + timedelta(days=15),
            "exam_submission_deadline": today + timedelta(days=20),
        },
    )

    ExamSubmission.objects.update_or_create(
        school=school,
        title="Prova Matematica 1",
        subject="Matematica",
        defaults={
            "grade_level": "6º Ano",
            "exam_type": ExamSubmission.TYPE_STANDARD,
            "status": ExamSubmission.STATUS_PENDING,
            "submitted_by": teacher_math,
        },
    )

    LessonPlan.objects.update_or_create(
        school=school,
        teacher=teacher_math,
        classroom=classrooms[0],
        subject="Matematica",
        date=today,
        defaults={
            "grade_level": classrooms[0].grade,
            "duration": "50 minutos",
            "topic": "Operacoes basicas",
            "objectives": "Identificar e aplicar operacoes basicas.",
            "content_program": "Adicao, subtracao, multiplicacao.",
            "methodology": "Aula expositiva e exercicios guiados.",
            "resources": "Quadro, lista impressa.",
            "activities": "Introducao, pratica em duplas, revisao.",
            "assessment": "Participacao e exercicios.",
            "status": LessonPlan.STATUS_APPROVED,
            "feedback": "Plano aprovado.",
            "decided_by": coordinator,
            "decided_at": timezone.now(),
        },
    )
    LessonPlan.objects.update_or_create(
        school=school,
        teacher=teacher_port,
        classroom=classrooms[1],
        subject="Portugues",
        date=today,
        defaults={
            "grade_level": classrooms[1].grade,
            "duration": "50 minutos",
            "topic": "Interpretacao de texto",
            "objectives": "Analisar textos narrativos.",
            "content_program": "Leitura e discussao em grupo.",
            "methodology": "Debate e leitura dirigida.",
            "resources": "Livro didatico, projetor.",
            "activities": "Leitura coletiva, perguntas guiadas.",
            "assessment": "Participacao no debate.",
            "status": LessonPlan.STATUS_PENDING,
        },
    )

    Notice.objects.update_or_create(
        school=school,
        title="Reuniao de pais",
        defaults={
            "author": admin,
            "content": "Reuniao marcada para sexta-feira as 19h.",
            "notice_type": Notice.TYPE_GENERAL,
            "date": today,
        },
    )

    item = InventoryItem.objects.update_or_create(
        school=school,
        name="Folha A4",
        defaults={
            "category": InventoryItem.CATEGORY_STATIONERY,
            "quantity": 200,
            "min_quantity": 50,
            "unit": "pacote",
            "location": "Sala 01",
        },
    )[0]
    request = InventoryRequest.objects.update_or_create(
        school=school,
        item=item,
        requested_by=teacher_math,
        defaults={"quantity": 2, "status": InventoryRequest.STATUS_PENDING, "notes": "Para atividades."},
    )[0]
    InventoryMovement.objects.update_or_create(
        school=school,
        item=item,
        movement_type=InventoryMovement.TYPE_OUT,
        related_request=request,
        defaults={
            "quantity": 1,
            "reason": "Uso em sala",
            "created_by": support,
        },
    )

    invoice = Invoice.objects.update_or_create(
        student=students[0],
        due_date=today + timedelta(days=10),
        defaults={
            "amount": 850.0,
            "status": Invoice.STATUS_OPEN,
            "reference_month": today.replace(day=1),
        },
    )[0]
    FinancialTransaction.objects.update_or_create(
        school=school,
        invoice=invoice,
        description="Mensalidade",
        date=today,
        defaults={
            "amount": 850.0,
            "transaction_type": FinancialTransaction.TYPE_INCOME,
            "status": FinancialTransaction.STATUS_OPEN,
            "category": "Mensalidades",
            "student": students[0],
        },
    )

    conversation, _ = Conversation.objects.get_or_create(school=school, student=students[0])
    conversation.messages.update_or_create(
        sender_type="school",
        text="Bem-vindo ao canal de comunicacao.",
        defaults={"sender_profile": admin},
    )

    print("Populate concluido.")
    print(f"Escola: {school.name}")
    print(f"Senha padrao: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()
