---
title: 3.1 使用数据库存储任务
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在单机定时任务调度系统中，任务信息通常存储在内存中，这种方式简单高效，但存在明显的局限性：当调度器重启时，所有任务信息都会丢失，无法实现任务的持久化。在分布式任务调度系统中，任务信息需要在多个节点间共享，并且要求具有高可用性和一致性。因此，使用数据库存储任务信息成为分布式调度系统的必然选择。本文将详细介绍如何使用数据库来存储和管理任务信息。

## 数据库存储的优势与挑战

在分布式环境中使用数据库存储任务信息具有显著的优势，但也面临一些挑战。

### 优势分析

```java
// 数据库存储任务的优势
public class DatabaseStorageBenefits {
    
    /*
     * 使用数据库存储任务的主要优势：
     * 1. 持久化存储 - 任务信息不会因系统重启而丢失
     * 2. 数据共享 - 多个调度节点可以访问相同的数据
     * 3. 事务支持 - 保证数据的一致性和完整性
     * 4. 查询能力 - 支持复杂查询和统计分析
     * 5. 备份恢复 - 可以通过数据库备份机制保护数据
     * 6. 监控审计 - 数据库提供完善的监控和审计功能
     */
    
    // 优势对比表
    public void compareStorageOptions() {
        System.out.println("存储方式对比:");
        System.out.println("内存存储: 速度快，但易失性，无法共享");
        System.out.println("文件存储: 持久化，但并发访问困难，查询能力弱");
        System.out.println("数据库存储: 持久化、共享、事务支持、强大查询能力");
    }
}
```

### 面临的挑战

```java
// 数据库存储任务面临的挑战
public class DatabaseStorageChallenges {
    
    /*
     * 使用数据库存储任务面临的主要挑战：
     * 1. 性能问题 - 数据库访问比内存访问慢几个数量级
     * 2. 并发控制 - 多节点同时访问需要处理并发冲突
     * 3. 一致性保证 - 需要处理分布式事务和数据一致性
     * 4. 连接管理 - 数据库连接资源有限，需要合理管理
     * 5. 故障恢复 - 需要处理数据库故障对调度系统的影响
     * 6. 数据分片 - 大量任务数据需要合理分片存储
     */
    
    // 性能优化策略
    public void performanceOptimizationStrategies() {
        System.out.println("性能优化策略:");
        System.out.println("1. 使用连接池减少连接开销");
        System.out.println("2. 合理设计索引提高查询效率");
        System.out.println("3. 使用缓存减少数据库访问");
        System.out.println("4. 批量操作减少数据库交互次数");
        System.out.println("5. 异步处理非关键操作");
    }
}
```

## 任务数据模型设计

设计合理的数据模型是实现高效任务存储的基础。我们需要考虑任务的基本信息、执行信息、状态信息等多个维度。

### 任务表结构设计

```sql
-- 任务信息表
CREATE TABLE scheduled_tasks (
    task_id VARCHAR(64) PRIMARY KEY COMMENT '任务ID',
    task_name VARCHAR(255) NOT NULL COMMENT '任务名称',
    task_description TEXT COMMENT '任务描述',
    task_class VARCHAR(255) NOT NULL COMMENT '任务执行类',
    cron_expression VARCHAR(128) COMMENT 'Cron表达式',
    task_type VARCHAR(32) NOT NULL COMMENT '任务类型(CRON/FIXED_RATE/FIXED_DELAY)',
    task_parameters TEXT COMMENT '任务参数(JSON格式)',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '任务状态',
    is_persistent BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否持久化',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    last_execute_time TIMESTAMP NULL COMMENT '最后执行时间',
    next_execute_time TIMESTAMP NULL COMMENT '下次执行时间',
    execute_count INT NOT NULL DEFAULT 0 COMMENT '执行次数',
    fail_count INT NOT NULL DEFAULT 0 COMMENT '失败次数',
    last_error_message TEXT COMMENT '最后错误信息',
    version INT NOT NULL DEFAULT 0 COMMENT '版本号(乐观锁)',
    INDEX idx_status (status),
    INDEX idx_next_execute_time (next_execute_time),
    INDEX idx_task_type (task_type),
    INDEX idx_create_time (create_time)
) COMMENT='定时任务信息表';

-- 任务执行日志表
CREATE TABLE task_execution_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    task_id VARCHAR(64) NOT NULL COMMENT '任务ID',
    task_name VARCHAR(255) NOT NULL COMMENT '任务名称',
    execute_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
    execution_time BIGINT NOT NULL COMMENT '执行耗时(毫秒)',
    success BOOLEAN NOT NULL COMMENT '是否成功',
    message TEXT COMMENT '执行消息',
    error_message TEXT COMMENT '错误信息',
    result_data TEXT COMMENT '执行结果',
    INDEX idx_task_id (task_id),
    INDEX idx_execute_time (execute_time),
    INDEX idx_success (success)
) COMMENT='任务执行日志表';

-- 任务分片表
CREATE TABLE task_shards (
    shard_id VARCHAR(64) PRIMARY KEY COMMENT '分片ID',
    task_id VARCHAR(64) NOT NULL COMMENT '任务ID',
    shard_index INT NOT NULL COMMENT '分片索引',
    shard_count INT NOT NULL COMMENT '分片总数',
    shard_parameters TEXT COMMENT '分片参数',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '分片状态',
    execute_time TIMESTAMP NULL COMMENT '执行时间',
    execute_result TEXT COMMENT '执行结果',
    INDEX idx_task_id (task_id),
    INDEX idx_status (status)
) COMMENT='任务分片表';
```

