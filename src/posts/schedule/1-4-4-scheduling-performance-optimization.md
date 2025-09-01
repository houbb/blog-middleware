---
title: 调度性能优化
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在大规模分布式任务调度系统中，性能优化是确保系统高效运行的关键因素。随着任务数量的增加和业务复杂度的提升，调度系统面临着并发调度、资源利用、延迟控制等多方面的挑战。本文将深入探讨大规模任务并发调度、数据分片与批处理优化、调度延迟与准确性等关键技术，帮助构建高性能的调度系统。

## 大规模任务并发调度

当系统需要处理成千上万的任务时，如何高效地进行并发调度成为了一个重要问题。合理的并发控制和资源分配策略能够显著提升系统的吞吐量和响应速度。

### 任务分发策略

```java
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

// 任务分发器
public class TaskDispatcher {
    private final ExecutorService executorService;
    private final TaskQueueManager queueManager;
    private final LoadBalancer loadBalancer;
    private final AtomicInteger dispatchedCount = new AtomicInteger(0);
    
    public TaskDispatcher(ExecutorService executorService, 
                         TaskQueueManager queueManager,
                         LoadBalancer loadBalancer) {
        this.executorService = executorService;
        this.queueManager = queueManager;
        this.loadBalancer = loadBalancer;
    }
    
    /**
     * 并发分发任务列表
     */
    public CompletableFuture<List<TaskDispatchResult>> dispatchTasks(
            List<SchedulableTask> tasks, 
            int concurrencyLevel) {
        
        CompletableFuture<List<TaskDispatchResult>> future = new CompletableFuture<>();
        List<CompletableFuture<TaskDispatchResult>> dispatchFutures = new ArrayList<>();
        
        // 将任务分组以控制并发度
        List<List<SchedulableTask>> taskGroups = partitionTasks(tasks, concurrencyLevel);
        
        for (List<SchedulableTask> taskGroup : taskGroups) {
            CompletableFuture<TaskDispatchResult> groupFuture = 
                CompletableFuture.supplyAsync(() -> dispatchTaskGroup(taskGroup), executorService);
            dispatchFutures.add(groupFuture);
        }
        
        // 等待所有分组完成
        CompletableFuture.allOf(dispatchFutures.toArray(new CompletableFuture[0]))
            .whenComplete((voidResult, throwable) -> {
                if (throwable != null) {
                    future.completeExceptionally(throwable);
                } else {
                    List<TaskDispatchResult> results = new ArrayList<>();
                    for (CompletableFuture<TaskDispatchResult> dispatchFuture : dispatchFutures) {
                        try {
                            results.add(dispatchFuture.get());
                        } catch (Exception e) {
                            results.add(TaskDispatchResult.failure("Group dispatch failed", e));
                        }
                    }
                    future.complete(results);
                }
            });
        
        return future;
    }
    
    /**
     * 分发任务组
     */
    private TaskDispatchResult dispatchTaskGroup(List<SchedulableTask> tasks) {
        List<TaskDispatchInfo> dispatchInfos = new ArrayList<>();
        int successCount = 0;
        List<Exception> errors = new ArrayList<>();
        
        for (SchedulableTask task : tasks) {
            try {
                TaskDispatchInfo dispatchInfo = dispatchSingleTask(task);
                dispatchInfos.add(dispatchInfo);
                if (dispatchInfo.isSuccess()) {
                    successCount++;
                }
            } catch (Exception e) {
                errors.add(e);
            }
        }
        
        return new TaskDispatchResult(dispatchInfos, successCount, errors);
    }
    
    /**
     * 分发单个任务
     */
    private TaskDispatchInfo dispatchSingleTask(SchedulableTask task) {
        // 选择合适的执行节点
        ExecutionNode node = loadBalancer.selectNode(task);
        if (node == null) {
            return TaskDispatchInfo.failure(task.getId(), "No available execution node");
        }
        
        // 将任务放入节点队列
        boolean dispatched = queueManager.enqueueTask(node.getId(), task);
        dispatchedCount.incrementAndGet();
        
        if (dispatched) {
            return TaskDispatchInfo.success(task.getId(), node.getId());
        } else {
            return TaskDispatchInfo.failure(task.getId(), "Failed to enqueue task");
        }
    }
    
    /**
     * 将任务列表分组
     */
    private List<List<SchedulableTask>> partitionTasks(List<SchedulableTask> tasks, int groupSize) {
        List<List<SchedulableTask>> groups = new ArrayList<>();
        for (int i = 0; i < tasks.size(); i += groupSize) {
            int end = Math.min(i + groupSize, tasks.size());
            groups.add(new ArrayList<>(tasks.subList(i, end)));
        }
        return groups;
    }
    
    public int getDispatchedCount() {
        return dispatchedCount.get();
    }
}

// 可调度任务接口
public interface SchedulableTask {
    String getId();
    String getName();
    TaskPriority getPriority();
    long getEstimatedExecutionTime();
    Set<String> getRequiredResources();
}

// 任务优先级枚举
public enum TaskPriority {
    LOW(1), MEDIUM(2), HIGH(3), CRITICAL(4);
    
    private final int value;
    
    TaskPriority(int value) {
        this.value = value;
    }
    
    public int getValue() {
        return value;
    }
}

// 执行节点
public class ExecutionNode {
    private final String id;
    private final String address;
    private final int capacity;
    private final AtomicInteger currentLoad;
    private final Set<String> availableResources;
    
    public ExecutionNode(String id, String address, int capacity) {
        this.id = id;
        this.address = address;
        this.capacity = capacity;
        this.currentLoad = new AtomicInteger(0);
        this.availableResources = new HashSet<>();
    }
    
    public boolean canAcceptTask(SchedulableTask task) {
        return currentLoad.get() < capacity && 
               availableResources.containsAll(task.getRequiredResources());
    }
    
    public boolean acceptTask() {
        return currentLoad.incrementAndGet() <= capacity;
    }
    
    public void releaseTask() {
        currentLoad.decrementAndGet();
    }
    
    // getters
    public String getId() { return id; }
    public String getAddress() { return address; }
    public int getCapacity() { return capacity; }
    public int getCurrentLoad() { return currentLoad.get(); }
    public Set<String> getAvailableResources() { return availableResources; }
}

// 负载均衡器
public class LoadBalancer {
    private final List<ExecutionNode> nodes;
    private final LoadBalancingStrategy strategy;
    
    public LoadBalancer(List<ExecutionNode> nodes, LoadBalancingStrategy strategy) {
        this.nodes = new CopyOnWriteArrayList<>(nodes);
        this.strategy = strategy;
    }
    
    public ExecutionNode selectNode(SchedulableTask task) {
        return strategy.selectNode(nodes, task);
    }
    
    public void addNode(ExecutionNode node) {
        nodes.add(node);
    }
    
    public void removeNode(String nodeId) {
        nodes.removeIf(node -> node.getId().equals(nodeId));
    }
}

// 负载均衡策略接口
public interface LoadBalancingStrategy {
    ExecutionNode selectNode(List<ExecutionNode> nodes, SchedulableTask task);
}

// 最少负载策略
public class LeastLoadStrategy implements LoadBalancingStrategy {
    @Override
    public ExecutionNode selectNode(List<ExecutionNode> nodes, SchedulableTask task) {
        return nodes.stream()
            .filter(node -> node.canAcceptTask(task))
            .min(Comparator.comparingInt(ExecutionNode::getCurrentLoad))
            .orElse(null);
    }
}

// 加权轮询策略
public class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
    private final AtomicInteger counter = new AtomicInteger(0);
    
    @Override
    public ExecutionNode selectNode(List<ExecutionNode> nodes, SchedulableTask task) {
        List<ExecutionNode> availableNodes = nodes.stream()
            .filter(node -> node.canAcceptTask(task))
            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        
        if (availableNodes.isEmpty()) {
            return null;
        }
        
        int index = counter.getAndIncrement() % availableNodes.size();
        return availableNodes.get(index);
    }
}
```

