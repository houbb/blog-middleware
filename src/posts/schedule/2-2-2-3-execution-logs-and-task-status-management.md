---
title: 3.3 执行日志与任务状态管理
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，执行日志和任务状态管理是确保系统可监控、可追溯、可维护的重要组成部分。通过详细的执行日志，运维人员可以了解任务的执行情况、排查问题、分析性能；通过精确的任务状态管理，系统可以确保任务按预期执行、避免重复执行、及时发现异常。本文将深入探讨如何设计和实现高效的执行日志记录系统和任务状态管理机制。

## 执行日志的重要性

执行日志是任务调度系统的"黑匣子"，记录了任务从触发到完成的全过程信息。完善的日志系统对于系统的运维和问题排查至关重要。

### 日志信息的价值

```java
// 执行日志的价值分析
public class ExecutionLogValue {
    
    /*
     * 执行日志的核心价值：
     * 1. 问题排查 - 快速定位任务执行失败的原因
     * 2. 性能分析 - 分析任务执行时间和资源消耗
     * 3. 审计追踪 - 追踪任务执行历史和变更记录
     * 4. 统计分析 - 收集任务执行数据用于业务分析
     * 5. 告警监控 - 基于日志内容触发告警
     * 6. 合规要求 - 满足行业监管和审计要求
     */
    
    // 日志信息分类
    public void logCategories() {
        System.out.println("执行日志信息分类:");
        System.out.println("1. 基本信息 - 任务ID、名称、执行时间等");
        System.out.println("2. 执行详情 - 执行参数、执行结果、耗时等");
        System.out.println("3. 异常信息 - 错误码、异常堆栈、错误描述等");
        System.out.println("4. 环境信息 - 执行节点、JVM信息、系统资源等");
        System.out.println("5. 业务信息 - 业务指标、处理数据量等");
    }
}
```

### 日志级别设计

```java
// 执行日志级别
public enum ExecutionLogLevel {
    TRACE(100, "跟踪"),    // 最详细的信息，用于调试
    DEBUG(200, "调试"),    // 调试信息，用于开发和问题排查
    INFO(300, "信息"),     // 一般信息，记录任务执行的关键节点
    WARN(400, "警告"),     // 警告信息，可能影响任务执行但不会导致失败
    ERROR(500, "错误"),    // 错误信息，任务执行失败
    FATAL(600, "致命");    // 致命错误，系统级问题
    
    private final int level;
    private final String description;
    
    ExecutionLogLevel(int level, String description) {
        this.level = level;
        this.description = description;
    }
    
    // Getters
    public int getLevel() { return level; }
    public String getDescription() { return description; }
    
    // 比较级别
    public boolean isGreaterOrEqual(ExecutionLogLevel other) {
        return this.level >= other.level;
    }
}

// 执行日志实体类
public class TaskExecutionLog {
    private Long logId;                 // 日志ID
    private String taskId;              // 任务ID
    private String taskName;            // 任务名称
    private String taskClass;           // 任务类名
    private Date executeTime;           // 执行时间
    private long executionTime;         // 执行耗时(毫秒)
    private boolean success;            // 是否成功
    private ExecutionLogLevel logLevel; // 日志级别
    private String message;             // 日志消息
    private String errorMessage;        // 错误信息
    private String stackTrace;          // 异常堆栈
    private String resultData;          // 执行结果数据
    private String executorNode;        // 执行节点
    private String threadName;          // 线程名称
    private Map<String, Object> context; // 上下文信息
    private Map<String, Object> metrics; // 性能指标
    
    // 构造函数
    public TaskExecutionLog() {
        this.executeTime = new Date();
        this.context = new HashMap<>();
        this.metrics = new HashMap<>();
    }
    
    // Getters and Setters
    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }
    
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public String getTaskClass() { return taskClass; }
    public void setTaskClass(String taskClass) { this.taskClass = taskClass; }
    
    public Date getExecuteTime() { return executeTime; }
    public void setExecuteTime(Date executeTime) { this.executeTime = executeTime; }
    
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public ExecutionLogLevel getLogLevel() { return logLevel; }
    public void setLogLevel(ExecutionLogLevel logLevel) { this.logLevel = logLevel; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public String getStackTrace() { return stackTrace; }
    public void setStackTrace(String stackTrace) { this.stackTrace = stackTrace; }
    
    public String getResultData() { return resultData; }
    public void setResultData(String resultData) { this.resultData = resultData; }
    
    public String getExecutorNode() { return executorNode; }
    public void setExecutorNode(String executorNode) { this.executorNode = executorNode; }
    
    public String getThreadName() { return threadName; }
    public void setThreadName(String threadName) { this.threadName = threadName; }
    
    public Map<String, Object> getContext() { return context; }
    public void setContext(Map<String, Object> context) { this.context = context; }
    
    public Map<String, Object> getMetrics() { return metrics; }
    public void setMetrics(Map<String, Object> metrics) { this.metrics = metrics; }
    
    // 添加上下文信息
    public void addContext(String key, Object value) {
        this.context.put(key, value);
    }
    
    // 添加性能指标
    public void addMetric(String key, Object value) {
        this.metrics.put(key, value);
    }
    
    // 设置异常信息
    public void setException(Exception e) {
        this.errorMessage = e.getMessage();
        this.stackTrace = ExceptionUtils.getStackTrace(e);
    }
}
```