### 任务实体类实现

```java
// 数据库任务实体类
public class DatabaseScheduledTask {
    private String taskId;              // 任务ID
    private String taskName;            // 任务名称
    private String taskDescription;     // 任务描述
    private String taskClass;           // 任务执行类
    private String cronExpression;      // Cron表达式
    private TaskType taskType;          // 任务类型
    private String taskParameters;      // 任务参数(JSON字符串)
    private TaskStatus status;          // 任务状态
    private boolean persistent;         // 是否持久化
    private boolean enabled;            // 是否启用
    private Date createTime;            // 创建时间
    private Date updateTime;            // 更新时间
    private Date lastExecuteTime;       // 最后执行时间
    private Date nextExecuteTime;       // 下次执行时间
    private int executeCount;           // 执行次数
    private int failCount;              // 失败次数
    private String lastErrorMessage;    // 最后错误信息
    private int version;                // 版本号(乐观锁)
    
    // 构造函数
    public DatabaseScheduledTask() {
        this.taskId = UUID.randomUUID().toString().replace("-", "");
        this.status = TaskStatus.PENDING;
        this.persistent = true;
        this.enabled = true;
        this.createTime = new Date();
        this.updateTime = new Date();
        this.executeCount = 0;
        this.failCount = 0;
        this.version = 0;
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public String getTaskDescription() { return taskDescription; }
    public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }
    
    public String getTaskClass() { return taskClass; }
    public void setTaskClass(String taskClass) { this.taskClass = taskClass; }
    
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    
    public TaskType getTaskType() { return taskType; }
    public void setTaskType(TaskType taskType) { this.taskType = taskType; }
    
    public String getTaskParameters() { return taskParameters; }
    public void setTaskParameters(String taskParameters) { this.taskParameters = taskParameters; }
    
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    
    public boolean isPersistent() { return persistent; }
    public void setPersistent(boolean persistent) { this.persistent = persistent; }
    
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    
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
    
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    
    // 将JSON字符串转换为参数Map
    public Map<String, Object> getParametersAsMap() {
        if (taskParameters == null || taskParameters.trim().isEmpty()) {
            return new HashMap<>();
        }
        
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(taskParameters, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new RuntimeException("解析任务参数失败", e);
        }
    }
    
    // 将参数Map转换为JSON字符串
    public void setParametersFromMap(Map<String, Object> parameters) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            this.taskParameters = mapper.writeValueAsString(parameters);
        } catch (Exception e) {
            throw new RuntimeException("序列化任务参数失败", e);
        }
    }
}

// 任务执行日志实体类
class TaskExecutionLog {
    private Long logId;             // 日志ID
    private String taskId;          // 任务ID
    private String taskName;        // 任务名称
    private Date executeTime;       // 执行时间
    private long executionTime;     // 执行耗时(毫秒)
    private boolean success;        // 是否成功
    private String message;         // 执行消息
    private String errorMessage;    // 错误信息
    private String resultData;      // 执行结果
    
    // Getters and Setters
    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }
    
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public Date getExecuteTime() { return executeTime; }
    public void setExecuteTime(Date executeTime) { this.executeTime = executeTime; }
    
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public String getResultData() { return resultData; }
    public void setResultData(String resultData) { this.resultData = resultData; }
}
```

## 数据库访问层实现

为了高效地访问数据库，我们需要实现一个完善的数据库访问层，包括连接管理、SQL操作、事务处理等功能。

### 数据源配置

