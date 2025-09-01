---
title: 2.3 单机定时任务实现
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在前两节中，我们学习了 Java 内置的定时任务调度工具 Timer 和 ScheduledExecutorService，以及 Cron 表达式的解析原理。基于这些知识，我们可以构建一个功能完整的单机定时任务系统。本文将详细介绍如何从零开始实现一个具备基本功能的定时任务调度器，包括任务管理、调度执行、状态监控等核心功能。

## 系统架构设计

在实现单机定时任务系统之前，我们需要明确系统的整体架构和核心组件。

### 核心组件设计

```java
// 任务调度系统核心接口
public interface TaskScheduler {
    /**
     * 添加任务
     * @param task 任务信息
     * @return 任务ID
     */
    String addTask(ScheduledTask task);
    
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
     * 获取任务信息
     * @param taskId 任务ID
     * @return 任务信息
     */
    ScheduledTask getTask(String taskId);
    
    /**
     * 获取所有任务
     * @return 任务列表
     */
    List<ScheduledTask> getAllTasks();
    
    /**
     * 启动调度器
     */
    void start();
    
    /**
     * 停止调度器
     */
    void shutdown();
}

// 任务执行器接口
interface TaskExecutor {
    /**
     * 执行任务
     * @param task 任务信息
     * @return 执行结果
     */
    TaskExecutionResult execute(ScheduledTask task);
}

// 任务存储接口
interface TaskStore {
    /**
     * 保存任务
     * @param task 任务信息
     */
    void saveTask(ScheduledTask task);
    
    /**
     * 删除任务
     * @param taskId 任务ID
     */
    void removeTask(String taskId);
    
    /**
     * 获取任务
     * @param taskId 任务ID
     * @return 任务信息
     */
    ScheduledTask getTask(String taskId);
    
    /**
     * 获取所有任务
     * @return 任务列表
     */
    List<ScheduledTask> getAllTasks();
    
    /**
     * 更新任务状态
     * @param taskId 任务ID
     * @param status 任务状态
     */
    void updateTaskStatus(String taskId, TaskStatus status);
}
```

### 任务实体类定义

```java
// 定时任务实体类
public class ScheduledTask {
    private String taskId;           // 任务ID
    private String taskName;         // 任务名称
    private String cronExpression;   // Cron表达式
    private String taskClass;        // 任务执行类
    private Map<String, Object> parameters; // 任务参数
    private TaskStatus status;       // 任务状态
    private Date createTime;         // 创建时间
    private Date updateTime;         // 更新时间
    private Date lastExecuteTime;    // 最后执行时间
    private Date nextExecuteTime;    // 下次执行时间
    private int executeCount;        // 执行次数
    private int failCount;           // 失败次数
    private String lastErrorMessage; // 最后错误信息
    private boolean isPersistent;    // 是否持久化
    private TaskType taskType;       // 任务类型
    
    public ScheduledTask() {
        this.taskId = UUID.randomUUID().toString();
        this.status = TaskStatus.PENDING;
        this.createTime = new Date();
        this.updateTime = new Date();
        this.parameters = new HashMap<>();
        this.executeCount = 0;
        this.failCount = 0;
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    
    public String getTaskClass() { return taskClass; }
    public void setTaskClass(String taskClass) { this.taskClass = taskClass; }
    
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    
    public Date getLastExecuteTime() { return lastExecuteTime; }
    public void setLastExecuteTime(Date lastExecuteTime) { this.lastExecuteTime = lastExecuteTime; }
    
    public Date getNextExecuteTime() { return nextExecuteTime; }
    public void setNextExecuteTime(Date nextExecuteTime) { this.nextExecuteTime = nextExecuteTime; }
    
    public int getExecuteCount() { return executeCount; }
    public void setExecuteCount(int executeCount) { this.executeCount = executeCount; }
    
    public int getFailCount() { return failCount; }
    public void setFailCount(int failCount) { this.failCount = failCount; }
    
    public String getLastErrorMessage() { return lastErrorMessage; }
    public void setLastErrorMessage(String lastErrorMessage) { this.lastErrorMessage = lastErrorMessage; }
    
    public boolean isPersistent() { return isPersistent; }
    public void setPersistent(boolean persistent) { isPersistent = persistent; }
    
    public TaskType getTaskType() { return taskType; }
    public void setTaskType(TaskType taskType) { this.taskType = taskType; }
}

// 任务状态枚举
enum TaskStatus {
    PENDING,    // 待执行
    RUNNING,    // 执行中
    PAUSED,     // 已暂停
    COMPLETED,  // 已完成
    FAILED,     // 执行失败
    CANCELLED   // 已取消
}

// 任务类型枚举
enum TaskType {
    CRON,       // Cron表达式任务
    FIXED_RATE, // 固定频率任务
    FIXED_DELAY // 固定延迟任务
}

// 任务执行结果
class TaskExecutionResult {
    private boolean success;        // 是否执行成功
    private String message;         // 执行消息
    private Object result;          // 执行结果
    private long executionTime;     // 执行时间(ms)
    private Date executeTime;       // 执行时间
    
    public TaskExecutionResult(boolean success, String message, Object result, long executionTime) {
        this.success = success;
        this.message = message;
        this.result = result;
        this.executionTime = executionTime;
        this.executeTime = new Date();
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Object getResult() { return result; }
    public long getExecutionTime() { return executionTime; }
    public Date getExecuteTime() { return executeTime; }
}
```

