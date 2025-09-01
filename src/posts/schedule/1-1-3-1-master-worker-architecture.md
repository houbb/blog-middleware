---
title: 3.1 Master/Worker 架构
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

Master/Worker架构是分布式任务调度系统中最基础也是最重要的架构模式之一。这种架构模式通过将系统的职责分离为管理节点（Master）和工作节点（Worker），实现了任务调度与执行的解耦，为构建高可用、可扩展的分布式调度系统奠定了基础。本文将深入探讨Master/Worker架构的设计原理、实现机制以及在实际应用中的最佳实践。

## Master/Worker架构概述

Master/Worker架构是一种经典的分布式系统设计模式，其中系统被划分为一个或多个管理节点（Master）和多个工作节点（Worker）。Master节点负责任务的调度、分配和监控，而Worker节点负责实际执行任务。

### 架构核心组件

```java
// Master节点接口
public interface MasterNode {
    /**
     * 启动Master节点
     */
    void start();
    
    /**
     * 停止Master节点
     */
    void stop();
    
    /**
     * 注册Worker节点
     * @param worker Worker节点信息
     */
    void registerWorker(WorkerNode worker);
    
    /**
     * 注销Worker节点
     * @param workerId Worker节点ID
     */
    void unregisterWorker(String workerId);
    
    /**
     * 分配任务给Worker
     * @param task 任务
     * @param workerId Worker节点ID
     * @return 是否分配成功
     */
    boolean assignTask(Task task, String workerId);
    
    /**
     * 监控Worker节点状态
     */
    void monitorWorkers();
    
    /**
     * 处理Worker节点心跳
     * @param workerId Worker节点ID
     * @param heartbeat 心跳信息
     */
    void handleWorkerHeartbeat(String workerId, HeartbeatInfo heartbeat);
}

// Worker节点接口
public interface WorkerNode {
    /**
     * 启动Worker节点
     */
    void start();
    
    /**
     * 停止Worker节点
     */
    void stop();
    
    /**
     * 获取Worker节点ID
     * @return Worker节点ID
     */
    String getId();
    
    /**
     * 获取Worker节点信息
     * @return Worker节点信息
     */
    WorkerInfo getInfo();
    
    /**
     * 执行任务
     * @param task 任务
     * @return 任务执行结果
     */
    TaskExecutionResult executeTask(Task task);
    
    /**
     * 发送心跳信息
     */
    void sendHeartbeat();
    
    /**
     * 处理Master节点指令
     * @param command 指令
     */
    void handleMasterCommand(MasterCommand command);
}

// Worker节点信息
public class WorkerInfo {
    private String id;
    private String host;
    private int port;
    private WorkerStatus status;
    private int taskCapacity;
    private int currentTaskCount;
    private long lastHeartbeatTime;
    private Map<String, Object> capabilities;
    
    // 构造函数
    public WorkerInfo(String id, String host, int port) {
        this.id = id;
        this.host = host;
        this.port = port;
        this.status = WorkerStatus.OFFLINE;
        this.taskCapacity = 10;
        this.currentTaskCount = 0;
        this.lastHeartbeatTime = 0;
        this.capabilities = new HashMap<>();
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    public WorkerStatus getStatus() { return status; }
    public void setStatus(WorkerStatus status) { this.status = status; }
    public int getTaskCapacity() { return taskCapacity; }
    public void setTaskCapacity(int taskCapacity) { this.taskCapacity = taskCapacity; }
    public int getCurrentTaskCount() { return currentTaskCount; }
    public void setCurrentTaskCount(int currentTaskCount) { this.currentTaskCount = currentTaskCount; }
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
    public Map<String, Object> getCapabilities() { return capabilities; }
    public void setCapabilities(Map<String, Object> capabilities) { this.capabilities = capabilities; }
}

// Worker节点状态枚举
enum WorkerStatus {
    OFFLINE,    // 离线
    ONLINE,     // 在线
    BUSY,       // 忙碌
    MAINTENANCE // 维护中
}

// 心跳信息
public class HeartbeatInfo {
    private String workerId;
    private WorkerStatus status;
    private int currentTaskCount;
    private long timestamp;
    private Map<String, Object> metrics;
    
    public HeartbeatInfo(String workerId, WorkerStatus status, int currentTaskCount) {
        this.workerId = workerId;
        this.status = status;
        this.currentTaskCount = currentTaskCount;
        this.timestamp = System.currentTimeMillis();
        this.metrics = new HashMap<>();
    }
    
    // Getters and Setters
    public String getWorkerId() { return workerId; }
    public WorkerStatus getStatus() { return status; }
    public int getCurrentTaskCount() { return currentTaskCount; }
    public long getTimestamp() { return timestamp; }
    public Map<String, Object> getMetrics() { return metrics; }
}

// Master节点指令
public class MasterCommand {
    private CommandType type;
    private String targetWorkerId;
    private Object payload;
    private long timestamp;
    
    public MasterCommand(CommandType type, String targetWorkerId, Object payload) {
        this.type = type;
        this.targetWorkerId = targetWorkerId;
        this.payload = payload;
        this.timestamp = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public CommandType getType() { return type; }
    public String getTargetWorkerId() { return targetWorkerId; }
    public Object getPayload() { return payload; }
    public long getTimestamp() { return timestamp; }
}

// 指令类型枚举
enum CommandType {
    ASSIGN_TASK,        // 分配任务
    CANCEL_TASK,        // 取消任务
    UPDATE_CONFIG,      // 更新配置
    SHUTDOWN,           // 关闭节点
    HEALTH_CHECK        // 健康检查
}
```

