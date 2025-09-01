---
title: 4.1 任务分片与并行处理
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，任务分片与并行处理是提升系统处理能力和扩展性的关键技术。通过将大型任务分解为多个小任务并行执行，可以显著提高任务处理效率，充分利用集群资源。本文将深入探讨任务分片与并行处理的设计原理、实现机制以及最佳实践。

## 任务分片的概念与意义

任务分片是指将一个大型任务按照一定的规则分解为多个独立的子任务，这些子任务可以并行执行，最终将结果合并得到完整的任务结果。任务分片在分布式调度系统中具有重要意义。

### 任务分片的核心价值

```java
// 任务分片实体类
public class TaskShard {
    private String shardId;           // 分片ID
    private String taskId;            // 所属任务ID
    private int shardIndex;           // 分片索引
    private int totalShards;          // 总分片数
    private ShardStatus status;       // 分片状态
    private Object shardData;         // 分片数据
    private String assignedExecutor;  // 分配的执行器
    private long createTime;          // 创建时间
    private long startTime;           // 开始时间
    private long endTime;             // 结束时间
    private String result;            // 执行结果
    
    public TaskShard(String taskId, int shardIndex, int totalShards, Object shardData) {
        this.shardId = taskId + "_shard_" + shardIndex;
        this.taskId = taskId;
        this.shardIndex = shardIndex;
        this.totalShards = totalShards;
        this.shardData = shardData;
        this.status = ShardStatus.PENDING;
        this.createTime = System.currentTimeMillis();
    }
    
    // Getters and Setters
    public String getShardId() { return shardId; }
    public String getTaskId() { return taskId; }
    public int getShardIndex() { return shardIndex; }
    public int getTotalShards() { return totalShards; }
    public ShardStatus getStatus() { return status; }
    public void setStatus(ShardStatus status) { this.status = status; }
    public Object getShardData() { return shardData; }
    public String getAssignedExecutor() { return assignedExecutor; }
    public void setAssignedExecutor(String assignedExecutor) { this.assignedExecutor = assignedExecutor; }
    public long getCreateTime() { return createTime; }
    public long getStartTime() { return startTime; }
    public void setStartTime(long startTime) { this.startTime = startTime; }
    public long getEndTime() { return endTime; }
    public void setEndTime(long endTime) { this.endTime = endTime; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
}

// 分片状态枚举
enum ShardStatus {
    PENDING,     // 待处理
    ASSIGNED,    // 已分配
    RUNNING,     // 执行中
    SUCCESS,     // 执行成功
    FAILED,      // 执行失败
    CANCELLED    // 已取消
}

// 任务分片策略接口
public interface ShardingStrategy {
    /**
     * 对任务进行分片
     * @param task 任务对象
     * @param shardCount 分片数量
     * @return 分片列表
     */
    List<TaskShard> shardTask(Task task, int shardCount);
}

// 数据分片策略实现
public class DataShardingStrategy implements ShardingStrategy {
    @Override
    public List<TaskShard> shardTask(Task task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        // 获取任务数据
        List<Object> taskData = (List<Object>) task.getData();
        int dataSize = taskData.size();
        
        // 计算每个分片的数据量
        int shardSize = (int) Math.ceil((double) dataSize / shardCount);
        
        // 创建分片
        for (int i = 0; i < shardCount; i++) {
            int startIndex = i * shardSize;
            int endIndex = Math.min(startIndex + shardSize, dataSize);
            
            if (startIndex < dataSize) {
                // 提取分片数据
                List<Object> shardData = taskData.subList(startIndex, endIndex);
                
                // 创建分片对象
                TaskShard shard = new TaskShard(task.getTaskId(), i, shardCount, shardData);
                shards.add(shard);
            }
        }
        
        return shards;
    }
}

// 范围分片策略实现
public class RangeShardingStrategy implements ShardingStrategy {
    @Override
    public List<TaskShard> shardTask(Task task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        // 获取任务范围参数
        RangeTaskData rangeData = (RangeTaskData) task.getData();
        long start = rangeData.getStart();
        long end = rangeData.getEnd();
        
        // 计算每个分片的范围
        long rangeSize = (end - start + 1) / shardCount;
        
        // 创建分片
        for (int i = 0; i < shardCount; i++) {
            long shardStart = start + i * rangeSize;
            long shardEnd = (i == shardCount - 1) ? end : (shardStart + rangeSize - 1);
            
            // 创建范围数据
            RangeShardData shardData = new RangeShardData(shardStart, shardEnd);
            
            // 创建分片对象
            TaskShard shard = new TaskShard(task.getTaskId(), i, shardCount, shardData);
            shards.add(shard);
        }
        
        return shards;
    }
}

// 范围任务数据
class RangeTaskData {
    private long start;
    private long end;
    
    public RangeTaskData(long start, long end) {
        this.start = start;
        this.end = end;
    }
    
    // Getters
    public long getStart() { return start; }
    public long getEnd() { return end; }
}

// 范围分片数据
class RangeShardData {
    private long start;
    private long end;
    
    public RangeShardData(long start, long end) {
        this.start = start;
        this.end = end;
    }
    
    // Getters
    public long getStart() { return start; }
    public long getEnd() { return end; }
}
```

