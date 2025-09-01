---
title: 3.2 调度中心 vs 执行节点
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，调度中心和执行节点是两个核心组件，它们承担着不同的职责，共同协作完成任务的调度和执行。理解调度中心与执行节点的区别、联系以及各自的特性，对于设计和实现高效的分布式调度系统具有重要意义。本文将深入探讨调度中心与执行节点的架构设计、功能特性以及在实际应用中的最佳实践。

## 调度中心与执行节点的核心区别

调度中心和执行节点在分布式调度系统中扮演着截然不同的角色。调度中心主要负责任务的管理、调度和监控，而执行节点则专注于任务的实际执行。

### 职责分工对比

```java
// 调度中心接口
public interface SchedulingCenter {
    /**
     * 任务管理功能
     */
    void createTask(TaskDefinition taskDef);
    void updateTask(String taskId, TaskDefinition taskDef);
    void deleteTask(String taskId);
    Task getTask(String taskId);
    List<Task> listTasks(TaskQuery query);
    
    /**
     * 任务调度功能
     */
    void scheduleTask(String taskId);
    void triggerTask(String taskId);
    void pauseTask(String taskId);
    void resumeTask(String taskId);
    void cancelTask(String taskId);
    
    /**
     * 执行节点管理功能
     */
    void registerExecutor(ExecutorNode executor);
    void unregisterExecutor(String executorId);
    List<ExecutorNode> listExecutors();
    ExecutorNode getExecutor(String executorId);
    
    /**
     * 监控与告警功能
     */
    TaskStatistics getTaskStatistics();
    List<TaskExecutionRecord> getExecutionHistory(String taskId);
    void sendAlert(Alert alert);
    
    /**
     * 系统管理功能
     */
    void start();
    void stop();
    SystemStatus getSystemStatus();
}

// 执行节点接口
public interface ExecutorNode {
    /**
     * 任务执行功能
     */
    TaskExecutionResult executeTask(Task task);
    void cancelTask(String taskId);
    TaskExecutionStatus getTaskStatus(String taskId);
    
    /**
     * 节点管理功能
     */
    void start();
    void stop();
    ExecutorInfo getInfo();
    void updateConfig(ExecutorConfig config);
    
    /**
     * 与调度中心通信功能
     */
    void sendHeartbeat();
    void reportTaskResult(String taskId, TaskExecutionResult result);
    void handleCommand(ExecutorCommand command);
}

// 调度中心实现
public class SchedulingCenterImpl implements SchedulingCenter {
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final TaskScheduler taskScheduler;
    private final MonitorService monitorService;
    private final AlertService alertService;
    private final ScheduledExecutorService heartbeatService;
    private volatile boolean running = false;
    
    public SchedulingCenterImpl(TaskStore taskStore) {
        this.taskStore = taskStore;
        this.executorRegistry = new ExecutorRegistry();
        this.taskScheduler = new TaskScheduler(taskStore, executorRegistry);
        this.monitorService = new MonitorService(taskStore, executorRegistry);
        this.alertService = new AlertService();
        this.heartbeatService = Executors.newScheduledThreadPool(1);
    }
    
    @Override
    public void createTask(TaskDefinition taskDef) {
        if (!running) {
            throw new IllegalStateException("调度中心未运行");
        }
        
        Task task = new Task(taskDef);
        task.setStatus(TaskStatus.CREATED);
        task.setCreateTime(System.currentTimeMillis());
        taskStore.saveTask(task);
        
        System.out.println("任务已创建: " + task.getTaskId());
    }
    
    @Override
    public void updateTask(String taskId, TaskDefinition taskDef) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        task.updateFromDefinition(taskDef);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        System.out.println("任务已更新: " + taskId);
    }
    
    @Override
    public void deleteTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        // 检查任务状态，不能删除正在执行的任务
        if (task.getStatus() == TaskStatus.RUNNING) {
            throw new IllegalStateException("不能删除正在执行的任务: " + taskId);
        }
        
        taskStore.deleteTask(taskId);
        System.out.println("任务已删除: " + taskId);
    }
    
    @Override
    public Task getTask(String taskId) {
        return taskStore.getTask(taskId);
    }
    
    @Override
    public List<Task> listTasks(TaskQuery query) {
        return taskStore.queryTasks(query);
    }
    
    @Override
    public void scheduleTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        // 更新任务状态
        task.setStatus(TaskStatus.PENDING);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        // 提交任务给调度器
        taskScheduler.scheduleTask(task);
        
        System.out.println("任务已提交调度: " + taskId);
    }
    
    @Override
    public void triggerTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        // 立即触发任务执行
        taskScheduler.triggerTask(task);
        
        System.out.println("任务已触发执行: " + taskId);
    }
    
    @Override
    public void pauseTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        task.setStatus(TaskStatus.PAUSED);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        System.out.println("任务已暂停: " + taskId);
    }
    
    @Override
    public void resumeTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        task.setStatus(TaskStatus.PENDING);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        // 重新提交任务给调度器
        taskScheduler.scheduleTask(task);
        
        System.out.println("任务已恢复: " + taskId);
    }
    
    @Override
    public void cancelTask(String taskId) {
        Task task = taskStore.getTask(taskId);
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        
        task.setStatus(TaskStatus.CANCELLED);
        task.setLastUpdateTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        // 通知执行节点取消任务
        if (task.getAssignedExecutor() != null) {
            ExecutorNode executor = executorRegistry.getExecutor(task.getAssignedExecutor());
            if (executor != null) {
                executor.cancelTask(taskId);
            }
        }
        
        System.out.println("任务已取消: " + taskId);
    }
    
    @Override
    public void registerExecutor(ExecutorNode executor) {
        executorRegistry.registerExecutor(executor);
        System.out.println("执行节点已注册: " + executor.getInfo().getId());
    }
    
    @Override
    public void unregisterExecutor(String executorId) {
        executorRegistry.unregisterExecutor(executorId);
        System.out.println("执行节点已注销: " + executorId);
    }
    
    @Override
    public List<ExecutorNode> listExecutors() {
        return executorRegistry.getAllExecutors();
    }
    
    @Override
    public ExecutorNode getExecutor(String executorId) {
        return executorRegistry.getExecutor(executorId);
    }
    
    @Override
    public TaskStatistics getTaskStatistics() {
        return monitorService.getTaskStatistics();
    }
    
    @Override
    public List<TaskExecutionRecord> getExecutionHistory(String taskId) {
        return taskStore.getExecutionHistory(taskId);
    }
    
    @Override
    public void sendAlert(Alert alert) {
        alertService.sendAlert(alert);
    }
    
    @Override
    public void start() {
        if (running) {
            throw new IllegalStateException("调度中心已在运行");
        }
        
        running = true;
        
        // 启动调度器
        taskScheduler.start();
        
        // 启动监控服务
        monitorService.start();
        
        // 启动心跳服务
        heartbeatService.scheduleAtFixedRate(this::processHeartbeats, 0, 10, TimeUnit.SECONDS);
        
        System.out.println("调度中心已启动");
    }
    
    @Override
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        
        // 停止服务
        taskScheduler.stop();
        monitorService.stop();
        heartbeatService.shutdown();
        
        try {
            if (!heartbeatService.awaitTermination(5, TimeUnit.SECONDS)) {
                heartbeatService.shutdownNow();
            }
        } catch (InterruptedException e) {
            heartbeatService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("调度中心已停止");
    }
    
    @Override
    public SystemStatus getSystemStatus() {
        SystemStatus status = new SystemStatus();
        status.setRunning(running);
        status.setTaskCount(taskStore.countAllTasks());
        status.setExecutorCount(executorRegistry.getExecutorCount());
        status.setActiveTaskCount(taskStore.countTasksByStatus(TaskStatus.RUNNING));
        return status;
    }
    
    // 处理心跳信息
    private void processHeartbeats() {
        // 实际应用中处理执行节点的心跳信息
    }
}

// 执行节点实现
public class ExecutorNodeImpl implements ExecutorNode {
    private final String nodeId;
    private final String schedulingCenterAddress;
    private final TaskExecutor taskExecutor;
    private final ExecutorInfo executorInfo;
    private final ScheduledExecutorService heartbeatService;
    private final Map<String, Task> executingTasks = new ConcurrentHashMap<>();
    private volatile boolean running = false;
    
    public ExecutorNodeImpl(String nodeId, String schedulingCenterAddress) {
        this.nodeId = nodeId;
        this.schedulingCenterAddress = schedulingCenterAddress;
        this.taskExecutor = new TaskExecutor();
        this.executorInfo = new ExecutorInfo(nodeId);
        this.heartbeatService = Executors.newScheduledThreadPool(1);
    }
    
    @Override
    public void start() {
        if (running) {
            throw new IllegalStateException("执行节点已在运行");
        }
        
        running = true;
        executorInfo.setStatus(ExecutorStatus.ONLINE);
        
        // 启动任务执行器
        taskExecutor.start();
        
        // 启动心跳服务
        heartbeatService.scheduleAtFixedRate(this::sendHeartbeat, 0, 5, TimeUnit.SECONDS);
        
        // 注册到调度中心
        registerToSchedulingCenter();
        
        System.out.println("执行节点已启动: " + nodeId);
    }
    
    @Override
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        executorInfo.setStatus(ExecutorStatus.OFFLINE);
        
        // 停止服务
        taskExecutor.stop();
        heartbeatService.shutdown();
        
        try {
            if (!heartbeatService.awaitTermination(5, TimeUnit.SECONDS)) {
                heartbeatService.shutdownNow();
            }
        } catch (InterruptedException e) {
            heartbeatService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        // 注销从调度中心
        unregisterFromSchedulingCenter();
        
        System.out.println("执行节点已停止: " + nodeId);
    }
    
    @Override
    public TaskExecutionResult executeTask(Task task) {
        if (!running) {
            throw new IllegalStateException("执行节点未运行");
        }
        
        // 记录正在执行的任务
        executingTasks.put(task.getTaskId(), task);
        
        try {
            System.out.println("开始执行任务: " + task.getTaskId() + " 在节点: " + nodeId);
            
            // 执行任务
            TaskExecutionResult result = taskExecutor.executeTask(task);
            
            System.out.println("任务执行完成: " + task.getTaskId() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
            
            // 报告执行结果
            reportTaskResult(task.getTaskId(), result);
            
            return result;
        } catch (Exception e) {
            System.err.println("执行任务失败: " + task.getTaskId() + ", 错误: " + e.getMessage());
            
            // 报告执行失败
            TaskExecutionResult failureResult = new TaskExecutionResult(false, e.getMessage());
            reportTaskResult(task.getTaskId(), failureResult);
            
            throw new RuntimeException("任务执行失败", e);
        } finally {
            // 清理执行记录
            executingTasks.remove(task.getTaskId());
        }
    }
    
    @Override
    public void cancelTask(String taskId) {
        if (!running) {
            return;
        }
        
        // 取消正在执行的任务
        taskExecutor.cancelTask(taskId);
        executingTasks.remove(taskId);
        
        System.out.println("任务已取消: " + taskId);
    }
    
    @Override
    public TaskExecutionStatus getTaskStatus(String taskId) {
        Task task = executingTasks.get(taskId);
        if (task != null) {
            return task.getExecutionStatus();
        }
        return TaskExecutionStatus.UNKNOWN;
    }
    
    @Override
    public ExecutorInfo getInfo() {
        return executorInfo;
    }
    
    @Override
    public void updateConfig(ExecutorConfig config) {
        // 更新执行节点配置
        executorInfo.updateFromConfig(config);
        System.out.println("执行节点配置已更新: " + nodeId);
    }
    
    @Override
    public void sendHeartbeat() {
        if (!running) {
            return;
        }
        
        try {
            // 创建心跳信息
            HeartbeatInfo heartbeat = new HeartbeatInfo(
                nodeId, executorInfo.getStatus(), executingTasks.size());
            
            // 发送心跳到调度中心
            sendHeartbeatToSchedulingCenter(heartbeat);
            
            executorInfo.setLastHeartbeatTime(System.currentTimeMillis());
        } catch (Exception e) {
            System.err.println("发送心跳失败: " + e.getMessage());
        }
    }
    
    @Override
    public void reportTaskResult(String taskId, TaskExecutionResult result) {
        if (!running) {
            return;
        }
        
        try {
            // 发送任务结果到调度中心
            sendTaskResultToSchedulingCenter(taskId, result);
        } catch (Exception e) {
            System.err.println("报告任务结果失败: " + e.getMessage());
        }
    }
    
    @Override
    public void handleCommand(ExecutorCommand command) {
        if (!running) {
            return;
        }
        
        try {
            switch (command.getType()) {
                case EXECUTE_TASK:
                    handleExecuteTaskCommand(command);
                    break;
                case CANCEL_TASK:
                    handleCancelTaskCommand(command);
                    break;
                case UPDATE_CONFIG:
                    handleUpdateConfigCommand(command);
                    break;
                case SHUTDOWN:
                    handleShutdownCommand(command);
                    break;
                default:
                    System.err.println("未知的指令类型: " + command.getType());
            }
        } catch (Exception e) {
            System.err.println("处理调度中心指令时出错: " + e.getMessage());
        }
    }
    
    // 处理执行任务指令
    private void handleExecuteTaskCommand(ExecutorCommand command) {
        Task task = (Task) command.getPayload();
        if (task != null) {
            // 异步执行任务
            CompletableFuture.supplyAsync(() -> executeTask(task))
                .exceptionally(throwable -> {
                    System.err.println("异步执行任务失败: " + throwable.getMessage());
                    return null;
                });
        }
    }
    
    // 处理取消任务指令
    private void handleCancelTaskCommand(ExecutorCommand command) {
        String taskId = (String) command.getPayload();
        if (taskId != null) {
            cancelTask(taskId);
        }
    }
    
    // 处理配置更新指令
    private void handleUpdateConfigCommand(ExecutorCommand command) {
        ExecutorConfig config = (ExecutorConfig) command.getPayload();
        if (config != null) {
            updateConfig(config);
        }
    }
    
    // 处理关闭指令
    private void handleShutdownCommand(ExecutorCommand command) {
        System.out.println("收到关闭指令，正在停止执行节点...");
        stop();
    }
    
    // 注册到调度中心
    private void registerToSchedulingCenter() {
        try {
            // 实际应用中需要通过网络通信注册
            System.out.println("已注册到调度中心: " + schedulingCenterAddress);
        } catch (Exception e) {
            System.err.println("注册到调度中心失败: " + e.getMessage());
        }
    }
    
    // 注销从调度中心
    private void unregisterFromSchedulingCenter() {
        try {
            // 实际应用中需要通过网络通信注销
            System.out.println("已从调度中心注销: " + schedulingCenterAddress);
        } catch (Exception e) {
            System.err.println("从调度中心注销失败: " + e.getMessage());
        }
    }
    
    // 发送心跳到调度中心
    private void sendHeartbeatToSchedulingCenter(HeartbeatInfo heartbeat) {
        // 实际应用中需要通过网络通信发送
        System.out.println("心跳已发送到调度中心");
    }
    
    // 发送任务结果到调度中心
    private void sendTaskResultToSchedulingCenter(String taskId, TaskExecutionResult result) {
        // 实际应用中需要通过网络通信发送
        System.out.println("任务结果已发送到调度中心: " + taskId);
    }
}
```

