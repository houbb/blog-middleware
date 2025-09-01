---
title: 2.3 单次执行、周期执行、依赖执行
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，根据任务的执行模式和触发条件，可以将任务分为单次执行、周期执行和依赖执行三种主要类型。每种执行模式都有其特定的应用场景和实现方式。本文将深入探讨这三种执行模式的特点、实现机制以及在实际应用中的最佳实践。

## 单次执行任务（One-time Execution）

单次执行任务是指只在指定时间点执行一次的任务，执行完成后任务生命周期结束。这类任务通常用于一次性操作，如系统初始化、数据迁移、临时修复等。

### 单次执行任务的特点

1. **执行一次**：任务只执行一次，不会重复触发
2. **明确时间**：有明确的执行时间点
3. **状态终结**：执行完成后任务状态变为终结状态
4. **资源释放**：执行完成后可以释放相关资源

### 单次执行任务的实现

```java
// 单次执行任务实体
public class OneTimeTask extends Task {
    private long executionTime;
    private boolean executed = false;
    
    public OneTimeTask(String taskId, String name, String handler, long executionTime) {
        super(taskId, name, handler);
        this.executionTime = executionTime;
        this.setType(TaskType.ONE_TIME);
    }
    
    // 检查是否应该执行
    public boolean shouldExecute(long currentTime) {
        return !executed && currentTime >= executionTime;
    }
    
    // 执行任务
    @Override
    public TaskExecutionResult execute(TaskExecutionContext context) throws TaskExecutionException {
        if (executed) {
            throw new TaskExecutionException("任务已执行，不能重复执行");
        }
        
        try {
            // 执行任务逻辑
            TaskExecutionResult result = super.execute(context);
            
            // 标记为已执行
            executed = true;
            
            // 更新任务状态
            setStatus(TaskStatus.COMPLETED);
            setLastUpdateTime(System.currentTimeMillis());
            
            return result;
        } catch (Exception e) {
            setStatus(TaskStatus.FAILED);
            setLastUpdateTime(System.currentTimeMillis());
            throw new TaskExecutionException("任务执行失败", e);
        }
    }
    
    // Getters and Setters
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    public boolean isExecuted() { return executed; }
}

// 单次任务调度器
public class OneTimeTaskScheduler {
    private final TaskStore taskStore;
    private final ExecutorService executorService;
    private final ScheduledExecutorService schedulerService;
    private volatile boolean running = false;
    
    public OneTimeTaskScheduler(TaskStore taskStore) {
        this.taskStore = taskStore;
        this.executorService = Executors.newFixedThreadPool(10);
        this.schedulerService = Executors.newScheduledThreadPool(2);
    }
    
    // 启动调度器
    public void start() {
        if (running) {
            throw new IllegalStateException("调度器已在运行");
        }
        
        running = true;
        
        // 启动任务扫描器
        schedulerService.scheduleAtFixedRate(this::scanAndExecuteTasks, 0, 1, TimeUnit.SECONDS);
        
        System.out.println("单次任务调度器已启动");
    }
    
    // 停止调度器
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        
        // 关闭线程池
        schedulerService.shutdown();
        executorService.shutdown();
        
        try {
            if (!schedulerService.awaitTermination(5, TimeUnit.SECONDS)) {
                schedulerService.shutdownNow();
            }
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            schedulerService.shutdownNow();
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("单次任务调度器已停止");
    }
    
    // 注册单次任务
    public void registerOneTimeTask(OneTimeTask task) {
        if (!running) {
            throw new IllegalStateException("调度器未运行");
        }
        
        // 保存任务
        taskStore.saveTask(task);
        
        System.out.println("单次任务已注册: " + task.getName() + ", 执行时间: " + new Date(task.getExecutionTime()));
    }
    
    // 扫描并执行到期任务
    private void scanAndExecuteTasks() {
        if (!running) {
            return;
        }
        
        try {
            long currentTime = System.currentTimeMillis();
            
            // 获取所有未执行的单次任务
            List<OneTimeTask> pendingTasks = taskStore.getPendingOneTimeTasks();
            
            for (OneTimeTask task : pendingTasks) {
                if (task.shouldExecute(currentTime)) {
                    // 异步执行任务
                    executorService.submit(() -> executeTask(task));
                }
            }
        } catch (Exception e) {
            System.err.println("扫描单次任务时出错: " + e.getMessage());
        }
    }
    
    // 执行任务
    private void executeTask(OneTimeTask task) {
        try {
            System.out.println("开始执行单次任务: " + task.getName());
            
            // 创建执行上下文
            TaskExecutionContext context = new TaskExecutionContext(task, "one-time-executor");
            
            // 执行任务
            TaskExecutionResult result = task.execute(context);
            
            // 更新任务存储
            taskStore.updateTask(task);
            
            System.out.println("单次任务执行完成: " + task.getName() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
        } catch (Exception e) {
            System.err.println("执行单次任务失败: " + task.getName() + ", 错误: " + e.getMessage());
            task.setStatus(TaskStatus.FAILED);
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
        }
    }
}

// 任务存储扩展接口
interface ExtendedTaskStore extends TaskStore {
    // 获取所有未执行的单次任务
    List<OneTimeTask> getPendingOneTimeTasks();
    
    // 获取指定时间范围内的单次任务
    List<OneTimeTask> getOneTimeTasksByTimeRange(long startTime, long endTime);
}
```

