---
title: 2.4 任务状态与生命周期管理
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，任务状态与生命周期管理是确保系统可靠性和可维护性的核心要素。通过精确跟踪任务的执行状态、管理任务的生命周期转换，调度系统能够提供更好的监控、故障恢复和资源管理能力。本文将深入探讨任务状态的定义、生命周期管理机制以及在实际应用中的最佳实践。

## 任务状态的定义与分类

任务状态是描述任务在特定时刻所处情况的标识，它反映了任务的执行进度和结果。合理的状态设计对于任务调度系统的稳定运行至关重要。

### 核心任务状态

```java
// 任务状态枚举
public enum TaskStatus {
    // 初始状态
    CREATED("已创建", "任务刚刚被创建，尚未进入调度流程"),
    
    // 待处理状态
    PENDING("待处理", "任务已提交，等待调度器处理"),
    
    // 调度状态
    SCHEDULED("已调度", "任务已被调度器分配，等待执行器执行"),
    
    // 执行状态
    RUNNING("执行中", "任务正在执行器上运行"),
    
    // 完成状态
    SUCCESS("执行成功", "任务成功完成"),
    FAILED("执行失败", "任务执行过程中发生错误"),
    
    // 特殊状态
    CANCELLED("已取消", "任务被手动或自动取消"),
    PAUSED("已暂停", "周期任务被暂停执行"),
    DISABLED("已禁用", "任务被禁用，不会被调度"),
    TIMEOUT("执行超时", "任务执行超时"),
    RETRYING("重试中", "任务执行失败，正在进行重试");
    
    private final String displayName;
    private final String description;
    
    TaskStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}

// 任务状态变更记录
public class TaskStatusChange {
    private String taskId;
    private TaskStatus fromStatus;
    private TaskStatus toStatus;
    private String reason;
    private long timestamp;
    private String operator;
    
    public TaskStatusChange(String taskId, TaskStatus fromStatus, TaskStatus toStatus, 
                           String reason, String operator) {
        this.taskId = taskId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.reason = reason;
        this.operator = operator;
        this.timestamp = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public TaskStatus getFromStatus() { return fromStatus; }
    public TaskStatus getToStatus() { return toStatus; }
    public String getReason() { return reason; }
    public long getTimestamp() { return timestamp; }
    public String getOperator() { return operator; }
}
```

### 状态转换规则

```java
// 任务状态管理器
public class TaskStatusManager {
    // 定义合法的状态转换
    private static final Map<TaskStatus, Set<TaskStatus>> VALID_TRANSITIONS = new HashMap<>();
    
    static {
        // CREATED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.CREATED, Set.of(
            TaskStatus.PENDING, TaskStatus.DISABLED, TaskStatus.CANCELLED
        ));
        
        // PENDING 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.PENDING, Set.of(
            TaskStatus.SCHEDULED, TaskStatus.CANCELLED, TaskStatus.DISABLED
        ));
        
        // SCHEDULED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.SCHEDULED, Set.of(
            TaskStatus.RUNNING, TaskStatus.CANCELLED, TaskStatus.FAILED
        ));
        
        // RUNNING 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.RUNNING, Set.of(
            TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.TIMEOUT, 
            TaskStatus.CANCELLED, TaskStatus.RETRYING
        ));
        
        // SUCCESS 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.SUCCESS, Set.of(
            TaskStatus.PENDING // 周期任务可以重新进入待处理状态
        ));
        
        // FAILED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.FAILED, Set.of(
            TaskStatus.RETRYING, TaskStatus.CANCELLED
        ));
        
        // CANCELLED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.CANCELLED, Set.of(
            TaskStatus.PENDING // 可以重新提交任务
        ));
        
        // PAUSED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.PAUSED, Set.of(
            TaskStatus.PENDING, TaskStatus.CANCELLED
        ));
        
        // DISABLED 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.DISABLED, Set.of(
            TaskStatus.PENDING, TaskStatus.CANCELLED
        ));
        
        // TIMEOUT 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.TIMEOUT, Set.of(
            TaskStatus.RETRYING, TaskStatus.FAILED, TaskStatus.CANCELLED
        ));
        
        // RETRYING 状态可以转换到的状态
        VALID_TRANSITIONS.put(TaskStatus.RETRYING, Set.of(
            TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELLED
        ));
    }
    
    // 验证状态转换是否合法
    public static boolean isValidTransition(TaskStatus from, TaskStatus to) {
        Set<TaskStatus> allowedTransitions = VALID_TRANSITIONS.get(from);
        return allowedTransitions != null && allowedTransitions.contains(to);
    }
    
    // 安全地更新任务状态
    public static boolean updateTaskStatus(Task task, TaskStatus newStatus, 
                                         String reason, String operator) {
        TaskStatus currentStatus = task.getStatus();
        
        // 验证状态转换是否合法
        if (!isValidTransition(currentStatus, newStatus)) {
            System.err.println("非法的状态转换: " + currentStatus + " -> " + newStatus);
            return false;
        }
        
        // 记录状态变更
        TaskStatusChange statusChange = new TaskStatusChange(
            task.getTaskId(), currentStatus, newStatus, reason, operator);
        
        // 更新任务状态
        task.setStatus(newStatus);
        task.setLastUpdateTime(System.currentTimeMillis());
        
        // 保存状态变更记录
        TaskStatusHistory.saveStatusChange(statusChange);
        
        // 发布状态变更事件
        TaskEvent event = new TaskEvent(TaskEventType.STATUS_CHANGED, task);
        event.setStatusChange(statusChange);
        EventPublisher.publish(event);
        
        System.out.println("任务状态已更新: " + task.getTaskId() + 
                         " [" + currentStatus + " -> " + newStatus + "]");
        
        return true;
    }
}

// 任务状态历史记录
public class TaskStatusHistory {
    private static final List<TaskStatusChange> statusChanges = new CopyOnWriteArrayList<>();
    
    // 保存状态变更记录
    public static void saveStatusChange(TaskStatusChange statusChange) {
        statusChanges.add(statusChange);
        
        // 持久化到数据库（这里简化处理）
        // 实际应用中应该保存到数据库或日志系统
        System.out.println("状态变更记录已保存: " + statusChange.getTaskId() + 
                         " [" + statusChange.getFromStatus() + " -> " + 
                         statusChange.getToStatus() + "]");
    }
    
    // 获取任务的所有状态变更历史
    public static List<TaskStatusChange> getStatusHistory(String taskId) {
        return statusChanges.stream()
            .filter(change -> change.getTaskId().equals(taskId))
            .sorted(Comparator.comparingLong(TaskStatusChange::getTimestamp))
            .collect(Collectors.toList());
    }
    
    // 获取任务的最新状态
    public static TaskStatus getLatestStatus(String taskId) {
        return statusChanges.stream()
            .filter(change -> change.getTaskId().equals(taskId))
            .max(Comparator.comparingLong(TaskStatusChange::getTimestamp))
            .map(TaskStatusChange::getToStatus)
            .orElse(null);
    }
}
```

