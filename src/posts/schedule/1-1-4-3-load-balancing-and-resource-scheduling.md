---
title: 4.3 负载均衡与资源调度
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，负载均衡与资源调度是确保系统高效运行的关键技术。通过合理的负载均衡策略和资源调度机制，可以充分利用集群资源，避免节点过载或资源浪费，提升整体系统性能。本文将深入探讨负载均衡算法、资源调度策略以及在分布式调度系统中的实际应用。

## 负载均衡基础概念

负载均衡是指将工作负载合理分配到多个计算资源上，以优化资源使用、最大化吞吐量、最小化响应时间并避免过载。在分布式任务调度系统中，负载均衡主要体现在任务分配和资源利用两个方面。

### 负载均衡核心原理

```java
// 负载均衡器接口
public interface LoadBalancer {
    /**
     * 选择一个执行器来执行任务
     * @param task 任务对象
     * @param executors 可用执行器列表
     * @return 选中的执行器
     */
    ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors);
    
    /**
     * 更新执行器负载信息
     * @param executor 执行器
     * @param loadInfo 负载信息
     */
    void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo);
}

// 执行器负载信息
public class ExecutorLoadInfo {
    private String executorId;
    private int taskCount;          // 当前任务数
    private double cpuUsage;        // CPU使用率
    private long memoryUsage;       // 内存使用量
    private long diskUsage;         // 磁盘使用量
    private long networkIn;         // 网络入流量
    private long networkOut;        // 网络出流量
    private long lastUpdateTime;    // 最后更新时间
    
    public ExecutorLoadInfo(String executorId) {
        this.executorId = executorId;
        this.lastUpdateTime = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public String getExecutorId() { return executorId; }
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
    public long getLastUpdateTime() { return lastUpdateTime; }
    public void setLastUpdateTime(long lastUpdateTime) { this.lastUpdateTime = lastUpdateTime; }
    
    // 计算综合负载分数
    public double calculateLoadScore() {
        // 简单的负载评分算法
        // 可以根据实际需求调整权重
        return (cpuUsage * 0.4) + 
               ((double) memoryUsage / (1024 * 1024 * 1024) * 0.3) + 
               (taskCount * 0.3);
    }
}

// 负载信息收集器
public class LoadInfoCollector {
    private final ScheduledExecutorService collectorScheduler;
    private final ExecutorRegistry executorRegistry;
    private final Map<String, ExecutorLoadInfo> loadInfoMap;
    private final long collectInterval;
    
    public LoadInfoCollector(ExecutorRegistry executorRegistry, long collectInterval) {
        this.collectorScheduler = Executors.newScheduledThreadPool(2);
        this.executorRegistry = executorRegistry;
        this.loadInfoMap = new ConcurrentHashMap<>();
        this.collectInterval = collectInterval;
    }
    
    // 启动负载信息收集
    public void start() {
        collectorScheduler.scheduleAtFixedRate(
            this::collectLoadInfo, 0, collectInterval, TimeUnit.SECONDS);
        System.out.println("负载信息收集器已启动");
    }
    
    // 停止负载信息收集
    public void stop() {
        collectorScheduler.shutdown();
        try {
            if (!collectorScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                collectorScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            collectorScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("负载信息收集器已停止");
    }
    
    // 收集负载信息
    private void collectLoadInfo() {
        try {
            List<ExecutorNode> executors = executorRegistry.getAllExecutors();
            
            for (ExecutorNode executor : executors) {
                try {
                    // 获取执行器负载信息
                    ExecutorLoadInfo loadInfo = executor.getLoadInfo();
                    
                    // 更新负载信息
                    loadInfoMap.put(executor.getId(), loadInfo);
                    
                    System.out.println("收集到执行器负载信息: " + executor.getId() + 
                                     ", 负载分数: " + loadInfo.calculateLoadScore());
                } catch (Exception e) {
                    System.err.println("收集执行器 " + executor.getId() + " 负载信息时出错: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("收集负载信息时出错: " + e.getMessage());
        }
    }
    
    // 获取执行器负载信息
    public ExecutorLoadInfo getLoadInfo(String executorId) {
        return loadInfoMap.get(executorId);
    }
    
    // 获取所有负载信息
    public Map<String, ExecutorLoadInfo> getAllLoadInfo() {
        return new HashMap<>(loadInfoMap);
    }
}
```

### 常见负载均衡算法