### 单次执行任务的应用场景

```java
// 单次执行任务应用场景示例
public class OneTimeTaskExamples {
    
    // 系统初始化任务
    public static OneTimeTask createSystemInitializationTask() {
        OneTimeTask task = new OneTimeTask(
            "init-001",
            "系统初始化任务",
            "SystemInitializationHandler",
            System.currentTimeMillis() + 30000 // 30秒后执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("configPath", "/etc/system/config.properties");
        params.put("logLevel", "INFO");
        task.setParameters(params);
        
        return task;
    }
    
    // 数据迁移任务
    public static OneTimeTask createDataMigrationTask() {
        OneTimeTask task = new OneTimeTask(
            "migrate-001",
            "数据迁移任务",
            "DataMigrationHandler",
            System.currentTimeMillis() + 60000 // 1分钟后执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("sourceDb", "old_database");
        params.put("targetDb", "new_database");
        params.put("batchSize", 1000);
        task.setParameters(params);
        
        return task;
    }
    
    // 临时修复任务
    public static OneTimeTask createHotfixTask() {
        OneTimeTask task = new OneTimeTask(
            "hotfix-001",
            "紧急修复任务",
            "HotfixHandler",
            System.currentTimeMillis() + 120000 // 2分钟后执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("fixVersion", "1.2.3-hotfix");
        params.put("targetServers", Arrays.asList("server-01", "server-02"));
        task.setParameters(params);
        
        return task;
    }
    
    // 业务活动启动任务
    public static OneTimeTask createCampaignStartTask() {
        // 在特定时间启动营销活动
        Calendar calendar = Calendar.getInstance();
        calendar.set(2025, Calendar.SEPTEMBER, 1, 0, 0, 0); // 2025年9月1日0点
        
        OneTimeTask task = new OneTimeTask(
            "campaign-001",
            "双11活动启动任务",
            "CampaignStartHandler",
            calendar.getTimeInMillis()
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("campaignId", "1111-sale");
        params.put("discountRate", 0.8);
        task.setParameters(params);
        
        return task;
    }
}
```

## 周期执行任务（Periodic Execution）

周期执行任务是指按照预设的时间规则重复执行的任务。这是最常见的任务类型，如定时数据备份、定期报表生成、健康检查等。

### 周期执行任务的特点

1. **重复执行**：按照固定的时间间隔或规则重复执行
2. **时间规则**：基于 Cron 表达式或其他时间规则
3. **状态持续**：任务状态持续存在，可以暂停、恢复
4. **并发控制**：需要处理同一任务的并发执行问题

### 周期执行任务的实现