## 任务生命周期管理

任务生命周期是指任务从创建到最终完成或终止的整个过程。良好的生命周期管理能够确保任务在各个阶段得到适当的处理。

### 任务生命周期阶段

```java
// 任务生命周期管理器
public class TaskLifecycleManager {
    
    // 任务创建阶段
    public static Task createTask(String taskId, String name, String handler) {
        Task task = new Task(taskId, name, handler);
        task.setStatus(TaskStatus.CREATED);
        task.setCreateTime(System.currentTimeMillis());
        task.setLastUpdateTime(task.getCreateTime());
        
        // 记录创建事件
        TaskEvent event = new TaskEvent(TaskEventType.TASK_CREATED, task);
        EventPublisher.publish(event);
        
        System.out.println("任务已创建: " + taskId);
        return task;
    }
    
    // 任务提交阶段
    public static boolean submitTask(Task task) {
        if (task.getStatus() != TaskStatus.CREATED && 
            task.getStatus() != TaskStatus.CANCELLED) {
            System.err.println("任务状态不正确，无法提交: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.PENDING, "任务提交", "system");
    }
    
    // 任务调度阶段
    public static boolean scheduleTask(Task task) {
        if (task.getStatus() != TaskStatus.PENDING) {
            System.err.println("任务状态不正确，无法调度: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.SCHEDULED, "任务调度", "scheduler");
    }
    
    // 任务执行阶段
    public static boolean startTaskExecution(Task task) {
        if (task.getStatus() != TaskStatus.SCHEDULED) {
            System.err.println("任务状态不正确，无法执行: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.RUNNING, "开始执行", "executor");
    }
    
    // 任务完成阶段
    public static boolean completeTask(Task task, boolean success, String message) {
        if (task.getStatus() != TaskStatus.RUNNING) {
            System.err.println("任务状态不正确，无法完成: " + task.getStatus());
            return false;
        }
        
        TaskStatus finalStatus = success ? TaskStatus.SUCCESS : TaskStatus.FAILED;
        String reason = success ? "执行成功" : "执行失败: " + message;
        
        return TaskStatusManager.updateTaskStatus(
            task, finalStatus, reason, "executor");
    }
    
    // 任务取消阶段
    public static boolean cancelTask(Task task, String reason) {
        // 允许在多个状态下取消任务
        if (task.getStatus() == TaskStatus.CANCELLED || 
            task.getStatus() == TaskStatus.SUCCESS) {
            System.err.println("任务已处于最终状态，无法取消: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.CANCELLED, reason, "user");
    }
    
    // 任务暂停阶段
    public static boolean pauseTask(Task task, String reason) {
        if (task.getStatus() != TaskStatus.PENDING && 
            task.getStatus() != TaskStatus.SCHEDULED) {
            System.err.println("任务状态不正确，无法暂停: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.PAUSED, reason, "user");
    }
    
    // 任务恢复阶段
    public static boolean resumeTask(Task task, String reason) {
        if (task.getStatus() != TaskStatus.PAUSED && 
            task.getStatus() != TaskStatus.CANCELLED) {
            System.err.println("任务状态不正确，无法恢复: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.PENDING, reason, "user");
    }
    
    // 任务重试阶段
    public static boolean retryTask(Task task, String reason) {
        // 允许在失败、超时、取消状态下重试
        if (task.getStatus() != TaskStatus.FAILED && 
            task.getStatus() != TaskStatus.TIMEOUT && 
            task.getStatus() != TaskStatus.CANCELLED) {
            System.err.println("任务状态不正确，无法重试: " + task.getStatus());
            return false;
        }
        
        return TaskStatusManager.updateTaskStatus(
            task, TaskStatus.RETRYING, reason, "system");
    }
}
```