### 任务队列管理

```java
// 任务队列管理器
public class TaskQueueManager {
    private final Map<String, BlockingQueue<SchedulableTask>> nodeQueues;
    private final Map<String, PriorityBlockingQueue<SchedulableTask>> priorityQueues;
    private final int queueCapacity;
    
    public TaskQueueManager(int queueCapacity) {
        this.nodeQueues = new ConcurrentHashMap<>();
        this.priorityQueues = new ConcurrentHashMap<>();
        this.queueCapacity = queueCapacity;
    }
    
    /**
     * 为节点创建任务队列
     */
    public void createNodeQueue(String nodeId) {
        nodeQueues.putIfAbsent(nodeId, new LinkedBlockingQueue<>(queueCapacity));
        priorityQueues.putIfAbsent(nodeId, new PriorityBlockingQueue<>(queueCapacity, 
            Comparator.comparing(SchedulableTask::getPriority).reversed()
                     .thenComparing(SchedulableTask::getEstimatedExecutionTime)));
    }
    
    /**
     * 将任务加入节点队列
     */
    public boolean enqueueTask(String nodeId, SchedulableTask task) {
        BlockingQueue<SchedulableTask> queue = nodeQueues.get(nodeId);
        if (queue != null) {
            return queue.offer(task);
        }
        return false;
    }
    
    /**
     * 将任务加入优先级队列
     */
    public boolean enqueuePriorityTask(String nodeId, SchedulableTask task) {
        PriorityBlockingQueue<SchedulableTask> queue = priorityQueues.get(nodeId);
        if (queue != null) {
            return queue.offer(task);
        }
        return false;
    }
    
    /**
     * 从节点队列获取任务
     */
    public SchedulableTask dequeueTask(String nodeId) throws InterruptedException {
        BlockingQueue<SchedulableTask> queue = nodeQueues.get(nodeId);
        if (queue != null) {
            return queue.take();
        }
        return null;
    }
    
    /**
     * 从优先级队列获取任务
     */
    public SchedulableTask dequeuePriorityTask(String nodeId) throws InterruptedException {
        PriorityBlockingQueue<SchedulableTask> queue = priorityQueues.get(nodeId);
        if (queue != null) {
            return queue.take();
        }
        return null;
    }
    
    /**
     * 获取队列大小
     */
    public int getQueueSize(String nodeId) {
        BlockingQueue<SchedulableTask> queue = nodeQueues.get(nodeId);
        return queue != null ? queue.size() : 0;
    }
    
    /**
     * 获取优先级队列大小
     */
    public int getPriorityQueueSize(String nodeId) {
        PriorityBlockingQueue<SchedulableTask> queue = priorityQueues.get(nodeId);
        return queue != null ? queue.size() : 0;
    }
}

// 任务分发结果
public class TaskDispatchResult {
    private final List<TaskDispatchInfo> dispatchInfos;
    private final int successCount;
    private final List<Exception> errors;
    
    public TaskDispatchResult(List<TaskDispatchInfo> dispatchInfos, int successCount, List<Exception> errors) {
        this.dispatchInfos = dispatchInfos;
        this.successCount = successCount;
        this.errors = errors;
    }
    
    public static TaskDispatchResult failure(String message, Exception error) {
        List<TaskDispatchInfo> infos = Collections.emptyList();
        List<Exception> errors = Arrays.asList(error);
        return new TaskDispatchResult(infos, 0, errors);
    }
    
    // getters
    public List<TaskDispatchInfo> getDispatchInfos() { return dispatchInfos; }
    public int getSuccessCount() { return successCount; }
    public List<Exception> getErrors() { return errors; }
    public boolean isSuccessful() { return errors.isEmpty(); }
}

// 任务分发信息
public class TaskDispatchInfo {
    private final String taskId;
    private final String nodeId;
    private final boolean success;
    private final String message;
    private final long timestamp;
    
    private TaskDispatchInfo(String taskId, String nodeId, boolean success, String message) {
        this.taskId = taskId;
        this.nodeId = nodeId;
        this.success = success;
        this.message = message;
        this.timestamp = System.currentTimeMillis();
    }
    
    public static TaskDispatchInfo success(String taskId, String nodeId) {
        return new TaskDispatchInfo(taskId, nodeId, true, "Task dispatched successfully");
    }
    
    public static TaskDispatchInfo failure(String taskId, String message) {
        return new TaskDispatchInfo(taskId, null, false, message);
    }
    
    // getters
    public String getTaskId() { return taskId; }
    public String getNodeId() { return nodeId; }
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public long getTimestamp() { return timestamp; }
}
```

