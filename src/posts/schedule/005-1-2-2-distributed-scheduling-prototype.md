---
title: 分布式调度雏形
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在上一章中，我们实现了一个最小可用的单机调度器。虽然它能够满足基本的定时任务需求，但在实际的生产环境中，单机调度器存在诸多局限性。本文将带领读者构建一个分布式调度系统的雏形，通过引入数据库存储、分布式锁和任务状态管理等机制，实现一个具备基本分布式特性的调度系统。

## 使用数据库存储任务

在分布式环境中，任务信息需要存储在共享的存储系统中，以便多个调度节点能够访问和管理任务。我们将使用数据库作为任务存储的后端。

### 数据库表设计

首先，我们需要设计任务相关的数据库表结构：

```sql
-- 任务表
CREATE TABLE scheduler_jobs (
    id VARCHAR(64) PRIMARY KEY COMMENT '任务ID',
    name VARCHAR(128) NOT NULL COMMENT '任务名称',
    description TEXT COMMENT '任务描述',
    cron_expression VARCHAR(64) NOT NULL COMMENT 'Cron表达式',
    job_class VARCHAR(256) NOT NULL COMMENT '任务执行类',
    params TEXT COMMENT '任务参数',
    status VARCHAR(32) DEFAULT 'ACTIVE' COMMENT '任务状态',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);

-- 任务执行日志表
CREATE TABLE job_execution_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    job_id VARCHAR(64) NOT NULL COMMENT '任务ID',
    trigger_time TIMESTAMP NOT NULL COMMENT '触发时间',
    start_time TIMESTAMP COMMENT '开始执行时间',
    end_time TIMESTAMP COMMENT '执行完成时间',
    status VARCHAR(32) NOT NULL COMMENT '执行状态',
    error_message TEXT COMMENT '错误信息',
    execution_result TEXT COMMENT '执行结果',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
);

-- 调度节点表
CREATE TABLE scheduler_nodes (
    id VARCHAR(64) PRIMARY KEY COMMENT '节点ID',
    host VARCHAR(128) NOT NULL COMMENT '主机地址',
    port INT NOT NULL COMMENT '端口',
    status VARCHAR(32) NOT NULL COMMENT '节点状态',
    last_heartbeat TIMESTAMP NOT NULL COMMENT '最后心跳时间',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);
```

### 任务实体类

基于数据库表结构，我们定义相应的 Java 实体类：

```java
import java.time.LocalDateTime;

public class Job {
    private String id;
    private String name;
    private String description;
    private String cronExpression;
    private String jobClass;
    private String params;
    private JobStatus status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    
    // 构造函数、getter和setter方法
    public Job() {}
    
    public Job(String id, String name, String cronExpression, String jobClass) {
        this.id = id;
        this.name = name;
        this.cronExpression = cronExpression;
        this.jobClass = jobClass;
        this.status = JobStatus.ACTIVE;
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
    }
    
    // getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    
    public String getJobClass() { return jobClass; }
    public void setJobClass(String jobClass) { this.jobClass = jobClass; }
    
    public String getParams() { return params; }
    public void setParams(String params) { this.params = params; }
    
    public JobStatus getStatus() { return status; }
    public void setStatus(JobStatus status) { this.status = status; }
    
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}

public enum JobStatus {
    ACTIVE,    // 激活状态
    INACTIVE,  // 非激活状态
    DELETED    // 已删除
}

public class JobExecutionLog {
    private Long id;
    private String jobId;
    private LocalDateTime triggerTime;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private ExecutionStatus status;
    private String errorMessage;
    private String executionResult;
    private LocalDateTime createTime;
    
    // 构造函数、getter和setter方法
    // ...
}

public enum ExecutionStatus {
    TRIGGERED,  // 已触发
    RUNNING,    // 运行中
    SUCCESS,    // 执行成功
    FAILED      // 执行失败
}
```

### 数据访问层实现

接下来，我们实现数据访问层，用于操作数据库中的任务信息：