### 任务分片的优势

```java
// 任务分片优势示例
public class TaskShardingBenefits {
    
    // 1. 提升处理速度
    public void improvedProcessingSpeed() {
        // 假设有一个需要处理10000条数据的任务
        List<String> data = generateTestData(10000);
        
        // 不分片处理
        long startTime = System.currentTimeMillis();
        processDataWithoutSharding(data);
        long endTime = System.currentTimeMillis();
        long timeWithoutSharding = endTime - startTime;
        
        // 分片处理 (使用4个分片)
        startTime = System.currentTimeMillis();
        processDataWithSharding(data, 4);
        endTime = System.currentTimeMillis();
        long timeWithSharding = endTime - startTime;
        
        System.out.println("不分片处理时间: " + timeWithoutSharding + "ms");
        System.out.println("分片处理时间: " + timeWithSharding + "ms");
        System.out.println("性能提升: " + (double) timeWithoutSharding / timeWithSharding + "倍");
    }
    
    // 2. 提高资源利用率
    public void improvedResourceUtilization() {
        // 在多节点环境中，分片可以充分利用所有节点的计算资源
        // 每个节点处理一部分分片，实现负载均衡
    }
    
    // 3. 增强容错能力
    public void enhancedFaultTolerance() {
        // 当某个分片执行失败时，只需要重新执行该分片
        // 而不需要重新执行整个任务
    }
    
    // 4. 支持水平扩展
    public void horizontalScalability() {
        // 可以根据集群规模动态调整分片数量
        // 增加节点时增加分片数量，充分利用新增资源
    }
    
    // 生成测试数据
    private List<String> generateTestData(int size) {
        List<String> data = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            data.add("data_" + i);
        }
        return data;
    }
    
    // 不分片处理数据
    private void processDataWithoutSharding(List<String> data) {
        for (String item : data) {
            processItem(item);
        }
    }
    
    // 分片处理数据
    private void processDataWithSharding(List<String> data, int shardCount) {
        int shardSize = (int) Math.ceil((double) data.size() / shardCount);
        
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        
        for (int i = 0; i < shardCount; i++) {
            int startIndex = i * shardSize;
            int endIndex = Math.min(startIndex + shardSize, data.size());
            
            if (startIndex < data.size()) {
                List<String> shardData = data.subList(startIndex, endIndex);
                
                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    for (String item : shardData) {
                        processItem(item);
                    }
                });
                
                futures.add(future);
            }
        }
        
        // 等待所有分片处理完成
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }
    
    // 处理单个数据项
    private void processItem(String item) {
        // 模拟数据处理
        try {
            Thread.sleep(1); // 模拟处理时间
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 并行处理机制设计

并行处理是任务分片的核心实现方式，通过并发执行多个分片来提升整体处理效率。

### 并行处理框架

```java
// 并行处理框架
public class ParallelProcessingFramework {
    private final ExecutorService executorService;
    private final ShardingStrategy shardingStrategy;
    private final ResultMerger resultMerger;
    private final TaskStore taskStore;
    