## Master节点实现

```java
// Master节点实现
public class MasterNodeImpl implements MasterNode {
    private final String nodeId;
    private final TaskStore taskStore;
    private final WorkerRegistry workerRegistry;
    private final TaskScheduler taskScheduler;
    private final ScheduledExecutorService monitorService;
    private final ScheduledExecutorService heartbeatService;
    private volatile boolean running = false;
    
    public MasterNodeImpl(String nodeId, TaskStore taskStore) {
        this.nodeId = nodeId;
        this.taskStore = taskStore;
        this.workerRegistry = new WorkerRegistry();
        this.taskScheduler = new TaskScheduler(taskStore, workerRegistry);
        this.monitorService = Executors.newScheduledThreadPool(2);
        this.heartbeatService = Executors.newScheduledThreadPool(1);
    }
    
    @Override
    public void start() {
        if (running) {
            throw new IllegalStateException("Master节点已在运行");
        }
        
        running = true;
        
        // 启动任务调度器
        taskScheduler.start();
        
        // 启动Worker监控服务
        monitorService.scheduleAtFixedRate(this::monitorWorkers, 0, 10, TimeUnit.SECONDS);
        
        // 启动心跳处理服务
        heartbeatService.scheduleAtFixedRate(this::processHeartbeats, 0, 5, TimeUnit.SECONDS);
        
        System.out.println("Master节点已启动: " + nodeId);
    }
    
    @Override
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        
        // 停止服务
        taskScheduler.stop();
        monitorService.shutdown();
        heartbeatService.shutdown();
        
        try {
            if (!monitorService.awaitTermination(5, TimeUnit.SECONDS)) {
                monitorService.shutdownNow();
            }
            if (!heartbeatService.awaitTermination(5, TimeUnit.SECONDS)) {
                heartbeatService.shutdownNow();
            }
        } catch (InterruptedException e) {
            monitorService.shutdownNow();
            heartbeatService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("Master节点已停止: " + nodeId);
    }
    
    @Override
    public void registerWorker(WorkerNode worker) {
        if (!running) {
            throw new IllegalStateException("Master节点未运行");
        }
        
        workerRegistry.registerWorker(worker);
        System.out.println("Worker节点已注册: " + worker.getId());
    }
    
    @Override
    public void unregisterWorker(String workerId) {
        workerRegistry.unregisterWorker(workerId);
        System.out.println("Worker节点已注销: " + workerId);
    }
    
    @Override
    public boolean assignTask(Task task, String workerId) {
        if (!running) {
            throw new IllegalStateException("Master节点未运行");
        }
        
        WorkerNode worker = workerRegistry.getWorker(workerId);
        if (worker == null) {
            System.err.println("Worker节点不存在: " + workerId);
            return false;
        }
        
        // 检查Worker节点状态
        WorkerInfo workerInfo = worker.getInfo();
        if (workerInfo.getStatus() != WorkerStatus.ONLINE && 
            workerInfo.getStatus() != WorkerStatus.BUSY) {
            System.err.println("Worker节点状态不正确: " + workerId + ", 状态: " + workerInfo.getStatus());
            return false;
        }
        
        // 发送任务分配指令
        MasterCommand command = new MasterCommand(
            CommandType.ASSIGN_TASK, workerId, task);
        worker.handleMasterCommand(command);
        
        System.out.println("任务已分配给Worker节点: " + workerId + ", 任务ID: " + task.getTaskId());
        return true;
    }
    
    @Override
    public void monitorWorkers() {
        if (!running) {
            return;
        }
        
        try {
            List<WorkerNode> workers = workerRegistry.getAllWorkers();
            
            for (WorkerNode worker : workers) {
                WorkerInfo workerInfo = worker.getInfo();
                long currentTime = System.currentTimeMillis();
                
                // 检查心跳超时
                long heartbeatTimeout = 30000; // 30秒
                if (currentTime - workerInfo.getLastHeartbeatTime() > heartbeatTimeout) {
                    System.err.println("Worker节点心跳超时: " + worker.getId());
                    // 将节点标记为离线
                    workerInfo.setStatus(WorkerStatus.OFFLINE);
                    // 重新调度该节点上的任务
                    rescheduleTasksFromWorker(worker.getId());
                }
                
                // 检查节点负载
                checkWorkerLoad(worker);
            }
        } catch (Exception e) {
            System.err.println("监控Worker节点时出错: " + e.getMessage());
        }
    }
    
    @Override
    public void handleWorkerHeartbeat(String workerId, HeartbeatInfo heartbeat) {
        WorkerNode worker = workerRegistry.getWorker(workerId);
        if (worker != null) {
            WorkerInfo workerInfo = worker.getInfo();
            workerInfo.setStatus(heartbeat.getStatus());
            workerInfo.setCurrentTaskCount(heartbeat.getCurrentTaskCount());
            workerInfo.setLastHeartbeatTime(heartbeat.getTimestamp());
            
            System.out.println("收到Worker节点心跳: " + workerId + 
                             ", 状态: " + heartbeat.getStatus() + 
                             ", 任务数: " + heartbeat.getCurrentTaskCount());
        }
    }
    
    // 重新调度Worker节点上的任务
    private void rescheduleTasksFromWorker(String workerId) {
        // 获取该Worker节点上的任务
        List<Task> tasks = taskStore.getTasksByWorker(workerId);
        
        for (Task task : tasks) {
            // 更新任务状态
            task.setAssignedWorker(null);
            task.setStatus(TaskStatus.PENDING);
            taskStore.updateTask(task);
            
            // 重新调度任务
            taskScheduler.scheduleTask(task);
        }
        
        System.out.println("已重新调度Worker节点 " + workerId + " 上的 " + tasks.size() + " 个任务");
    }
    
    // 检查Worker节点负载
    private void checkWorkerLoad(WorkerNode worker) {
        WorkerInfo workerInfo = worker.getInfo();
        
        // 计算负载比率
        double loadRatio = (double) workerInfo.getCurrentTaskCount() / workerInfo.getTaskCapacity();
        
        if (loadRatio > 0.8) {
            System.out.println("Worker节点负载过高: " + worker.getId() + 
                             ", 负载比率: " + String.format("%.2f", loadRatio));
        } else if (loadRatio < 0.2) {
            System.out.println("Worker节点负载过低: " + worker.getId() + 
                             ", 负载比率: " + String.format("%.2f", loadRatio));
        }
    }
    
    // 处理心跳信息
    private void processHeartbeats() {
        // 实际应用中可能需要批量处理心跳信息
        // 这里简化处理
    }
}

// Worker节点注册中心
class WorkerRegistry {
    private final Map<String, WorkerNode> registeredWorkers = new ConcurrentHashMap<>();
    private final Map<String, WorkerInfo> workerInfos = new ConcurrentHashMap<>();
    
    // 注册Worker节点
    public void registerWorker(WorkerNode worker) {
        registeredWorkers.put(worker.getId(), worker);
        workerInfos.put(worker.getId(), worker.getInfo());
    }
    
    // 注销Worker节点
    public void unregisterWorker(String workerId) {
        registeredWorkers.remove(workerId);
        workerInfos.remove(workerId);
    }
    
    // 获取Worker节点
    public WorkerNode getWorker(String workerId) {
        return registeredWorkers.get(workerId);
    }
    
    // 获取所有Worker节点
    public List<WorkerNode> getAllWorkers() {
        return new ArrayList<>(registeredWorkers.values());
    }
    
    // 获取在线Worker节点
    public List<WorkerNode> getOnlineWorkers() {
        return registeredWorkers.values().stream()
            .filter(worker -> worker.getInfo().getStatus() == WorkerStatus.ONLINE || 
                            worker.getInfo().getStatus() == WorkerStatus.BUSY)
            .collect(Collectors.toList());
    }
    
    // 根据负载选择Worker节点
    public WorkerNode selectWorkerByLoad() {
        return registeredWorkers.values().stream()
            .filter(worker -> worker.getInfo().getStatus() == WorkerStatus.ONLINE)
            .min(Comparator.comparingInt(worker -> worker.getInfo().getCurrentTaskCount()))
            .orElse(null);
    }
}
```