## 功能特性对比分析

### 调度中心功能特性

```java
// 调度中心功能特性示例
public class SchedulingCenterFeatures {
    
    // 1. 任务生命周期管理
    public void taskLifecycleManagement() {
        // 创建任务
        TaskDefinition taskDef = new TaskDefinition();
        taskDef.setName("数据备份任务");
        taskDef.setHandler("DataBackupHandler");
        taskDef.setCronExpression("0 0 2 * * ?");
        
        // 调度中心.createTask(taskDef);
        
        // 更新任务
        // TaskDefinition updatedDef = new TaskDefinition();
        // updatedDef.setName("数据备份任务-更新");
        // 调度中心.updateTask("task-001", updatedDef);
        
        // 删除任务
        // 调度中心.deleteTask("task-001");
    }
    
    // 2. 任务调度控制
    public void taskSchedulingControl() {
        // 调度任务
        // 调度中心.scheduleTask("task-001");
        
        // 立即触发任务
        // 调度中心.triggerTask("task-001");
        
        // 暂停任务
        // 调度中心.pauseTask("task-001");
        
        // 恢复任务
        // 调度中心.resumeTask("task-001");
        
        // 取消任务
        // 调度中心.cancelTask("task-001");
    }
    
    // 3. 执行节点管理
    public void executorManagement() {
        // 注册执行节点
        // ExecutorNode executor = new ExecutorNodeImpl("executor-001", "localhost:8080");
        // 调度中心.registerExecutor(executor);
        
        // 注销执行节点
        // 调度中心.unregisterExecutor("executor-001");
        
        // 列出所有执行节点
        // List<ExecutorNode> executors = 调度中心.listExecutors();
        
        // 获取特定执行节点
        // ExecutorNode specificExecutor = 调度中心.getExecutor("executor-001");
    }
    
    // 4. 监控与告警
    public void monitoringAndAlerting() {
        // 获取任务统计信息
        // TaskStatistics stats = 调度中心.getTaskStatistics();
        
        // 获取任务执行历史
        // List<TaskExecutionRecord> history = 调度中心.getExecutionHistory("task-001");
        
        // 发送告警
        // Alert alert = new Alert(AlertLevel.ERROR, "TASK_FAILED", "任务执行失败");
        // 调度中心.sendAlert(alert);
    }
    
    // 5. 系统管理
    public void systemManagement() {
        // 启动调度中心
        // 调度中心.start();
        
        // 停止调度中心
        // 调度中心.stop();
        
        // 获取系统状态
        // SystemStatus status = 调度中心.getSystemStatus();
    }
}
```

