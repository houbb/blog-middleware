---
title: 3.4 任务分片与负载均衡
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，当任务数量和执行负载不断增加时，单一节点可能无法满足性能要求。任务分片和负载均衡技术是解决这一问题的关键手段，它们能够将大规模任务合理分配到多个执行节点上，充分利用集群资源，提高系统的吞吐量和可靠性。本文将深入探讨任务分片的实现原理和负载均衡策略，并详细介绍如何在分布式调度系统中应用这些技术。

## 任务分片的核心概念

任务分片是将一个大任务拆分成多个小任务片段的技术，每个片段可以在不同的执行节点上并行处理。这种技术特别适用于处理大量数据或计算密集型任务。

### 分片的优势与挑战

```java
// 任务分片的价值分析
public class TaskShardingBenefits {
    
    /*
     * 任务分片的核心优势：
     * 1. 提高性能 - 并行处理多个分片，显著提升执行速度
     * 2. 增强可扩展性 - 可以通过增加节点来处理更大规模的任务
     * 3. 提高容错性 - 单个分片失败不会影响整个任务
     * 4. 资源优化 - 合理利用集群中各个节点的计算资源
     * 5. 负载均衡 - 将任务均匀分配到不同节点
     */
    
    // 分片面临的挑战
    public void shardingChallenges() {
        System.out.println("任务分片面临的挑战:");
        System.out.println("1. 数据一致性 - 确保分片间数据的一致性");
        System.out.println("2. 分片策略 - 设计合理的分片算法");
        System.out.println("3. 故障处理 - 处理分片执行失败的情况");
        System.out.println("4. 结果合并 - 合并各个分片的执行结果");
        System.out.println("5. 资源协调 - 协调多个节点间的资源使用");
    }
}

// 任务分片实体类
public class TaskShard {
    private String shardId;             // 分片ID
    private String taskId;              // 所属任务ID
    private String taskName;            // 任务名称
    private int shardIndex;             // 分片索引
    private int shardCount;             // 总分片数
    private TaskShardStatus status;     // 分片状态
    private Map<String, Object> parameters; // 分片参数
    private Date createTime;            // 创建时间
    private Date startTime;             // 开始时间
    private Date endTime;               // 结束时间
    private long executionTime;         // 执行时间
    private boolean success;            // 是否成功
    private String errorMessage;        // 错误信息
    private String resultData;          // 执行结果
    private String executorNode;        // 执行节点
    
    // 构造函数
    public TaskShard() {
        this.status = TaskShardStatus.PENDING;
        this.parameters = new HashMap<>();
        this.createTime = new Date();
    }
    
    // Getters and Setters
    public String getShardId() { return shardId; }
    public void setShardId(String shardId) { this.shardId = shardId; }
    
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public int getShardIndex() { return shardIndex; }
    public void setShardIndex(int shardIndex) { this.shardIndex = shardIndex; }
    
    public int getShardCount() { return shardCount; }
    public void setShardCount(int shardCount) { this.shardCount = shardCount; }
    
    public TaskShardStatus getStatus() { return status; }
    public void setStatus(TaskShardStatus status) { this.status = status; }
    
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    
    public Date getEndTime() { return endTime; }
    public void setEndTime(Date endTime) { this.endTime = endTime; }
    
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public String getResultData() { return resultData; }
    public void setResultData(String resultData) { this.resultData = resultData; }
    
    public String getExecutorNode() { return executorNode; }
    public void setExecutorNode(String executorNode) { this.executorNode = executorNode; }
    
    // 添加参数
    public void addParameter(String key, Object value) {
        this.parameters.put(key, value);
    }
    
    // 获取参数
    @SuppressWarnings("unchecked")
    public <T> T getParameter(String key, Class<T> type) {
        Object value = this.parameters.get(key);
        if (value != null && type.isInstance(value)) {
            return (T) value;
        }
        return null;
    }
}

// 任务分片状态枚举
enum TaskShardStatus {
    PENDING("待执行"),      // 分片已创建，等待执行
    SCHEDULED("已调度"),    // 分片已调度，等待触发
    RUNNING("执行中"),      // 分片正在执行
    SUCCESS("执行成功"),    // 分片执行成功
    FAILED("执行失败"),     // 分片执行失败
    CANCELLED("已取消");    // 分片已取消
    
    private final String description;
    
    TaskShardStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() { return description; }
}
```

## 分片策略设计

合理的分片策略是任务分片成功的关键。不同的业务场景需要采用不同的分片算法。

### 常见分片策略