## 日志存储与查询

高效的日志存储和查询机制是日志系统的核心。我们需要考虑存储性能、查询效率、存储成本等多个方面。

### 日志存储设计

```java
// 日志存储接口
public interface TaskLogStore {
    /**
     * 保存执行日志
     * @param log 日志信息
     * @return 是否保存成功
     */
    boolean saveLog(TaskExecutionLog log);
    
    /**
     * 批量保存执行日志
     * @param logs 日志列表
     * @return 保存成功的日志数量
     */
    int saveLogs(List<TaskExecutionLog> logs);
    
    /**
     * 根据任务ID查询日志
     * @param taskId 任务ID
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getLogsByTaskId(String taskId, int limit);
    
    /**
     * 根据时间范围查询日志
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getLogsByTimeRange(Date startTime, Date endTime, int limit);
    
    /**
     * 查询失败的日志
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getFailedLogs(int limit);
    
    /**
     * 根据日志级别查询日志
     * @param level 日志级别
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getLogsByLevel(ExecutionLogLevel level, int limit);
    
    /**
     * 统计日志信息
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 统计信息
     */
    LogStatistics getLogStatistics(Date startTime, Date endTime);
}

// 日志统计信息
class LogStatistics {
    private long totalLogs;          // 总日志数
    private long successLogs;        // 成功日志数
    private long failedLogs;         // 失败日志数
    private Map<ExecutionLogLevel, Long> levelDistribution; // 级别分布
    private Map<String, Long> taskDistribution; // 任务分布
    private double averageExecutionTime; // 平均执行时间
    private long maxExecutionTime;       // 最大执行时间
    private Date statisticsTime;         // 统计时间
    
    public LogStatistics() {
        this.levelDistribution = new HashMap<>();
        this.taskDistribution = new HashMap<>();
        this.statisticsTime = new Date();
    }
    
    // Getters and Setters
    public long getTotalLogs() { return totalLogs; }
    public void setTotalLogs(long totalLogs) { this.totalLogs = totalLogs; }
    
    public long getSuccessLogs() { return successLogs; }
    public void setSuccessLogs(long successLogs) { this.successLogs = successLogs; }
    
    public long getFailedLogs() { return failedLogs; }
    public void setFailedLogs(long failedLogs) { this.failedLogs = failedLogs; }
    
    public Map<ExecutionLogLevel, Long> getLevelDistribution() { return levelDistribution; }
    public void setLevelDistribution(Map<ExecutionLogLevel, Long> levelDistribution) { this.levelDistribution = levelDistribution; }
    
    public Map<String, Long> getTaskDistribution() { return taskDistribution; }
    public void setTaskDistribution(Map<String, Long> taskDistribution) { this.taskDistribution = taskDistribution; }
    
    public double getAverageExecutionTime() { return averageExecutionTime; }
    public void setAverageExecutionTime(double averageExecutionTime) { this.averageExecutionTime = averageExecutionTime; }
    
    public long getMaxExecutionTime() { return maxExecutionTime; }
    public void setMaxExecutionTime(long maxExecutionTime) { this.maxExecutionTime = maxExecutionTime; }
    
    public Date getStatisticsTime() { return statisticsTime; }
    public void setStatisticsTime(Date statisticsTime) { this.statisticsTime = statisticsTime; }
}
```

### 数据库日志存储实现

