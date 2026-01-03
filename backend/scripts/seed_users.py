import os
import sys
from pathlib import Path

import django

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexus_backend.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.utils import timezone  # noqa: E402

from api.models import School, Student, UserProfile  # noqa: E402


DEFAULT_PASSWORD = "Nexus@123"
DEFAULT_SCHOOL_NAME = "Escola Nexus"


def ensure_user(username, email, role, school, student=None):
    User = get_user_model()
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "first_name": username.split(".")[0].title(),
            "last_name": username.split(".")[1].title() if "." in username else "",
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
    if profile.school_id != (school.id if school else None):
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

    return user, created


def main():
    school, _ = School.objects.get_or_create(name=DEFAULT_SCHOOL_NAME)

    student_record, _ = Student.objects.get_or_create(
        school=school,
        first_name="Aluno",
        last_name="Nexus",
    )

    users = [
        ("admin.nexus", "admin@nexus.local", UserProfile.ROLE_ADMIN, None),
        ("director.nexus", "director@nexus.local", UserProfile.ROLE_DIRECTOR, None),
        ("coordinator.nexus", "coordinator@nexus.local", UserProfile.ROLE_COORDINATOR, None),
        ("teacher.nexus", "teacher@nexus.local", UserProfile.ROLE_TEACHER, None),
        ("student.nexus", "student@nexus.local", UserProfile.ROLE_STUDENT, student_record),
        ("staff.nexus", "staff@nexus.local", UserProfile.ROLE_STAFF, None),
        ("finance.nexus", "finance@nexus.local", UserProfile.ROLE_FINANCE, None),
        ("support.nexus", "support@nexus.local", UserProfile.ROLE_SUPPORT, None),
    ]

    created_count = 0
    for username, email, role, student in users:
        _, created = ensure_user(username, email, role, school, student=student)
        if created:
            created_count += 1

    print(f"Seed concluido. Usuarios criados: {created_count}/{len(users)}")
    print(f"Escola: {school.name}")
    print(f"Senha padrao: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()