### 执行节点功能特性

```java
// 执行节点功能特性示例
public class ExecutorNodeFeatures {
    
    // 1. 任务执行
    public void taskExecution() {
        // 执行任务
        // Task task = new Task();
        // TaskExecutionResult result = 执行节点.executeTask(task);
        
        // 取消任务
        // 执行节点.cancelTask("task-001");
        
        // 获取任务状态
        // TaskExecutionStatus status = 执行节点.getTaskStatus("task-001");
    }
    
    // 2. 节点管理
    public void nodeManagement() {
        // 启动执行节点
        // 执行节点.start();
        
        // 停止执行节点
        // 执行节点.stop();
        
        // 获取节点信息
        // ExecutorInfo info = 执行节点.getInfo();
        
        // 更新节点配置
        // ExecutorConfig config = new ExecutorConfig();
        // 执行节点.updateConfig(config);
    }
    
    // 3. 与调度中心通信
    public void communicationWithSchedulingCenter() {
        // 发送心跳
        // 执行节点.sendHeartbeat();
        
        // 报告任务结果
        // TaskExecutionResult result = new TaskExecutionResult(true, "执行成功");
        // 执行节点.reportTaskResult("task-001", result);
        
        // 处理调度中心指令
        // ExecutorCommand command = new ExecutorCommand(CommandType.EXECUTE_TASK, "executor-001", task);
        // 执行节点.handleCommand(command);
    }
}
```