```java
// 轮询负载均衡器
public class RoundRobinLoadBalancer implements LoadBalancer {
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    private final LoadInfoCollector loadInfoCollector;
    
    public RoundRobinLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            throw new IllegalStateException("没有可用的执行器");
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            throw new IllegalStateException("没有在线的执行器");
        }
        
        // 轮询选择执行器
        int index = currentIndex.getAndIncrement() % availableExecutors.size();
        return availableExecutors.get(index);
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 轮询算法不需要更新负载信息
    }
}

// 加权轮询负载均衡器
public class WeightedRoundRobinLoadBalancer implements LoadBalancer {
    private final LoadInfoCollector loadInfoCollector;
    private final Map<String, Integer> weights = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> currentWeights = new ConcurrentHashMap<>();
    
    public WeightedRoundRobinLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            throw new IllegalStateException("没有可用的执行器");
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            throw new IllegalStateException("没有在线的执行器");
        }
        
        // 初始化权重
        initializeWeights(availableExecutors);
        
        // 选择执行器
        return selectExecutorByWeight(availableExecutors);
    }
    
    // 初始化权重
    private void initializeWeights(List<ExecutorNode> executors) {
        for (ExecutorNode executor : executors) {
            String executorId = executor.getId();
            
            if (!weights.containsKey(executorId)) {
                // 根据执行器能力设置权重
                int weight = calculateExecutorWeight(executor);
                weights.put(executorId, weight);
                currentWeights.put(executorId, new AtomicInteger(weight));
            }
        }
    }
    
    // 计算执行器权重
    private int calculateExecutorWeight(ExecutorNode executor) {
        try {
            ExecutorLoadInfo loadInfo = executor.getLoadInfo();
            
            // 基础权重
            int baseWeight = 10;
            
            // 根据CPU核心数调整权重
            int cpuCores = Runtime.getRuntime().availableProcessors();
            int cpuWeight = cpuCores * 2;
            
            // 根据内存大小调整权重
            long maxMemory = Runtime.getRuntime().maxMemory();
            int memoryWeight = (int) (maxMemory / (1024 * 1024 * 100)); // 每100MB内存增加1权重
            
            return baseWeight + cpuWeight + memoryWeight;
        } catch (Exception e) {
            return 10; // 默认权重
        }
    }
    
    // 根据权重选择执行器
    private ExecutorNode selectExecutorByWeight(List<ExecutorNode> executors) {
        int totalWeight = executors.stream()
            .mapToInt(executor -> weights.getOrDefault(executor.getId(), 10))
            .sum();
        
        if (totalWeight <= 0) {
            // 使用轮询算法
            return executors.get(0);
        }
        
        int randomPoint = new Random().nextInt(totalWeight);
        int currentWeight = 0;
        
        for (ExecutorNode executor : executors) {
            String executorId = executor.getId();
            int weight = weights.getOrDefault(executorId, 10);
            currentWeight += weight;
            
            if (randomPoint < currentWeight) {
                return executor;
            }
        }
        
        return executors.get(0);
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 加权轮询算法不需要实时更新负载信息
    }
}

// 最少连接数负载均衡器
public class LeastConnectionsLoadBalancer implements LoadBalancer {
    private final LoadInfoCollector loadInfoCollector;
    
    public LeastConnectionsLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            throw new IllegalStateException("没有可用的执行器");
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            throw new IllegalStateException("没有在线的执行器");
        }
        
        // 选择任务数最少的执行器
        return availableExecutors.stream()
            .min(Comparator.comparingInt(this::getExecutorTaskCount))
            .orElse(availableExecutors.get(0));
    }
    
    // 获取执行器任务数
    private int getExecutorTaskCount(ExecutorNode executor) {
        ExecutorLoadInfo loadInfo = loadInfoCollector.getLoadInfo(executor.getId());
        if (loadInfo != null) {
            return loadInfo.getTaskCount();
        }
        
        // 如果没有负载信息，默认返回0
        return 0;
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 最少连接数算法需要更新负载信息
        loadInfoCollector.getAllLoadInfo().put(executor.getId(), loadInfo);
    }
}

// 响应时间负载均衡器
public class ResponseTimeLoadBalancer implements LoadBalancer {
    private final LoadInfoCollector loadInfoCollector;
    private final Map<String, Long> responseTimes = new ConcurrentHashMap<>();
    private final Map<String, Long> lastResponseTimeUpdate = new ConcurrentHashMap<>();
    
    public ResponseTimeLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            throw new IllegalStateException("没有可用的执行器");
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            throw new IllegalStateException("没有在线的执行器");
        }
        
        // 选择响应时间最短的执行器
        return availableExecutors.stream()
            .min(Comparator.comparingLong(this::getExecutorResponseTime))
            .orElse(availableExecutors.get(0));
    }
    
    // 获取执行器响应时间
    private long getExecutorResponseTime(ExecutorNode executor) {
        String executorId = executor.getId();
        Long responseTime = responseTimes.get(executorId);
        
        if (responseTime == null) {
            // 如果没有历史响应时间数据，使用默认值
            return 1000; // 1秒
        }
        
        // 检查数据是否过期（超过5分钟）
        Long lastUpdate = lastResponseTimeUpdate.get(executorId);
        if (lastUpdate != null && System.currentTimeMillis() - lastUpdate > 300000) {
            // 数据过期，使用默认值
            return 1000;
        }
        
        return responseTime;
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 响应时间算法需要更新响应时间信息
        // 这里简化处理，实际应用中需要收集真实的响应时间数据
        String executorId = executor.getId();
        responseTimes.put(executorId, (long) (loadInfo.getCpuUsage() * 1000));
        lastResponseTimeUpdate.put(executorId, System.currentTimeMillis());
    }
}

// 一致性哈希负载均衡器
public class ConsistentHashLoadBalancer implements LoadBalancer {
    private final LoadInfoCollector loadInfoCollector;
    private final TreeMap<Integer, ExecutorNode> hashRing = new TreeMap<>();
    private final int numberOfReplicas = 160; // 虚拟节点数
    
    public ConsistentHashLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
    }
    
    // 添加执行器到哈希环
    public synchronized void addExecutor(ExecutorNode executor) {
        for (int i = 0; i < numberOfReplicas; i++) {
            String key = executor.getId() + "-" + i;
            int hash = hash(key);
            hashRing.put(hash, executor);
        }
    }
    
    // 从哈希环移除执行器
    public synchronized void removeExecutor(ExecutorNode executor) {
        for (int i = 0; i < numberOfReplicas; i++) {
            String key = executor.getId() + "-" + i;
            int hash = hash(key);
            hashRing.remove(hash);
        }
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            throw new IllegalStateException("没有可用的执行器");
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            throw new IllegalStateException("没有在线的执行器");
        }
        
        // 构建哈希环
        buildHashRing(availableExecutors);
        
        if (hashRing.isEmpty()) {
            return availableExecutors.get(0);
        }
        
        // 根据任务ID计算哈希值
        int taskHash = hash(task.getTaskId());
        
        // 找到第一个大于等于任务哈希值的节点
        SortedMap<Integer, ExecutorNode> tailMap = hashRing.tailMap(taskHash);
        Integer nodeHash = tailMap.isEmpty() ? hashRing.firstKey() : tailMap.firstKey();
        
        return hashRing.get(nodeHash);
    }
    
    // 构建哈希环
    private void buildHashRing(List<ExecutorNode> executors) {
        hashRing.clear();
        
        for (ExecutorNode executor : executors) {
            for (int i = 0; i < numberOfReplicas; i++) {
                String key = executor.getId() + "-" + i;
                int hash = hash(key);
                hashRing.put(hash, executor);
            }
        }
    }
    
    // 计算哈希值
    private int hash(String key) {
        return key.hashCode();
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 一致性哈希算法不需要更新负载信息
    }
}
```