```java
// 数据源配置
public class DataSourceConfig {
    private String url;
    private String username;
    private String password;
    private String driverClassName;
    private int initialSize = 5;
    private int maxTotal = 20;
    private int maxIdle = 10;
    private int minIdle = 5;
    private long maxWaitMillis = 10000;
    
    // 构造函数
    public DataSourceConfig(String url, String username, String password) {
        this.url = url;
        this.username = username;
        this.password = password;
        this.driverClassName = "com.mysql.cj.jdbc.Driver";
    }
    
    // 创建数据源
    public DataSource createDataSource() {
        BasicDataSource dataSource = new BasicDataSource();
        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        dataSource.setDriverClassName(driverClassName);
        dataSource.setInitialSize(initialSize);
        dataSource.setMaxTotal(maxTotal);
        dataSource.setMaxIdle(maxIdle);
        dataSource.setMinIdle(minIdle);
        dataSource.setMaxWaitMillis(maxWaitMillis);
        return dataSource;
    }
    
    // Getters and Setters
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    
    public String getDriverClassName() { return driverClassName; }
    public void setDriverClassName(String driverClassName) { this.driverClassName = driverClassName; }
    
    public int getInitialSize() { return initialSize; }
    public void setInitialSize(int initialSize) { this.initialSize = initialSize; }
    
    public int getMaxTotal() { return maxTotal; }
    public void setMaxTotal(int maxTotal) { this.maxTotal = maxTotal; }
    
    public int getMaxIdle() { return maxIdle; }
    public void setMaxIdle(int maxIdle) { this.maxIdle = maxIdle; }
    
    public int getMinIdle() { return minIdle; }
    public void setMinIdle(int minIdle) { this.minIdle = minIdle; }
    
    public long getMaxWaitMillis() { return maxWaitMillis; }
    public void setMaxWaitMillis(long maxWaitMillis) { this.maxWaitMillis = maxWaitMillis; }
}
```

### 任务数据访问对象