```java
// 分片策略接口
public interface ShardingStrategy {
    /**
     * 计算分片
     * @param task 任务信息
     * @param shardCount 分片数量
     * @return 分片列表
     */
    List<TaskShard> calculateShards(ScheduledTask task, int shardCount);
}

// 基于数据范围的分片策略
public class RangeBasedShardingStrategy implements ShardingStrategy {
    
    @Override
    public List<TaskShard> calculateShards(ScheduledTask task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        // 获取数据范围参数
        Long totalRecords = task.getParameters().get("totalRecords") instanceof Number ? 
            ((Number) task.getParameters().get("totalRecords")).longValue() : 0L;
        String tableName = (String) task.getParameters().get("tableName");
        
        if (totalRecords <= 0 || tableName == null) {
            throw new IllegalArgumentException("缺少必要的分片参数");
        }
        
        // 计算每个分片的数据范围
        long recordsPerShard = totalRecords / shardCount;
        long remainder = totalRecords % shardCount;
        
        for (int i = 0; i < shardCount; i++) {
            TaskShard shard = new TaskShard();
            shard.setShardId(generateShardId(task.getTaskId(), i));
            shard.setTaskId(task.getTaskId());
            shard.setTaskName(task.getTaskName());
            shard.setShardIndex(i);
            shard.setShardCount(shardCount);
            
            // 计算数据范围
            long startRecord = i * recordsPerShard + Math.min(i, remainder);
            long endRecord = startRecord + recordsPerShard + (i < remainder ? 1 : 0) - 1;
            
            // 设置分片参数
            shard.addParameter("tableName", tableName);
            shard.addParameter("startRecord", startRecord);
            shard.addParameter("endRecord", endRecord);
            shard.addParameter("totalRecords", endRecord - startRecord + 1);
            
            shards.add(shard);
        }
        
        return shards;
    }
    
    // 生成分片ID
    private String generateShardId(String taskId, int index) {
        return taskId + "_shard_" + index;
    }
}

// 基于哈希的分片策略
public class HashBasedShardingStrategy implements ShardingStrategy {
    
    @Override
    public List<TaskShard> calculateShards(ScheduledTask task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        // 获取需要分片的数据列表
        @SuppressWarnings("unchecked")
        List<String> dataList = (List<String>) task.getParameters().get("dataList");
        
        if (dataList == null || dataList.isEmpty()) {
            throw new IllegalArgumentException("缺少数据列表参数");
        }
        
        // 创建分片映射
        Map<Integer, List<String>> shardDataMap = new HashMap<>();
        for (int i = 0; i < shardCount; i++) {
            shardDataMap.put(i, new ArrayList<>());
        }
        
        // 根据哈希值分配数据到分片
        for (String data : dataList) {
            int shardIndex = Math.abs(data.hashCode()) % shardCount;
            shardDataMap.get(shardIndex).add(data);
        }
        
        // 创建分片对象
        for (int i = 0; i < shardCount; i++) {
            TaskShard shard = new TaskShard();
            shard.setShardId(generateShardId(task.getTaskId(), i));
            shard.setTaskId(task.getTaskId());
            shard.setTaskName(task.getTaskName());
            shard.setShardIndex(i);
            shard.setShardCount(shardCount);
            
            // 设置分片数据
            shard.addParameter("dataList", shardDataMap.get(i));
            shard.addParameter("dataCount", shardDataMap.get(i).size());
            
            shards.add(shard);
        }
        
        return shards;
    }
    
    // 生成分片ID
    private String generateShardId(String taskId, int index) {
        return taskId + "_shard_" + index;
    }
}

// 基于时间范围的分片策略
public class TimeBasedShardingStrategy implements ShardingStrategy {
    
    @Override
    public List<TaskShard> calculateShards(ScheduledTask task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        // 获取时间范围参数
        Date startTime = (Date) task.getParameters().get("startTime");
        Date endTime = (Date) task.getParameters().get("endTime");
        
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("缺少时间范围参数");
        }
        
        long totalTime = endTime.getTime() - startTime.getTime();
        long timePerShard = totalTime / shardCount;
        
        for (int i = 0; i < shardCount; i++) {
            TaskShard shard = new TaskShard();
            shard.setShardId(generateShardId(task.getTaskId(), i));
            shard.setTaskId(task.getTaskId());
            shard.setTaskName(task.getTaskName());
            shard.setShardIndex(i);
            shard.setShardCount(shardCount);
            
            // 计算时间范围
            Date shardStartTime = new Date(startTime.getTime() + i * timePerShard);
            Date shardEndTime = (i == shardCount - 1) ? 
                endTime : new Date(shardStartTime.getTime() + timePerShard);
            
            // 设置分片参数
            shard.addParameter("startTime", shardStartTime);
            shard.addParameter("endTime", shardEndTime);
            
            shards.add(shard);
        }
        
        return shards;
    }
    
    // 生成分片ID
    private String generateShardId(String taskId, int index) {
        return taskId + "_shard_" + index;
    }
}

// 自适应分片策略
public class AdaptiveShardingStrategy implements ShardingStrategy {
    
    @Override
    public List<TaskShard> calculateShards(ScheduledTask task, int shardCount) {
        // 根据任务类型和数据特征选择合适的分片策略
        String taskType = (String) task.getParameters().get("taskType");
        
        if ("data_processing".equals(taskType)) {
            // 数据处理任务使用范围分片
            return new RangeBasedShardingStrategy().calculateShards(task, shardCount);
        } else if ("batch_processing".equals(taskType)) {
            // 批处理任务使用哈希分片
            return new HashBasedShardingStrategy().calculateShards(task, shardCount);
        } else if ("time_series".equals(taskType)) {
            // 时间序列任务使用时间分片
            return new TimeBasedShardingStrategy().calculateShards(task, shardCount);
        } else {
            // 默认使用简单分片
            return createSimpleShards(task, shardCount);
        }
    }
    
    // 创建简单分片
    private List<TaskShard> createSimpleShards(ScheduledTask task, int shardCount) {
        List<TaskShard> shards = new ArrayList<>();
        
        for (int i = 0; i < shardCount; i++) {
            TaskShard shard = new TaskShard();
            shard.setShardId(generateShardId(task.getTaskId(), i));
            shard.setTaskId(task.getTaskId());
            shard.setTaskName(task.getTaskName());
            shard.setShardIndex(i);
            shard.setShardCount(shardCount);
            
            // 复制原始任务参数并添加分片信息
            Map<String, Object> shardParams = new HashMap<>(task.getParameters());
            shardParams.put("shardIndex", i);
            shardParams.put("shardCount", shardCount);
            shard.setParameters(shardParams);
            
            shards.add(shard);
        }
        
        return shards;
    }
    
    // 生成分片ID
    private String generateShardId(String taskId, int index) {
        return taskId + "_shard_" + index;
    }
}
```

## 分片存储与管理

为了有效管理任务分片，我们需要实现分片的存储和管理功能。

### 分片存储接口