## 数据分片与批处理优化

对于大规模数据处理任务，合理的数据分片和批处理策略能够显著提升处理效率，减少资源消耗。

### 数据分片策略

```java
// 数据分片器
public class DataSharder {
    
    /**
     * 基于哈希的分片
     */
    public static <T> Map<Integer, List<T>> hashShard(List<T> data, int shardCount) {
        Map<Integer, List<T>> shards = new HashMap<>();
        
        for (T item : data) {
            int shardIndex = Math.abs(item.hashCode()) % shardCount;
            shards.computeIfAbsent(shardIndex, k -> new ArrayList<>()).add(item);
        }
        
        return shards;
    }
    
    /**
     * 基于范围的分片
     */
    public static <T extends Comparable<T>> Map<Integer, List<T>> rangeShard(
            List<T> sortedData, int shardCount) {
        Map<Integer, List<T>> shards = new HashMap<>();
        int dataSize = sortedData.size();
        int shardSize = (int) Math.ceil((double) dataSize / shardCount);
        
        for (int i = 0; i < shardCount; i++) {
            int start = i * shardSize;
            int end = Math.min(start + shardSize, dataSize);
            
            if (start < dataSize) {
                shards.put(i, new ArrayList<>(sortedData.subList(start, end)));
            }
        }
        
        return shards;
    }
    
    /**
     * 基于权重的分片
     */
    public static <T> Map<Integer, List<T>> weightedShard(
            List<T> data, 
            Map<T, Integer> weights, 
            int shardCount) {
        
        // 按权重排序
        List<T> sortedData = new ArrayList<>(data);
        sortedData.sort((a, b) -> weights.getOrDefault(b, 0) - weights.getOrDefault(a, 0));
        
        // 使用轮询方式分配到各个分片
        Map<Integer, List<T>> shards = new HashMap<>();
        for (int i = 0; i < shardCount; i++) {
            shards.put(i, new ArrayList<>());
        }
        
        for (int i = 0; i < sortedData.size(); i++) {
            int shardIndex = i % shardCount;
            shards.get(shardIndex).add(sortedData.get(i));
        }
        
        return shards;
    }
}

// 分片任务
public class ShardableTask implements SchedulableTask {
    private final String id;
    private final String name;
    private final TaskPriority priority;
    private final List<DataShard> shards;
    private final long estimatedExecutionTime;
    
    public ShardableTask(String id, String name, TaskPriority priority, 
                        List<DataShard> shards, long estimatedExecutionTime) {
        this.id = id;
        this.name = name;
        this.priority = priority;
        this.shards = shards;
        this.estimatedExecutionTime = estimatedExecutionTime;
    }
    
    @Override
    public String getId() { return id; }
    
    @Override
    public String getName() { return name; }
    
    @Override
    public TaskPriority getPriority() { return priority; }
    
    @Override
    public long getEstimatedExecutionTime() { return estimatedExecutionTime; }
    
    @Override
    public Set<String> getRequiredResources() {
        Set<String> resources = new HashSet<>();
        for (DataShard shard : shards) {
            resources.addAll(shard.getRequiredResources());
        }
        return resources;
    }
    
    public List<DataShard> getShards() { return shards; }
}

// 数据分片
public class DataShard {
    private final int shardIndex;
    private final List<String> dataKeys;
    private final long dataSize;
    private final Set<String> requiredResources;
    
    public DataShard(int shardIndex, List<String> dataKeys, long dataSize) {
        this.shardIndex = shardIndex;
        this.dataKeys = dataKeys;
        this.dataSize = dataSize;
        this.requiredResources = new HashSet<>();
        this.requiredResources.add("CPU");
        this.requiredResources.add("MEMORY");
        
        // 根据数据大小调整资源需求
        if (dataSize > 1000000) { // 1MB
            this.requiredResources.add("DISK");
        }
    }
    
    // getters
    public int getShardIndex() { return shardIndex; }
    public List<String> getDataKeys() { return dataKeys; }
    public long getDataSize() { return dataSize; }
    public Set<String> getRequiredResources() { return requiredResources; }
}
```