```java
// 周期执行任务实体
public class PeriodicTask extends Task {
    private CronExpression cronExpression;
    private long lastExecutionTime = 0;
    private long nextExecutionTime = 0;
    private boolean paused = false;
    private int maxConcurrentExecutions = 1;
    private AtomicInteger currentExecutions = new AtomicInteger(0);
    
    public PeriodicTask(String taskId, String name, String handler, String cronExpression) 
            throws ParseException {
        super(taskId, name, handler);
        this.cronExpression = CronExpressionParser.parse(cronExpression);
        this.setType(TaskType.PERIODIC);
        calculateNextExecutionTime();
    }
    
    // 计算下次执行时间
    public void calculateNextExecutionTime() {
        if (cronExpression != null) {
            nextExecutionTime = cronExpression.getNextValidTimeAfter(
                Math.max(lastExecutionTime, System.currentTimeMillis()));
        }
    }
    
    // 检查是否应该执行
    public boolean shouldExecute(long currentTime) {
        if (paused || isDisabled()) {
            return false;
        }
        
        // 检查并发执行限制
        if (currentExecutions.get() >= maxConcurrentExecutions) {
            return false;
        }
        
        return currentTime >= nextExecutionTime;
    }
    
    // 开始执行
    public boolean beginExecution() {
        return currentExecutions.incrementAndGet() <= maxConcurrentExecutions;
    }
    
    // 结束执行
    public void endExecution() {
        currentExecutions.decrementAndGet();
        lastExecutionTime = System.currentTimeMillis();
        calculateNextExecutionTime();
    }
    
    // 执行任务
    @Override
    public TaskExecutionResult execute(TaskExecutionContext context) throws TaskExecutionException {
        if (!beginExecution()) {
            throw new TaskExecutionException("超过最大并发执行数限制");
        }
        
        try {
            System.out.println("开始执行周期任务: " + getName());
            
            // 执行任务逻辑
            TaskExecutionResult result = super.execute(context);
            
            // 更新任务状态
            setStatus(TaskStatus.RUNNING);
            setLastUpdateTime(System.currentTimeMillis());
            
            return result;
        } catch (Exception e) {
            setStatus(TaskStatus.FAILED);
            setLastUpdateTime(System.currentTimeMillis());
            throw new TaskExecutionException("周期任务执行失败", e);
        } finally {
            endExecution();
        }
    }
    
    // 暂停任务
    public void pause() {
        this.paused = true;
        setStatus(TaskStatus.PAUSED);
        setLastUpdateTime(System.currentTimeMillis());
    }
    
    // 恢复任务
    public void resume() {
        this.paused = false;
        setStatus(TaskStatus.READY);
        setLastUpdateTime(System.currentTimeMillis());
    }
    
    // Getters and Setters
    public CronExpression getCronExpression() { return cronExpression; }
    public void setCronExpression(CronExpression cronExpression) { this.cronExpression = cronExpression; }
    public long getLastExecutionTime() { return lastExecutionTime; }
    public long getNextExecutionTime() { return nextExecutionTime; }
    public boolean isPaused() { return paused; }
    public int getMaxConcurrentExecutions() { return maxConcurrentExecutions; }
    public void setMaxConcurrentExecutions(int maxConcurrentExecutions) { 
        this.maxConcurrentExecutions = maxConcurrentExecutions; 
    }
    public int getCurrentExecutions() { return currentExecutions.get(); }
}

// 周期任务调度器
public class PeriodicTaskScheduler {
    private final TaskStore taskStore;
    private final ExecutorService taskExecutorService;
    private final ScheduledExecutorService schedulerService;
    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    private volatile boolean running = false;
    
    public PeriodicTaskScheduler(TaskStore taskStore) {
        this.taskStore = taskStore;
        this.taskExecutorService = Executors.newFixedThreadPool(20);
        this.schedulerService = Executors.newScheduledThreadPool(5);
    }
    
    // 启动调度器
    public void start() {
        if (running) {
            throw new IllegalStateException("调度器已在运行");
        }
        
        running = true;
        
        // 启动任务扫描器
        schedulerService.scheduleAtFixedRate(this::scanAndScheduleTasks, 0, 10, TimeUnit.SECONDS);
        
        System.out.println("周期任务调度器已启动");
    }
    
    // 停止调度器
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        
        // 取消所有已调度的任务
        for (ScheduledFuture<?> future : scheduledTasks.values()) {
            future.cancel(false);
        }
        scheduledTasks.clear();
        
        // 关闭线程池
        schedulerService.shutdown();
        taskExecutorService.shutdown();
        
        try {
            if (!schedulerService.awaitTermination(5, TimeUnit.SECONDS)) {
                schedulerService.shutdownNow();
            }
            if (!taskExecutorService.awaitTermination(5, TimeUnit.SECONDS)) {
                taskExecutorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            schedulerService.shutdownNow();
            taskExecutorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("周期任务调度器已停止");
    }
    
    // 注册周期任务
    public void registerPeriodicTask(PeriodicTask task) {
        if (!running) {
            throw new IllegalStateException("调度器未运行");
        }
        
        // 保存任务
        taskStore.saveTask(task);
        
        // 立即调度任务
        scheduleTask(task);
        
        System.out.println("周期任务已注册: " + task.getName() + 
                         ", Cron表达式: " + task.getCronExpression());
    }
    
    // 取消周期任务
    public void cancelPeriodicTask(String taskId) {
        // 从存储中删除任务
        taskStore.deleteTask(taskId);
        
        // 取消已调度的任务
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
        
        System.out.println("周期任务已取消: " + taskId);
    }
    
    // 暂停任务
    public void pauseTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task instanceof PeriodicTask) {
            ((PeriodicTask) task).pause();
            taskStore.updateTask(task);
            
            // 取消已调度的任务
            ScheduledFuture<?> future = scheduledTasks.remove(taskId);
            if (future != null) {
                future.cancel(false);
            }
            
            System.out.println("周期任务已暂停: " + taskId);
        }
    }
    
    // 恢复任务
    public void resumeTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task instanceof PeriodicTask) {
            ((PeriodicTask) task).resume();
            taskStore.updateTask(task);
            
            // 重新调度任务
            scheduleTask((PeriodicTask) task);
            
            System.out.println("周期任务已恢复: " + taskId);
        }
    }
    
    // 扫描并调度到期任务
    private void scanAndScheduleTasks() {
        if (!running) {
            return;
        }
        
        try {
            long currentTime = System.currentTimeMillis();
            
            // 获取所有周期任务
            List<PeriodicTask> periodicTasks = taskStore.getAllPeriodicTasks();
            
            for (PeriodicTask task : periodicTasks) {
                if (task.shouldExecute(currentTime)) {
                    // 异步执行任务
                    taskExecutorService.submit(() -> executeTask(task));
                }
            }
        } catch (Exception e) {
            System.err.println("扫描周期任务时出错: " + e.getMessage());
        }
    }
    
    // 调度任务
    private void scheduleTask(PeriodicTask task) {
        long nextExecutionTime = task.getNextExecutionTime();
        if (nextExecutionTime <= 0) {
            return;
        }
        
        long delay = nextExecutionTime - System.currentTimeMillis();
        if (delay <= 0) {
            // 立即执行
            taskExecutorService.submit(() -> executeTask(task));
        } else {
            // 延迟执行
            ScheduledFuture<?> future = schedulerService.schedule(() -> {
                taskExecutorService.submit(() -> executeTask(task));
                // 重新调度任务
                scheduleTask(task);
            }, delay, TimeUnit.MILLISECONDS);
            
            scheduledTasks.put(task.getTaskId(), future);
        }
    }
    
    // 执行任务
    private void executeTask(PeriodicTask task) {
        try {
            System.out.println("开始执行周期任务: " + task.getName());
            
            // 创建执行上下文
            TaskExecutionContext context = new TaskExecutionContext(task, "periodic-executor");
            
            // 执行任务
            TaskExecutionResult result = task.execute(context);
            
            // 更新任务存储
            taskStore.updateTask(task);
            
            System.out.println("周期任务执行完成: " + task.getName() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
        } catch (Exception e) {
            System.err.println("执行周期任务失败: " + task.getName() + ", 错误: " + e.getMessage());
            task.setStatus(TaskStatus.FAILED);
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
        }
    }
}

// 扩展任务存储接口
interface ExtendedTaskStore2 extends TaskStore {
    // 获取所有周期任务
    List<PeriodicTask> getAllPeriodicTasks();
    
    // 获取活跃的周期任务
    List<PeriodicTask> getActivePeriodicTasks();
}
```

