---
title: 3.2 分布式锁保证任务唯一执行
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，确保任务在多个节点间唯一执行是一个关键问题。当同一个任务被多个调度节点同时触发时，可能会导致任务重复执行，从而引发数据不一致、资源浪费等问题。分布式锁作为一种重要的分布式协调机制，可以有效解决任务唯一执行的问题。本文将深入探讨分布式锁的实现原理，并详细介绍如何在任务调度系统中应用分布式锁来保证任务的唯一执行。

## 分布式锁的核心概念

分布式锁是在分布式系统中实现的一种锁机制，用于在多个节点间协调对共享资源的访问。与单机环境中的锁不同，分布式锁需要考虑网络延迟、节点故障、时钟漂移等分布式环境特有的问题。

### 分布式锁的基本要求

```java
// 分布式锁接口
public interface DistributedLock {
    /**
     * 获取锁
     * @param lockKey 锁的键
     * @param expireTime 过期时间(毫秒)
     * @return 是否获取成功
     */
    boolean lock(String lockKey, long expireTime);
    
    /**
     * 尝试获取锁
     * @param lockKey 锁的键
     * @param expireTime 过期时间(毫秒)
     * @param timeout 等待超时时间(毫秒)
     * @return 是否获取成功
     */
    boolean tryLock(String lockKey, long expireTime, long timeout);
    
    /**
     * 释放锁
     * @param lockKey 锁的键
     * @return 是否释放成功
     */
    boolean unlock(String lockKey);
    
    /**
     * 续期锁
     * @param lockKey 锁的键
     * @param expireTime 新的过期时间(毫秒)
     * @return 是否续期成功
     */
    boolean renew(String lockKey, long expireTime);
}

// 分布式锁的基本要求
public class DistributedLockRequirements {
    
    /*
     * 分布式锁需要满足的基本要求：
     * 1. 互斥性 - 同一时刻只有一个客户端能持有锁
     * 2. 安全性 - 锁只能被持有者释放
     * 3. 容错性 - 当节点故障时锁能够自动释放
     * 4. 可重入性 - 同一客户端可以重复获取锁
     * 5. 高性能 - 锁的获取和释放操作要快速
     * 6. 阻塞与非阻塞 - 支持阻塞等待和非阻塞获取
     * 7. 公平性 - 按照请求顺序获取锁(可选)
     */
    
    // 分布式锁与单机锁的对比
    public void compareWithLocalLock() {
        System.out.println("单机锁 vs 分布式锁:");
        System.out.println("单机锁: 速度快，但仅限于单个JVM");
        System.out.println("分布式锁: 跨节点协调，但有网络开销");
    }
}
```

### 分布式锁的实现方式