## 调度中心与执行节点的交互机制

### 通信协议设计

```java
// 调度中心与执行节点通信协议
public class CommunicationProtocol {
    
    // 心跳协议
    public static class HeartbeatProtocol {
        // 心跳请求
        public static class HeartbeatRequest {
            private String executorId;
            private ExecutorStatus status;
            private int activeTaskCount;
            private long timestamp;
            private Map<String, Object> metrics;
            
            // 构造函数、Getters and Setters
        }
        
        // 心跳响应
        public static class HeartbeatResponse {
            private boolean success;
            private String message;
            private List<ExecutorCommand> commands;
            private long serverTime;
            
            // 构造函数、Getters and Setters
        }
    }
    
    // 任务执行协议
    public static class TaskExecutionProtocol {
        // 任务分配请求
        public static class TaskAssignmentRequest {
            private String taskId;
            private Task task;
            private long assignTime;
            
            // 构造函数、Getters and Setters
        }
        
        // 任务分配响应
        public static class TaskAssignmentResponse {
            private boolean accepted;
            private String message;
            private long acceptTime;
            
            // 构造函数、Getters and Setters
        }
        
        // 任务结果报告
        public static class TaskResultReport {
            private String taskId;
            private TaskExecutionResult result;
            private long reportTime;
            
            // 构造函数、Getters and Setters
        }
    }
    
    // 指令协议
    public static class CommandProtocol {
        // 指令下发
        public static class CommandRequest {
            private CommandType type;
            private String targetExecutorId;
            private Object payload;
            private long timestamp;
            
            // 构造函数、Getters and Setters
        }
        
        // 指令确认
        public static class CommandAck {
            private String commandId;
            private boolean success;
            private String message;
            private long ackTime;
            
            // 构造函数、Getters and Setters
        }
    }
}

// 网络通信客户端
public class CommunicationClient {
    private final String serverAddress;
    private final HttpClient httpClient;
    
    public CommunicationClient(String serverAddress) {
        this.serverAddress = serverAddress;
        this.httpClient = HttpClient.newHttpClient();
    }
    
    // 发送心跳
    public CommunicationProtocol.HeartbeatProtocol.HeartbeatResponse sendHeartbeat(
            CommunicationProtocol.HeartbeatProtocol.HeartbeatRequest request) {
        try {
            String url = serverAddress + "/api/heartbeat";
            String json = toJson(request);
            
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
                
            HttpResponse<String> response = httpClient.send(httpRequest, 
                HttpResponse.BodyHandlers.ofString());
                
            return fromJson(response.body(), 
                CommunicationProtocol.HeartbeatProtocol.HeartbeatResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("发送心跳失败", e);
        }
    }
    
    // 发送任务结果
    public boolean sendTaskResult(
            CommunicationProtocol.TaskExecutionProtocol.TaskResultReport report) {
        try {
            String url = serverAddress + "/api/task-result";
            String json = toJson(report);
            
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
                
            HttpResponse<String> response = httpClient.send(httpRequest, 
                HttpResponse.BodyHandlers.ofString());
                
            return response.statusCode() == 200;
        } catch (Exception e) {
            throw new RuntimeException("发送任务结果失败", e);
        }
    }
    
    // JSON序列化工具方法
    private String toJson(Object obj) {
        // 实际应用中使用Jackson、Gson等库
        return obj.toString();
    }
    
    // JSON反序列化工具方法
    private <T> T fromJson(String json, Class<T> clazz) {
        // 实际应用中使用Jackson、Gson等库
        return null;
    }
}
```