### 批处理优化

```java
// 批处理任务执行器
public class BatchTaskExecutor {
    private final ExecutorService executorService;
    private final int batchSize;
    private final long batchTimeoutMs;
    
    public BatchTaskExecutor(ExecutorService executorService, int batchSize, long batchTimeoutMs) {
        this.executorService = executorService;
        this.batchSize = batchSize;
        this.batchTimeoutMs = batchTimeoutMs;
    }
    
    /**
     * 批处理执行任务
     */
    public <T, R> CompletableFuture<List<R>> executeBatch(
            List<T> items, 
            Function<List<T>, List<R>> batchProcessor) {
        
        CompletableFuture<List<R>> future = new CompletableFuture<>();
        List<CompletableFuture<List<R>>> batchFutures = new ArrayList<>();
        
        // 将数据分批
        List<List<T>> batches = partition(items, batchSize);
        
        for (List<T> batch : batches) {
            CompletableFuture<List<R>> batchFuture = 
                CompletableFuture.supplyAsync(() -> batchProcessor.apply(batch), executorService);
            batchFutures.add(batchFuture);
        }
        
        // 等待所有批次完成
        CompletableFuture.allOf(batchFutures.toArray(new CompletableFuture[0]))
            .whenComplete((voidResult, throwable) -> {
                if (throwable != null) {
                    future.completeExceptionally(throwable);
                } else {
                    List<R> results = new ArrayList<>();
                    for (CompletableFuture<List<R>> batchFuture : batchFutures) {
                        try {
                            results.addAll(batchFuture.get());
                        } catch (Exception e) {
                            future.completeExceptionally(e);
                            return;
                        }
                    }
                    future.complete(results);
                }
            });
        
        return future;
    }
    
    /**
     * 带超时的批处理执行
     */
    public <T, R> CompletableFuture<List<R>> executeBatchWithTimeout(
            List<T> items,
            Function<List<T>, List<R>> batchProcessor,
            ScheduledExecutorService scheduler) {
        
        CompletableFuture<List<R>> future = new CompletableFuture<>();
        
        // 设置超时
        ScheduledFuture<?> timeoutFuture = scheduler.schedule(() -> {
            if (!future.isDone()) {
                future.completeExceptionally(new TimeoutException("Batch execution timed out"));
            }
        }, batchTimeoutMs, TimeUnit.MILLISECONDS);
        
        // 执行批处理
        executeBatch(items, batchProcessor).whenComplete((result, throwable) -> {
            timeoutFuture.cancel(false);
            if (throwable != null) {
                future.completeExceptionally(throwable);
            } else {
                future.complete(result);
            }
        });
        
        return future;
    }
    
    /**
     * 将列表分批
     */
    private <T> List<List<T>> partition(List<T> items, int batchSize) {
        List<List<T>> batches = new ArrayList<>();
        for (int i = 0; i < items.size(); i += batchSize) {
            int end = Math.min(i + batchSize, items.size());
            batches.add(new ArrayList<>(items.subList(i, end)));
        }
        return batches;
    }
}

// 示例：数据库批处理操作
public class DatabaseBatchProcessor {
    private final BatchTaskExecutor batchExecutor;
    
    public DatabaseBatchProcessor(BatchTaskExecutor batchExecutor) {
        this.batchExecutor = batchExecutor;
    }
    
    /**
     * 批量插入数据
     */
    public CompletableFuture<List<String>> batchInsert(List<User> users) {
        return batchExecutor.executeBatch(users, this::insertBatch);
    }
    
    /**
     * 插入一批数据
     */
    private List<String> insertBatch(List<User> users) {
        List<String> results = new ArrayList<>();
        
        // 模拟数据库批量插入
        System.out.println("批量插入 " + users.size() + " 条用户数据");
        
        for (User user : users) {
            // 模拟插入操作
            String result = "用户 " + user.getId() + " 插入成功";
            results.add(result);
        }
        
        // 模拟处理时间
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        return results;
    }
}

// 用户实体
public class User {
    private final String id;
    private final String name;
    private final String email;
    
    public User(String id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }
    
    // getters
    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
}
```