## 核心调度器实现

基于上述设计，我们来实现一个完整的单机定时任务调度器：

```java
// 单机定时任务调度器实现
public class SimpleTaskScheduler implements TaskScheduler {
    private final ScheduledExecutorService scheduler;
    private final TaskStore taskStore;
    private final TaskExecutor taskExecutor;
    private final Map<String, ScheduledFuture<?>> scheduledTasks;
    private final CronExpressionCalculator cronCalculator;
    private volatile boolean isRunning = false;
    
    public SimpleTaskScheduler() {
        this.scheduler = Executors.newScheduledThreadPool(10);
        this.taskStore = new InMemoryTaskStore();
        this.taskExecutor = new DefaultTaskExecutor();
        this.scheduledTasks = new ConcurrentHashMap<>();
        this.cronCalculator = new CronExpressionCalculator(null); // 简化处理
    }
    
    @Override
    public String addTask(ScheduledTask task) {
        if (!isRunning) {
            throw new IllegalStateException("调度器未启动");
        }
        
        // 保存任务
        taskStore.saveTask(task);
        
        // 调度任务
        scheduleTask(task);
        
        System.out.println("任务已添加: " + task.getTaskName() + " (" + task.getTaskId() + ")");
        return task.getTaskId();
    }
    
    @Override
    public boolean removeTask(String taskId) {
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null) {
            return false;
        }
        
        // 取消调度
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
        
        // 删除任务
        taskStore.removeTask(taskId);
        
        System.out.println("任务已删除: " + task.getTaskName() + " (" + taskId + ")");
        return true;
    }
    
    @Override
    public boolean pauseTask(String taskId) {
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null) {
            return false;
        }
        
        // 取消调度
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
        
        // 更新状态
        task.setStatus(TaskStatus.PAUSED);
        task.setUpdateTime(new Date());
        taskStore.saveTask(task);
        
        System.out.println("任务已暂停: " + task.getTaskName() + " (" + taskId + ")");
        return true;
    }
    
    @Override
    public boolean resumeTask(String taskId) {
        ScheduledTask task = taskStore.getTask(taskId);
        if (task == null || task.getStatus() != TaskStatus.PAUSED) {
            return false;
        }
        
        // 更新状态
        task.setStatus(TaskStatus.PENDING);
        task.setUpdateTime(new Date());
        taskStore.saveTask(task);
        
        // 重新调度任务
        scheduleTask(task);
        
        System.out.println("任务已恢复: " + task.getTaskName() + " (" + taskId + ")");
        return true;
    }
    
    @Override
    public ScheduledTask getTask(String taskId) {
        return taskStore.getTask(taskId);
    }
    
    @Override
    public List<ScheduledTask> getAllTasks() {
        return taskStore.getAllTasks();
    }
    
    @Override
    public void start() {
        if (isRunning) {
            return;
        }
        
        isRunning = true;
        System.out.println("定时任务调度器已启动");
        
        // 加载所有任务并调度
        List<ScheduledTask> tasks = taskStore.getAllTasks();
        for (ScheduledTask task : tasks) {
            if (task.getStatus() == TaskStatus.PENDING || task.getStatus() == TaskStatus.RUNNING) {
                scheduleTask(task);
            }
        }
    }
    
    @Override
    public void shutdown() {
        if (!isRunning) {
            return;
        }
        
        isRunning = false;
        
        // 取消所有任务
        for (ScheduledFuture<?> future : scheduledTasks.values()) {
            future.cancel(false);
        }
        scheduledTasks.clear();
        
        // 关闭调度器
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("定时任务调度器已关闭");
    }
    
    // 调度任务
    private void scheduleTask(ScheduledTask task) {
        Runnable taskWrapper = () -> executeTask(task);
        
        // 根据任务类型调度
        switch (task.getTaskType()) {
            case CRON:
                scheduleCronTask(task, taskWrapper);
                break;
            case FIXED_RATE:
                scheduleFixedRateTask(task, taskWrapper);
                break;
            case FIXED_DELAY:
                scheduleFixedDelayTask(task, taskWrapper);
                break;
        }
    }
    
    // 调度Cron任务
    private void scheduleCronTask(ScheduledTask task, Runnable taskWrapper) {
        // 计算下次执行时间
        Date now = new Date();
        Date nextExecuteTime = cronCalculator.getNextValidTimeAfter(now);
        
        if (nextExecuteTime != null) {
            long delay = nextExecuteTime.getTime() - now.getTime();
            if (delay > 0) {
                ScheduledFuture<?> future = scheduler.schedule(
                    () -> {
                        taskWrapper.run();
                        // 重新调度下次执行
                        scheduleCronTask(task, taskWrapper);
                    },
                    delay, TimeUnit.MILLISECONDS
                );
                scheduledTasks.put(task.getTaskId(), future);
                
                // 更新任务下次执行时间
                task.setNextExecuteTime(nextExecuteTime);
                taskStore.saveTask(task);
            }
        }
    }
    
    // 调度固定频率任务
    private void scheduleFixedRateTask(ScheduledTask task, Runnable taskWrapper) {
        // 从参数中获取执行周期
        long period = getLongParameter(task, "period", 60000); // 默认60秒
        long initialDelay = getLongParameter(task, "initialDelay", 0); // 默认立即执行
        
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(
            taskWrapper, initialDelay, period, TimeUnit.MILLISECONDS
        );
        scheduledTasks.put(task.getTaskId(), future);
        
        // 更新任务下次执行时间
        Date nextExecuteTime = new Date(System.currentTimeMillis() + period);
        task.setNextExecuteTime(nextExecuteTime);
        taskStore.saveTask(task);
    }
    
    // 调度固定延迟任务
    private void scheduleFixedDelayTask(ScheduledTask task, Runnable taskWrapper) {
        // 从参数中获取执行延迟
        long delay = getLongParameter(task, "delay", 60000); // 默认60秒
        long initialDelay = getLongParameter(task, "initialDelay", 0); // 默认立即执行
        
        ScheduledFuture<?> future = scheduler.scheduleWithFixedDelay(
            taskWrapper, initialDelay, delay, TimeUnit.MILLISECONDS
        );
        scheduledTasks.put(task.getTaskId(), future);
        
        // 更新任务下次执行时间
        Date nextExecuteTime = new Date(System.currentTimeMillis() + delay);
        task.setNextExecuteTime(nextExecuteTime);
        taskStore.saveTask(task);
    }
    
    // 执行任务
    private void executeTask(ScheduledTask task) {
        try {
            // 更新任务状态
            task.setStatus(TaskStatus.RUNNING);
            task.setUpdateTime(new Date());
            taskStore.saveTask(task);
            
            // 执行任务
            long startTime = System.currentTimeMillis();
            TaskExecutionResult result = taskExecutor.execute(task);
            long executionTime = System.currentTimeMillis() - startTime;
            
            // 更新任务执行信息
            task.setLastExecuteTime(new Date());
            task.setExecuteCount(task.getExecuteCount() + 1);
            task.setUpdateTime(new Date());
            
            if (result.isSuccess()) {
                task.setStatus(TaskStatus.PENDING);
                task.setLastErrorMessage(null);
            } else {
                task.setStatus(TaskStatus.FAILED);
                task.setFailCount(task.getFailCount() + 1);
                task.setLastErrorMessage(result.getMessage());
            }
            
            taskStore.saveTask(task);
            
            System.out.println("任务执行完成: " + task.getTaskName() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败") + 
                             ", 耗时: " + executionTime + "ms");
        } catch (Exception e) {
            // 更新任务失败信息
            task.setStatus(TaskStatus.FAILED);
            task.setFailCount(task.getFailCount() + 1);
            task.setLastErrorMessage(e.getMessage());
            task.setUpdateTime(new Date());
            taskStore.saveTask(task);
            
            System.err.println("任务执行异常: " + task.getTaskName() + ", 错误: " + e.getMessage());
        }
    }
    
    // 获取长整型参数
    private long getLongParameter(ScheduledTask task, String key, long defaultValue) {
        Object value = task.getParameters().get(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        } else if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}

// 默认任务执行器实现
class DefaultTaskExecutor implements TaskExecutor {
    @Override
    public TaskExecutionResult execute(ScheduledTask task) {
        try {
            // 通过反射创建任务实例
            Class<?> taskClass = Class.forName(task.getTaskClass());
            Object taskInstance = taskClass.newInstance();
            
            // 检查是否实现了任务接口
            if (taskInstance instanceof Task) {
                Task executableTask = (Task) taskInstance;
                Object result = executableTask.execute(task.getParameters());
                return new TaskExecutionResult(true, "任务执行成功", result, 0);
            } else {
                return new TaskExecutionResult(false, "任务类未实现Task接口", null, 0);
            }
        } catch (Exception e) {
            return new TaskExecutionResult(false, "任务执行异常: " + e.getMessage(), null, 0);
        }
    }
}

// 任务接口
interface Task {
    Object execute(Map<String, Object> parameters);
}

// 内存任务存储实现
class InMemoryTaskStore implements TaskStore {
    private final Map<String, ScheduledTask> tasks = new ConcurrentHashMap<>();
    
    @Override
    public void saveTask(ScheduledTask task) {
        tasks.put(task.getTaskId(), task);
    }
    
    @Override
    public void removeTask(String taskId) {
        tasks.remove(taskId);
    }
    
    @Override
    public ScheduledTask getTask(String taskId) {
        return tasks.get(taskId);
    }
    
    @Override
    public List<ScheduledTask> getAllTasks() {
        return new ArrayList<>(tasks.values());
    }
    
    @Override
    public void updateTaskStatus(String taskId, TaskStatus status) {
        ScheduledTask task = tasks.get(taskId);
        if (task != null) {
            task.setStatus(status);
            task.setUpdateTime(new Date());
        }
    }
}
```