## 高可用性设计

### 调度中心高可用

```java
// 高可用调度中心集群
public class HighAvailabilitySchedulingCenter {
    private final List<SchedulingCenter> centers;
    private final LeaderElectionService leaderElectionService;
    private SchedulingCenter currentLeader;
    
    public HighAvailabilitySchedulingCenter(List<SchedulingCenter> centers) {
        this.centers = centers;
        this.leaderElectionService = new LeaderElectionService(centers);
    }
    
    // 启动高可用集群
    public void start() {
        // 启动所有调度中心节点
        for (SchedulingCenter center : centers) {
            center.start();
        }
        
        // 启动领导者选举服务
        leaderElectionService.start();
        
        System.out.println("高可用调度中心集群已启动");
    }
    
    // 停止高可用集群
    public void stop() {
        // 停止领导者选举服务
        leaderElectionService.stop();
        
        // 停止所有调度中心节点
        for (SchedulingCenter center : centers) {
            center.stop();
        }
        
        System.out.println("高可用调度中心集群已停止");
    }
    
    // 获取当前领导者
    public SchedulingCenter getCurrentLeader() {
        return leaderElectionService.getCurrentLeader();
    }
}

// 领导者选举服务
class LeaderElectionService {
    private final List<SchedulingCenter> centers;
    private final ScheduledExecutorService electionService;
    private volatile SchedulingCenter currentLeader;
    
    public LeaderElectionService(List<SchedulingCenter> centers) {
        this.centers = centers;
        this.electionService = Executors.newScheduledThreadPool(1);
    }
    
    public void start() {
        // 定期进行领导者选举
        electionService.scheduleAtFixedRate(this::electLeader, 0, 30, TimeUnit.SECONDS);
    }
    
    public void stop() {
        electionService.shutdown();
    }
    
    // 选举领导者
    public void electLeader() {
        try {
            // 简单的选举策略：选择第一个可用的节点作为领导者
            for (SchedulingCenter center : centers) {
                if (isCenterHealthy(center)) {
                    if (currentLeader != center) {
                        currentLeader = center;
                        System.out.println("新的领导者已选举: " + center.getClass().getSimpleName());
                        // 通知其他节点
                        notifyLeaderChange(center);
                    }
                    break;
                }
            }
        } catch (Exception e) {
            System.err.println("领导者选举失败: " + e.getMessage());
        }
    }
    
    // 检查调度中心健康状态
    private boolean isCenterHealthy(SchedulingCenter center) {
        try {
            SystemStatus status = center.getSystemStatus();
            return status.isRunning();
        } catch (Exception e) {
            return false;
        }
    }
    
    // 通知领导者变更
    private void notifyLeaderChange(SchedulingCenter newLeader) {
        // 通知所有节点领导者变更
        System.out.println("领导者变更通知已发送");
    }
    
    // 获取当前领导者
    public SchedulingCenter getCurrentLeader() {
        return currentLeader;
    }
}
```