### 生命周期监控与告警

```java
// 任务生命周期监控器
public class TaskLifecycleMonitor {
    private final ScheduledExecutorService monitorService;
    private final TaskStore taskStore;
    private final AlertService alertService;
    private final Map<String, TaskExecutionMetrics> taskMetrics = new ConcurrentHashMap<>();
    
    public TaskLifecycleMonitor(TaskStore taskStore, AlertService alertService) {
        this.taskStore = taskStore;
        this.alertService = alertService;
        this.monitorService = Executors.newScheduledThreadPool(2);
    }
    
    // 启动监控
    public void start() {
        // 定期检查任务状态
        monitorService.scheduleAtFixedRate(this::checkTaskStatus, 0, 30, TimeUnit.SECONDS);
        
        // 定期生成监控报告
        monitorService.scheduleAtFixedRate(this::generateMonitorReport, 0, 5, TimeUnit.MINUTES);
        
        System.out.println("任务生命周期监控器已启动");
    }
    
    // 停止监控
    public void stop() {
        monitorService.shutdown();
        try {
            if (!monitorService.awaitTermination(5, TimeUnit.SECONDS)) {
                monitorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            monitorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("任务生命周期监控器已停止");
    }
    
    // 检查任务状态
    private void checkTaskStatus() {
        try {
            long currentTime = System.currentTimeMillis();
            
            // 检查长时间运行的任务
            checkLongRunningTasks(currentTime);
            
            // 检查超时任务
            checkTimeoutTasks(currentTime);
            
            // 检查失败任务
            checkFailedTasks();
            
        } catch (Exception e) {
            System.err.println("检查任务状态时出错: " + e.getMessage());
        }
    }
    
    // 检查长时间运行的任务
    private void checkLongRunningTasks(long currentTime) {
        List<Task> runningTasks = taskStore.getTasksByStatus(TaskStatus.RUNNING);
        
        for (Task task : runningTasks) {
            long executionTime = currentTime - task.getLastUpdateTime();
            long threshold = getTaskTimeoutThreshold(task); // 获取任务超时阈值
            
            if (executionTime > threshold) {
                // 发送告警
                String alertMessage = String.format(
                    "任务执行时间过长: %s, 已执行 %d 毫秒, 阈值 %d 毫秒", 
                    task.getName(), executionTime, threshold);
                
                alertService.sendAlert(AlertLevel.WARNING, "TASK_LONG_RUNNING", alertMessage);
                
                // 记录指标
                recordTaskMetric(task, "long_running", executionTime);
            }
        }
    }
    
    // 检查超时任务
    private void checkTimeoutTasks(long currentTime) {
        List<Task> scheduledTasks = taskStore.getTasksByStatus(TaskStatus.SCHEDULED);
        
        for (Task task : scheduledTasks) {
            // 检查是否超过调度时间太久仍未执行
            long scheduledTime = task.getNextExecutionTime();
            if (scheduledTime > 0 && currentTime - scheduledTime > 300000) { // 5分钟
                String alertMessage = String.format(
                    "任务调度超时: %s, 调度时间 %s, 当前时间 %s", 
                    task.getName(), new Date(scheduledTime), new Date(currentTime));
                
                alertService.sendAlert(AlertLevel.ERROR, "TASK_SCHEDULE_TIMEOUT", alertMessage);
                
                // 更新任务状态为超时
                TaskLifecycleManager.updateTaskStatus(
                    task, TaskStatus.TIMEOUT, "调度超时", "monitor");
            }
        }
    }
    
    // 检查失败任务
    private void checkFailedTasks() {
        List<Task> failedTasks = taskStore.getTasksByStatus(TaskStatus.FAILED);
        
        for (Task task : failedTasks) {
            // 检查失败次数
            int failureCount = getTaskFailureCount(task);
            if (failureCount > 3) {
                String alertMessage = String.format(
                    "任务连续失败: %s, 失败次数 %d", task.getName(), failureCount);
                
                alertService.sendAlert(AlertLevel.CRITICAL, "TASK_CONSECUTIVE_FAILURE", alertMessage);
            }
        }
    }
    
    // 生成监控报告
    private void generateMonitorReport() {
        try {
            // 统计各状态任务数量
            Map<TaskStatus, Integer> statusCount = new HashMap<>();
            for (TaskStatus status : TaskStatus.values()) {
                int count = taskStore.countTasksByStatus(status);
                statusCount.put(status, count);
            }
            
            // 生成报告
            StringBuilder report = new StringBuilder();
            report.append("=== 任务状态监控报告 ===\n");
            report.append("生成时间: ").append(new Date()).append("\n\n");
            
            for (Map.Entry<TaskStatus, Integer> entry : statusCount.entrySet()) {
                report.append(String.format("%s: %d\n", 
                    entry.getKey().getDisplayName(), entry.getValue()));
            }
            
            report.append("\n=== 性能指标 ===\n");
            for (Map.Entry<String, TaskExecutionMetrics> entry : taskMetrics.entrySet()) {
                report.append(String.format("任务 %s: %s\n", 
                    entry.getKey(), entry.getValue().toString()));
            }
            
            System.out.println(report.toString());
            
            // 发送报告
            alertService.sendReport("TASK_MONITOR_REPORT", report.toString());
            
        } catch (Exception e) {
            System.err.println("生成监控报告时出错: " + e.getMessage());
        }
    }
    
    // 获取任务超时阈值
    private long getTaskTimeoutThreshold(Task task) {
        // 根据任务类型或配置获取超时阈值
        TimeoutConfig timeoutConfig = task.getTimeoutConfig();
        if (timeoutConfig != null && timeoutConfig.getExecutionTimeout() > 0) {
            return timeoutConfig.getExecutionTimeout();
        }
        return 3600000; // 默认1小时
    }
    
    // 获取任务失败次数
    private int getTaskFailureCount(Task task) {
        List<TaskStatusChange> history = TaskStatusHistory.getStatusHistory(task.getTaskId());
        return (int) history.stream()
            .filter(change -> change.getToStatus() == TaskStatus.FAILED)
            .count();
    }
    
    // 记录任务指标
    private void recordTaskMetric(Task task, String metricName, long value) {
        TaskExecutionMetrics metrics = taskMetrics.computeIfAbsent(
            task.getTaskId(), k -> new TaskExecutionMetrics(task.getTaskId()));
        
        switch (metricName) {
            case "long_running":
                metrics.setLongestExecutionTime(value);
                break;
            case "execution_time":
                metrics.addExecutionTime(value);
                break;
        }
    }
}

// 任务执行指标
class TaskExecutionMetrics {
    private String taskId;
    private long totalExecutions = 0;
    private long totalExecutionTime = 0;
    private long longestExecutionTime = 0;
    private long averageExecutionTime = 0;
    
    public TaskExecutionMetrics(String taskId) {
        this.taskId = taskId;
    }
    
    // 添加执行时间
    public void addExecutionTime(long executionTime) {
        totalExecutions++;
        totalExecutionTime += executionTime;
        if (executionTime > longestExecutionTime) {
            longestExecutionTime = executionTime;
        }
        averageExecutionTime = totalExecutionTime / totalExecutions;
    }
    
    // Getters
    public String getTaskId() { return taskId; }
    public long getTotalExecutions() { return totalExecutions; }
    public long getTotalExecutionTime() { return totalExecutionTime; }
    public long getLongestExecutionTime() { return longestExecutionTime; }
    public long getAverageExecutionTime() { return averageExecutionTime; }
    
    @Override
    public String toString() {
        return String.format("执行次数: %d, 总执行时间: %dms, 最长执行时间: %dms, 平均执行时间: %dms",
            totalExecutions, totalExecutionTime, longestExecutionTime, averageExecutionTime);
    }
}

// 告警服务
class AlertService {
    public enum AlertLevel {
        INFO, WARNING, ERROR, CRITICAL
    }
    
    // 发送告警
    public void sendAlert(AlertLevel level, String alertType, String message) {
        System.out.println(String.format("[%s] %s: %s", level, alertType, message));
        
        // 实际应用中可以发送邮件、短信、调用API等
        // 这里简化处理
    }
    
    // 发送报告
    public void sendReport(String reportType, String content) {
        System.out.println(String.format("发送报告 [%s]:\n%s", reportType, content));
        
        // 实际应用中可以保存到文件、发送邮件等
    }
}
```