## 任务实现示例

为了演示如何使用我们的调度器，我们来实现几个具体的任务示例：

```java
// 示例任务1：数据备份任务
public class DataBackupTask implements Task {
    @Override
    public Object execute(Map<String, Object> parameters) {
        System.out.println("开始执行数据备份任务...");
        
        // 模拟备份过程
        try {
            Thread.sleep(3000); // 模拟耗时操作
            
            // 获取参数
            String sourcePath = (String) parameters.get("sourcePath");
            String targetPath = (String) parameters.get("targetPath");
            
            System.out.println("数据备份完成: " + sourcePath + " -> " + targetPath);
            return "备份成功";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("备份任务被中断", e);
        }
    }
}

// 示例任务2：邮件发送任务
public class EmailSendTask implements Task {
    @Override
    public Object execute(Map<String, Object> parameters) {
        System.out.println("开始执行邮件发送任务...");
        
        // 获取参数
        String recipient = (String) parameters.get("recipient");
        String subject = (String) parameters.get("subject");
        String content = (String) parameters.get("content");
        
        // 模拟邮件发送
        try {
            Thread.sleep(2000); // 模拟耗时操作
            System.out.println("邮件发送成功: 收件人=" + recipient + ", 主题=" + subject);
            return "邮件发送成功";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("邮件发送任务被中断", e);
        }
    }
}

// 示例任务3：数据清理任务
public class DataCleanupTask implements Task {
    @Override
    public Object execute(Map<String, Object> parameters) {
        System.out.println("开始执行数据清理任务...");
        
        // 获取参数
        int daysToKeep = (Integer) parameters.getOrDefault("daysToKeep", 30);
        
        // 模拟数据清理
        try {
            Thread.sleep(5000); // 模拟耗时操作
            
            // 模拟清理了1000条数据
            System.out.println("数据清理完成: 清理了超过" + daysToKeep + "天的数据，共1000条记录");
            return "清理了1000条记录";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("数据清理任务被中断", e);
        }
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用我们的定时任务调度器：

```java
// 定时任务调度器使用示例
public class TaskSchedulerExample {
    public static void main(String[] args) {
        // 创建调度器
        SimpleTaskScheduler scheduler = new SimpleTaskScheduler();
        
        try {
            // 启动调度器
            scheduler.start();
            
            // 创建数据备份任务
            ScheduledTask backupTask = new ScheduledTask();
            backupTask.setTaskName("数据备份任务");
            backupTask.setTaskClass("com.example.DataBackupTask");
            backupTask.setTaskType(TaskType.CRON);
            backupTask.setCronExpression("0 0 2 * * ?"); // 每天凌晨2点执行
            
            Map<String, Object> backupParams = new HashMap<>();
            backupParams.put("sourcePath", "/data/production");
            backupParams.put("targetPath", "/backup/daily");
            backupTask.setParameters(backupParams);
            
            // 添加任务
            String backupTaskId = scheduler.addTask(backupTask);
            System.out.println("数据备份任务ID: " + backupTaskId);
            
            // 创建邮件发送任务
            ScheduledTask emailTask = new ScheduledTask();
            emailTask.setTaskName("系统健康检查邮件");
            emailTask.setTaskClass("com.example.EmailSendTask");
            emailTask.setTaskType(TaskType.FIXED_RATE);
            emailTask.setPersistent(true);
            
            Map<String, Object> emailParams = new HashMap<>();
            emailParams.put("recipient", "admin@example.com");
            emailParams.put("subject", "系统健康检查报告");
            emailParams.put("content", "系统运行正常");
            emailParams.put("period", 3600000); // 每小时执行一次(毫秒)
            emailTask.setParameters(emailParams);
            
            // 添加任务
            String emailTaskId = scheduler.addTask(emailTask);
            System.out.println("邮件发送任务ID: " + emailTaskId);
            
            // 创建数据清理任务
            ScheduledTask cleanupTask = new ScheduledTask();
            cleanupTask.setTaskName("日志数据清理");
            cleanupTask.setTaskClass("com.example.DataCleanupTask");
            cleanupTask.setTaskType(TaskType.FIXED_DELAY);
            cleanupTask.setPersistent(true);
            
            Map<String, Object> cleanupParams = new HashMap<>();
            cleanupParams.put("daysToKeep", 30);
            cleanupParams.put("delay", 86400000); // 每天执行一次(毫秒)
            cleanupTask.setParameters(cleanupParams);
            
            // 添加任务
            String cleanupTaskId = scheduler.addTask(cleanupTask);
            System.out.println("数据清理任务ID: " + cleanupTaskId);
            
            // 查看所有任务
            System.out.println("\n=== 当前所有任务 ===");
            List<ScheduledTask> allTasks = scheduler.getAllTasks();
            for (ScheduledTask task : allTasks) {
                System.out.println("任务ID: " + task.getTaskId());
                System.out.println("任务名称: " + task.getTaskName());
                System.out.println("任务状态: " + task.getStatus());
                System.out.println("下次执行时间: " + task.getNextExecuteTime());
                System.out.println("执行次数: " + task.getExecuteCount());
                System.out.println("失败次数: " + task.getFailCount());
                System.out.println("---");
            }
            
            // 运行一段时间
            Thread.sleep(30000);
            
            // 暂停邮件任务
            scheduler.pauseTask(emailTaskId);
            System.out.println("邮件任务已暂停");
            
            // 运行一段时间
            Thread.sleep(20000);
            
            // 恢复邮件任务
            scheduler.resumeTask(emailTaskId);
            System.out.println("邮件任务已恢复");
            
            // 运行一段时间
            Thread.sleep(20000);
            
            // 删除数据清理任务
            scheduler.removeTask(cleanupTaskId);
            System.out.println("数据清理任务已删除");
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("主线程被中断");
        } finally {
            // 关闭调度器
            scheduler.shutdown();
        }
    }
}
```

## 系统扩展与优化

在实际应用中，我们可以对这个简单的定时任务系统进行扩展和优化：

```java
// 扩展功能：任务依赖管理
public class TaskDependencyManager {
    private final Map<String, Set<String>> dependencies = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> reverseDependencies = new ConcurrentHashMap<>();
    