### 周期执行任务的应用场景

```java
// 周期执行任务应用场景示例
public class PeriodicTaskExamples {
    
    // 数据备份任务
    public static PeriodicTask createDataBackupTask() throws ParseException {
        PeriodicTask task = new PeriodicTask(
            "backup-001",
            "每日数据备份任务",
            "DataBackupHandler",
            "0 0 2 * * ?" // 每天凌晨2点执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("sourcePath", "/data/production");
        params.put("backupPath", "/backup/daily");
        params.put("retentionDays", 30);
        task.setParameters(params);
        
        return task;
    }
    
    // 健康检查任务
    public static PeriodicTask createHealthCheckTask() throws ParseException {
        PeriodicTask task = new PeriodicTask(
            "health-001",
            "系统健康检查任务",
            "HealthCheckHandler",
            "0 */5 * * * ?" // 每5分钟执行一次
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("checkItems", Arrays.asList("database", "cache", "network"));
        params.put("alertThreshold", 3);
        task.setParameters(params);
        
        // 允许并发执行
        task.setMaxConcurrentExecutions(3);
        
        return task;
    }
    
    // 报表生成任务
    public static PeriodicTask createReportGenerationTask() throws ParseException {
        PeriodicTask task = new PeriodicTask(
            "report-001",
            "月度报表生成任务",
            "ReportGenerationHandler",
            "0 0 1 1 * ?" // 每月1号凌晨1点执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("reportType", "monthly");
        params.put("recipients", Arrays.asList("manager@company.com", "director@company.com"));
        task.setParameters(params);
        
        return task;
    }
    
    // 日志清理任务
    public static PeriodicTask createLogCleanupTask() throws ParseException {
        PeriodicTask task = new PeriodicTask(
            "cleanup-001",
            "日志清理任务",
            "LogCleanupHandler",
            "0 0 3 * * ?" // 每天凌晨3点执行
        );
        
        Map<String, Object> params = new HashMap<>();
        params.put("logPath", "/var/log/application");
        params.put("retentionDays", 7);
        task.setParameters(params);
        
        return task;
    }
}
```