### 执行节点高可用

```java
// 高可用执行节点组
public class HighAvailabilityExecutorGroup {
    private final String groupId;
    private final List<ExecutorNode> executors;
    private final LoadBalancer loadBalancer;
    
    public HighAvailabilityExecutorGroup(String groupId, List<ExecutorNode> executors) {
        this.groupId = groupId;
        this.executors = executors;
        this.loadBalancer = new RoundRobinLoadBalancer(executors);
    }
    
    // 启动执行节点组
    public void start() {
        for (ExecutorNode executor : executors) {
            executor.start();
        }
        System.out.println("执行节点组已启动: " + groupId);
    }
    
    // 停止执行节点组
    public void stop() {
        for (ExecutorNode executor : executors) {
            executor.stop();
        }
        System.out.println("执行节点组已停止: " + groupId);
    }
    
    // 获取健康的执行节点
    public ExecutorNode getHealthyExecutor() {
        return loadBalancer.selectExecutor();
    }
    
    // 检查节点组健康状态
    public boolean isHealthy() {
        return executors.stream().anyMatch(this::isExecutorHealthy);
    }
    
    // 检查执行节点健康状态
    private boolean isExecutorHealthy(ExecutorNode executor) {
        try {
            ExecutorInfo info = executor.getInfo();
            return info.getStatus() == ExecutorStatus.ONLINE || 
                   info.getStatus() == ExecutorStatus.BUSY;
        } catch (Exception e) {
            return false;
        }
    }
}

// 负载均衡器
interface LoadBalancer {
    ExecutorNode selectExecutor();
}

// 轮询负载均衡器
class RoundRobinLoadBalancer implements LoadBalancer {
    private final List<ExecutorNode> executors;
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    
    public RoundRobinLoadBalancer(List<ExecutorNode> executors) {
        this.executors = executors.stream()
            .filter(this::isExecutorAvailable)
            .collect(Collectors.toList());
    }
    
    @Override
    public ExecutorNode selectExecutor() {
        if (executors.isEmpty()) {
            return null;
        }
        
        int index = currentIndex.getAndIncrement() % executors.size();
        return executors.get(index);
    }
    
    // 检查执行节点是否可用
    private boolean isExecutorAvailable(ExecutorNode executor) {
        try {
            ExecutorInfo info = executor.getInfo();
            return info.getStatus() == ExecutorStatus.ONLINE;
        } catch (Exception e) {
            return false;
        }
    }
}
```