    // 添加任务依赖
    public void addDependency(String taskId, String dependentTaskId) {
        dependencies.computeIfAbsent(taskId, k -> new HashSet<>()).add(dependentTaskId);
        reverseDependencies.computeIfAbsent(dependentTaskId, k -> new HashSet<>()).add(taskId);
    }
    
    // 获取任务的依赖
    public Set<String> getDependencies(String taskId) {
        return new HashSet<>(dependencies.getOrDefault(taskId, new HashSet<>()));
    }
    
    // 获取被依赖的任务
    public Set<String> getDependents(String taskId) {
        return new HashSet<>(reverseDependencies.getOrDefault(taskId, new HashSet<>()));
    }
    
    // 检查是否存在循环依赖
    public boolean hasCircularDependency(String taskId) {
        return hasCircularDependency(taskId, new HashSet<>());
    }
    
    private boolean hasCircularDependency(String taskId, Set<String> visited) {
        if (visited.contains(taskId)) {
            return true;
        }
        
        visited.add(taskId);
        Set<String> dependents = reverseDependencies.get(taskId);
        if (dependents != null) {
            for (String dependent : dependents) {
                if (hasCircularDependency(dependent, visited)) {
                    return true;
                }
            }
        }
        
        visited.remove(taskId);
        return false;
    }
}

