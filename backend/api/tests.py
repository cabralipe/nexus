import json
import tempfile
from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.test.utils import override_settings
from django.utils import timezone

from .models import (
    AcademicTarget,
    AbsenceJustification,
    ApiToken,
    AuditLog,
    AttendanceRecord,
    Classroom,
    ExamSubmission,
    FinancialTransaction,
    GradeRecord,
    GradingConfig,
    InventoryItem,
    Invoice,
    School,
    Student,
    TimeSlot,
    TeacherAvailability,
    UploadAttachment,
    UserProfile,
)


class TestApiCrud(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="password123",
        )
        self.school = School.objects.create(name="Escola Central")
        self.profile = UserProfile.objects.create(
            user=self.user,
            school=self.school,
            role=UserProfile.ROLE_ADMIN,
        )
        self.token = ApiToken.issue_for_user(self.user)
        self.client = Client(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_students_pagination(self):
        for idx in range(30):
            Student.objects.create(
                school=self.school,
                first_name=f"Aluno{idx}",
                last_name="Teste",
            )
        response = self.client.get("/api/students/?page=2&page_size=10")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload["data"]), 10)
        self.assertEqual(payload["pagination"]["page"], 2)
        self.assertEqual(payload["pagination"]["total"], 30)

    def test_enrollment_invalid_date(self):
        student = Student.objects.create(
            school=self.school,
            first_name="Ana",
            last_name="Silva",
        )
        classroom = Classroom.objects.create(
            school=self.school,
            name="1A",
            year=2024,
        )
        response = self.client.post(
            "/api/enrollments/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "classroom_id": classroom.id,
                    "start_date": "2024-13-40",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field"], "start_date")

    def test_invoice_role_restriction(self):
        User = get_user_model()
        staff_user = User.objects.create_user(
            username="staff",
            email="staff@example.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=staff_user,
            school=self.school,
            role=UserProfile.ROLE_STAFF,
        )
        staff_token = ApiToken.issue_for_user(staff_user)
        staff_client = Client(HTTP_AUTHORIZATION=f"Token {staff_token.key}")

        student = Student.objects.create(
            school=self.school,
            first_name="Carlos",
            last_name="Lima",
        )

        response = staff_client.post(
            "/api/invoices/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "amount": "150.00",
                    "due_date": date.today().isoformat(),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

        finance_user = User.objects.create_user(
            username="finance",
            email="finance@example.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=finance_user,
            school=self.school,
            role=UserProfile.ROLE_FINANCE,
        )
        finance_token = ApiToken.issue_for_user(finance_user)
        finance_client = Client(HTTP_AUTHORIZATION=f"Token {finance_token.key}")

        response = finance_client.post(
            "/api/invoices/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "amount": "150.00",
                    "due_date": date.today().isoformat(),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

    def test_token_refresh_and_revoke(self):
        response = self.client.post("/api/auth/refresh/")
        self.assertEqual(response.status_code, 200)
        new_token = response.json()["token"]
        self.assertNotEqual(new_token, self.token.key)

        revoke_client = Client(HTTP_AUTHORIZATION=f"Token {new_token}")
        response = revoke_client.post(
            "/api/auth/revoke/",
            data=json.dumps({"token_key": new_token}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def test_user_crud(self):
        response = self.client.post(
            "/api/users/",
            data=json.dumps(
                {
                    "username": "prof1",
                    "email": "prof1@example.com",
                    "password": "password123",
                    "role": UserProfile.ROLE_TEACHER,
                    "school_id": self.school.id,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        user_id = response.json()["data"]["id"]

        response = self.client.get("/api/users/?role=teacher")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.json()["pagination"]["total"], 1)

        response = self.client.patch(
            f"/api/users/{user_id}/",
            data=json.dumps({"role": UserProfile.ROLE_STAFF}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["role"], UserProfile.ROLE_STAFF)

        response = self.client.delete(f"/api/users/{user_id}/")
        self.assertEqual(response.status_code, 200)


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class TestApiAdvanced(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="admin2",
            email="admin2@example.com",
            password="password123",
        )
        self.school = School.objects.create(name="Escola Beta")
        self.profile = UserProfile.objects.create(
            user=self.user,
            school=self.school,
            role=UserProfile.ROLE_ADMIN,
        )
        self.token = ApiToken.issue_for_user(self.user)
        self.client = Client(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_cashflow_summary(self):
        FinancialTransaction.objects.create(
            school=self.school,
            description="Mensalidade",
            category="Receita",
            amount="100.00",
            transaction_type=FinancialTransaction.TYPE_INCOME,
            status=FinancialTransaction.STATUS_PAID,
            date=date(2024, 1, 5),
        )
        FinancialTransaction.objects.create(
            school=self.school,
            description="Conta luz",
            category="Despesa",
            amount="40.00",
            transaction_type=FinancialTransaction.TYPE_EXPENSE,
            status=FinancialTransaction.STATUS_PAID,
            date=date(2024, 1, 6),
        )
        response = self.client.get("/api/cashflow/")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["summary"]["income"], "100.00")
        self.assertEqual(payload["summary"]["expense"], "40.00")
        self.assertEqual(payload["summary"]["net"], "60.00")

    def test_reconcile_invoices(self):
        student = Student.objects.create(
            school=self.school,
            first_name="Joao",
            last_name="Silva",
        )
        invoice = Invoice.objects.create(
            student=student,
            amount="120.00",
            due_date=date(2024, 2, 5),
            status=Invoice.STATUS_PAID,
            paid_at=timezone.make_aware(datetime(2024, 2, 7, 10, 0, 0)),
        )
        response = self.client.post(
            "/api/invoices/reconcile/",
            data=json.dumps({"invoice_ids": [invoice.id]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["created"], 1)
        self.assertTrue(
            FinancialTransaction.objects.filter(invoice=invoice, school=self.school).exists()
        )

    def test_schedule_conflicts_and_availability(self):
        teacher_user = get_user_model().objects.create_user(
            username="teacher1",
            email="teacher1@example.com",
            password="password123",
        )
        teacher_profile = UserProfile.objects.create(
            user=teacher_user,
            school=self.school,
            role=UserProfile.ROLE_TEACHER,
        )
        classroom_a = Classroom.objects.create(
            school=self.school,
            name="1A",
            year=2024,
            shift=Classroom.SHIFT_MORNING,
        )
        classroom_b = Classroom.objects.create(
            school=self.school,
            name="1B",
            year=2024,
            shift=Classroom.SHIFT_MORNING,
        )
        slot = TimeSlot.objects.create(
            school=self.school,
            label="07:30 - 08:20",
            start_time="07:30",
            end_time="08:20",
            sort_order=1,
        )
        response = self.client.post(
            "/api/schedules/",
            data=json.dumps(
                {
                    "classroom_id": classroom_a.id,
                    "time_slot_id": slot.id,
                    "day_of_week": 1,
                    "subject": "Matematica",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/schedules/",
            data=json.dumps(
                {
                    "classroom_id": classroom_b.id,
                    "time_slot_id": slot.id,
                    "day_of_week": 1,
                    "subject": "Historia",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        TeacherAvailability.objects.create(
            teacher=teacher_profile,
            time_slot=slot,
            day_of_week=2,
        )
        response = self.client.post(
            "/api/schedules/",
            data=json.dumps(
                {
                    "classroom_id": classroom_b.id,
                    "time_slot_id": slot.id,
                    "day_of_week": 2,
                    "subject": "Geografia",
                    "teacher_id": teacher_user.id,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_grading_recovery_and_term(self):
        student = Student.objects.create(
            school=self.school,
            first_name="Ana",
            last_name="Costa",
        )
        classroom = Classroom.objects.create(
            school=self.school,
            name="2A",
            year=2024,
            shift=Classroom.SHIFT_MORNING,
        )
        GradingConfig.objects.update_or_create(
            school=self.school,
            defaults={
                "system": GradingConfig.SYSTEM_TRIMESTRAL,
                "calculation_method": GradingConfig.METHOD_ARITHMETIC,
                "recovery_rule": "max",
            },
        )
        response = self.client.post(
            "/api/grades/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "classroom_id": classroom.id,
                    "subject": "Matematica",
                    "grade1": 6,
                    "grade2": 4,
                    "recovery_grade": 8,
                    "date": "2024-05-10",
                }
            ),
            content_type="application/json",
        )
        payload = response.json()["data"]
        self.assertEqual(response.status_code, 201)
        self.assertEqual(payload["term"], "2")
        self.assertEqual(payload["final_grade"], 8.0)

    def test_uploads_and_audit(self):
        response = self.client.post(
            "/api/students/",
            data=json.dumps(
                {
                    "first_name": "Paula",
                    "last_name": "Lima",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            AuditLog.objects.filter(school=self.school, action="student_created").exists()
        )

        upload = SimpleUploadedFile("teste.txt", b"hello", content_type="text/plain")
        response = self.client.post(
            "/api/uploads/",
            data={"entity_type": "material", "entity_id": "123", "file": upload},
        )
        self.assertEqual(response.status_code, 201)

    def test_inventory_crud(self):
        response = self.client.post(
            "/api/inventory/",
            data=json.dumps(
                {
                    "name": "Papel Sulfite",
                    "category": "Stationery",
                    "quantity": 10,
                    "min_quantity": 5,
                    "unit": "Resmas",
                    "location": "Almoxarifado A",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        item_id = response.json()["data"]["id"]

        response = self.client.get("/api/inventory/?q=Papel")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.json()["pagination"]["total"], 1)

        response = self.client.patch(
            f"/api/inventory/{item_id}/",
            data=json.dumps({"quantity": 20}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["quantity"], 20)

        response = self.client.delete(f"/api/inventory/{item_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(InventoryItem.objects.filter(id=item_id).exists())

    def test_academic_targets_and_exam_submissions(self):
        response = self.client.post(
            "/api/academic-targets/",
            data=json.dumps(
                {
                    "month": "Outubro 2024",
                    "requiredClasses": 20,
                    "gradeSubmissionDeadline": "2024-10-30",
                    "examSubmissionDeadline": "2024-10-20",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        target_id = response.json()["data"]["id"]
        self.assertTrue(AcademicTarget.objects.filter(id=target_id).exists())

        response = self.client.get("/api/academic-targets/")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.json()["pagination"]["total"], 1)

        response = self.client.post(
            "/api/exam-submissions/",
            data=json.dumps(
                {
                    "title": "Prova de Matematica",
                    "subject": "Matematica",
                    "gradeLevel": "9 Ano",
                    "type": "Standard",
                    "status": "Pending",
                    "scheduledDate": "2024-10-25",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        exam_id = response.json()["data"]["id"]

        response = self.client.patch(
            f"/api/exam-submissions/{exam_id}/",
            data=json.dumps({"status": "Approved", "feedback": "Ok"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "Approved")

    def test_exam_upload_attachment(self):
        response = self.client.post(
            "/api/exam-submissions/",
            data=json.dumps(
                {"title": "Prova Historia", "subject": "Historia", "status": "Pending"}
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        exam_id = response.json()["data"]["id"]

        upload = SimpleUploadedFile("prova.pdf", b"arquivo", content_type="application/pdf")
        response = self.client.post(
            "/api/uploads/",
            data={"entity_type": "exam", "entity_id": str(exam_id), "file": upload},
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            UploadAttachment.objects.filter(entity_type="exam", entity_id=str(exam_id)).exists()
        )

        response = self.client.get("/api/exam-submissions/")
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()["data"][0]
        self.assertTrue(payload["attachments"])

    def test_absence_justification_flow(self):
        student = Student.objects.create(
            school=self.school,
            first_name="Pedro",
            last_name="Silva",
        )
        classroom = Classroom.objects.create(
            school=self.school,
            name="3A",
            year=2024,
        )
        response = self.client.post(
            "/api/attendance/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "classroom_id": classroom.id,
                    "date": "2024-10-10",
                    "subject": "Matematica",
                    "status": "absent",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        attendance_id = response.json()["data"]["id"]

        response = self.client.post(
            "/api/justifications/",
            data=json.dumps(
                {
                    "attendance_id": attendance_id,
                    "reason": "Atestado",
                    "observation": "Ok",
                    "status": "approved",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        record = AttendanceRecord.objects.get(id=attendance_id)
        self.assertEqual(record.status, AttendanceRecord.STATUS_EXCUSED)
        self.assertTrue(AbsenceJustification.objects.filter(attendance=record).exists())

    def test_dashboards_and_teacher_activity(self):
        today = timezone.localdate()
        student = Student.objects.create(
            school=self.school,
            first_name="Lucas",
            last_name="Souza",
        )
        classroom = Classroom.objects.create(
            school=self.school,
            name="4A",
            year=2024,
        )
        Invoice.objects.create(
            student=student,
            amount="100.00",
            due_date=today,
            status=Invoice.STATUS_OVERDUE,
        )
        FinancialTransaction.objects.create(
            school=self.school,
            description="Mensalidade",
            category="Receita",
            amount="200.00",
            transaction_type=FinancialTransaction.TYPE_INCOME,
            status=FinancialTransaction.STATUS_PAID,
            date=today,
        )

        response = self.client.get("/api/dashboards/admin/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("finance_series", response.json())

        teacher_user = get_user_model().objects.create_user(
            username="teacher_dash",
            email="teacher_dash@example.com",
            password="password123",
        )
        teacher_profile = UserProfile.objects.create(
            user=teacher_user,
            school=self.school,
            role=UserProfile.ROLE_TEACHER,
        )
        teacher_token = ApiToken.issue_for_user(teacher_user)
        teacher_client = Client(HTTP_AUTHORIZATION=f"Token {teacher_token.key}")

        slot = TimeSlot.objects.create(
            school=self.school,
            label="08:00 - 08:50",
            start_time="08:00",
            end_time="08:50",
            sort_order=1,
        )
        response = teacher_client.post(
            "/api/schedules/",
            data=json.dumps(
                {
                    "classroom_id": classroom.id,
                    "time_slot_id": slot.id,
                    "day_of_week": today.weekday(),
                    "subject": "Matematica",
                    "teacher_id": teacher_user.id,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

        response = teacher_client.post(
            "/api/attendance/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "classroom_id": classroom.id,
                    "date": today.isoformat(),
                    "subject": "Matematica",
                    "status": "present",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

        response = teacher_client.get("/api/dashboards/teacher/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["today_schedule"])

        response = self.client.get("/api/teachers/activities/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"])

        response = self.client.post(
            "/api/grades/",
            data=json.dumps(
                {
                    "student_id": student.id,
                    "classroom_id": classroom.id,
                    "subject": "Matematica",
                    "grade1": 8,
                    "grade2": 7,
                    "date": today.isoformat(),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/exam-submissions/",
            data=json.dumps(
                {
                    "title": "Prova Matematica",
                    "subject": "Matematica",
                    "status": "Pending",
                    "scheduledDate": (today + timezone.timedelta(days=5)).isoformat(),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.get(f"/api/dashboards/student/?student_id={student.id}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["upcoming_events"])