## Worker节点实现

```java
// Worker节点实现
public class WorkerNodeImpl implements WorkerNode {
    private final String nodeId;
    private final String masterAddress;
    private final TaskExecutor taskExecutor;
    private final ScheduledExecutorService heartbeatService;
    private final WorkerInfo workerInfo;
    private final Map<String, Task> executingTasks = new ConcurrentHashMap<>();
    private volatile boolean running = false;
    
    public WorkerNodeImpl(String nodeId, String masterAddress) {
        this.nodeId = nodeId;
        this.masterAddress = masterAddress;
        this.taskExecutor = new TaskExecutor();
        this.heartbeatService = Executors.newScheduledThreadPool(1);
        this.workerInfo = new WorkerInfo(nodeId, "localhost", 8080);
    }
    
    @Override
    public void start() {
        if (running) {
            throw new IllegalStateException("Worker节点已在运行");
        }
        
        running = true;
        workerInfo.setStatus(WorkerStatus.ONLINE);
        
        // 启动任务执行器
        taskExecutor.start();
        
        // 启动心跳服务
        heartbeatService.scheduleAtFixedRate(this::sendHeartbeat, 0, 5, TimeUnit.SECONDS);
        
        // 注册到Master节点
        registerToMaster();
        
        System.out.println("Worker节点已启动: " + nodeId);
    }
    
    @Override
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        workerInfo.setStatus(WorkerStatus.OFFLINE);
        
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
        
        // 注销从Master节点
        unregisterFromMaster();
        
        System.out.println("Worker节点已停止: " + nodeId);
    }
    
    @Override
    public String getId() {
        return nodeId;
    }
    
    @Override
    public WorkerInfo getInfo() {
        return workerInfo;
    }
    
    @Override
    public TaskExecutionResult executeTask(Task task) {
        if (!running) {
            throw new IllegalStateException("Worker节点未运行");
        }
        
        // 更新节点状态
        workerInfo.setCurrentTaskCount(workerInfo.getCurrentTaskCount() + 1);
        if (workerInfo.getCurrentTaskCount() >= workerInfo.getTaskCapacity()) {
            workerInfo.setStatus(WorkerStatus.BUSY);
        }
        
        // 记录正在执行的任务
        executingTasks.put(task.getTaskId(), task);
        
        try {
            System.out.println("开始执行任务: " + task.getTaskId() + " 在节点: " + nodeId);
            
            // 执行任务
            TaskExecutionResult result = taskExecutor.executeTask(task);
            
            System.out.println("任务执行完成: " + task.getTaskId() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
            
            return result;
        } catch (Exception e) {
            System.err.println("执行任务失败: " + task.getTaskId() + ", 错误: " + e.getMessage());
            throw e;
        } finally {
            // 清理执行记录
            executingTasks.remove(task.getTaskId());
            
            // 更新节点状态
            workerInfo.setCurrentTaskCount(workerInfo.getCurrentTaskCount() - 1);
            if (workerInfo.getCurrentTaskCount() < workerInfo.getTaskCapacity()) {
                workerInfo.setStatus(WorkerStatus.ONLINE);
            }
        }
    }
    
    @Override
    public void sendHeartbeat() {
        if (!running) {
            return;
        }
        
        try {
            // 创建心跳信息
            HeartbeatInfo heartbeat = new HeartbeatInfo(
                nodeId, workerInfo.getStatus(), workerInfo.getCurrentTaskCount());
            
            // 发送心跳到Master节点
            sendHeartbeatToMaster(heartbeat);
            
            workerInfo.setLastHeartbeatTime(System.currentTimeMillis());
        } catch (Exception e) {
            System.err.println("发送心跳失败: " + e.getMessage());
        }
    }
    
    @Override
    public void handleMasterCommand(MasterCommand command) {
        if (!running) {
            return;
        }
        
        try {
            switch (command.getType()) {
                case ASSIGN_TASK:
                    handleAssignTaskCommand(command);
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
                case HEALTH_CHECK:
                    handleHealthCheckCommand(command);
                    break;
                default:
                    System.err.println("未知的指令类型: " + command.getType());
            }
        } catch (Exception e) {
            System.err.println("处理Master节点指令时出错: " + e.getMessage());
        }
    }
    
    // 处理任务分配指令
    private void handleAssignTaskCommand(MasterCommand command) {
        Task task = (Task) command.getPayload();
        if (task != null) {
            // 异步执行任务
            CompletableFuture.supplyAsync(() -> executeTask(task))
                .thenAccept(result -> {
                    // 发送执行结果到Master节点
                    sendTaskResultToMaster(task, result);
                })
                .exceptionally(throwable -> {
                    // 发送执行失败信息到Master节点
                    sendTaskFailureToMaster(task, throwable);
                    return null;
                });
        }
    }
    
    // 处理任务取消指令
    private void handleCancelTaskCommand(MasterCommand command) {
        String taskId = (String) command.getPayload();
        if (taskId != null) {
            // 取消正在执行的任务
            taskExecutor.cancelTask(taskId);
            executingTasks.remove(taskId);
            
            System.out.println("任务已取消: " + taskId);
        }
    }
    
    // 处理配置更新指令
    private void handleUpdateConfigCommand(MasterCommand command) {
        Map<String, Object> config = (Map<String, Object>) command.getPayload();
        if (config != null) {
            // 更新Worker配置
            updateWorkerConfig(config);
            System.out.println("Worker配置已更新");
        }
    }
    
    // 处理关闭指令
    private void handleShutdownCommand(MasterCommand command) {
        System.out.println("收到关闭指令，正在停止Worker节点...");
        stop();
    }
    
    // 处理健康检查指令
    private void handleHealthCheckCommand(MasterCommand command) {
        // 发送健康状态到Master节点
        sendHealthStatusToMaster();
    }
    
    // 注册到Master节点
    private void registerToMaster() {
        try {
            // 实际应用中需要通过网络通信注册
            // 这里简化处理
            System.out.println("已注册到Master节点: " + masterAddress);
        } catch (Exception e) {
            System.err.println("注册到Master节点失败: " + e.getMessage());
        }
    }
    
    // 注销从Master节点
    private void unregisterFromMaster() {
        try {
            // 实际应用中需要通过网络通信注销
            // 这里简化处理
            System.out.println("已从Master节点注销: " + masterAddress);
        } catch (Exception e) {
            System.err.println("从Master节点注销失败: " + e.getMessage());
        }
    }
    
    // 发送心跳到Master节点
    private void sendHeartbeatToMaster(HeartbeatInfo heartbeat) {
        // 实际应用中需要通过网络通信发送
        // 这里简化处理
        System.out.println("心跳已发送到Master节点");
    }
    
    // 发送任务结果到Master节点
    private void sendTaskResultToMaster(Task task, TaskExecutionResult result) {
        // 实际应用中需要通过网络通信发送
        // 这里简化处理
        System.out.println("任务结果已发送到Master节点: " + task.getTaskId());
    }
    
    // 发送任务失败信息到Master节点
    private void sendTaskFailureToMaster(Task task, Throwable throwable) {
        // 实际应用中需要通过网络通信发送
        // 这里简化处理
        System.out.println("任务失败信息已发送到Master节点: " + task.getTaskId());
    }
    
    // 发送健康状态到Master节点
    private void sendHealthStatusToMaster() {
        // 实际应用中需要通过网络通信发送
        // 这里简化处理
        System.out.println("健康状态已发送到Master节点");
    }
    
    // 更新Worker配置
    private void updateWorkerConfig(Map<String, Object> config) {
        // 实际应用中需要更新Worker配置
        // 这里简化处理
        System.out.println("Worker配置更新完成");
    }
}

// 任务执行器
class TaskExecutor {
    private final ExecutorService taskExecutionService;
    private final Map<String, Future<?>> executingTasks = new ConcurrentHashMap<>();
    private volatile boolean running = false;
    
    public TaskExecutor() {
        this.taskExecutionService = Executors.newFixedThreadPool(10);
    }
    
    public void start() {
        running = true;
        System.out.println("任务执行器已启动");
    }
    
    public void stop() {
        running = false;
        
        // 取消所有正在执行的任务
        for (Future<?> future : executingTasks.values()) {
            future.cancel(true);
        }
        executingTasks.clear();
        
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
        
        System.out.println("任务执行器已停止");
    }
    
    // 执行任务
    public TaskExecutionResult executeTask(Task task) {
        if (!running) {
            throw new IllegalStateException("任务执行器未运行");
        }
        
        try {
            // 创建执行上下文
            TaskExecutionContext context = new TaskExecutionContext(task, "worker");
            
            // 执行任务
            TaskExecutionResult result = task.execute(context);
            
            return result;
        } catch (Exception e) {
            throw new RuntimeException("任务执行失败", e);
        }
    }
    
    // 异步执行任务
    public Future<TaskExecutionResult> executeTaskAsync(Task task) {
        Future<TaskExecutionResult> future = taskExecutionService.submit(() -> executeTask(task));
        executingTasks.put(task.getTaskId(), future);
        
        // 任务完成后清理记录
        future.thenRun(() -> executingTasks.remove(task.getTaskId()));
        
        return future;
    }
    
    // 取消任务
    public boolean cancelTask(String taskId) {
        Future<?> future = executingTasks.get(taskId);
        if (future != null) {
            boolean cancelled = future.cancel(true);
            executingTasks.remove(taskId);
            return cancelled;
        }
        return false;
    }
}
```