## 资源调度策略

资源调度是指根据任务需求和系统资源状况，合理分配计算资源以优化系统性能。在分布式调度系统中，资源调度需要考虑CPU、内存、磁盘、网络等多种资源。

### 资源调度器实现

```java
// 资源调度器接口
public interface ResourceScheduler {
    /**
     * 调度任务到合适的执行器
     * @param task 任务对象
     * @param executors 可用执行器列表
     * @return 调度结果
     */
    SchedulingResult scheduleTask(Task task, List<ExecutorNode> executors);
    
    /**
     * 重新平衡资源分配
     * @param executors 执行器列表
     */
    void rebalanceResources(List<ExecutorNode> executors);
}

// 调度结果
class SchedulingResult {
    private boolean success;
    private ExecutorNode selectedExecutor;
    private String message;
    private ResourceAllocation allocation;
    
    public SchedulingResult(boolean success, ExecutorNode selectedExecutor, 
                          String message, ResourceAllocation allocation) {
        this.success = success;
        this.selectedExecutor = selectedExecutor;
        this.message = message;
        this.allocation = allocation;
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public ExecutorNode getSelectedExecutor() { return selectedExecutor; }
    public String getMessage() { return message; }
    public ResourceAllocation getAllocation() { return allocation; }
}

// 资源分配
class ResourceAllocation {
    private long cpuCores;
    private long memoryBytes;
    private long diskBytes;
    private long networkBandwidth;
    
    public ResourceAllocation(long cpuCores, long memoryBytes, long diskBytes, long networkBandwidth) {
        this.cpuCores = cpuCores;
        this.memoryBytes = memoryBytes;
        this.diskBytes = diskBytes;
        this.networkBandwidth = networkBandwidth;
    }
    
    // Getters
    public long getCpuCores() { return cpuCores; }
    public long getMemoryBytes() { return memoryBytes; }
    public long getDiskBytes() { return diskBytes; }
    public long getNetworkBandwidth() { return networkBandwidth; }
}

// 基于资源需求的调度器
public class ResourceBasedScheduler implements ResourceScheduler {
    private final LoadInfoCollector loadInfoCollector;
    private final ResourceEstimator resourceEstimator;
    
    public ResourceBasedScheduler(LoadInfoCollector loadInfoCollector, 
                                ResourceEstimator resourceEstimator) {
        this.loadInfoCollector = loadInfoCollector;
        this.resourceEstimator = resourceEstimator;
    }
    
    @Override
    public SchedulingResult scheduleTask(Task task, List<ExecutorNode> executors) {
        if (executors.isEmpty()) {
            return new SchedulingResult(false, null, "没有可用的执行器", null);
        }
        
        // 过滤掉离线的执行器
        List<ExecutorNode> availableExecutors = executors.stream()
            .filter(executor -> executor.getStatus() == ExecutorStatus.ONLINE)
            .collect(Collectors.toList());
        
        if (availableExecutors.isEmpty()) {
            return new SchedulingResult(false, null, "没有在线的执行器", null);
        }
        
        // 估算任务资源需求
        ResourceRequirement requirement = resourceEstimator.estimateResourceRequirement(task);
        
        // 查找满足资源需求的执行器
        ExecutorNode selectedExecutor = findSuitableExecutor(requirement, availableExecutors);
        
        if (selectedExecutor == null) {
            return new SchedulingResult(false, null, "没有满足资源需求的执行器", null);
        }
        
        // 计算资源分配
        ResourceAllocation allocation = calculateResourceAllocation(requirement, selectedExecutor);
        
        return new SchedulingResult(true, selectedExecutor, "调度成功", allocation);
    }
    
    // 查找合适的执行器
    private ExecutorNode findSuitableExecutor(ResourceRequirement requirement, 
                                            List<ExecutorNode> executors) {
        return executors.stream()
            .filter(executor -> canMeetResourceRequirement(executor, requirement))
            .min(Comparator.comparingDouble(this::calculateExecutorLoadScore))
            .orElse(null);
    }
    
    // 检查执行器是否能满足资源需求
    private boolean canMeetResourceRequirement(ExecutorNode executor, 
                                            ResourceRequirement requirement) {
        try {
            ExecutorLoadInfo loadInfo = executor.getLoadInfo();
            
            // 检查CPU核心数
            if (loadInfo.getCpuUsage() + requirement.getCpuCores() > 
                Runtime.getRuntime().availableProcessors()) {
                return false;
            }
            
            // 检查内存
            long availableMemory = Runtime.getRuntime().maxMemory() - loadInfo.getMemoryUsage();
            if (availableMemory < requirement.getMemoryBytes()) {
                return false;
            }
            
            // 检查磁盘空间
            // 这里简化处理，实际应用中需要检查真实的磁盘空间
            long availableDisk = 10000000000L; // 10GB
            if (availableDisk < requirement.getDiskBytes()) {
                return false;
            }
            
            return true;
        } catch (Exception e) {
            System.err.println("检查执行器资源时出错: " + e.getMessage());
            return false;
        }
    }
    
    // 计算执行器负载分数
    private double calculateExecutorLoadScore(ExecutorNode executor) {
        ExecutorLoadInfo loadInfo = loadInfoCollector.getLoadInfo(executor.getId());
        if (loadInfo != null) {
            return loadInfo.calculateLoadScore();
        }
        return 0.0;
    }
    
    // 计算资源分配
    private ResourceAllocation calculateResourceAllocation(ResourceRequirement requirement, 
                                                         ExecutorNode executor) {
        // 这里简化处理，实际应用中需要更复杂的资源分配算法
        return new ResourceAllocation(
            requirement.getCpuCores(),
            requirement.getMemoryBytes(),
            requirement.getDiskBytes(),
            requirement.getNetworkBandwidth()
        );
    }
    
    @Override
    public void rebalanceResources(List<ExecutorNode> executors) {
        // 资源重新平衡逻辑
        System.out.println("执行资源重新平衡");
        
        // 这里可以实现负载迁移、资源回收等逻辑
    }
}

// 资源需求估算器
interface ResourceEstimator {
    ResourceRequirement estimateResourceRequirement(Task task);
}

// 资源需求
class ResourceRequirement {
    private long cpuCores;
    private long memoryBytes;
    private long diskBytes;
    private long networkBandwidth;
    private long executionTimeEstimate;
    
    public ResourceRequirement(long cpuCores, long memoryBytes, long diskBytes, 
                             long networkBandwidth, long executionTimeEstimate) {
        this.cpuCores = cpuCores;
        this.memoryBytes = memoryBytes;
        this.diskBytes = diskBytes;
        this.networkBandwidth = networkBandwidth;
        this.executionTimeEstimate = executionTimeEstimate;
    }
    
    // Getters
    public long getCpuCores() { return cpuCores; }
    public long getMemoryBytes() { return memoryBytes; }
    public long getDiskBytes() { return diskBytes; }
    public long getNetworkBandwidth() { return networkBandwidth; }
    public long getExecutionTimeEstimate() { return executionTimeEstimate; }
}

// 基于历史数据的资源估算器
class HistoricalDataResourceEstimator implements ResourceEstimator {
    private final TaskStore taskStore;
    
    public HistoricalDataResourceEstimator(TaskStore taskStore) {
        this.taskStore = taskStore;
    }
    
    @Override
    public ResourceRequirement estimateResourceRequirement(Task task) {
        try {
            // 获取任务的历史执行记录
            List<TaskExecutionRecord> history = taskStore.getExecutionHistory(task.getTaskId());
            
            if (history.isEmpty()) {
                // 没有历史数据，使用默认估算
                return estimateDefaultRequirement(task);
            }
            
            // 基于历史数据计算平均资源需求
            long avgCpu = history.stream()
                .mapToLong(record -> record.getResourceUsage().getCpuCores())
                .average()
                .orElse(1);
            
            long avgMemory = history.stream()
                .mapToLong(record -> record.getResourceUsage().getMemoryBytes())
                .average()
                .orElse(1024 * 1024 * 100); // 100MB
            
            long avgDisk = history.stream()
                .mapToLong(record -> record.getResourceUsage().getDiskBytes())
                .average()
                .orElse(1024 * 1024 * 10); // 10MB
            
            long avgNetwork = history.stream()
                .mapToLong(record -> record.getResourceUsage().getNetworkBandwidth())
                .average()
                .orElse(1024 * 1024); // 1MB/s
            
            long avgExecutionTime = history.stream()
                .mapToLong(TaskExecutionRecord::getExecutionTime)
                .average()
                .orElse(1000); // 1秒
            
            return new ResourceRequirement(avgCpu, avgMemory, avgDisk, avgNetwork, avgExecutionTime);
        } catch (Exception e) {
            System.err.println("估算资源需求时出错: " + e.getMessage());
            return estimateDefaultRequirement(task);
        }
    }
    
    // 默认资源需求估算
    private ResourceRequirement estimateDefaultRequirement(Task task) {
        // 根据任务类型估算资源需求
        switch (task.getType()) {
            case CPU_INTENSIVE:
                return new ResourceRequirement(2, 1024 * 1024 * 512, 1024 * 1024 * 10, 1024 * 1024, 5000);
            case IO_INTENSIVE:
                return new ResourceRequirement(1, 1024 * 1024 * 256, 1024 * 1024 * 100, 1024 * 1024 * 10, 3000);
            case MEMORY_INTENSIVE:
                return new ResourceRequirement(1, 1024 * 1024 * 1024, 1024 * 1024 * 10, 1024 * 1024, 2000);
            default:
                return new ResourceRequirement(1, 1024 * 1024 * 100, 1024 * 1024 * 10, 1024 * 1024, 1000);
        }
    }
}

// 任务执行记录（扩展）
class TaskExecutionRecord {
    private String taskId;
    private long executionTime;
    private boolean success;
    private long timestamp;
    private String errorMessage;
    private ResourceUsage resourceUsage;
    
    public TaskExecutionRecord(String taskId, long executionTime, boolean success) {
        this.taskId = taskId;
        this.executionTime = executionTime;
        this.success = success;
        this.timestamp = System.currentTimeMillis();
        this.resourceUsage = new ResourceUsage();
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public long getExecutionTime() { return executionTime; }
    public boolean isSuccess() { return success; }
    public long getTimestamp() { return timestamp; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public ResourceUsage getResourceUsage() { return resourceUsage; }
    public void setResourceUsage(ResourceUsage resourceUsage) { this.resourceUsage = resourceUsage; }
}

// 资源使用情况
class ResourceUsage {
    private long cpuCores;
    private long memoryBytes;
    private long diskBytes;
    private long networkBandwidth;
    
    public ResourceUsage() {
        this.cpuCores = 1;
        this.memoryBytes = 1024 * 1024 * 100; // 100MB
        this.diskBytes = 1024 * 1024 * 10; // 10MB
        this.networkBandwidth = 1024 * 1024; // 1MB/s
    }
    
    // Getters and Setters
    public long getCpuCores() { return cpuCores; }
    public void setCpuCores(long cpuCores) { this.cpuCores = cpuCores; }
    public long getMemoryBytes() { return memoryBytes; }
    public void setMemoryBytes(long memoryBytes) { this.memoryBytes = memoryBytes; }
    public long getDiskBytes() { return diskBytes; }
    public void setDiskBytes(long diskBytes) { this.diskBytes = diskBytes; }
    public long getNetworkBandwidth() { return networkBandwidth; }
    public void setNetworkBandwidth(long networkBandwidth) { this.networkBandwidth = networkBandwidth; }
}
```

