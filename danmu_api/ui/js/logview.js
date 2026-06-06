// language=JavaScript
export const logviewJsContent = /* javascript */ `
/* ========================================
   日志状态
   ======================================== */
let currentLogFilter = 'all';
let autoRefreshInterval = null;
let isAutoRefreshing = false;
let logSearchKeyword = '';
let isLogAutoScrollEnabled = true;
let isLogWrapEnabled = true;

let currentLogCategoryFilter = 'all';

/* ========================================
   日志业务分类（上游日志分类系统的 fork 适配版）
   ======================================== */
const LOG_CATEGORY_GROUPS = [
    ['system', 'ai'],
    ['utils', 'cache', 'merge'],
    ['360kan', 'aiyifan', 'animeko', 'bahamut', 'bilibili', 'custom', 'dandan', 'douban', 'ezdmw', 'hanjutv', 'iqiyi', 'leshi', 'maiduidui', 'mango', 'migu', 'other', 'renren', 'sohu', 'tencent', 'tmdb', 'vod', 'xigua', 'youku'],
    ['forward']
];
const LOG_CATEGORY_ORDER = {};
LOG_CATEGORY_GROUPS.forEach((group, groupIndex) => {
    group.forEach((tag, tagIndex) => {
        LOG_CATEGORY_ORDER[tag] = groupIndex * 1000 + tagIndex;
    });
});

function normalizeLogCategoryTag(tag) {
    let category = String(tag || '').trim().toLowerCase();
    const normalizationMap = {
        '360': '360kan',
        'imgo': 'mango',
        'qq': 'tencent',
        'qiyi': 'iqiyi',
        'vod fastest mode': 'vod',
        'custom source': 'custom',
        'bilibili-proxy': 'bilibili',
        'tmdb-source': 'tmdb',
        'path check': 'system',
        'path fix': 'system',
        'base': 'system',
        'server': 'system',
        'security': 'system',
        'reqrecords': 'system',
        'logvar-api': 'system',
        'fongmi': 'system',
        'http': 'utils',
        'rate limit': 'utils',
        'ip blacklist': 'utils',
        'localredis': 'cache',
        'redis': 'cache'
    };
    return normalizationMap[category] || category;
}

function isIgnorableLogTag(tag) {
    const value = String(tag || '').trim();
    return /^\\d{4}-\\d{2}-\\d{2}[T ]/.test(value) ||
        /^\\d{2}:\\d{2}(:\\d{2})?$/.test(value) ||
        value.includes('08:00') ||
        value === '请求模拟' ||
        value === '网络请求' ||
        value === '流式请求';
}

function getLogCategory(message) {
    const text = String(message ?? '');
    const prefixMatch = text.match(/^(?:\\s*\\[[^\\]]+\\])+/);
    if (!prefixMatch) return '_inherit_';

    const tagMatches = prefixMatch[0].match(/\\[([^\\]]+)\\]/g) || [];
    const tags = tagMatches.map(tag => tag.replace(/[\\[\\]]/g, '').trim()).filter(Boolean);
    if (tags.length === 0) return '_inherit_';

    if (tags.some(tag => {
        const lower = tag.toLowerCase();
        return lower === 'merge' || ['匹配', '落单', '补全', '合集', '略过', 'merge-check'].some(keyword => lower.includes(String(keyword).toLowerCase()));
    })) {
        return 'merge';
    }

    const validTags = tags.filter(tag => !isIgnorableLogTag(tag));
    if (validTags.length === 0) return '_inherit_';

    return normalizeLogCategoryTag(validTags[0]);
}

function getLogsWithCategories(logItems = logs) {
    let lastCategory = 'system';
    return logItems.map(log => {
        let category = getLogCategory(log.message);
        if (category === '_inherit_') {
            category = lastCategory;
        } else {
            lastCategory = category;
        }
        return { ...log, category };
    });
}

function getLogCategoriesFromLogs(logItems = logs) {
    const categories = new Set();
    getLogsWithCategories(logItems).forEach(log => {
        if (log.category) categories.add(log.category);
    });
    return [...categories].sort((a, b) => {
        const orderA = LOG_CATEGORY_ORDER[a] ?? 99999;
        const orderB = LOG_CATEGORY_ORDER[b] ?? 99999;
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
    });
}

function getLogCategoryText(category) {
    const labels = {
        all: '全部分类',
        system: '系统',
        ai: 'AI',
        utils: '工具',
        cache: '缓存',
        merge: '合并',
        forward: '插件'
    };
    return labels[category] || category;
}

function setLogCategoryFilter(category) {
    currentLogCategoryFilter = category || 'all';
    if (typeof document !== 'undefined') {
        document.querySelectorAll('.log-category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === currentLogCategoryFilter);
        });
        renderLogs();
    }
}

function ensureLogCategoryFilterEvents(container) {
    if (!container || container.dataset.boundCategoryEvents === 'true') return;
    container.dataset.boundCategoryEvents = 'true';
    container.addEventListener('click', event => {
        const btn = event.target.closest('.log-category-btn');
        if (!btn || !container.contains(btn)) return;
        setLogCategoryFilter(btn.dataset.category || 'all');
    });
}

function updateLogCategoryFilters() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('log-category-filters');
    if (!container) return;

    const categories = getLogCategoriesFromLogs();
    if (currentLogCategoryFilter !== 'all' && !categories.includes(currentLogCategoryFilter)) {
        currentLogCategoryFilter = 'all';
    }
    const counts = getLogsWithCategories().reduce((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
    }, {});

    let html = '<button class="log-category-btn ' + (currentLogCategoryFilter === 'all' ? 'active' : '') + '" data-category="all" type="button">' +
        '<span class="category-text">全部分类</span>' +
        '<span class="category-badge">' + logs.length + '</span>' +
        '</button>';

    categories.forEach(category => {
        html += '<button class="log-category-btn ' + (currentLogCategoryFilter === category ? 'active' : '') + '" data-category="' + escapeLogAttr(category) + '" type="button">' +
            '<span class="category-text">' + escapeLogText(getLogCategoryText(category)) + '</span>' +
            '<span class="category-badge">' + (counts[category] || 0) + '</span>' +
            '</button>';
    });

    container.innerHTML = html;
    ensureLogCategoryFilterEvents(container);
}

function highlightLogTags(html) {
    return html.replace(/(\\[[^\\]\\n]+\\])/g, '<span class="log-tag">$1</span>');
}

function formatLogMessageHtml(message, keyword) {
    const highlighted = highlightLogMatch(formatLogMessageForDisplay(message), keyword);
    return highlightLogTags(highlighted);
}

/* ========================================
   统一时间格式化（支持完整时间戳/简短时间）
   ======================================== */
function formatLogTime(value) {
    if (!value) {
        return new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    const text = String(value).trim();

    // 已是 HH:MM[:SS] 格式
    if (/^\\d{2}:\\d{2}(:\\d{2})?$/.test(text)) {
        return text.length === 5 ? text + ':00' : text;
    }

    // ISO 或可解析时间，统一为本地 HH:MM:SS
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    return text;
}

/* ========================================
   统一日志级别
   ======================================== */
function normalizeLogType(type) {
    const value = String(type || 'info').toLowerCase();
    if (value === 'warning') return 'warn';
    if (value === 'debug') return 'info';
    if (value === 'log') return 'info';
    if (value === 'fatal') return 'error';
    return ['error', 'warn', 'info', 'success'].includes(value) ? value : 'info';
}

/* ========================================
   转义日志内容（纯文本输出）
   ======================================== */
function escapeLogText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeLogAttr(text) {
    return escapeLogText(text)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ========================================
   日志搜索命中高亮
   ======================================== */
function highlightLogMatch(text, keyword) {
    const safeText = escapeLogText(text);
    if (!keyword) return safeText;

    const escapedKeyword = keyword.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const reg = new RegExp(escapedKeyword, 'gi');

    return safeText.replace(reg, match => '<mark class="log-highlight">' + match + '</mark>');
}

/* ========================================
   解析日志文本行
   ======================================== */
function parseLogLine(line) {
    const rawLine = String(line || '').trimEnd();
    const match = rawLine.match(/^\\[([^\\]]+)\\]\\s+([a-zA-Z]+):\\s*([\\s\\S]*)$/);

    if (match) {
        const parsedType = normalizeLogType(match[2]);
        return {
            timestamp: formatLogTime(match[1]),
            rawTimestamp: match[1],
            type: parsedType,
            message: match[3] ?? '',
            raw: rawLine
        };
    }

    return {
        timestamp: formatLogTime(''),
        rawTimestamp: '',
        type: 'info',
        message: rawLine,
        raw: rawLine
    };
}

/* ========================================
   获取过滤后的日志
   ======================================== */
function getFilteredLogs() {
    const keyword = logSearchKeyword.trim().toLowerCase();

    return getLogsWithCategories().filter(log => {
        const typeMatched = currentLogFilter === 'all' || log.type === currentLogFilter;
        if (!typeMatched) return false;

        const categoryMatched = currentLogCategoryFilter === 'all' || log.category === currentLogCategoryFilter;
        if (!categoryMatched) return false;

        if (!keyword) return true;

        const haystack = [log.timestamp, getLogTypeText(log.type), log.category, log.message].join(' ').toLowerCase();
        return haystack.includes(keyword);
    });
}

/* ========================================
   添加日志
   ======================================== */
function addLog(message, type = 'info') {
    logs.push({
        timestamp: formatLogTime(''),
        type: normalizeLogType(type),
        message: String(message ?? '')
    });

    if (logs.length > 500) {
        logs.shift();
    }

    renderLogs();
    updateLogFilterBadges();
}

/* ========================================
   标准化日志换行
   ======================================== */
function normalizeLogLineBreaks(message) {
    return String(message ?? '').replace(/\\r\\n?/g, '\\n');
}

/* ========================================
   日志文本展示（原样输出）
   ======================================== */
function formatLogMessageForDisplay(message) {
    return normalizeLogLineBreaks(message);
}

/* ========================================
   日志文本导出（原样输出）
   ======================================== */
function formatLogMessageForPlainText(message) {
    return normalizeLogLineBreaks(message);
}

/* ========================================
   渲染日志（终端文本流）
   ======================================== */
function renderLogs() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('log-container');
    if (!container) return;

    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        container.innerHTML = \`
            <div class="log-empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-width="2"/>
                </svg>
                <p class="empty-text">\${currentLogFilter === 'all' && currentLogCategoryFilter === 'all' ? '暂无日志' : '暂无符合筛选条件的日志'}</p>
            </div>
        \`;
        updateLogToolbarStatus(filteredLogs.length, logs.length);
        return;
    }

    const keyword = logSearchKeyword.trim();
    container.innerHTML = filteredLogs.map(log => {
        const level = normalizeLogType(log.type);
        const levelLabel = getLogTypeText(level).toUpperCase();
        const displayMessage = formatLogMessageHtml(log.message, keyword);

        return '<div class="log-line log-line-' + level + '" data-category="' + escapeLogAttr(log.category || 'system') + '">' +
            '<span class="log-line-time">[' + escapeLogText(log.timestamp) + ']</span>' +
            '<span class="log-line-level">' + escapeLogText(levelLabel) + '</span>' +
            '<span class="log-line-text">' + displayMessage + '</span>' +
            '</div>';
    }).join('');

    updateLogToolbarStatus(filteredLogs.length, logs.length);

    if (isLogAutoScrollEnabled) {
        container.scrollTop = container.scrollHeight;
    }
}

/* ========================================
   获取日志类型文本
   ======================================== */
function getLogTypeText(type) {
    const texts = {
        error: '错误',
        warn: '警告',
        info: '信息',
        success: '成功'
    };
    return texts[type] || '信息';
}

/* ========================================
   设置日志过滤器
   ======================================== */
function setLogFilter(filter) {
    currentLogFilter = filter;

    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderLogs();
    updateLogFilterBadges();
}

/* ========================================
   更新过滤器徽章数量
   ======================================== */
function updateLogFilterBadges() {
    const counts = {
        all: logs.length,
        error: logs.filter(l => l.type === 'error').length,
        warn: logs.filter(l => l.type === 'warn').length
    };

    Object.keys(counts).forEach(type => {
        const btn = document.querySelector(\`.log-filter-btn[data-filter="\${type}"]\`);
        if (!btn) return;
        const badge = btn.querySelector('.filter-badge');
        if (!badge) return;

        badge.textContent = counts[type];
        badge.style.display = counts[type] > 0 ? 'inline-flex' : 'none';
    });

    updateLogToolbarStatus(getFilteredLogs().length, logs.length);
    updateLogCategoryFilters();
}

/* ========================================
   更新日志工具栏统计
   ======================================== */
function updateLogToolbarStatus(visible, total) {
    const status = document.getElementById('log-toolbar-status');
    if (!status) return;
    status.textContent = \`显示 \${visible} / \${total} 条\`;
}

/* ========================================
   设置日志搜索关键字
   ======================================== */
function setLogSearch(value) {
    logSearchKeyword = String(value || '').trim();

    const clearBtn = document.getElementById('log-search-clear');
    if (clearBtn) {
        clearBtn.style.display = logSearchKeyword ? 'inline-flex' : 'none';
    }

    renderLogs();
}

/* ========================================
   清空日志搜索
   ======================================== */
function clearLogSearch() {
    const input = document.getElementById('log-search-input');
    if (input) {
        input.value = '';
    }
    setLogSearch('');
}

/* ========================================
   切换自动滚动
   ======================================== */
function toggleLogAutoScroll() {
    isLogAutoScrollEnabled = !isLogAutoScrollEnabled;

    const btn = document.getElementById('log-autoscroll-toggle');
    if (btn) {
        btn.classList.toggle('active', isLogAutoScrollEnabled);
        btn.textContent = isLogAutoScrollEnabled ? '自动滚动' : '手动滚动';
    }

    if (isLogAutoScrollEnabled) {
        const container = document.getElementById('log-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
}

/* ========================================
   切换自动换行
   ======================================== */
function toggleLogWrap() {
    isLogWrapEnabled = !isLogWrapEnabled;

    const btn = document.getElementById('log-wrap-toggle');
    const container = document.getElementById('log-container');

    if (btn) {
        btn.classList.toggle('active', isLogWrapEnabled);
        btn.textContent = isLogWrapEnabled ? '自动换行' : '不换行';
    }

    if (container) {
        container.classList.toggle('log-wrap-enabled', isLogWrapEnabled);
        container.classList.toggle('log-wrap-disabled', !isLogWrapEnabled);
    }
}

/* ========================================
   复制当前可见日志
   ======================================== */
async function copyVisibleLogs() {
    const filteredLogs = getFilteredLogs();
    if (filteredLogs.length === 0) {
        customAlert('没有可复制的日志');
        return;
    }

    const text = filteredLogs
        .map(log => \`[\${log.timestamp}] \${log.type.toUpperCase()}: \${formatLogMessageForPlainText(log.message)}\`)
        .join('\\n');

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        customAlert('已复制当前可见日志');
    } catch (error) {
        customAlert('复制失败：' + error.message);
    }
}

/* ========================================
   从API获取真实日志
   ======================================== */
async function fetchRealLogs() {
    if (typeof hasProtectedUiAccessToken === 'function' && !hasProtectedUiAccessToken()) {
        return;
    }

    try {
        const response = await fetch(buildApiUrl('/api/logs'));
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        const logText = await response.text();
        const rawLines = logText.split('\\n');
        const mergedLines = [];

        rawLines.forEach(line => {
            if (!line) return;

            const isNewRecord = /^\\[[^\\]]+\\]\\s+[a-zA-Z]+:\\s*/.test(line);
            if (isNewRecord) {
                mergedLines.push(line);
                return;
            }

            if (mergedLines.length === 0) {
                if (line.trim()) {
                    mergedLines.push(line);
                }
                return;
            }

            mergedLines[mergedLines.length - 1] += '\\n' + line;
        });

        logs = mergedLines.map(line => {
            const parsed = parseLogLine(line);
            return {
                timestamp: parsed.timestamp,
                type: normalizeLogType(parsed.type),
                message: parsed.message
            };
        });

        renderLogs();
        updateLogFilterBadges();
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        addLog(\`获取日志失败: \${error.message}\`, 'error');
    }
}

/* ========================================
   刷新日志
   ======================================== */
function refreshLogs() {
    const btn = document.getElementById('refreshLogsBtn') || event?.target?.closest('.btn');
    if (!btn) {
        fetchRealLogs();
        return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner-small"></span> 刷新中...';
    btn.disabled = true;

    fetchRealLogs().finally(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    });
}

/* ========================================
   切换自动刷新
   ======================================== */
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');

    if (!btn) return;

    if (isAutoRefreshing) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }

        isAutoRefreshing = false;
        btn.textContent = '自动刷新';
        btn.classList.remove('active');
        return;
    }

    isAutoRefreshing = true;
    btn.textContent = '停止刷新';
    btn.classList.add('active');

    fetchRealLogs();
    autoRefreshInterval = setInterval(() => {
        fetchRealLogs();
    }, 3000);
}

/* ========================================
   导出日志
   ======================================== */
function exportLogs() {
    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        customAlert('没有可导出的日志');
        return;
    }

    const logText = filteredLogs
        .map(log => \`[\${log.timestamp}] \${getLogTypeText(log.type).toUpperCase()}: \${formatLogMessageForPlainText(log.message)}\`)
        .join('\\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`logs_\${currentLogFilter}_\${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    customAlert('日志已导出');
}

/* ========================================
   清空日志
   ======================================== */
async function clearLogs() {
    const configCheck = await checkDeployPlatformConfig();
    if (!configCheck.success) {
        customAlert(configCheck.message);
        return;
    }

    customConfirm('确定要清空所有日志吗?', '清空确认').then(async confirmed => {
        if (!confirmed) return;

        try {
            const response = await fetch(buildApiUrl('/api/logs/clear', true), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            const result = await response.json();
            if (result.success) {
                logs = [];
                renderLogs();
                updateLogFilterBadges();
                addLog('日志已清空', 'warn');
            } else {
                addLog(\`清空日志失败: \${result.message}\`, 'error');
            }
        } catch (error) {
            console.error('Failed to clear logs:', error);
            addLog(\`清空日志失败: \${error.message}\`, 'error');
        }
    });
}

/* ========================================
   兼容历史调用：该版本不再需要展开/收起
   ======================================== */
function toggleLogMessage() {}
`;