// 扩展功能：任务分片处理
public class TaskShardingManager {
    // 计算任务分片
    public List<TaskShard> calculateShards(ScheduledTask task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        for (int i = 0; i < shardCount; i++) {
            TaskShard shard = new TaskShard();
            shard.setTaskId(task.getTaskId());
            shard.setShardId(i);
            shard.setShardCount(shardCount);
            shard.setParameters(new HashMap<>(task.getParameters()));
            shard.getParameters().put("shardIndex", i);
            shard.getParameters().put("shardCount", shardCount);
            shards.add(shard);
        }
        
        return shards;
    }
}

// 任务分片实体类
class TaskShard {
    private String taskId;
    private int shardId;
    private int shardCount;
    private Map<String, Object> parameters;
    
    public TaskShard() {
        this.parameters = new HashMap<>();
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public int getShardId() { return shardId; }
    public void setShardId(int shardId) { this.shardId = shardId; }
    
    public int getShardCount() { return shardCount; }
    public void setShardCount(int shardCount) { this.shardCount = shardCount; }
    
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
}

// 扩展功能：任务执行历史记录
public class TaskExecutionHistory {
    private final List<TaskExecutionRecord> records = new ArrayList<>();
    private final int maxRecords;
    
    public TaskExecutionHistory(int maxRecords) {
        this.maxRecords = maxRecords;
    }
    
