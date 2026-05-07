-- 护士培训系统数据库初始化脚本
-- 数据库：nurse_training_system
-- 注意：管理员账户由 entrypoint 脚本动态创建，不在此处硬编码密码

CREATE DATABASE IF NOT EXISTS nurse_training_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nurse_training_system;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    email VARCHAR(100) COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '手机号',
    real_name VARCHAR(50) NOT NULL COMMENT '真实姓名',
    role ENUM('nurse', 'admin') NOT NULL DEFAULT 'nurse' COMMENT '角色：护士/管理员',
    department VARCHAR(100) COMMENT '所属科室',
    status ENUM('active', 'disabled') DEFAULT 'active' COMMENT '账号状态',
    points INT DEFAULT 0 COMMENT '积分',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL COMMENT '类别名称',
    description TEXT COMMENT '类别描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL COMMENT '类别ID',
    title VARCHAR(200) NOT NULL COMMENT '案例标题',
    case_guide TEXT COMMENT '案例指引',
    site_info VARCHAR(100) COMMENT '站点信息',
    file_path VARCHAR(500) COMMENT '原始文档路径',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES case_categories(id)
);

CREATE TABLE IF NOT EXISTS stations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL COMMENT '案例ID',
    name VARCHAR(200) NOT NULL COMMENT '站点名称',
    assessment_task TEXT COMMENT '考核任务',
    question TEXT NOT NULL COMMENT '问题',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    station_id INT NOT NULL COMMENT '站点ID',
    answer_item TEXT NOT NULL COMMENT '答案项',
    score_weight DECIMAL(5,2) DEFAULT 1.00 COMMENT '分值权重',
    order_index INT DEFAULT 0 COMMENT '答案顺序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extended_knowledge (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL COMMENT '案例ID',
    question TEXT NOT NULL COMMENT '扩展知识问题',
    answer TEXT NOT NULL COMMENT '扩展知识答案',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    station_id INT NOT NULL COMMENT '站点ID',
    user_answer TEXT COMMENT '用户答案',
    score DECIMAL(5,2) COMMENT '得分',
    max_score DECIMAL(5,2) DEFAULT 100.00 COMMENT '满分',
    ai_feedback TEXT COMMENT 'AI评价反馈',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE IF NOT EXISTS wrong_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    station_id INT NOT NULL COMMENT '站点ID',
    score DECIMAL(5,2) COMMENT '得分',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    UNIQUE KEY unique_user_station (user_id, station_id)
);

CREATE TABLE IF NOT EXISTS exams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT '考试标题',
    description TEXT COMMENT '考试描述',
    creator_id INT NOT NULL COMMENT '创建者ID',
    start_time TIMESTAMP NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL COMMENT '结束时间',
    duration INT DEFAULT 60 COMMENT '考试时长(分钟)',
    status ENUM('draft', 'published', 'ended') DEFAULT 'draft' COMMENT '考试状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    exam_id INT NOT NULL COMMENT '考试ID',
    station_id INT NOT NULL COMMENT '站点ID',
    score DECIMAL(5,2) DEFAULT 10.00 COMMENT '题目分值',
    order_index INT DEFAULT 0 COMMENT '题目顺序',
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE IF NOT EXISTS exam_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    exam_id INT NOT NULL COMMENT '考试ID',
    user_id INT NOT NULL COMMENT '用户ID',
    total_score DECIMAL(5,2) DEFAULT 0 COMMENT '总分',
    max_score DECIMAL(5,2) DEFAULT 100 COMMENT '满分',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    submit_time TIMESTAMP NULL COMMENT '提交时间',
    status ENUM('in_progress', 'submitted') DEFAULT 'in_progress' COMMENT '考试状态',
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    exam_record_id INT NOT NULL COMMENT '考试记录ID',
    station_id INT NOT NULL COMMENT '站点ID',
    user_answer TEXT COMMENT '用户答案',
    score DECIMAL(5,2) DEFAULT 0 COMMENT '得分',
    ai_feedback TEXT COMMENT 'AI评价反馈',
    FOREIGN KEY (exam_record_id) REFERENCES exam_records(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE IF NOT EXISTS point_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    points INT NOT NULL COMMENT '积分变化',
    reason VARCHAR(200) COMMENT '积分原因',
    related_id INT COMMENT '关联ID',
    related_type ENUM('learning', 'exam') COMMENT '关联类型',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    content_type ENUM('station_answer', 'knowledge_answer') NOT NULL COMMENT '评论内容类型',
    content_id INT NOT NULL COMMENT '关联的答案ID',
    content TEXT NOT NULL COMMENT '评论内容',
    comment_type ENUM('comment', 'question', 'answer', 'suggestion') DEFAULT 'comment' COMMENT '评论类型',
    parent_id INT COMMENT '父评论ID',
    likes_count INT DEFAULT 0 COMMENT '点赞数',
    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id),
    INDEX idx_content_type_id (content_type, content_id),
    INDEX idx_user_status (user_id, status),
    INDEX idx_parent_status (parent_id, status)
);

CREATE TABLE IF NOT EXISTS comment_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    comment_id INT NOT NULL COMMENT '评论ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    UNIQUE KEY unique_user_comment_like (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS comment_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '举报用户ID',
    comment_id INT NOT NULL COMMENT '被举报评论ID',
    reason ENUM('spam', 'inappropriate', 'offensive', 'other') NOT NULL COMMENT '举报原因',
    description TEXT COMMENT '举报详情',
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending' COMMENT '处理状态',
    admin_note TEXT COMMENT '管理员处理意见',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    UNIQUE KEY unique_user_comment_report (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS ai_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(20) NOT NULL DEFAULT 'local' COMMENT 'glm | openai | local',
    openai_key VARCHAR(200) COMMENT 'OpenAI Key',
    openai_model VARCHAR(100) COMMENT 'OpenAI 模型',
    zhipu_key VARCHAR(200) COMMENT '智谱GLM Key',
    zhipu_model VARCHAR(100) COMMENT '智谱GLM 模型',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weakness_analysis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE COMMENT '用户ID',
    content LONGTEXT NOT NULL COMMENT '分析JSON文本',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category_id);
CREATE INDEX IF NOT EXISTS idx_stations_case ON stations(case_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_user ON learning_records(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_station ON learning_records(station_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_records_user ON exam_records(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_records_exam ON exam_records(exam_id);

INSERT IGNORE INTO case_categories (name, description) VALUES
('儿科模块', '儿科相关医疗案例'),
('内科模块', '内科相关医疗案例'),
('外科模块', '外科相关医疗案例'),
('妇产科模块', '妇产科相关医疗案例'),
('急危重症模板', '急危重症相关医疗案例');

INSERT IGNORE INTO ai_settings (id, provider) VALUES (1, 'local');
