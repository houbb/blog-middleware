---
title: 4.2 容错与恢复机制
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，容错与恢复机制是保证系统高可用性和数据一致性的关键。由于分布式环境的复杂性，节点故障、网络异常、数据丢失等问题时有发生，因此需要设计完善的容错与恢复机制来应对这些挑战。本文将深入探讨分布式调度系统中的容错策略、故障检测、自动恢复等关键技术。

## 容错机制设计原则

容错机制的设计需要遵循一系列原则，以确保系统在面对各种故障时仍能稳定运行。

### 容错设计核心原则

```java
// 容错策略接口
public interface FaultToleranceStrategy {
    /**
     * 检测故障
     * @param component 组件信息
     * @return 是否存在故障
     */
    boolean detectFault(ComponentInfo component);
    
    /**
     * 处理故障
     * @param component 组件信息
     * @param faultInfo 故障信息
     */
    void handleFault(ComponentInfo component, FaultInfo faultInfo);
    
    /**
     * 恢复组件
     * @param component 组件信息
     */
    void recoverComponent(ComponentInfo component);
}

// 组件信息
class ComponentInfo {
    private String componentId;
    private ComponentType type;
    private String address;
    private int port;
    private ComponentStatus status;
    private long lastHeartbeatTime;
    private Map<String, Object> metadata;
    
    public ComponentInfo(String componentId, ComponentType type, String address, int port) {
        this.componentId = componentId;
        this.type = type;
        this.address = address;
        this.port = port;
        this.status = ComponentStatus.UNKNOWN;
        this.lastHeartbeatTime = 0;
        this.metadata = new HashMap<>();
    }
    
    // Getters and Setters
    public String getComponentId() { return componentId; }
    public ComponentType getType() { return type; }
    public String getAddress() { return address; }
    public int getPort() { return port; }
    public ComponentStatus getStatus() { return status; }
    public void setStatus(ComponentStatus status) { this.status = status; }
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
    public Map<String, Object> getMetadata() { return metadata; }
}

// 组件类型枚举
enum ComponentType {
    SCHEDULER,     // 调度器
    EXECUTOR,      // 执行器
    STORAGE,       // 存储
    MONITOR        // 监控
}

// 组件状态枚举
enum ComponentStatus {
    UNKNOWN,    // 未知
    HEALTHY,    // 健康
    DEGRADED,   // 降级
    FAULTY,     // 故障
    OFFLINE     // 离线
}

// 故障信息
class FaultInfo {
    private String faultId;
    private FaultType type;
    private String componentId;
    private String description;
    private long timestamp;
    private FaultSeverity severity;
    private Map<String, Object> details;
    
    public FaultInfo(FaultType type, String componentId, String description) {
        this.faultId = UUID.randomUUID().toString();
        this.type = type;
        this.componentId = componentId;
        this.description = description;
        this.timestamp = System.currentTimeMillis();
        this.severity = FaultSeverity.MEDIUM;
        this.details = new HashMap<>();
    }
    
    // Getters and Setters
    public String getFaultId() { return faultId; }
    public FaultType getType() { return type; }
    public String getComponentId() { return componentId; }
    public String getDescription() { return description; }
    public long getTimestamp() { return timestamp; }
    public FaultSeverity getSeverity() { return severity; }
    public void setSeverity(FaultSeverity severity) { this.severity = severity; }
    public Map<String, Object> getDetails() { return details; }
}

// 故障类型枚举
enum FaultType {
    NETWORK_FAILURE,      // 网络故障
    NODE_FAILURE,         // 节点故障
    STORAGE_FAILURE,      // 存储故障
    TIMEOUT,              // 超时
    RESOURCE_EXHAUSTED,   // 资源耗尽
    DATA_CORRUPTION       // 数据损坏
}

// 故障严重程度枚举
enum FaultSeverity {
    LOW,      // 低
    MEDIUM,   // 中
    HIGH,     // 高
    CRITICAL  // 严重
}
```

### 容错机制核心策略

