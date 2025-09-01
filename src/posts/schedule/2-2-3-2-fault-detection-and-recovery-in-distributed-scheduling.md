---
title: 4.2 分布式任务调度中的故障检测与恢复机制
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，故障是不可避免的。节点可能会因为网络问题、硬件故障、软件异常等原因而失效。为了保证系统的高可用性和任务执行的可靠性，必须建立完善的故障检测与恢复机制。本文将深入探讨分布式任务调度中的故障检测方法和恢复策略，帮助构建更加健壮的调度系统。

## 故障检测的核心概念

故障检测是分布式系统中的一项基础功能，它能够及时发现系统中的异常节点，为后续的恢复操作提供依据。

### 故障类型分析

```java
// 分布式调度系统中的故障类型
public class FaultTypes {
    
    /*
     * 分布式任务调度系统中常见的故障类型：
     * 1. 节点故障 - 执行节点或调度节点宕机
     * 2. 网络故障 - 节点间通信中断或延迟过高
     * 3. 任务故障 - 任务执行过程中出现异常
     * 4. 存储故障 - 数据库或存储系统不可用
     * 5. 资源故障 - CPU、内存、磁盘等资源耗尽
     * 6. 时钟故障 - 节点间时钟不同步
     */
    
    // 故障类型枚举
    public enum FaultType {
        NODE_FAILURE("节点故障", 1),
        NETWORK_FAILURE("网络故障", 2),
        TASK_FAILURE("任务故障", 3),
        STORAGE_FAILURE("存储故障", 4),
        RESOURCE_FAILURE("资源故障", 5),
        CLOCK_FAILURE("时钟故障", 6);
        
        private final String description;
        private final int severity;
        
        FaultType(String description, int severity) {
            this.description = description;
            this.severity = severity;
        }
        
        public String getDescription() { return description; }
        public int getSeverity() { return severity; }
    }
    
    // 故障信息实体类
    public class FaultInfo {
        private String faultId;          // 故障ID
        private FaultType faultType;     // 故障类型
        private String nodeId;           // 故障节点ID
        private String description;      // 故障描述
        private Date detectTime;         // 检测时间
        private Date recoverTime;        // 恢复时间
        private FaultStatus status;      // 故障状态
        private int retryCount;          // 重试次数
        private String errorMessage;     // 错误信息
        private Map<String, Object> context; // 上下文信息
        
        // 构造函数
        public FaultInfo(FaultType faultType, String nodeId) {
            this.faultId = UUID.randomUUID().toString();
            this.faultType = faultType;
            this.nodeId = nodeId;
            this.detectTime = new Date();
            this.status = FaultStatus.DETECTED;
            this.retryCount = 0;
            this.context = new HashMap<>();
        }
        
        // Getters and Setters
        public String getFaultId() { return faultId; }
        public void setFaultId(String faultId) { this.faultId = faultId; }
        
        public FaultType getFaultType() { return faultType; }
        public void setFaultType(FaultType faultType) { this.faultType = faultType; }
        
        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        
        public Date getDetectTime() { return detectTime; }
        public void setDetectTime(Date detectTime) { this.detectTime = detectTime; }
        
        public Date getRecoverTime() { return recoverTime; }
        public void setRecoverTime(Date recoverTime) { this.recoverTime = recoverTime; }
        
        public FaultStatus getStatus() { return status; }
        public void setStatus(FaultStatus status) { this.status = status; }
        
        public int getRetryCount() { return retryCount; }
        public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
        
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
        
        public Map<String, Object> getContext() { return context; }
        public void setContext(Map<String, Object> context) { this.context = context; }
        
        // 添加上下文信息
        public void addContext(String key, Object value) {
            this.context.put(key, value);
        }
    }
    
    // 故障状态枚举
    public enum FaultStatus {
        DETECTED("已检测"),      // 故障已检测到
        HANDLING("处理中"),      // 正在处理故障
        RECOVERED("已恢复"),     // 故障已恢复
        FAILED("处理失败");      // 故障处理失败
        
        private final String description;
        
        FaultStatus(String description) {
            this.description = description;
        }
        
        public String getDescription() { return description; }
    }
}
```

### 故障检测的基本要求