```java
// 任务DAO接口
public interface TaskDao {
    /**
     * 保存任务
     * @param task 任务信息
     * @return 是否保存成功
     */
    boolean saveTask(DatabaseScheduledTask task);
    
    /**
     * 更新任务
     * @param task 任务信息
     * @return 是否更新成功
     */
    boolean updateTask(DatabaseScheduledTask task);
    
    /**
     * 删除任务
     * @param taskId 任务ID
     * @return 是否删除成功
     */
    boolean deleteTask(String taskId);
    
    /**
     * 根据ID获取任务
     * @param taskId 任务ID
     * @return 任务信息
     */
    DatabaseScheduledTask getTaskById(String taskId);
    
    /**
     * 获取所有任务
     * @return 任务列表
     */
    List<DatabaseScheduledTask> getAllTasks();
    
    /**
     * 获取需要执行的任务
     * @param currentTime 当前时间
     * @return 任务列表
     */
    List<DatabaseScheduledTask> getTasksToExecute(Date currentTime);
    
    /**
     * 更新任务状态
     * @param taskId 任务ID
     * @param status 新状态
     * @param version 版本号(乐观锁)
     * @return 是否更新成功
     */
    boolean updateTaskStatus(String taskId, TaskStatus status, int version);
    
    /**
     * 增加执行计数
     * @param taskId 任务ID
     * @param version 版本号(乐观锁)
     * @return 是否更新成功
     */
    boolean incrementExecuteCount(String taskId, int version);
}

// 任务DAO实现
public class DatabaseTaskDao implements TaskDao {
    private final DataSource dataSource;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public DatabaseTaskDao(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public boolean saveTask(DatabaseScheduledTask task) {
        String sql = "INSERT INTO scheduled_tasks (" +
            "task_id, task_name, task_description, task_class, cron_expression, " +
            "task_type, task_parameters, status, is_persistent, is_enabled, " +
            "create_time, update_time, last_execute_time, next_execute_time, " +
            "execute_count, fail_count, last_error_message, version) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, task.getTaskId());
            stmt.setString(2, task.getTaskName());
            stmt.setString(3, task.getTaskDescription());
            stmt.setString(4, task.getTaskClass());
            stmt.setString(5, task.getCronExpression());
            stmt.setString(6, task.getTaskType().name());
            stmt.setString(7, task.getTaskParameters());
            stmt.setString(8, task.getStatus().name());
            stmt.setBoolean(9, task.isPersistent());
            stmt.setBoolean(10, task.isEnabled());
            stmt.setTimestamp(11, new Timestamp(task.getCreateTime().getTime()));
            stmt.setTimestamp(12, new Timestamp(task.getUpdateTime().getTime()));
            stmt.setTimestamp(13, task.getLastExecuteTime() != null ? 
                new Timestamp(task.getLastExecuteTime().getTime()) : null);
            stmt.setTimestamp(14, task.getNextExecuteTime() != null ? 
                new Timestamp(task.getNextExecuteTime().getTime()) : null);
            stmt.setInt(15, task.getExecuteCount());
            stmt.setInt(16, task.getFailCount());
            stmt.setString(17, task.getLastErrorMessage());
            stmt.setInt(18, task.getVersion());
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("保存任务失败", e);
        }
    }
    
    @Override
    public boolean updateTask(DatabaseScheduledTask task) {
        String sql = "UPDATE scheduled_tasks SET " +
            "task_name = ?, task_description = ?, task_class = ?, cron_expression = ?, " +
            "task_type = ?, task_parameters = ?, status = ?, is_persistent = ?, is_enabled = ?, " +
            "update_time = ?, last_execute_time = ?, next_execute_time = ?, " +
            "execute_count = ?, fail_count = ?, last_error_message = ?, version = version + 1 " +
            "WHERE task_id = ? AND version = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, task.getTaskName());
            stmt.setString(2, task.getTaskDescription());
            stmt.setString(3, task.getTaskClass());
            stmt.setString(4, task.getCronExpression());
            stmt.setString(5, task.getTaskType().name());
            stmt.setString(6, task.getTaskParameters());
            stmt.setString(7, task.getStatus().name());
            stmt.setBoolean(8, task.isPersistent());
            stmt.setBoolean(9, task.isEnabled());
            stmt.setTimestamp(10, new Timestamp(task.getUpdateTime().getTime()));
            stmt.setTimestamp(11, task.getLastExecuteTime() != null ? 
                new Timestamp(task.getLastExecuteTime().getTime()) : null);
            stmt.setTimestamp(12, task.getNextExecuteTime() != null ? 
                new Timestamp(task.getNextExecuteTime().getTime()) : null);
            stmt.setInt(13, task.getExecuteCount());
            stmt.setInt(14, task.getFailCount());
            stmt.setString(15, task.getLastErrorMessage());
            stmt.setString(16, task.getTaskId());
            stmt.setInt(17, task.getVersion());
            
            int rowsAffected = stmt.executeUpdate();
            if (rowsAffected > 0) {
                task.setVersion(task.getVersion() + 1);
                return true;
            }
            return false;
        } catch (SQLException e) {
            throw new RuntimeException("更新任务失败", e);
        }
    }
    
    @Override
    public boolean deleteTask(String taskId) {
        String sql = "DELETE FROM scheduled_tasks WHERE task_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, taskId);
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("删除任务失败", e);
        }
    }
    
    @Override
    public DatabaseScheduledTask getTaskById(String taskId) {
        String sql = "SELECT * FROM scheduled_tasks WHERE task_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, taskId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToTask(rs);
                }
                return null;
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询任务失败", e);
        }
    }
    
    @Override
    public List<DatabaseScheduledTask> getAllTasks() {
        String sql = "SELECT * FROM scheduled_tasks ORDER BY create_time DESC";
        List<DatabaseScheduledTask> tasks = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询所有任务失败", e);
        }
        
        return tasks;
    }
    
    @Override
    public List<DatabaseScheduledTask> getTasksToExecute(Date currentTime) {
        String sql = "SELECT * FROM scheduled_tasks " +
            "WHERE status = 'PENDING' AND is_enabled = TRUE AND next_execute_time <= ? " +
            "ORDER BY next_execute_time ASC";
        
        List<DatabaseScheduledTask> tasks = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setTimestamp(1, new Timestamp(currentTime.getTime()));
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    tasks.add(mapResultSetToTask(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询待执行任务失败", e);
        }
        
        return tasks;
    }
    
    @Override
    public boolean updateTaskStatus(String taskId, TaskStatus status, int version) {
        String sql = "UPDATE scheduled_tasks SET status = ?, update_time = ?, version = version + 1 " +
            "WHERE task_id = ? AND version = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, status.name());
            stmt.setTimestamp(2, new Timestamp(System.currentTimeMillis()));
            stmt.setString(3, taskId);
            stmt.setInt(4, version);
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("更新任务状态失败", e);
        }
    }
    
    @Override
    public boolean incrementExecuteCount(String taskId, int version) {
        String sql = "UPDATE scheduled_tasks SET execute_count = execute_count + 1, " +
            "last_execute_time = ?, update_time = ?, version = version + 1 " +
            "WHERE task_id = ? AND version = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setTimestamp(1, new Timestamp(System.currentTimeMillis()));
            stmt.setTimestamp(2, new Timestamp(System.currentTimeMillis()));
            stmt.setString(3, taskId);
            stmt.setInt(4, version);
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("增加执行计数失败", e);
        }
    }
    
    // 将ResultSet映射为任务对象
    private DatabaseScheduledTask mapResultSetToTask(ResultSet rs) throws SQLException {
        DatabaseScheduledTask task = new DatabaseScheduledTask();
        task.setTaskId(rs.getString("task_id"));
        task.setTaskName(rs.getString("task_name"));
        task.setTaskDescription(rs.getString("task_description"));
        task.setTaskClass(rs.getString("task_class"));
        task.setCronExpression(rs.getString("cron_expression"));
        task.setTaskType(TaskType.valueOf(rs.getString("task_type")));
        task.setTaskParameters(rs.getString("task_parameters"));
        task.setStatus(TaskStatus.valueOf(rs.getString("status")));
        task.setPersistent(rs.getBoolean("is_persistent"));
        task.setEnabled(rs.getBoolean("is_enabled"));
        task.setCreateTime(rs.getTimestamp("create_time"));
        task.setUpdateTime(rs.getTimestamp("update_time"));
        task.setLastExecuteTime(rs.getTimestamp("last_execute_time"));
        task.setNextExecuteTime(rs.getTimestamp("next_execute_time"));
        task.setExecuteCount(rs.getInt("execute_count"));
        task.setFailCount(rs.getInt("fail_count"));
        task.setLastErrorMessage(rs.getString("last_error_message"));
        task.setVersion(rs.getInt("version"));
        return task;
    }
}
```