```java
// 基于心跳的故障检测策略
public class HeartbeatBasedFaultDetection implements FaultToleranceStrategy {
    private final long heartbeatTimeout;
    private final FaultHandler faultHandler;
    
    public HeartbeatBasedFaultDetection(long heartbeatTimeout, FaultHandler faultHandler) {
        this.heartbeatTimeout = heartbeatTimeout;
        this.faultHandler = faultHandler;
    }
    
    @Override
    public boolean detectFault(ComponentInfo component) {
        long currentTime = System.currentTimeMillis();
        long timeSinceLastHeartbeat = currentTime - component.getLastHeartbeatTime();
        
        if (timeSinceLastHeartbeat > heartbeatTimeout) {
            // 检测到故障
            FaultInfo faultInfo = new FaultInfo(
                FaultType.NODE_FAILURE, 
                component.getComponentId(), 
                "心跳超时，超时时间: " + timeSinceLastHeartbeat + "ms"
            );
            faultInfo.setSeverity(FaultSeverity.HIGH);
            faultInfo.getDetails().put("lastHeartbeatTime", component.getLastHeartbeatTime());
            faultInfo.getDetails().put("currentTime", currentTime);
            
            handleFault(component, faultInfo);
            return true;
        }
        
        return false;
    }
    
    @Override
    public void handleFault(ComponentInfo component, FaultInfo faultInfo) {
        // 更新组件状态
        component.setStatus(ComponentStatus.FAULTY);
        
        // 记录故障日志
        System.err.println("检测到组件故障: " + component.getComponentId() + 
                          ", 故障类型: " + faultInfo.getType() + 
                          ", 描述: " + faultInfo.getDescription());
        
        // 通知故障处理器
        faultHandler.handleFault(faultInfo);
    }
    
    @Override
    public void recoverComponent(ComponentInfo component) {
        // 尝试恢复组件
        System.out.println("尝试恢复组件: " + component.getComponentId());
        
        // 这里可以实现具体的恢复逻辑
        // 例如：重新建立连接、重启服务等
        
        // 恢复成功后更新状态
        component.setStatus(ComponentStatus.HEALTHY);
        System.out.println("组件恢复成功: " + component.getComponentId());
    }
}

// 故障处理器接口
interface FaultHandler {
    void handleFault(FaultInfo faultInfo);
}

// 默认故障处理器
class DefaultFaultHandler implements FaultHandler {
    private final AlertService alertService;
    private final RecoveryManager recoveryManager;
    
    public DefaultFaultHandler(AlertService alertService, RecoveryManager recoveryManager) {
        this.alertService = alertService;
        this.recoveryManager = recoveryManager;
    }
    
    @Override
    public void handleFault(FaultInfo faultInfo) {
        // 发送告警
        sendAlert(faultInfo);
        
        // 尝试自动恢复
        recoveryManager.attemptRecovery(faultInfo);
    }
    
    private void sendAlert(FaultInfo faultInfo) {
        AlertLevel level = mapSeverityToAlertLevel(faultInfo.getSeverity());
        String message = String.format(
            "组件故障 - 类型: %s, 组件: %s, 描述: %s, 严重程度: %s",
            faultInfo.getType(),
            faultInfo.getComponentId(),
            faultInfo.getDescription(),
            faultInfo.getSeverity()
        );
        
        Alert alert = new Alert(level, "COMPONENT_FAULT", message);
        alertService.sendAlert(alert);
    }
    
    private AlertLevel mapSeverityToAlertLevel(FaultSeverity severity) {
        switch (severity) {
            case LOW: return AlertLevel.INFO;
            case MEDIUM: return AlertLevel.WARNING;
            case HIGH: return AlertLevel.ERROR;
            case CRITICAL: return AlertLevel.CRITICAL;
            default: return AlertLevel.WARNING;
        }
    }
}
```

## 任务执行容错机制

在任务执行过程中，可能会遇到各种故障，需要设计相应的容错机制来保证任务的顺利完成。

### 任务执行容错实现

