---
title: 2.4 调度器的监控与管理
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在前面的章节中，我们实现了基本的单机定时任务调度器。一个生产级的调度系统不仅需要具备强大的调度能力，还需要完善的监控和管理功能，以便运维人员能够实时了解系统状态、快速定位问题并进行有效的管理操作。本文将详细介绍如何为调度器添加监控和管理功能，包括 REST API 接口、Web 管理界面、执行日志记录、性能指标收集等。

## 系统监控架构设计

在设计监控系统时，我们需要考虑以下几个核心方面：

### 监控系统核心组件

```java
// 监控服务接口
public interface MonitoringService {
    /**
     * 获取系统概览信息
     * @return 系统概览
     */
    SystemOverview getSystemOverview();
    
    /**
     * 获取任务统计信息
     * @return 任务统计
     */
    TaskStatistics getTaskStatistics();
    
    /**
     * 获取性能指标
     * @return 性能指标
     */
    PerformanceMetrics getPerformanceMetrics();
    
    /**
     * 获取最近的执行记录
     * @param limit 记录数量限制
     * @return 执行记录列表
     */
    List<TaskExecutionRecord> getRecentExecutions(int limit);
    
    /**
     * 获取失败的执行记录
     * @param limit 记录数量限制
     * @return 失败记录列表
     */
    List<TaskExecutionRecord> getFailedExecutions(int limit);
}

// 管理服务接口
public interface ManagementService {
    /**
     * 添加任务
     * @param taskConfig 任务配置
     * @return 任务ID
     */
    String addTask(TaskConfig taskConfig);
    
    /**
     * 更新任务
     * @param taskId 任务ID
     * @param taskConfig 任务配置
     * @return 是否更新成功
     */
    boolean updateTask(String taskId, TaskConfig taskConfig);
    
    /**
     * 删除任务
     * @param taskId 任务ID
     * @return 是否删除成功
     */
    boolean removeTask(String taskId);
    
    /**
     * 暂停任务
     * @param taskId 任务ID
     * @return 是否暂停成功
     */
    boolean pauseTask(String taskId);
    
    /**
     * 恢复任务
     * @param taskId 任务ID
     * @return 是否恢复成功
     */
    boolean resumeTask(String taskId);
    
    /**
     * 立即执行任务
     * @param taskId 任务ID
     * @return 是否触发成功
     */
    boolean triggerTask(String taskId);
    
    /**
     * 获取任务详情
     * @param taskId 任务ID
     * @return 任务详情
     */
    ScheduledTask getTaskDetail(String taskId);
    
    /**
     * 获取所有任务
     * @return 任务列表
     */
    List<ScheduledTask> getAllTasks();
    
    /**
     * 启动调度器
     */
    void startScheduler();
    
    /**
     * 停止调度器
     */
    void stopScheduler();
}

// 系统概览信息
class SystemOverview {
    private String version;              // 系统版本
    private boolean isRunning;           // 是否运行中
    private Date startTime;              // 启动时间
    private long uptime;                 // 运行时间(秒)
    private int totalTasks;              // 总任务数
    private int runningTasks;            // 运行中任务数
    private int failedTasks;             // 失败任务数
    private long totalExecutions;        // 总执行次数
    private long failedExecutions;       // 失败执行次数
    private double successRate;          // 成功率
    
    // Getters and Setters
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    
    public boolean isRunning() { return isRunning; }
    public void setRunning(boolean running) { isRunning = running; }
    
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    
    public long getUptime() { return uptime; }
    public void setUptime(long uptime) { this.uptime = uptime; }
    
    public int getTotalTasks() { return totalTasks; }
    public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
    
    public int getRunningTasks() { return runningTasks; }
    public void setRunningTasks(int runningTasks) { this.runningTasks = runningTasks; }
    
    public int getFailedTasks() { return failedTasks; }
    public void setFailedTasks(int failedTasks) { this.failedTasks = failedTasks; }
    
    public long getTotalExecutions() { return totalExecutions; }
    public void setTotalExecutions(long totalExecutions) { this.totalExecutions = totalExecutions; }
    
    public long getFailedExecutions() { return failedExecutions; }
    public void setFailedExecutions(long failedExecutions) { this.failedExecutions = failedExecutions; }
    
    public double getSuccessRate() { return successRate; }
    public void setSuccessRate(double successRate) { this.successRate = successRate; }
}

// 任务统计信息
class TaskStatistics {
    private Map<TaskStatus, Integer> statusDistribution;  // 状态分布
    private Map<TaskType, Integer> typeDistribution;      // 类型分布
    private Map<String, Long> executionCounts;            // 任务执行次数
    private Map<String, Double> averageExecutionTimes;    // 平均执行时间
    private List<TaskExecutionTrend> executionTrends;     // 执行趋势
    
    public TaskStatistics() {
        this.statusDistribution = new HashMap<>();
        this.typeDistribution = new HashMap<>();
        this.executionCounts = new HashMap<>();
        this.averageExecutionTimes = new HashMap<>();
        this.executionTrends = new ArrayList<>();
    }
    
    // Getters and Setters
    public Map<TaskStatus, Integer> getStatusDistribution() { return statusDistribution; }
    public void setStatusDistribution(Map<TaskStatus, Integer> statusDistribution) { this.statusDistribution = statusDistribution; }
    
    public Map<TaskType, Integer> getTypeDistribution() { return typeDistribution; }
    public void setTypeDistribution(Map<TaskType, Integer> typeDistribution) { this.typeDistribution = typeDistribution; }
    
    public Map<String, Long> getExecutionCounts() { return executionCounts; }
    public void setExecutionCounts(Map<String, Long> executionCounts) { this.executionCounts = executionCounts; }
    
    public Map<String, Double> getAverageExecutionTimes() { return averageExecutionTimes; }
    public void setAverageExecutionTimes(Map<String, Double> averageExecutionTimes) { this.averageExecutionTimes = averageExecutionTimes; }
    
    public List<TaskExecutionTrend> getExecutionTrends() { return executionTrends; }
    public void setExecutionTrends(List<TaskExecutionTrend> executionTrends) { this.executionTrends = executionTrends; }
}

// 任务执行趋势
class TaskExecutionTrend {
    private Date date;           // 日期
    private long executionCount; // 执行次数
    private long successCount;   // 成功次数
    private long failCount;      // 失败次数
    
    public TaskExecutionTrend(Date date, long executionCount, long successCount, long failCount) {
        this.date = date;
        this.executionCount = executionCount;
        this.successCount = successCount;
        this.failCount = failCount;
    }
    
    // Getters
    public Date getDate() { return date; }
    public long getExecutionCount() { return executionCount; }
    public long getSuccessCount() { return successCount; }
    public long getFailCount() { return failCount; }
}

// 性能指标
class PerformanceMetrics {
    private double cpuUsage;        // CPU使用率
    private long memoryUsage;       // 内存使用量
    private long diskUsage;         // 磁盘使用量
    private long networkIn;         // 网络流入
    private long networkOut;        // 网络流出
    private int threadCount;        // 线程数
    private int activeThreads;      // 活跃线程数
    private long pendingTasks;      // 待处理任务数
    
    // Getters and Setters
    public double getCpuUsage() { return cpuUsage; }
    public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
    
    public long getMemoryUsage() { return memoryUsage; }
    public void setMemoryUsage(long memoryUsage) { this.memoryUsage = memoryUsage; }
    
    public long getDiskUsage() { return diskUsage; }
    public void setDiskUsage(long diskUsage) { this.diskUsage = diskUsage; }
    
    public long getNetworkIn() { return networkIn; }
    public void setNetworkIn(long networkIn) { this.networkIn = networkIn; }
    
    public long getNetworkOut() { return networkOut; }
    public void setNetworkOut(long networkOut) { this.networkOut = networkOut; }
    
    public int getThreadCount() { return threadCount; }
    public void setThreadCount(int threadCount) { this.threadCount = threadCount; }
    
    public int getActiveThreads() { return activeThreads; }
    public void setActiveThreads(int activeThreads) { this.activeThreads = activeThreads; }
    
    public long getPendingTasks() { return pendingTasks; }
    public void setPendingTasks(long pendingTasks) { this.pendingTasks = pendingTasks; }
}
```