## 任务调度器实现

```java
// 任务调度器
public class TaskScheduler {
    private final TaskStore taskStore;
    private final WorkerRegistry workerRegistry;
    private final ScheduledExecutorService schedulerService;
    private volatile boolean running = false;
    
    public TaskScheduler(TaskStore taskStore, WorkerRegistry workerRegistry) {
        this.taskStore = taskStore;
        this.workerRegistry = workerRegistry;
        this.schedulerService = Executors.newScheduledThreadPool(2);
    }
    
    public void start() {
        if (running) {
            throw new IllegalStateException("任务调度器已在运行");
        }
        
        running = true;
        
        // 启动任务扫描器
        schedulerService.scheduleAtFixedRate(this::scanAndScheduleTasks, 0, 1, TimeUnit.SECONDS);
        
        System.out.println("任务调度器已启动");
    }
    
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        schedulerService.shutdown();
        
        try {
            if (!schedulerService.awaitTermination(5, TimeUnit.SECONDS)) {
                schedulerService.shutdownNow();
            }
        } catch (InterruptedException e) {
            schedulerService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("任务调度器已停止");
    }
    
    // 扫描并调度任务
    public void scanAndScheduleTasks() {
        if (!running) {
            return;
        }
        
        try {
            // 获取所有待处理的任务
            List<Task> pendingTasks = taskStore.getTasksByStatus(TaskStatus.PENDING);
            
            for (Task task : pendingTasks) {
                // 调度任务
                scheduleTask(task);
            }
        } catch (Exception e) {
            System.err.println("扫描任务时出错: " + e.getMessage());
        }
    }
    
    // 调度任务
    public void scheduleTask(Task task) {
        // 选择合适的Worker节点
        WorkerNode selectedWorker = selectWorkerForTask(task);
        
        if (selectedWorker != null) {
            // 分配任务给Worker节点
            assignTaskToWorker(task, selectedWorker);
        } else {
            System.err.println("没有可用的Worker节点，任务调度失败: " + task.getTaskId());
        }
    }
    
    // 为任务选择Worker节点
    private WorkerNode selectWorkerForTask(Task task) {
        // 获取所有在线的Worker节点
        List<WorkerNode> onlineWorkers = workerRegistry.getOnlineWorkers();
        
        if (onlineWorkers.isEmpty()) {
            return null;
        }
        
        // 根据任务特性和Worker能力进行匹配
        return matchWorkerForTask(task, onlineWorkers);
    }
    
    // 匹配Worker节点和任务
    private WorkerNode matchWorkerForTask(Task task, List<WorkerNode> workers) {
        // 简单的负载均衡策略：选择任务数最少的节点
        return workers.stream()
            .min(Comparator.comparingInt(worker -> worker.getInfo().getCurrentTaskCount()))
            .orElse(null);
    }
    
    // 分配任务给Worker节点
    private void assignTaskToWorker(Task task, WorkerNode worker) {
        try {
            // 更新任务状态
            task.setStatus(TaskStatus.SCHEDULED);
            task.setAssignedWorker(worker.getId());
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
            
            // 分配任务给Worker
            MasterCommand command = new MasterCommand(
                CommandType.ASSIGN_TASK, worker.getId(), task);
            worker.handleMasterCommand(command);
            
            System.out.println("任务已分配给Worker节点: " + worker.getId() + 
                             ", 任务ID: " + task.getTaskId());
        } catch (Exception e) {
            System.err.println("分配任务给Worker节点失败: " + e.getMessage());
            // 回滚任务状态
            task.setStatus(TaskStatus.PENDING);
            task.setAssignedWorker(null);
            taskStore.updateTask(task);
        }
    }
}
```