    // 记录任务执行
    public void recordExecution(TaskExecutionRecord record) {
        synchronized (records) {
            records.add(record);
            if (records.size() > maxRecords) {
                records.remove(0);
            }
        }
    }
    
    // 获取任务执行历史
    public List<TaskExecutionRecord> getExecutionHistory(String taskId) {
        synchronized (records) {
            return records.stream()
                .filter(record -> record.getTaskId().equals(taskId))
                .collect(Collectors.toList());
        }
    }
    
    // 获取失败的执行记录
    public List<TaskExecutionRecord> getFailedExecutions() {
        synchronized (records) {
            return records.stream()
                .filter(record -> !record.isSuccess())
                .collect(Collectors.toList());
        }
    }
}

// 任务执行记录
class TaskExecutionRecord {
    private String taskId;
    private String taskName;
    private boolean success;
    private String message;
    private long executionTime;
    private Date executeTime;
    private String errorMessage;
    
    public TaskExecutionRecord(String taskId, String taskName, boolean success, 
                              String message, long executionTime) {
        this.taskId = taskId;
        this.taskName = taskName;
        this.success = success;
        this.message = message;
        this.executionTime = executionTime;
        this.executeTime = new Date();
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    
    public Date getExecuteTime() { return executeTime; }
    public void setExecuteTime(Date executeTime) { this.executeTime = executeTime; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
```

## 总结

通过本文的实现，我们构建了一个功能相对完整的单机定时任务调度系统，具备以下特点：

1. **核心功能**：任务添加、删除、暂停、恢复等基本操作
2. **多种任务类型**：支持 Cron 表达式、固定频率、固定延迟等不同类型的任务
3. **任务执行管理**：任务状态跟踪、执行次数统计、失败重试等
4. **扩展能力**：任务依赖、任务分片、执行历史等高级功能

这个系统虽然运行在单机环境下，但其设计思想和实现方式为构建分布式任务调度系统奠定了基础。在后续章节中，我们将基于这个单机实现，逐步扩展为支持分布式部署的完整调度系统。

在下一节中，我们将探讨如何为调度器添加监控和管理功能，包括 Web 管理界面、REST API、执行日志查看等。