```java
// 基于数据库的分布式锁实现
public class DatabaseDistributedLock implements DistributedLock {
    private final DataSource dataSource;
    private final String nodeId;
    private final Map<String, LockInfo> heldLocks = new ConcurrentHashMap<>();
    
    public DatabaseDistributedLock(DataSource dataSource) {
        this.dataSource = dataSource;
        this.nodeId = UUID.randomUUID().toString();
    }
    
    @Override
    public boolean lock(String lockKey, long expireTime) {
        return tryLock(lockKey, expireTime, 0);
    }
    
    @Override
    public boolean tryLock(String lockKey, long expireTime, long timeout) {
        long startTime = System.currentTimeMillis();
        long endTime = startTime + timeout;
        
        while (true) {
            if (acquireLock(lockKey, expireTime)) {
                return true;
            }
            
            if (timeout <= 0 || System.currentTimeMillis() >= endTime) {
                return false;
            }
            
            // 短暂休眠后重试
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
    }
    
    @Override
    public boolean unlock(String lockKey) {
        String sql = "DELETE FROM distributed_locks WHERE lock_key = ? AND node_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, lockKey);
            stmt.setString(2, nodeId);
            
            int rows = stmt.executeUpdate();
            if (rows > 0) {
                heldLocks.remove(lockKey);
                return true;
            }
            return false;
        } catch (SQLException e) {
            throw new RuntimeException("释放锁失败", e);
        }
    }
    
    @Override
    public boolean renew(String lockKey, long expireTime) {
        String sql = "UPDATE distributed_locks SET expire_time = ? WHERE lock_key = ? AND node_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setTimestamp(1, new Timestamp(System.currentTimeMillis() + expireTime));
            stmt.setString(2, lockKey);
            stmt.setString(3, nodeId);
            
            int rows = stmt.executeUpdate();
            return rows > 0;
        } catch (SQLException e) {
            throw new RuntimeException("续期锁失败", e);
        }
    }
    
    // 获取锁
    private boolean acquireLock(String lockKey, long expireTime) {
        // 清理过期锁
        cleanupExpiredLocks();
        
        String sql = "INSERT IGNORE INTO distributed_locks (lock_key, node_id, acquire_time, expire_time) VALUES (?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, lockKey);
            stmt.setString(2, nodeId);
            stmt.setTimestamp(3, new Timestamp(System.currentTimeMillis()));
            stmt.setTimestamp(4, new Timestamp(System.currentTimeMillis() + expireTime));
            
            int rows = stmt.executeUpdate();
            if (rows > 0) {
                heldLocks.put(lockKey, new LockInfo(lockKey, expireTime));
                return true;
            }
            return false;
        } catch (SQLException e) {
            throw new RuntimeException("获取锁失败", e);
        }
    }
    
    // 清理过期锁
    private void cleanupExpiredLocks() {
        String sql = "DELETE FROM distributed_locks WHERE expire_time < ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setTimestamp(1, new Timestamp(System.currentTimeMillis()));
            stmt.executeUpdate();
        } catch (SQLException e) {
            // 忽略清理失败
        }
    }
    
    // 锁信息
    private static class LockInfo {
        private final String lockKey;
        private final long expireTime;
        private final long acquireTime;
        
        public LockInfo(String lockKey, long expireTime) {
            this.lockKey = lockKey;
            this.expireTime = expireTime;
            this.acquireTime = System.currentTimeMillis();
        }
        
        // Getters
        public String getLockKey() { return lockKey; }
        public long getExpireTime() { return expireTime; }
        public long getAcquireTime() { return acquireTime; }
    }
}

// 分布式锁表结构
/*
CREATE TABLE distributed_locks (
    lock_key VARCHAR(255) PRIMARY KEY COMMENT '锁的键',
    node_id VARCHAR(64) NOT NULL COMMENT '持有节点ID',
    acquire_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '获取时间',
    expire_time TIMESTAMP NOT NULL COMMENT '过期时间',
    INDEX idx_expire_time (expire_time)
) COMMENT='分布式锁表';
*/
```

## 基于Redis的分布式锁实现

Redis作为一种高性能的内存数据库，是实现分布式锁的常用选择。基于Redis的分布式锁具有高性能、低延迟的特点。

### Redis分布式锁核心实现