```java
// 故障检测的基本要求
public class FaultDetectionRequirements {
    
    /*
     * 故障检测需要满足的基本要求：
     * 1. 及时性 - 能够快速检测到故障
     * 2. 准确性 - 准确识别故障类型和位置
     * 3. 完备性 - 能够检测各种类型的故障
     * 4. 容错性 - 检测机制本身具有容错能力
     * 5. 可扩展性 - 能够适应系统规模的扩展
     */
    
    // 故障检测指标
    public class DetectionMetrics {
        private double detectionTime;        // 平均检测时间
        private double falsePositiveRate;    // 误报率
        private double falseNegativeRate;    // 漏报率
        private double accuracy;             // 检测准确率
        private int totalDetections;         // 总检测次数
        private int falsePositives;          // 误报次数
        private int falseNegatives;          // 漏报次数
        
        // 计算准确率
        public double calculateAccuracy() {
            if (totalDetections == 0) return 0;
            return (double) (totalDetections - falsePositives - falseNegatives) / totalDetections;
        }
        
        // 计算误报率
        public double calculateFalsePositiveRate() {
            if (totalDetections == 0) return 0;
            return (double) falsePositives / totalDetections;
        }
        
        // 计算漏报率
        public double calculateFalseNegativeRate() {
            if (totalDetections == 0) return 0;
            return (double) falseNegatives / totalDetections;
        }
        
        // Getters and Setters
        public double getDetectionTime() { return detectionTime; }
        public void setDetectionTime(double detectionTime) { this.detectionTime = detectionTime; }
        
        public double getFalsePositiveRate() { return falsePositiveRate; }
        public void setFalsePositiveRate(double falsePositiveRate) { this.falsePositiveRate = falsePositiveRate; }
        
        public double getFalseNegativeRate() { return falseNegativeRate; }
        public void setFalseNegativeRate(double falseNegativeRate) { this.falseNegativeRate = falseNegativeRate; }
        
        public double getAccuracy() { return accuracy; }
        public void setAccuracy(double accuracy) { this.accuracy = accuracy; }
        
        public int getTotalDetections() { return totalDetections; }
        public void setTotalDetections(int totalDetections) { this.totalDetections = totalDetections; }
        
        public int getFalsePositives() { return falsePositives; }
        public void setFalsePositives(int falsePositives) { this.falsePositives = falsePositives; }
        
        public int getFalseNegatives() { return falseNegatives; }
        public void setFalseNegatives(int falseNegatives) { this.falseNegatives = falseNegatives; }
    }
}
```

## 心跳检测机制

心跳检测是最常用的故障检测方法，通过定期发送心跳消息来确认节点的存活状态。

### 心跳检测实现

```java
// 心跳检测服务
public class HeartbeatDetectionService {
    private final Map<String, NodeHealthInfo> nodeHealthMap = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatScheduler;
    private final NodeStatusChangeListener statusChangeListener;
    private final long heartbeatInterval;  // 心跳间隔(毫秒)
    private final long failureTimeout;     // 故障超时时间(毫秒)
    
    public HeartbeatDetectionService(NodeStatusChangeListener listener, 
                                   long heartbeatInterval, long failureTimeout) {
        this.statusChangeListener = listener;
        this.heartbeatInterval = heartbeatInterval;
        this.failureTimeout = failureTimeout;
        this.heartbeatScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 启动心跳检测
    public void start() {
        // 定期检查节点状态
        heartbeatScheduler.scheduleAtFixedRate(this::checkNodeHealth, 
            heartbeatInterval, heartbeatInterval, TimeUnit.MILLISECONDS);
        System.out.println("心跳检测服务已启动");
    }
    
    // 停止心跳检测
    public void stop() {
        heartbeatScheduler.shutdown();
        try {
            if (!heartbeatScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                heartbeatScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            heartbeatScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("心跳检测服务已停止");
    }
    
    // 接收心跳消息
    public void receiveHeartbeat(String nodeId, NodeMetrics metrics) {
        NodeHealthInfo healthInfo = nodeHealthMap.computeIfAbsent(nodeId, 
            k -> new NodeHealthInfo(nodeId));
        
        // 更新节点健康信息
        healthInfo.setLastHeartbeatTime(System.currentTimeMillis());
        healthInfo.setMetrics(metrics);
        healthInfo.setHealthy(true);
        
        // 如果节点之前是不健康的，现在变为健康状态
        if (!healthInfo.wasHealthy()) {
            healthInfo.setWasHealthy(true);
            if (statusChangeListener != null) {
                statusChangeListener.onNodeRecovered(nodeId);
            }
            System.out.println("节点恢复健康: " + nodeId);
        }
    }
    
    // 检查节点健康状态
    private void checkNodeHealth() {
        long currentTime = System.currentTimeMillis();
        Iterator<Map.Entry<String, NodeHealthInfo>> iterator = 
            nodeHealthMap.entrySet().iterator();
        
        while (iterator.hasNext()) {
            Map.Entry<String, NodeHealthInfo> entry = iterator.next();
            NodeHealthInfo healthInfo = entry.getValue();
            
            // 检查节点是否超时
            if (currentTime - healthInfo.getLastHeartbeatTime() > failureTimeout) {
                // 节点超时，标记为不健康
                if (healthInfo.isHealthy()) {
                    healthInfo.setHealthy(false);
                    if (statusChangeListener != null) {
                        statusChangeListener.onNodeFailed(healthInfo.getNodeId());
                    }
                    System.out.println("节点故障检测: " + healthInfo.getNodeId());
                    
                    // 记录故障信息
                    recordFaultInfo(healthInfo);
                }
            }
        }
    }
    
    // 记录故障信息
    private void recordFaultInfo(NodeHealthInfo healthInfo) {
        FaultInfo faultInfo = new FaultInfo(FaultTypes.FaultType.NODE_FAILURE, 
                                          healthInfo.getNodeId());
        faultInfo.setDescription("节点心跳超时");
        faultInfo.setErrorMessage("超过 " + failureTimeout + " 毫秒未收到心跳");
        faultInfo.addContext("lastHeartbeatTime", new Date(healthInfo.getLastHeartbeatTime()));
        faultInfo.addContext("currentTime", new Date(System.currentTimeMillis()));
        
        // 这里可以将故障信息保存到数据库或日志中
        System.out.println("记录故障信息: " + faultInfo.getFaultId());
    }
    
    // 获取节点健康信息
    public NodeHealthInfo getNodeHealth(String nodeId) {
        return nodeHealthMap.get(nodeId);
    }
    
    // 获取所有不健康的节点
    public List<String> getUnhealthyNodes() {
        return nodeHealthMap.values().stream()
            .filter(info -> !info.isHealthy())
            .map(NodeHealthInfo::getNodeId)
            .collect(Collectors.toList());
    }
    
    // 节点状态变化监听器
    public interface NodeStatusChangeListener {
        void onNodeFailed(String nodeId);
        void onNodeRecovered(String nodeId);
    }
}

// 节点健康信息
class NodeHealthInfo {
    private String nodeId;              // 节点ID
    private long lastHeartbeatTime;     // 最后心跳时间
    private NodeMetrics metrics;        // 节点指标
    private boolean healthy;            // 是否健康
    private boolean wasHealthy = true;  // 上次是否健康
    
    public NodeHealthInfo(String nodeId) {
        this.nodeId = nodeId;
        this.lastHeartbeatTime = System.currentTimeMillis();
        this.healthy = true;
    }
    
    // Getters and Setters
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
    
    public NodeMetrics getMetrics() { return metrics; }
    public void setMetrics(NodeMetrics metrics) { this.metrics = metrics; }
    
    public boolean isHealthy() { return healthy; }
    public void setHealthy(boolean healthy) { this.healthy = healthy; }
    
    public boolean wasHealthy() { return wasHealthy; }
    public void setWasHealthy(boolean wasHealthy) { this.wasHealthy = wasHealthy; }
}

// 节点指标信息
class NodeMetrics {
    private double cpuUsage;        // CPU使用率
    private long memoryUsage;       // 内存使用量
    private long diskUsage;         // 磁盘使用量
    private int activeTasks;        // 活跃任务数
    private long networkLatency;    // 网络延迟
    
    // Getters and Setters
    public double getCpuUsage() { return cpuUsage; }
    public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
    
    public long getMemoryUsage() { return memoryUsage; }
    public void setMemoryUsage(long memoryUsage) { this.memoryUsage = memoryUsage; }
    
    public long getDiskUsage() { return diskUsage; }
    public void setDiskUsage(long diskUsage) { this.diskUsage = diskUsage; }
    
    public int getActiveTasks() { return activeTasks; }
    public void setActiveTasks(int activeTasks) { this.activeTasks = activeTasks; }
    
    public long getNetworkLatency() { return networkLatency; }
    public void setNetworkLatency(long networkLatency) { this.networkLatency = networkLatency; }
}
```

