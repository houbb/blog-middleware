---
title: 2.1 任务、调度器、执行器
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，任务、调度器和执行器是三个核心组件，它们协同工作以确保任务能够按时、准确地执行。理解这三个组件的概念、职责和交互方式，是设计和实现高效调度系统的基础。本文将深入探讨这三个核心组件的详细设计与实现。

## 任务（Task/Job）的设计与实现

任务是调度系统中的基本执行单元，它封装了需要执行的具体业务逻辑。一个设计良好的任务应该具备清晰的职责边界、可配置的参数和可追踪的执行状态。

### 任务的核心属性

```java
// 任务实体类设计
public class Task {
    // 任务唯一标识
    private String taskId;
    
    // 任务名称
    private String name;
    
    // 任务描述
    private String description;
    
    // 任务类型（定时任务、实时任务等）
    private TaskType type;
    
    // 任务执行逻辑（可以是类名、脚本路径等）
    private String handler;
    
    // 任务参数
    private Map<String, Object> parameters;
    
    // 调度策略
    private ScheduleStrategy scheduleStrategy;
    
    // 重试策略
    private RetryStrategy retryStrategy;
    
    // 超时设置
    private TimeoutConfig timeoutConfig;
    
    // 任务状态
    private TaskStatus status;
    
    // 创建时间
    private long createTime;
    
    // 最后更新时间
    private long lastUpdateTime;
    
    // 下次执行时间
    private long nextExecutionTime;
    
    // 执行历史记录
    private List<ExecutionRecord> executionHistory;
    
    // 构造函数
    public Task(String taskId, String name, String handler) {
        this.taskId = taskId;
        this.name = name;
        this.handler = handler;
        this.status = TaskStatus.PENDING;
        this.createTime = System.currentTimeMillis();
        this.lastUpdateTime = this.createTime;
        this.executionHistory = new ArrayList<>();
    }
    
    // Getters and Setters
    // ... 省略 getter/setter 方法
    
    // 任务执行方法
    public TaskExecutionResult execute(TaskExecutionContext context) {
        try {
            // 更新任务状态为执行中
            this.status = TaskStatus.RUNNING;
            this.lastUpdateTime = System.currentTimeMillis();
            
            // 记录执行开始时间
            long startTime = System.currentTimeMillis();
            
            // 获取任务处理器
            TaskHandler taskHandler = TaskHandlerFactory.getHandler(this.handler);
            
            // 执行任务
            TaskExecutionResult result = taskHandler.execute(context);
            
            // 记录执行结束时间
            long endTime = System.currentTimeMillis();
            
            // 创建执行记录
            ExecutionRecord record = new ExecutionRecord();
            record.setTaskId(this.taskId);
            record.setStartTime(startTime);
            record.setEndTime(endTime);
            record.setStatus(ExecutionStatus.SUCCESS);
            record.setResult(result);
            
            // 添加到执行历史
            this.executionHistory.add(record);
            
            // 更新任务状态
            this.status = TaskStatus.SUCCESS;
            this.lastUpdateTime = System.currentTimeMillis();
            
            return result;
        } catch (Exception e) {
            // 记录执行失败
            ExecutionRecord record = new ExecutionRecord();
            record.setTaskId(this.taskId);
            record.setStartTime(System.currentTimeMillis());
            record.setEndTime(System.currentTimeMillis());
            record.setStatus(ExecutionStatus.FAILED);
            record.setError(e.getMessage());
            
            this.executionHistory.add(record);
            this.status = TaskStatus.FAILED;
            this.lastUpdateTime = System.currentTimeMillis();
            
            throw new TaskExecutionException("任务执行失败: " + e.getMessage(), e);
        }
    }
}

// 任务类型枚举
enum TaskType {
    TIMED,      // 定时任务
    REALTIME,   // 实时任务
    DEPENDENT   // 依赖任务
}

// 任务状态枚举
enum TaskStatus {
    PENDING,    // 待调度
    SCHEDULED,  // 已调度
    RUNNING,    // 执行中
    SUCCESS,    // 执行成功
    FAILED,     // 执行失败
    CANCELLED   // 已取消
}
```