## 依赖执行任务（Dependency Execution）

依赖执行任务的执行依赖于其他任务的完成状态。只有当依赖的任务成功执行后，当前任务才会被触发执行。这种模式常用于构建复杂的工作流。

### 依赖执行任务的特点

1. **依赖关系**：任务执行依赖于其他任务的完成状态
2. **触发机制**：通过事件驱动触发执行
3. **状态传播**：前置任务的状态影响后续任务的执行
4. **复杂编排**：支持复杂的任务依赖关系图

### 依赖执行任务的实现

```java
// 依赖执行任务实体
public class DependencyTask extends Task {
    private Set<String> dependencies; // 依赖的任务ID列表
    private DependencyStrategy dependencyStrategy; // 依赖策略
    private boolean triggered = false;
    
    public DependencyTask(String taskId, String name, String handler) {
        super(taskId, name, handler);
        this.dependencies = new HashSet<>();
        this.dependencyStrategy = DependencyStrategy.ALL_SUCCESS;
        this.setType(TaskType.DEPENDENCY);
    }
    
    // 添加依赖
    public void addDependency(String dependencyTaskId) {
        dependencies.add(dependencyTaskId);
    }
    
    // 移除依赖
    public void removeDependency(String dependencyTaskId) {
        dependencies.remove(dependencyTaskId);
    }
    
    // 检查是否满足执行条件
    public boolean canExecute(Map<String, Task> completedTasks) {
        if (triggered || isDisabled()) {
            return false;
        }
        
        if (dependencies.isEmpty()) {
            return true; // 没有依赖，可以直接执行
        }
        
        switch (dependencyStrategy) {
            case ALL_SUCCESS:
                return checkAllDependenciesSuccess(completedTasks);
            case ANY_SUCCESS:
                return checkAnyDependencySuccess(completedTasks);
            case ALL_COMPLETED:
                return checkAllDependenciesCompleted(completedTasks);
            default:
                return false;
        }
    }
    
    // 检查所有依赖任务是否都成功完成
    private boolean checkAllDependenciesSuccess(Map<String, Task> completedTasks) {
        for (String dependencyId : dependencies) {
            Task dependencyTask = completedTasks.get(dependencyId);
            if (dependencyTask == null || 
                dependencyTask.getStatus() != TaskStatus.SUCCESS) {
                return false;
            }
        }
        return true;
    }
    
    // 检查是否有任一依赖任务成功完成
    private boolean checkAnyDependencySuccess(Map<String, Task> completedTasks) {
        for (String dependencyId : dependencies) {
            Task dependencyTask = completedTasks.get(dependencyId);
            if (dependencyTask != null && 
                dependencyTask.getStatus() == TaskStatus.SUCCESS) {
                return true;
            }
        }
        return false;
    }
    
    // 检查所有依赖任务是否都已完成（无论成功或失败）
    private boolean checkAllDependenciesCompleted(Map<String, Task> completedTasks) {
        for (String dependencyId : dependencies) {
            Task dependencyTask = completedTasks.get(dependencyId);
            if (dependencyTask == null || 
                (dependencyTask.getStatus() != TaskStatus.SUCCESS && 
                 dependencyTask.getStatus() != TaskStatus.FAILED)) {
                return false;
            }
        }
        return true;
    }
    
    // 触发执行
    public void trigger() {
        this.triggered = true;
        setStatus(TaskStatus.TRIGGERED);
        setLastUpdateTime(System.currentTimeMillis());
    }
    
    // 执行任务
    @Override
    public TaskExecutionResult execute(TaskExecutionContext context) throws TaskExecutionException {
        if (!triggered) {
            throw new TaskExecutionException("任务未被触发，不能执行");
        }
        
        try {
            System.out.println("开始执行依赖任务: " + getName());
            
            // 执行任务逻辑
            TaskExecutionResult result = super.execute(context);
            
            // 更新任务状态
            setStatus(TaskStatus.SUCCESS);
            setLastUpdateTime(System.currentTimeMillis());
            
            // 发布任务完成事件
            publishTaskCompletedEvent();
            
            return result;
        } catch (Exception e) {
            setStatus(TaskStatus.FAILED);
            setLastUpdateTime(System.currentTimeMillis());
            
            // 发布任务失败事件
            publishTaskFailedEvent(e);
            
            throw new TaskExecutionException("依赖任务执行失败", e);
        }
    }
    
    // 发布任务完成事件
    private void publishTaskCompletedEvent() {
        TaskEvent event = new TaskEvent(TaskEventType.TASK_COMPLETED, this);
        EventPublisher.publish(event);
    }
    
    // 发布任务失败事件
    private void publishTaskFailedEvent(Exception error) {
        TaskEvent event = new TaskEvent(TaskEventType.TASK_FAILED, this);
        event.setError(error);
        EventPublisher.publish(event);
    }
    
    // Getters and Setters
    public Set<String> getDependencies() { return new HashSet<>(dependencies); }
    public void setDependencies(Set<String> dependencies) { this.dependencies = new HashSet<>(dependencies); }
    public DependencyStrategy getDependencyStrategy() { return dependencyStrategy; }
    public void setDependencyStrategy(DependencyStrategy dependencyStrategy) { this.dependencyStrategy = dependencyStrategy; }
    public boolean isTriggered() { return triggered; }
}

// 依赖策略枚举
enum DependencyStrategy {
    ALL_SUCCESS,   // 所有依赖任务都成功
    ANY_SUCCESS,   // 任一依赖任务成功
    ALL_COMPLETED  // 所有依赖任务都完成（无论成功或失败）
}

// 任务事件
class TaskEvent {
    private TaskEventType eventType;
    private Task task;
    private Exception error;
    private long timestamp;
    
    public TaskEvent(TaskEventType eventType, Task task) {
        this.eventType = eventType;
        this.task = task;
        this.timestamp = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public TaskEventType getEventType() { return eventType; }
    public Task getTask() { return task; }
    public Exception getError() { return error; }
    public void setError(Exception error) { this.error = error; }
    public long getTimestamp() { return timestamp; }
}

// 任务事件类型
enum TaskEventType {
    TASK_COMPLETED,
    TASK_FAILED,
    TASK_STARTED
}

// 事件发布器
class EventPublisher {
    private static final List<TaskEventListener> listeners = new CopyOnWriteArrayList<>();
    
    // 注册监听器
    public static void addListener(TaskEventListener listener) {
        listeners.add(listener);
    }
    
    // 移除监听器
    public static void removeListener(TaskEventListener listener) {
        listeners.remove(listener);
    }
    
    // 发布事件
    public static void publish(TaskEvent event) {
        for (TaskEventListener listener : listeners) {
            try {
                listener.onTaskEvent(event);
            } catch (Exception e) {
                System.err.println("处理任务事件时出错: " + e.getMessage());
            }
        }
    }
}

// 任务事件监听器接口
interface TaskEventListener {
    void onTaskEvent(TaskEvent event);
}
```