    public ParallelProcessingFramework(ShardingStrategy shardingStrategy, 
                                     ResultMerger resultMerger,
                                     TaskStore taskStore) {
        this.executorService = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors());
        this.shardingStrategy = shardingStrategy;
        this.resultMerger = resultMerger;
        this.taskStore = taskStore;
    }
    
    // 并行执行任务
    public TaskExecutionResult executeTaskInParallel(Task task, int shardCount) {
        try {
            // 1. 对任务进行分片
            List<TaskShard> shards = shardingStrategy.shardTask(task, shardCount);
            
            // 2. 保存分片信息
            for (TaskShard shard : shards) {
                taskStore.saveTaskShard(shard);
            }
            
            // 3. 并行执行分片
            List<CompletableFuture<TaskShardResult>> futures = new ArrayList<>();
            
            for (TaskShard shard : shards) {
                CompletableFuture<TaskShardResult> future = CompletableFuture.supplyAsync(() -> {
                    return executeShard(shard);
                }, executorService);
                
                futures.add(future);
            }
            
            // 4. 等待所有分片执行完成
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            // 5. 获取所有分片结果
            List<TaskShardResult> shardResults = futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());
            
            // 6. 合并结果
            Object finalResult = resultMerger.mergeResults(shardResults);
            
            // 7. 返回最终结果
            return new TaskExecutionResult(true, "任务执行成功", finalResult, 
                calculateTotalExecutionTime(shardResults));
        } catch (Exception e) {
            return new TaskExecutionResult(false, "任务执行失败: " + e.getMessage(), null, 0);
        }
    }
    
    // 执行单个分片
    private TaskShardResult executeShard(TaskShard shard) {
        try {
            // 更新分片状态为执行中
            shard.setStatus(ShardStatus.RUNNING);
            shard.setStartTime(System.currentTimeMillis());
            taskStore.updateTaskShard(shard);
            
            // 执行分片逻辑
            Object result = processShardData(shard.getShardData());
            
            // 更新分片状态为成功
            shard.setStatus(ShardStatus.SUCCESS);
            shard.setEndTime(System.currentTimeMillis());
            shard.setResult(result.toString());
            taskStore.updateTaskShard(shard);
            
            return new TaskShardResult(shard.getShardId(), true, result, 
                shard.getEndTime() - shard.getStartTime());
        } catch (Exception e) {
            // 更新分片状态为失败
            shard.setStatus(ShardStatus.FAILED);
            shard.setEndTime(System.currentTimeMillis());
            taskStore.updateTaskShard(shard);
            
            return new TaskShardResult(shard.getShardId(), false, e.getMessage(), 
                shard.getEndTime() - shard.getStartTime());
        }
    }
    
    // 处理分片数据
    private Object processShardData(Object shardData) {
        // 这里实现具体的分片数据处理逻辑
        // 根据任务类型不同，处理逻辑也会不同
        
        if (shardData instanceof List) {
            // 处理列表数据
            List<?> dataList = (List<?>) shardData;
            List<String> results = new ArrayList<>();
            
            for (Object item : dataList) {
                // 处理每个数据项
                String result = processItem(item);
                results.add(result);
            }
            
            return results;
        } else if (shardData instanceof RangeShardData) {
            // 处理范围数据
            RangeShardData rangeData = (RangeShardData) shardData;
            List<String> results = new ArrayList<>();
            
            for (long i = rangeData.getStart(); i <= rangeData.getEnd(); i++) {
                // 处理范围内的每个值
                String result = processRangeValue(i);
                results.add(result);
            }
            
            return results;
        }
        
        return "处理完成";
    }
    
    // 处理单个数据项
    private String processItem(Object item) {
        // 实现具体的数据项处理逻辑
        return "处理结果: " + item.toString();
    }
    
    // 处理范围值
    private String processRangeValue(long value) {
        // 实现具体的范围值处理逻辑
        return "处理结果: " + value;
    }
    
    // 计算总执行时间
    private long calculateTotalExecutionTime(List<TaskShardResult> shardResults) {
        return shardResults.stream()
            .mapToLong(TaskShardResult::getExecutionTime)
            .max()
            .orElse(0L);
    }
    
    // 关闭框架
    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}

// 任务分片结果
class TaskShardResult {
    private String shardId;
    private boolean success;
    private Object result;
    private long executionTime;
    private String errorMessage;
    
    public TaskShardResult(String shardId, boolean success, Object result, long executionTime) {
        this.shardId = shardId;
        this.success = success;
        this.result = result;
        this.executionTime = executionTime;
    }
    