## 任务状态持久化与恢复

在分布式环境中，任务状态的持久化和故障恢复是确保系统可靠性的关键。

### 状态持久化实现

```java
// 任务状态持久化管理器
public class TaskStatePersistenceManager {
    private final TaskStore taskStore;
    private final TaskStatusHistoryStore statusHistoryStore;
    private final ScheduledExecutorService persistenceService;
    
    public TaskStatePersistenceManager(TaskStore taskStore, 
                                     TaskStatusHistoryStore statusHistoryStore) {
        this.taskStore = taskStore;
        this.statusHistoryStore = statusHistoryStore;
        this.persistenceService = Executors.newScheduledThreadPool(2);
    }
    
    // 启动持久化服务
    public void start() {
        // 定期批量持久化任务状态
        persistenceService.scheduleAtFixedRate(
            this::batchPersistTaskStates, 0, 10, TimeUnit.SECONDS);
        
        // 定期批量持久化状态历史
        persistenceService.scheduleAtFixedRate(
            this::batchPersistStatusHistory, 0, 30, TimeUnit.SECONDS);
        
        System.out.println("任务状态持久化服务已启动");
    }
    
    // 停止持久化服务
    public void stop() {
        persistenceService.shutdown();
        try {
            if (!persistenceService.awaitTermination(5, TimeUnit.SECONDS)) {
                persistenceService.shutdownNow();
            }
        } catch (InterruptedException e) {
            persistenceService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("任务状态持久化服务已停止");
    }
    
    // 批量持久化任务状态
    private void batchPersistTaskStates() {
        try {
            // 获取需要持久化的任务状态变更
            List<Task> changedTasks = taskStore.getChangedTasks();
            
            if (!changedTasks.isEmpty()) {
                // 批量更新到数据库
                taskStore.batchUpdateTasks(changedTasks);
                
                System.out.println("批量持久化任务状态完成，共 " + changedTasks.size() + " 个任务");
            }
        } catch (Exception e) {
            System.err.println("批量持久化任务状态时出错: " + e.getMessage());
        }
    }
    
    // 批量持久化状态历史
    private void batchPersistStatusHistory() {
        try {
            // 获取需要持久化的状态历史记录
            List<TaskStatusChange> pendingChanges = statusHistoryStore.getPendingChanges();
            
            if (!pendingChanges.isEmpty()) {
                // 批量保存到数据库
                statusHistoryStore.batchSaveStatusChanges(pendingChanges);
                
                System.out.println("批量持久化状态历史完成，共 " + pendingChanges.size() + " 条记录");
            }
        } catch (Exception e) {
            System.err.println("批量持久化状态历史时出错: " + e.getMessage());
        }
    }
    
    // 故障恢复
    public void recoverFromFailure() {
        try {
            System.out.println("开始任务状态故障恢复...");
            
            // 恢复未完成的任务
            recoverIncompleteTasks();
            
            // 恢复状态历史记录
            recoverStatusHistory();
            
            // 清理异常状态
            cleanupAbnormalStates();
            
            System.out.println("任务状态故障恢复完成");
        } catch (Exception e) {
            System.err.println("任务状态故障恢复时出错: " + e.getMessage());
        }
    }
    
    // 恢复未完成的任务
    private void recoverIncompleteTasks() {
        // 获取所有未完成的任务
        List<TaskStatus> incompleteStatuses = Arrays.asList(
            TaskStatus.RUNNING, TaskStatus.SCHEDULED, TaskStatus.RETRYING);
        
        for (TaskStatus status : incompleteStatuses) {
            List<Task> tasks = taskStore.getTasksByStatus(status);
            for (Task task : tasks) {
                // 根据任务类型和状态进行恢复处理
                recoverTask(task);
            }
        }
    }
    
    // 恢复单个任务
    private void recoverTask(Task task) {
        System.out.println("恢复任务: " + task.getTaskId() + ", 状态: " + task.getStatus());
        
        switch (task.getStatus()) {
            case RUNNING:
                // 检查任务是否真的在运行
                if (!isTaskActuallyRunning(task)) {
                    // 任务实际未运行，更新状态为失败
                    TaskLifecycleManager.updateTaskStatus(
                        task, TaskStatus.FAILED, "节点故障导致任务中断", "recovery");
                }
                break;
                
            case SCHEDULED:
                // 重新调度任务
                rescheduleTask(task);
                break;
                
            case RETRYING:
                // 继续重试流程
                continueRetryProcess(task);
                break;
        }
    }
    
    // 检查任务是否真的在运行
    private boolean isTaskActuallyRunning(Task task) {
        // 实际应用中可以通过心跳机制、执行器状态等方式检查
        // 这里简化处理
        return System.currentTimeMillis() - task.getLastUpdateTime() < 300000; // 5分钟内有更新
    }
    
    // 重新调度任务
    private void rescheduleTask(Task task) {
        // 将任务状态改为待处理，等待重新调度
        TaskLifecycleManager.updateTaskStatus(
            task, TaskStatus.PENDING, "故障恢复重新调度", "recovery");
    }
    
    // 继续重试流程
    private void continueRetryProcess(Task task) {
        // 检查重试次数和间隔
        RetryConfig retryConfig = task.getRetryConfig();
        if (retryConfig != null) {
            int currentRetryCount = getTaskRetryCount(task);
            if (currentRetryCount < retryConfig.getMaxRetries()) {
                // 继续重试
                long nextRetryTime = task.getLastUpdateTime() + retryConfig.getRetryInterval();
                if (System.currentTimeMillis() >= nextRetryTime) {
                    // 触发重试
                    triggerTaskRetry(task);
                }
            } else {
                // 达到最大重试次数，标记为失败
                TaskLifecycleManager.updateTaskStatus(
                    task, TaskStatus.FAILED, "达到最大重试次数", "recovery");
            }
        }
    }
    
    // 触发任务重试
    private void triggerTaskRetry(Task task) {
        TaskLifecycleManager.updateTaskStatus(
            task, TaskStatus.RUNNING, "故障恢复触发重试", "recovery");
        
        // 实际应用中需要通知执行器重新执行任务
        // 这里简化处理
        System.out.println("触发任务重试: " + task.getTaskId());
    }
    
    // 获取任务重试次数
    private int getTaskRetryCount(Task task) {
        List<TaskStatusChange> history = TaskStatusHistory.getStatusHistory(task.getTaskId());
        return (int) history.stream()
            .filter(change -> change.getToStatus() == TaskStatus.RETRYING)
            .count();
    }
    
    // 恢复状态历史记录
    private void recoverStatusHistory() {
        // 从持久化存储中恢复状态历史记录
        // 实际应用中需要从数据库加载历史记录
        System.out.println("状态历史记录恢复完成");
    }
    
    // 清理异常状态
    private void cleanupAbnormalStates() {
        // 清理长时间处于异常状态的任务
        long currentTime = System.currentTimeMillis();
        long threshold = 86400000; // 24小时
        
        List<Task> abnormalTasks = taskStore.getAllTasks().stream()
            .filter(task -> currentTime - task.getLastUpdateTime() > threshold)
            .filter(task -> task.getStatus() != TaskStatus.SUCCESS && 
                          task.getStatus() != TaskStatus.FAILED && 
                          task.getStatus() != TaskStatus.CANCELLED)
            .collect(Collectors.toList());
        
        for (Task task : abnormalTasks) {
            // 将异常状态任务标记为失败
            TaskLifecycleManager.updateTaskStatus(
                task, TaskStatus.FAILED, "长时间处于异常状态", "cleanup");
        }
        
        System.out.println("清理异常状态任务完成，共处理 " + abnormalTasks.size() + " 个任务");
    }
}

// 任务状态历史存储接口
interface TaskStatusHistoryStore {
    // 获取待持久化的状态变更记录
    List<TaskStatusChange> getPendingChanges();
    
    // 批量保存状态变更记录
    void batchSaveStatusChanges(List<TaskStatusChange> changes);
    
    // 根据任务ID获取状态历史
    List<TaskStatusChange> getStatusHistory(String taskId);
}
```