## 调度延迟与准确性

调度系统的延迟和准确性直接影响用户体验和业务效果。优化调度延迟、提高调度准确性是性能优化的重要方面。

### 调度延迟优化

```java
// 调度延迟监控器
public class SchedulingLatencyMonitor {
    private final Map<String, LatencyStats> taskLatencyStats;
    private final ScheduledExecutorService scheduler;
    
    public SchedulingLatencyMonitor(ScheduledExecutorService scheduler) {
        this.taskLatencyStats = new ConcurrentHashMap<>();
        this.scheduler = scheduler;
        startPeriodicReporting();
    }
    
    /**
     * 记录任务调度延迟
     */
    public void recordSchedulingLatency(String taskId, long scheduledTime, long actualTime) {
        long latency = actualTime - scheduledTime;
        taskLatencyStats.computeIfAbsent(taskId, k -> new LatencyStats())
                       .addLatency(latency);
    }
    
    /**
     * 获取平均调度延迟
     */
    public double getAverageLatency(String taskId) {
        LatencyStats stats = taskLatencyStats.get(taskId);
        return stats != null ? stats.getAverageLatency() : 0.0;
    }
    
    /**
     * 获取最大调度延迟
     */
    public long getMaxLatency(String taskId) {
        LatencyStats stats = taskLatencyStats.get(taskId);
        return stats != null ? stats.getMaxLatency() : 0L;
    }
    
    /**
     * 启动定期报告
     */
    private void startPeriodicReporting() {
        scheduler.scheduleAtFixedRate(this::reportLatencyStats, 60, 60, TimeUnit.SECONDS);
    }
    
    /**
     * 报告延迟统计
     */
    private void reportLatencyStats() {
        System.out.println("=== 调度延迟统计报告 ===");
        for (Map.Entry<String, LatencyStats> entry : taskLatencyStats.entrySet()) {
            String taskId = entry.getKey();
            LatencyStats stats = entry.getValue();
            System.out.printf("任务 %s: 平均延迟 %.2f ms, 最大延迟 %d ms, 总执行次数 %d%n",
                            taskId, stats.getAverageLatency(), 
                            stats.getMaxLatency(), stats.getExecutionCount());
        }
    }
    
    /**
     * 延迟统计
     */
    private static class LatencyStats {
        private final LongAdder totalLatency = new LongAdder();
        private final LongAdder executionCount = new LongAdder();
        private final AtomicLong maxLatency = new AtomicLong(0);
        
        public void addLatency(long latency) {
            totalLatency.add(latency);
            executionCount.increment();
            maxLatency.accumulateAndGet(latency, Math::max);
        }
        
        public double getAverageLatency() {
            long count = executionCount.sum();
            return count > 0 ? (double) totalLatency.sum() / count : 0.0;
        }
        
        public long getMaxLatency() {
            return maxLatency.get();
        }
        
        public long getExecutionCount() {
            return executionCount.sum();
        }
    }
}

// 高精度调度器
public class HighPrecisionScheduler {
    private final ScheduledExecutorService scheduler;
    private final SchedulingLatencyMonitor latencyMonitor;
    private final PriorityQueue<ScheduledTask> taskQueue;
    private final Thread schedulingThread;
    private volatile boolean running = true;
    
    public HighPrecisionScheduler(ScheduledExecutorService scheduler, 
                                 SchedulingLatencyMonitor latencyMonitor) {
        this.scheduler = scheduler;
        this.latencyMonitor = latencyMonitor;
        this.taskQueue = new PriorityQueue<>(Comparator.comparingLong(ScheduledTask::getScheduledTime));
        this.schedulingThread = new Thread(this::schedulingLoop);
        this.schedulingThread.setDaemon(true);
        this.schedulingThread.start();
    }
    
    /**
     * 调度任务
     */
    public void scheduleTask(Runnable task, long scheduledTime, String taskId) {
        taskQueue.offer(new ScheduledTask(task, scheduledTime, taskId));
    }
    
    /**
     * 调度循环
     */
    private void schedulingLoop() {
        while (running) {
            ScheduledTask scheduledTask = taskQueue.peek();
            if (scheduledTask != null) {
                long currentTime = System.nanoTime();
                long scheduledTime = scheduledTask.getScheduledTime();
                
                if (currentTime >= scheduledTime) {
                    // 任务到期，执行
                    taskQueue.poll();
                    executeTask(scheduledTask);
                } else {
                    // 等待到执行时间
                    long sleepTimeNanos = scheduledTime - currentTime;
                    if (sleepTimeNanos > 1000000) { // 1ms
                        try {
                            Thread.sleep(sleepTimeNanos / 1000000, (int) (sleepTimeNanos % 1000000));
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    } else {
                        // 短时间等待使用忙等待提高精度
                        while (System.nanoTime() < scheduledTime && running) {
                            Thread.onSpinWait();
                        }
                    }
                }
            } else {
                // 队列为空，短暂休眠
                try {
                    Thread.sleep(1);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }
    
    /**
     * 执行任务
     */
    private void executeTask(ScheduledTask scheduledTask) {
        long actualTime = System.currentTimeMillis();
        long scheduledTime = scheduledTask.getScheduledTime() / 1000000; // 转换为毫秒
        
        // 记录调度延迟
        latencyMonitor.recordSchedulingLatency(
            scheduledTask.getTaskId(), scheduledTime, actualTime);
        
        // 执行任务
        scheduler.submit(scheduledTask.getTask());
    }
    
    /**
     * 停止调度器
     */
    public void shutdown() {
        running = false;
        schedulingThread.interrupt();
    }
    
    /**
     * 调度任务包装类
     */
    private static class ScheduledTask {
        private final Runnable task;
        private final long scheduledTime;
        private final String taskId;
        
        public ScheduledTask(Runnable task, long scheduledTime, String taskId) {
            this.task = task;
            this.scheduledTime = scheduledTime;
            this.taskId = taskId;
        }
        
        public Runnable getTask() { return task; }
        public long getScheduledTime() { return scheduledTime; }
        public String getTaskId() { return taskId; }
    }
}
```