    public TaskShardResult(String shardId, boolean success, String errorMessage, long executionTime) {
        this.shardId = shardId;
        this.success = success;
        this.errorMessage = errorMessage;
        this.executionTime = executionTime;
    }
    
    // Getters
    public String getShardId() { return shardId; }
    public boolean isSuccess() { return success; }
    public Object getResult() { return result; }
    public long getExecutionTime() { return executionTime; }
    public String getErrorMessage() { return errorMessage; }
}

// 结果合并器接口
interface ResultMerger {
    Object mergeResults(List<TaskShardResult> shardResults);
}

// 默认结果合并器
class DefaultResultMerger implements ResultMerger {
    @Override
    public Object mergeResults(List<TaskShardResult> shardResults) {
        // 按分片索引排序
        shardResults.sort(Comparator.comparing(result -> {
            String shardId = result.getShardId();
            return Integer.parseInt(shardId.substring(shardId.lastIndexOf("_") + 1));
        }));
        
        // 合并结果
        List<Object> mergedResults = new ArrayList<>();
        for (TaskShardResult shardResult : shardResults) {
            if (shardResult.isSuccess()) {
                mergedResults.add(shardResult.getResult());
            }
        }
        
        return mergedResults;
    }
}
```

## 分布式环境下的任务分片

在分布式环境中，任务分片需要考虑节点间的协调、数据一致性以及负载均衡等问题。

### 分布式任务分片实现

```java
// 分布式任务分片管理器
public class DistributedTaskShardingManager {
    private final ShardingStrategy shardingStrategy;
    private final ExecutorRegistry executorRegistry;
    private final TaskStore taskStore;
    private final CommunicationProtocol communicationProtocol;
    
    public DistributedTaskShardingManager(ShardingStrategy shardingStrategy,
                                        ExecutorRegistry executorRegistry,
                                        TaskStore taskStore,
                                        CommunicationProtocol communicationProtocol) {
        this.shardingStrategy = shardingStrategy;
        this.executorRegistry = executorRegistry;
        this.taskStore = taskStore;
        this.communicationProtocol = communicationProtocol;
    }
    