```java
import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class JobDao {
    private DataSource dataSource;
    
    public JobDao(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    public void saveJob(Job job) throws SQLException {
        String sql = "INSERT INTO scheduler_jobs (id, name, description, cron_expression, job_class, params, status) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                     "ON DUPLICATE KEY UPDATE " +
                     "name = VALUES(name), description = VALUES(description), " +
                     "cron_expression = VALUES(cron_expression), job_class = VALUES(job_class), " +
                     "params = VALUES(params), status = VALUES(status), update_time = CURRENT_TIMESTAMP";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, job.getId());
            stmt.setString(2, job.getName());
            stmt.setString(3, job.getDescription());
            stmt.setString(4, job.getCronExpression());
            stmt.setString(5, job.getJobClass());
            stmt.setString(6, job.getParams());
            stmt.setString(7, job.getStatus().name());
            
            stmt.executeUpdate();
        }
    }
    
    public Job getJobById(String jobId) throws SQLException {
        String sql = "SELECT * FROM scheduler_jobs WHERE id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, jobId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToJob(rs);
                }
            }
        }
        return null;
    }
    
    public List<Job> getAllActiveJobs() throws SQLException {
        String sql = "SELECT * FROM scheduler_jobs WHERE status = 'ACTIVE'";
        List<Job> jobs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            
            while (rs.next()) {
                jobs.add(mapResultSetToJob(rs));
            }
        }
        return jobs;
    }
    
    public void updateJobStatus(String jobId, JobStatus status) throws SQLException {
        String sql = "UPDATE scheduler_jobs SET status = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, status.name());
            stmt.setString(2, jobId);
            stmt.executeUpdate();
        }
    }
    
    private Job mapResultSetToJob(ResultSet rs) throws SQLException {
        Job job = new Job();
        job.setId(rs.getString("id"));
        job.setName(rs.getString("name"));
        job.setDescription(rs.getString("description"));
        job.setCronExpression(rs.getString("cron_expression"));
        job.setJobClass(rs.getString("job_class"));
        job.setParams(rs.getString("params"));
        job.setStatus(JobStatus.valueOf(rs.getString("status")));
        job.setCreateTime(rs.getTimestamp("create_time").toLocalDateTime());
        job.setUpdateTime(rs.getTimestamp("update_time").toLocalDateTime());
        return job;
    }
    
    // 日志相关方法
    public void saveExecutionLog(JobExecutionLog log) throws SQLException {
        String sql = "INSERT INTO job_execution_logs (job_id, trigger_time, start_time, end_time, status, error_message, execution_result) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            
            stmt.setString(1, log.getJobId());
            stmt.setTimestamp(2, Timestamp.valueOf(log.getTriggerTime()));
            stmt.setTimestamp(3, log.getStartTime() != null ? Timestamp.valueOf(log.getStartTime()) : null);
            stmt.setTimestamp(4, log.getEndTime() != null ? Timestamp.valueOf(log.getEndTime()) : null);
            stmt.setString(5, log.getStatus().name());
            stmt.setString(6, log.getErrorMessage());
            stmt.setString(7, log.getExecutionResult());
            
            stmt.executeUpdate();
            
            try (ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                if (generatedKeys.next()) {
                    log.setId(generatedKeys.getLong(1));
                }
            }
        }
    }
}
```

## 分布式锁保证任务唯一执行

在分布式环境中，多个调度节点可能同时尝试执行同一个任务，这会导致任务重复执行。为了避免这种情况，我们需要引入分布式锁机制。

### 基于数据库的分布式锁实现

我们可以利用数据库的唯一约束特性来实现简单的分布式锁：