## 性能优化策略

### 调度中心性能优化

```java
// 调度中心性能优化策略
public class SchedulingCenterPerformanceOptimization {
    
    // 1. 任务批量处理
    public void batchTaskProcessing() {
        // 批量创建任务
        List<TaskDefinition> taskDefs = new ArrayList<>();
        // ... 添加任务定义
        
        // 调度中心.batchCreateTasks(taskDefs);
        
        // 批量调度任务
        List<String> taskIds = Arrays.asList("task-001", "task-002", "task-003");
        // 调度中心.batchScheduleTasks(taskIds);
    }
    
    // 2. 缓存优化
    public void cachingOptimization() {
        // 缓存热门任务信息
        // Cache<String, Task> taskCache = CacheBuilder.newBuilder()
        //     .maximumSize(1000)
        //     .expireAfterWrite(10, TimeUnit.MINUTES)
        //     .build();
        
        // 缓存执行节点信息
        // Cache<String, ExecutorNode> executorCache = CacheBuilder.newBuilder()
        //     .maximumSize(100)
        //     .expireAfterWrite(5, TimeUnit.MINUTES)
        //     .build();
    }
    
    // 3. 异步处理
    public void asyncProcessing() {
        // 异步处理任务调度
        // CompletableFuture.runAsync(() -> {
        //     调度中心.scheduleTask("task-001");
        // });
        
        // 异步处理监控数据
        // CompletableFuture.supplyAsync(() -> {
        //     return 调度中心.getTaskStatistics();
        // }).thenAccept(stats -> {
        //     // 处理统计信息
        // });
    }
    
    // 4. 数据库优化
    public void databaseOptimization() {
        // 使用连接池
        // HikariConfig config = new HikariConfig();
        // config.setMaximumPoolSize(20);
        // config.setMinimumIdle(5);
        // HikariDataSource dataSource = new HikariDataSource(config);
        
        // 使用索引优化查询
        // CREATE INDEX idx_task_status ON tasks(status);
        // CREATE INDEX idx_task_next_execution_time ON tasks(next_execution_time);
    }
}
```