## 动态资源调整

在实际运行中，系统负载和资源需求可能会动态变化，需要支持动态资源调整机制。

### 动态资源调整实现

```java
// 动态资源调整器
public class DynamicResourceAdjuster {
    private final ScheduledExecutorService adjusterScheduler;
    private final LoadInfoCollector loadInfoCollector;
    private final ResourceScheduler resourceScheduler;
    private final TaskStore taskStore;
    private final long adjustInterval;
    
    public DynamicResourceAdjuster(LoadInfoCollector loadInfoCollector,
                                 ResourceScheduler resourceScheduler,
                                 TaskStore taskStore,
                                 long adjustInterval) {
        this.adjusterScheduler = Executors.newScheduledThreadPool(1);
        this.loadInfoCollector = loadInfoCollector;
        this.resourceScheduler = resourceScheduler;
        this.taskStore = taskStore;
        this.adjustInterval = adjustInterval;
    }
    
    // 启动动态资源调整
    public void start() {
        adjusterScheduler.scheduleAtFixedRate(
            this::adjustResources, 60, adjustInterval, TimeUnit.SECONDS);
        System.out.println("动态资源调整器已启动");
    }
    
    // 停止动态资源调整
    public void stop() {
        adjusterScheduler.shutdown();
        try {
            if (!adjusterScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                adjusterScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            adjusterScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("动态资源调整器已停止");
    }
    
    // 调整资源
    private void adjustResources() {
        try {
            // 获取所有执行器的负载信息
            Map<String, ExecutorLoadInfo> loadInfoMap = loadInfoCollector.getAllLoadInfo();
            
            // 分析负载情况
            analyzeLoadSituation(loadInfoMap);
            
            // 根据分析结果调整资源分配
            adjustResourceAllocation(loadInfoMap);
        } catch (Exception e) {
            System.err.println("调整资源时出错: " + e.getMessage());
        }
    }
    
    // 分析负载情况
    private void analyzeLoadSituation(Map<String, ExecutorLoadInfo> loadInfoMap) {
        System.out.println("=== 负载分析报告 ===");
        
        double totalLoadScore = 0;
        int executorCount = 0;
        ExecutorLoadInfo highestLoad = null;
        ExecutorLoadInfo lowestLoad = null;
        
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            double loadScore = loadInfo.calculateLoadScore();
            totalLoadScore += loadScore;
            executorCount++;
            
            if (highestLoad == null || loadScore > highestLoad.calculateLoadScore()) {
                highestLoad = loadInfo;
            }
            
            if (lowestLoad == null || loadScore < lowestLoad.calculateLoadScore()) {
                lowestLoad = loadInfo;
            }
            
            System.out.printf("执行器 %s: 负载分数 %.2f, CPU %.2f%%, 内存 %dMB, 任务数 %d%n",
                loadInfo.getExecutorId(),
                loadScore,
                loadInfo.getCpuUsage() * 100,
                loadInfo.getMemoryUsage() / (1024 * 1024),
                loadInfo.getTaskCount());
        }
        
        if (executorCount > 0) {
            double averageLoadScore = totalLoadScore / executorCount;
            System.out.printf("平均负载分数: %.2f%n", averageLoadScore);
            
            if (highestLoad != null) {
                System.out.printf("最高负载执行器: %s (%.2f)%n", 
                    highestLoad.getExecutorId(), highestLoad.calculateLoadScore());
            }
            
            if (lowestLoad != null) {
                System.out.printf("最低负载执行器: %s (%.2f)%n", 
                    lowestLoad.getExecutorId(), lowestLoad.calculateLoadScore());
            }
            
            // 检查是否需要负载均衡
            if (highestLoad != null && lowestLoad != null) {
                double loadDifference = highestLoad.calculateLoadScore() - lowestLoad.calculateLoadScore();
                if (loadDifference > 2.0) { // 负载差异超过阈值
                    System.out.println("检测到负载不均衡，建议进行负载迁移");
                }
            }
        }
    }
    
    // 调整资源分配
    private void adjustResourceAllocation(Map<String, ExecutorLoadInfo> loadInfoMap) {
        // 检查是否有执行器过载
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            if (isExecutorOverloaded(loadInfo)) {
                handleOverloadedExecutor(loadInfo);
            }
        }
        
        // 检查是否有执行器空闲
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            if (isExecutorIdle(loadInfo)) {
                handleIdleExecutor(loadInfo);
            }
        }
    }
    
    // 检查执行器是否过载
    private boolean isExecutorOverloaded(ExecutorLoadInfo loadInfo) {
        double loadScore = loadInfo.calculateLoadScore();
        return loadScore > 8.0; // 负载分数超过8认为过载
    }
    
    // 检查执行器是否空闲
    private boolean isExecutorIdle(ExecutorLoadInfo loadInfo) {
        double loadScore = loadInfo.calculateLoadScore();
        return loadScore < 2.0 && loadInfo.getTaskCount() == 0; // 负载分数低于2且无任务认为空闲
    }
    
    // 处理过载执行器
    private void handleOverloadedExecutor(ExecutorLoadInfo loadInfo) {
        System.out.println("处理过载执行器: " + loadInfo.getExecutorId());
        
        // 可以实现以下策略：
        // 1. 迁移部分任务到其他执行器
        // 2. 限制新任务分配到该执行器
        // 3. 增加资源（如果可能）
        
        // 这里简化处理，只输出警告信息
        System.out.println("警告: 执行器 " + loadInfo.getExecutorId() + " 过载，请考虑任务迁移");
    }
    
    // 处理空闲执行器
    private void handleIdleExecutor(ExecutorLoadInfo loadInfo) {
        System.out.println("处理空闲执行器: " + loadInfo.getExecutorId());
        
        // 可以实现以下策略：
        // 1. 增加任务分配到该执行器
        // 2. 减少资源（如果可能）
        // 3. 关闭空闲执行器以节省资源
        
        // 这里简化处理，只输出信息
        System.out.println("信息: 执行器 " + loadInfo.getExecutorId() + " 空闲，可增加任务分配");
    }
}

// 自适应负载均衡器
public class AdaptiveLoadBalancer implements LoadBalancer {
    private final LoadInfoCollector loadInfoCollector;
    private final Map<String, LoadBalancer> strategies;
    private LoadBalancer currentStrategy;
    
    public AdaptiveLoadBalancer(LoadInfoCollector loadInfoCollector) {
        this.loadInfoCollector = loadInfoCollector;
        this.strategies = new HashMap<>();
        this.currentStrategy = new RoundRobinLoadBalancer(loadInfoCollector);
        
        // 初始化各种负载均衡策略
        strategies.put("ROUND_ROBIN", new RoundRobinLoadBalancer(loadInfoCollector));
        strategies.put("LEAST_CONNECTIONS", new LeastConnectionsLoadBalancer(loadInfoCollector));
        strategies.put("RESPONSE_TIME", new ResponseTimeLoadBalancer(loadInfoCollector));
        strategies.put("CONSISTENT_HASH", new ConsistentHashLoadBalancer(loadInfoCollector));
    }
    
    @Override
    public ExecutorNode selectExecutor(Task task, List<ExecutorNode> executors) {
        // 根据当前系统状态选择合适的负载均衡策略
        LoadBalancer strategy = selectBestStrategy(executors);
        return strategy.selectExecutor(task, executors);
    }
    
    // 选择最佳的负载均衡策略
    private LoadBalancer selectBestStrategy(List<ExecutorNode> executors) {
        try {
            // 分析当前负载情况
            Map<String, ExecutorLoadInfo> loadInfoMap = loadInfoCollector.getAllLoadInfo();
            
            if (loadInfoMap.isEmpty()) {
                return strategies.get("ROUND_ROBIN");
            }
            
            // 计算负载差异
            double loadVariance = calculateLoadVariance(loadInfoMap);
            
            // 根据负载差异选择策略
            if (loadVariance > 5.0) {
                // 负载差异较大，使用最少连接数策略
                return strategies.get("LEAST_CONNECTIONS");
            } else if (loadVariance > 2.0) {
                // 负载差异中等，使用响应时间策略
                return strategies.get("RESPONSE_TIME");
            } else {
                // 负载差异较小，使用轮询策略
                return strategies.get("ROUND_ROBIN");
            }
        } catch (Exception e) {
            System.err.println("选择负载均衡策略时出错: " + e.getMessage());
            return strategies.get("ROUND_ROBIN");
        }
    }
    
    // 计算负载差异（方差）
    private double calculateLoadVariance(Map<String, ExecutorLoadInfo> loadInfoMap) {
        if (loadInfoMap.isEmpty()) {
            return 0.0;
        }
        
        // 计算平均负载分数
        double sum = loadInfoMap.values().stream()
            .mapToDouble(ExecutorLoadInfo::calculateLoadScore)
            .sum();
        double average = sum / loadInfoMap.size();
        
        // 计算方差
        double variance = loadInfoMap.values().stream()
            .mapToDouble(info -> Math.pow(info.calculateLoadScore() - average, 2))
            .average()
            .orElse(0.0);
        
        return variance;
    }
    
    @Override
    public void updateLoadInfo(ExecutorNode executor, ExecutorLoadInfo loadInfo) {
        // 更新所有策略的负载信息
        for (LoadBalancer strategy : strategies.values()) {
            strategy.updateLoadInfo(executor, loadInfo);
        }
    }
}
```