```java
// 任务执行容错管理器
public class TaskExecutionFaultTolerance {
    private final int maxRetries;
    private final long retryInterval;
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final FaultHandler faultHandler;
    
    public TaskExecutionFaultTolerance(int maxRetries, long retryInterval,
                                     TaskStore taskStore,
                                     ExecutorRegistry executorRegistry,
                                     FaultHandler faultHandler) {
        this.maxRetries = maxRetries;
        this.retryInterval = retryInterval;
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        this.faultHandler = faultHandler;
    }
    
    // 带重试机制的任务执行
    public TaskExecutionResult executeTaskWithRetry(Task task) {
        Exception lastException = null;
        
        for (int attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                // 更新任务状态
                task.setExecutionAttempt(attempt);
                taskStore.updateTask(task);
                
                // 执行任务
                TaskExecutionResult result = executeTask(task);
                
                // 执行成功
                task.setStatus(TaskStatus.SUCCESS);
                task.setLastExecutionTime(System.currentTimeMillis());
                taskStore.updateTask(task);
                
                System.out.println("任务执行成功: " + task.getTaskId() + 
                                 ", 尝试次数: " + attempt);
                
                return result;
            } catch (Exception e) {
                lastException = e;
                
                System.err.println("任务执行失败 (尝试 " + attempt + "/" + (maxRetries + 1) + 
                                 "): " + task.getTaskId() + ", 错误: " + e.getMessage());
                
                // 记录失败信息
                TaskExecutionRecord record = new TaskExecutionRecord(
                    task.getTaskId(), System.currentTimeMillis() - task.getLastExecutionTime(), false);
                record.setErrorMessage(e.getMessage());
                taskStore.saveExecutionRecord(record);
                
                if (attempt <= maxRetries) {
                    // 等待后重试
                    try {
                        Thread.sleep(retryInterval);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new TaskExecutionException("重试被中断", ie);
                    }
                }
            }
        }
        
        // 所有重试都失败
        task.setStatus(TaskStatus.FAILED);
        task.setLastExecutionTime(System.currentTimeMillis());
        taskStore.updateTask(task);
        
        // 记录故障信息
        FaultInfo faultInfo = new FaultInfo(
            FaultType.NODE_FAILURE, 
            task.getAssignedExecutor(), 
            "任务执行失败，已重试 " + maxRetries + " 次"
        );
        faultInfo.setSeverity(FaultSeverity.HIGH);
        faultHandler.handleFault(faultInfo);
        
        throw new TaskExecutionException("任务执行最终失败，已重试 " + maxRetries + " 次", lastException);
    }
    
    // 执行任务
    private TaskExecutionResult executeTask(Task task) throws Exception {
        // 获取执行器
        ExecutorNode executor = executorRegistry.getExecutor(task.getAssignedExecutor());
        if (executor == null || executor.getStatus() != ExecutorStatus.ONLINE) {
            throw new TaskExecutionException("执行器不可用: " + task.getAssignedExecutor());
        }
        
        // 发送任务到执行器执行
        return executor.executeTask(task);
    }
    
    // 任务迁移机制
    public void migrateTask(Task task) {
        try {
            // 获取当前执行器
            ExecutorNode currentExecutor = executorRegistry.getExecutor(task.getAssignedExecutor());
            
            // 如果当前执行器故障，寻找新的执行器
            if (currentExecutor == null || currentExecutor.getStatus() != ExecutorStatus.ONLINE) {
                List<ExecutorNode> availableExecutors = executorRegistry.getAvailableExecutors();
                
                if (!availableExecutors.isEmpty()) {
                    // 选择一个新的执行器
                    ExecutorNode newExecutor = selectNewExecutor(availableExecutors, task);
                    
                    // 更新任务分配
                    task.setAssignedExecutor(newExecutor.getId());
                    task.setStatus(TaskStatus.PENDING);
                    taskStore.updateTask(task);
                    
                    System.out.println("任务已迁移到新的执行器: " + newExecutor.getId());
                } else {
                    throw new TaskExecutionException("没有可用的执行器进行任务迁移");
                }
            }
        } catch (Exception e) {
            System.err.println("任务迁移失败: " + e.getMessage());
            throw new TaskExecutionException("任务迁移失败", e);
        }
    }
    
    // 选择新的执行器
    private ExecutorNode selectNewExecutor(List<ExecutorNode> executors, Task task) {
        // 简单的负载均衡策略：选择负载最轻的执行器
        return executors.stream()
            .min(Comparator.comparing(executor -> {
                try {
                    return executor.getLoadInfo().getTaskCount();
                } catch (Exception e) {
                    return Integer.MAX_VALUE;
                }
            }))
            .orElse(executors.get(0));
    }
}

// 任务执行异常
class TaskExecutionException extends Exception {
    public TaskExecutionException(String message) {
        super(message);
    }
    
    public TaskExecutionException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

## 数据一致性保障

在分布式环境中，数据一致性是容错机制的重要组成部分，需要确保在故障发生时数据不会丢失或损坏。

### 数据一致性实现

```java
// 数据一致性管理器
public class DataConsistencyManager {
    private final DistributedStorage storage;
    private final TransactionManager transactionManager;
    private final BackupManager backupManager;
    