## 任务日志数据访问对象

```java
// 任务日志DAO接口
public interface TaskLogDao {
    /**
     * 保存执行日志
     * @param log 日志信息
     * @return 是否保存成功
     */
    boolean saveExecutionLog(TaskExecutionLog log);
    
    /**
     * 获取任务的执行日志
     * @param taskId 任务ID
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getExecutionLogs(String taskId, int limit);
    
    /**
     * 获取最近的执行日志
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getRecentExecutionLogs(int limit);
    
    /**
     * 获取失败的执行日志
     * @param limit 限制数量
     * @return 日志列表
     */
    List<TaskExecutionLog> getFailedExecutionLogs(int limit);
}

// 任务日志DAO实现
public class DatabaseTaskLogDao implements TaskLogDao {
    private final DataSource dataSource;
    
    public DatabaseTaskLogDao(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public boolean saveExecutionLog(TaskExecutionLog log) {
        String sql = "INSERT INTO task_execution_logs (" +
            "task_id, task_name, execute_time, execution_time, success, " +
            "message, error_message, result_data) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, log.getTaskId());
            stmt.setString(2, log.getTaskName());
            stmt.setTimestamp(3, new Timestamp(log.getExecuteTime().getTime()));
            stmt.setLong(4, log.getExecutionTime());
            stmt.setBoolean(5, log.isSuccess());
            stmt.setString(6, log.getMessage());
            stmt.setString(7, log.getErrorMessage());
            stmt.setString(8, log.getResultData());
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("保存执行日志失败", e);
        }
    }
    
    @Override
    public List<TaskExecutionLog> getExecutionLogs(String taskId, int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE task_id = ? ORDER BY execute_time DESC LIMIT ?";
        
        List<TaskExecutionLog> logs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, taskId);
            stmt.setInt(2, limit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    logs.add(mapResultSetToLog(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询执行日志失败", e);
        }
        
        return logs;
    }
    
    @Override
    public List<TaskExecutionLog> getRecentExecutionLogs(int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "ORDER BY execute_time DESC LIMIT ?";
        
        List<TaskExecutionLog> logs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setInt(1, limit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    logs.add(mapResultSetToLog(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询最近执行日志失败", e);
        }
        
        return logs;
    }
    
    @Override
    public List<TaskExecutionLog> getFailedExecutionLogs(int limit) {
        String sql = "SELECT * FROM task_execution_logs " +
            "WHERE success = FALSE ORDER BY execute_time DESC LIMIT ?";
        
        List<TaskExecutionLog> logs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setInt(1, limit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    logs.add(mapResultSetToLog(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询失败执行日志失败", e);
        }
        
        return logs;
    }
    
    // 将ResultSet映射为日志对象
    private TaskExecutionLog mapResultSetToLog(ResultSet rs) throws SQLException {
        TaskExecutionLog log = new TaskExecutionLog();
        log.setLogId(rs.getLong("log_id"));
        log.setTaskId(rs.getString("task_id"));
        log.setTaskName(rs.getString("task_name"));
        log.setExecuteTime(rs.getTimestamp("execute_time"));
        log.setExecutionTime(rs.getLong("execution_time"));
        log.setSuccess(rs.getBoolean("success"));
        log.setMessage(rs.getString("message"));
        log.setErrorMessage(rs.getString("error_message"));
        log.setResultData(rs.getString("result_data"));
        return log;
    }
}
```