## 资源监控与优化

为了确保负载均衡和资源调度的有效性，需要建立完善的资源监控体系，并持续优化调度策略。

### 资源监控实现

```java
// 资源监控器
public class ResourceMonitor {
    private final ScheduledExecutorService monitorScheduler;
    private final LoadInfoCollector loadInfoCollector;
    private final MetricsCollector metricsCollector;
    private final AlertService alertService;
    private final long monitorInterval;
    
    public ResourceMonitor(LoadInfoCollector loadInfoCollector,
                         MetricsCollector metricsCollector,
                         AlertService alertService,
                         long monitorInterval) {
        this.monitorScheduler = Executors.newScheduledThreadPool(1);
        this.loadInfoCollector = loadInfoCollector;
        this.metricsCollector = metricsCollector;
        this.alertService = alertService;
        this.monitorInterval = monitorInterval;
    }
    
    // 启动资源监控
    public void start() {
        monitorScheduler.scheduleAtFixedRate(
            this::monitorResources, 0, monitorInterval, TimeUnit.SECONDS);
        System.out.println("资源监控器已启动");
    }
    
    // 停止资源监控
    public void stop() {
        monitorScheduler.shutdown();
        try {
            if (!monitorScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                monitorScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            monitorScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("资源监控器已停止");
    }
    
    // 监控资源使用情况
    private void monitorResources() {
        try {
            // 获取所有执行器的负载信息
            Map<String, ExecutorLoadInfo> loadInfoMap = loadInfoCollector.getAllLoadInfo();
            
            // 监控各项资源指标
            monitorCpuUsage(loadInfoMap);
            monitorMemoryUsage(loadInfoMap);
            monitorTaskDistribution(loadInfoMap);
            
            // 生成监控报告
            generateMonitorReport(loadInfoMap);
        } catch (Exception e) {
            System.err.println("监控资源时出错: " + e.getMessage());
        }
    }
    
    // 监控CPU使用率
    private void monitorCpuUsage(Map<String, ExecutorLoadInfo> loadInfoMap) {
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            double cpuUsage = loadInfo.getCpuUsage();
            
            // 记录指标
            metricsCollector.recordCpuUsage(loadInfo.getExecutorId(), cpuUsage);
            
            // 检查是否超过阈值
            if (cpuUsage > 0.8) { // CPU使用率超过80%
                String message = String.format(
                    "执行器 %s CPU使用率过高: %.2f%%", 
                    loadInfo.getExecutorId(), cpuUsage * 100);
                
                Alert alert = new Alert(AlertLevel.WARNING, "HIGH_CPU_USAGE", message);
                alertService.sendAlert(alert);
            }
        }
    }
    
    // 监控内存使用情况
    private void monitorMemoryUsage(Map<String, ExecutorLoadInfo> loadInfoMap) {
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            long memoryUsage = loadInfo.getMemoryUsage();
            long maxMemory = Runtime.getRuntime().maxMemory();
            double memoryUsageRatio = (double) memoryUsage / maxMemory;
            
            // 记录指标
            metricsCollector.recordMemoryUsage(loadInfo.getExecutorId(), memoryUsage);
            
            // 检查是否超过阈值
            if (memoryUsageRatio > 0.8) { // 内存使用率超过80%
                String message = String.format(
                    "执行器 %s 内存使用率过高: %.2f%%", 
                    loadInfo.getExecutorId(), memoryUsageRatio * 100);
                
                Alert alert = new Alert(AlertLevel.WARNING, "HIGH_MEMORY_USAGE", message);
                alertService.sendAlert(alert);
            }
        }
    }
    
    // 监控任务分布情况
    private void monitorTaskDistribution(Map<String, ExecutorLoadInfo> loadInfoMap) {
        if (loadInfoMap.isEmpty()) {
            return;
        }
        
        // 计算任务分布的标准差
        double[] taskCounts = loadInfoMap.values().stream()
            .mapToDouble(ExecutorLoadInfo::getTaskCount)
            .toArray();
        
        double mean = Arrays.stream(taskCounts).average().orElse(0);
        double variance = Arrays.stream(taskCounts)
            .map(count -> Math.pow(count - mean, 2))
            .average()
            .orElse(0);
        double stdDev = Math.sqrt(variance);
        
        // 记录指标
        metricsCollector.recordTaskDistribution(stdDev);
        
        // 检查任务分布是否不均衡
        if (stdDev > 5.0) { // 标准差超过5认为分布不均衡
            String message = String.format("任务分布不均衡，标准差: %.2f", stdDev);
            Alert alert = new Alert(AlertLevel.INFO, "UNEVEN_TASK_DISTRIBUTION", message);
            alertService.sendAlert(alert);
        }
    }
    
    // 生成监控报告
    private void generateMonitorReport(Map<String, ExecutorLoadInfo> loadInfoMap) {
        System.out.println("=== 资源监控报告 ===");
        System.out.printf("%-15s %-10s %-10s %-10s %-10s%n", 
            "执行器ID", "CPU使用率", "内存使用", "任务数", "负载分数");
        System.out.println("----------------------------------------");
        
        for (ExecutorLoadInfo loadInfo : loadInfoMap.values()) {
            System.out.printf("%-15s %-10.2f%% %-10dMB %-10d %-10.2f%n",
                loadInfo.getExecutorId(),
                loadInfo.getCpuUsage() * 100,
                loadInfo.getMemoryUsage() / (1024 * 1024),
                loadInfo.getTaskCount(),
                loadInfo.calculateLoadScore());
        }
    }
}

// 指标收集器
interface MetricsCollector {
    void recordCpuUsage(String executorId, double cpuUsage);
    void recordMemoryUsage(String executorId, long memoryUsage);
    void recordTaskDistribution(double stdDev);
    void recordTaskExecutionTime(String executorId, long executionTime);
}

// 日志指标收集器
class LoggingMetricsCollector implements MetricsCollector {
    @Override
    public void recordCpuUsage(String executorId, double cpuUsage) {
        System.out.printf("[METRICS] CPU使用率 - 执行器: %s, 使用率: %.2f%%%n", 
            executorId, cpuUsage * 100);
    }
    
    @Override
    public void recordMemoryUsage(String executorId, long memoryUsage) {
        System.out.printf("[METRICS] 内存使用 - 执行器: %s, 使用量: %dMB%n", 
            executorId, memoryUsage / (1024 * 1024));
    }
    
    @Override
    public void recordTaskDistribution(double stdDev) {
        System.out.printf("[METRICS] 任务分布 - 标准差: %.2f%n", stdDev);
    }
    
    @Override
    public void recordTaskExecutionTime(String executorId, long executionTime) {
        System.out.printf("[METRICS] 任务执行时间 - 执行器: %s, 时间: %dms%n", 
            executorId, executionTime);
    }
}

// 告警服务
class AlertService {
    public void sendAlert(Alert alert) {
        // 实现告警发送逻辑
        System.out.println("发送告警: " + alert);
    }
}

// 告警类
class Alert {
    private AlertLevel level;
    private String type;
    private String message;
    private long timestamp;
    
    public Alert(AlertLevel level, String type, String message) {
        this.level = level;
        this.type = type;
        this.message = message;
        this.timestamp = System.currentTimeMillis();
    }
    
    // Getters
    public AlertLevel getLevel() { return level; }
    public String getType() { return type; }
    public String getMessage() { return message; }
    public long getTimestamp() { return timestamp; }
    
    @Override
    public String toString() {
        return String.format("Alert{level=%s, type='%s', message='%s', timestamp=%d}",
            level, type, message, timestamp);
    }
}

// 告警级别枚举
enum AlertLevel {
    INFO,     // 信息
    WARNING,  // 警告
    ERROR,    // 错误
    CRITICAL  // 严重
}
```

## 总结

负载均衡与资源调度是分布式任务调度系统的核心技术，通过合理的算法和策略可以显著提升系统性能和资源利用率。

关键要点包括：

1. **负载均衡算法**：轮询、加权轮询、最少连接数、响应时间、一致性哈希等算法各有适用场景
2. **资源调度策略**：基于资源需求估算和执行器能力进行智能调度
3. **动态调整机制**：根据系统负载动态调整资源分配和调度策略
4. **监控与优化**：建立完善的监控体系，持续优化调度效果

在实际应用中，需要根据具体业务场景和系统特点选择合适的负载均衡算法和资源调度策略，并通过持续监控和优化来提升系统性能。

在下一节中，我们将探讨分布式任务调度系统的性能优化最佳实践，深入了解如何通过各种技术手段提升系统的整体性能。