## REST API 接口实现

为了方便外部系统集成和管理，我们需要提供一套完整的 REST API 接口：

```java
// REST控制器 - 监控接口
@RestController
@RequestMapping("/api/monitor")
public class MonitoringController {
    private final MonitoringService monitoringService;
    
    public MonitoringController(MonitoringService monitoringService) {
        this.monitoringService = monitoringService;
    }
    
    // 获取系统概览
    @GetMapping("/overview")
    public ResponseEntity<SystemOverview> getSystemOverview() {
        try {
            SystemOverview overview = monitoringService.getSystemOverview();
            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取任务统计
    @GetMapping("/statistics")
    public ResponseEntity<TaskStatistics> getTaskStatistics() {
        try {
            TaskStatistics statistics = monitoringService.getTaskStatistics();
            return ResponseEntity.ok(statistics);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取性能指标
    @GetMapping("/metrics")
    public ResponseEntity<PerformanceMetrics> getPerformanceMetrics() {
        try {
            PerformanceMetrics metrics = monitoringService.getPerformanceMetrics();
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取最近执行记录
    @GetMapping("/executions/recent")
    public ResponseEntity<List<TaskExecutionRecord>> getRecentExecutions(
            @RequestParam(defaultValue = "50") int limit) {
        try {
            List<TaskExecutionRecord> executions = monitoringService.getRecentExecutions(limit);
            return ResponseEntity.ok(executions);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取失败执行记录
    @GetMapping("/executions/failed")
    public ResponseEntity<List<TaskExecutionRecord>> getFailedExecutions(
            @RequestParam(defaultValue = "50") int limit) {
        try {
            List<TaskExecutionRecord> executions = monitoringService.getFailedExecutions(limit);
            return ResponseEntity.ok(executions);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}

// REST控制器 - 管理接口
@RestController
@RequestMapping("/api/manage")
public class ManagementController {
    private final ManagementService managementService;
    
    public ManagementController(ManagementService managementService) {
        this.managementService = managementService;
    }
    
    // 添加任务
    @PostMapping("/tasks")
    public ResponseEntity<String> addTask(@RequestBody TaskConfig taskConfig) {
        try {
            String taskId = managementService.addTask(taskConfig);
            return ResponseEntity.ok(taskId);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("添加任务失败: " + e.getMessage());
        }
    }
    
    // 更新任务
    @PutMapping("/tasks/{taskId}")
    public ResponseEntity<Boolean> updateTask(
            @PathVariable String taskId, 
            @RequestBody TaskConfig taskConfig) {
        try {
            boolean result = managementService.updateTask(taskId, taskConfig);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 删除任务
    @DeleteMapping("/tasks/{taskId}")
    public ResponseEntity<Boolean> removeTask(@PathVariable String taskId) {
        try {
            boolean result = managementService.removeTask(taskId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 暂停任务
    @PostMapping("/tasks/{taskId}/pause")
    public ResponseEntity<Boolean> pauseTask(@PathVariable String taskId) {
        try {
            boolean result = managementService.pauseTask(taskId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 恢复任务
    @PostMapping("/tasks/{taskId}/resume")
    public ResponseEntity<Boolean> resumeTask(@PathVariable String taskId) {
        try {
            boolean result = managementService.resumeTask(taskId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 立即执行任务
    @PostMapping("/tasks/{taskId}/trigger")
    public ResponseEntity<Boolean> triggerTask(@PathVariable String taskId) {
        try {
            boolean result = managementService.triggerTask(taskId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 获取任务详情
    @GetMapping("/tasks/{taskId}")
    public ResponseEntity<ScheduledTask> getTaskDetail(@PathVariable String taskId) {
        try {
            ScheduledTask task = managementService.getTaskDetail(taskId);
            if (task != null) {
                return ResponseEntity.ok(task);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取所有任务
    @GetMapping("/tasks")
    public ResponseEntity<List<ScheduledTask>> getAllTasks() {
        try {
            List<ScheduledTask> tasks = managementService.getAllTasks();
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 启动调度器
    @PostMapping("/scheduler/start")
    public ResponseEntity<Boolean> startScheduler() {
        try {
            managementService.startScheduler();
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
    
    // 停止调度器
    @PostMapping("/scheduler/stop")
    public ResponseEntity<Boolean> stopScheduler() {
        try {
            managementService.stopScheduler();
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(false);
        }
    }
}

// 任务配置类
class TaskConfig {
    private String taskName;
    private String taskClass;
    private String cronExpression;
    private TaskType taskType;
    private Map<String, Object> parameters;
    private boolean persistent;
    
    // Getters and Setters
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public String getTaskClass() { return taskClass; }
    public void setTaskClass(String taskClass) { this.taskClass = taskClass; }
    
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    
    public TaskType getTaskType() { return taskType; }
    public void setTaskType(TaskType taskType) { this.taskType = taskType; }
    
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    
    public boolean isPersistent() { return persistent; }
    public void setPersistent(boolean persistent) { this.persistent = persistent; }
}
```