### 任务处理器接口设计

```java
// 任务处理器接口
public interface TaskHandler {
    /**
     * 执行任务
     * @param context 任务执行上下文
     * @return 任务执行结果
     * @throws TaskExecutionException 任务执行异常
     */
    TaskExecutionResult execute(TaskExecutionContext context) throws TaskExecutionException;
}

// 任务执行上下文
public class TaskExecutionContext {
    private Task task;
    private Map<String, Object> runtimeParameters;
    private String executorId;
    private long executionStartTime;
    
    // 构造函数
    public TaskExecutionContext(Task task, String executorId) {
        this.task = task;
        this.executorId = executorId;
        this.executionStartTime = System.currentTimeMillis();
        this.runtimeParameters = new HashMap<>();
    }
    
    // 添加运行时参数
    public void addRuntimeParameter(String key, Object value) {
        this.runtimeParameters.put(key, value);
    }
    
    // Getters
    public Task getTask() { return task; }
    public String getExecutorId() { return executorId; }
    public long getExecutionStartTime() { return executionStartTime; }
    public Map<String, Object> getRuntimeParameters() { return runtimeParameters; }
}

// 任务执行结果
public class TaskExecutionResult {
    private boolean success;
    private String message;
    private Object data;
    private long executionTime;
    
    public TaskExecutionResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    
    public TaskExecutionResult(boolean success, String message, Object data, long executionTime) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.executionTime = executionTime;
    }
    
    // Getters and Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
}
```

### 任务工厂模式实现

```java
// 任务处理器工厂
public class TaskHandlerFactory {
    private static final Map<String, TaskHandler> handlerCache = new ConcurrentHashMap<>();
    
    // 注册任务处理器
    public static void registerHandler(String handlerName, TaskHandler handler) {
        handlerCache.put(handlerName, handler);
    }
    
    // 获取任务处理器
    public static TaskHandler getHandler(String handlerName) {
        TaskHandler handler = handlerCache.get(handlerName);
        if (handler == null) {
            // 尝试通过反射创建处理器实例
            try {
                Class<?> handlerClass = Class.forName(handlerName);
                handler = (TaskHandler) handlerClass.newInstance();
                handlerCache.put(handlerName, handler);
            } catch (Exception e) {
                throw new TaskHandlerException("无法创建任务处理器: " + handlerName, e);
            }
        }
        return handler;
    }
    
    // 示例任务处理器实现
    public static class DataBackupTaskHandler implements TaskHandler {
        @Override
        public TaskExecutionResult execute(TaskExecutionContext context) throws TaskExecutionException {
            try {
                // 获取任务参数
                Task task = context.getTask();
                Map<String, Object> parameters = task.getParameters();
                
                String sourcePath = (String) parameters.get("sourcePath");
                String targetPath = (String) parameters.get("targetPath");
                
                // 执行数据备份逻辑
                long startTime = System.currentTimeMillis();
                backupData(sourcePath, targetPath);
                long endTime = System.currentTimeMillis();
                
                return new TaskExecutionResult(true, "数据备份成功", 
                    "备份文件路径: " + targetPath, endTime - startTime);
            } catch (Exception e) {
                throw new TaskExecutionException("数据备份失败", e);
            }
        }
        
        private void backupData(String sourcePath, String targetPath) throws IOException {
            // 实现数据备份逻辑
            // 这里简化处理，实际应用中可能涉及复杂的文件操作
            System.out.println("开始备份数据: " + sourcePath + " -> " + targetPath);
            Thread.sleep(2000); // 模拟备份过程
            System.out.println("数据备份完成");
        }
    }
    
    // 注册示例处理器
    static {
        registerHandler("DataBackupTaskHandler", new DataBackupTaskHandler());
    }
}
```

## 调度器（Scheduler）的设计与实现

调度器是任务调度系统的核心组件，负责根据预设的规则触发任务执行。一个高性能的调度器需要具备时间管理、任务分发、状态监控和故障处理等能力。

### 调度器核心架构