### 基于 RPC 的健康检查

```java
// 基于 RPC 的健康检查实现
public class RpcHealthCheckService {
    private final Map<String, NodeEndpoint> nodeEndpoints = new ConcurrentHashMap<>();
    private final ScheduledExecutorService healthCheckScheduler;
    private final HealthCheckListener listener;
    private final long checkInterval;
    private final int timeoutMs;
    
    public RpcHealthCheckService(HealthCheckListener listener, 
                               long checkInterval, int timeoutMs) {
        this.listener = listener;
        this.checkInterval = checkInterval;
        this.timeoutMs = timeoutMs;
        this.healthCheckScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 添加节点端点
    public void addNodeEndpoint(String nodeId, String address, int port) {
        nodeEndpoints.put(nodeId, new NodeEndpoint(nodeId, address, port));
    }
    
    // 启动健康检查
    public void start() {
        healthCheckScheduler.scheduleAtFixedRate(this::performHealthChecks,
            checkInterval, checkInterval, TimeUnit.MILLISECONDS);
        System.out.println("RPC健康检查服务已启动");
    }
    
    // 停止健康检查
    public void stop() {
        healthCheckScheduler.shutdown();
        try {
            if (!healthCheckScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                healthCheckScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            healthCheckScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("RPC健康检查服务已停止");
    }
    
    // 执行健康检查
    private void performHealthChecks() {
        for (NodeEndpoint endpoint : nodeEndpoints.values()) {
            CompletableFuture.supplyAsync(() -> checkNodeHealth(endpoint))
                .orTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .whenComplete((result, throwable) -> {
                    if (throwable != null) {
                        // 健康检查超时或失败
                        handleHealthCheckFailure(endpoint, throwable);
                    } else if (!result) {
                        // 节点不健康
                        handleNodeUnhealthy(endpoint);
                    } else {
                        // 节点健康
                        handleNodeHealthy(endpoint);
                    }
                });
        }
    }
    
    // 检查节点健康
    private boolean checkNodeHealth(NodeEndpoint endpoint) {
        try {
            // 创建 RPC 客户端连接
            // 这里使用一个简化的示例，实际应用中需要根据具体的 RPC 框架实现
            HealthCheckClient client = new HealthCheckClient(endpoint.getAddress(), 
                                                           endpoint.getPort());
            
            // 调用健康检查接口
            HealthCheckResponse response = client.checkHealth();
            
            // 更新节点指标
            endpoint.setLastCheckTime(System.currentTimeMillis());
            endpoint.setHealthy(response.isHealthy());
            endpoint.setMetrics(response.getMetrics());
            
            return response.isHealthy();
        } catch (Exception e) {
            System.err.println("健康检查失败: " + endpoint.getNodeId() + ", 错误: " + e.getMessage());
            return false;
        }
    }
    
    // 处理健康检查失败
    private void handleHealthCheckFailure(NodeEndpoint endpoint, Throwable throwable) {
        endpoint.setHealthy(false);
        endpoint.setLastCheckTime(System.currentTimeMillis());
        System.out.println("节点健康检查失败: " + endpoint.getNodeId() + 
                          ", 错误: " + throwable.getMessage());
        
        if (listener != null) {
            listener.onHealthCheckFailed(endpoint.getNodeId(), throwable);
        }
    }
    
    // 处理节点不健康
    private void handleNodeUnhealthy(NodeEndpoint endpoint) {
        if (endpoint.wasHealthy()) {
            endpoint.setWasHealthy(false);
            System.out.println("节点不健康: " + endpoint.getNodeId());
            
            if (listener != null) {
                listener.onNodeUnhealthy(endpoint.getNodeId());
            }
        }
    }
    
    // 处理节点健康
    private void handleNodeHealthy(NodeEndpoint endpoint) {
        if (!endpoint.wasHealthy()) {
            endpoint.setWasHealthy(true);
            System.out.println("节点恢复健康: " + endpoint.getNodeId());
            
            if (listener != null) {
                listener.onNodeHealthy(endpoint.getNodeId());
            }
        }
    }
    
    // 健康检查监听器
    public interface HealthCheckListener {
        void onNodeHealthy(String nodeId);
        void onNodeUnhealthy(String nodeId);
        void onHealthCheckFailed(String nodeId, Throwable throwable);
    }
}

// 节点端点信息
class NodeEndpoint {
    private String nodeId;
    private String address;
    private int port;
    private boolean healthy;
    private boolean wasHealthy = true;
    private long lastCheckTime;
    private NodeMetrics metrics;
    
    public NodeEndpoint(String nodeId, String address, int port) {
        this.nodeId = nodeId;
        this.address = address;
        this.port = port;
        this.healthy = true;
        this.lastCheckTime = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    
    public boolean isHealthy() { return healthy; }
    public void setHealthy(boolean healthy) { this.healthy = healthy; }
    
    public boolean wasHealthy() { return wasHealthy; }
    public void setWasHealthy(boolean wasHealthy) { this.wasHealthy = wasHealthy; }
    
    public long getLastCheckTime() { return lastCheckTime; }
    public void setLastCheckTime(long lastCheckTime) { this.lastCheckTime = lastCheckTime; }
    
    public NodeMetrics getMetrics() { return metrics; }
    public void setMetrics(NodeMetrics metrics) { this.metrics = metrics; }
}

// 健康检查客户端(示例)
class HealthCheckClient {
    private String address;
    private int port;
    
    public HealthCheckClient(String address, int port) {
        this.address = address;
        this.port = port;
    }
    
    // 健康检查方法(示例实现)
    public HealthCheckResponse checkHealth() {
        // 实际应用中这里会通过 RPC 调用远程节点的健康检查接口
        // 为了简化示例，这里返回一个模拟的响应
        HealthCheckResponse response = new HealthCheckResponse();
        response.setHealthy(true);
        
        NodeMetrics metrics = new NodeMetrics();
        metrics.setCpuUsage(Math.random() * 100);
        metrics.setMemoryUsage((long) (Math.random() * 1000000000));
        response.setMetrics(metrics);
        
        return response;
    }
}

// 健康检查响应
class HealthCheckResponse {
    private boolean healthy;
    private NodeMetrics metrics;
    private String message;
    
    // Getters and Setters
    public boolean isHealthy() { return healthy; }
    public void setHealthy(boolean healthy) { this.healthy = healthy; }
    
    public NodeMetrics getMetrics() { return metrics; }
    public void setMetrics(NodeMetrics metrics) { this.metrics = metrics; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

## 故障恢复机制

当检测到故障后，需要有相应的恢复机制来确保系统的持续运行和任务的顺利完成。

### 任务迁移恢复

```java
// 任务迁移恢复服务
public class TaskMigrationRecoveryService {
    private final TaskStore taskStore;
    private final NodeRegistry nodeRegistry;
    private final TaskExecutor taskExecutor;
    private final FaultDetectionService faultDetectionService;
    private final ScheduledExecutorService recoveryScheduler;
    