## 监控服务实现

现在让我们实现监控服务的具体逻辑：

```java
// 监控服务实现
public class SimpleMonitoringService implements MonitoringService {
    private final TaskStore taskStore;
    private final TaskExecutionHistory executionHistory;
    private final SimpleTaskScheduler scheduler;
    private final String version = "1.0.0";
    
    public SimpleMonitoringService(TaskStore taskStore, 
                                 TaskExecutionHistory executionHistory,
                                 SimpleTaskScheduler scheduler) {
        this.taskStore = taskStore;
        this.executionHistory = executionHistory;
        this.scheduler = scheduler;
    }
    
    @Override
    public SystemOverview getSystemOverview() {
        SystemOverview overview = new SystemOverview();
        overview.setVersion(version);
        overview.setRunning(scheduler != null && isSchedulerRunning());
        overview.setStartTime(getSchedulerStartTime());
        overview.setUptime(calculateUptime());
        
        // 统计任务信息
        List<ScheduledTask> allTasks = taskStore.getAllTasks();
        overview.setTotalTasks(allTasks.size());
        
        int runningTasks = 0;
        int failedTasks = 0;
        for (ScheduledTask task : allTasks) {
            if (task.getStatus() == TaskStatus.RUNNING) {
                runningTasks++;
            } else if (task.getStatus() == TaskStatus.FAILED) {
                failedTasks++;
            }
        }
        overview.setRunningTasks(runningTasks);
        overview.setFailedTasks(failedTasks);
        
        // 统计执行信息
        List<TaskExecutionRecord> allExecutions = executionHistory.getAllRecords();
        long totalExecutions = allExecutions.size();
        long failedExecutions = allExecutions.stream()
            .filter(record -> !record.isSuccess())
            .count();
        
        overview.setTotalExecutions(totalExecutions);
        overview.setFailedExecutions(failedExecutions);
        overview.setSuccessRate(totalExecutions > 0 ? 
            (double) (totalExecutions - failedExecutions) / totalExecutions : 0);
        
        return overview;
    }
    
    @Override
    public TaskStatistics getTaskStatistics() {
        TaskStatistics statistics = new TaskStatistics();
        
        // 状态分布
        Map<TaskStatus, Integer> statusDistribution = new HashMap<>();
        Map<TaskType, Integer> typeDistribution = new HashMap<>();
        Map<String, Long> executionCounts = new HashMap<>();
        Map<String, Double> averageExecutionTimes = new HashMap<>();
        
        List<ScheduledTask> allTasks = taskStore.getAllTasks();
        for (ScheduledTask task : allTasks) {
            // 状态分布统计
            statusDistribution.merge(task.getStatus(), 1, Integer::sum);
            
            // 类型分布统计
            typeDistribution.merge(task.getTaskType(), 1, Integer::sum);
            
            // 执行次数统计
            executionCounts.put(task.getTaskId(), (long) task.getExecuteCount());
        }
        
        // 平均执行时间统计
        for (ScheduledTask task : allTasks) {
            List<TaskExecutionRecord> records = executionHistory.getExecutionHistory(task.getTaskId());
            if (!records.isEmpty()) {
                double avgTime = records.stream()
                    .mapToLong(TaskExecutionRecord::getExecutionTime)
                    .average()
                    .orElse(0.0);
                averageExecutionTimes.put(task.getTaskId(), avgTime);
            }
        }
        
        statistics.setStatusDistribution(statusDistribution);
        statistics.setTypeDistribution(typeDistribution);
        statistics.setExecutionCounts(executionCounts);
        statistics.setAverageExecutionTimes(averageExecutionTimes);
        
        // 执行趋势统计（最近7天）
        statistics.setExecutionTrends(calculateExecutionTrends());
        
        return statistics;
    }
    
    @Override
    public PerformanceMetrics getPerformanceMetrics() {
        PerformanceMetrics metrics = new PerformanceMetrics();
        
        // JVM性能指标
        Runtime runtime = Runtime.getRuntime();
        metrics.setMemoryUsage(runtime.totalMemory() - runtime.freeMemory());
        metrics.setCpuUsage(getCpuUsage());
        metrics.setThreadCount(Thread.activeCount());
        
        // 任务相关指标
        metrics.setPendingTasks(countPendingTasks());
        
        return metrics;
    }
    
    @Override
    public List<TaskExecutionRecord> getRecentExecutions(int limit) {
        return executionHistory.getRecentExecutions(limit);
    }
    
    @Override
    public List<TaskExecutionRecord> getFailedExecutions(int limit) {
        return executionHistory.getFailedExecutions(limit);
    }
    
    // 检查调度器是否运行中
    private boolean isSchedulerRunning() {
        // 简化实现，实际应用中需要检查调度器状态
        return true;
    }
    
    // 获取调度器启动时间
    private Date getSchedulerStartTime() {
        // 简化实现，实际应用中需要记录启动时间
        return new Date(System.currentTimeMillis() - calculateUptime() * 1000);
    }
    
    // 计算运行时间
    private long calculateUptime() {
        // 简化实现，实际应用中需要记录启动时间
        return 3600; // 1小时
    }
    
    // 获取CPU使用率
    private double getCpuUsage() {
        // 简化实现，实际应用中可以通过JMX获取
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        return osBean.getSystemLoadAverage();
    }
    
    // 统计待处理任务数
    private long countPendingTasks() {
        return taskStore.getAllTasks().stream()
            .filter(task -> task.getStatus() == TaskStatus.PENDING)
            .count();
    }
    
    // 计算执行趋势
    private List<TaskExecutionTrend> calculateExecutionTrends() {
        List<TaskExecutionTrend> trends = new ArrayList<>();
        List<TaskExecutionRecord> allRecords = executionHistory.getAllRecords();
        
        // 按日期分组统计
        Map<Date, List<TaskExecutionRecord>> groupedByDate = allRecords.stream()
            .collect(Collectors.groupingBy(record -> getDatePart(record.getExecuteTime())));
        
        // 生成最近7天的趋势数据
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        
        for (int i = 6; i >= 0; i--) {
            Calendar day = (Calendar) calendar.clone();
            day.add(Calendar.DAY_OF_MONTH, -i);
            Date date = day.getTime();
            
            List<TaskExecutionRecord> records = groupedByDate.getOrDefault(date, new ArrayList<>());
            long executionCount = records.size();
            long successCount = records.stream().filter(TaskExecutionRecord::isSuccess).count();
            long failCount = executionCount - successCount;
            
            trends.add(new TaskExecutionTrend(date, executionCount, successCount, failCount));
        }
        
        return trends;
    }
    
    // 获取日期部分（忽略时间）
    private Date getDatePart(Date date) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar.getTime();
    }
}

// 扩展的任务执行历史记录
class TaskExecutionHistory {
    private final List<TaskExecutionRecord> records = new ArrayList<>();
    private final int maxRecords;
    
    public TaskExecutionHistory(int maxRecords) {
        this.maxRecords = maxRecords;
    }
    
    // 记录任务执行
    public synchronized void recordExecution(TaskExecutionRecord record) {
        records.add(record);
        if (records.size() > maxRecords) {
            records.remove(0);
        }
    }
    
    // 获取最近的执行记录
    public synchronized List<TaskExecutionRecord> getRecentExecutions(int limit) {
        return records.stream()
            .sorted((r1, r2) -> r2.getExecuteTime().compareTo(r1.getExecuteTime()))
            .limit(limit)
            .collect(Collectors.toList());
    }
    
    // 获取失败的执行记录
    public synchronized List<TaskExecutionRecord> getFailedExecutions(int limit) {
        return records.stream()
            .filter(record -> !record.isSuccess())
            .sorted((r1, r2) -> r2.getExecuteTime().compareTo(r1.getExecuteTime()))
            .limit(limit)
            .collect(Collectors.toList());
    }
    
    // 获取指定任务的执行历史
    public synchronized List<TaskExecutionRecord> getExecutionHistory(String taskId) {
        return records.stream()
            .filter(record -> record.getTaskId().equals(taskId))
            .collect(Collectors.toList());
    }
    
    // 获取所有记录
    public synchronized List<TaskExecutionRecord> getAllRecords() {
        return new ArrayList<>(records);
    }
}

// 管理服务实现
public class SimpleManagementService implements ManagementService {
    private final SimpleTaskScheduler scheduler;
    private final TaskStore taskStore;
    
    public SimpleManagementService(SimpleTaskScheduler scheduler, TaskStore taskStore) {
        this.scheduler = scheduler;
        this.taskStore = taskStore;
    }
    
    @Override
    public String addTask(TaskConfig taskConfig) {
        ScheduledTask task = new ScheduledTask();
        task.setTaskName(taskConfig.getTaskName());
        task.setTaskClass(taskConfig.getTaskClass());
        task.setCronExpression(taskConfig.getCronExpression());
        task.setTaskType(taskConfig.getTaskType());
        task.setParameters(taskConfig.getParameters());
        task.setPersistent(taskConfig.isPersistent());
        
        return scheduler.addTask(task);
    }
    
    @Override
    public boolean updateTask(String taskId, TaskConfig taskConfig) {
        // 简化实现，实际应用中需要更复杂的更新逻辑
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null) {
            return false;
        }
        
        // 更新任务属性
        task.setTaskName(taskConfig.getTaskName());
        task.setTaskClass(taskConfig.getTaskClass());
        task.setCronExpression(taskConfig.getCronExpression());
        task.setTaskType(taskConfig.getTaskType());
        task.setParameters(taskConfig.getParameters());
        task.setPersistent(taskConfig.isPersistent());
        task.setUpdateTime(new Date());
        
        taskStore.saveTask(task);
        return true;
    }
    
    @Override
    public boolean removeTask(String taskId) {
        return scheduler.removeTask(taskId);
    }
    
    @Override
    public boolean pauseTask(String taskId) {
        return scheduler.pauseTask(taskId);
    }
    
    @Override
    public boolean resumeTask(String taskId) {
        return scheduler.resumeTask(taskId);
    }
    
    @Override
    public boolean triggerTask(String taskId) {
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null) {
            return false;
        }
        
        // 立即执行任务
        // 这里简化处理，实际应用中可能需要通过调度器执行
        return true;
    }
    
    @Override
    public ScheduledTask getTaskDetail(String taskId) {
        return taskStore.getTask(taskId);
    }
    
    @Override
    public List<ScheduledTask> getAllTasks() {
        return taskStore.getAllTasks();
    }
    
    @Override
    public void startScheduler() {
        scheduler.start();
    }
    
    @Override
    public void stopScheduler() {
        scheduler.shutdown();
    }
}
```