### 依赖任务调度器

```java
// 依赖任务调度器
public class DependencyTaskScheduler {
    private final TaskStore taskStore;
    private final ExecutorService taskExecutorService;
    private final Map<String, Task> completedTasks = new ConcurrentHashMap<>();
    private volatile boolean running = false;
    
    public DependencyTaskScheduler(TaskStore taskStore) {
        this.taskStore = taskStore;
        this.taskExecutorService = Executors.newFixedThreadPool(15);
        
        // 注册事件监听器
        EventPublisher.addListener(new DependencyTaskEventListener());
    }
    
    // 启动调度器
    public void start() {
        if (running) {
            throw new IllegalStateException("调度器已在运行");
        }
        
        running = true;
        
        System.out.println("依赖任务调度器已启动");
    }
    
    // 停止调度器
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        
        // 关闭线程池
        taskExecutorService.shutdown();
        
        try {
            if (!taskExecutorService.awaitTermination(5, TimeUnit.SECONDS)) {
                taskExecutorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            taskExecutorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("依赖任务调度器已停止");
    }
    
    // 注册依赖任务
    public void registerDependencyTask(DependencyTask task) {
        if (!running) {
            throw new IllegalStateException("调度器未运行");
        }
        
        // 保存任务
        taskStore.saveTask(task);
        
        System.out.println("依赖任务已注册: " + task.getName() + 
                         ", 依赖数: " + task.getDependencies().size());
    }
    
    // 任务事件监听器实现
    private class DependencyTaskEventListener implements TaskEventListener {
        @Override
        public void onTaskEvent(TaskEvent event) {
            if (!running) {
                return;
            }
            
            Task task = event.getTask();
            
            // 将完成的任务添加到已完成任务列表
            if (event.getEventType() == TaskEventType.TASK_COMPLETED || 
                event.getEventType() == TaskEventType.TASK_FAILED) {
                completedTasks.put(task.getTaskId(), task);
                
                // 检查是否有依赖任务可以触发执行
                checkAndTriggerDependentTasks();
            }
        }
    }
    
    // 检查并触发依赖任务
    private void checkAndTriggerDependentTasks() {
        try {
            // 获取所有依赖任务
            List<DependencyTask> dependencyTasks = taskStore.getAllDependencyTasks();
            
            for (DependencyTask task : dependencyTasks) {
                if (task.canExecute(completedTasks)) {
                    // 触发任务执行
                    task.trigger();
                    taskStore.updateTask(task);
                    
                    // 异步执行任务
                    taskExecutorService.submit(() -> executeTask(task));
                }
            }
        } catch (Exception e) {
            System.err.println("检查依赖任务时出错: " + e.getMessage());
        }
    }
    
    // 执行任务
    private void executeTask(DependencyTask task) {
        try {
            System.out.println("开始执行依赖任务: " + task.getName());
            
            // 创建执行上下文
            TaskExecutionContext context = new TaskExecutionContext(task, "dependency-executor");
            
            // 执行任务
            TaskExecutionResult result = task.execute(context);
            
            // 更新任务存储
            taskStore.updateTask(task);
            
            System.out.println("依赖任务执行完成: " + task.getName() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
        } catch (Exception e) {
            System.err.println("执行依赖任务失败: " + task.getName() + ", 错误: " + e.getMessage());
            task.setStatus(TaskStatus.FAILED);
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
        }
    }
}

// 扩展任务存储接口
interface ExtendedTaskStore3 extends TaskStore {
    // 获取所有依赖任务
    List<DependencyTask> getAllDependencyTasks();
    
    // 根据依赖任务ID获取任务
    List<DependencyTask> getTasksByDependency(String dependencyTaskId);
}
```