```java
// 分片存储接口
public interface TaskShardStore {
    /**
     * 保存分片
     * @param shard 分片信息
     * @return 是否保存成功
     */
    boolean saveShard(TaskShard shard);
    
    /**
     * 批量保存分片
     * @param shards 分片列表
     * @return 保存成功的分片数量
     */
    int saveShards(List<TaskShard> shards);
    
    /**
     * 更新分片
     * @param shard 分片信息
     * @return 是否更新成功
     */
    boolean updateShard(TaskShard shard);
    
    /**
     * 删除分片
     * @param shardId 分片ID
     * @return 是否删除成功
     */
    boolean deleteShard(String shardId);
    
    /**
     * 根据ID获取分片
     * @param shardId 分片ID
     * @return 分片信息
     */
    TaskShard getShardById(String shardId);
    
    /**
     * 根据任务ID获取所有分片
     * @param taskId 任务ID
     * @return 分片列表
     */
    List<TaskShard> getShardsByTaskId(String taskId);
    
    /**
     * 根据状态获取分片
     * @param status 分片状态
     * @param limit 限制数量
     * @return 分片列表
     */
    List<TaskShard> getShardsByStatus(TaskShardStatus status, int limit);
    
    /**
     * 获取需要执行的分片
     * @param limit 限制数量
     * @return 分片列表
     */
    List<TaskShard> getShardsToExecute(int limit);
    
    /**
     * 更新分片状态
     * @param shardId 分片ID
     * @param status 新状态
     * @return 是否更新成功
     */
    boolean updateShardStatus(String shardId, TaskShardStatus status);
}

// 基于数据库的分片存储实现
public class DatabaseTaskShardStore implements TaskShardStore {
    private final DataSource dataSource;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public DatabaseTaskShardStore(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public boolean saveShard(TaskShard shard) {
        String sql = "INSERT INTO task_shards (" +
            "shard_id, task_id, task_name, shard_index, shard_count, status, " +
            "parameters, create_time, start_time, end_time, execution_time, " +
            "success, error_message, result_data, executor_node) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE " +
            "task_name = VALUES(task_name), shard_index = VALUES(shard_index), " +
            "shard_count = VALUES(shard_count), status = VALUES(status), " +
            "parameters = VALUES(parameters), create_time = VALUES(create_time), " +
            "start_time = VALUES(start_time), end_time = VALUES(end_time), " +
            "execution_time = VALUES(execution_time), success = VALUES(success), " +
            "error_message = VALUES(error_message), result_data = VALUES(result_data), " +
            "executor_node = VALUES(executor_node)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, shard.getShardId());
            stmt.setString(2, shard.getTaskId());
            stmt.setString(3, shard.getTaskName());
            stmt.setInt(4, shard.getShardIndex());
            stmt.setInt(5, shard.getShardCount());
            stmt.setString(6, shard.getStatus().name());
            stmt.setString(7, serializeToJson(shard.getParameters()));
            stmt.setTimestamp(8, new Timestamp(shard.getCreateTime().getTime()));
            stmt.setTimestamp(9, shard.getStartTime() != null ? 
                new Timestamp(shard.getStartTime().getTime()) : null);
            stmt.setTimestamp(10, shard.getEndTime() != null ? 
                new Timestamp(shard.getEndTime().getTime()) : null);
            stmt.setLong(11, shard.getExecutionTime());
            stmt.setBoolean(12, shard.isSuccess());
            stmt.setString(13, shard.getErrorMessage());
            stmt.setString(14, shard.getResultData());
            stmt.setString(15, shard.getExecutorNode());
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("保存分片失败", e);
        }
    }
    
    @Override
    public int saveShards(List<TaskShard> shards) {
        String sql = "INSERT INTO task_shards (" +
            "shard_id, task_id, task_name, shard_index, shard_count, status, " +
            "parameters, create_time, start_time, end_time, execution_time, " +
            "success, error_message, result_data, executor_node) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE " +
            "task_name = VALUES(task_name), shard_index = VALUES(shard_index), " +
            "shard_count = VALUES(shard_count), status = VALUES(status), " +
            "parameters = VALUES(parameters), create_time = VALUES(create_time), " +
            "start_time = VALUES(start_time), end_time = VALUES(end_time), " +
            "execution_time = VALUES(execution_time), success = VALUES(success), " +
            "error_message = VALUES(error_message), result_data = VALUES(result_data), " +
            "executor_node = VALUES(executor_node)";
        
        int savedCount = 0;
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            for (TaskShard shard : shards) {
                stmt.setString(1, shard.getShardId());
                stmt.setString(2, shard.getTaskId());
                stmt.setString(3, shard.getTaskName());
                stmt.setInt(4, shard.getShardIndex());
                stmt.setInt(5, shard.getShardCount());
                stmt.setString(6, shard.getStatus().name());
                stmt.setString(7, serializeToJson(shard.getParameters()));
                stmt.setTimestamp(8, new Timestamp(shard.getCreateTime().getTime()));
                stmt.setTimestamp(9, shard.getStartTime() != null ? 
                    new Timestamp(shard.getStartTime().getTime()) : null);
                stmt.setTimestamp(10, shard.getEndTime() != null ? 
                    new Timestamp(shard.getEndTime().getTime()) : null);
                stmt.setLong(11, shard.getExecutionTime());
                stmt.setBoolean(12, shard.isSuccess());
                stmt.setString(13, shard.getErrorMessage());
                stmt.setString(14, shard.getResultData());
                stmt.setString(15, shard.getExecutorNode());
                
                stmt.addBatch();
            }
            
            int[] results = stmt.executeBatch();
            for (int result : results) {
                if (result > 0) {
                    savedCount++;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("批量保存分片失败", e);
        }
        
        return savedCount;
    }
    
    @Override
    public boolean updateShard(TaskShard shard) {
        String sql = "UPDATE task_shards SET " +
            "task_name = ?, shard_index = ?, shard_count = ?, status = ?, " +
            "parameters = ?, create_time = ?, start_time = ?, end_time = ?, " +
            "execution_time = ?, success = ?, error_message = ?, result_data = ?, " +
            "executor_node = ? WHERE shard_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, shard.getTaskName());
            stmt.setInt(2, shard.getShardIndex());
            stmt.setInt(3, shard.getShardCount());
            stmt.setString(4, shard.getStatus().name());
            stmt.setString(5, serializeToJson(shard.getParameters()));
            stmt.setTimestamp(6, new Timestamp(shard.getCreateTime().getTime()));
            stmt.setTimestamp(7, shard.getStartTime() != null ? 
                new Timestamp(shard.getStartTime().getTime()) : null);
            stmt.setTimestamp(8, shard.getEndTime() != null ? 
                new Timestamp(shard.getEndTime().getTime()) : null);
            stmt.setLong(9, shard.getExecutionTime());
            stmt.setBoolean(10, shard.isSuccess());
            stmt.setString(11, shard.getErrorMessage());
            stmt.setString(12, shard.getResultData());
            stmt.setString(13, shard.getExecutorNode());
            stmt.setString(14, shard.getShardId());
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("更新分片失败", e);
        }
    }
    
    @Override
    public boolean deleteShard(String shardId) {
        String sql = "DELETE FROM task_shards WHERE shard_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, shardId);
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("删除分片失败", e);
        }
    }
    
    @Override
    public TaskShard getShardById(String shardId) {
        String sql = "SELECT * FROM task_shards WHERE shard_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, shardId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToShard(rs);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询分片失败", e);
        }
        
        return null;
    }
    
    @Override
    public List<TaskShard> getShardsByTaskId(String taskId) {
        String sql = "SELECT * FROM task_shards WHERE task_id = ? ORDER BY shard_index";
        List<TaskShard> shards = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, taskId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    shards.add(mapResultSetToShard(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询任务分片失败", e);
        }
        
        return shards;
    }
    
    @Override
    public List<TaskShard> getShardsByStatus(TaskShardStatus status, int limit) {
        String sql = "SELECT * FROM task_shards WHERE status = ? ORDER BY create_time LIMIT ?";
        List<TaskShard> shards = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, status.name());
            stmt.setInt(2, limit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    shards.add(mapResultSetToShard(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询分片失败", e);
        }
        
        return shards;
    }
    
    @Override
    public List<TaskShard> getShardsToExecute(int limit) {
        String sql = "SELECT * FROM task_shards WHERE status = 'PENDING' ORDER BY create_time LIMIT ?";
        List<TaskShard> shards = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setInt(1, limit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    shards.add(mapResultSetToShard(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询待执行分片失败", e);
        }
        
        return shards;
    }
    
    @Override
    public boolean updateShardStatus(String shardId, TaskShardStatus status) {
        String sql = "UPDATE task_shards SET status = ?, start_time = ? WHERE shard_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, status.name());
            stmt.setTimestamp(2, status == TaskShardStatus.RUNNING ? 
                new Timestamp(System.currentTimeMillis()) : null);
            stmt.setString(3, shardId);
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("更新分片状态失败", e);
        }
    }
    
    // 将ResultSet映射为分片对象
    private TaskShard mapResultSetToShard(ResultSet rs) throws SQLException {
        TaskShard shard = new TaskShard();
        shard.setShardId(rs.getString("shard_id"));
        shard.setTaskId(rs.getString("task_id"));
        shard.setTaskName(rs.getString("task_name"));
        shard.setShardIndex(rs.getInt("shard_index"));
        shard.setShardCount(rs.getInt("shard_count"));
        shard.setStatus(TaskShardStatus.valueOf(rs.getString("status")));
        shard.setParameters(deserializeFromJson(rs.getString("parameters"), Map.class));
        shard.setCreateTime(rs.getTimestamp("create_time"));
        shard.setStartTime(rs.getTimestamp("start_time"));
        shard.setEndTime(rs.getTimestamp("end_time"));
        shard.setExecutionTime(rs.getLong("execution_time"));
        shard.setSuccess(rs.getBoolean("success"));
        shard.setErrorMessage(rs.getString("error_message"));
        shard.setResultData(rs.getString("result_data"));
        shard.setExecutorNode(rs.getString("executor_node"));
        return shard;
    }
    
    // 序列化为JSON
    private String serializeToJson(Object obj) {
        if (obj == null) {
            return null;
        }
        
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("序列化对象失败", e);
        }
    }
    
    // 从JSON反序列化
    private <T> T deserializeFromJson(String json, Class<T> clazz) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            throw new RuntimeException("反序列化对象失败", e);
        }
    }
}

// 分片表结构
/*
CREATE TABLE task_shards (
    shard_id VARCHAR(128) PRIMARY KEY COMMENT '分片ID',
    task_id VARCHAR(64) NOT NULL COMMENT '任务ID',
    task_name VARCHAR(255) NOT NULL COMMENT '任务名称',
    shard_index INT NOT NULL COMMENT '分片索引',
    shard_count INT NOT NULL COMMENT '总分片数',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '分片状态',
    parameters TEXT COMMENT '分片参数',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    start_time TIMESTAMP NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL COMMENT '结束时间',
    execution_time BIGINT NOT NULL DEFAULT 0 COMMENT '执行时间',
    success BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    result_data TEXT COMMENT '执行结果',
    executor_node VARCHAR(128) COMMENT '执行节点',
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time),
    INDEX idx_executor_node (executor_node)
) COMMENT='任务分片表';
*/
```