```java
// 调度器接口
public interface Scheduler {
    /**
     * 启动调度器
     */
    void start();
    
    /**
     * 停止调度器
     */
    void stop();
    
    /**
     * 注册任务
     * @param task 任务
     */
    void registerTask(Task task);
    
    /**
     * 取消任务
     * @param taskId 任务ID
     */
    void cancelTask(String taskId);
    
    /**
     * 触发任务执行
     * @param taskId 任务ID
     */
    void triggerTask(String taskId);
    
    /**
     * 获取调度器状态
     * @return 调度器状态
     */
    SchedulerStatus getStatus();
}

// 调度器状态枚举
enum SchedulerStatus {
    STOPPED,    // 已停止
    RUNNING,    // 运行中
    PAUSED      // 已暂停
}
```

### 高性能调度器实现

```java
// 高性能调度器实现
public class HighPerformanceScheduler implements Scheduler {
    private final ScheduledExecutorService schedulerService;
    private final ExecutorService taskExecutorService;
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final TaskDispatcher taskDispatcher;
    
    private volatile SchedulerStatus status = SchedulerStatus.STOPPED;
    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    
    public HighPerformanceScheduler(TaskStore taskStore, ExecutorRegistry executorRegistry) {
        // 创建调度线程池（用于时间管理）
        this.schedulerService = Executors.newScheduledThreadPool(2, 
            new ThreadFactory() {
                private final AtomicInteger counter = new AtomicInteger(0);
                @Override
                public Thread newThread(Runnable r) {
                    Thread thread = new Thread(r, "scheduler-thread-" + counter.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                }
            });
        
        // 创建任务执行线程池（用于任务分发）
        this.taskExecutorService = Executors.newFixedThreadPool(10,
            new ThreadFactory() {
                private final AtomicInteger counter = new AtomicInteger(0);
                @Override
                public Thread newThread(Runnable r) {
                    Thread thread = new Thread(r, "task-dispatcher-" + counter.incrementAndGet());
                    return thread;
                }
            });
        
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        this.taskDispatcher = new TaskDispatcher(taskStore, executorRegistry);
    }
    
    @Override
    public void start() {
        if (status != SchedulerStatus.STOPPED) {
            throw new IllegalStateException("调度器已在运行或暂停状态");
        }
        
        status = SchedulerStatus.RUNNING;
        
        // 启动任务扫描器，定期扫描待执行任务
        schedulerService.scheduleAtFixedRate(this::scanAndScheduleTasks, 0, 1, TimeUnit.SECONDS);
        
        // 启动任务分发器
        taskDispatcher.start();
        
        System.out.println("高性能调度器已启动");
    }
    
    @Override
    public void stop() {
        if (status == SchedulerStatus.STOPPED) {
            return;
        }
        
        status = SchedulerStatus.STOPPED;
        
        // 取消所有已调度的任务
        for (ScheduledFuture<?> future : scheduledTasks.values()) {
            future.cancel(false);
        }
        scheduledTasks.clear();
        
        // 关闭线程池
        schedulerService.shutdown();
        taskExecutorService.shutdown();
        
        // 停止任务分发器
        taskDispatcher.stop();
        
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
        
        System.out.println("高性能调度器已停止");
    }
    
    @Override
    public void registerTask(Task task) {
        if (status != SchedulerStatus.RUNNING) {
            throw new IllegalStateException("调度器未运行");
        }
        
        // 保存任务到存储
        taskStore.saveTask(task);
        
        // 如果是定时任务，立即调度
        if (task.getType() == TaskType.TIMED) {
            scheduleTask(task);
        }
        
        System.out.println("任务已注册: " + task.getName());
    }
    
    @Override
    public void cancelTask(String taskId) {
        // 从存储中删除任务
        taskStore.deleteTask(taskId);
        
        // 取消已调度的任务
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
        
        // 取消任务分发
        taskDispatcher.cancelTask(taskId);
        
        System.out.println("任务已取消: " + taskId);
    }
    
    @Override
    public void triggerTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        // 立即触发任务执行
        taskExecutorService.submit(() -> taskDispatcher.dispatchTask(task));
        
        System.out.println("任务已触发: " + taskId);
    }
    
    @Override
    public SchedulerStatus getStatus() {
        return status;
    }
    
    // 扫描并调度待执行任务
    private void scanAndScheduleTasks() {
        if (status != SchedulerStatus.RUNNING) {
            return;
        }
        
        try {
            // 获取所有待执行的定时任务
            List<Task> dueTasks = taskStore.getDueTasks(System.currentTimeMillis());
            
            for (Task task : dueTasks) {
                // 异步调度任务
                taskExecutorService.submit(() -> {
                    try {
                        taskDispatcher.dispatchTask(task);
                    } catch (Exception e) {
                        System.err.println("调度任务失败: " + task.getTaskId() + ", 错误: " + e.getMessage());
                    }
                });
            }
        } catch (Exception e) {
            System.err.println("扫描待执行任务时出错: " + e.getMessage());
        }
    }
    
    // 调度单个任务
    private void scheduleTask(Task task) {
        // 计算下次执行时间
        long nextExecutionTime = calculateNextExecutionTime(task);
        if (nextExecutionTime <= 0) {
            return;
        }
        
        long delay = nextExecutionTime - System.currentTimeMillis();
        if (delay <= 0) {
            // 立即执行
            taskExecutorService.submit(() -> taskDispatcher.dispatchTask(task));
        } else {
            // 延迟执行
            ScheduledFuture<?> future = schedulerService.schedule(() -> {
                taskExecutorService.submit(() -> taskDispatcher.dispatchTask(task));
                // 重新调度周期性任务
                if (shouldReschedule(task)) {
                    scheduleTask(task);
                } else {
                    scheduledTasks.remove(task.getTaskId());
                }
            }, delay, TimeUnit.MILLISECONDS);
            
            scheduledTasks.put(task.getTaskId(), future);
        }
    }
    
    // 计算下次执行时间
    private long calculateNextExecutionTime(Task task) {
        // 这里简化处理，实际应用中需要解析 Cron 表达式
        ScheduleStrategy strategy = task.getScheduleStrategy();
        if (strategy != null && strategy.getNextExecutionTime() > 0) {
            return strategy.getNextExecutionTime();
        }
        return -1;
    }
    
    // 判断是否需要重新调度
    private boolean shouldReschedule(Task task) {
        // 周期性任务需要重新调度
        return task.getType() == TaskType.TIMED && 
               task.getScheduleStrategy() != null &&
               task.getScheduleStrategy().isRecurring();
    }
}
```