## Master/Worker架构的优势与挑战

### 架构优势

1. **职责分离**：Master负责调度和管理，Worker负责执行，职责清晰
2. **可扩展性**：可以动态增加Worker节点来提升处理能力
3. **容错性**：单个Worker节点故障不会影响整个系统
4. **负载均衡**：Master可以根据Worker节点负载情况合理分配任务

### 架构挑战

1. **单点故障**：Master节点故障可能导致整个系统不可用
2. **网络通信**：Master与Worker之间的网络通信可能成为瓶颈
3. **状态同步**：需要保证系统状态的一致性
4. **复杂性**：相比单机系统，分布式系统的设计和维护更加复杂

## 高可用Master设计

```java
// 高可用Master节点
public class HighAvailabilityMaster {
    private final List<MasterNode> masterNodes;
    private final LeaderElectionService leaderElectionService;
    private MasterNode currentLeader;
    
    public HighAvailabilityMaster(List<MasterNode> masterNodes) {
        this.masterNodes = masterNodes;
        this.leaderElectionService = new LeaderElectionService(masterNodes);
    }
    
    // 启动高可用Master集群
    public void start() {
        // 启动所有Master节点
        for (MasterNode master : masterNodes) {
            master.start();
        }
        
        // 启动领导者选举服务
        leaderElectionService.start();
        
        System.out.println("高可用Master集群已启动");
    }
    
    // 停止高可用Master集群
    public void stop() {
        // 停止领导者选举服务
        leaderElectionService.stop();
        
        // 停止所有Master节点
        for (MasterNode master : masterNodes) {
            master.stop();
        }
        
        System.out.println("高可用Master集群已停止");
    }
    
    // 获取当前领导者
    public MasterNode getCurrentLeader() {
        return leaderElectionService.getCurrentLeader();
    }
}

// 领导者选举服务
class LeaderElectionService {
    private final List<MasterNode> masterNodes;
    private final ScheduledExecutorService electionService;
    private volatile MasterNode currentLeader;
    
    public LeaderElectionService(List<MasterNode> masterNodes) {
        this.masterNodes = masterNodes;
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
            for (MasterNode master : masterNodes) {
                if (isMasterHealthy(master)) {
                    if (currentLeader != master) {
                        currentLeader = master;
                        System.out.println("新的领导者已选举: " + master.getClass().getSimpleName());
                        // 通知其他节点
                        notifyLeaderChange(master);
                    }
                    break;
                }
            }
        } catch (Exception e) {
            System.err.println("领导者选举失败: " + e.getMessage());
        }
    }
    
    // 检查Master节点健康状态
    private boolean isMasterHealthy(MasterNode master) {
        // 实际应用中需要检查Master节点的健康状态
        // 这里简化处理
        return true;
    }
    
    // 通知领导者变更
    private void notifyLeaderChange(MasterNode newLeader) {
        // 通知所有节点领导者变更
        System.out.println("领导者变更通知已发送");
    }
    
    // 获取当前领导者
    public MasterNode getCurrentLeader() {
        return currentLeader;
    }
}
```

## 总结

Master/Worker架构作为分布式任务调度系统的基础架构模式，通过将管理职责和执行职责分离，为构建高可用、可扩展的调度系统提供了良好的基础。在实际应用中，我们需要根据具体的业务需求和系统规模，合理设计Master和Worker节点的功能，同时考虑高可用性、容错性和性能优化等方面。

关键要点包括：

1. **架构设计**：明确Master和Worker的职责分工
2. **通信机制**：建立可靠的节点间通信机制
3. **负载均衡**：实现合理的任务分配策略
4. **高可用性**：设计Master节点的高可用方案
5. **监控告警**：建立完善的系统监控和告警机制

在下一节中，我们将探讨调度中心与执行节点的详细对比，深入了解两者在分布式调度系统中的不同角色和功能。