```java
// 基于Redis的分布式锁实现
public class RedisDistributedLock implements DistributedLock {
    private final JedisPool jedisPool;
    private final String nodeId;
    private final ScheduledExecutorService renewExecutor;
    private final Map<String, LockInfo> heldLocks = new ConcurrentHashMap<>();
    
    public RedisDistributedLock(JedisPool jedisPool) {
        this.jedisPool = jedisPool;
        this.nodeId = UUID.randomUUID().toString();
        this.renewExecutor = Executors.newScheduledThreadPool(2);
    }
    
    @Override
    public boolean lock(String lockKey, long expireTime) {
        return tryLock(lockKey, expireTime, 0);
    }
    
    @Override
    public boolean tryLock(String lockKey, long expireTime, long timeout) {
        long startTime = System.currentTimeMillis();
        long endTime = startTime + timeout;
        
        while (true) {
            if (acquireLock(lockKey, expireTime)) {
                return true;
            }
            
            if (timeout <= 0 || System.currentTimeMillis() >= endTime) {
                return false;
            }
            
            // 短暂休眠后重试
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
    }
    
    @Override
    public boolean unlock(String lockKey) {
        String script = 
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "  return redis.call('del', KEYS[1]) " +
            "else " +
            "  return 0 " +
            "end";
        
        try (Jedis jedis = jedisPool.getResource()) {
            Object result = jedis.eval(script, Collections.singletonList(lockKey), 
                                     Collections.singletonList(nodeId));
            boolean unlocked = "1".equals(result.toString());
            
            if (unlocked) {
                LockInfo lockInfo = heldLocks.remove(lockKey);
                if (lockInfo != null) {
                    lockInfo.cancelRenew();
                }
            }
            
            return unlocked;
        }
    }
    
    @Override
    public boolean renew(String lockKey, long expireTime) {
        String script = 
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "  return redis.call('expire', KEYS[1], ARGV[2]) " +
            "else " +
            "  return 0 " +
            "end";
        
        try (Jedis jedis = jedisPool.getResource()) {
            Object result = jedis.eval(script, Collections.singletonList(lockKey), 
                                     Arrays.asList(nodeId, String.valueOf(expireTime / 1000)));
            return "1".equals(result.toString());
        }
    }
    
    // 获取锁
    private boolean acquireLock(String lockKey, long expireTime) {
        try (Jedis jedis = jedisPool.getResource()) {
            String result = jedis.set(lockKey, nodeId, "NX", "PX", expireTime);
            boolean locked = "OK".equals(result);
            
            if (locked) {
                LockInfo lockInfo = new LockInfo(lockKey, expireTime);
                heldLocks.put(lockKey, lockInfo);
                
                // 启动自动续期
                lockInfo.scheduleRenew(this, renewExecutor);
            }
            
            return locked;
        }
    }
    
    // 锁信息
    private class LockInfo {
        private final String lockKey;
        private final long expireTime;
        private ScheduledFuture<?> renewTask;
        
        public LockInfo(String lockKey, long expireTime) {
            this.lockKey = lockKey;
            this.expireTime = expireTime;
        }
        
        // 调度续期任务
        public void scheduleRenew(RedisDistributedLock lock, ScheduledExecutorService executor) {
            // 在过期时间的一半时续期
            long renewPeriod = expireTime / 2;
            
            renewTask = executor.scheduleAtFixedRate(() -> {
                try {
                    lock.renew(lockKey, expireTime);
                } catch (Exception e) {
                    System.err.println("锁续期失败: " + lockKey + ", 错误: " + e.getMessage());
                }
            }, renewPeriod, renewPeriod, TimeUnit.MILLISECONDS);
        }
        
        // 取消续期任务
        public void cancelRenew() {
            if (renewTask != null && !renewTask.isCancelled()) {
                renewTask.cancel(false);
            }
        }
    }
}
```

### Redisson分布式锁实现

Redisson是一个Java开发的Redis客户端，提供了丰富的分布式对象和服务，包括高质量的分布式锁实现。

```java
// 基于Redisson的分布式锁实现
public class RedissonDistributedLock implements DistributedLock {
    private final RedissonClient redisson;
    
    public RedissonDistributedLock(RedissonClient redisson) {
        this.redisson = redisson;
    }
    
    @Override
    public boolean lock(String lockKey, long expireTime) {
        RLock lock = redisson.getLock(lockKey);
        try {
            lock.lock(expireTime, TimeUnit.MILLISECONDS);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public boolean tryLock(String lockKey, long expireTime, long timeout) {
        RLock lock = redisson.getLock(lockKey);
        try {
            return lock.tryLock(timeout, expireTime, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    @Override
    public boolean unlock(String lockKey) {
        RLock lock = redisson.getLock(lockKey);
        try {
            lock.unlock();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public boolean renew(String lockKey, long expireTime) {
        // Redisson自动处理锁续期，无需手动续期
        return true;
    }
}

// Redisson配置示例
class RedissonConfig {
    public RedissonClient createRedissonClient() {
        Config config = new Config();
        config.useSingleServer()
            .setAddress("redis://127.0.0.1:6379")
            .setPassword("password")
            .setDatabase(0);
        
        return Redisson.create(config);
    }
}
```

## 基于Zookeeper的分布式锁实现

Zookeeper是一个分布式的协调服务，提供了强一致性的保证，是实现分布式锁的另一种重要方式。