```java
// 基于数据库的日志存储实现
public class DatabaseTaskLogStore implements TaskLogStore {
    private final DataSource dataSource;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public DatabaseTaskLogStore(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public boolean saveLog(TaskExecutionLog log) {
        String sql = "INSERT INTO task_execution_logs (" +
            "task_id, task_name, task_class, execute_time, execution_time, success, " +
            "log_level, message, error_message, stack_trace, result_data, " +
            "executor_node, thread_name, context_data, metrics_data) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, log.getTaskId());
            stmt.setString(2, log.getTaskName());
            stmt.setString(3, log.getTaskClass());
            stmt.setTimestamp(4, new Timestamp(log.getExecuteTime().getTime()));
            stmt.setLong(5, log.getExecutionTime());
            stmt.setBoolean(6, log.isSuccess());
            stmt.setString(7, log.getLogLevel() != null ? log.getLogLevel().name() : null);
            stmt.setString(8, log.getMessage());
            stmt.setString(9, log.getErrorMessage());
            stmt.setString(10, log.getStackTrace());
            stmt.setString(11, log.getResultData());
            stmt.setString(12, log.getExecutorNode());
            stmt.setString(13, log.getThreadName());
            stmt.setString(14, serializeToJson(log.getContext()));
            stmt.setString(15, serializeToJson(log.getMetrics()));
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("保存执行日志失败", e);
        }
    }
    
    @Override
    public int saveLogs(List<TaskExecutionLog> logs) {
        String sql = "INSERT INTO task_execution_logs (" +
            "task_id, task_name, task_class, execute_time, execution_time, success, " +
            "log_level, message, error_message, stack_trace, result_data, " +
            "executor_node, thread_name, context_data, metrics_data) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        int savedCount = 0;
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            for (TaskExecutionLog log : logs) {
                stmt.setString(1, log.getTaskId());
                stmt.setString(2, log.getTaskName());
                stmt.setString(3, log.getTaskClass());
                stmt.setTimestamp(4, new Timestamp(log.getExecuteTime().getTime()));
                stmt.setLong(5, log.getExecutionTime());
                stmt.setBoolean(6, log.isSuccess());
                stmt.setString(7, log.getLogLevel() != null ? log.getLogLevel().name() : null);
                stmt.setString(8, log.getMessage());
                stmt.setString(9, log.getErrorMessage());
                stmt.setString(10, log.getStackTrace());
                stmt.setString(11, log.getResultData());
                stmt.setString(12, log.getExecutorNode());
                stmt.setString(13, log.getThreadName());
                stmt.setString(14, serializeToJson(log.getContext()));
                stmt.setString(15, serializeToJson(log.getMetrics()));
                
                stmt.addBatch();
            }
            
            int[] results = stmt.executeBatch();
            for (int result : results) {
                if (result > 0) {
                    savedCount++;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("批量保存执行日志失败", e);
        }
        
        return savedCount;
    }
    
    @Override
    public List<TaskExecutionLog> getLogsByTaskId(String taskId, int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE task_id = ? ORDER BY execute_time DESC LIMIT ?";
        
        return executeQuery(sql, stmt -> {
            stmt.setString(1, taskId);
            stmt.setInt(2, limit);
        });
    }
    
    @Override
    public List<TaskExecutionLog> getLogsByTimeRange(Date startTime, Date endTime, int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE execute_time BETWEEN ? AND ? ORDER BY execute_time DESC LIMIT ?";
        
        return executeQuery(sql, stmt -> {
            stmt.setTimestamp(1, new Timestamp(startTime.getTime()));
            stmt.setTimestamp(2, new Timestamp(endTime.getTime()));
            stmt.setInt(3, limit);
        });
    }
    
    @Override
    public List<TaskExecutionLog> getFailedLogs(int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE success = FALSE ORDER BY execute_time DESC LIMIT ?";
        
        return executeQuery(sql, stmt -> stmt.setInt(1, limit));
    }
    
    @Override
    public List<TaskExecutionLog> getLogsByLevel(ExecutionLogLevel level, int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE log_level = ? ORDER BY execute_time DESC LIMIT ?";
        
        return executeQuery(sql, stmt -> {
            stmt.setString(1, level.name());
            stmt.setInt(2, limit);
        });
    }
    
    @Override
    public LogStatistics getLogStatistics(Date startTime, Date endTime) {
        String sql = "SELECT " +
            "COUNT(*) as total_logs, " +
            "SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as success_logs, " +
            "SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_logs, " +
            "AVG(execution_time) as avg_execution_time, " +
            "MAX(execution_time) as max_execution_time " +
            "FROM task_execution_logs " +
            "WHERE execute_time BETWEEN ? AND ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setTimestamp(1, new Timestamp(startTime.getTime()));
            stmt.setTimestamp(2, new Timestamp(endTime.getTime()));
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    LogStatistics statistics = new LogStatistics();
                    statistics.setTotalLogs(rs.getLong("total_logs"));
                    statistics.setSuccessLogs(rs.getLong("success_logs"));
                    statistics.setFailedLogs(rs.getLong("failed_logs"));
                    statistics.setAverageExecutionTime(rs.getDouble("avg_execution_time"));
                    statistics.setMaxExecutionTime(rs.getLong("max_execution_time"));
                    return statistics;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("获取日志统计信息失败", e);
        }
        
        return new LogStatistics();
    }
    
    // 执行查询
    private List<TaskExecutionLog> executeQuery(String sql, StatementConfigurer configurer) {
        List<TaskExecutionLog> logs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            configurer.configure(stmt);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    logs.add(mapResultSetToLog(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询执行日志失败", e);
        }
        
        return logs;
    }
    
    // 配置语句的函数式接口
    @FunctionalInterface
    private interface StatementConfigurer {
        void configure(PreparedStatement stmt) throws SQLException;
    }
    
    // 将ResultSet映射为日志对象
    private TaskExecutionLog mapResultSetToLog(ResultSet rs) throws SQLException {
        TaskExecutionLog log = new TaskExecutionLog();
        log.setLogId(rs.getLong("log_id"));
        log.setTaskId(rs.getString("task_id"));
        log.setTaskName(rs.getString("task_name"));
        log.setTaskClass(rs.getString("task_class"));
        log.setExecuteTime(rs.getTimestamp("execute_time"));
        log.setExecutionTime(rs.getLong("execution_time"));
        log.setSuccess(rs.getBoolean("success"));
        log.setLogLevel(rs.getString("log_level") != null ? 
            ExecutionLogLevel.valueOf(rs.getString("log_level")) : null);
        log.setMessage(rs.getString("message"));
        log.setErrorMessage(rs.getString("error_message"));
        log.setStackTrace(rs.getString("stack_trace"));
        log.setResultData(rs.getString("result_data"));
        log.setExecutorNode(rs.getString("executor_node"));
        log.setThreadName(rs.getString("thread_name"));
        log.setContext(deserializeFromJson(rs.getString("context_data"), Map.class));
        log.setMetrics(deserializeFromJson(rs.getString("metrics_data"), Map.class));
        return log;
    }
    
    // 序列化为JSON
    private String serializeToJson(Object obj) {
        if (obj == null) {
            return null;
        }
        
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("序列化对象失败", e);
        }
    }
    
    // 从JSON反序列化
    private <T> T deserializeFromJson(String json, Class<T> clazz) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            throw new RuntimeException("反序列化对象失败", e);
        }
    }
}

// 日志表结构
/*
CREATE TABLE task_execution_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    task_id VARCHAR(64) NOT NULL COMMENT '任务ID',
    task_name VARCHAR(255) NOT NULL COMMENT '任务名称',
    task_class VARCHAR(255) COMMENT '任务类名',
    execute_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
    execution_time BIGINT NOT NULL COMMENT '执行耗时(毫秒)',
    success BOOLEAN NOT NULL COMMENT '是否成功',
    log_level VARCHAR(32) COMMENT '日志级别',
    message TEXT COMMENT '日志消息',
    error_message TEXT COMMENT '错误信息',
    stack_trace TEXT COMMENT '异常堆栈',
    result_data TEXT COMMENT '执行结果数据',
    executor_node VARCHAR(128) COMMENT '执行节点',
    thread_name VARCHAR(128) COMMENT '线程名称',
    context_data TEXT COMMENT '上下文信息',
    metrics_data TEXT COMMENT '性能指标',
    INDEX idx_task_id (task_id),
    INDEX idx_execute_time (execute_time),
    INDEX idx_success (success),
    INDEX idx_log_level (log_level),
    INDEX idx_executor_node (executor_node)
) COMMENT='任务执行日志表';
*/
```