```java
import java.sql.*;
import java.time.LocalDateTime;

public class DatabaseDistributedLock {
    private DataSource dataSource;
    
    public DatabaseDistributedLock(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    /**
     * 尝试获取分布式锁
     * @param lockKey 锁的键值
     * @param ownerId 锁的持有者标识
     * @param timeout 锁的超时时间（秒）
     * @return 是否成功获取锁
     */
    public boolean tryLock(String lockKey, String ownerId, int timeout) {
        String sql = "INSERT INTO distributed_locks (lock_key, owner_id, expire_time) " +
                     "VALUES (?, ?, ?) " +
                     "ON DUPLICATE KEY UPDATE " +
                     "owner_id = VALUES(owner_id), expire_time = VALUES(expire_time)";
        
        LocalDateTime expireTime = LocalDateTime.now().plusSeconds(timeout);
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, lockKey);
            stmt.setString(2, ownerId);
            stmt.setTimestamp(3, Timestamp.valueOf(expireTime));
            
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            // 插入失败，说明锁已被其他节点持有
            return false;
        }
    }
    
    /**
     * 释放分布式锁
     * @param lockKey 锁的键值
     * @param ownerId 锁的持有者标识
     */
    public void releaseLock(String lockKey, String ownerId) {
        String sql = "DELETE FROM distributed_locks WHERE lock_key = ? AND owner_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, lockKey);
            stmt.setString(2, ownerId);
            stmt.executeUpdate();
        } catch (SQLException e) {
            // 记录日志，但不抛出异常
            System.err.println("Failed to release lock: " + e.getMessage());
        }
    }
    
    /**
     * 创建分布式锁表
     */
    public void createLockTable() {
        String sql = "CREATE TABLE IF NOT EXISTS distributed_locks (" +
                     "lock_key VARCHAR(128) PRIMARY KEY COMMENT '锁键', " +
                     "owner_id VARCHAR(128) NOT NULL COMMENT '锁持有者', " +
                     "expire_time TIMESTAMP NOT NULL COMMENT '过期时间', " +
                     "create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间' " +
                     ")";
        
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        } catch (SQLException e) {
            System.err.println("Failed to create distributed_locks table: " + e.getMessage());
        }
    }
}
```

### 创建分布式锁表

```sql
CREATE TABLE distributed_locks (
    lock_key VARCHAR(128) PRIMARY KEY COMMENT '锁键',
    owner_id VARCHAR(128) NOT NULL COMMENT '锁持有者',
    expire_time TIMESTAMP NOT NULL COMMENT '过期时间',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
);
```

## 执行日志与任务状态

在分布式调度系统中，详细的执行日志和准确的任务状态对于系统监控和问题排查至关重要。

### 任务执行器实现

我们实现一个任务执行器，负责执行具体的任务并记录执行日志：

```java
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class JobExecutor {
    private JobDao jobDao;
    private DatabaseDistributedLock distributedLock;
    private ExecutorService executorService;
    
    public JobExecutor(JobDao jobDao, DatabaseDistributedLock distributedLock) {
        this.jobDao = jobDao;
        this.distributedLock = distributedLock;
        this.executorService = Executors.newFixedThreadPool(10);
    }
    
    /**
     * 执行任务
     * @param job 任务信息
     * @param nodeId 节点ID
     */
    public CompletableFuture<JobExecutionLog> executeJob(Job job, String nodeId) {
        return CompletableFuture.supplyAsync(() -> {
            String lockKey = "job_lock_" + job.getId();
            JobExecutionLog log = new JobExecutionLog();
            log.setJobId(job.getId());
            log.setTriggerTime(LocalDateTime.now());
            log.setStatus(ExecutionStatus.TRIGGERED);
            
            try {
                // 尝试获取分布式锁，超时时间为300秒
                if (!distributedLock.tryLock(lockKey, nodeId, 300)) {
                    log.setStatus(ExecutionStatus.FAILED);
                    log.setErrorMessage("Failed to acquire distributed lock");
                    jobDao.saveExecutionLog(log);
                    return log;
                }
                
                log.setStatus(ExecutionStatus.RUNNING);
                log.setStartTime(LocalDateTime.now());
                jobDao.saveExecutionLog(log);
                
                // 执行任务
                executeJobLogic(job, log);
                
                log.setEndTime(LocalDateTime.now());
                log.setStatus(ExecutionStatus.SUCCESS);
            } catch (Exception e) {
                log.setEndTime(LocalDateTime.now());
                log.setStatus(ExecutionStatus.FAILED);
                log.setErrorMessage(e.getMessage());
                e.printStackTrace();
            } finally {
                // 释放分布式锁
                distributedLock.releaseLock(lockKey, nodeId);
                try {
                    jobDao.saveExecutionLog(log);
                } catch (SQLException e) {
                    System.err.println("Failed to save execution log: " + e.getMessage());
                }
            }
            
            return log;
        }, executorService);
    }
    
    /**
     * 执行具体的任务逻辑
     * @param job 任务信息
     * @param log 执行日志
     */
    private void executeJobLogic(Job job, JobExecutionLog log) {
        try {
            // 通过反射创建任务实例并执行
            Class<?> jobClass = Class.forName(job.getJobClass());
            Object jobInstance = jobClass.newInstance();
            
            if (jobInstance instanceof Runnable) {
                ((Runnable) jobInstance).run();
                log.setExecutionResult("Task executed successfully");
            } else {
                throw new IllegalArgumentException("Job class must implement Runnable");
            }
        } catch (Exception e) {
            log.setErrorMessage("Task execution failed: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
```