```java
// 基于Zookeeper的分布式锁实现
public class ZookeeperDistributedLock implements DistributedLock {
    private final CuratorFramework curator;
    private final String nodeId;
    private final Map<String, InterProcessMutex> heldLocks = new ConcurrentHashMap<>();
    
    public ZookeeperDistributedLock(CuratorFramework curator) {
        this.curator = curator;
        this.nodeId = UUID.randomUUID().toString();
    }
    
    @Override
    public boolean lock(String lockKey, long expireTime) {
        return tryLock(lockKey, expireTime, 0);
    }
    
    @Override
    public boolean tryLock(String lockKey, long expireTime, long timeout) {
        String lockPath = "/locks/" + lockKey;
        InterProcessMutex lock = new InterProcessMutex(curator, lockPath);
        
        try {
            boolean acquired;
            if (timeout <= 0) {
                lock.acquire();
                acquired = true;
            } else {
                acquired = lock.acquire(timeout, TimeUnit.MILLISECONDS);
            }
            
            if (acquired) {
                heldLocks.put(lockKey, lock);
            }
            
            return acquired;
        } catch (Exception e) {
            throw new RuntimeException("获取锁失败", e);
        }
    }
    
    @Override
    public boolean unlock(String lockKey) {
        InterProcessMutex lock = heldLocks.get(lockKey);
        if (lock == null) {
            return false;
        }
        
        try {
            lock.release();
            heldLocks.remove(lockKey);
            return true;
        } catch (Exception e) {
            throw new RuntimeException("释放锁失败", e);
        }
    }
    
    @Override
    public boolean renew(String lockKey, long expireTime) {
        // Zookeeper锁不需要手动续期
        return true;
    }
}

// Zookeeper配置示例
class ZookeeperConfig {
    public CuratorFramework createCuratorFramework() {
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "127.0.0.1:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        curator.start();
        return curator;
    }
}
```

## 任务调度中的分布式锁应用

在任务调度系统中，分布式锁主要用于确保任务的唯一执行。让我们看看如何在实际的任务调度器中应用分布式锁：

```java
// 基于分布式锁的任务调度器
public class DistributedTaskScheduler {
    private final TaskStore taskStore;
    private final TaskExecutor taskExecutor;
    private final DistributedLock distributedLock;
    private final ScheduledExecutorService scheduler;
    private volatile boolean isRunning = false;
    
    public DistributedTaskScheduler(TaskStore taskStore, 
                                  TaskExecutor taskExecutor,
                                  DistributedLock distributedLock) {
        this.taskStore = taskStore;
        this.taskExecutor = taskExecutor;
        this.distributedLock = distributedLock;
        this.scheduler = Executors.newScheduledThreadPool(5);
    }
    
    // 启动调度器
    public void start() {
        if (isRunning) {
            return;
        }
        
        isRunning = true;
        // 定期检查和执行任务
        scheduler.scheduleAtFixedRate(this::checkAndExecuteTasks, 0, 1, TimeUnit.SECONDS);
        System.out.println("分布式任务调度器已启动");
    }
    
    // 停止调度器
    public void shutdown() {
        if (!isRunning) {
            return;
        }
        
        isRunning = false;
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("分布式任务调度器已停止");
    }
    
    // 检查并执行任务
    private void checkAndExecuteTasks() {
        try {
            List<ScheduledTask> tasks = taskStore.getTasksToExecute(new Date());
            
            for (ScheduledTask task : tasks) {
                // 为每个任务生成唯一的锁键
                String lockKey = "task_lock:" + task.getTaskId();
                
                // 尝试获取分布式锁，超时时间1秒
                if (distributedLock.tryLock(lockKey, 60000, 1000)) {
                    try {
                        // 获取锁成功，执行任务
                        executeTask(task);
                    } finally {
                        // 释放锁
                        distributedLock.unlock(lockKey);
                    }
                } else {
                    // 获取锁失败，说明任务正在其他节点执行
                    System.out.println("任务正在其他节点执行: " + task.getTaskName());
                }
            }
        } catch (Exception e) {
            System.err.println("检查和执行任务时出错: " + e.getMessage());
        }
    }
    
    // 执行任务
    private void executeTask(ScheduledTask task) {
        try {
            // 更新任务状态为运行中
            taskStore.updateTaskStatus(task.getTaskId(), TaskStatus.RUNNING);
            
            // 执行任务
            long startTime = System.currentTimeMillis();
            TaskExecutionResult result = taskExecutor.execute(task);
            long executionTime = System.currentTimeMillis() - startTime;
            
            // 记录执行日志
            TaskExecutionLog log = new TaskExecutionLog();
            log.setTaskId(task.getTaskId());
            log.setTaskName(task.getTaskName());
            log.setExecuteTime(new Date(startTime));
            log.setExecutionTime(executionTime);
            log.setSuccess(result.isSuccess());
            log.setMessage(result.getMessage());
            log.setErrorMessage(result.isSuccess() ? null : result.getMessage());
            
            // 更新任务信息
            task.setLastExecuteTime(new Date(startTime));
            task.setExecuteCount(task.getExecuteCount() + 1);
            if (result.isSuccess()) {
                task.setStatus(TaskStatus.PENDING);
                task.setLastErrorMessage(null);
            } else {
                task.setStatus(TaskStatus.FAILED);
                task.setFailCount(task.getFailCount() + 1);
                task.setLastErrorMessage(result.getMessage());
            }
            task.setUpdateTime(new Date());
            
            // 保存更新
            taskStore.saveTask(task);
            
            System.out.println("任务执行完成: " + task.getTaskName() + 
                             ", 结果: " + (result.isSuccess() ? "成功" : "失败") + 
                             ", 耗时: " + executionTime + "ms");
        } catch (Exception e) {
            // 更新任务失败状态
            task.setStatus(TaskStatus.FAILED);
            task.setFailCount(task.getFailCount() + 1);
            task.setLastErrorMessage(e.getMessage());
            task.setUpdateTime(new Date());
            taskStore.saveTask(task);
            
            System.err.println("任务执行异常: " + task.getTaskName() + ", 错误: " + e.getMessage());
        }
    }
}

// 任务执行器接口
interface TaskExecutor {
    TaskExecutionResult execute(ScheduledTask task);
}

// 任务执行结果
class TaskExecutionResult {
    private final boolean success;
    private final String message;
    private final Object result;
    private final long executionTime;
    
    public TaskExecutionResult(boolean success, String message, Object result, long executionTime) {
        this.success = success;
        this.message = message;
        this.result = result;
        this.executionTime = executionTime;
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Object getResult() { return result; }
    public long getExecutionTime() { return executionTime; }
}
```