### 调度准确性保障

```java
// 调度准确性检查器
public class SchedulingAccuracyChecker {
    private final Map<String, ScheduledTaskInfo> scheduledTasks;
    private final ScheduledExecutorService scheduler;
    private final long accuracyCheckIntervalMs;
    
    public SchedulingAccuracyChecker(ScheduledExecutorService scheduler, 
                                   long accuracyCheckIntervalMs) {
        this.scheduledTasks = new ConcurrentHashMap<>();
        this.scheduler = scheduler;
        this.accuracyCheckIntervalMs = accuracyCheckIntervalMs;
        startAccuracyChecking();
    }
    
    /**
     * 注册调度任务
     */
    public void registerScheduledTask(String taskId, String cronExpression, long nextExecutionTime) {
        scheduledTasks.put(taskId, new ScheduledTaskInfo(taskId, cronExpression, nextExecutionTime));
    }
    
    /**
     * 更新任务执行时间
     */
    public void updateTaskExecutionTime(String taskId, long actualExecutionTime) {
        ScheduledTaskInfo taskInfo = scheduledTasks.get(taskId);
        if (taskInfo != null) {
            taskInfo.recordExecution(actualExecutionTime);
        }
    }
    
    /**
     * 启动准确性检查
     */
    private void startAccuracyChecking() {
        scheduler.scheduleAtFixedRate(this::checkAccuracy, 
                                    accuracyCheckIntervalMs, 
                                    accuracyCheckIntervalMs, 
                                    TimeUnit.MILLISECONDS);
    }
    
    /**
     * 检查调度准确性
     */
    private void checkAccuracy() {
        long currentTime = System.currentTimeMillis();
        
        for (ScheduledTaskInfo taskInfo : scheduledTasks.values()) {
            long expectedTime = taskInfo.getNextExecutionTime();
            long timeDiff = Math.abs(currentTime - expectedTime);
            
            // 如果时间差超过阈值，记录警告
            if (timeDiff > 1000) { // 1秒
                System.out.printf("警告: 任务 %s 调度时间偏差 %d ms%n", 
                                taskInfo.getTaskId(), timeDiff);
            }
            
            // 更新下一次执行时间
            updateNextExecutionTime(taskInfo);
        }
    }
    
    /**
     * 更新下一次执行时间
     */
    private void updateNextExecutionTime(ScheduledTaskInfo taskInfo) {
        try {
            // 解析 Cron 表达式计算下一次执行时间
            long nextTime = CronExpressionParser.getNextExecutionTime(
                taskInfo.getCronExpression(), System.currentTimeMillis());
            taskInfo.setNextExecutionTime(nextTime);
        } catch (Exception e) {
            System.err.println("更新任务 " + taskInfo.getTaskId() + " 的下一次执行时间失败: " + e.getMessage());
        }
    }
    
    /**
     * 调度任务信息
     */
    private static class ScheduledTaskInfo {
        private final String taskId;
        private final String cronExpression;
        private volatile long nextExecutionTime;
        private final List<Long> executionTimes;
        
        public ScheduledTaskInfo(String taskId, String cronExpression, long nextExecutionTime) {
            this.taskId = taskId;
            this.cronExpression = cronExpression;
            this.nextExecutionTime = nextExecutionTime;
            this.executionTimes = new ArrayList<>();
        }
        
        public void recordExecution(long executionTime) {
            executionTimes.add(executionTime);
            // 保持最近100次执行记录
            if (executionTimes.size() > 100) {
                executionTimes.remove(0);
            }
        }
        
        // getters and setters
        public String getTaskId() { return taskId; }
        public String getCronExpression() { return cronExpression; }
        public long getNextExecutionTime() { return nextExecutionTime; }
        public void setNextExecutionTime(long nextExecutionTime) { this.nextExecutionTime = nextExecutionTime; }
        public List<Long> getExecutionTimes() { return executionTimes; }
    }
}

// Cron 表达式解析器（简化版）
public class CronExpressionParser {
    
    /**
     * 计算下一次执行时间
     */
    public static long getNextExecutionTime(String cronExpression, long currentTime) {
        // 这里应该实现完整的 Cron 表达式解析逻辑
        // 为简化示例，我们返回当前时间加上固定间隔
        String[] parts = cronExpression.split(" ");
        if (parts.length >= 1) {
            try {
                // 假设第一个字段是秒字段
                int interval = Integer.parseInt(parts[0]);
                return currentTime + (interval * 1000L);
            } catch (NumberFormatException e) {
                // 默认返回1分钟后
                return currentTime + 60000L;
            }
        }
        return currentTime + 60000L; // 默认1分钟后
    }
}
```