### 示例任务实现

我们创建一个简单的示例任务来演示任务执行：

```java
public class SampleJob implements Runnable {
    @Override
    public void run() {
        System.out.println("Sample job is running at: " + System.currentTimeMillis());
        
        // 模拟任务执行时间
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // 模拟随机失败
        if (Math.random() < 0.2) {
            throw new RuntimeException("Random failure for demonstration");
        }
        
        System.out.println("Sample job completed successfully");
    }
}
```

## 分布式调度器核心实现

基于以上组件，我们实现一个简单的分布式调度器：

```java
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class DistributedScheduler {
    private String nodeId;
    private JobDao jobDao;
    private JobExecutor jobExecutor;
    private DatabaseDistributedLock distributedLock;
    private ScheduledExecutorService scheduler;
    private volatile boolean running = false;
    
    public DistributedScheduler(JobDao jobDao, JobExecutor jobExecutor, DatabaseDistributedLock distributedLock) {
        this.nodeId = UUID.randomUUID().toString();
        this.jobDao = jobDao;
        this.jobExecutor = jobExecutor;
        this.distributedLock = distributedLock;
        this.scheduler = Executors.newScheduledThreadPool(2);
    }
    
    /**
     * 启动调度器
     */
    public void start() {
        if (running) {
            return;
        }
        
        running = true;
        
        // 启动心跳检测
        scheduler.scheduleAtFixedRate(this::heartbeat, 0, 30, TimeUnit.SECONDS);
        
        // 启动任务调度
        scheduler.scheduleAtFixedRate(this::scheduleJobs, 0, 60, TimeUnit.SECONDS);
        
        System.out.println("Distributed scheduler started with node ID: " + nodeId);
    }
    
    /**
     * 停止调度器
     */
    public void stop() {
        if (!running) {
            return;
        }
        
        running = false;
        scheduler.shutdown();
        
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("Distributed scheduler stopped");
    }
    
    /**
     * 心跳检测，更新节点状态
     */
    private void heartbeat() {
        // 这里可以实现节点心跳逻辑
        System.out.println("Node " + nodeId + " heartbeat at " + LocalDateTime.now());
    }
    
    /**
     * 调度任务
     */
    private void scheduleJobs() {
        if (!running) {
            return;
        }
        
        try {
            List<Job> activeJobs = jobDao.getAllActiveJobs();
            
            for (Job job : activeJobs) {
                // 这里应该解析Cron表达式并判断是否应该执行
                // 为简化实现，我们假设所有任务都应该执行
                jobExecutor.executeJob(job, nodeId);
            }
        } catch (SQLException e) {
            System.err.println("Failed to schedule jobs: " + e.getMessage());
        }
    }
    
    public static void main(String[] args) throws SQLException {
        // 初始化数据源（这里使用H2内存数据库作为示例）
        // 在实际应用中，应该使用真实的数据库连接池
        DataSource dataSource = setupDataSource();
        
        // 创建必要的表
        createTables(dataSource);
        
        // 初始化DAO和组件
        JobDao jobDao = new JobDao(dataSource);
        DatabaseDistributedLock lock = new DatabaseDistributedLock(dataSource);
        JobExecutor jobExecutor = new JobExecutor(jobDao, lock);
        
        // 创建示例任务
        Job sampleJob = new Job("sample-job-1", "Sample Job", "0 */5 * * * *", "SampleJob");
        jobDao.saveJob(sampleJob);
        
        // 启动调度器
        DistributedScheduler scheduler = new DistributedScheduler(jobDao, jobExecutor, lock);
        scheduler.start();
        
        // 运行一段时间后停止
        try {
            Thread.sleep(120000); // 运行2分钟
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        scheduler.stop();
    }
    
    private static DataSource setupDataSource() {
        // 这里应该配置真实的数据库连接池
        // 为示例简化，返回null
        return null;
    }
    
    private static void createTables(DataSource dataSource) {
        // 创建必要的数据库表
        // 实际实现中应该执行相应的DDL语句
    }
}
```