## 分布式锁的监控与管理

在生产环境中，我们需要对分布式锁进行监控和管理，以便及时发现和解决问题。

```java
// 分布式锁监控服务
public class DistributedLockMonitor {
    private final DataSource dataSource;
    private final ScheduledExecutorService monitorScheduler;
    private final AlertService alertService;
    
    public DistributedLockMonitor(DataSource dataSource, AlertService alertService) {
        this.dataSource = dataSource;
        this.alertService = alertService;
        this.monitorScheduler = Executors.newScheduledThreadPool(1);
    }
    
    // 启动监控
    public void start() {
        monitorScheduler.scheduleAtFixedRate(this::monitorLocks, 30, 30, TimeUnit.SECONDS);
        System.out.println("分布式锁监控已启动");
    }
    
    // 停止监控
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
        System.out.println("分布式锁监控已停止");
    }
    
    // 监控锁状态
    private void monitorLocks() {
        try {
            List<LockInfo> lockInfos = getLockInfos();
            
            // 检查过期锁
            checkExpiredLocks(lockInfos);
            
            // 检查长时间持有的锁
            checkLongHeldLocks(lockInfos);
            
            // 输出锁统计信息
            printLockStatistics(lockInfos);
        } catch (Exception e) {
            System.err.println("监控锁状态时出错: " + e.getMessage());
        }
    }
    
    // 获取锁信息
    private List<LockInfo> getLockInfos() {
        String sql = "SELECT lock_key, node_id, acquire_time, expire_time FROM distributed_locks";
        List<LockInfo> lockInfos = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            
            while (rs.next()) {
                LockInfo info = new LockInfo();
                info.setLockKey(rs.getString("lock_key"));
                info.setNodeId(rs.getString("node_id"));
                info.setAcquireTime(rs.getTimestamp("acquire_time"));
                info.setExpireTime(rs.getTimestamp("expire_time"));
                lockInfos.add(info);
            }
        } catch (SQLException e) {
            throw new RuntimeException("获取锁信息失败", e);
        }
        
        return lockInfos;
    }
    
    // 检查过期锁
    private void checkExpiredLocks(List<LockInfo> lockInfos) {
        Date now = new Date();
        long expiredCount = lockInfos.stream()
            .filter(info -> info.getExpireTime().before(now))
            .count();
        
        if (expiredCount > 0) {
            alertService.sendAlert(AlertLevel.WARNING, "EXPIRED_LOCKS", 
                "发现" + expiredCount + "个过期锁");
        }
    }
    
    // 检查长时间持有的锁
    private void checkLongHeldLocks(List<LockInfo> lockInfos) {
        Date now = new Date();
        long oneHourAgo = now.getTime() - 3600000; // 1小时前
        
        long longHeldCount = lockInfos.stream()
            .filter(info -> info.getAcquireTime().getTime() < oneHourAgo)
            .count();
        
        if (longHeldCount > 0) {
            alertService.sendAlert(AlertLevel.WARNING, "LONG_HELD_LOCKS", 
                "发现" + longHeldCount + "个长时间持有的锁");
        }
    }
    
    // 输出锁统计信息
    private void printLockStatistics(List<LockInfo> lockInfos) {
        Map<String, Long> nodeLockCounts = lockInfos.stream()
            .collect(Collectors.groupingBy(LockInfo::getNodeId, Collectors.counting()));
        
        System.out.println("=== 分布式锁统计 ===");
        System.out.println("总锁数: " + lockInfos.size());
        System.out.println("节点锁分布:");
        nodeLockCounts.forEach((nodeId, count) -> 
            System.out.println("  节点 " + nodeId + ": " + count + " 个锁"));
    }
    
    // 锁信息实体类
    private static class LockInfo {
        private String lockKey;
        private String nodeId;
        private Date acquireTime;
        private Date expireTime;
        
        // Getters and Setters
        public String getLockKey() { return lockKey; }
        public void setLockKey(String lockKey) { this.lockKey = lockKey; }
        
        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        
        public Date getAcquireTime() { return acquireTime; }
        public void setAcquireTime(Date acquireTime) { this.acquireTime = acquireTime; }
        
        public Date getExpireTime() { return expireTime; }
        public void setExpireTime(Date expireTime) { this.expireTime = expireTime; }
    }
}

// 告警服务
class AlertService {
    public void sendAlert(AlertLevel level, String type, String message) {
        System.out.println("[" + level + "] " + type + ": " + message);
        // 实际应用中可以发送邮件、短信等告警
    }
}

// 告警级别
enum AlertLevel {
    INFO, WARNING, ERROR, CRITICAL
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用分布式锁保证任务的唯一执行：

```java
// 分布式锁使用示例
public class DistributedLockExample {
    public static void main(String[] args) {
        try {
            // 配置数据源
            DataSourceConfig config = new DataSourceConfig(
                "jdbc:mysql://localhost:3306/scheduler?useSSL=false&serverTimezone=UTC",
                "scheduler_user",
                "scheduler_password"
            );
            DataSource dataSource = config.createDataSource();
            
            // 创建分布式锁
            DistributedLock distributedLock = new DatabaseDistributedLock(dataSource);
            
            // 创建任务调度器
            TaskStore taskStore = new DatabaseTaskStore(/* DAOs */);
            TaskExecutor taskExecutor = new SimpleTaskExecutor();
            DistributedTaskScheduler scheduler = new DistributedTaskScheduler(
                taskStore, taskExecutor, distributedLock);
            
            // 启动调度器
            scheduler.start();
            
            // 模拟运行一段时间
            Thread.sleep(60000);
            
            // 停止调度器
            scheduler.shutdown();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

// 简单任务执行器实现
class SimpleTaskExecutor implements TaskExecutor {
    @Override
    public TaskExecutionResult execute(ScheduledTask task) {
        try {
            System.out.println("开始执行任务: " + task.getTaskName());
            
            // 模拟任务执行
            Thread.sleep(3000);
            
            System.out.println("任务执行完成: " + task.getTaskName());
            return new TaskExecutionResult(true, "任务执行成功", null, 3000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new TaskExecutionResult(false, "任务被中断", null, 0);
        } catch (Exception e) {
            return new TaskExecutionResult(false, "任务执行异常: " + e.getMessage(), null, 0);
        }
    }
}

// 多节点并发测试
class MultiNodeConcurrencyTest {
    public static void testConcurrentExecution() {
        // 模拟多个节点同时执行相同任务
        ExecutorService executor = Executors.newFixedThreadPool(3);
        
        for (int i = 0; i < 3; i++) {
            final int nodeId = i;
            executor.submit(() -> {
                try {
                    // 配置数据源
                    DataSourceConfig config = new DataSourceConfig(
                        "jdbc:mysql://localhost:3306/scheduler?useSSL=false&serverTimezone=UTC",
                        "scheduler_user",
                        "scheduler_password"
                    );
                    DataSource dataSource = config.createDataSource();
                    
                    // 创建分布式锁
                    DistributedLock distributedLock = new DatabaseDistributedLock(dataSource);
                    
                    // 尝试获取任务锁
                    String lockKey = "task_lock:backup_task_001";
                    if (distributedLock.tryLock(lockKey, 10000, 1000)) {
                        try {
                            System.out.println("节点" + nodeId + "获取锁成功，开始执行任务");
                            
                            // 模拟任务执行
                            Thread.sleep(5000);
                            
                            System.out.println("节点" + nodeId + "任务执行完成");
                        } finally {
                            distributedLock.unlock(lockKey);
                            System.out.println("节点" + nodeId + "释放锁");
                        }
                    } else {
                        System.out.println("节点" + nodeId + "获取锁失败，任务正在执行中");
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }
        
        executor.shutdown();
        try {
            executor.awaitTermination(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 最佳实践与注意事项

在实际应用分布式锁时，需要注意以下最佳实践：

```java
// 分布式锁最佳实践
public class DistributedLockBestPractices {
    
    // 1. 锁粒度控制
    public void lockGranularity() {
        System.out.println("锁粒度最佳实践:");
        System.out.println("1. 锁的粒度要适中，过粗影响并发，过细增加管理复杂度");
        System.out.println("2. 对于任务调度，建议以任务ID为锁粒度");
        System.out.println("3. 避免使用全局锁");
    }
    
    // 2. 锁超时设置
    public void lockTimeout() {
        System.out.println("锁超时设置:");
        System.out.println("1. 设置合理的锁超时时间，避免死锁");
        System.out.println("2. 根据任务执行时间预估超时时间");
        System.out.println("3. 实现锁自动续期机制");
    }
    
    // 3. 异常处理
    public void exceptionHandling() {
        System.out.println("异常处理:");
        System.out.println("1. 确保在finally块中释放锁");
        System.out.println("2. 处理网络异常和节点故障");
        System.out.println("3. 实现锁的自动清理机制");
    }
    
    // 4. 性能优化
    public void performanceOptimization() {
        System.out.println("性能优化:");
        System.out.println("1. 使用连接池管理数据库连接");
        System.out.println("2. 合理设置锁的过期时间");
        System.out.println("3. 避免长时间持有锁");
        System.out.println("4. 使用缓存减少锁竞争");
    }
    
    // 5. 监控告警
    public void monitoringAlerting() {
        System.out.println("监控告警:");
        System.out.println("1. 监控锁的获取和释放情况");
        System.out.println("2. 监控锁的持有时间");
        System.out.println("3. 设置锁竞争告警");
        System.out.println("4. 记录锁操作日志");
    }
}
```

## 总结

通过本文的实现，我们深入了解了分布式锁的实现原理和应用方式：

1. **核心概念**：分布式锁需要满足互斥性、安全性、容错性等基本要求
2. **实现方式**：基于数据库、Redis、Zookeeper等多种实现方式各有优劣
3. **应用场景**：在任务调度系统中用于保证任务的唯一执行
4. **监控管理**：需要完善的监控和告警机制确保系统稳定运行
5. **最佳实践**：合理的锁粒度、超时设置、异常处理等

分布式锁是构建高可用分布式任务调度系统的关键技术之一。在实际应用中，需要根据具体的业务场景和技术栈选择合适的实现方式，并遵循最佳实践来确保系统的稳定性和可靠性。

在下一节中，我们将探讨执行日志与任务状态管理，进一步完善分布式调度系统的监控和管理能力。