## Web 管理界面

为了提供更好的用户体验，我们可以开发一个 Web 管理界面来可视化监控和管理任务：

```html
<!-- 任务管理界面 -->
<!DOCTYPE html>
<html>
<head>
    <title>定时任务管理系统</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .stats { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .stat-card { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; margin: 0 10px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #333; }
        .stat-label { color: #666; font-size: 14px; }
        .tasks-table { width: 100%; border-collapse: collapse; background: white; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tasks-table th, .tasks-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .tasks-table th { background: #f8f9fa; font-weight: 600; }
        .status-running { color: #28a745; }
        .status-paused { color: #ffc107; }
        .status-failed { color: #dc3545; }
        .actions { display: flex; gap: 5px; }
        .btn { padding: 6px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: black; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-info { background: #17a2b8; color: white; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); }
        .modal-content { background: white; margin: 10% auto; padding: 20px; border-radius: 5px; width: 500px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; }
        .close { float: right; cursor: pointer; font-size: 24px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>定时任务管理系统</h1>
            <button class="btn btn-primary" onclick="openAddTaskModal()">添加任务</button>
            <button class="btn btn-info" onclick="refreshData()">刷新</button>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="totalTasks">0</div>
                <div class="stat-label">总任务数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="runningTasks">0</div>
                <div class="stat-label">运行中</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="failedTasks">0</div>
                <div class="stat-label">失败任务</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="successRate">0%</div>
                <div class="stat-label">成功率</div>
            </div>
        </div>
        
        <table class="tasks-table">
            <thead>
                <tr>
                    <th>任务名称</th>
                    <th>任务类型</th>
                    <th>状态</th>
                    <th>下次执行时间</th>
                    <th>执行次数</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody id="tasksTableBody">
                <!-- 任务列表将通过JavaScript动态填充 -->
            </tbody>
        </table>
    </div>
    
    <!-- 添加/编辑任务模态框 -->
    <div id="taskModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeTaskModal()">&times;</span>
            <h2 id="modalTitle">添加任务</h2>
            <form id="taskForm">
                <input type="hidden" id="taskId">
                <div class="form-group">
                    <label>任务名称:</label>
                    <input type="text" id="taskName" required>
                </div>
                <div class="form-group">
                    <label>任务类:</label>
                    <input type="text" id="taskClass" required>
                </div>
                <div class="form-group">
                    <label>任务类型:</label>
                    <select id="taskType" required>
                        <option value="CRON">Cron表达式</option>
                        <option value="FIXED_RATE">固定频率</option>
                        <option value="FIXED_DELAY">固定延迟</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Cron表达式:</label>
                    <input type="text" id="cronExpression">
                </div>
                <div class="form-group">
                    <label>参数 (JSON格式):</label>
                    <textarea id="parameters" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="persistent"> 持久化
                    </label>
                </div>
                <button type="submit" class="btn btn-primary">保存</button>
                <button type="button" class="btn" onclick="closeTaskModal()">取消</button>
            </form>
        </div>
    </div>

    <script>
        // 全局变量
        let currentTasks = [];
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            refreshData();
            setInterval(refreshData, 30000); // 每30秒自动刷新
        });
        
        // 刷新数据
        function refreshData() {
            fetchSystemOverview();
            fetchTasks();
        }
        
        // 获取系统概览
        function fetchSystemOverview() {
            fetch('/api/monitor/overview')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('totalTasks').textContent = data.totalTasks;
                    document.getElementById('runningTasks').textContent = data.runningTasks;
                    document.getElementById('failedTasks').textContent = data.failedTasks;
                    document.getElementById('successRate').textContent = (data.successRate * 100).toFixed(2) + '%';
                })
                .catch(error => console.error('获取系统概览失败:', error));
        }
        
        // 获取任务列表
        function fetchTasks() {
            fetch('/api/manage/tasks')
                .then(response => response.json())
                .then(data => {
                    currentTasks = data;
                    renderTasksTable(data);
                })
                .catch(error => console.error('获取任务列表失败:', error));
        }
        
        // 渲染任务表格
        function renderTasksTable(tasks) {
            const tbody = document.getElementById('tasksTableBody');
            tbody.innerHTML = '';
            
            tasks.forEach(task => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${task.taskName}</td>
                    <td>${task.taskType}</td>
                    <td class="status-${task.status.toLowerCase()}">${task.status}</td>
                    <td>${task.nextExecuteTime || '-'}</td>
                    <td>${task.executeCount}</td>
                    <td class="actions">
                        <button class="btn btn-info" onclick="editTask('${task.taskId}')">编辑</button>
                        ${task.status === 'PAUSED' ? 
                            `<button class="btn btn-success" onclick="resumeTask('${task.taskId}')">恢复</button>` :
                            `<button class="btn btn-warning" onclick="pauseTask('${task.taskId}')">暂停</button>`}
                        <button class="btn btn-danger" onclick="removeTask('${task.taskId}')">删除</button>
                        <button class="btn btn-primary" onclick="triggerTask('${task.taskId}')">立即执行</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // 打开添加任务模态框
        function openAddTaskModal() {
            document.getElementById('modalTitle').textContent = '添加任务';
            document.getElementById('taskId').value = '';
            document.getElementById('taskForm').reset();
            document.getElementById('taskModal').style.display = 'block';
        }
        
        // 编辑任务
        function editTask(taskId) {
            const task = currentTasks.find(t => t.taskId === taskId);
            if (task) {
                document.getElementById('modalTitle').textContent = '编辑任务';
                document.getElementById('taskId').value = task.taskId;
                document.getElementById('taskName').value = task.taskName;
                document.getElementById('taskClass').value = task.taskClass;
                document.getElementById('taskType').value = task.taskType;
                document.getElementById('cronExpression').value = task.cronExpression || '';
                document.getElementById('parameters').value = JSON.stringify(task.parameters || {}, null, 2);
                document.getElementById('persistent').checked = task.persistent;
                document.getElementById('taskModal').style.display = 'block';
            }
        }
        
        // 关闭模态框
        function closeTaskModal() {
            document.getElementById('taskModal').style.display = 'none';
        }
        
        // 提交任务表单
        document.getElementById('taskForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const taskId = document.getElementById('taskId').value;
            const taskData = {
                taskName: document.getElementById('taskName').value,
                taskClass: document.getElementById('taskClass').value,
                taskType: document.getElementById('taskType').value,
                cronExpression: document.getElementById('cronExpression').value,
                parameters: JSON.parse(document.getElementById('parameters').value || '{}'),
                persistent: document.getElementById('persistent').checked
            };
            
            const url = taskId ? `/api/manage/tasks/${taskId}` : '/api/manage/tasks';
            const method = taskId ? 'PUT' : 'POST';
            
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            })
            .then(response => {
                if (response.ok) {
                    closeTaskModal();
                    refreshData();
                } else {
                    alert('保存任务失败');
                }
            })
            .catch(error => {
                console.error('保存任务失败:', error);
                alert('保存任务失败: ' + error.message);
            });
        });
        
        // 暂停任务
        function pauseTask(taskId) {
            if (confirm('确定要暂停此任务吗？')) {
                fetch(`/api/manage/tasks/${taskId}/pause`, {
                    method: 'POST'
                })
                .then(response => {
                    if (response.ok) {
                        refreshData();
                    } else {
                        alert('暂停任务失败');
                    }
                })
                .catch(error => {
                    console.error('暂停任务失败:', error);
                    alert('暂停任务失败: ' + error.message);
                });
            }
        }
        
        // 恢复任务
        function resumeTask(taskId) {
            if (confirm('确定要恢复此任务吗？')) {
                fetch(`/api/manage/tasks/${taskId}/resume`, {
                    method: 'POST'
                })
                .then(response => {
                    if (response.ok) {
                        refreshData();
                    } else {
                        alert('恢复任务失败');
                    }
                })
                .catch(error => {
                    console.error('恢复任务失败:', error);
                    alert('恢复任务失败: ' + error.message);
                });
            }
        }
        
        // 删除任务
        function removeTask(taskId) {
            if (confirm('确定要删除此任务吗？')) {
                fetch(`/api/manage/tasks/${taskId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        refreshData();
                    } else {
                        alert('删除任务失败');
                    }
                })
                .catch(error => {
                    console.error('删除任务失败:', error);
                    alert('删除任务失败: ' + error.message);
                });
            }
        }
        
        // 立即执行任务
        function triggerTask(taskId) {
            if (confirm('确定要立即执行此任务吗？')) {
                fetch(`/api/manage/tasks/${taskId}/trigger`, {
                    method: 'POST'
                })
                .then(response => {
                    if (response.ok) {
                        alert('任务已触发');
                    } else {
                        alert('触发任务失败');
                    }
                })
                .catch(error => {
                    console.error('触发任务失败:', error);
                    alert('触发任务失败: ' + error.message);
                });
            }
        }
        
        // 点击模态框外部关闭
        window.onclick = function(event) {
            const modal = document.getElementById('taskModal');
            if (event.target == modal) {
                closeTaskModal();
            }
        }
    </script>
