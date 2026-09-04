// 管理员端 — 导航 shims：写入 history 状态后调用对应加载函数。
// adminPushView / adminReplaceView 由 templates/admin/index.html 内联脚本在运行时提供。

// ============================================================================
// Navigation shims — push history state, then call the loader function.
// adminPushView / adminReplaceView are defined in the inline script in
// templates/admin/index.html.  They are not available at parse time (this
// module loads first), but they will be at runtime when a user clicks a link.
// The typeof guard ensures graceful degradation if the inline script fails.
// ============================================================================

function navToCases() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'cases'});
    loadCases();
}
function navToCaseCreate() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'cases', view: 'create'});
    renderCaseCreatePage();
}
function navToCaseDetail(caseId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'cases', case_id: String(caseId)});
    renderCaseDetailPage(caseId);
}
function navToStationEdit(caseId, stationId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'cases', case_id: String(caseId), station_id: String(stationId)});
    renderStationEditPage(caseId, stationId);
}
function navToUsers() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'users'});
    loadUsers();
}
function navToUserDetail(userId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'users', user_id: String(userId)});
    renderUserDetailPage(userId);
}
function navToUserEdit(userId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'users', user_id: String(userId), view: 'edit'});
    renderUserEditPage(userId);
}
function navToUserCreate() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'users', view: 'create'});
    renderUserCreatePage();
}
function navToUserImport() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'users', view: 'import'});
    renderUserImportPage();
}
function navToExams() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams'});
    loadExams();
}
function navToExamCreate() {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams', view: 'create'});
    renderExamCreatePage();
}
function navToExamEdit(examId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams', exam_id: String(examId), view: 'edit'});
    renderExamEditPage(examId);
}
function navToExamQuestions(examId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams', exam_id: String(examId), view: 'questions'});
    manageExamQuestions(examId);
}
function navToExamReview(examId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams', exam_id: String(examId), view: 'review'});
    reviewExam(examId);
}
function navToParticipantDetail(examId, recordId) {
    if (typeof adminPushView === 'function') adminPushView({tab: 'exams', exam_id: String(examId), record_id: String(recordId)});
    viewParticipantDetail(examId, recordId);
}

// Pagination helpers — use replaceState to avoid history pollution
function navToUsersPage(page) {
    if (typeof adminReplaceView === 'function') adminReplaceView({tab: 'users', page: String(page)});
    loadUsers(page);
}
function navToCasesPage(page) {
    var params = {tab: 'cases', page: String(page)};
    if (caseCategoryFilter) params.category_id = String(caseCategoryFilter);
    if (caseSearch) params.search = caseSearch;
    var typeFilter = $('#case-type-filter').val();
    if (typeFilter) params.case_type = typeFilter;
    if (typeof adminReplaceView === 'function') adminReplaceView(params);
    loadCases(page);
}