## 任务状态可视化与查询

为了便于监控和管理，任务状态的可视化和查询功能也非常重要。

### 状态查询API

```java
// 任务状态查询服务
public class TaskStatusQueryService {
    private final TaskStore taskStore;
    private final TaskStatusHistoryStore statusHistoryStore;
    
    public TaskStatusQueryService(TaskStore taskStore, 
                                TaskStatusHistoryStore statusHistoryStore) {
        this.taskStore = taskStore;
        this.statusHistoryStore = statusHistoryStore;
    }
    
    // 根据任务ID查询任务状态
    public TaskStatus getTaskStatus(String taskId) {
        Task task = taskStore.getTask(taskId);
        return task != null ? task.getStatus() : null;
    }
    
    // 根据状态查询任务列表
    public List<Task> getTasksByStatus(TaskStatus status) {
        return taskStore.getTasksByStatus(status);
    }
    
    // 查询任务状态历史
    public List<TaskStatusChange> getTaskStatusHistory(String taskId) {
        return statusHistoryStore.getStatusHistory(taskId);
    }
    
    // 查询任务执行统计
    public TaskExecutionStatistics getTaskExecutionStatistics(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            return null;
        }
        
        List<TaskStatusChange> history = statusHistoryStore.getStatusHistory(taskId);
        
        TaskExecutionStatistics stats = new TaskExecutionStatistics();
        stats.setTaskId(taskId);
        stats.setTaskName(task.getName());
        
        // 统计各种状态的次数
        Map<TaskStatus, Integer> statusCount = new HashMap<>();
        for (TaskStatusChange change : history) {
            TaskStatus status = change.getToStatus();
            statusCount.put(status, statusCount.getOrDefault(status, 0) + 1);
        }
        
        stats.setStatusCount(statusCount);
        
        // 计算成功率
        int successCount = statusCount.getOrDefault(TaskStatus.SUCCESS, 0);
        int totalCount = history.size();
        stats.setSuccessRate(totalCount > 0 ? (double) successCount / totalCount : 0);
        
        // 计算平均执行时间
        stats.setAverageExecutionTime(calculateAverageExecutionTime(history));
        
        return stats;
    }
    
    // 计算平均执行时间
    private long calculateAverageExecutionTime(List<TaskStatusChange> history) {
        long totalExecutionTime = 0;
        int executionCount = 0;
        
        TaskStatusChange startChange = null;
        for (TaskStatusChange change : history) {
            if (change.getToStatus() == TaskStatus.RUNNING) {
                startChange = change;
            } else if (change.getFromStatus() == TaskStatus.RUNNING && 
                      (change.getToStatus() == TaskStatus.SUCCESS || 
                       change.getToStatus() == TaskStatus.FAILED)) {
                if (startChange != null) {
                    totalExecutionTime += change.getTimestamp() - startChange.getTimestamp();
                    executionCount++;
                    startChange = null;
                }
            }
        }
        
        return executionCount > 0 ? totalExecutionTime / executionCount : 0;
    }
    
    // 查询时间段内的任务状态
    public List<TaskStatusSnapshot> getTaskStatusSnapshots(long startTime, long endTime) {
        List<TaskStatusSnapshot> snapshots = new ArrayList<>();
        
        // 获取时间段内有状态变更的任务
        List<String> taskIds = statusHistoryStore.getStatusHistoryInRange(startTime, endTime)
            .stream()
            .map(TaskStatusChange::getTaskId)
            .distinct()
            .collect(Collectors.toList());
        
        for (String taskId : taskIds) {
            Task task = taskStore.getTask(taskId);
            if (task != null) {
                TaskStatusSnapshot snapshot = new TaskStatusSnapshot();
                snapshot.setTaskId(taskId);
                snapshot.setTaskName(task.getName());
                snapshot.setStatus(task.getStatus());
                snapshot.setTimestamp(System.currentTimeMillis());
                snapshots.add(snapshot);
            }
        }
        
        return snapshots;
    }
}

// 任务执行统计
class TaskExecutionStatistics {
    private String taskId;
    private String taskName;
    private Map<TaskStatus, Integer> statusCount;
    private double successRate;
    private long averageExecutionTime;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    public Map<TaskStatus, Integer> getStatusCount() { return statusCount; }
    public void setStatusCount(Map<TaskStatus, Integer> statusCount) { this.statusCount = statusCount; }
    public double getSuccessRate() { return successRate; }
    public void setSuccessRate(double successRate) { this.successRate = successRate; }
    public long getAverageExecutionTime() { return averageExecutionTime; }
    public void setAverageExecutionTime(long averageExecutionTime) { this.averageExecutionTime = averageExecutionTime; }
}

// 任务状态快照
class TaskStatusSnapshot {
    private String taskId;
    private String taskName;
    private TaskStatus status;
    private long timestamp;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}

// 扩展状态历史存储接口
interface ExtendedTaskStatusHistoryStore extends TaskStatusHistoryStore {
    // 查询时间段内的状态变更记录
    List<TaskStatusChange> getStatusHistoryInRange(long startTime, long endTime);
}
```