</body>
</html>
```

## 日志记录与告警

完善的监控系统还需要详细的日志记录和及时的告警机制：

```java
// 日志记录服务
public class TaskLoggingService {
    private static final Logger logger = LoggerFactory.getLogger(TaskLoggingService.class);
    private final TaskExecutionHistory executionHistory;
    
    public TaskLoggingService(TaskExecutionHistory executionHistory) {
        this.executionHistory = executionHistory;
    }
    
    // 记录任务开始
    public void logTaskStart(ScheduledTask task) {
        logger.info("任务开始执行 - ID: {}, 名称: {}, 类型: {}", 
                   task.getTaskId(), task.getTaskName(), task.getTaskType());
    }
    
    // 记录任务完成
    public void logTaskCompletion(ScheduledTask task, TaskExecutionResult result) {
        if (result.isSuccess()) {
            logger.info("任务执行成功 - ID: {}, 名称: {}, 耗时: {}ms", 
                       task.getTaskId(), task.getTaskName(), result.getExecutionTime());
        } else {
            logger.error("任务执行失败 - ID: {}, 名称: {}, 错误: {}", 
                        task.getTaskId(), task.getTaskName(), result.getMessage());
        }
        
        // 记录到执行历史
        TaskExecutionRecord record = new TaskExecutionRecord(
            task.getTaskId(), task.getTaskName(), result.isSuccess(),
            result.getMessage(), result.getExecutionTime()
        );
        executionHistory.recordExecution(record);
    }
    