### 依赖执行任务的应用场景

```java
// 依赖执行任务应用场景示例
public class DependencyTaskExamples {
    
    // 数据处理工作流
    public static List<DependencyTask> createDataProcessingWorkflow() {
        List<DependencyTask> tasks = new ArrayList<>();
        
        // 步骤1：数据提取
        DependencyTask extractTask = new DependencyTask(
            "extract-001",
            "数据提取任务",
            "DataExtractHandler"
        );
        
        Map<String, Object> extractParams = new HashMap<>();
        extractParams.put("source", "database");
        extractParams.put("query", "SELECT * FROM orders WHERE date = today");
        extractTask.setParameters(extractParams);
        
        tasks.add(extractTask);
        
        // 步骤2：数据转换（依赖数据提取）
        DependencyTask transformTask = new DependencyTask(
            "transform-001",
            "数据转换任务",
            "DataTransformHandler"
        );
        
        transformTask.addDependency("extract-001");
        
        Map<String, Object> transformParams = new HashMap<>();
        transformParams.put("transformationRules", "normalize, filter, aggregate");
        transformTask.setParameters(transformParams);
        
        tasks.add(transformTask);
        
        // 步骤3：数据加载（依赖数据转换）
        DependencyTask loadTask = new DependencyTask(
            "load-001",
            "数据加载任务",
            "DataLoadHandler"
        );
        
        loadTask.addDependency("transform-001");
        
        Map<String, Object> loadParams = new HashMap<>();
        loadParams.put("target", "data_warehouse");
        loadParams.put("table", "processed_orders");
        loadTask.setParameters(loadParams);
        
        tasks.add(loadTask);
        
        // 步骤4：数据验证（依赖数据加载）
        DependencyTask validateTask = new DependencyTask(
            "validate-001",
            "数据验证任务",
            "DataValidationHandler"
        );
        
        validateTask.addDependency("load-001");
        
        Map<String, Object> validateParams = new HashMap<>();
        validateParams.put("validationRules", "count_check, integrity_check");
        validateTask.setParameters(validateParams);
        
        tasks.add(validateTask);
        
        return tasks;
    }
    
    // 并行处理工作流
    public static List<DependencyTask> createParallelProcessingWorkflow() {
        List<DependencyTask> tasks = new ArrayList<>();
        
        // 启动任务
        DependencyTask startTask = new DependencyTask(
            "start-001",
            "工作流启动任务",
            "WorkflowStartHandler"
        );
        
        tasks.add(startTask);
        
        // 并行任务1
        DependencyTask parallelTask1 = new DependencyTask(
            "parallel-001",
            "并行处理任务1",
            "ParallelHandler1"
        );
        
        parallelTask1.addDependency("start-001");
        parallelTask1.setDependencyStrategy(DependencyStrategy.ANY_SUCCESS);
        
        tasks.add(parallelTask1);
        
        // 并行任务2
        DependencyTask parallelTask2 = new DependencyTask(
            "parallel-002",
            "并行处理任务2",
            "ParallelHandler2"
        );
        
        parallelTask2.addDependency("start-001");
        parallelTask2.setDependencyStrategy(DependencyStrategy.ANY_SUCCESS);
        
        tasks.add(parallelTask2);
        
        // 并行任务3
        DependencyTask parallelTask3 = new DependencyTask(
            "parallel-003",
            "并行处理任务3",
            "ParallelHandler3"
        );
        
        parallelTask3.addDependency("start-001");
        parallelTask3.setDependencyStrategy(DependencyStrategy.ANY_SUCCESS);
        
        tasks.add(parallelTask3);
        
        // 汇总任务（等待所有并行任务完成）
        DependencyTask summaryTask = new DependencyTask(
            "summary-001",
            "结果汇总任务",
            "SummaryHandler"
        );
        
        summaryTask.addDependency("parallel-001");
        summaryTask.addDependency("parallel-002");
        summaryTask.addDependency("parallel-003");
        summaryTask.setDependencyStrategy(DependencyStrategy.ALL_COMPLETED);
        
        tasks.add(summaryTask);
        
        return tasks;
    }
    
    // 条件执行工作流
    public static List<DependencyTask> createConditionalWorkflow() {
        List<DependencyTask> tasks = new ArrayList<>();
        
        // 数据检查任务
        DependencyTask checkTask = new DependencyTask(
            "check-001",
            "数据检查任务",
            "DataCheckHandler"
        );
        
        tasks.add(checkTask);
        
        // 成功处理任务（仅在检查成功时执行）
        DependencyTask successTask = new DependencyTask(
            "success-001",
            "成功处理任务",
            "SuccessHandler"
        );
        
        successTask.addDependency("check-001");
        successTask.setDependencyStrategy(DependencyStrategy.ALL_SUCCESS);
        
        tasks.add(successTask);
        
        // 失败处理任务（仅在检查失败时执行）
        DependencyTask failureTask = new DependencyTask(
            "failure-001",
            "失败处理任务",
            "FailureHandler"
        );
        
        failureTask.addDependency("check-001");
        // 这里需要自定义逻辑来处理失败情况
        
        tasks.add(failureTask);
        
        return tasks;
    }
}
```