## 任务状态管理

任务状态管理是确保任务正确执行的关键机制。通过精确的状态跟踪，系统可以避免任务重复执行、及时发现异常、实现故障恢复等功能。

### 任务状态设计

```java
// 任务状态枚举
public enum TaskStatus {
    PENDING("待执行"),      // 任务已创建，等待执行
    SCHEDULED("已调度"),    // 任务已调度，等待触发
    RUNNING("执行中"),      // 任务正在执行
    SUCCESS("执行成功"),    // 任务执行成功
    FAILED("执行失败"),     // 任务执行失败
    PAUSED("已暂停"),       // 任务已暂停
    CANCELLED("已取消"),    // 任务已取消
    RETRYING("重试中"),     // 任务正在重试
    BLOCKED("已阻塞");      // 任务被阻塞
    
    private final String description;
    
    TaskStatus(String description) {
        this.description = description;
    }
    
    // Getters
    public String getDescription() { return description; }
}

// 任务状态变更记录
public class TaskStatusChangeLog {
    private Long logId;             // 日志ID
    private String taskId;          // 任务ID
    private TaskStatus fromStatus;  // 原状态
    private TaskStatus toStatus;    // 新状态
    private String changeReason;    // 变更原因
    private Date changeTime;        // 变更时间
    private String operator;        // 操作人
    
    // 构造函数
    public TaskStatusChangeLog() {
        this.changeTime = new Date();
    }
    
    // Getters and Setters
    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }
    
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public TaskStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(TaskStatus fromStatus) { this.fromStatus = fromStatus; }
    
    public TaskStatus getToStatus() { return toStatus; }
    public void setToStatus(TaskStatus toStatus) { this.toStatus = toStatus; }
    
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    
    public Date getChangeTime() { return changeTime; }
    public void setChangeTime(Date changeTime) { this.changeTime = changeTime; }
    
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
```

### 状态管理服务

