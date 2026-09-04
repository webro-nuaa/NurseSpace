// 管理员端 — 使用帮助页（静态内容渲染）

function loadHelp() {
    setActiveNav('使用帮助');
    const html = renderHelpPage();
    $('#main-content').html(html);
}

function renderHelpPage() {
    return '<div class="fade-in">' +
        '<div class="page-title">' +
            '<h2><i class="fas fa-question-circle me-2"></i>使用帮助</h2>' +
            '<p>系统功能说明、数据格式规范与设计理念</p>' +
        '</div>' +

        // 一、系统概述
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-info-circle me-2"></i>一、系统概述</div>' +
            '<div class="card-body">' +
                '<p>NurseSpace 是一个<strong>智慧化护理实践教学案例库平台</strong>，以真实临床案例为核心，结合大语言模型（AI）进行自动评分与反馈，帮助护理人员快速提升临床思维与实操能力。</p>' +
                '<h6 class="mt-3">两种角色</h6>' +
                '<ul>' +
                    '<li><strong>护士端</strong>：案例学习 → 提交作答 → AI 即时反馈评分 → 查看薄弱点分析 → 错题重做 → 参加考试</li>' +
                    '<li><strong>管理员端</strong>：管理用户、案例、考试，导入批量案例/用户，查看学习统计与群体分析，配置 AI 与语音设置</li>' +
                '</ul>' +
                '<h6 class="mt-3">核心工作流</h6>' +
                '<ol>' +
                    '<li>管理员上传案例（docx 批量导入或手动创建）</li>' +
                    '<li>护士进入案例学习，阅读案例背景后作答</li>' +
                    '<li>AI 自动评估答案，给出得分、覆盖要点分析与改进建议</li>' +
                    '<li>护士查看薄弱点分析，针对性重做错题</li>' +
                    '<li>管理员创建考试，发布后护士参加，管理员可批阅调整分数</li>' +
                '</ol>' +
            '</div>' +
        '</div>' +

        // 二、Docx 案例格式规范
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-file-word me-2"></i>二、批量导入 — Docx 格式规范</div>' +
            '<div class="card-body">' +
                '<div class="alert alert-warning small mb-3"><i class="fas fa-exclamation-triangle me-1"></i>格式错误是最常见的导入失败原因，请仔细阅读以下规则。</div>' +
                '<h6>文件命名规则</h6>' +
                '<p>文件名格式：<code>【类别名称】案例标题.docx</code></p>' +
                '<ul>' +
                    '<li><code>【类别名称】</code>：案例所属学科类别，如<code>【内科护理学】</code>、<code>【外科护理学】</code></li>' +
                    '<li>类别名称必须使用中文全角方括号 <code>【】</code></li>' +
                    '<li>案例标题紧随类别名称之后</li>' +
                    '<li>示例：<code>【内科护理学】糖尿病酮症酸中毒护理案例.docx</code></li>' +
                '</ul>' +

                '<h6 class="mt-4">文档内容标签体系</h6>' +
                '<p>正文使用特定标签标记不同内容区域，每个标签必须<strong>独占一个段落</strong>，且<strong>成对出现</strong>（开始标签 + 结尾标签）：</p>' +
                '<div class="table-responsive"><table class="table table-sm table-bordered small">' +
                    '<thead><tr><th>开始标签</th><th>结尾标签</th><th>说明</th><th>必需</th></tr></thead>' +
                    '<tbody>' +
                        '<tr><td><code>【案例指引】</code></td><td><code>【案例指引结尾】</code></td><td>案例背景/引导信息，如患者基本情况、病史等</td><td>是</td></tr>' +
                        '<tr><td><code>【站点】</code></td><td><code>【站点结尾】</code></td><td>一个考核站点（一个案例可包含多个站点）</td><td>是（至少1个）</td></tr>' +
                        '<tr><td><code>【考核任务】</code></td><td><code>【考核任务结尾】</code></td><td>站点内的考核任务描述（位于【站点】内部）</td><td>否</td></tr>' +
                        '<tr><td><code>【问题】</code></td><td><code>【问题结尾】</code></td><td>站点问题（第一个【问题】为主问题，后续为知识拓展）</td><td>是（每个站点至少1个）</td></tr>' +
                        '<tr><td><code>【回答】</code></td><td><code>【回答结尾】</code></td><td>标准答案段落</td><td>是（每个【问题】配一个）</td></tr>' +
                        '<tr><td><code>【项】</code></td><td><code>【项结尾】</code></td><td>标准答案中的评分要点（位于【回答】内部）</td><td>是</td></tr>' +
                        '<tr><td><code>【知识拓展】</code></td><td><code>【知识拓展结尾】</code></td><td>案例级别的知识拓展内容</td><td>否</td></tr>' +
                    '</tbody>' +
                '</table></div>' +

                '<h6 class="mt-4">Docx 模板示例</h6>' +
                '<pre class="bg-dark text-light p-3 small rounded"><code>【案例指引】' + "\n" +
'患者，男性，58岁，因"多饮、多尿、体重下降2周"入院。既往有高血压病史5年。' + "\n" +
'查体：T 36.5°C，P 96次/分，R 20次/分，BP 150/90mmHg。' + "\n" +
'实验室检查：空腹血糖 16.8mmol/L，尿酮体(+++)，pH 7.28。' + "\n" +
'【案例指引结尾】' + "\n" +
'' + "\n" +
'【站点】' + "\n" +
'【考核任务】' + "\n" +
'请对该患者进行护理评估，并制定护理计划。' + "\n" +
'【考核任务结尾】' + "\n" +
'【问题】' + "\n" +
'根据患者临床表现和实验室检查结果，该患者最可能的诊断是什么？请列出护理诊断的优先顺序。' + "\n" +
'【问题结尾】' + "\n" +
'【回答】' + "\n" +
'【项】最可能的诊断为糖尿病酮症酸中毒（DKA）【项结尾】' + "\n" +
'【项】护理诊断优先顺序：①体液不足 ②营养失调 ③知识缺乏 ④潜在并发症：感染【项结尾】' + "\n" +
'【项】需立即建立静脉通路补液【项结尾】' + "\n" +
'【回答结尾】' + "\n" +
'【站点结尾】</code></pre>' +

                '<h6 class="mt-4">常见错误</h6>' +
                '<ul class="small">' +
                    '<li><strong>标签未独占段落</strong>：标签前后不能有其他文字</li>' +
                    '<li><strong>标签不配对</strong>：每个开始标签必须有对应的结尾标签</li>' +
                    '<li><strong>站点内没有【问题】</strong>：每个站点至少需要一个问题</li>' +
                    '<li><strong>【回答】内没有【项】</strong>：标准答案必须包含评分要点</li>' +
                    '<li><strong>文件名类别使用半角方括号</strong>：必须使用全角<code>【】</code>而非<code>[]</code></li>' +
                '</ul>' +
            '</div>' +
        '</div>' +

        // 三、批量导入操作流程
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-upload me-2"></i>三、批量导入 — 操作流程</div>' +
            '<div class="card-body">' +
                '<h6>步骤</h6>' +
                '<ol>' +
                    '<li>进入<strong>案例管理</strong> → 点击"批量导入"按钮</li>' +
                    '<li>准备好按上述格式命名的 docx 文件，放入同一个文件夹</li>' +
                    '<li>将文件夹打包为 <strong>zip 压缩包</strong>（不支持直接上传文件夹）</li>' +
                    '<li>选择 zip 文件上传，系统将自动解析并导入</li>' +
                    '<li>导入完成后，系统会显示导入结果摘要（成功/失败数量）</li>' +
                '</ol>' +
                '<div class="alert alert-info small mb-0">' +
                    '<i class="fas fa-lightbulb me-1"></i><strong>提示</strong>：' +
                    '导入过程中，系统会根据文件名中的<code>【类别名称】</code>自动创建或匹配案例类别。' +
                    '如果类别不存在，系统会自动创建。导入失败的文件不会影响已成功的文件。' +
                '</div>' +
            '</div>' +
        '</div>' +

        // 四、Excel 用户导入
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-file-excel me-2"></i>四、Excel 批量导入用户</div>' +
            '<div class="card-body">' +
                '<h6>Excel 列格式</h6>' +
                '<div class="table-responsive"><table class="table table-sm table-bordered small">' +
                    '<thead><tr><th>列</th><th>字段</th><th>说明</th><th>必需</th></tr></thead>' +
                    '<tbody>' +
                        '<tr><td>A</td><td>工号（用户名）</td><td>护士唯一标识，用于登录</td><td>是</td></tr>' +
                        '<tr><td>B</td><td>密码</td><td>初始登录密码</td><td>是</td></tr>' +
                        '<tr><td>C</td><td>姓名</td><td>护士真实姓名</td><td>是</td></tr>' +
                        '<tr><td>D</td><td>状态</td><td>active=正常，留空默认 active</td><td>否</td></tr>' +
                    '</tbody>' +
                '</table></div>' +
                '<h6>操作步骤</h6>' +
                '<ol>' +
                    '<li>进入<strong>用户管理</strong> → 点击"导入用户"按钮</li>' +
                    '<li>下载模板或在 Excel 中按上述格式填写用户数据</li>' +
                    '<li>上传 .xlsx 文件</li>' +
                    '<li>系统会预览导入结果，显示生成的工号和初始密码</li>' +
                '</ol>' +
                '<div class="alert alert-warning small mb-0">' +
                    '<i class="fas fa-shield-alt me-1"></i><strong>安全提示</strong>：' +
                    '建议护士首次登录后修改密码。导入的用户默认角色为 nurse，只能访问护士端。' +
                '</div>' +
            '</div>' +
        '</div>' +

        // 五、考试管理
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-file-alt me-2"></i>五、考试管理</div>' +
            '<div class="card-body">' +
                '<h6>考试系统架构（v3.0）</h6>' +
                '<ul>' +
                    '<li><strong>按案例出题</strong>：每个案例 = 一道考题，包含该案例的所有站点题目，保持案例完整性</li>' +
                    '<li><strong>AI 自动评分</strong>：护士提交后，AI 对每道题进行评分并给出反馈</li>' +
                    '<li><strong>管理员批阅</strong>：可查看所有考生的答卷，逐题调整分数</li>' +
                '</ul>' +
                '<h6 class="mt-3">操作流程</h6>' +
                '<ol>' +
                    '<li>进入<strong>考试管理</strong> → 创建考试（设置标题、描述、时间、时长）</li>' +
                    '<li>在考试详情中，添加案例题目（选择案例即可，系统自动关联该案例所有站点）</li>' +
                    '<li>确认题目无误后，点击"发布"使考试对护士可见</li>' +
                    '<li>护士参加考试并提交后，AI 自动评分</li>' +
                    '<li>管理员进入"批阅"页面查看答卷，可手动调整分数</li>' +
                '</ol>' +
                '<div class="alert alert-info small mb-0">' +
                    '<i class="fas fa-lightbulb me-1"></i><strong>设计理念</strong>：' +
                    '考试以案例为最小单位，保留完整的案例背景 + 站点问题，更贴近真实临床场景，' +
                    '避免将案例拆散为孤立知识点导致脱离情境。' +
                '</div>' +
            '</div>' +
        '</div>' +

        // 六、AI 设置
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-robot me-2"></i>六、AI 设置</div>' +
            '<div class="card-body">' +
                '<h6>支持的 AI 提供商</h6>' +
                '<ul>' +
                    '<li><strong>本地模型（Ollama）</strong>：推荐的私有化部署方案，数据不出服务器。需在服务器上安装 Ollama 并下载模型（如 qwen2.5）</li>' +
                    '<li><strong>DeepSeek</strong>：国产大模型，性价比高，适合中文护理场景</li>' +
                    '<li><strong>OpenAI</strong>：兼容 OpenAI API 格式的服务（包括兼容代理）</li>' +
                '</ul>' +
                '<h6 class="mt-3">评分参数</h6>' +
                '<ul>' +
                    '<li><strong>Temperature</strong>：控制 AI 输出的随机性（0-2），建议评分场景设为 0.1-0.3，确保评分一致性</li>' +
                    '<li><strong>Max Tokens</strong>：单次输出最大长度</li>' +
                '</ul>' +
                '<h6 class="mt-3">为什么使用本地 AI？</h6>' +
                '<p class="small text-muted">护理案例可能包含敏感患者数据。使用本地部署的 Ollama 模型可确保所有数据在服务器内部处理，不传输至第三方，满足医疗数据隐私合规要求。</p>' +
            '</div>' +
        '</div>' +

        // 七、语音设置
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-microphone me-2"></i>七、语音设置</div>' +
            '<div class="card-body">' +
                '<p>系统支持语音输入（语音转文字），护士可在作答时使用语音录入替代键盘输入。</p>' +
                '<h6>支持的语音引擎</h6>' +
                '<ul>' +
                    '<li><strong>百度 ASR</strong>：百度语音识别服务，中文识别效果好</li>' +
                    '<li><strong>浏览器内置 Speech-to-Text</strong>：无需额外配置，使用浏览器原生 API</li>' +
                '</ul>' +
                '<h6>百度 ASR 配置</h6>' +
                '<ul class="small">' +
                    '<li><strong>API Key</strong>：从百度 AI 开放平台获取</li>' +
                    '<li><strong>Secret Key</strong>：与 API Key 配对使用</li>' +
                    '<li><strong>App ID</strong>：百度 AI 应用的唯一标识</li>' +
                '</ul>' +
            '</div>' +
        '</div>' +

        // 八、设计哲学与架构
        '<div class="card mb-3">' +
            '<div class="card-header"><i class="fas fa-cogs me-2"></i>八、设计哲学与架构</div>' +
            '<div class="card-body">' +
                '<div class="row g-3">' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-lock me-1"></i>1. 数据安全优先</h6>' +
                            '<p class="small mb-0">支持完全私有化部署（Docker），AI 评分使用本地模型（Ollama），患者数据不出医院内网。所有 API 使用 JWT + 密码双重认证。</p>' +
                        '</div></div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-puzzle-piece me-1"></i>2. 案例不可分割</h6>' +
                            '<p class="small mb-0">一个案例代表一个完整的临床情境，包含背景、多个站点/问题。考试和学习都以案例为最小单位，保留临床思维的整体性。</p>' +
                        '</div></div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-rotate me-1"></i>3. 学习闭环</h6>' +
                            '<p class="small mb-0">学习 → 评估 → 反馈 → 错题集 → 薄弱点分析 → 重做 → 再评估。形成完整的学习闭环，确保护士真正掌握知识点。</p>' +
                        '</div></div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-robot me-1"></i>4. AI 增强而非替代</h6>' +
                            '<p class="small mb-0">AI 提供即时评分和反馈，降低教师工作量；但最终分数可由管理员人工复核调整，AI 是辅助工具而非最终裁判。</p>' +
                        '</div></div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-graduation-cap me-1"></i>5. 个性化学习路径</h6>' +
                            '<p class="small mb-0">系统根据每位护士的作答记录分析薄弱知识点，生成个性化学习建议，实现差异化教学。</p>' +
                        '</div></div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<div class="card bg-light h-100"><div class="card-body">' +
                            '<h6><i class="fas fa-database me-1"></i>6. 脱离平台依赖</h6>' +
                            '<p class="small mb-0">所有案例内容以 docx 文件为源格式，可在平台之外独立使用。导入/导出格式标准化，避免数据锁定在特定系统中。</p>' +
                        '</div></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +

    '</div>';
}