    // 记录系统事件
    public void logSystemEvent(String event, String details) {
        logger.info("系统事件 - 事件: {}, 详情: {}", event, details);
    }
    
    // 记录错误
    public void logError(String error, Exception e) {
        logger.error("系统错误 - 错误: {}", error, e);
    }
}

// 告警服务
public class AlertService {
    private static final Logger alertLogger = LoggerFactory.getLogger("ALERT");
    
    // 发送告警
    public void sendAlert(AlertLevel level, String type, String message) {
        switch (level) {
            case INFO:
                alertLogger.info("告警[{}] - 类型: {}, 消息: {}", level, type, message);
                break;
            case WARNING:
                alertLogger.warn("告警[{}] - 类型: {}, 消息: {}", level, type, message);
                break;
            case ERROR:
                alertLogger.error("告警[{}] - 类型: {}, 消息: {}", level, type, message);
                break;
            case CRITICAL:
                alertLogger.error("告警[{}] - 类型: {}, 消息: {}", level, type, message);
                // 发送紧急通知（邮件、短信等）
                sendCriticalNotification(type, message);
                break;
        }
    }
    
    // 发送紧急通知
    private void sendCriticalNotification(String type, String message) {
        // 实际应用中可以集成邮件、短信、微信等通知方式
        System.err.println("紧急通知: " + type + " - " + message);
    }
}