## 任务状态管理最佳实践

### 设计原则

1. **状态明确性**：每个状态应该有明确的含义和用途
2. **转换合法性**：定义合法的状态转换规则，避免非法状态转换
3. **持久化可靠性**：确保状态变更能够可靠持久化
4. **监控可视化**：提供状态查询和监控接口
5. **故障恢复**：具备状态恢复和异常处理能力

### 常见问题与解决方案

```java
// 任务状态管理常见问题及解决方案
public class TaskStateManagerBestPractices {
    
    // 问题1：状态不一致
    // 解决方案：使用事务性状态更新
    public static boolean updateTaskStatusTransactionally(Task task, TaskStatus newStatus) {
        // 实际应用中应该使用数据库事务
        synchronized (task) {
            TaskStatus oldStatus = task.getStatus();
            if (TaskStatusManager.isValidTransition(oldStatus, newStatus)) {
                task.setStatus(newStatus);
                task.setLastUpdateTime(System.currentTimeMillis());
                
                // 持久化到数据库
                try {
                    // database.commit();
                    return true;
                } catch (Exception e) {
                    // 回滚状态
                    task.setStatus(oldStatus);
                    return false;
                }
            }
            return false;
        }
    }
    
    // 问题2：状态变更丢失
    // 解决方案：使用事件驱动和补偿机制
    public static void handleStatusChangeWithCompensation(Task task, TaskStatus newStatus) {
        TaskStatus oldStatus = task.getStatus();
        
        // 先更新状态
        task.setStatus(newStatus);
        task.setLastUpdateTime(System.currentTimeMillis());
        
        // 发送状态变更事件
        TaskEvent event = new TaskEvent(TaskEventType.STATUS_CHANGED, task);
        EventPublisher.publish(event);
        
        // 设置补偿定时器
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.schedule(() -> {
            // 检查状态变更是否成功处理
            if (!isStatusChangeProcessed(task.getTaskId(), newStatus)) {
                // 触发补偿机制
                compensateStatusChange(task, oldStatus, newStatus);
            }
        }, 30, TimeUnit.SECONDS);
    }
    
    // 检查状态变更是否已处理
    private static boolean isStatusChangeProcessed(String taskId, TaskStatus status) {
        // 实际应用中应该检查下游系统是否已处理状态变更
        return true; // 简化处理
    }
    
    // 补偿状态变更
    private static void compensateStatusChange(Task task, TaskStatus oldStatus, TaskStatus newStatus) {
        System.err.println("状态变更补偿: " + taskId + " [" + oldStatus + " -> " + newStatus + "]");
        
        // 重新发送状态变更事件或执行其他补偿操作
        TaskEvent event = new TaskEvent(TaskEventType.STATUS_CHANGED, task);
        EventPublisher.publish(event);
    }
    
    // 问题3：大量状态历史记录
    // 解决方案：分层存储和归档策略
    public static class StatusHistoryArchiver {
        private final TaskStatusHistoryStore historyStore;
        private final ScheduledExecutorService archiveService;
        
        public StatusHistoryArchiver(TaskStatusHistoryStore historyStore) {
            this.historyStore = historyStore;
            this.archiveService = Executors.newScheduledThreadPool(1);
        }
        
        // 启动归档服务
        public void start() {
            archiveService.scheduleAtFixedRate(this::archiveOldRecords, 0, 1, TimeUnit.HOURS);
        }
        
        // 归档旧记录
        private void archiveOldRecords() {
            long oneMonthAgo = System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000;
            
            // 获取一个月前的状态记录
            List<TaskStatusChange> oldRecords = historyStore.getStatusHistoryBefore(oneMonthAgo);
            
            if (!oldRecords.isEmpty()) {
                // 归档到冷存储
                archiveToColdStorage(oldRecords);
                
                // 从热存储中删除
                historyStore.deleteStatusHistoryBefore(oneMonthAgo);
                
                System.out.println("归档了 " + oldRecords.size() + " 条状态历史记录");
            }
        }
        
        // 归档到冷存储
        private void archiveToColdStorage(List<TaskStatusChange> records) {
            // 实际应用中可以保存到文件系统、数据仓库等
            System.out.println("归档到冷存储: " + records.size() + " 条记录");
        }
    }
    
    // 扩展状态历史存储接口
    interface ArchivableTaskStatusHistoryStore extends TaskStatusHistoryStore {
        // 获取指定时间之前的记录
        List<TaskStatusChange> getStatusHistoryBefore(long timestamp);
        
        // 删除指定时间之前的记录
        void deleteStatusHistoryBefore(long timestamp);
    }
}
```

## 总结

任务状态与生命周期管理是分布式任务调度系统的核心组成部分，它直接影响系统的可靠性、可维护性和用户体验。通过合理的状态设计、严格的转换控制、可靠的持久化机制和完善的监控告警，我们可以构建出稳定高效的任务调度系统。

关键要点包括：

1. **状态定义**：明确定义任务的各种状态及其含义
2. **生命周期**：管理任务从创建到完成的完整生命周期
3. **状态转换**：控制合法的状态转换，防止非法操作
4. **持久化**：确保状态变更的可靠持久化和故障恢复
5. **监控告警**：提供实时的状态监控和异常告警机制

在下一章中，我们将探讨分布式调度的基本模型，深入了解调度中心与执行节点的协作机制。