### 任务分发器实现

```java
// 任务分发器
public class TaskDispatcher {
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final ExecutorService dispatchService;
    private volatile boolean running = false;
    
    public TaskDispatcher(TaskStore taskStore, ExecutorRegistry executorRegistry) {
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        this.dispatchService = Executors.newFixedThreadPool(5);
    }
    
    public void start() {
        this.running = true;
        System.out.println("任务分发器已启动");
    }
    
    public void stop() {
        this.running = false;
        dispatchService.shutdown();
        try {
            if (!dispatchService.awaitTermination(5, TimeUnit.SECONDS)) {
                dispatchService.shutdownNow();
            }
        } catch (InterruptedException e) {
            dispatchService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("任务分发器已停止");
    }
    
    // 分发任务
    public void dispatchTask(Task task) {
        if (!running) {
            throw new IllegalStateException("任务分发器未运行");
        }
        
        // 获取可用的执行器
        List<Executor> availableExecutors = executorRegistry.getAvailableExecutors();
        if (availableExecutors.isEmpty()) {
            System.err.println("没有可用的执行器，任务调度失败: " + task.getTaskId());
            return;
        }
        
        // 选择合适的执行器（这里使用简单的轮询策略）
        Executor selectedExecutor = selectExecutor(availableExecutors, task);
        
        // 更新任务状态为已调度
        task.setStatus(TaskStatus.SCHEDULED);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        // 异步发送任务到执行器
        dispatchService.submit(() -> {
            try {
                // 发送任务到执行器
                boolean success = selectedExecutor.executeTask(task);
                if (success) {
                    System.out.println("任务已成功分发到执行器: " + selectedExecutor.getId());
                } else {
                    System.err.println("任务分发到执行器失败: " + selectedExecutor.getId());
                    // 更新任务状态为失败
                    task.setStatus(TaskStatus.FAILED);
                    task.setLastUpdateTime(System.currentTimeMillis());
                    taskStore.updateTask(task);
                }
            } catch (Exception e) {
                System.err.println("任务分发过程中出错: " + e.getMessage());
                // 更新任务状态为失败
                task.setStatus(TaskStatus.FAILED);
                task.setLastUpdateTime(System.currentTimeMillis());
                taskStore.updateTask(task);
            }
        });
    }
    
    // 取消任务
    public void cancelTask(String taskId) {
        // 这里可以实现取消正在分发的任务的逻辑
        System.out.println("任务取消请求: " + taskId);
    }
    
    // 选择执行器
    private Executor selectExecutor(List<Executor> executors, Task task) {
        // 简单的轮询策略
        // 实际应用中可以使用更复杂的负载均衡算法
        int index = Math.abs(task.getTaskId().hashCode()) % executors.size();
        return executors.get(index);
    }
}
```