## 负载均衡策略

负载均衡是分布式系统中的核心技术，它能够将任务合理分配到不同的执行节点上，避免某些节点过载而其他节点空闲的情况。

### 负载均衡算法

```java
// 负载均衡策略接口
public interface LoadBalancingStrategy {
    /**
     * 选择执行节点
     * @param shards 待执行的分片列表
     * @param executorNodes 可用的执行节点列表
     * @return 节点分配结果
     */
    Map<TaskShard, ExecutorNode> assignShards(List<TaskShard> shards, List<ExecutorNode> executorNodes);
}

// 执行节点信息
public class ExecutorNode {
    private String nodeId;              // 节点ID
    private String address;             // 节点地址
    private int port;                   // 端口
    private ExecutorStatus status;      // 节点状态
    private int taskCount;              // 当前任务数
    private int maxTaskCount;           // 最大任务数
    private double cpuUsage;            // CPU使用率
    private long memoryUsage;           // 内存使用量
    private long lastHeartbeatTime;     // 最后心跳时间
    private Map<String, Object> metadata; // 元数据
    
    // 构造函数
    public ExecutorNode(String nodeId, String address, int port) {
        this.nodeId = nodeId;
        this.address = address;
        this.port = port;
        this.status = ExecutorStatus.ONLINE;
        this.taskCount = 0;
        this.maxTaskCount = 100;
        this.metadata = new HashMap<>();
    }
    
    // Getters and Setters
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    
    public ExecutorStatus getStatus() { return status; }
    public void setStatus(ExecutorStatus status) { this.status = status; }
    
    public int getTaskCount() { return taskCount; }
    public void setTaskCount(int taskCount) { this.taskCount = taskCount; }
    
    public int getMaxTaskCount() { return maxTaskCount; }
    public void setMaxTaskCount(int maxTaskCount) { this.maxTaskCount = maxTaskCount; }
    
    public double getCpuUsage() { return cpuUsage; }
    public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
    
    public long getMemoryUsage() { return memoryUsage; }
    public void setMemoryUsage(long memoryUsage) { this.memoryUsage = memoryUsage; }
    
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
    
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    
    // 检查节点是否可用
    public boolean isAvailable() {
        return status == ExecutorStatus.ONLINE && 
               taskCount < maxTaskCount && 
               System.currentTimeMillis() - lastHeartbeatTime < 30000; // 30秒内有心跳
    }
    
    // 获取节点负载分数(越小越空闲)
    public double getLoadScore() {
        if (!isAvailable()) {
            return Double.MAX_VALUE;
        }
        
        // 综合考虑任务数、CPU使用率、内存使用量
        return taskCount * 0.5 + cpuUsage * 0.3 + (memoryUsage / 1000000.0) * 0.2;
    }
}

// 执行节点状态枚举
enum ExecutorStatus {
    ONLINE("在线"),      // 节点在线
    OFFLINE("离线"),     // 节点离线
    BUSY("忙碌"),        // 节点忙碌
    MAINTENANCE("维护"); // 节点维护中
    
    private final String description;
    
    ExecutorStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() { return description; }
}
```