```java
// 任务状态管理服务
public class TaskStatusManager {
    private final TaskStore taskStore;
    private final TaskLogStore logStore;
    private final AlertService alertService;
    private final ScheduledExecutorService statusChecker;
    
    public TaskStatusManager(TaskStore taskStore, TaskLogStore logStore, AlertService alertService) {
        this.taskStore = taskStore;
        this.logStore = logStore;
        this.alertService = alertService;
        this.statusChecker = Executors.newScheduledThreadPool(1);
    }
    
    // 启动状态检查
    public void start() {
        statusChecker.scheduleAtFixedRate(this::checkTaskStatus, 30, 30, TimeUnit.SECONDS);
        System.out.println("任务状态管理器已启动");
    }
    
    // 停止状态检查
    public void stop() {
        statusChecker.shutdown();
        try {
            if (!statusChecker.awaitTermination(5, TimeUnit.SECONDS)) {
                statusChecker.shutdownNow();
            }
        } catch (InterruptedException e) {
            statusChecker.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("任务状态管理器已停止");
    }
    
    // 更新任务状态
    public boolean updateTaskStatus(String taskId, TaskStatus newStatus, String reason) {
        return updateTaskStatus(taskId, newStatus, reason, "system");
    }
    
    // 更新任务状态(指定操作人)
    public boolean updateTaskStatus(String taskId, TaskStatus newStatus, String reason, String operator) {
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null) {
            return false;
        }
        
        TaskStatus oldStatus = task.getStatus();
        
        // 检查状态转换是否合法
        if (!isValidStatusTransition(oldStatus, newStatus)) {
            System.err.println("非法的状态转换: " + oldStatus + " -> " + newStatus);
            return false;
        }
        
        // 更新任务状态
        task.setStatus(newStatus);
        task.setUpdateTime(new Date());
        taskStore.saveTask(task);
        
        // 记录状态变更日志
        TaskStatusChangeLog changeLog = new TaskStatusChangeLog();
        changeLog.setTaskId(taskId);
        changeLog.setFromStatus(oldStatus);
        changeLog.setToStatus(newStatus);
        changeLog.setChangeReason(reason);
        changeLog.setOperator(operator);
        saveStatusChangeLog(changeLog);
        
        // 触发状态变更事件
        onTaskStatusChanged(task, oldStatus, newStatus);
        
        System.out.println("任务状态更新: " + taskId + " " + oldStatus + " -> " + newStatus);
        return true;
    }
    
    // 检查状态转换是否合法
    private boolean isValidStatusTransition(TaskStatus from, TaskStatus to) {
        // 定义合法的状态转换
        switch (from) {
            case PENDING:
                return to == TaskStatus.SCHEDULED || to == TaskStatus.RUNNING || 
                       to == TaskStatus.PAUSED || to == TaskStatus.CANCELLED;
            case SCHEDULED:
                return to == TaskStatus.RUNNING || to == TaskStatus.PAUSED || 
                       to == TaskStatus.CANCELLED;
            case RUNNING:
                return to == TaskStatus.SUCCESS || to == TaskStatus.FAILED || 
                       to == TaskStatus.RETRYING;
            case SUCCESS:
                return to == TaskStatus.PENDING || to == TaskStatus.SCHEDULED;
            case FAILED:
                return to == TaskStatus.PENDING || to == TaskStatus.RETRYING || 
                       to == TaskStatus.CANCELLED;
            case PAUSED:
                return to == TaskStatus.PENDING || to == TaskStatus.SCHEDULED;
            case CANCELLED:
                return false; // 取消状态不能转换到其他状态
            case RETRYING:
                return to == TaskStatus.RUNNING || to == TaskStatus.SUCCESS || 
                       to == TaskStatus.FAILED;
            case BLOCKED:
                return to == TaskStatus.PENDING || to == TaskStatus.SCHEDULED;
            default:
                return false;
        }
    }
    
    // 触发状态变更事件
    private void onTaskStatusChanged(ScheduledTask task, TaskStatus oldStatus, TaskStatus newStatus) {
        // 根据新状态触发相应操作
        switch (newStatus) {
            case FAILED:
                handleTaskFailed(task);
                break;
            case SUCCESS:
                handleTaskSuccess(task);
                break;
            case RUNNING:
                handleTaskRunning(task);
                break;
        }
    }
    
    // 处理任务失败
    private void handleTaskFailed(ScheduledTask task) {
        // 增加失败计数
        task.setFailCount(task.getFailCount() + 1);
        taskStore.saveTask(task);
        
        // 发送告警
        if (task.getFailCount() >= 3) { // 连续失败3次
            alertService.sendAlert(AlertLevel.ERROR, "TASK_FAILED", 
                "任务连续失败: " + task.getTaskName() + ", 失败次数: " + task.getFailCount());
        }
        
        // 检查是否需要重试
        if (shouldRetry(task)) {
            scheduleRetry(task);
        }
    }
    
    // 处理任务成功
    private void handleTaskSuccess(ScheduledTask task) {
        // 重置失败计数
        task.setFailCount(0);
        task.setLastErrorMessage(null);
        taskStore.saveTask(task);
        
        // 发送成功通知(可选)
        System.out.println("任务执行成功: " + task.getTaskName());
    }
    
    // 处理任务运行中
    private void handleTaskRunning(ScheduledTask task) {
        // 记录开始执行时间
        task.setLastExecuteTime(new Date());
        taskStore.saveTask(task);
    }
    
    // 检查是否需要重试
    private boolean shouldRetry(ScheduledTask task) {
        // 检查是否配置了重试
        Object maxRetriesObj = task.getParameters().get("maxRetries");
        int maxRetries = maxRetriesObj instanceof Number ? 
            ((Number) maxRetriesObj).intValue() : 0;
        
        return task.getFailCount() < maxRetries;
    }
    
    // 调度重试
    private void scheduleRetry(ScheduledTask task) {
        // 计算重试延迟时间
        Object retryDelayObj = task.getParameters().get("retryDelay");
        long retryDelay = retryDelayObj instanceof Number ? 
            ((Number) retryDelayObj).longValue() : 60000; // 默认1分钟
        
        // 更新状态为重试中
        updateTaskStatus(task.getTaskId(), TaskStatus.RETRYING, "自动重试");
        
        // 延迟执行重试
        ScheduledExecutorService retryExecutor = Executors.newScheduledThreadPool(1);
        retryExecutor.schedule(() -> {
            try {
                // 更新状态为待执行
                updateTaskStatus(task.getTaskId(), TaskStatus.PENDING, "重试调度");
            } finally {
                retryExecutor.shutdown();
            }
        }, retryDelay, TimeUnit.MILLISECONDS);
    }
    
    // 检查任务状态
    private void checkTaskStatus() {
        try {
            // 检查长时间运行的任务
            checkLongRunningTasks();
            
            // 检查阻塞的任务
            checkBlockedTasks();
        } catch (Exception e) {
            System.err.println("检查任务状态时出错: " + e.getMessage());
        }
    }
    
    // 检查长时间运行的任务
    private void checkLongRunningTasks() {
        Date oneHourAgo = new Date(System.currentTimeMillis() - 3600000); // 1小时前
        List<ScheduledTask> longRunningTasks = taskStore.getTasksByStatusAndTime(
            TaskStatus.RUNNING, oneHourAgo);
        
        for (ScheduledTask task : longRunningTasks) {
            alertService.sendAlert(AlertLevel.WARNING, "LONG_RUNNING_TASK", 
                "任务长时间运行: " + task.getTaskName() + ", 运行时间超过1小时");
        }
    }
    
    // 检查阻塞的任务
    private void checkBlockedTasks() {
        // 实现阻塞任务检查逻辑
        // 例如：检查任务依赖、资源占用等情况
    }
    
    // 保存状态变更日志
    private void saveStatusChangeLog(TaskStatusChangeLog changeLog) {
        // 这里可以保存到专门的状态变更日志表中
        System.out.println("状态变更: " + changeLog.getTaskId() + " " + 
                          changeLog.getFromStatus() + " -> " + changeLog.getToStatus());
    }
}
```