## 执行器（Executor）的设计与实现

执行器是任务的实际执行者，负责运行调度器分配的任务。一个设计良好的执行器应该具备资源隔离、状态反馈和负载均衡等能力。

### 执行器核心接口

```java
// 执行器接口
public interface Executor {
    /**
     * 获取执行器ID
     * @return 执行器ID
     */
    String getId();
    
    /**
     * 获取执行器状态
     * @return 执行器状态
     */
    ExecutorStatus getStatus();
    
    /**
     * 执行任务
     * @param task 任务
     * @return 是否执行成功
     */
    boolean executeTask(Task task);
    
    /**
     * 获取执行器负载信息
     * @return 负载信息
     */
    ExecutorLoadInfo getLoadInfo();
    
    /**
     * 停止执行器
     */
    void stop();
}

// 执行器状态枚举
enum ExecutorStatus {
    OFFLINE,    // 离线
    ONLINE,     // 在线
    BUSY,       // 忙碌
    MAINTENANCE // 维护中
}

// 执行器负载信息
public class ExecutorLoadInfo {
    private int taskCount;          // 当前任务数
    private double cpuUsage;        // CPU使用率
    private long memoryUsage;       // 内存使用量
    private long diskUsage;         // 磁盘使用量
    private long networkIn;         // 网络入流量
    private long networkOut;        // 网络出流量
    
    // 构造函数、Getters and Setters
    public ExecutorLoadInfo() {
        this.taskCount = 0;
        this.cpuUsage = 0.0;
        this.memoryUsage = 0L;
        this.diskUsage = 0L;
        this.networkIn = 0L;
        this.networkOut = 0L;
    }
    
    // Getters and Setters
    public int getTaskCount() { return taskCount; }
    public void setTaskCount(int taskCount) { this.taskCount = taskCount; }
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
}
```

### 执行器实现