### 常见负载均衡策略实现

```java
// 轮询负载均衡策略
public class RoundRobinLoadBalancingStrategy implements LoadBalancingStrategy {
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    
    @Override
    public Map<TaskShard, ExecutorNode> assignShards(List<TaskShard> shards, 
                                                   List<ExecutorNode> executorNodes) {
        Map<TaskShard, ExecutorNode> assignments = new HashMap<>();
        
        // 过滤出可用节点
        List<ExecutorNode> availableNodes = executorNodes.stream()
            .filter(ExecutorNode::isAvailable)
            .collect(Collectors.toList());
        
        if (availableNodes.isEmpty()) {
            throw new RuntimeException("没有可用的执行节点");
        }
        
        // 轮询分配
        for (int i = 0; i < shards.size(); i++) {
            TaskShard shard = shards.get(i);
            int index = (currentIndex.getAndIncrement() % availableNodes.size());
            ExecutorNode node = availableNodes.get(index);
            assignments.put(shard, node);
        }
        
        return assignments;
    }
}

// 最少连接数负载均衡策略
public class LeastConnectionsLoadBalancingStrategy implements LoadBalancingStrategy {
    
    @Override
    public Map<TaskShard, ExecutorNode> assignShards(List<TaskShard> shards, 
                                                   List<ExecutorNode> executorNodes) {
        Map<TaskShard, ExecutorNode> assignments = new HashMap<>();
        
        // 过滤出可用节点并按任务数排序
        List<ExecutorNode> availableNodes = executorNodes.stream()
            .filter(ExecutorNode::isAvailable)
            .sorted(Comparator.comparing(ExecutorNode::getTaskCount))
            .collect(Collectors.toList());
        
        if (availableNodes.isEmpty()) {
            throw new RuntimeException("没有可用的执行节点");
        }
        
        // 分配给任务数最少的节点
        for (TaskShard shard : shards) {
            ExecutorNode node = availableNodes.get(0);
            assignments.put(shard, node);
            
            // 更新节点任务数
            node.setTaskCount(node.getTaskCount() + 1);
        }
        
        return assignments;
    }
}

// 加权负载均衡策略
public class WeightedLoadBalancingStrategy implements LoadBalancingStrategy {
    
    @Override
    public Map<TaskShard, ExecutorNode> assignShards(List<TaskShard> shards, 
                                                   List<ExecutorNode> executorNodes) {
        Map<TaskShard, ExecutorNode> assignments = new HashMap<>();
        
        // 过滤出可用节点并计算权重
        List<WeightedNode> weightedNodes = executorNodes.stream()
            .filter(ExecutorNode::isAvailable)
            .map(node -> new WeightedNode(node, calculateWeight(node)))
            .sorted(Comparator.comparing(WeightedNode::getWeight).reversed())
            .collect(Collectors.toList());
        
        if (weightedNodes.isEmpty()) {
            throw new RuntimeException("没有可用的执行节点");
        }
        
        // 按权重分配
        int totalWeight = weightedNodes.stream()
            .mapToInt(WeightedNode::getWeight)
            .sum();
        
        int currentWeight = 0;
        for (TaskShard shard : shards) {
            int targetWeight = (int) ((double) currentWeight / shards.size() * totalWeight);
            
            ExecutorNode selectedNode = weightedNodes.get(0).getNode();
            int accumulatedWeight = 0;
            
            for (WeightedNode weightedNode : weightedNodes) {
                accumulatedWeight += weightedNode.getWeight();
                if (accumulatedWeight >= targetWeight) {
                    selectedNode = weightedNode.getNode();
                    break;
                }
            }
            
            assignments.put(shard, selectedNode);
            currentWeight += selectedNode.getTaskCount();
        }
        
        return assignments;
    }
    
    // 计算节点权重
    private int calculateWeight(ExecutorNode node) {
        // 权重基于节点性能和当前负载
        int baseWeight = 100;
        int taskCountPenalty = node.getTaskCount() * 2;
        int cpuUsagePenalty = (int) (node.getCpuUsage() * 50);
        int memoryUsagePenalty = (int) (node.getMemoryUsage() / 1000000 * 5);
        
        return Math.max(1, baseWeight - taskCountPenalty - cpuUsagePenalty - memoryUsagePenalty);
    }
    
    // 加权节点类
    private static class WeightedNode {
        private final ExecutorNode node;
        private final int weight;
        
        public WeightedNode(ExecutorNode node, int weight) {
            this.node = node;
            this.weight = weight;
        }
        
        public ExecutorNode getNode() { return node; }
        public int getWeight() { return weight; }
    }
}

// 一致性哈希负载均衡策略
public class ConsistentHashLoadBalancingStrategy implements LoadBalancingStrategy {
    private final TreeMap<Integer, ExecutorNode> circle = new TreeMap<>();
    private final int numberOfReplicas = 160; // 虚拟节点数
    
    @Override
    public Map<TaskShard, ExecutorNode> assignShards(List<TaskShard> shards, 
                                                   List<ExecutorNode> executorNodes) {
        Map<TaskShard, ExecutorNode> assignments = new HashMap<>();
        
        // 过滤出可用节点
        List<ExecutorNode> availableNodes = executorNodes.stream()
            .filter(ExecutorNode::isAvailable)
            .collect(Collectors.toList());
        
        if (availableNodes.isEmpty()) {
            throw new RuntimeException("没有可用的执行节点");
        }
        
        // 构建一致性哈希环
        buildCircle(availableNodes);
        
        // 分配分片
        for (TaskShard shard : shards) {
            ExecutorNode node = getNode(shard.getShardId());
            assignments.put(shard, node);
        }
        
        return assignments;
    }
    
    // 构建一致性哈希环
    private void buildCircle(List<ExecutorNode> nodes) {
        circle.clear();
        
        for (ExecutorNode node : nodes) {
            for (int i = 0; i < numberOfReplicas; i++) {
                String key = node.getNodeId() + ":" + i;
                int hash = hash(key);
                circle.put(hash, node);
            }
        }
    }
    
    // 获取节点
    private ExecutorNode getNode(String key) {
        if (circle.isEmpty()) {
            return null;
        }
        
        int hash = hash(key);
        SortedMap<Integer, ExecutorNode> tailMap = circle.tailMap(hash);
        Integer nodeHash = tailMap.isEmpty() ? circle.firstKey() : tailMap.firstKey();
        return circle.get(nodeHash);
    }
    
    // 简单哈希函数
    private int hash(String key) {
        return key.hashCode();
    }
}
```