## 系统架构优化

虽然我们已经实现了一个基本的分布式调度器雏形，但仍有一些优化点需要考虑：

### 1. 节点发现与注册

在真正的分布式系统中，节点需要能够自动发现和注册：

```java
public class NodeRegistry {
    private JobDao jobDao;
    private String nodeId;
    private String host;
    private int port;
    
    public NodeRegistry(JobDao jobDao, String host, int port) {
        this.jobDao = jobDao;
        this.nodeId = UUID.randomUUID().toString();
        this.host = host;
        this.port = port;
    }
    
    public void registerNode() {
        // 注册当前节点
        // 实现节点注册逻辑
    }
    
    public void unregisterNode() {
        // 注销当前节点
        // 实现节点注销逻辑
    }
    
    public List<String> getActiveNodes() {
        // 获取所有活跃节点
        // 实现节点发现逻辑
        return new ArrayList<>();
    }
}
```

### 2. 负载均衡策略

为了合理分配任务负载，可以实现不同的负载均衡策略：

```java
public interface LoadBalanceStrategy {
    String selectNode(List<String> nodes, Job job);
}

public class RoundRobinLoadBalance implements LoadBalanceStrategy {
    private AtomicInteger counter = new AtomicInteger(0);
    
    @Override
    public String selectNode(List<String> nodes, Job job) {
        if (nodes.isEmpty()) {
            return null;
        }
        int index = counter.getAndIncrement() % nodes.size();
        return nodes.get(index);
    }
}
```

### 3. 故障检测与恢复

实现节点故障检测和任务恢复机制：

```java
public class FailureDetector {
    private JobDao jobDao;
    private long heartbeatTimeout = 60000; // 60秒
    
    public void detectFailures() {
        // 检测节点故障
        // 重新分配故障节点上的任务
    }
    
    public void recoverFailedTasks() {
        // 恢复失败的任务
        // 实现任务重试逻辑
    }
}
```

## 总结

通过本文的实践，我们构建了一个具备基本分布式特性的调度系统雏形。这个系统通过数据库存储任务信息，使用分布式锁保证任务的唯一执行，并记录详细的执行日志。

虽然这个雏形还远未达到生产级别的要求，但它展示了分布式调度系统的核心概念和实现要点：

1. **共享存储**：通过数据库实现任务信息的共享存储
2. **分布式协调**：使用分布式锁避免任务重复执行
3. **状态管理**：通过执行日志跟踪任务状态
4. **节点管理**：实现节点的注册、心跳和故障检测

在下一章中，我们将进一步完善这个调度系统，实现高可用性和扩展性设计，包括Leader选举、多节点容错和动态扩缩容等功能。

通过动手实践，我们不仅加深了对分布式调度系统工作原理的理解，也为后续学习成熟的分布式调度框架打下了坚实的基础。实际的生产级调度系统会更加复杂，需要考虑更多的细节和边界情况，但基本的设计思路是相通的。