// 告警级别枚举
enum AlertLevel {
    INFO,      // 信息
    WARNING,   // 警告
    ERROR,     // 错误
    CRITICAL   // 严重
}

// 告警规则
class AlertRule {
    private String ruleId;
    private String name;
    private AlertCondition condition;
    private AlertLevel level;
    private String messageTemplate;
    private boolean enabled;
    private long cooldownPeriod; // 冷却时间(毫秒)
    private long lastTriggerTime; // 最后触发时间
    
    public AlertRule(String ruleId, String name, AlertCondition condition, 
                    AlertLevel level, String messageTemplate) {
        this.ruleId = ruleId;
        this.name = name;
        this.condition = condition;
        this.level = level;
        this.messageTemplate = messageTemplate;
        this.enabled = true;
        this.cooldownPeriod = 300000; // 默认5分钟冷却时间
    }
    
    // 检查是否应该触发告警
    public boolean shouldTrigger(SystemMetrics metrics) {
        if (!enabled) {
            return false;
        }
        
        // 检查冷却时间
        long now = System.currentTimeMillis();
        if (now - lastTriggerTime < cooldownPeriod) {
            return false;
        }
        
        // 检查条件
        if (condition.evaluate(metrics)) {
            lastTriggerTime = now;
            return true;
        }
        
        return false;
    }
    