## 数据库任务存储实现

基于DAO层，我们可以实现数据库任务存储服务：

```java
// 数据库任务存储实现
public class DatabaseTaskStore implements TaskStore {
    private final TaskDao taskDao;
    private final TaskLogDao taskLogDao;
    private final Cache<String, DatabaseScheduledTask> taskCache;
    
    public DatabaseTaskStore(TaskDao taskDao, TaskLogDao taskLogDao) {
        this.taskDao = taskDao;
        this.taskLogDao = taskLogDao;
        // 使用简单的LRU缓存
        this.taskCache = CacheBuilder.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build();
    }
    
    @Override
    public void saveTask(ScheduledTask task) {
        // 转换为数据库任务对象
        DatabaseScheduledTask dbTask = convertToDatabaseTask(task);
        
        // 保存到数据库
        if (taskDao.getTaskById(dbTask.getTaskId()) == null) {
            taskDao.saveTask(dbTask);
        } else {
            taskDao.updateTask(dbTask);
        }
        
        // 更新缓存
        taskCache.put(dbTask.getTaskId(), dbTask);
    }
    
    @Override
    public void removeTask(String taskId) {
        taskDao.deleteTask(taskId);
        // 从缓存中移除
        taskCache.invalidate(taskId);
    }
    
    @Override
    public ScheduledTask getTask(String taskId) {
        // 先从缓存获取
        DatabaseScheduledTask dbTask = taskCache.getIfPresent(taskId);
        if (dbTask == null) {
            // 从数据库获取
            dbTask = taskDao.getTaskById(taskId);
            if (dbTask != null) {
                taskCache.put(taskId, dbTask);
            }
        }
        
        return convertToScheduledTask(dbTask);
    }
    
    @Override
    public List<ScheduledTask> getAllTasks() {
        List<DatabaseScheduledTask> dbTasks = taskDao.getAllTasks();
        return dbTasks.stream()
            .map(this::convertToScheduledTask)
            .collect(Collectors.toList());
    }
    
    @Override
    public void updateTaskStatus(String taskId, TaskStatus status) {
        DatabaseScheduledTask dbTask = taskDao.getTaskById(taskId);
        if (dbTask != null) {
            taskDao.updateTaskStatus(taskId, status, dbTask.getVersion());
            // 从缓存中移除，下次获取时会从数据库加载最新数据
            taskCache.invalidate(taskId);
        }
    }
    
    @Override
    public List<ScheduledTask> getTasksToExecute(Date currentTime) {
        List<DatabaseScheduledTask> dbTasks = taskDao.getTasksToExecute(currentTime);
        return dbTasks.stream()
            .map(this::convertToScheduledTask)
            .collect(Collectors.toList());
    }
    
    // 保存执行日志
    public void saveExecutionLog(TaskExecutionLog log) {
        taskLogDao.saveExecutionLog(log);
    }
    
    // 获取执行日志
    public List<TaskExecutionLog> getExecutionLogs(String taskId, int limit) {
        return taskLogDao.getExecutionLogs(taskId, limit);
    }
    
    // 获取最近执行日志
    public List<TaskExecutionLog> getRecentExecutionLogs(int limit) {
        return taskLogDao.getRecentExecutionLogs(limit);
    }
    
    // 获取失败执行日志
    public List<TaskExecutionLog> getFailedExecutionLogs(int limit) {
        return taskLogDao.getFailedExecutionLogs(limit);
    }
    
    // 转换为数据库任务对象
    private DatabaseScheduledTask convertToDatabaseTask(ScheduledTask task) {
        DatabaseScheduledTask dbTask = new DatabaseScheduledTask();
        dbTask.setTaskId(task.getTaskId());
        dbTask.setTaskName(task.getTaskName());
        dbTask.setTaskClass(task.getTaskClass());
        dbTask.setCronExpression(task.getCronExpression());
        dbTask.setTaskType(task.getTaskType());
        dbTask.setParametersFromMap(task.getParameters());
        dbTask.setStatus(task.getStatus());
        dbTask.setPersistent(task.isPersistent());
        dbTask.setEnabled(true);
        dbTask.setCreateTime(task.getCreateTime());
        dbTask.setUpdateTime(task.getUpdateTime());
        dbTask.setLastExecuteTime(task.getLastExecuteTime());
        dbTask.setNextExecuteTime(task.getNextExecuteTime());
        dbTask.setExecuteCount(task.getExecuteCount());
        dbTask.setFailCount(task.getFailCount());
        dbTask.setLastErrorMessage(task.getLastErrorMessage());
        return dbTask;
    }
    
    // 转换为调度任务对象
    private ScheduledTask convertToScheduledTask(DatabaseScheduledTask dbTask) {
        if (dbTask == null) {
            return null;
        }
        
        ScheduledTask task = new ScheduledTask();
        task.setTaskId(dbTask.getTaskId());
        task.setTaskName(dbTask.getTaskName());
        task.setTaskClass(dbTask.getTaskClass());
        task.setCronExpression(dbTask.getCronExpression());
        task.setTaskType(dbTask.getTaskType());
        task.setParameters(dbTask.getParametersAsMap());
        task.setStatus(dbTask.getStatus());
        task.setPersistent(dbTask.isPersistent());
        task.setCreateTime(dbTask.getCreateTime());
        task.setUpdateTime(dbTask.getUpdateTime());
        task.setLastExecuteTime(dbTask.getLastExecuteTime());
        task.setNextExecuteTime(dbTask.getNextExecuteTime());
        task.setExecuteCount(dbTask.getExecuteCount());
        task.setFailCount(dbTask.getFailCount());
        task.setLastErrorMessage(dbTask.getLastErrorMessage());
        return task;
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用数据库存储任务：

```java
// 数据库任务存储使用示例
public class DatabaseTaskStoreExample {
    public static void main(String[] args) {
        try {
            // 配置数据源
            DataSourceConfig config = new DataSourceConfig(
                "jdbc:mysql://localhost:3306/scheduler?useSSL=false&serverTimezone=UTC",
                "scheduler_user",
                "scheduler_password"
            );
            DataSource dataSource = config.createDataSource();
            
            // 创建DAO
            TaskDao taskDao = new DatabaseTaskDao(dataSource);
            TaskLogDao taskLogDao = new DatabaseTaskLogDao(dataSource);
            
            // 创建任务存储
            DatabaseTaskStore taskStore = new DatabaseTaskStore(taskDao, taskLogDao);
            
            // 创建示例任务
            ScheduledTask backupTask = new ScheduledTask();
            backupTask.setTaskName("数据备份任务");
            backupTask.setTaskClass("com.example.DataBackupTask");
            backupTask.setTaskType(TaskType.CRON);
            backupTask.setCronExpression("0 0 2 * * ?");
            
            Map<String, Object> backupParams = new HashMap<>();
            backupParams.put("sourcePath", "/data/production");
            backupParams.put("targetPath", "/backup/daily");
            backupTask.setParameters(backupParams);
            
            // 保存任务
            taskStore.saveTask(backupTask);
            System.out.println("任务已保存: " + backupTask.getTaskName());
            
            // 创建另一个任务
            ScheduledTask emailTask = new ScheduledTask();
            emailTask.setTaskName("系统健康检查邮件");
            emailTask.setTaskClass("com.example.EmailSendTask");
            emailTask.setTaskType(TaskType.FIXED_RATE);
            
            Map<String, Object> emailParams = new HashMap<>();
            emailParams.put("recipient", "admin@example.com");
            emailParams.put("subject", "系统健康检查报告");
            emailParams.put("period", 3600000); // 每小时执行一次
            emailTask.setParameters(emailParams);
            
            // 保存任务
            taskStore.saveTask(emailTask);
            System.out.println("任务已保存: " + emailTask.getTaskName());
            
            // 查询所有任务
            System.out.println("\n=== 所有任务 ===");
            List<ScheduledTask> allTasks = taskStore.getAllTasks();
            for (ScheduledTask task : allTasks) {
                System.out.println("任务ID: " + task.getTaskId());
                System.out.println("任务名称: " + task.getTaskName());
                System.out.println("任务状态: " + task.getStatus());
                System.out.println("下次执行时间: " + task.getNextExecuteTime());
                System.out.println("---");
            }
            
            // 查询待执行任务
            System.out.println("\n=== 待执行任务 ===");
            List<ScheduledTask> pendingTasks = taskStore.getTasksToExecute(new Date());
            for (ScheduledTask task : pendingTasks) {
                System.out.println("待执行任务: " + task.getTaskName());
            }
            
            // 更新任务状态
            taskStore.updateTaskStatus(backupTask.getTaskId(), TaskStatus.RUNNING);
            System.out.println("任务状态已更新为RUNNING");
            
            // 模拟任务执行完成
            Thread.sleep(1000);
            
            // 记录执行日志
            TaskExecutionLog log = new TaskExecutionLog();
            log.setTaskId(backupTask.getTaskId());
            log.setTaskName(backupTask.getTaskName());
            log.setExecuteTime(new Date());
            log.setExecutionTime(5000); // 5秒
            log.setSuccess(true);
            log.setMessage("数据备份完成");
            
            taskStore.saveExecutionLog(log);
            System.out.println("执行日志已记录");
            
            // 查询执行日志
            System.out.println("\n=== 最近执行日志 ===");
            List<TaskExecutionLog> recentLogs = taskStore.getRecentExecutionLogs(10);
            for (TaskExecutionLog executionLog : recentLogs) {
                System.out.println("任务: " + executionLog.getTaskName());
                System.out.println("执行时间: " + executionLog.getExecuteTime());
                System.out.println("执行结果: " + (executionLog.isSuccess() ? "成功" : "失败"));
                System.out.println("---");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

## 性能优化建议

在实际应用中，为了提高数据库存储的性能，我们可以采用以下优化策略：

```java
// 数据库存储性能优化
public class DatabaseStorageOptimization {
    
    // 1. 连接池优化
    public DataSourceConfig optimizeConnectionPool() {
        DataSourceConfig config = new DataSourceConfig(
            "jdbc:mysql://localhost:3306/scheduler", "user", "password");
        
        // 根据系统负载调整连接池参数
        config.setInitialSize(10);    // 初始连接数
        config.setMinIdle(5);         // 最小空闲连接
        config.setMaxIdle(20);        // 最大空闲连接
        config.setMaxTotal(50);       // 最大连接数
        config.setMaxWaitMillis(5000); // 获取连接最大等待时间
        
        return config;
    }
    
    // 2. 索引优化建议
    public void suggestIndexes() {
        System.out.println("建议创建的索引:");
        System.out.println("1. CREATE INDEX idx_status ON scheduled_tasks(status);");
        System.out.println("2. CREATE INDEX idx_next_execute_time ON scheduled_tasks(next_execute_time);");
        System.out.println("3. CREATE INDEX idx_task_type ON scheduled_tasks(task_type);");
        System.out.println("4. CREATE INDEX idx_execute_time ON task_execution_logs(execute_time);");
        System.out.println("5. CREATE INDEX idx_success ON task_execution_logs(success);");
    }
    
    // 3. 查询优化
    public void optimizeQueries() {
        System.out.println("查询优化建议:");
        System.out.println("1. 避免SELECT *，只查询需要的字段");
        System.out.println("2. 使用LIMIT限制返回结果数量");
        System.out.println("3. 对大表进行分页查询");
        System.out.println("4. 使用EXPLAIN分析查询执行计划");
    }
    
    // 4. 缓存策略
    public void implementCaching() {
        System.out.println("缓存策略:");
        System.out.println("1. 使用本地缓存存储热点数据");
        System.out.println("2. 设置合理的缓存过期时间");
        System.out.println("3. 使用分布式缓存(如Redis)实现多节点共享");
        System.out.println("4. 缓存预热和更新策略");
    }
    
    // 5. 批量操作
    public void batchOperations() {
        System.out.println("批量操作优化:");
        System.out.println("1. 使用批处理插入/更新大量数据");
        System.out.println("2. 合理设置批处理大小");
        System.out.println("3. 使用事务确保数据一致性");
    }
}
```

## 总结

通过本文的实现，我们构建了一个基于数据库的任务存储系统，具有以下特点：

1. **持久化存储**：任务信息存储在数据库中，不会因系统重启而丢失
2. **数据共享**：多个调度节点可以访问相同的数据
3. **事务支持**：通过乐观锁机制保证数据一致性
4. **查询能力**：支持复杂查询和统计分析
5. **缓存优化**：使用本地缓存提高访问性能
6. **日志记录**：完整的执行日志记录和查询功能

这种数据库存储方案为构建分布式任务调度系统奠定了基础。在后续章节中，我们将在此基础上实现分布式锁、任务分片等高级功能，逐步构建一个完整的分布式调度系统。

在下一节中，我们将探讨如何使用分布式锁来保证任务在分布式环境中的唯一执行。