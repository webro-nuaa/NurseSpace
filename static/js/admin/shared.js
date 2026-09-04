// 管理员端 — 跨模块共用辅助函数（案例难度/类型徽章渲染）
// =========== 辅助函数 ===========
function getDifficultyBadge(d) {
    const map = { basic: 'bg-success', intermediate: 'bg-warning text-dark', advanced: 'bg-danger' };
    const labels = { basic: '基础', intermediate: '中级', advanced: '高级' };
    return `<span class="badge ${map[d] || 'bg-secondary'}">${labels[d] || d}</span>`;
}

function getCaseTypeBadge(t) {
    const map = { learning: 'bg-info', exam: 'bg-primary' };
    const labels = { learning: '学习', exam: '考试' };
    return `<span class="badge ${map[t] || 'bg-secondary'}">${labels[t] || t}</span>`;
}