```java
// 执行器实现
public class TaskExecutor implements Executor {
    private final String id;
    private final ExecutorService taskExecutionService;
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private volatile ExecutorStatus status = ExecutorStatus.OFFLINE;
    private final AtomicLong taskCounter = new AtomicLong(0);
    
    public TaskExecutor(String id, TaskStore taskStore, ExecutorRegistry executorRegistry) {
        this.id = id;
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        
        // 创建任务执行线程池
        this.taskExecutionService = Executors.newFixedThreadPool(10, 
            new ThreadFactory() {
                private final AtomicInteger counter = new AtomicInteger(0);
                @Override
                public Thread newThread(Runnable r) {
                    Thread thread = new Thread(r, "task-executor-" + id + "-" + counter.incrementAndGet());
                    return thread;
                }
            });
    }
    
    public void start() {
        this.status = ExecutorStatus.ONLINE;
        // 注册到执行器注册中心
        executorRegistry.registerExecutor(this);
        System.out.println("执行器已启动: " + id);
    }
    
    @Override
    public String getId() {
        return id;
    }
    
    @Override
    public ExecutorStatus getStatus() {
        return status;
    }
    
    @Override
    public boolean executeTask(Task task) {
        if (status != ExecutorStatus.ONLINE) {
            System.err.println("执行器未在线，无法执行任务: " + task.getTaskId());
            return false;
        }
        
        // 异步执行任务
        taskExecutionService.submit(() -> {
            try {
                executeTaskInternal(task);
            } catch (Exception e) {
                System.err.println("执行任务时出错: " + task.getTaskId() + ", 错误: " + e.getMessage());
            }
        });
        
        return true;
    }
    
    // 内部任务执行方法
    private void executeTaskInternal(Task task) {
        try {
            // 更新执行器状态为忙碌
            status = ExecutorStatus.BUSY;
            taskCounter.incrementAndGet();
            
            System.out.println("开始执行任务: " + task.getTaskId());
            
            // 创建任务执行上下文
            TaskExecutionContext context = new TaskExecutionContext(task, id);
            
            // 执行任务
            TaskExecutionResult result = task.execute(context);
            
            // 更新任务状态
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
            
            System.out.println("任务执行完成: " + task.getTaskId() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
        } catch (Exception e) {
            System.err.println("任务执行失败: " + task.getTaskId() + ", 错误: " + e.getMessage());
            // 更新任务状态为失败
            task.setStatus(TaskStatus.FAILED);
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
        } finally {
            // 恢复执行器状态
            status = ExecutorStatus.ONLINE;
            taskCounter.decrementAndGet();
        }
    }
    
    @Override
    public ExecutorLoadInfo getLoadInfo() {
        ExecutorLoadInfo loadInfo = new ExecutorLoadInfo();
        loadInfo.setTaskCount((int) taskCounter.get());
        
        // 这里简化处理，实际应用中需要获取真实的系统资源信息
        // 可以使用 OperatingSystemMXBean 或其他系统监控工具
        loadInfo.setCpuUsage(0.5); // 模拟CPU使用率
        loadInfo.setMemoryUsage(1024 * 1024 * 512); // 模拟内存使用量 512MB
        loadInfo.setDiskUsage(1024 * 1024 * 1024); // 模拟磁盘使用量 1GB
        
        return loadInfo;
    }
    
    @Override
    public void stop() {
        status = ExecutorStatus.OFFLINE;
        
        // 从注册中心注销
        executorRegistry.unregisterExecutor(id);
        
        // 关闭线程池
        taskExecutionService.shutdown();
        try {
            if (!taskExecutionService.awaitTermination(5, TimeUnit.SECONDS)) {
                taskExecutionService.shutdownNow();
            }
        } catch (InterruptedException e) {
            taskExecutionService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("执行器已停止: " + id);
    }
}
```

### 执行器注册中心

```java
// 执行器注册中心
public class ExecutorRegistry {
    private final Map<String, Executor> registeredExecutors = new ConcurrentHashMap<>();
    private final ScheduledExecutorService healthCheckService;
    
    public ExecutorRegistry() {
        // 创建健康检查服务
        this.healthCheckService = Executors.newScheduledThreadPool(1);
        // 启动定期健康检查
        this.healthCheckService.scheduleAtFixedRate(this::checkExecutorHealth, 30, 30, TimeUnit.SECONDS);
    }
    
    // 注册执行器
    public void registerExecutor(Executor executor) {
        registeredExecutors.put(executor.getId(), executor);
        System.out.println("执行器已注册: " + executor.getId());
    }
    
    // 注销执行器
    public void unregisterExecutor(String executorId) {
        Executor removed = registeredExecutors.remove(executorId);
        if (removed != null) {
            System.out.println("执行器已注销: " + executorId);
        }
    }
    
    // 获取所有注册的执行器
    public List<Executor> getAllExecutors() {
        return new ArrayList<>(registeredExecutors.values());
    }
    
    // 获取可用的执行器
    public List<Executor> getAvailableExecutors() {
        return registeredExecutors.values().stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
    }
    
    // 根据ID获取执行器
    public Executor getExecutor(String executorId) {
        return registeredExecutors.get(executorId);
    }
    
    // 健康检查
    private void checkExecutorHealth() {
        for (Executor executor : registeredExecutors.values()) {
            try {
                // 这里可以实现具体的健康检查逻辑
                // 例如发送心跳请求、检查负载等
                ExecutorLoadInfo loadInfo = executor.getLoadInfo();
                System.out.println("执行器 " + executor.getId() + " 健康检查: " + 
                                 "任务数=" + loadInfo.getTaskCount() + 
                                 ", CPU使用率=" + loadInfo.getCpuUsage());
            } catch (Exception e) {
                System.err.println("执行器健康检查失败: " + executor.getId() + ", 错误: " + e.getMessage());
                // 可以将执行器状态设置为离线
            }
        }
    }
    
    // 停止注册中心
    public void stop() {
        healthCheckService.shutdown();
        try {
            if (!healthCheckService.awaitTermination(5, TimeUnit.SECONDS)) {
                healthCheckService.shutdownNow();
            }
        } catch (InterruptedException e) {
            healthCheckService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("执行器注册中心已停止");
    }
}
```