### 执行节点性能优化

```java
// 执行节点性能优化策略
public class ExecutorNodePerformanceOptimization {
    
    // 1. 资源隔离
    public void resourceIsolation() {
        // 使用容器化技术隔离资源
        // Docker容器、Kubernetes Pod等
        
        // 使用线程池隔离不同类型的任务
        ExecutorService cpuIntensivePool = Executors.newFixedThreadPool(4);
        ExecutorService ioIntensivePool = Executors.newFixedThreadPool(10);
        
        // 根据任务类型选择合适的线程池
        // if (task.isCpuIntensive()) {
        //     cpuIntensivePool.submit(() -> executeTask(task));
        // } else {
        //     ioIntensivePool.submit(() -> executeTask(task));
        // }
    }
    
    // 2. 内存优化
    public void memoryOptimization() {
        // 使用对象池减少GC压力
        // GenericObjectPool<TaskContext> contextPool = new GenericObjectPool<>(
        //     new TaskContextFactory());
        
        // 及时释放大对象
        // try (InputStream inputStream = new FileInputStream(file)) {
        //     // 处理文件
        // } catch (IOException e) {
        //     // 处理异常
        // }
    }
    
    // 3. 并发控制
    public void concurrencyControl() {
        // 限制并发执行的任务数
        Semaphore taskSemaphore = new Semaphore(10);
        
        // 执行任务前获取许可
        // try {
        //     taskSemaphore.acquire();
        //     executeTask(task);
        // } finally {
        //     taskSemaphore.release();
        // }
    }
    
    // 4. 监控和调优
    public void monitoringAndTuning() {
        // 监控JVM性能指标
        // MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        // ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        
        // 记录任务执行时间
        // long startTime = System.currentTimeMillis();
        // executeTask(task);
        // long endTime = System.currentTimeMillis();
        // long executionTime = endTime - startTime;
    }
}
```

## 总结

调度中心与执行节点在分布式任务调度系统中各司其职，共同构成了完整的调度体系。调度中心负责全局的任务管理、调度决策和系统监控，而执行节点专注于任务的实际执行和结果反馈。

关键要点包括：

1. **职责分离**：调度中心负责"大脑"功能，执行节点负责"手脚"功能
2. **交互机制**：通过定义清晰的通信协议实现节点间协作
3. **高可用设计**：通过集群和负载均衡实现系统的高可用性
4. **性能优化**：通过缓存、异步处理、资源隔离等技术提升系统性能

在下一节中，我们将探讨状态存储与一致性问题，深入了解在分布式环境下如何保证任务状态的一致性和可靠性。