## 综合性能优化示例

```java
public class PerformanceOptimizationExample {
    public static void main(String[] args) throws Exception {
        // 初始化组件
        ExecutorService executorService = Executors.newFixedThreadPool(10);
        ScheduledExecutorService scheduledExecutor = Executors.newScheduledThreadPool(2);
        
        TaskQueueManager queueManager = new TaskQueueManager(1000);
        LoadBalancer loadBalancer = new LoadBalancer(
            createExecutionNodes(), new LeastLoadStrategy());
        TaskDispatcher dispatcher = new TaskDispatcher(executorService, queueManager, loadBalancer);
        
        SchedulingLatencyMonitor latencyMonitor = new SchedulingLatencyMonitor(scheduledExecutor);
        HighPrecisionScheduler highPrecisionScheduler = new HighPrecisionScheduler(
            executorService, latencyMonitor);
        
        SchedulingAccuracyChecker accuracyChecker = new SchedulingAccuracyChecker(
            scheduledExecutor, 30000); // 30秒检查一次
        
        BatchTaskExecutor batchExecutor = new BatchTaskExecutor(executorService, 50, 5000);
        DatabaseBatchProcessor dbProcessor = new DatabaseBatchProcessor(batchExecutor);
        
        // 示例1: 大规模任务并发调度
        System.out.println("=== 示例1: 大规模任务并发调度 ===");
        List<SchedulableTask> tasks = createSampleTasks(1000);
        CompletableFuture<List<TaskDispatchResult>> dispatchFuture = 
            dispatcher.dispatchTasks(tasks, 10);
        
        List<TaskDispatchResult> results = dispatchFuture.get(30, TimeUnit.SECONDS);
        int totalSuccess = results.stream().mapToInt(TaskDispatchResult::getSuccessCount).sum();
        System.out.println("成功调度任务数: " + totalSuccess + "/" + tasks.size());
        
        // 示例2: 数据分片与批处理
        System.out.println("\n=== 示例2: 数据分片与批处理 ===");
        List<User> users = createSampleUsers(10000);
        CompletableFuture<List<String>> batchResult = dbProcessor.batchInsert(users);
        List<String> insertResults = batchResult.get(30, TimeUnit.SECONDS);
        System.out.println("批量插入完成，处理记录数: " + insertResults.size());
        
        // 示例3: 高精度调度
        System.out.println("\n=== 示例3: 高精度调度 ===");
        for (int i = 0; i < 10; i++) {
            String taskId = "TASK_" + i;
            long scheduledTime = System.nanoTime() + (i * 1000000000L); // 每隔1秒
            highPrecisionScheduler.scheduleTask(
                () -> System.out.println("任务 " + taskId + " 在 " + System.currentTimeMillis() + " 执行"),
                scheduledTime, taskId);
            
            // 注册到准确性检查器
            accuracyChecker.registerScheduledTask(taskId, "0/" + (i + 1) + " * * * * ?", 
                                                System.currentTimeMillis() + ((i + 1) * 1000));
        }
        
        // 等待任务执行
        Thread.sleep(15000);
        
        // 关闭资源
        highPrecisionScheduler.shutdown();
        executorService.shutdown();
        scheduledExecutor.shutdown();
    }
    
    private static List<ExecutionNode> createExecutionNodes() {
        List<ExecutionNode> nodes = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            ExecutionNode node = new ExecutionNode("NODE_" + i, "192.168.1." + (100 + i), 50);
            node.getAvailableResources().addAll(Arrays.asList("CPU", "MEMORY", "DISK"));
            nodes.add(node);
        }
        return nodes;
    }
    
    private static List<SchedulableTask> createSampleTasks(int count) {
        List<SchedulableTask> tasks = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            int taskIndex = i;
            tasks.add(new SchedulableTask() {
                @Override
                public String getId() { return "TASK_" + taskIndex; }
                @Override
                public String getName() { return "任务_" + taskIndex; }
                @Override
                public TaskPriority getPriority() { return TaskPriority.MEDIUM; }
                @Override
                public long getEstimatedExecutionTime() { return 1000; }
                @Override
                public Set<String> getRequiredResources() { 
                    return new HashSet<>(Arrays.asList("CPU", "MEMORY")); 
                }
            });
        }
        return tasks;
    }
    
    private static List<User> createSampleUsers(int count) {
        List<User> users = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            users.add(new User("USER_" + i, "用户" + i, "user" + i + "@example.com"));
        }
        return users;
    }
}
```