## 分片执行管理器

基于分片策略和负载均衡策略，我们可以实现分片执行管理器来协调整个分片执行过程。

```java
// 分片执行管理器
public class TaskShardManager {
    private final TaskShardStore shardStore;
    private final LoadBalancingStrategy loadBalancingStrategy;
    private final ExecutorNodeRegistry nodeRegistry;
    private final TaskShardExecutor shardExecutor;
    private final ScheduledExecutorService shardScheduler;
    
    public TaskShardManager(TaskShardStore shardStore,
                          LoadBalancingStrategy loadBalancingStrategy,
                          ExecutorNodeRegistry nodeRegistry,
                          TaskShardExecutor shardExecutor) {
        this.shardStore = shardStore;
        this.loadBalancingStrategy = loadBalancingStrategy;
        this.nodeRegistry = nodeRegistry;
        this.shardExecutor = shardExecutor;
        this.shardScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 启动分片管理器
    public void start() {
        // 定期检查和执行分片
        shardScheduler.scheduleAtFixedRate(this::checkAndExecuteShards, 0, 5, TimeUnit.SECONDS);
        System.out.println("分片执行管理器已启动");
    }
    
    // 停止分片管理器
    public void stop() {
        shardScheduler.shutdown();
        try {
            if (!shardScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                shardScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            shardScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("分片执行管理器已停止");
    }
    
    // 为任务创建分片
    public List<TaskShard> createShards(ScheduledTask task, int shardCount, 
                                      ShardingStrategy shardingStrategy) {
        // 计算分片
        List<TaskShard> shards = shardingStrategy.calculateShards(task, shardCount);
        
        // 保存分片
        shardStore.saveShards(shards);
        
        System.out.println("为任务 " + task.getTaskName() + " 创建了 " + shards.size() + " 个分片");
        return shards;
    }
    
    // 检查并执行分片
    private void checkAndExecuteShards() {
        try {
            // 获取待执行的分片
            List<TaskShard> pendingShards = shardStore.getShardsToExecute(50);
            
            if (pendingShards.isEmpty()) {
                return;
            }
            
            // 获取可用的执行节点
            List<ExecutorNode> availableNodes = nodeRegistry.getAvailableNodes();
            
            if (availableNodes.isEmpty()) {
                System.out.println("没有可用的执行节点");
                return;
            }
            
            // 分配分片到节点
            Map<TaskShard, ExecutorNode> assignments = loadBalancingStrategy.assignShards(
                pendingShards, availableNodes);
            
            // 执行分片
            for (Map.Entry<TaskShard, ExecutorNode> entry : assignments.entrySet()) {
                TaskShard shard = entry.getKey();
                ExecutorNode node = entry.getValue();
                
                // 更新分片状态
                shardStore.updateShardStatus(shard.getShardId(), TaskShardStatus.SCHEDULED);
                
                // 异步执行分片
                executeShardAsync(shard, node);
            }
        } catch (Exception e) {
            System.err.println("检查和执行分片时出错: " + e.getMessage());
        }
    }
    
    // 异步执行分片
    private void executeShardAsync(TaskShard shard, ExecutorNode node) {
        CompletableFuture.supplyAsync(() -> {
            try {
                // 更新分片状态为运行中
                shard.setStatus(TaskShardStatus.RUNNING);
                shard.setStartTime(new Date());
                shard.setExecutorNode(node.getNodeId());
                shardStore.updateShard(shard);
                
                // 执行分片
                TaskShardResult result = shardExecutor.executeShard(shard, node);
                
                // 更新分片结果
                shard.setStatus(result.isSuccess() ? TaskShardStatus.SUCCESS : TaskShardStatus.FAILED);
                shard.setEndTime(new Date());
                shard.setExecutionTime(result.getExecutionTime());
                shard.setSuccess(result.isSuccess());
                shard.setErrorMessage(result.getErrorMessage());
                shard.setResultData(result.getResultData());
                
                shardStore.updateShard(shard);
                
                System.out.println("分片执行完成: " + shard.getShardId() + 
                                 ", 结果: " + (result.isSuccess() ? "成功" : "失败"));
                
                return result;
            } catch (Exception e) {
                // 更新分片失败状态
                shard.setStatus(TaskShardStatus.FAILED);
                shard.setEndTime(new Date());
                shard.setErrorMessage(e.getMessage());
                shardStore.updateShard(shard);
                
                System.err.println("分片执行失败: " + shard.getShardId() + ", 错误: " + e.getMessage());
                return new TaskShardResult(false, e.getMessage(), null, 0);
            }
        });
    }
    
    // 获取任务的分片执行状态
    public TaskShardExecutionStatus getTaskShardStatus(String taskId) {
        List<TaskShard> shards = shardStore.getShardsByTaskId(taskId);
        
        TaskShardExecutionStatus status = new TaskShardExecutionStatus();
        status.setTaskId(taskId);
        status.setTotalShards(shards.size());
        
        long completedShards = shards.stream()
            .filter(shard -> shard.getStatus() == TaskShardStatus.SUCCESS || 
                           shard.getStatus() == TaskShardStatus.FAILED)
            .count();
        
        status.setCompletedShards((int) completedShards);
        
        long successShards = shards.stream()
            .filter(shard -> shard.getStatus() == TaskShardStatus.SUCCESS)
            .count();
        
        status.setSuccessShards((int) successShards);
        
        // 计算平均执行时间
        OptionalDouble avgTime = shards.stream()
            .filter(shard -> shard.getExecutionTime() > 0)
            .mapToLong(TaskShard::getExecutionTime)
            .average();
        
        status.setAverageExecutionTime(avgTime.orElse(0.0));
        
        // 设置整体状态
        if (completedShards == shards.size()) {
            status.setOverallStatus(successShards == shards.size() ? 
                TaskShardOverallStatus.SUCCESS : TaskShardOverallStatus.FAILED);
        } else {
            status.setOverallStatus(TaskShardOverallStatus.RUNNING);
        }
        
        return status;
    }
}

// 执行节点注册中心
class ExecutorNodeRegistry {
    private final Map<String, ExecutorNode> nodes = new ConcurrentHashMap<>();
    
    // 注册节点
    public void registerNode(ExecutorNode node) {
        nodes.put(node.getNodeId(), node);
        System.out.println("节点已注册: " + node.getNodeId());
    }
    
    // 更新节点心跳
    public void updateNodeHeartbeat(String nodeId) {
        ExecutorNode node = nodes.get(nodeId);
        if (node != null) {
            node.setLastHeartbeatTime(System.currentTimeMillis());
        }
    }
    
    // 获取节点
    public ExecutorNode getNode(String nodeId) {
        return nodes.get(nodeId);
    }
    
    // 获取所有节点
    public List<ExecutorNode> getAllNodes() {
        return new ArrayList<>(nodes.values());
    }
    
    // 获取可用节点
    public List<ExecutorNode> getAvailableNodes() {
        return nodes.values().stream()
            .filter(ExecutorNode::isAvailable)
            .collect(Collectors.toList());
    }
}

// 分片执行器
class TaskShardExecutor {
    
    // 执行分片
    public TaskShardResult executeShard(TaskShard shard, ExecutorNode node) {
        try {
            long startTime = System.currentTimeMillis();
            
            // 这里应该通过网络调用远程节点执行分片
            // 为了简化示例，我们模拟执行过程
            boolean success = simulateShardExecution(shard);
            String resultData = success ? "分片执行成功" : "分片执行失败";
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            return new TaskShardResult(success, null, resultData, executionTime);
        } catch (Exception e) {
            return new TaskShardResult(false, e.getMessage(), null, 0);
        }
    }
    
    // 模拟分片执行
    private boolean simulateShardExecution(TaskShard shard) {
        try {
            // 模拟执行时间
            long executionTime = (long) (Math.random() * 3000) + 1000; // 1-4秒
            Thread.sleep(executionTime);
            
            // 模拟成功率
            return Math.random() > 0.1; // 90%成功率
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}

// 分片执行结果
class TaskShardResult {
    private final boolean success;
    private final String errorMessage;
    private final String resultData;
    private final long executionTime;
    
    public TaskShardResult(boolean success, String errorMessage, String resultData, long executionTime) {
        this.success = success;
        this.errorMessage = errorMessage;
        this.resultData = resultData;
        this.executionTime = executionTime;
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public String getErrorMessage() { return errorMessage; }
    public String getResultData() { return resultData; }
    public long getExecutionTime() { return executionTime; }
}

// 分片执行状态
class TaskShardExecutionStatus {
    private String taskId;
    private int totalShards;
    private int completedShards;
    private int successShards;
    private double averageExecutionTime;
    private TaskShardOverallStatus overallStatus;
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public int getTotalShards() { return totalShards; }
    public void setTotalShards(int totalShards) { this.totalShards = totalShards; }
    
    public int getCompletedShards() { return completedShards; }
    public void setCompletedShards(int completedShards) { this.completedShards = completedShards; }
    
    public int getSuccessShards() { return successShards; }
    public void setSuccessShards(int successShards) { this.successShards = successShards; }
    
    public double getAverageExecutionTime() { return averageExecutionTime; }
    public void setAverageExecutionTime(double averageExecutionTime) { this.averageExecutionTime = averageExecutionTime; }
    
    public TaskShardOverallStatus getOverallStatus() { return overallStatus; }
    public void setOverallStatus(TaskShardOverallStatus overallStatus) { this.overallStatus = overallStatus; }
    
    // 计算完成率
    public double getCompletionRate() {
        return totalShards > 0 ? (double) completedShards / totalShards * 100 : 0;
    }
    
    // 计算成功率
    public double getSuccessRate() {
        return completedShards > 0 ? (double) successShards / completedShards * 100 : 0;
    }
}

// 分片整体执行状态枚举
enum TaskShardOverallStatus {
    PENDING("待执行"),
    RUNNING("执行中"),
    SUCCESS("执行成功"),
    FAILED("执行失败");
    
    private final String description;
    
    TaskShardOverallStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() { return description; }
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用任务分片和负载均衡功能：

```java
// 任务分片与负载均衡使用示例
public class TaskShardingAndLoadBalancingExample {
    public static void main(String[] args) {
        try {
            // 配置数据源
            DataSourceConfig config = new DataSourceConfig(
                "jdbc:mysql://localhost:3306/scheduler?useSSL=false&serverTimezone=UTC",
                "scheduler_user",
                "scheduler_password"
            );
            DataSource dataSource = config.createDataSource();
            
            // 创建分片存储
            TaskShardStore shardStore = new DatabaseTaskShardStore(dataSource);
            
            // 创建执行节点注册中心
            ExecutorNodeRegistry nodeRegistry = new ExecutorNodeRegistry();
            
            // 注册执行节点
            registerExecutorNodes(nodeRegistry);
            
            // 创建负载均衡策略
            LoadBalancingStrategy loadBalancingStrategy = new LeastConnectionsLoadBalancingStrategy();
            
            // 创建分片执行器
            TaskShardExecutor shardExecutor = new TaskShardExecutor();
            
            // 创建分片管理器
            TaskShardManager shardManager = new TaskShardManager(
                shardStore, loadBalancingStrategy, nodeRegistry, shardExecutor);
            shardManager.start();
            
            // 创建分片策略
            ShardingStrategy shardingStrategy = new RangeBasedShardingStrategy();
            
            // 创建示例任务
            ScheduledTask task = createSampleTask();
            
            // 创建分片
            List<TaskShard> shards = shardManager.createShards(task, 5, shardingStrategy);
            
            // 监控分片执行状态
            monitorShardExecution(shardManager, task.getTaskId());
            
            // 运行一段时间
            Thread.sleep(60000); // 1分钟
            
            // 停止分片管理器
            shardManager.stop();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 注册执行节点
    private static void registerExecutorNodes(ExecutorNodeRegistry nodeRegistry) {
        for (int i = 1; i <= 3; i++) {
            ExecutorNode node = new ExecutorNode("node-" + i, "192.168.1." + (100 + i), 8080);
            node.setTaskCount((int) (Math.random() * 10)); // 随机任务数
            node.setCpuUsage(Math.random() * 0.8); // 随机CPU使用率
            node.setMemoryUsage((long) (Math.random() * 1000000000)); // 随机内存使用量
            node.setLastHeartbeatTime(System.currentTimeMillis());
            
            nodeRegistry.registerNode(node);
        }
    }
    
    // 创建示例任务
    private static ScheduledTask createSampleTask() {
        ScheduledTask task = new ScheduledTask();
        task.setTaskName("数据处理任务");
        task.setTaskClass("com.example.DataProcessingTask");
        task.setTaskType(TaskType.FIXED_RATE);
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("totalRecords", 1000000L);
        parameters.put("tableName", "user_data");
        parameters.put("taskType", "data_processing");
        task.setParameters(parameters);
        
        return task;
    }
    
    // 监控分片执行状态
    private static void monitorShardExecution(TaskShardManager shardManager, String taskId) {
        ScheduledExecutorService monitor = Executors.newScheduledThreadPool(1);
        
        monitor.scheduleAtFixedRate(() -> {
            try {
                TaskShardExecutionStatus status = shardManager.getTaskShardStatus(taskId);
                
                System.out.println("=== 任务分片执行状态 ===");
                System.out.println("任务ID: " + status.getTaskId());
                System.out.println("总分片数: " + status.getTotalShards());
                System.out.println("已完成: " + status.getCompletedShards());
                System.out.println("成功: " + status.getSuccessShards());
                System.out.println("完成率: " + String.format("%.2f%%", status.getCompletionRate()));
                System.out.println("成功率: " + String.format("%.2f%%", status.getSuccessRate()));
                System.out.println("平均执行时间: " + String.format("%.2fms", status.getAverageExecutionTime()));
                System.out.println("整体状态: " + status.getOverallStatus().getDescription());
                System.out.println();
            } catch (Exception e) {
                System.err.println("监控分片状态时出错: " + e.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS);
        
        // 30秒后停止监控
        monitor.schedule(() -> {
            monitor.shutdown();
            try {
                if (!monitor.awaitTermination(5, TimeUnit.SECONDS)) {
                    monitor.shutdownNow();
                }
            } catch (InterruptedException e) {
                monitor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }, 30, TimeUnit.SECONDS);
    }
}
```

## 总结

通过本文的实现，我们构建了一个完整的任务分片与负载均衡系统，具有以下特点：

1. **灵活的分片策略**：支持基于数据范围、哈希、时间等多种分片算法
2. **高效的负载均衡**：实现轮询、最少连接数、加权、一致性哈希等多种负载均衡策略
3. **完善的分片管理**：提供分片的创建、存储、状态管理、执行监控等功能
4. **可扩展的架构**：支持动态添加执行节点，自动负载均衡
5. **实时监控能力**：提供分片执行状态的实时监控和统计分析

任务分片与负载均衡技术是构建高性能分布式任务调度系统的关键。通过合理应用这些技术，我们可以显著提升系统的处理能力和可扩展性，满足大规模任务调度的需求。

在下一节中，我们将探讨高可用与扩展性设计，进一步提升分布式调度系统的稳定性和可靠性。