## 日志收集与分析

为了更好地利用执行日志，我们需要实现日志收集和分析功能，为系统优化和问题排查提供数据支持。

```java
// 日志分析服务
public class LogAnalysisService {
    private final TaskLogStore logStore;
    private final ScheduledExecutorService analysisScheduler;
    
    public LogAnalysisService(TaskLogStore logStore) {
        this.logStore = logStore;
        this.analysisScheduler = Executors.newScheduledThreadPool(1);
    }
    
    // 启动日志分析
    public void start() {
        // 定期生成日志分析报告
        analysisScheduler.scheduleAtFixedRate(this::generateAnalysisReport, 
            300, 3600, TimeUnit.SECONDS); // 5分钟后开始，每小时执行一次
        System.out.println("日志分析服务已启动");
    }
    
    // 停止日志分析
    public void stop() {
        analysisScheduler.shutdown();
        try {
            if (!analysisScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                analysisScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            analysisScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("日志分析服务已停止");
    }
    
    // 生成分析报告
    private void generateAnalysisReport() {
        try {
            Date endTime = new Date();
            Date startTime = new Date(endTime.getTime() - 86400000); // 24小时前
            
            LogStatistics statistics = logStore.getLogStatistics(startTime, endTime);
            
            System.out.println("=== 任务执行日志分析报告 ===");
            System.out.println("统计时间: " + startTime + " 至 " + endTime);
            System.out.println("总执行次数: " + statistics.getTotalLogs());
            System.out.println("成功次数: " + statistics.getSuccessLogs());
            System.out.println("失败次数: " + statistics.getFailedLogs());
            System.out.println("成功率: " + String.format("%.2f%%", 
                statistics.getTotalLogs() > 0 ? 
                (double) statistics.getSuccessLogs() / statistics.getTotalLogs() * 100 : 0));
            System.out.println("平均执行时间: " + String.format("%.2fms", 
                statistics.getAverageExecutionTime()));
            System.out.println("最大执行时间: " + statistics.getMaxExecutionTime() + "ms");
            
            // 分析失败任务
            analyzeFailedTasks();
            
            // 分析性能瓶颈
            analyzePerformanceBottlenecks();
        } catch (Exception e) {
            System.err.println("生成分析报告时出错: " + e.getMessage());
        }
    }
    
    // 分析失败任务
    private void analyzeFailedTasks() {
        List<TaskExecutionLog> failedLogs = logStore.getFailedLogs(100);
        
        if (failedLogs.isEmpty()) {
            System.out.println("最近没有失败的任务");
            return;
        }
        
        System.out.println("=== 失败任务分析 ===");
        
        // 按任务统计失败次数
        Map<String, Long> failureCountByTask = failedLogs.stream()
            .collect(Collectors.groupingBy(TaskExecutionLog::getTaskName, Collectors.counting()));
        
        // 输出失败次数最多的任务
        failureCountByTask.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(10)
            .forEach(entry -> 
                System.out.println("任务: " + entry.getKey() + ", 失败次数: " + entry.getValue()));
        
        // 输出最近的失败详情
        System.out.println("最近的失败详情:");
        failedLogs.stream()
            .limit(5)
            .forEach(log -> {
                System.out.println("  任务: " + log.getTaskName());
                System.out.println("  时间: " + log.getExecuteTime());
                System.out.println("  错误: " + log.getErrorMessage());
                if (log.getStackTrace() != null && !log.getStackTrace().isEmpty()) {
                    System.out.println("  堆栈: " + log.getStackTrace().split("\n")[0]);
                }
                System.out.println();
            });
    }
    
    // 分析性能瓶颈
    private void analyzePerformanceBottlenecks() {
        Date endTime = new Date();
        Date startTime = new Date(endTime.getTime() - 3600000); // 1小时前
        
        List<TaskExecutionLog> recentLogs = logStore.getLogsByTimeRange(startTime, endTime, 1000);
        
        if (recentLogs.isEmpty()) {
            return;
        }
        
        System.out.println("=== 性能分析 ===");
        
        // 计算平均执行时间
        Map<String, Double> avgExecutionTimeByTask = recentLogs.stream()
            .collect(Collectors.groupingBy(
                TaskExecutionLog::getTaskName,
                Collectors.averagingLong(TaskExecutionLog::getExecutionTime)));
        
        // 输出执行时间最长的任务
        avgExecutionTimeByTask.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(10)
            .forEach(entry -> 
                System.out.println("任务: " + entry.getKey() + 
                    ", 平均执行时间: " + String.format("%.2fms", entry.getValue())));
    }
    
    // 获取任务执行趋势
    public List<DailyExecutionTrend> getExecutionTrend(int days) {
        List<DailyExecutionTrend> trends = new ArrayList<>();
        Date now = new Date();
        
        for (int i = days - 1; i >= 0; i--) {
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(now);
            calendar.add(Calendar.DAY_OF_MONTH, -i);
            calendar.set(Calendar.HOUR_OF_DAY, 0);
            calendar.set(Calendar.MINUTE, 0);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            
            Date startTime = calendar.getTime();
            calendar.add(Calendar.DAY_OF_MONTH, 1);
            Date endTime = calendar.getTime();
            
            LogStatistics statistics = logStore.getLogStatistics(startTime, endTime);
            
            DailyExecutionTrend trend = new DailyExecutionTrend();
            trend.setDate(startTime);
            trend.setTotalExecutions(statistics.getTotalLogs());
            trend.setSuccessExecutions(statistics.getSuccessLogs());
            trend.setFailedExecutions(statistics.getFailedLogs());
            trend.setAverageExecutionTime(statistics.getAverageExecutionTime());
            
            trends.add(trend);
        }
        
        return trends;
    }
}

// 每日执行趋势
class DailyExecutionTrend {
    private Date date;
    private long totalExecutions;
    private long successExecutions;
    private long failedExecutions;
    private double averageExecutionTime;
    
    // Getters and Setters
    public Date getDate() { return date; }
    public void setDate(Date date) { this.date = date; }
    
    public long getTotalExecutions() { return totalExecutions; }
    public void setTotalExecutions(long totalExecutions) { this.totalExecutions = totalExecutions; }
    
    public long getSuccessExecutions() { return successExecutions; }
    public void setSuccessExecutions(long successExecutions) { this.successExecutions = successExecutions; }
    
    public long getFailedExecutions() { return failedExecutions; }
    public void setFailedExecutions(long failedExecutions) { this.failedExecutions = failedExecutions; }
    
    public double getAverageExecutionTime() { return averageExecutionTime; }
    public void setAverageExecutionTime(double averageExecutionTime) { this.averageExecutionTime = averageExecutionTime; }
    
    // 计算成功率
    public double getSuccessRate() {
        return totalExecutions > 0 ? (double) successExecutions / totalExecutions * 100 : 0;
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用执行日志和任务状态管理功能：

```java
// 执行日志与状态管理使用示例
public class ExecutionLogAndStatusExample {
    public static void main(String[] args) {
        try {
            // 配置数据源
            DataSourceConfig config = new DataSourceConfig(
                "jdbc:mysql://localhost:3306/scheduler?useSSL=false&serverTimezone=UTC",
                "scheduler_user",
                "scheduler_password"
            );
            DataSource dataSource = config.createDataSource();
            
            // 创建日志存储
            TaskLogStore logStore = new DatabaseTaskLogStore(dataSource);
            
            // 创建任务存储
            TaskStore taskStore = new DatabaseTaskStore(/* DAOs */);
            
            // 创建告警服务
            AlertService alertService = new AlertService();
            
            // 创建状态管理器
            TaskStatusManager statusManager = new TaskStatusManager(taskStore, logStore, alertService);
            statusManager.start();
            
            // 创建日志分析服务
            LogAnalysisService analysisService = new LogAnalysisService(logStore);
            analysisService.start();
            
            // 模拟任务执行
            simulateTaskExecution(taskStore, logStore, statusManager);
            
            // 运行一段时间
            Thread.sleep(300000); // 5分钟
            
            // 停止服务
            statusManager.stop();
            analysisService.stop();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 模拟任务执行
    private static void simulateTaskExecution(TaskStore taskStore, TaskLogStore logStore, 
                                            TaskStatusManager statusManager) {
        ScheduledExecutorService executor = Executors.newScheduledThreadPool(3);
        
        // 模拟多个任务执行
        for (int i = 0; i < 5; i++) {
            final int taskId = i;
            executor.schedule(() -> {
                try {
                    // 创建任务
                    ScheduledTask task = new ScheduledTask();
                    task.setTaskName("测试任务-" + taskId);
                    task.setTaskClass("com.example.TestTask");
                    task.setTaskType(TaskType.FIXED_RATE);
                    taskStore.saveTask(task);
                    
                    // 更新状态为运行中
                    statusManager.updateTaskStatus(task.getTaskId(), TaskStatus.RUNNING, "开始执行");
                    
                    // 模拟任务执行
                    boolean success = Math.random() > 0.3; // 70%成功率
                    long executionTime = (long) (Math.random() * 5000) + 1000; // 1-6秒
                    
                    Thread.sleep(executionTime);
                    
                    // 记录执行日志
                    TaskExecutionLog log = new TaskExecutionLog();
                    log.setTaskId(task.getTaskId());
                    log.setTaskName(task.getTaskName());
                    log.setTaskClass(task.getTaskClass());
                    log.setExecuteTime(new Date());
                    log.setExecutionTime(executionTime);
                    log.setSuccess(success);
                    log.setLogLevel(success ? ExecutionLogLevel.INFO : ExecutionLogLevel.ERROR);
                    log.setMessage(success ? "任务执行成功" : "任务执行失败");
                    log.setExecutorNode("node-001");
                    log.setThreadName(Thread.currentThread().getName());
                    
                    if (!success) {
                        log.setErrorMessage("模拟执行失败");
                        log.setStackTrace("模拟堆栈信息");
                    }
                    
                    logStore.saveLog(log);
                    
                    // 更新任务状态
                    statusManager.updateTaskStatus(task.getTaskId(), 
                        success ? TaskStatus.SUCCESS : TaskStatus.FAILED, 
                        success ? "执行成功" : "执行失败");
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    System.err.println("任务执行异常: " + e.getMessage());
                }
            }, i * 10, TimeUnit.SECONDS);
        }
        
        // 关闭执行器
        executor.shutdown();
    }
}

// 告警服务实现
class AlertService {
    public void sendAlert(AlertLevel level, String type, String message) {
        System.out.println("[" + level + "] " + type + ": " + message);
        // 实际应用中可以发送邮件、短信、微信等告警
    }
}
```

## 总结

通过本文的实现，我们构建了一个完善的执行日志和任务状态管理系统，具有以下特点：

1. **详细日志记录**：记录任务执行的完整信息，包括基本信息、执行详情、异常信息等
2. **多级日志存储**：支持多种存储方式，满足不同性能和成本要求
3. **精确状态管理**：通过状态机确保状态转换的合法性，支持自动重试等高级功能
4. **实时监控告警**：及时发现任务异常并发送告警
5. **数据分析能力**：提供日志分析和趋势统计功能，为系统优化提供数据支持

这个系统为分布式任务调度提供了强有力的监控和管理能力，确保了任务执行的可追溯性和系统的可维护性。

在下一节中，我们将探讨任务分片与负载均衡技术，进一步提升分布式调度系统的性能和扩展性。