    // 分布式任务分片执行
    public TaskExecutionResult executeTaskDistributed(Task task, int shardCount) {
        try {
            // 1. 对任务进行分片
            List<TaskShard> shards = shardingStrategy.shardTask(task, shardCount);
            
            // 2. 获取可用的执行器
            List<ExecutorNode> availableExecutors = executorRegistry.getAvailableExecutors();
            if (availableExecutors.isEmpty()) {
                throw new IllegalStateException("没有可用的执行器");
            }
            
            // 3. 分配分片给执行器
            Map<ExecutorNode, List<TaskShard>> shardAssignment = 
                assignShardsToExecutors(shards, availableExecutors);
            
            // 4. 保存分片信息
            for (TaskShard shard : shards) {
                taskStore.saveTaskShard(shard);
            }
            
            // 5. 分发分片到执行器
            List<CompletableFuture<ShardExecutionResponse>> futures = new ArrayList<>();
            
            for (Map.Entry<ExecutorNode, List<TaskShard>> entry : shardAssignment.entrySet()) {
                ExecutorNode executor = entry.getKey();
                List<TaskShard> assignedShards = entry.getValue();
                
                // 发送分片到执行器
                CompletableFuture<ShardExecutionResponse> future = 
                    sendShardsToExecutor(executor, assignedShards, task);
                
                futures.add(future);
            }
            
            // 6. 等待所有分片执行完成
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            // 7. 获取所有分片执行结果
            List<ShardExecutionResponse> responses = futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());
            
            // 8. 检查执行结果
            boolean allSuccess = responses.stream()
                .allMatch(ShardExecutionResponse::isSuccess);
            
            if (allSuccess) {
                // 9. 合并结果
                Object finalResult = mergeDistributedResults(responses);
                
                return new TaskExecutionResult(true, "任务执行成功", finalResult, 
                    calculateTotalExecutionTime(responses));
            } else {
                // 收集失败信息
                String errorMessage = responses.stream()
                    .filter(response -> !response.isSuccess())
                    .map(ShardExecutionResponse::getErrorMessage)
                    .collect(Collectors.joining("; "));
                
                return new TaskExecutionResult(false, "任务执行失败: " + errorMessage, null, 0);
            }
        } catch (Exception e) {
            return new TaskExecutionResult(false, "任务执行失败: " + e.getMessage(), null, 0);
        }
    }
    
    // 分配分片给执行器
    private Map<ExecutorNode, List<TaskShard>> assignShardsToExecutors(
            List<TaskShard> shards, List<ExecutorNode> executors) {
        Map<ExecutorNode, List<TaskShard>> assignment = new HashMap<>();
        
        // 使用轮询策略分配分片
        for (int i = 0; i < shards.size(); i++) {
            TaskShard shard = shards.get(i);
            ExecutorNode executor = executors.get(i % executors.size());
            
            assignment.computeIfAbsent(executor, k -> new ArrayList<>()).add(shard);
            
            // 更新分片分配信息
            shard.setAssignedExecutor(executor.getId());
            shard.setStatus(ShardStatus.ASSIGNED);
            taskStore.updateTaskShard(shard);
        }
        
        return assignment;
    }
    
    // 发送分片到执行器
    private CompletableFuture<ShardExecutionResponse> sendShardsToExecutor(
            ExecutorNode executor, List<TaskShard> shards, Task task) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // 创建分片执行请求
                ShardExecutionRequest request = new ShardExecutionRequest(shards, task);
                
                // 发送请求到执行器
                Request commRequest = new Request(CommandType.EXECUTE_SHARDS, request);
                Response response = communicationProtocol.sendSync(commRequest, 30000);
                
                // 处理响应
                if (response.isSuccess()) {
                    return (ShardExecutionResponse) response.getData();
                } else {
                    return new ShardExecutionResponse(false, response.getErrorMessage());
                }
            } catch (Exception e) {
                return new ShardExecutionResponse(false, "发送分片到执行器失败: " + e.getMessage());
            }
        });
    }
    
    // 合并分布式执行结果
    private Object mergeDistributedResults(List<ShardExecutionResponse> responses) {
        List<Object> allResults = new ArrayList<>();
        
        for (ShardExecutionResponse response : responses) {
            if (response.isSuccess() && response.getResults() != null) {
                allResults.addAll(response.getResults());
            }
        }
        
        return allResults;
    }
    
    // 计算总执行时间
    private long calculateTotalExecutionTime(List<ShardExecutionResponse> responses) {
        return responses.stream()
            .mapToLong(ShardExecutionResponse::getExecutionTime)
            .max()
            .orElse(0L);
    }
}

// 分片执行请求
class ShardExecutionRequest {
    private List<TaskShard> shards;
    private Task task;
    
    public ShardExecutionRequest(List<TaskShard> shards, Task task) {
        this.shards = shards;
        this.task = task;
    }
    
    // Getters
    public List<TaskShard> getShards() { return shards; }
    public Task getTask() { return task; }
}

// 分片执行响应
class ShardExecutionResponse {
    private boolean success;
    private List<Object> results;
    private long executionTime;
    private String errorMessage;
    
    public ShardExecutionResponse(boolean success, List<Object> results, long executionTime) {
        this.success = success;
        this.results = results;
        this.executionTime = executionTime;
    }
    
    public ShardExecutionResponse(boolean success, String errorMessage) {
        this.success = success;
        this.errorMessage = errorMessage;
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public List<Object> getResults() { return results; }
    public long getExecutionTime() { return executionTime; }
    public String getErrorMessage() { return errorMessage; }
}
```

## 动态分片调整

在实际应用中，任务的复杂度和数据量可能会动态变化，因此需要支持动态调整分片数量。

### 动态分片调整实现

```java
// 动态分片调整器
public class DynamicShardingAdjuster {
    private final TaskStore taskStore;
    private final ExecutorRegistry executorRegistry;
    private final ShardingStrategy shardingStrategy;
    
    public DynamicShardingAdjuster(TaskStore taskStore, 
                                 ExecutorRegistry executorRegistry,
                                 ShardingStrategy shardingStrategy) {
        this.taskStore = taskStore;
        this.executorRegistry = executorRegistry;
        this.shardingStrategy = shardingStrategy;
    }
    