## 三种执行模式的对比与选择

### 执行模式对比表

| 特性 | 单次执行 | 周期执行 | 依赖执行 |
|------|----------|----------|----------|
| 执行次数 | 一次 | 多次 | 一次或多次 |
| 触发方式 | 时间触发 | 时间触发 | 事件触发 |
| 依赖关系 | 无 | 无 | 有 |
| 状态管理 | 简单 | 中等 | 复杂 |
| 资源占用 | 低 | 中等 | 高 |
| 实现复杂度 | 简单 | 中等 | 复杂 |
| 典型应用 | 初始化、迁移 | 备份、监控 | 工作流、ETL |

### 选择建议

1. **单次执行**：适用于一次性操作，如系统初始化、数据迁移、临时修复等场景
2. **周期执行**：适用于定期重复的任务，如数据备份、健康检查、报表生成等场景
3. **依赖执行**：适用于需要按顺序执行的复杂业务流程，如数据处理管道、业务工作流等场景

## 总结

单次执行、周期执行和依赖执行是分布式任务调度系统中的三种核心执行模式，每种模式都有其特定的应用场景和实现方式：

1. **单次执行任务**：适用于一次性操作，实现简单，资源占用少
2. **周期执行任务**：适用于定期重复的任务，需要处理并发控制和状态管理
3. **依赖执行任务**：适用于复杂的工作流场景，需要处理任务间的依赖关系和事件驱动

在实际应用中，我们需要根据具体的业务需求选择合适的执行模式，并结合使用以构建完整的任务调度解决方案。

在下一节中，我们将探讨任务状态与生命周期管理，深入了解如何有效跟踪和管理任务的执行状态。