    // Getters and Setters
    public String getRuleId() { return ruleId; }
    public String getName() { return name; }
    public AlertCondition getCondition() { return condition; }
    public AlertLevel getLevel() { return level; }
    public String getMessageTemplate() { return messageTemplate; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public long getCooldownPeriod() { return cooldownPeriod; }
    public void setCooldownPeriod(long cooldownPeriod) { this.cooldownPeriod = cooldownPeriod; }
}

// 告警条件接口
interface AlertCondition {
    boolean evaluate(SystemMetrics metrics);
}

// 系统指标
class SystemMetrics {
    private int totalTasks;
    private int runningTasks;
    private int failedTasks;
    private long totalExecutions;
    private long failedExecutions;
    private double cpuUsage;
    private long memoryUsage;
    
    // Getters and Setters
    public int getTotalTasks() { return totalTasks; }
    public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
    
    public int getRunningTasks() { return runningTasks; }
    public void setRunningTasks(int runningTasks) { this.runningTasks = runningTasks; }
    
    public int getFailedTasks() { return failedTasks; }
    public void setFailedTasks(int failedTasks) { this.failedTasks = failedTasks; }
    
    public long getTotalExecutions() { return totalExecutions; }
    public void setTotalExecutions(long totalExecutions) { this.totalExecutions = totalExecutions; }
    
    public long getFailedExecutions() { return failedExecutions; }
    public void setFailedExecutions(long failedExecutions) { this.failedExecutions = failedExecutions; }
    
    public double getCpuUsage() { return cpuUsage; }
    public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
    
    public long getMemoryUsage() { return memoryUsage; }
    public void setMemoryUsage(long memoryUsage) { this.memoryUsage = memoryUsage; }
}

// 告警规则管理器
public class AlertRuleManager {
    private final List<AlertRule> rules = new ArrayList<>();
    private final AlertService alertService;
    
    public AlertRuleManager(AlertService alertService) {
        this.alertService = alertService;
        initializeDefaultRules();
    }
    
    // 初始化默认告警规则
    private void initializeDefaultRules() {
        // 任务失败率过高告警
        AlertRule failureRateRule = new AlertRule(
            "TASK_FAILURE_RATE_HIGH",
            "任务失败率过高",
            metrics -> {
                if (metrics.getTotalExecutions() == 0) return false;
                double failureRate = (double) metrics.getFailedExecutions() / metrics.getTotalExecutions();
                return failureRate > 0.1; // 失败率超过10%
            },
            AlertLevel.ERROR,
            "任务失败率过高: {failureRate}%"
        );
        rules.add(failureRateRule);
        
        // 失败任务过多告警
        AlertRule failedTasksRule = new AlertRule(
            "FAILED_TASKS_TOO_MANY",
            "失败任务过多",
            metrics -> metrics.getFailedTasks() > 10,
            AlertLevel.WARNING,
            "失败任务数量过多: {failedTasks}个"
        );
        rules.add(failedTasksRule);
        
        // CPU使用率过高告警
        AlertRule cpuUsageRule = new AlertRule(
            "CPU_USAGE_HIGH",
            "CPU使用率过高",
            metrics -> metrics.getCpuUsage() > 0.8,
            AlertLevel.WARNING,
            "CPU使用率过高: {cpuUsage}%"
        );
        rules.add(cpuUsageRule);
    }
    
    // 检查并触发告警
    public void checkAndTriggerAlerts(SystemMetrics metrics) {
        for (AlertRule rule : rules) {
            if (rule.shouldTrigger(metrics)) {
                String message = formatMessage(rule.getMessageTemplate(), metrics);
                alertService.sendAlert(rule.getLevel(), rule.getName(), message);
            }
        }
    }
    
    // 格式化消息
    private String formatMessage(String template, SystemMetrics metrics) {
        String message = template;
        message = message.replace("{failureRate}", 
            String.valueOf(metrics.getTotalExecutions() > 0 ? 
                (double) metrics.getFailedExecutions() / metrics.getTotalExecutions() * 100 : 0));
        message = message.replace("{failedTasks}", String.valueOf(metrics.getFailedTasks()));
        message = message.replace("{cpuUsage}", String.valueOf(metrics.getCpuUsage() * 100));
        return message;
    }
    
    // 添加告警规则
    public void addRule(AlertRule rule) {
        rules.add(rule);
    }
    
    // 移除告警规则
    public void removeRule(String ruleId) {
        rules.removeIf(rule -> rule.getRuleId().equals(ruleId));
    }
    
    // 获取所有告警规则
    public List<AlertRule> getAllRules() {
        return new ArrayList<>(rules);
    }
}
```

## 总结

通过本文的实现，我们为单机定时任务调度器添加了完善的监控和管理功能，包括：

1. **REST API 接口**：提供了完整的任务管理和监控接口
2. **Web 管理界面**：实现了可视化的任务管理界面
3. **系统监控**：能够实时监控系统状态、任务统计和性能指标
4. **日志记录**：详细记录任务执行日志和系统事件
5. **告警机制**：实现了基于规则的告警系统

这些功能使得我们的调度器具备了生产环境所需的监控和管理能力。在实际应用中，还可以进一步扩展功能，如：

- 集成 Prometheus 等监控系统
- 实现更复杂的告警通知方式（邮件、短信、微信等）
- 添加用户权限管理
- 提供任务执行历史查询和分析功能
- 实现任务执行结果的持久化存储

在下一节中，我们将基于现有的单机调度器，开始构建分布式调度系统的原型，引入数据库存储、分布式锁等关键技术。