    public TaskMigrationRecoveryService(TaskStore taskStore,
                                      NodeRegistry nodeRegistry,
                                      TaskExecutor taskExecutor,
                                      FaultDetectionService faultDetectionService) {
        this.taskStore = taskStore;
        this.nodeRegistry = nodeRegistry;
        this.taskExecutor = taskExecutor;
        this.faultDetectionService = faultDetectionService;
        this.recoveryScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 启动恢复服务
    public void start() {
        // 注册故障监听器
        faultDetectionService.registerFaultListener(new FaultDetectionService.FaultListener() {
            @Override
            public void onNodeFailure(String nodeId) {
                handleNodeFailure(nodeId);
            }
            
            @Override
            public void onNodeRecovery(String nodeId) {
                handleNodeRecovery(nodeId);
            }
        });
        
        // 定期检查需要恢复的任务
        recoveryScheduler.scheduleAtFixedRate(this::checkAndRecoverTasks,
            30, 30, TimeUnit.SECONDS);
        
        System.out.println("任务迁移恢复服务已启动");
    }
    
    // 停止恢复服务
    public void stop() {
        recoveryScheduler.shutdown();
        try {
            if (!recoveryScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                recoveryScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            recoveryScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("任务迁移恢复服务已停止");
    }
    
    // 处理节点故障
    private void handleNodeFailure(String nodeId) {
        System.out.println("处理节点故障: " + nodeId);
        
        // 获取在该节点上运行的任务
        List<ScheduledTask> runningTasks = taskStore.getTasksByExecutorNode(nodeId);
        
        // 迁移这些任务到其他节点
        for (ScheduledTask task : runningTasks) {
            migrateTask(task, nodeId);
        }
    }
    
    // 处理节点恢复
    private void handleNodeRecovery(String nodeId) {
        System.out.println("处理节点恢复: " + nodeId);
        
        // 可以重新平衡负载，将部分任务迁移回该节点
        // 这里简化处理，实际应用中可能需要更复杂的负载均衡算法
    }
    
    // 迁移任务
    private void migrateTask(ScheduledTask task, String failedNodeId) {
        try {
            System.out.println("开始迁移任务: " + task.getTaskName() + 
                              " 从节点: " + failedNodeId);
            
            // 更新任务状态为需要迁移
            taskStore.updateTaskStatus(task.getTaskId(), TaskStatus.PENDING);
            
            // 清除任务与故障节点的关联
            taskStore.clearTaskExecutorNode(task.getTaskId());
            
            // 重新调度任务
            boolean scheduled = scheduleTaskToAvailableNode(task);
            
            if (scheduled) {
                System.out.println("任务迁移成功: " + task.getTaskName());
            } else {
                System.err.println("任务迁移失败: " + task.getTaskName() + 
                                 " 没有可用节点");
            }
        } catch (Exception e) {
            System.err.println("任务迁移异常: " + task.getTaskName() + 
                             ", 错误: " + e.getMessage());
        }
    }
    
    // 调度任务到可用节点
    private boolean scheduleTaskToAvailableNode(ScheduledTask task) {
        // 获取所有可用节点
        List<ExecutorNode> availableNodes = nodeRegistry.getAvailableNodes();
        
        if (availableNodes.isEmpty()) {
            return false;
        }
        
        // 简单的负载均衡策略：选择任务数最少的节点
        ExecutorNode targetNode = availableNodes.stream()
            .min(Comparator.comparing(ExecutorNode::getTaskCount))
            .orElse(availableNodes.get(0));
        
        // 分配任务给目标节点
        return assignTaskToNode(task, targetNode);
    }
    
    // 分配任务给节点
    private boolean assignTaskToNode(ScheduledTask task, ExecutorNode node) {
        try {
            // 更新任务的执行节点信息
            taskStore.setTaskExecutorNode(task.getTaskId(), node.getNodeId());
            
            // 通知节点执行任务
            boolean executed = taskExecutor.executeTaskOnNode(task, node);
            
            if (executed) {
                // 更新节点任务计数
                node.setTaskCount(node.getTaskCount() + 1);
                System.out.println("任务已分配给节点: " + node.getNodeId());
                return true;
            } else {
                // 执行失败，清除节点分配
                taskStore.clearTaskExecutorNode(task.getTaskId());
                return false;
            }
        } catch (Exception e) {
            System.err.println("分配任务给节点失败: " + node.getNodeId() + 
                             ", 错误: " + e.getMessage());
            return false;
        }
    }
    
    // 检查并恢复任务
    private void checkAndRecoverTasks() {
        try {
            // 获取所有需要恢复的任务
            List<ScheduledTask> tasksToRecover = taskStore.getTasksToRecover();
            
            for (ScheduledTask task : tasksToRecover) {
                // 检查任务是否需要迁移
                if (shouldMigrateTask(task)) {
                    migrateTask(task, task.getExecutorNode());
                }
            }
        } catch (Exception e) {
            System.err.println("检查和恢复任务时出错: " + e.getMessage());
        }
    }
    
    // 判断任务是否需要迁移
    private boolean shouldMigrateTask(ScheduledTask task) {
        // 检查任务的执行节点是否健康
        String executorNode = task.getExecutorNode();
        if (executorNode == null || executorNode.isEmpty()) {
            return true;
        }
        
        // 检查节点是否在故障列表中
        return faultDetectionService.isNodeFailed(executorNode);
    }
}

// 节点注册表
class NodeRegistry {
    private final Map<String, ExecutorNode> nodes = new ConcurrentHashMap<>();
    
    // 获取可用节点
    public List<ExecutorNode> getAvailableNodes() {
        return nodes.values().stream()
            .filter(ExecutorNode::isAvailable)
            .collect(Collectors.toList());
    }
    
    // 注册节点
    public void registerNode(ExecutorNode node) {
        nodes.put(node.getNodeId(), node);
    }
    
    // 注销节点
    public void unregisterNode(String nodeId) {
        nodes.remove(nodeId);
    }
    
    // 获取节点
    public ExecutorNode getNode(String nodeId) {
        return nodes.get(nodeId);
    }
}

// 执行节点信息
class ExecutorNode {
    private String nodeId;
    private String address;
    private int port;
    private boolean available;
    private int taskCount;
    private long lastHeartbeatTime;
    
    public ExecutorNode(String nodeId, String address, int port) {
        this.nodeId = nodeId;
        this.address = address;
        this.port = port;
        this.available = true;
        this.taskCount = 0;
        this.lastHeartbeatTime = System.currentTimeMillis();
    }
    
    // 检查节点是否可用
    public boolean isAvailable() {
        // 检查节点是否标记为可用且最近有心跳
        return available && 
               (System.currentTimeMillis() - lastHeartbeatTime) < 30000; // 30秒内有心跳
    }
    
    // Getters and Setters
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    
    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }
    
    public int getTaskCount() { return taskCount; }
    public void setTaskCount(int taskCount) { this.taskCount = taskCount; }
    
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
}
```

### 数据一致性恢复

```java
// 数据一致性恢复服务
public class DataConsistencyRecoveryService {
    private final TaskStore taskStore;
    private final TaskLogStore logStore;
    private final DistributedLock distributedLock;
    private final ScheduledExecutorService consistencyChecker;
    
    public DataConsistencyRecoveryService(TaskStore taskStore,
                                        TaskLogStore logStore,
                                        DistributedLock distributedLock) {
        this.taskStore = taskStore;
        this.logStore = logStore;
        this.distributedLock = distributedLock;
        this.consistencyChecker = Executors.newScheduledThreadPool(1);
    }
    
    // 启动一致性检查
    public void start() {
        consistencyChecker.scheduleAtFixedRate(this::checkDataConsistency,
            60, 300, TimeUnit.SECONDS); // 1分钟后开始，每5分钟检查一次
        System.out.println("数据一致性恢复服务已启动");
    }
    
    // 停止一致性检查
    public void stop() {
        consistencyChecker.shutdown();
        try {
            if (!consistencyChecker.awaitTermination(5, TimeUnit.SECONDS)) {
                consistencyChecker.shutdownNow();
            }
        } catch (InterruptedException e) {
            consistencyChecker.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("数据一致性恢复服务已停止");
    }
    
    // 检查数据一致性
    private void checkDataConsistency() {
        String lockKey = "consistency_check_lock";
        
        // 获取分布式锁，确保同一时刻只有一个节点执行一致性检查
        if (distributedLock.tryLock(lockKey, 300000, 10000)) { // 锁超时5分钟，等待10秒
            try {
                System.out.println("开始数据一致性检查");
                
                // 检查任务状态一致性
                checkTaskStatusConsistency();
                
                // 检查任务日志完整性
                checkTaskLogIntegrity();
                
                // 检查任务分片一致性
                checkTaskShardConsistency();
                
                System.out.println("数据一致性检查完成");
            } finally {
                distributedLock.unlock(lockKey);
            }
        } else {
            System.out.println("未能获取一致性检查锁，跳过本次检查");
        }
    }
    
    // 检查任务状态一致性
    private void checkTaskStatusConsistency() {
        try {
            // 获取所有任务
            List<ScheduledTask> allTasks = taskStore.getAllTasks();
            
            for (ScheduledTask task : allTasks) {
                // 检查任务状态是否合理
                if (!isValidTaskStatus(task)) {
                    System.out.println("发现状态不一致的任务: " + task.getTaskId() + 
                                      ", 状态: " + task.getStatus());
                    // 尝试修复状态
                    fixTaskStatus(task);
                }
            }
        } catch (Exception e) {
            System.err.println("检查任务状态一致性时出错: " + e.getMessage());
        }
    }
    
    // 检查任务状态是否有效
    private boolean isValidTaskStatus(ScheduledTask task) {
        // 检查任务状态转换是否合理
        // 例如：RUNNING状态的任务应该有执行节点
        if (task.getStatus() == TaskStatus.RUNNING) {
            return task.getExecutorNode() != null && !task.getExecutorNode().isEmpty();
        }
        
        // 其他状态检查...
        return true;
    }
    
    // 修复任务状态
    private void fixTaskStatus(ScheduledTask task) {
        try {
            // 根据具体情况修复状态
            if (task.getStatus() == TaskStatus.RUNNING && 
                (task.getExecutorNode() == null || task.getExecutorNode().isEmpty())) {
                // RUNNING状态但没有执行节点，恢复为PENDING状态
                taskStore.updateTaskStatus(task.getTaskId(), TaskStatus.PENDING);
                System.out.println("修复任务状态: " + task.getTaskId() + " -> PENDING");
            }
        } catch (Exception e) {
            System.err.println("修复任务状态失败: " + task.getTaskId() + 
                             ", 错误: " + e.getMessage());
        }
    }
    
    // 检查任务日志完整性
    private void checkTaskLogIntegrity() {
        try {
            // 获取最近执行的任务
            Date oneHourAgo = new Date(System.currentTimeMillis() - 3600000);
            List<ScheduledTask> recentTasks = taskStore.getTasksExecutedAfter(oneHourAgo);
            
            for (ScheduledTask task : recentTasks) {
                // 检查是否有对应的执行日志
                List<TaskExecutionLog> logs = logStore.getLogsByTaskId(task.getTaskId(), 1);
                if (logs.isEmpty() && 
                    (task.getStatus() == TaskStatus.SUCCESS || task.getStatus() == TaskStatus.FAILED)) {
                    System.out.println("发现缺少执行日志的任务: " + task.getTaskId());
                    // 记录警告日志
                    recordMissingLogWarning(task);
                }
            }
        } catch (Exception e) {
            System.err.println("检查任务日志完整性时出错: " + e.getMessage());
        }
    }
    
    // 记录缺少日志的警告
    private void recordMissingLogWarning(ScheduledTask task) {
        TaskExecutionLog warningLog = new TaskExecutionLog();
        warningLog.setTaskId(task.getTaskId());
        warningLog.setTaskName(task.getTaskName());
        warningLog.setExecuteTime(new Date());
        warningLog.setSuccess(false);
        warningLog.setLogLevel(ExecutionLogLevel.WARN);
        warningLog.setMessage("任务状态与执行日志不一致，缺少执行日志");
        warningLog.setErrorMessage("任务状态为 " + task.getStatus() + " 但未找到对应的执行日志");
        
        logStore.saveLog(warningLog);
    }
    
    // 检查任务分片一致性
    private void checkTaskShardConsistency() {
        try {
            // 获取所有分片任务
            List<TaskShard> allShards = taskStore.getAllTaskShards();
            
            Map<String, List<TaskShard>> shardsByTask = allShards.stream()
                .collect(Collectors.groupingBy(TaskShard::getTaskId));
            
            for (Map.Entry<String, List<TaskShard>> entry : shardsByTask.entrySet()) {
                String taskId = entry.getKey();
                List<TaskShard> shards = entry.getValue();
                
                // 检查分片状态一致性
                checkShardStatusConsistency(taskId, shards);
            }
        } catch (Exception e) {
            System.err.println("检查任务分片一致性时出错: " + e.getMessage());
        }
    }
    
    // 检查分片状态一致性
    private void checkShardStatusConsistency(String taskId, List<TaskShard> shards) {
        // 检查所有分片是否都已完成或都未完成
        boolean hasCompleted = shards.stream()
            .anyMatch(shard -> shard.getStatus() == TaskShardStatus.SUCCESS);
        boolean hasPending = shards.stream()
            .anyMatch(shard -> shard.getStatus() == TaskShardStatus.PENDING);
        
        if (hasCompleted && hasPending) {
            System.out.println("发现状态不一致的分片任务: " + taskId);
            // 可以触发分片重新执行或其他恢复操作
        }
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示故障检测与恢复机制：

```java
// 故障检测与恢复使用示例
public class FaultDetectionRecoveryExample {
    public static void main(String[] args) {
        try {
            // 模拟故障检测与恢复过程
            simulateFaultDetectionAndRecovery();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 模拟故障检测与恢复过程
    public static void simulateFaultDetectionAndRecovery() throws Exception {
        // 创建任务存储
        TaskStore taskStore = createTaskStore();
        
        // 创建节点注册表
        NodeRegistry nodeRegistry = createNodeRegistry();
        
        // 创建故障检测服务
        HeartbeatDetectionService heartbeatService = new HeartbeatDetectionService(
            new HeartbeatDetectionService.NodeStatusChangeListener() {
                @Override
                public void onNodeFailed(String nodeId) {
                    System.out.println("检测到节点故障: " + nodeId);
                }
                
                @Override
                public void onNodeRecovered(String nodeId) {
                    System.out.println("检测到节点恢复: " + nodeId);
                }
            }, 5000, 15000); // 心跳间隔5秒，超时15秒
        
        // 启动心跳服务
        heartbeatService.start();
        
        // 模拟节点发送心跳
        simulateNodeHeartbeats(heartbeatService);
        
        // 运行一段时间观察故障检测效果
        Thread.sleep(30000);
        
        // 停止服务
        heartbeatService.stop();
    }
    
    // 创建任务存储
    private static TaskStore createTaskStore() {
        // 这里简化实现，实际应用中会连接真实的数据库
        return new InMemoryTaskStore();
    }
    
    // 创建节点注册表
    private static NodeRegistry createNodeRegistry() {
        NodeRegistry registry = new NodeRegistry();
        
        // 注册几个示例节点
        registry.registerNode(new ExecutorNode("node-1", "192.168.1.101", 8080));
        registry.registerNode(new ExecutorNode("node-2", "192.168.1.102", 8080));
        registry.registerNode(new ExecutorNode("node-3", "192.168.1.103", 8080));
        
        return registry;
    }
    
    // 模拟节点发送心跳
    private static void simulateNodeHeartbeats(HeartbeatDetectionService heartbeatService) {
        ScheduledExecutorService executor = Executors.newScheduledThreadPool(3);
        
        // 节点1定期发送心跳
        executor.scheduleAtFixedRate(() -> {
            NodeMetrics metrics = new NodeMetrics();
            metrics.setCpuUsage(Math.random() * 80);
            metrics.setMemoryUsage((long) (Math.random() * 1000000000));
            heartbeatService.receiveHeartbeat("node-1", metrics);
        }, 0, 3, TimeUnit.SECONDS);
        
        // 节点2定期发送心跳
        executor.scheduleAtFixedRate(() -> {
            NodeMetrics metrics = new NodeMetrics();
            metrics.setCpuUsage(Math.random() * 70);
            metrics.setMemoryUsage((long) (Math.random() * 800000000));
            heartbeatService.receiveHeartbeat("node-2", metrics);
        }, 1, 3, TimeUnit.SECONDS);
        
        // 节点3只发送几次心跳然后停止（模拟节点故障）
        executor.scheduleAtFixedRate(() -> {
            NodeMetrics metrics = new NodeMetrics();
            metrics.setCpuUsage(Math.random() * 90);
            metrics.setMemoryUsage((long) (Math.random() * 1200000000));
            heartbeatService.receiveHeartbeat("node-3", metrics);
        }, 2, 3, TimeUnit.SECONDS);
        
        // 10秒后停止节点3的心跳（模拟节点故障）
        executor.schedule(() -> {
            System.out.println("模拟节点3故障，停止发送心跳");
        }, 10, TimeUnit.SECONDS);
    }
}

// 内存任务存储实现（示例）
class InMemoryTaskStore implements TaskStore {
    private final Map<String, ScheduledTask> tasks = new ConcurrentHashMap<>();
    
    @Override
    public void saveTask(ScheduledTask task) {
        tasks.put(task.getTaskId(), task);
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
    public List<ScheduledTask> getTasksToExecute(Date currentTime) {
        return tasks.values().stream()
            .filter(task -> task.getNextExecuteTime() != null && 
                          task.getNextExecuteTime().before(currentTime))
            .collect(Collectors.toList());
    }
    
    @Override
    public void updateTaskStatus(String taskId, TaskStatus status) {
        ScheduledTask task = tasks.get(taskId);
        if (task != null) {
            task.setStatus(status);
            task.setUpdateTime(new Date());
        }
    }
    
    @Override
    public List<ScheduledTask> getTasksByExecutorNode(String nodeId) {
        return tasks.values().stream()
            .filter(task -> nodeId.equals(task.getExecutorNode()))
            .collect(Collectors.toList());
    }
    
    @Override
    public void clearTaskExecutorNode(String taskId) {
        ScheduledTask task = tasks.get(taskId);
        if (task != null) {
            task.setExecutorNode(null);
        }
    }
    
    @Override
    public void setTaskExecutorNode(String taskId, String nodeId) {
        ScheduledTask task = tasks.get(taskId);
        if (task != null) {
            task.setExecutorNode(nodeId);
        }
    }
    
    @Override
    public List<ScheduledTask> getTasksToRecover() {
        return tasks.values().stream()
            .filter(task -> task.getStatus() == TaskStatus.RUNNING && 
                          task.getExecutorNode() != null)
            .collect(Collectors.toList());
    }
    
    @Override
    public List<ScheduledTask> getTasksExecutedAfter(Date time) {
        return tasks.values().stream()
            .filter(task -> task.getLastExecuteTime() != null && 
                          task.getLastExecuteTime().after(time))
            .collect(Collectors.toList());
    }
    
    @Override
    public List<TaskShard> getAllTaskShards() {
        // 简化实现
        return new ArrayList<>();
    }
}

// 任务存储接口
interface TaskStore {
    void saveTask(ScheduledTask task);
    ScheduledTask getTask(String taskId);
    List<ScheduledTask> getAllTasks();
    List<ScheduledTask> getTasksToExecute(Date currentTime);
    void updateTaskStatus(String taskId, TaskStatus status);
    List<ScheduledTask> getTasksByExecutorNode(String nodeId);
    void clearTaskExecutorNode(String taskId);
    void setTaskExecutorNode(String taskId, String nodeId);
    List<ScheduledTask> getTasksToRecover();
    List<ScheduledTask> getTasksExecutedAfter(Date time);
    List<TaskShard> getAllTaskShards();
}

// 任务实体类
class ScheduledTask {
    private String taskId;
    private String taskName;
    private TaskStatus status;
    private Date nextExecuteTime;
    private Date updateTime;
    private Date lastExecuteTime;
    private String executorNode;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    
    public Date getNextExecuteTime() { return nextExecuteTime; }
    public void setNextExecuteTime(Date nextExecuteTime) { this.nextExecuteTime = nextExecuteTime; }
    
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    
    public Date getLastExecuteTime() { return lastExecuteTime; }
    public void setLastExecuteTime(Date lastExecuteTime) { this.lastExecuteTime = lastExecuteTime; }
    
    public String getExecutorNode() { return executorNode; }
    public void setExecutorNode(String executorNode) { this.executorNode = executorNode; }
}

// 任务状态枚举
enum TaskStatus {
    PENDING, RUNNING, SUCCESS, FAILED
}

// 任务分片实体类
class TaskShard {
    private String taskId;
    private TaskShardStatus status;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public TaskShardStatus getStatus() { return status; }
    public void setStatus(TaskShardStatus status) { this.status = status; }
}

// 任务分片状态枚举
enum TaskShardStatus {
    PENDING, SUCCESS
}

// 任务执行器接口
interface TaskExecutor {
    boolean executeTaskOnNode(ScheduledTask task, ExecutorNode node);
}

// 故障检测服务接口
interface FaultDetectionService {
    void registerFaultListener(FaultListener listener);
    boolean isNodeFailed(String nodeId);
    
    interface FaultListener {
        void onNodeFailure(String nodeId);
        void onNodeRecovery(String nodeId);
    }
}

// 日志存储接口
interface TaskLogStore {
    boolean saveLog(TaskExecutionLog log);
    List<TaskExecutionLog> getLogsByTaskId(String taskId, int limit);
}

// 任务执行日志实体类
class TaskExecutionLog {
    private String taskId;
    private String taskName;
    private Date executeTime;
    private boolean success;
    private ExecutionLogLevel logLevel;
    private String message;
    private String errorMessage;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public Date getExecuteTime() { return executeTime; }
    public void setExecuteTime(Date executeTime) { this.executeTime = executeTime; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public ExecutionLogLevel getLogLevel() { return logLevel; }
    public void setLogLevel(ExecutionLogLevel logLevel) { this.logLevel = logLevel; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}

// 分布式锁接口
interface DistributedLock {
    boolean tryLock(String lockKey, long expireTime, long timeout);
    boolean unlock(String lockKey);
}