    public DataConsistencyManager(DistributedStorage storage,
                                TransactionManager transactionManager,
                                BackupManager backupManager) {
        this.storage = storage;
        this.transactionManager = transactionManager;
        this.backupManager = backupManager;
    }
    
    // 事务性任务状态更新
    public void updateTaskStatusTransactionally(Task task, TaskStatus newStatus) {
        Transaction transaction = transactionManager.begin();
        
        try {
            // 1. 更新任务状态
            task.setStatus(newStatus);
            task.setLastUpdateTime(System.currentTimeMillis());
            
            // 2. 保存到主存储
            storage.saveTask(task);
            
            // 3. 保存到备份存储
            backupManager.backupTask(task);
            
            // 4. 提交事务
            transactionManager.commit(transaction);
            
            System.out.println("任务状态更新成功: " + task.getTaskId() + " -> " + newStatus);
        } catch (Exception e) {
            // 5. 回滚事务
            transactionManager.rollback(transaction);
            
            System.err.println("任务状态更新失败，已回滚: " + e.getMessage());
            throw new DataConsistencyException("任务状态更新失败", e);
        }
    }
    
    // 分片数据一致性保障
    public void ensureShardDataConsistency(TaskShard shard) {
        try {
            // 1. 验证分片数据完整性
            if (!verifyShardDataIntegrity(shard)) {
                // 2. 从备份恢复数据
                restoreShardDataFromBackup(shard);
            }
            
            // 3. 同步到所有副本
            syncShardDataToReplicas(shard);
            
            System.out.println("分片数据一致性保障完成: " + shard.getShardId());
        } catch (Exception e) {
            System.err.println("分片数据一致性保障失败: " + e.getMessage());
            throw new DataConsistencyException("分片数据一致性保障失败", e);
        }
    }
    
    // 验证分片数据完整性
    private boolean verifyShardDataIntegrity(TaskShard shard) {
        try {
            // 计算数据校验和
            String checksum = calculateDataChecksum(shard.getShardData());
            
            // 与存储的校验和比较
            String storedChecksum = storage.getShardChecksum(shard.getShardId());
            
            return checksum.equals(storedChecksum);
        } catch (Exception e) {
            System.err.println("验证分片数据完整性时出错: " + e.getMessage());
            return false;
        }
    }
    
    // 从备份恢复分片数据
    private void restoreShardDataFromBackup(TaskShard shard) {
        try {
            // 从备份存储获取数据
            Object backupData = backupManager.restoreShardData(shard.getShardId());
            
            // 更新分片数据
            shard.setShardData(backupData);
            
            // 保存到主存储
            storage.saveTaskShard(shard);
            
            System.out.println("分片数据已从备份恢复: " + shard.getShardId());
        } catch (Exception e) {
            throw new DataConsistencyException("从备份恢复分片数据失败", e);
        }
    }
    
    // 同步分片数据到副本
    private void syncShardDataToReplicas(TaskShard shard) {
        try {
            // 获取副本节点
            List<String> replicaNodes = storage.getReplicaNodes(shard.getShardId());
            
            // 同步到所有副本
            for (String replicaNode : replicaNodes) {
                storage.syncShardDataToReplica(shard, replicaNode);
            }
        } catch (Exception e) {
            throw new DataConsistencyException("同步分片数据到副本失败", e);
        }
    }
    
    // 计算数据校验和
    private String calculateDataChecksum(Object data) {
        try {
            // 序列化数据
            String serializedData = serializeData(data);
            
            // 计算MD5校验和
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(serializedData.getBytes());
            
            // 转换为十六进制字符串
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            
            return sb.toString();
        } catch (Exception e) {
            throw new DataConsistencyException("计算数据校验和失败", e);
        }
    }
    