    // 根据数据量动态调整分片数量
    public int calculateOptimalShardCount(Task task) {
        // 获取任务数据大小
        long dataSize = estimateDataSize(task);
        
        // 获取可用执行器数量
        int availableExecutors = executorRegistry.getAvailableExecutors().size();
        
        // 基于数据大小和执行器数量计算最优分片数
        int baseShardCount = calculateBaseShardCount(dataSize);
        int optimalShardCount = Math.min(baseShardCount, availableExecutors * 2);
        
        // 确保至少有1个分片
        return Math.max(1, optimalShardCount);
    }
    
    // 估算数据大小
    private long estimateDataSize(Task task) {
        Object data = task.getData();
        
        if (data instanceof List) {
            return ((List<?>) data).size();
        } else if (data instanceof RangeTaskData) {
            RangeTaskData rangeData = (RangeTaskData) data;
            return rangeData.getEnd() - rangeData.getStart() + 1;
        } else if (data instanceof String) {
            return ((String) data).length();
        }
        
        // 默认返回1000
        return 1000;
    }
    
    // 计算基础分片数量
    private int calculateBaseShardCount(long dataSize) {
        // 根据数据大小计算分片数量
        if (dataSize <= 1000) {
            return 1;  // 小数据量不需要分片
        } else if (dataSize <= 10000) {
            return 2;  // 中等数据量分成2个分片
        } else if (dataSize <= 100000) {
            return 4;  // 大数据量分成4个分片
        } else {
            // 超大数据量，每25000个数据项一个分片
            return (int) Math.min(16, Math.ceil((double) dataSize / 25000));
        }
    }
    
    // 重新分片
    public List<TaskShard> reshardTask(Task task, int newShardCount) {
        // 获取现有的分片
        List<TaskShard> existingShards = taskStore.getTaskShards(task.getTaskId());
        
        // 检查是否有正在执行的分片
        boolean hasRunningShards = existingShards.stream()
            .anyMatch(shard -> shard.getStatus() == ShardStatus.RUNNING);
        
        if (hasRunningShards) {
            throw new IllegalStateException("任务有正在执行的分片，无法重新分片");
        }
        
        // 取消未执行的分片
        for (TaskShard shard : existingShards) {
            if (shard.getStatus() == ShardStatus.PENDING || 
                shard.getStatus() == ShardStatus.ASSIGNED) {
                shard.setStatus(ShardStatus.CANCELLED);
                taskStore.updateTaskShard(shard);
            }
        }
        
        // 创建新的分片
        return shardingStrategy.shardTask(task, newShardCount);
    }
    
    // 自适应分片调整
    public void adaptiveShardingAdjustment(Task task) {
        // 获取任务执行历史
        List<TaskExecutionRecord> executionHistory = taskStore.getExecutionHistory(task.getTaskId());
        
        if (executionHistory.size() < 3) {
            // 执行次数不足，不进行调整
            return;
        }
        
        // 计算最近几次执行的平均时间
        long averageExecutionTime = executionHistory.stream()
            .skip(Math.max(0, executionHistory.size() - 5))
            .mapToLong(TaskExecutionRecord::getExecutionTime)
            .average()
            .orElse(0);
        
        // 获取当前分片数量
        int currentShardCount = taskStore.getTaskShards(task.getTaskId()).size();
        
        // 根据执行时间调整分片数量
        if (averageExecutionTime > 30000) { // 超过30秒
            // 增加分片数量
            int newShardCount = Math.min(currentShardCount * 2, 32);
            if (newShardCount > currentShardCount) {
                System.out.println("任务执行时间较长，增加分片数量从 " + 
                    currentShardCount + " 到 " + newShardCount);
                // 这里可以触发重新分片逻辑
            }
        } else if (averageExecutionTime < 5000 && currentShardCount > 1) { // 少于5秒且分片数大于1
            // 减少分片数量
            int newShardCount = Math.max(currentShardCount / 2, 1);
            if (newShardCount < currentShardCount) {
                System.out.println("任务执行时间较短，减少分片数量从 " + 
                    currentShardCount + " 到 " + newShardCount);
                // 这里可以触发重新分片逻辑
            }
        }
    }
}

// 任务执行记录
class TaskExecutionRecord {
    private String taskId;
    private long executionTime;
    private boolean success;
    private long timestamp;
    