## 组件间协作示例

```java
// 完整的调度系统示例
public class SchedulingSystemDemo {
    public static void main(String[] args) throws InterruptedException {
        // 创建任务存储（这里简化为内存存储）
        TaskStore taskStore = new InMemoryTaskStore();
        
        // 创建执行器注册中心
        ExecutorRegistry executorRegistry = new ExecutorRegistry();
        
        // 创建调度器
        HighPerformanceScheduler scheduler = new HighPerformanceScheduler(taskStore, executorRegistry);
        
        // 创建执行器
        TaskExecutor executor1 = new TaskExecutor("executor-1", taskStore, executorRegistry);
        TaskExecutor executor2 = new TaskExecutor("executor-2", taskStore, executorRegistry);
        
        // 启动组件
        scheduler.start();
        executor1.start();
        executor2.start();
        
        // 创建示例任务
        Task backupTask = new Task("backup-task-001", "数据备份任务", "DataBackupTaskHandler");
        backupTask.setDescription("每日数据备份任务");
        backupTask.setType(TaskType.TIMED);
        
        // 设置任务参数
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("sourcePath", "/data/source");
        parameters.put("targetPath", "/data/backup");
        backupTask.setParameters(parameters);
        
        // 注册任务
        scheduler.registerTask(backupTask);
        
        // 运行一段时间
        Thread.sleep(10000);
        
        // 停止系统
        scheduler.stop();
        executor1.stop();
        executor2.stop();
        executorRegistry.stop();
        
        System.out.println("调度系统演示完成");
    }
}

// 内存任务存储实现
class InMemoryTaskStore implements TaskStore {
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    
    @Override
    public void saveTask(Task task) {
        tasks.put(task.getTaskId(), task);
    }
    
    @Override
    public Task getTask(String taskId) {
        return tasks.get(taskId);
    }
    
    @Override
    public void updateTask(Task task) {
        tasks.put(task.getTaskId(), task);
    }
    
    @Override
    public void deleteTask(String taskId) {
        tasks.remove(taskId);
    }
    
    @Override
    public List<Task> getDueTasks(long currentTime) {
        return tasks.values().stream()
            .filter(task -> task.getNextExecutionTime() <= currentTime)
            .collect(Collectors.toList());
    }
}

// 任务存储接口
interface TaskStore {
    void saveTask(Task task);
    Task getTask(String taskId);
    void updateTask(Task task);
    void deleteTask(String taskId);
    List<Task> getDueTasks(long currentTime);
}
```

## 总结

任务、调度器和执行器是分布式任务调度系统的三个核心组件，它们各自承担不同的职责并协同工作：

1. **任务**：作为执行单元，封装了具体的业务逻辑和执行参数
2. **调度器**：负责时间管理和任务分发，确保任务按时触发
3. **执行器**：负责实际执行任务，并反馈执行结果

在设计这三个组件时，需要考虑以下关键点：

- **可扩展性**：组件应该支持水平扩展，以应对不断增长的任务量
- **可靠性**：组件需要具备故障恢复能力，确保系统的高可用性
- **性能**：组件应该高效处理任务，减少延迟和资源消耗
- **监控性**：组件需要提供丰富的监控指标，便于问题排查和性能优化

在下一节中，我们将深入探讨时间表达式（Cron 表达式详解），了解如何精确控制任务的执行时间。