    // 序列化数据
    private String serializeData(Object data) {
        // 实际应用中使用JSON或其他序列化方式
        return data.toString();
    }
}

// 数据一致性异常
class DataConsistencyException extends RuntimeException {
    public DataConsistencyException(String message, Throwable cause) {
        super(message, cause);
    }
}

// 分布式存储接口
interface DistributedStorage {
    void saveTask(Task task);
    void saveTaskShard(TaskShard shard);
    String getShardChecksum(String shardId);
    List<String> getReplicaNodes(String shardId);
    void syncShardDataToReplica(TaskShard shard, String replicaNode);
}

// 事务管理器
class TransactionManager {
    public Transaction begin() {
        return new Transaction();
    }
    
    public void commit(Transaction transaction) {
        // 提交事务
    }
    
    public void rollback(Transaction transaction) {
        // 回滚事务
    }
}

// 事务类
class Transaction {
    private String transactionId;
    
    public Transaction() {
        this.transactionId = UUID.randomUUID().toString();
    }
    
    public String getTransactionId() {
        return transactionId;
    }
}

// 备份管理器
class BackupManager {
    public void backupTask(Task task) {
        // 备份任务数据
    }
    
    public Object restoreShardData(String shardId) {
        // 从备份恢复分片数据
        return new Object();
    }
}
```

## 自动恢复机制

自动恢复机制能够在检测到故障后自动采取措施恢复系统正常运行，减少人工干预。

### 自动恢复实现

```java
// 自动恢复管理器
public class RecoveryManager {
    private final ScheduledExecutorService recoveryScheduler;
    private final ComponentRegistry componentRegistry;
    private final FaultToleranceStrategy faultToleranceStrategy;
    private final TaskRecoveryService taskRecoveryService;
    private final long recoveryInterval;
    
    public RecoveryManager(ComponentRegistry componentRegistry,
                         FaultToleranceStrategy faultToleranceStrategy,
                         TaskRecoveryService taskRecoveryService,
                         long recoveryInterval) {
        this.recoveryScheduler = Executors.newScheduledThreadPool(2);
        this.componentRegistry = componentRegistry;
        this.faultToleranceStrategy = faultToleranceStrategy;
        this.taskRecoveryService = taskRecoveryService;
        this.recoveryInterval = recoveryInterval;
    }
    
    // 启动自动恢复
    public void start() {
        // 定期检查和恢复故障组件
        recoveryScheduler.scheduleAtFixedRate(
            this::recoverFaultyComponents, 0, recoveryInterval, TimeUnit.SECONDS);
        
        // 定期恢复失败任务
        recoveryScheduler.scheduleAtFixedRate(
            this::recoverFailedTasks, 30, recoveryInterval, TimeUnit.SECONDS);
        
        System.out.println("自动恢复管理器已启动");
    }
    