## 最佳实践

### 1. 性能监控与调优

```java
// 性能监控指标
public class PerformanceMetrics {
    private final MeterRegistry meterRegistry;
    
    public PerformanceMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordTaskDispatch(String taskType, long durationMs, boolean success) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("task.dispatch")
            .tag("type", taskType)
            .tag("success", String.valueOf(success))
            .register(meterRegistry));
    }
    
    public void recordBatchProcessing(int batchSize, long durationMs, int successCount) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("batch.processing")
            .tag("batch_size", String.valueOf(batchSize))
            .register(meterRegistry));
        
        DistributionSummary.builder("batch.success_rate")
            .register(meterRegistry)
            .record((double) successCount / batchSize);
    }
    
    public void recordSchedulingLatency(String taskType, long latencyMs) {
        DistributionSummary.builder("scheduling.latency")
            .tag("type", taskType)
            .register(meterRegistry)
            .record(latencyMs);
    }
}
```

### 2. 资源管理优化

```java
// 动态资源管理器
public class DynamicResourceManager {
    private final List<ExecutionNode> nodes;
    private final ScheduledExecutorService scheduler;
    
    public DynamicResourceManager(List<ExecutionNode> nodes, ScheduledExecutorService scheduler) {
        this.nodes = new CopyOnWriteArrayList<>(nodes);
        this.scheduler = scheduler;
        startResourceMonitoring();
    }
    
    /**
     * 启动资源监控
     */
    private void startResourceMonitoring() {
        scheduler.scheduleAtFixedRate(this::monitorResources, 30, 30, TimeUnit.SECONDS);
    }
    
    /**
     * 监控资源使用情况
     */
    private void monitorResources() {
        for (ExecutionNode node : nodes) {
            double loadPercentage = (double) node.getCurrentLoad() / node.getCapacity();
            
            // 如果负载过高，记录警告
            if (loadPercentage > 0.8) {
                System.out.println("警告: 节点 " + node.getId() + " 负载过高: " + 
                                 String.format("%.2f%%", loadPercentage * 100));
            }
        }
    }
    
    /**
     * 动态调整节点容量
     */
    public void adjustNodeCapacity(String nodeId, int newCapacity) {
        nodes.stream()
            .filter(node -> node.getId().equals(nodeId))
            .findFirst()
            .ifPresent(node -> {
                // 这里应该实现实际的容量调整逻辑
                System.out.println("调整节点 " + nodeId + " 容量到 " + newCapacity);
            });
    }
}
```

## 总结

调度性能优化是构建高效分布式调度系统的关键环节。通过合理的并发调度策略、数据分片与批处理优化、调度延迟控制和准确性保障，我们可以显著提升系统的性能和用户体验。

关键要点包括：

1. **并发调度优化**：通过任务分发、负载均衡和队列管理提升并发处理能力
2. **数据分片策略**：合理分片大规模数据，提高处理效率
3. **批处理优化**：批量处理相似任务，减少系统开销
4. **延迟控制**：通过高精度调度和延迟监控确保任务按时执行
5. **准确性保障**：定期检查调度准确性，及时发现和解决问题

在实际应用中，需要根据具体的业务场景和系统规模，选择合适的优化策略，并建立完善的监控体系，持续优化系统性能。

在下一章中，我们将探讨安全与多租户设计，包括任务隔离与权限控制、任务数据加密与审计、多租户架构设计等重要话题。