    public TaskExecutionRecord(String taskId, long executionTime, boolean success) {
        this.taskId = taskId;
        this.executionTime = executionTime;
        this.success = success;
        this.timestamp = System.currentTimeMillis();
    }
    
    // Getters
    public String getTaskId() { return taskId; }
    public long getExecutionTime() { return executionTime; }
    public boolean isSuccess() { return success; }
    public long getTimestamp() { return timestamp; }
}
```

## 分片执行监控

为了确保分片执行的可靠性和可观测性，需要实现完善的监控机制。

### 分片监控实现

```java
// 分片执行监控器
public class ShardExecutionMonitor {
    private final TaskStore taskStore;
    private final AlertService alertService;
    private final ScheduledExecutorService monitorScheduler;
    private final long monitorInterval;
    
    public ShardExecutionMonitor(TaskStore taskStore, 
                               AlertService alertService,
                               long monitorInterval) {
        this.taskStore = taskStore;
        this.alertService = alertService;
        this.monitorInterval = monitorInterval;
        this.monitorScheduler = Executors.newScheduledThreadPool(1);
    }
    
    // 启动监控
    public void start() {
        monitorScheduler.scheduleAtFixedRate(this::monitorShardExecutions, 
            0, monitorInterval, TimeUnit.SECONDS);
        System.out.println("分片执行监控已启动");
    }
    
    // 停止监控
    public void stop() {
        monitorScheduler.shutdown();
        System.out.println("分片执行监控已停止");
    }
    
    // 监控分片执行
    private void monitorShardExecutions() {
        try {
            // 获取所有正在执行的分片
            List<TaskShard> runningShards = taskStore.getRunningShards();
            
            long currentTime = System.currentTimeMillis();
            
            for (TaskShard shard : runningShards) {
                // 检查执行超时
                checkShardTimeout(shard, currentTime);
                
                // 检查执行异常
                checkShardAnomalies(shard);
            }
        } catch (Exception e) {
            System.err.println("监控分片执行时出错: " + e.getMessage());
        }
    }
    
    // 检查分片超时
    private void checkShardTimeout(TaskShard shard, long currentTime) {
        long executionTime = currentTime - shard.getStartTime();
        long timeoutThreshold = 60000; // 1分钟超时
        
        if (executionTime > timeoutThreshold) {
            String alertMessage = String.format(
                "分片执行超时 - TaskId: %s, ShardId: %s, 执行时间: %dms", 
                shard.getTaskId(), shard.getShardId(), executionTime);
            
            System.err.println(alertMessage);
            
            // 发送告警
            Alert alert = new Alert(AlertLevel.WARNING, "SHARD_TIMEOUT", alertMessage);
            alertService.sendAlert(alert);
        }
    }
    
    // 检查分片异常
    private void checkShardAnomalies(TaskShard shard) {
        // 这里可以实现更复杂的异常检测逻辑
        // 例如：检查执行时间是否异常、资源使用情况等
    }
    
    // 记录分片执行指标
    public void recordShardMetrics(TaskShard shard) {
        long executionTime = shard.getEndTime() - shard.getStartTime();
        
        System.out.printf("分片执行完成 - TaskId: %s, ShardId: %s, 执行时间: %dms, 状态: %s%n",
            shard.getTaskId(), shard.getShardId(), executionTime, shard.getStatus());
        
        // 这里可以将指标发送到监控系统
    }
}

// 告警服务
class AlertService {
    public void sendAlert(Alert alert) {
        // 实现告警发送逻辑
        // 可以发送邮件、短信、调用 webhook 等
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

任务分片与并行处理是分布式任务调度系统中的核心技术，通过合理的分片策略和并行执行机制，可以显著提升系统的处理能力和扩展性。

关键要点包括：

1. **分片策略**：根据任务特点选择合适的数据分片或范围分片策略
2. **并行执行**：利用多线程或分布式节点并行处理分片
3. **动态调整**：根据数据量和执行情况动态调整分片数量
4. **监控告警**：建立完善的监控体系，及时发现和处理异常情况

在实际应用中，还需要考虑数据一致性、容错处理、负载均衡等因素，确保分片执行的可靠性和高效性。

在下一节中，我们将探讨分布式任务调度系统中的容错与恢复机制，深入了解如何保证系统在面对各种故障时仍能稳定运行。