    // 停止自动恢复
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
        System.out.println("自动恢复管理器已停止");
    }
    
    // 尝试恢复故障
    public void attemptRecovery(FaultInfo faultInfo) {
        try {
            switch (faultInfo.getType()) {
                case NODE_FAILURE:
                    recoverNodeFailure(faultInfo);
                    break;
                case NETWORK_FAILURE:
                    recoverNetworkFailure(faultInfo);
                    break;
                case STORAGE_FAILURE:
                    recoverStorageFailure(faultInfo);
                    break;
                default:
                    System.out.println("未知故障类型，无法自动恢复: " + faultInfo.getType());
            }
        } catch (Exception e) {
            System.err.println("自动恢复失败: " + e.getMessage());
        }
    }
    
    // 恢复故障组件
    private void recoverFaultyComponents() {
        try {
            List<ComponentInfo> components = componentRegistry.getAllComponents();
            
            for (ComponentInfo component : components) {
                if (component.getStatus() == ComponentStatus.FAULTY ||
                    component.getStatus() == ComponentStatus.OFFLINE) {
                    
                    // 检测故障
                    if (faultToleranceStrategy.detectFault(component)) {
                        System.out.println("检测到组件故障，尝试恢复: " + component.getComponentId());
                        
                        // 尝试恢复组件
                        faultToleranceStrategy.recoverComponent(component);
                        
                        // 更新组件注册信息
                        componentRegistry.updateComponent(component);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("恢复故障组件时出错: " + e.getMessage());
        }
    }
    
    // 恢复失败任务
    private void recoverFailedTasks() {
        try {
            taskRecoveryService.recoverFailedTasks();
        } catch (Exception e) {
            System.err.println("恢复失败任务时出错: " + e.getMessage());
        }
    }
    
    // 恢复节点故障
    private void recoverNodeFailure(FaultInfo faultInfo) {
        String componentId = faultInfo.getComponentId();
        ComponentInfo component = componentRegistry.getComponent(componentId);
        
        if (component != null) {
            System.out.println("尝试恢复节点故障: " + componentId);
            
            // 这里可以实现具体的节点恢复逻辑
            // 例如：重启服务、重新建立连接等
            
            // 模拟恢复过程
            try {
                Thread.sleep(2000); // 模拟恢复时间
                
                // 恢复成功
                component.setStatus(ComponentStatus.HEALTHY);
                componentRegistry.updateComponent(component);
                
                System.out.println("节点故障恢复成功: " + componentId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("节点故障恢复被中断: " + componentId);
            }
        }
    }
    
    // 恢复网络故障
    private void recoverNetworkFailure(FaultInfo faultInfo) {
        System.out.println("尝试恢复网络故障: " + faultInfo.getComponentId());
        
        // 这里可以实现网络故障恢复逻辑
        // 例如：重新建立网络连接、切换网络路径等
    }
    
    // 恢复存储故障
    private void recoverStorageFailure(FaultInfo faultInfo) {
        System.out.println("尝试恢复存储故障: " + faultInfo.getComponentId());
        
        // 这里可以实现存储故障恢复逻辑
        // 例如：切换到备份存储、重建数据索引等
    }
}

// 组件注册中心
class ComponentRegistry {
    private final Map<String, ComponentInfo> components = new ConcurrentHashMap<>();
    
    // 注册组件
    public void registerComponent(ComponentInfo component) {
        components.put(component.getComponentId(), component);
        System.out.println("组件已注册: " + component.getComponentId());
    }
    
    // 更新组件
    public void updateComponent(ComponentInfo component) {
        components.put(component.getComponentId(), component);
    }
    
    // 获取组件
    public ComponentInfo getComponent(String componentId) {
        return components.get(componentId);
    }
    
    // 获取所有组件
    public List<ComponentInfo> getAllComponents() {
        return new ArrayList<>(components.values());
    }
}

// 任务恢复服务
class TaskRecoveryService {
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final TaskExecutionFaultTolerance faultTolerance;
    
    public TaskRecoveryService(TaskStore taskStore,
                             ExecutorRegistry executorRegistry,
                             TaskExecutionFaultTolerance faultTolerance) {
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        this.faultTolerance = faultTolerance;
    }
    
    // 恢复失败任务
    public void recoverFailedTasks() {
        try {
            // 获取失败的任务
            List<Task> failedTasks = taskStore.getFailedTasks();
            
            for (Task task : failedTasks) {
                // 检查任务是否需要恢复
                if (shouldRecoverTask(task)) {
                    System.out.println("尝试恢复失败任务: " + task.getTaskId());
                    
                    // 重新调度任务
                    rescheduleTask(task);
                }
            }
        } catch (Exception e) {
            System.err.println("恢复失败任务时出错: " + e.getMessage());
        }
    }
    
    // 判断是否需要恢复任务
    private boolean shouldRecoverTask(Task task) {
        // 检查任务是否配置了自动恢复
        if (!task.isAutoRecoveryEnabled()) {
            return false;
        }
        
        // 检查失败次数是否超过阈值
        if (task.getFailureCount() > task.getMaxRecoveryAttempts()) {
            return false;
        }
        
        return true;
    }
    
    // 重新调度任务
    private void rescheduleTask(Task task) {
        try {
            // 重置任务状态
            task.setStatus(TaskStatus.PENDING);
            task.setFailureCount(task.getFailureCount() + 1);
            task.setLastUpdateTime(System.currentTimeMillis());
            taskStore.updateTask(task);
            
            System.out.println("任务已重新调度: " + task.getTaskId());
        } catch (Exception e) {
            System.err.println("重新调度任务失败: " + e.getMessage());
        }
    }
}
```

## 故障演练与测试

为了验证容错与恢复机制的有效性，需要定期进行故障演练和测试。

### 故障演练实现

```java
// 故障演练框架
public class FaultInjectionFramework {
    private final ComponentRegistry componentRegistry;
    private final FaultToleranceStrategy faultToleranceStrategy;
    private final RecoveryManager recoveryManager;
    
    public FaultInjectionFramework(ComponentRegistry componentRegistry,
                                 FaultToleranceStrategy faultToleranceStrategy,
                                 RecoveryManager recoveryManager) {
        this.componentRegistry = componentRegistry;
        this.faultToleranceStrategy = faultToleranceStrategy;
        this.recoveryManager = recoveryManager;
    }
    
    // 注入网络故障
    public void injectNetworkFailure(String componentId) {
        ComponentInfo component = componentRegistry.getComponent(componentId);
        if (component != null) {
            System.out.println("注入网络故障到组件: " + componentId);
            
            // 模拟网络故障
            component.setStatus(ComponentStatus.FAULTY);
            componentRegistry.updateComponent(component);
            
            // 触发故障检测
            FaultInfo faultInfo = new FaultInfo(
                FaultType.NETWORK_FAILURE, componentId, "模拟网络故障");
            faultInfo.setSeverity(FaultSeverity.MEDIUM);
            
            faultToleranceStrategy.handleFault(component, faultInfo);
        }
    }
    
    // 注入节点故障
    public void injectNodeFailure(String componentId) {
        ComponentInfo component = componentRegistry.getComponent(componentId);
        if (component != null) {
            System.out.println("注入节点故障到组件: " + componentId);
            
            // 模拟节点故障
            component.setStatus(ComponentStatus.OFFLINE);
            component.setLastHeartbeatTime(0);
            componentRegistry.updateComponent(component);
            
            // 触发故障检测
            FaultInfo faultInfo = new FaultInfo(
                FaultType.NODE_FAILURE, componentId, "模拟节点故障");
            faultInfo.setSeverity(FaultSeverity.HIGH);
            
            faultToleranceStrategy.handleFault(component, faultInfo);
        }
    }
    
    // 注入存储故障
    public void injectStorageFailure(String componentId) {
        ComponentInfo component = componentRegistry.getComponent(componentId);
        if (component != null) {
            System.out.println("注入存储故障到组件: " + componentId);
            
            // 模拟存储故障
            component.setStatus(ComponentStatus.FAULTY);
            componentRegistry.updateComponent(component);
            
            // 触发故障检测
            FaultInfo faultInfo = new FaultInfo(
                FaultType.STORAGE_FAILURE, componentId, "模拟存储故障");
            faultInfo.setSeverity(FaultSeverity.CRITICAL);
            
            faultToleranceStrategy.handleFault(component, faultInfo);
        }
    }
    
    // 执行故障演练
    public FaultSimulationReport executeFaultSimulation(FaultSimulationScenario scenario) {
        FaultSimulationReport report = new FaultSimulationReport();
        report.setStartTime(System.currentTimeMillis());
        
        try {
            System.out.println("开始故障演练: " + scenario.getName());
            
            // 注入故障
            injectFaults(scenario);
            
            // 等待系统响应
            Thread.sleep(scenario.getObservationPeriod());
            
            // 验证恢复效果
            verifyRecovery(scenario, report);
            
            report.setSuccess(true);
            System.out.println("故障演练完成: " + scenario.getName());
        } catch (Exception e) {
            report.setSuccess(false);
            report.setErrorMessage(e.getMessage());
            System.err.println("故障演练失败: " + e.getMessage());
        } finally {
            report.setEndTime(System.currentTimeMillis());
        }
        
        return report;
    }
    
    // 注入故障
    private void injectFaults(FaultSimulationScenario scenario) {
        for (FaultInjection injection : scenario.getFaultInjections()) {
            switch (injection.getFaultType()) {
                case NETWORK_FAILURE:
                    injectNetworkFailure(injection.getComponentId());
                    break;
                case NODE_FAILURE:
                    injectNodeFailure(injection.getComponentId());
                    break;
                case STORAGE_FAILURE:
                    injectStorageFailure(injection.getComponentId());
                    break;
            }
        }
    }
    
    // 验证恢复效果
    private void verifyRecovery(FaultSimulationScenario scenario, FaultSimulationReport report) {
        List<String> expectedRecoveredComponents = scenario.getExpectedRecoveredComponents();
        
        for (String componentId : expectedRecoveredComponents) {
            ComponentInfo component = componentRegistry.getComponent(componentId);
            if (component != null && 
                (component.getStatus() == ComponentStatus.HEALTHY || 
                 component.getStatus() == ComponentStatus.DEGRADED)) {
                report.addRecoveredComponent(componentId);
            } else {
                report.addFailedRecoveryComponent(componentId);
            }
        }
    }
}

// 故障演练场景
class FaultSimulationScenario {
    private String name;
    private List<FaultInjection> faultInjections;
    private List<String> expectedRecoveredComponents;
    private long observationPeriod;
    
    public FaultSimulationScenario(String name) {
        this.name = name;
        this.faultInjections = new ArrayList<>();
        this.expectedRecoveredComponents = new ArrayList<>();
        this.observationPeriod = 30000; // 默认30秒观察期
    }
    
    // Getters and Setters
    public String getName() { return name; }
    public List<FaultInjection> getFaultInjections() { return faultInjections; }
    public List<String> getExpectedRecoveredComponents() { return expectedRecoveredComponents; }
    public long getObservationPeriod() { return observationPeriod; }
    public void setObservationPeriod(long observationPeriod) { this.observationPeriod = observationPeriod; }
    
    // 添加故障注入
    public void addFaultInjection(FaultInjection injection) {
        this.faultInjections.add(injection);
    }
    
    // 添加期望恢复的组件
    public void addExpectedRecoveredComponent(String componentId) {
        this.expectedRecoveredComponents.add(componentId);
    }
}

// 故障注入
class FaultInjection {
    private FaultType faultType;
    private String componentId;
    
    public FaultInjection(FaultType faultType, String componentId) {
        this.faultType = faultType;
        this.componentId = componentId;
    }
    
    // Getters
    public FaultType getFaultType() { return faultType; }
    public String getComponentId() { return componentId; }
}

// 故障演练报告
class FaultSimulationReport {
    private boolean success;
    private long startTime;
    private long endTime;
    private List<String> recoveredComponents;
    private List<String> failedRecoveryComponents;
    private String errorMessage;
    
    public FaultSimulationReport() {
        this.recoveredComponents = new ArrayList<>();
        this.failedRecoveryComponents = new ArrayList<>();
    }
    
    // Getters and Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public long getStartTime() { return startTime; }
    public void setStartTime(long startTime) { this.startTime = startTime; }
    public long getEndTime() { return endTime; }
    public void setEndTime(long endTime) { this.endTime = endTime; }
    public List<String> getRecoveredComponents() { return recoveredComponents; }
    public List<String> getFailedRecoveryComponents() { return failedRecoveryComponents; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    // 添加恢复的组件
    public void addRecoveredComponent(String componentId) {
        this.recoveredComponents.add(componentId);
    }
    
    // 添加恢复失败的组件
    public void addFailedRecoveryComponent(String componentId) {
        this.failedRecoveryComponents.add(componentId);
    }
    
    // 获取演练持续时间
    public long getDuration() {
        return endTime - startTime;
    }
}
```

## 总结

容错与恢复机制是分布式任务调度系统稳定运行的重要保障。通过合理设计的容错策略、完善的故障检测和自动恢复机制，可以显著提升系统的可靠性和可用性。

关键要点包括：

1. **容错设计原则**：遵循冗余、隔离、快速恢复等核心原则
2. **故障检测机制**：基于心跳、超时检测等手段及时发现故障
3. **任务执行容错**：通过重试、迁移等机制保证任务顺利完成
4. **数据一致性保障**：采用事务、备份、校验等手段确保数据不丢失
5. **自动恢复机制**：实现故障自动检测和恢复，减少人工干预
6. **故障演练测试**：定期进行故障演练验证容错机制的有效性

在实际应用中，还需要根据具体业务场景和系统架构特点，选择合适的容错策略和技术方案，持续优化和完善容错与恢复机制。

在下一节中，我们将探讨负载均衡与资源调度技术，深入了解如何在分布式环境中高效地分配和利用计算资源。