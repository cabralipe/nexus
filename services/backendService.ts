const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type RequestOptions = {
  method?: string;
  body?: Record<string, unknown> | null;
  skipAuth?: boolean;
};

const getAuthToken = (): string | null => {
  return localStorage.getItem("authToken") || localStorage.getItem("token");
};

const requestJson = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Token ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error || "Request failed";
    throw new Error(error);
  }
  return data as T;
};

const withPagination = <T>(data: { data: T[] }): T[] => data.data || [];

export const backend = {
  async login(usernameOrEmail: string, password: string) {
    return requestJson<{ token: string; user: any }>("/auth/login/", {
      method: "POST",
      body: { username_or_email: usernameOrEmail, password },
      skipAuth: true,
    });
  },
  async logout() {
    return requestJson<{ success: boolean }>("/auth/logout/", { method: "POST" });
  },
  async fetchMe() {
    return requestJson<{ id: string; role: string; email: string; school?: any; student_id?: string | number }>(
      "/auth/me/"
    );
  },
  async fetchStudents() {
    const data = await requestJson<{ data: any[] }>("/students/?page_size=200");
    return withPagination(data);
  },
  async createStudent(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/students/", { method: "POST", body: payload });
    return data.data;
  },
  async updateStudent(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/students/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteStudent(id: string) {
    return requestJson<{ success: boolean }>(`/students/${id}/`, { method: "DELETE" });
  },
  async fetchStaff() {
    const data = await requestJson<{ data: any[] }>("/staff/?page_size=200");
    return withPagination(data);
  },
  async createStaff(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/staff/", { method: "POST", body: payload });
    return data.data;
  },
  async updateStaff(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/staff/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteStaff(id: string) {
    return requestJson<{ success: boolean }>(`/staff/${id}/`, { method: "DELETE" });
  },
  async fetchClassrooms() {
    const data = await requestJson<{ data: any[] }>("/classrooms/?page_size=200");
    return withPagination(data);
  },
  async createClassroom(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/classrooms/", { method: "POST", body: payload });
    return data.data;
  },
  async updateClassroom(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/classrooms/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteClassroom(id: string) {
    return requestJson<{ success: boolean }>(`/classrooms/${id}/`, { method: "DELETE" });
  },
  async fetchClassroomStudents(classroomId: string) {
    const data = await requestJson<{ data: string[] }>(`/classrooms/${classroomId}/students/`);
    return data.data || [];
  },
  async addClassroomStudent(classroomId: string, studentId: string) {
    const data = await requestJson<{ data: any }>(`/classrooms/${classroomId}/students/`, {
      method: "POST",
      body: { student_id: studentId },
    });
    return data.data;
  },
  async removeClassroomStudent(classroomId: string, studentId: string) {
    return requestJson<{ success: boolean }>(`/classrooms/${classroomId}/students/`, {
      method: "DELETE",
      body: { student_id: studentId },
    });
  },
  async fetchAllocations(classroomId: string) {
    const data = await requestJson<{ data: any[] }>(
      `/classrooms/${classroomId}/allocations/`
    );
    return data.data || [];
  },
  async setAllocation(classroomId: string, teacherId: string, subject: string) {
    const data = await requestJson<{ data: any }>(`/classrooms/${classroomId}/allocations/`, {
      method: "POST",
      body: { teacher_id: teacherId, subject },
    });
    return data.data;
  },
  async removeAllocation(classroomId: string, teacherId: string, subject: string) {
    return requestJson<{ success: boolean }>(`/classrooms/${classroomId}/allocations/`, {
      method: "DELETE",
      body: { teacher_id: teacherId, subject },
    });
  },
  async fetchEnrollments() {
    const data = await requestJson<{ data: any[] }>("/enrollments/?page_size=200");
    return withPagination(data);
  },
  async fetchGrades(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/grades/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async upsertGrade(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/grades/", { method: "POST", body: payload });
    return data.data;
  },
  async fetchAttendance(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/attendance/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async upsertAttendance(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/attendance/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async fetchJustifications(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/justifications/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async createJustification(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/justifications/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateJustification(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/justifications/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteJustification(id: string) {
    return requestJson<{ success: boolean }>(`/justifications/${id}/`, { method: "DELETE" });
  },
  async fetchDiaryEntries(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/diary-entries/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async createDiaryEntry(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/diary-entries/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateDiaryEntry(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/diary-entries/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteDiaryEntry(id: string) {
    return requestJson<{ success: boolean }>(`/diary-entries/${id}/`, { method: "DELETE" });
  },
  async fetchMaterials(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/materials/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async createMaterial(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/materials/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateMaterial(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/materials/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async fetchSyllabi(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/syllabi/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async updateSyllabus(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/syllabi/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async fetchInvoices() {
    const data = await requestJson<{ data: any[] }>("/invoices/?page_size=200");
    return withPagination(data);
  },
  async fetchTransactions(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/transactions/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async fetchCashflow(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return requestJson<{ summary: any; monthly: any[] }>(
      `/cashflow/${query ? `?${query}` : ""}`
    );
  },
  async createTransaction(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/transactions/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async fetchInventory(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/inventory/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async createInventoryItem(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/inventory/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateInventoryItem(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/inventory/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteInventoryItem(id: string) {
    return requestJson<{ success: boolean }>(`/inventory/${id}/`, { method: "DELETE" });
  },
  async fetchAcademicTargets() {
    const data = await requestJson<{ data: any[] }>("/academic-targets/?page_size=200");
    return withPagination(data);
  },
  async createAcademicTarget(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/academic-targets/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateAcademicTarget(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/academic-targets/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteAcademicTarget(id: string) {
    return requestJson<{ success: boolean }>(`/academic-targets/${id}/`, { method: "DELETE" });
  },
  async fetchExamSubmissions(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/exam-submissions/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async createExamSubmission(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/exam-submissions/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async updateExamSubmission(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/exam-submissions/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async deleteExamSubmission(id: string) {
    return requestJson<{ success: boolean }>(`/exam-submissions/${id}/`, { method: "DELETE" });
  },
  async fetchNotices() {
    const data = await requestJson<{ data: any[] }>("/notices/?page_size=200");
    return withPagination(data);
  },
  async createNotice(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/notices/", { method: "POST", body: payload });
    return data.data;
  },
  async fetchConversations() {
    const data = await requestJson<{ data: any[] }>("/conversations/?page_size=200");
    return withPagination(data);
  },
  async createConversation(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/conversations/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async fetchMessages(conversationId: string) {
    const data = await requestJson<{ data: any[] }>(
      `/conversations/${conversationId}/messages/?page_size=200`
    );
    return withPagination(data);
  },
  async sendMessage(conversationId: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(
      `/conversations/${conversationId}/messages/`,
      { method: "POST", body: payload }
    );
    return data.data;
  },
  async fetchTimeSlots() {
    const data = await requestJson<{ data: any[] }>("/time-slots/?page_size=200");
    return withPagination(data);
  },
  async createTimeSlot(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/time-slots/", { method: "POST", body: payload });
    return data.data;
  },
  async deleteTimeSlot(id: string) {
    return requestJson<{ success: boolean }>(`/time-slots/${id}/`, { method: "DELETE" });
  },
  async fetchAvailability(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/availability/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async setAvailability(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/availability/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async deleteAvailability(id: string) {
    return requestJson<{ success: boolean }>(`/availability/${id}/`, { method: "DELETE" });
  },
  async fetchSchedules(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/schedules/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async setSchedule(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/schedules/", {
      method: "POST",
      body: payload,
    });
    return data.data;
  },
  async deleteSchedule(id: string) {
    return requestJson<{ success: boolean }>(`/schedules/${id}/`, { method: "DELETE" });
  },
  async fetchTeacherSchedule(teacherId: string) {
    const data = await requestJson<{ data: any[] }>(
      `/teachers/${teacherId}/schedule/?page_size=200`
    );
    return withPagination(data);
  },
  async fetchGradingConfig() {
    const data = await requestJson<{ data: any }>("/grading-config/");
    return data.data;
  },
  async fetchTeacherActivities() {
    return requestJson<{ summary: any; data: any[] }>("/teachers/activities/");
  },
  async fetchAdminDashboard() {
    return requestJson<{
      counts: any;
      invoices: any;
      finance_month: any;
      finance_series: any[];
      enrollment_by_grade: any[];
      attendance_today: any;
      recent_notices: any[];
    }>("/dashboards/admin/");
  },
  async fetchTeacherDashboard() {
    return requestJson<{
      counts: any;
      schedule: any[];
      today_schedule: any[];
      recent_notices: any[];
    }>("/dashboards/teacher/");
  },
  async fetchStudentDashboard(studentId: string) {
    return requestJson<{
      student: any;
      attendance: any;
      grades: any;
      invoices: any[];
      next_invoice: any | null;
      upcoming_events: any[];
      recent_notices: any[];
    }>(`/dashboards/student/?student_id=${studentId}`);
  },
  async fetchAuditLogs(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/audit-logs/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async uploadFile(formData: FormData) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/uploads/`, {
      method: "POST",
      headers: token ? { Authorization: `Token ${token}` } : undefined,
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Upload failed");
    }
    return data.data;
  },
  async fetchUploads(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await requestJson<{ data: any[] }>(
      `/uploads/?page_size=200${query ? `&${query}` : ""}`
    );
    return withPagination(data);
  },
  async deleteUpload(id: string) {
    return requestJson<{ success: boolean }>(`/uploads/${id}/`, { method: "DELETE" });
  },
  async updateGradingConfig(payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>("/grading-config/", {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
  async fetchSchool() {
    const data = await requestJson<{ data: any[] }>("/schools/?page_size=200");
    return (data.data || [])[0];
  },
  async updateSchool(id: string, payload: Record<string, unknown>) {
    const data = await requestJson<{ data: any }>(`/schools/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    return data.data;
  },
};
