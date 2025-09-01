---
title: 4.4 分布式调度系统的性能优化策略与实践
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

随着业务规模的不断扩大，分布式任务调度系统面临着越来越大的性能挑战。如何在保证系统高可用性和可靠性的前提下，提升系统的处理能力和响应速度，成为架构师和开发者必须解决的关键问题。本文将深入探讨分布式调度系统的性能优化策略，包括架构优化、算法优化、资源优化等多个维度，并结合实际案例分享优化实践经验。

## 性能优化的核心概念

性能优化是提升系统处理能力和用户体验的重要手段。理解其核心概念对于制定有效的优化策略至关重要。

### 性能指标与评估

```java
// 性能指标与评估体系
public class PerformanceMetrics {
    
    /*
     * 分布式调度系统的核心性能指标：
     * 1. 吞吐量 - 单位时间内处理的任务数量
     * 2. 响应时间 - 任务从提交到开始执行的时间
     * 3. 并发能力 - 系统同时处理的任务数量
     * 4. 资源利用率 - CPU、内存、网络等资源的使用效率
     * 5. 扩展性 - 系统随节点增加性能提升的能力
     */
    
    // 性能指标定义
    public class MetricsDefinition {
        private long throughput;           // 吞吐量（任务/秒）
        private long responseTime;         // 响应时间（毫秒）
        private int concurrency;           // 并发数
        private double cpuUsage;           // CPU使用率
        private long memoryUsage;          // 内存使用量
        private long networkLatency;       // 网络延迟
        private double scalability;        // 扩展性系数
        
        // 计算扩展性系数
        public double calculateScalability(int nodeCount, long baselineThroughput) {
            if (nodeCount <= 1 || baselineThroughput <= 0) {
                return 0;
            }
            return (double) throughput / (baselineThroughput * nodeCount);
        }
        
        // 性能评估
        public PerformanceEvaluation evaluate() {
            PerformanceEvaluation evaluation = new PerformanceEvaluation();
            
            // 吞吐量评估
            if (throughput > 1000) {
                evaluation.setThroughputRating(PerformanceRating.EXCELLENT);
            } else if (throughput > 500) {
                evaluation.setThroughputRating(PerformanceRating.GOOD);
            } else if (throughput > 100) {
                evaluation.setThroughputRating(PerformanceRating.FAIR);
            } else {
                evaluation.setThroughputRating(PerformanceRating.POOR);
            }
            
            // 响应时间评估
            if (responseTime < 100) {
                evaluation.setResponseTimeRating(PerformanceRating.EXCELLENT);
            } else if (responseTime < 500) {
                evaluation.setResponseTimeRating(PerformanceRating.GOOD);
            } else if (responseTime < 1000) {
                evaluation.setResponseTimeRating(PerformanceRating.FAIR);
            } else {
                evaluation.setResponseTimeRating(PerformanceRating.POOR);
            }
            
            // CPU使用率评估
            if (cpuUsage < 50) {
                evaluation.setCpuUsageRating(PerformanceRating.EXCELLENT);
            } else if (cpuUsage < 70) {
                evaluation.setCpuUsageRating(PerformanceRating.GOOD);
            } else if (cpuUsage < 85) {
                evaluation.setCpuUsageRating(PerformanceRating.FAIR);
            } else {
                evaluation.setCpuUsageRating(PerformanceRating.POOR);
            }
            
            return evaluation;
        }
        
        // Getters and Setters
        public long getThroughput() { return throughput; }
        public void setThroughput(long throughput) { this.throughput = throughput; }
        
        public long getResponseTime() { return responseTime; }
        public void setResponseTime(long responseTime) { this.responseTime = responseTime; }
        
        public int getConcurrency() { return concurrency; }
        public void setConcurrency(int concurrency) { this.concurrency = concurrency; }
        
        public double getCpuUsage() { return cpuUsage; }
        public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
        
        public long getMemoryUsage() { return memoryUsage; }
        public void setMemoryUsage(long memoryUsage) { this.memoryUsage = memoryUsage; }
        
        public long getNetworkLatency() { return networkLatency; }
        public void setNetworkLatency(long networkLatency) { this.networkLatency = networkLatency; }
        
        public double getScalability() { return scalability; }
        public void setScalability(double scalability) { this.scalability = scalability; }
    }
    
    // 性能评级枚举
    public enum PerformanceRating {
        EXCELLENT("优秀"),   // 优秀
        GOOD("良好"),       // 良好
        FAIR("一般"),       // 一般
        POOR("较差");       // 较差
        
        private final String description;
        
        PerformanceRating(String description) {
            this.description = description;
        }
        
        public String getDescription() { return description; }
    }
    
    // 性能评估结果
    public class PerformanceEvaluation {
        private PerformanceRating throughputRating;
        private PerformanceRating responseTimeRating;
        private PerformanceRating cpuUsageRating;
        private String recommendations;
        
        // 生成优化建议
        public String generateRecommendations() {
            StringBuilder sb = new StringBuilder();
            sb.append("性能优化建议:\n");
            
            if (throughputRating == PerformanceRating.POOR) {
                sb.append("1. 提升吞吐量：增加执行节点、优化任务分片策略\n");
            }
            
            if (responseTimeRating == PerformanceRating.POOR) {
                sb.append("2. 降低响应时间：优化调度算法、减少网络延迟\n");
            }
            
            if (cpuUsageRating == PerformanceRating.POOR) {
                sb.append("3. 优化CPU使用：任务负载均衡、减少不必要的计算\n");
            }
            
            return sb.toString();
        }
        
        // Getters and Setters
        public PerformanceRating getThroughputRating() { return throughputRating; }
        public void setThroughputRating(PerformanceRating throughputRating) { this.throughputRating = throughputRating; }
        
        public PerformanceRating getResponseTimeRating() { return responseTimeRating; }
        public void setResponseTimeRating(PerformanceRating responseTimeRating) { this.responseTimeRating = responseTimeRating; }
        
        public PerformanceRating getCpuUsageRating() { return cpuUsageRating; }
        public void setCpuUsageRating(PerformanceRating cpuUsageRating) { this.cpuUsageRating = cpuUsageRating; }
        
        public String getRecommendations() { return recommendations; }
        public void setRecommendations(String recommendations) { this.recommendations = recommendations; }
    }
}
```

### 性能优化原则

```java
// 性能优化原则
public class OptimizationPrinciples {
    
    /*
     * 性能优化的核心原则：
     * 1. 数据驱动 - 基于实际性能数据进行优化
     * 2. 瓶颈优先 - 优先解决系统瓶颈问题
     * 3. 渐进优化 - 逐步实施优化措施
     * 4. 成本效益 - 权衡优化成本与收益
     * 5. 可持续性 - 建立持续优化机制
     */
    
    // 优化策略分类
    public class OptimizationStrategies {
        
        // 架构优化
        public void architectureOptimization() {
            System.out.println("架构优化策略:");
            System.out.println("1. 微服务拆分 - 将大服务拆分为小服务");
            System.out.println("2. 读写分离 - 分离读写操作");
            System.out.println("3. 缓存策略 - 合理使用缓存");
            System.out.println("4. 异步处理 - 非核心操作异步化");
        }
        
        // 算法优化
        public void algorithmOptimization() {
            System.out.println("算法优化策略:");
            System.out.println("1. 时间复杂度优化 - 选择更高效的算法");
            System.out.println("2. 空间复杂度优化 - 减少内存占用");
            System.out.println("3. 并行计算 - 利用多核处理器");
            System.out.println("4. 数据结构优化 - 选择合适的数据结构");
        }
        
        // 资源优化
        public void resourceOptimization() {
            System.out.println("资源优化策略:");
            System.out.println("1. CPU优化 - 减少CPU密集型操作");
            System.out.println("2. 内存优化 - 避免内存泄漏");
            System.out.println("3. 网络优化 - 减少网络传输");
            System.out.println("4. 存储优化 - 优化数据库查询");
        }
        
        // 配置优化
        public void configurationOptimization() {
            System.out.println("配置优化策略:");
            System.out.println("1. JVM调优 - 优化堆内存和GC策略");
            System.out.println("2. 线程池调优 - 合理配置线程池参数");
            System.out.println("3. 数据库调优 - 优化连接池和查询");
            System.out.println("4. 网络调优 - 调整TCP参数");
        }
    }
    
    // 性能优化流程
    public class OptimizationProcess {
        
        // 性能分析步骤
        public void performanceAnalysisSteps() {
            System.out.println("性能分析步骤:");
            System.out.println("1. 确定性能目标 - 明确优化目标");
            System.out.println("2. 性能基准测试 - 建立基准性能数据");
            System.out.println("3. 瓶颈识别 - 找出性能瓶颈");
            System.out.println("4. 优化方案设计 - 制定优化方案");
            System.out.println("5. 方案实施 - 实施优化措施");
            System.out.println("6. 效果验证 - 验证优化效果");
            System.out.println("7. 持续监控 - 建立持续监控机制");
        }
        
        // 性能测试工具
        public void performanceTestingTools() {
            System.out.println("性能测试工具:");
            System.out.println("1. JMH - Java微基准测试工具");
            System.out.println("2. JProfiler - Java性能分析工具");
            System.out.println("3. VisualVM - JVM监控工具");
            System.out.println("4. Grafana - 监控可视化工具");
            System.out.println("5. Prometheus - 监控数据收集工具");
        }
    }
}
```

## 架构层面的性能优化

架构层面的优化是性能提升的基础，通过合理的架构设计可以显著提高系统的处理能力。

### 微服务架构优化

```java
// 微服务架构优化
public class MicroserviceArchitectureOptimization {
    
    // 服务拆分策略
    public class ServiceDecomposition {
        
        // 按业务领域拆分
        public void domainBasedDecomposition() {
            System.out.println("按业务领域拆分服务:");
            System.out.println("1. 调度服务 - 负责任务调度和管理");
            System.out.println("2. 执行服务 - 负责任务执行");
            System.out.println("3. 存储服务 - 负责数据存储");
            System.out.println("4. 监控服务 - 负责系统监控");
            System.out.println("5. 通知服务 - 负责告警通知");
        }
        
        // 按数据访问模式拆分
        public void dataAccessBasedDecomposition() {
            System.out.println("按数据访问模式拆分服务:");
            System.out.println("1. 读服务 - 专门处理读操作");
            System.out.println("2. 写服务 - 专门处理写操作");
            System.out.println("3. 计算服务 - 专门处理计算密集型操作");
            System.out.println("4. 文件服务 - 专门处理文件操作");
        }
        
        // 服务间通信优化
        public void interServiceCommunicationOptimization() {
            System.out.println("服务间通信优化:");
            System.out.println("1. 使用异步通信 - 减少等待时间");
            System.out.println("2. 批量处理 - 合并多个请求");
            System.out.println("3. 消息队列 - 解耦服务间依赖");
            System.out.println("4. 缓存共享 - 减少重复计算");
        }
    }
    
    // 服务治理优化
    public class ServiceGovernanceOptimization {
        
        // 负载均衡优化
        public void loadBalancingOptimization() {
            System.out.println("负载均衡优化:");
            System.out.println("1. 智能路由 - 根据节点负载选择");
            System.out.println("2. 熔断机制 - 防止故障扩散");
            System.out.println("3. 限流控制 - 控制请求流量");
            System.out.println("4. 重试机制 - 提高请求成功率");
        }
        
        // 服务发现优化
        public void serviceDiscoveryOptimization() {
            System.out.println("服务发现优化:");
            System.out.println("1. 多级缓存 - 减少注册中心压力");
            System.out.println("2. 健康检查 - 及时剔除不健康节点");
            System.out.println("3. 快速故障转移 - 提高可用性");
            System.out.println("4. 地理位置感知 - 选择就近服务");
        }
    }
}
```

### 缓存策略优化

```java
// 缓存策略优化
public class CacheStrategyOptimization {
    
    // 多级缓存架构
    public class MultiLevelCache {
        private final L1Cache l1Cache;    // 一级缓存（本地缓存）
        private final L2Cache l2Cache;    // 二级缓存（分布式缓存）
        private final CacheStats cacheStats; // 缓存统计
        
        public MultiLevelCache() {
            this.l1Cache = new L1Cache();
            this.l2Cache = new L2Cache();
            this.cacheStats = new CacheStats();
        }
        
        // 获取数据
        public Object get(String key) {
            // 先查一级缓存
            Object value = l1Cache.get(key);
            if (value != null) {
                cacheStats.incrementL1Hit();
                return value;
            }
            
            // 再查二级缓存
            value = l2Cache.get(key);
            if (value != null) {
                cacheStats.incrementL2Hit();
                // 回填一级缓存
                l1Cache.put(key, value);
                return value;
            }
            
            // 缓存未命中
            cacheStats.incrementMiss();
            return null;
        }
        
        // 存储数据
        public void put(String key, Object value) {
            // 同时存储到两级缓存
            l1Cache.put(key, value);
            l2Cache.put(key, value);
            cacheStats.incrementPut();
        }
        
        // 删除数据
        public void remove(String key) {
            l1Cache.remove(key);
            l2Cache.remove(key);
            cacheStats.incrementRemove();
        }
        
        // 获取缓存统计
        public CacheStats getCacheStats() {
            return cacheStats;
        }
    }
    
    // 一级缓存（本地缓存）
    public class L1Cache {
        private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
        private final int maxSize;
        private final long expireTime;
        
        public L1Cache() {
            this.maxSize = 1000;
            this.expireTime = 300000; // 5分钟
        }
        
        public Object get(String key) {
            CacheEntry entry = cache.get(key);
            if (entry != null) {
                if (System.currentTimeMillis() - entry.getCreateTime() < expireTime) {
                    return entry.getValue();
                } else {
                    // 过期，删除
                    cache.remove(key);
                }
            }
            return null;
        }
        
        public void put(String key, Object value) {
            // 检查缓存大小，如果超过限制则清理
            if (cache.size() >= maxSize) {
                cleanupExpiredEntries();
            }
            
            cache.put(key, new CacheEntry(value));
        }
        
        public void remove(String key) {
            cache.remove(key);
        }
        
        // 清理过期条目
        private void cleanupExpiredEntries() {
            long currentTime = System.currentTimeMillis();
            Iterator<Map.Entry<String, CacheEntry>> iterator = cache.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, CacheEntry> entry = iterator.next();
                if (currentTime - entry.getValue().getCreateTime() >= expireTime) {
                    iterator.remove();
                }
            }
        }
    }
    
    // 二级缓存（分布式缓存）
    public class L2Cache {
        private final RedisClient redisClient;
        
        public L2Cache() {
            // 初始化 Redis 客户端
            this.redisClient = RedisClient.create("redis://localhost:6379");
        }
        
        public Object get(String key) {
            try (StatefulRedisConnection<String, String> connection = redisClient.connect()) {
                RedisStringCommands<String, String> sync = connection.sync();
                String value = sync.get(key);
                return value != null ? deserialize(value) : null;
            } catch (Exception e) {
                System.err.println("获取二级缓存数据失败: " + e.getMessage());
                return null;
            }
        }
        
        public void put(String key, Object value) {
            try (StatefulRedisConnection<String, String> connection = redisClient.connect()) {
                RedisStringCommands<String, String> sync = connection.sync();
                sync.setex(key, 600, serialize(value)); // 10分钟过期
            } catch (Exception e) {
                System.err.println("存储二级缓存数据失败: " + e.getMessage());
            }
        }
        
        public void remove(String key) {
            try (StatefulRedisConnection<String, String> connection = redisClient.connect()) {
                RedisStringCommands<String, String> sync = connection.sync();
                sync.del(key);
            } catch (Exception e) {
                System.err.println("删除二级缓存数据失败: " + e.getMessage());
            }
        }
        
        // 序列化对象
        private String serialize(Object obj) {
            try {
                return Base64.getEncoder().encodeToString(
                    SerializationUtils.serialize(obj));
            } catch (Exception e) {
                throw new RuntimeException("序列化失败", e);
            }
        }
        
        // 反序列化对象
        private Object deserialize(String str) {
            try {
                return SerializationUtils.deserialize(
                    Base64.getDecoder().decode(str));
            } catch (Exception e) {
                throw new RuntimeException("反序列化失败", e);
            }
        }
    }
    
    // 缓存条目
    public class CacheEntry {
        private final Object value;
        private final long createTime;
        
        public CacheEntry(Object value) {
            this.value = value;
            this.createTime = System.currentTimeMillis();
        }
        
        public Object getValue() { return value; }
        public long getCreateTime() { return createTime; }
    }
    
    // 缓存统计
    public class CacheStats {
        private final AtomicLong l1Hit = new AtomicLong(0);
        private final AtomicLong l2Hit = new AtomicLong(0);
        private final AtomicLong miss = new AtomicLong(0);
        private final AtomicLong put = new AtomicLong(0);
        private final AtomicLong remove = new AtomicLong(0);
        
        // 计算命中率
        public double calculateHitRate() {
            long total = l1Hit.get() + l2Hit.get() + miss.get();
            if (total == 0) return 0;
            return (double) (l1Hit.get() + l2Hit.get()) / total * 100;
        }
        
        // Getters and Setters
        public long getL1Hit() { return l1Hit.get(); }
        public void incrementL1Hit() { l1Hit.incrementAndGet(); }
        
        public long getL2Hit() { return l2Hit.get(); }
        public void incrementL2Hit() { l2Hit.incrementAndGet(); }
        
        public long getMiss() { return miss.get(); }
        public void incrementMiss() { miss.incrementAndGet(); }
        
        public long getPut() { return put.get(); }
        public void incrementPut() { put.incrementAndGet(); }
        
        public long getRemove() { return remove.get(); }
        public void incrementRemove() { remove.incrementAndGet(); }
    }
}
```

## 算法层面的性能优化

算法优化是提升系统性能的关键手段，通过优化核心算法可以显著提高处理效率。

### 任务调度算法优化

```java
// 任务调度算法优化
public class TaskSchedulingAlgorithmOptimization {
    
    // 高效的任务队列实现
    public class EfficientTaskQueue {
        private final PriorityQueue<ScheduledTask> taskQueue;
        private final Map<String, ScheduledTask> taskMap;
        private final ReentrantReadWriteLock lock;
        
        public EfficientTaskQueue() {
            // 使用基于下次执行时间的优先队列
            this.taskQueue = new PriorityQueue<>(
                Comparator.comparing(ScheduledTask::getNextExecuteTime));
            this.taskMap = new ConcurrentHashMap<>();
            this.lock = new ReentrantReadWriteLock();
        }
        
        // 添加任务
        public boolean addTask(ScheduledTask task) {
            lock.writeLock().lock();
            try {
                if (taskMap.containsKey(task.getTaskId())) {
                    return false; // 任务已存在
                }
                
                taskQueue.offer(task);
                taskMap.put(task.getTaskId(), task);
                return true;
            } finally {
                lock.writeLock().unlock();
            }
        }
        
        // 删除任务
        public boolean removeTask(String taskId) {
            lock.writeLock().lock();
            try {
                ScheduledTask task = taskMap.remove(taskId);
                if (task != null) {
                    // 从队列中移除（需要遍历，性能较差）
                    taskQueue.remove(task);
                    return true;
                }
                return false;
            } finally {
                lock.writeLock().unlock();
            }
        }
        
        // 获取下一个要执行的任务
        public ScheduledTask getNextTask() {
            lock.readLock().lock();
            try {
                return taskQueue.peek();
            } finally {
                lock.readLock().unlock();
            }
        }
        
        // 弹出下一个要执行的任务
        public ScheduledTask pollNextTask() {
            lock.writeLock().lock();
            try {
                ScheduledTask task = taskQueue.poll();
                if (task != null) {
                    taskMap.remove(task.getTaskId());
                }
                return task;
            } finally {
                lock.writeLock().unlock();
            }
        }
        
        // 获取任务数量
        public int size() {
            lock.readLock().lock();
            try {
                return taskQueue.size();
            } finally {
                lock.readLock().unlock();
            }
        }
        
        // 检查任务是否存在
        public boolean containsTask(String taskId) {
            lock.readLock().lock();
            try {
                return taskMap.containsKey(taskId);
            } finally {
                lock.readLock().unlock();
            }
        }
    }
    
    // 基于时间轮的任务调度器
    public class TimingWheelScheduler {
        private final TimingWheel[] timingWheels;
        private final int[] wheelSizes;
        private final long tickDuration;
        private final ScheduledExecutorService scheduler;
        private volatile long currentTime;
        
        public TimingWheelScheduler() {
            this.tickDuration = 1000; // 1秒
            this.wheelSizes = new int[]{60, 60, 24, 7}; // 秒、分、时、天
            this.timingWheels = new TimingWheel[wheelSizes.length];
            
            // 初始化时间轮
            for (int i = 0; i < wheelSizes.length; i++) {
                timingWheels[i] = new TimingWheel(wheelSizes[i], 
                    (long) Math.pow(wheelSizes[i], i) * tickDuration);
            }
            
            this.scheduler = Executors.newScheduledThreadPool(1);
            this.currentTime = System.currentTimeMillis();
            
            // 启动时间轮转动
            scheduler.scheduleAtFixedRate(this::tick, 
                tickDuration, tickDuration, TimeUnit.MILLISECONDS);
        }
        
        // 添加任务
        public void addTask(ScheduledTask task) {
            long delay = task.getNextExecuteTime().getTime() - currentTime;
            if (delay <= 0) {
                // 任务已到期，立即执行
                executeTask(task);
                return;
            }
            
            // 找到合适的轮子
            for (int i = 0; i < timingWheels.length; i++) {
                if (delay < timingWheels[i].getInterval() * timingWheels[i].getSize()) {
                    timingWheels[i].addTask(task, delay);
                    return;
                }
            }
            
            // 延迟太长，放到最大的轮子中
            timingWheels[timingWheels.length - 1].addTask(task, delay);
        }
        
        // 时间轮转动
        private void tick() {
            currentTime += tickDuration;
            
            // 转动所有轮子
            for (TimingWheel wheel : timingWheels) {
                wheel.tick();
            }
        }
        
        // 执行任务
        private void executeTask(ScheduledTask task) {
            // 这里应该提交到线程池执行
            System.out.println("执行任务: " + task.getTaskName());
        }
        
        // 时间轮实现
        private class TimingWheel {
            private final int size;
            private final long interval;
            private final List<ScheduledTask>[] slots;
            private int currentSlot = 0;
            
            @SuppressWarnings("unchecked")
            public TimingWheel(int size, long interval) {
                this.size = size;
                this.interval = interval;
                this.slots = new List[size];
                for (int i = 0; i < size; i++) {
                    slots[i] = new ArrayList<>();
                }
            }
            
            // 添加任务
            public void addTask(ScheduledTask task, long delay) {
                int ticks = (int) (delay / interval);
                int slot = (currentSlot + ticks) % size;
                slots[slot].add(task);
            }
            
            // 转动轮子
            public void tick() {
                List<ScheduledTask> tasks = slots[currentSlot];
                if (!tasks.isEmpty()) {
                    // 执行到期的任务
                    for (ScheduledTask task : tasks) {
                        executeTask(task);
                    }
                    tasks.clear();
                }
                
                // 移动到下一个槽位
                currentSlot = (currentSlot + 1) % size;
            }
            
            // Getters
            public int getSize() { return size; }
            public long getInterval() { return interval; }
        }
    }
}
```

### 任务分片算法优化

```java
// 任务分片算法优化
public class TaskShardingAlgorithmOptimization {
    
    // 一致性哈希分片算法
    public class ConsistentHashingSharding {
        private final TreeMap<Integer, ShardNode> circle = new TreeMap<>();
        private final int numberOfReplicas;
        
        public ConsistentHashingSharding(int numberOfReplicas) {
            this.numberOfReplicas = numberOfReplicas;
        }
        
        // 添加分片节点
        public void addNode(ShardNode node) {
            for (int i = 0; i < numberOfReplicas; i++) {
                String key = node.getNodeId() + ":" + i;
                int hash = hash(key);
                circle.put(hash, node);
            }
        }
        
        // 移除分片节点
        public void removeNode(ShardNode node) {
            for (int i = 0; i < numberOfReplicas; i++) {
                String key = node.getNodeId() + ":" + i;
                int hash = hash(key);
                circle.remove(hash);
            }
        }
        
        // 获取分片节点
        public ShardNode getNode(String key) {
            if (circle.isEmpty()) {
                return null;
            }
            
            int hash = hash(key);
            SortedMap<Integer, ShardNode> tailMap = circle.tailMap(hash);
            Integer nodeHash = tailMap.isEmpty() ? circle.firstKey() : tailMap.firstKey();
            return circle.get(nodeHash);
        }
        
        // 哈希函数
        private int hash(String key) {
            // 使用 MurmurHash 算法
            return murmurHash(key);
        }
        
        // MurmurHash 实现
        private int murmurHash(String key) {
            byte[] data = key.getBytes(StandardCharsets.UTF_8);
            int length = data.length;
            int hash = 0;
            int c1 = 0xcc9e2d51;
            int c2 = 0x1b873593;
            int h1 = hash;
            
            // 处理4字节块
            for (int i = 0; i < length - 3; i += 4) {
                int k1 = (data[i] & 0xff) | ((data[i + 1] & 0xff) << 8) | 
                         ((data[i + 2] & 0xff) << 16) | ((data[i + 3] & 0xff) << 24);
                
                k1 *= c1;
                k1 = Integer.rotateLeft(k1, 15);
                k1 *= c2;
                
                h1 ^= k1;
                h1 = Integer.rotateLeft(h1, 13);
                h1 = h1 * 5 + 0xe6546b64;
            }
            
            // 处理剩余字节
            int k1 = 0;
            switch (length & 3) {
                case 3:
                    k1 ^= (data[length - 1] & 0xff) << 16;
                case 2:
                    k1 ^= (data[length - 2] & 0xff) << 8;
                case 1:
                    k1 ^= (data[length - 3] & 0xff);
                    k1 *= c1;
                    k1 = Integer.rotateLeft(k1, 15);
                    k1 *= c2;
                    h1 ^= k1;
            }
            
            // 最终化
            h1 ^= length;
            h1 ^= h1 >>> 16;
            h1 *= 0x85ebca6b;
            h1 ^= h1 >>> 13;
            h1 *= 0xc2b2ae35;
            h1 ^= h1 >>> 16;
            
            return h1;
        }
    }
    
    // 范围分片算法
    public class RangeBasedSharding {
        private final List<ShardRange> shardRanges;
        
        public RangeBasedSharding(List<ShardRange> shardRanges) {
            this.shardRanges = new ArrayList<>(shardRanges);
            // 按起始值排序
            this.shardRanges.sort(Comparator.comparing(ShardRange::getStart));
        }
        
        // 根据值获取分片
        public ShardNode getShard(long value) {
            for (ShardRange range : shardRanges) {
                if (value >= range.getStart() && value <= range.getEnd()) {
                    return range.getNode();
                }
            }
            return null;
        }
        
        // 根据哈希值获取分片
        public ShardNode getShard(String key) {
            long hash = Math.abs(key.hashCode());
            return getShard(hash);
        }
    }
    
    // 分片节点
    public class ShardNode {
        private final String nodeId;
        private final String address;
        private final int port;
        private volatile boolean available;
        
        public ShardNode(String nodeId, String address, int port) {
            this.nodeId = nodeId;
            this.address = address;
            this.port = port;
            this.available = true;
        }
        
        // Getters
        public String getNodeId() { return nodeId; }
        public String getAddress() { return address; }
        public int getPort() { return port; }
        public boolean isAvailable() { return available; }
        public void setAvailable(boolean available) { this.available = available; }
    }
    
    // 分片范围
    public class ShardRange {
        private final long start;
        private final long end;
        private final ShardNode node;
        
        public ShardRange(long start, long end, ShardNode node) {
            this.start = start;
            this.end = end;
            this.node = node;
        }
        
        // Getters
        public long getStart() { return start; }
        public long getEnd() { return end; }
        public ShardNode getNode() { return node; }
    }
}
```

## 资源层面的性能优化

资源优化是提升系统性能的重要方面，通过合理利用系统资源可以显著提高处理能力。

### 线程池优化

```java
// 线程池优化
public class ThreadPoolOptimization {
    
    // 动态调整的线程池
    public class DynamicThreadPool {
        private final ThreadPoolExecutor executor;
        private final ThreadPoolMonitor monitor;
        private final ScheduledExecutorService adjuster;
        private final int minThreads;
        private final int maxThreads;
        private final int targetUtilization;
        
        public DynamicThreadPool(int minThreads, int maxThreads, int targetUtilization) {
            this.minThreads = minThreads;
            this.maxThreads = maxThreads;
            this.targetUtilization = targetUtilization;
            
            // 创建线程池
            this.executor = new ThreadPoolExecutor(
                minThreads, maxThreads,
                60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(1000),
                new ThreadFactory() {
                    private final AtomicInteger threadNumber = new AtomicInteger(1);
                    
                    @Override
                    public Thread newThread(Runnable r) {
                        Thread t = new Thread(r, "DynamicPool-" + threadNumber.getAndIncrement());
                        t.setDaemon(false);
                        t.setPriority(Thread.NORM_PRIORITY);
                        return t;
                    }
                },
                new ThreadPoolExecutor.CallerRunsPolicy()
            );
            
            // 创建监控器
            this.monitor = new ThreadPoolMonitor(executor);
            
            // 创建调整器
            this.adjuster = Executors.newScheduledThreadPool(1);
            this.adjuster.scheduleAtFixedRate(this::adjustPoolSize, 30, 30, TimeUnit.SECONDS);
        }
        
        // 提交任务
        public <T> Future<T> submit(Callable<T> task) {
            return executor.submit(task);
        }
        
        // 执行任务
        public void execute(Runnable task) {
            executor.execute(task);
        }
        
        // 调整线程池大小
        private void adjustPoolSize() {
            ThreadPoolStats stats = monitor.getStats();
            
            // 计算当前利用率
            double currentUtilization = (double) stats.getActiveCount() / stats.getPoolSize() * 100;
            
            // 根据利用率调整线程池大小
            if (currentUtilization > targetUtilization + 10) {
                // 利用率过高，增加线程数
                int newCoreSize = Math.min(maxThreads, executor.getCorePoolSize() + 2);
                executor.setCorePoolSize(newCoreSize);
                System.out.println("增加线程池核心线程数至: " + newCoreSize);
            } else if (currentUtilization < targetUtilization - 10) {
                // 利用率过低，减少线程数
                int newCoreSize = Math.max(minThreads, executor.getCorePoolSize() - 1);
                executor.setCorePoolSize(newCoreSize);
                System.out.println("减少线程池核心线程数至: " + newCoreSize);
            }
        }
        
        // 获取线程池统计信息
        public ThreadPoolStats getStats() {
            return monitor.getStats();
        }
        
        // 关闭线程池
        public void shutdown() {
            adjuster.shutdown();
            executor.shutdown();
        }
    }
    
    // 线程池监控器
    public class ThreadPoolMonitor {
        private final ThreadPoolExecutor executor;
        private final ScheduledExecutorService monitorScheduler;
        private final List<ThreadPoolStats> history = new ArrayList<>();
        
        public ThreadPoolMonitor(ThreadPoolExecutor executor) {
            this.executor = executor;
            this.monitorScheduler = Executors.newScheduledThreadPool(1);
            this.monitorScheduler.scheduleAtFixedRate(this::collectStats, 10, 10, TimeUnit.SECONDS);
        }
        
        // 收集统计信息
        private void collectStats() {
            ThreadPoolStats stats = new ThreadPoolStats();
            stats.setPoolSize(executor.getPoolSize());
            stats.setActiveCount(executor.getActiveCount());
            stats.setTaskCount(executor.getTaskCount());
            stats.setCompletedTaskCount(executor.getCompletedTaskCount());
            stats.setQueueSize(executor.getQueue().size());
            stats.setLargestPoolSize(executor.getLargestPoolSize());
            
            synchronized (history) {
                history.add(stats);
                // 保留最近60个统计点
                if (history.size() > 60) {
                    history.remove(0);
                }
            }
        }
        
        // 获取当前统计信息
        public ThreadPoolStats getStats() {
            ThreadPoolStats stats = new ThreadPoolStats();
            stats.setPoolSize(executor.getPoolSize());
            stats.setActiveCount(executor.getActiveCount());
            stats.setTaskCount(executor.getTaskCount());
            stats.setCompletedTaskCount(executor.getCompletedTaskCount());
            stats.setQueueSize(executor.getQueue().size());
            stats.setLargestPoolSize(executor.getLargestPoolSize());
            return stats;
        }
        
        // 获取历史统计信息
        public List<ThreadPoolStats> getHistory() {
            synchronized (history) {
                return new ArrayList<>(history);
            }
        }
    }
    
    // 线程池统计信息
    public class ThreadPoolStats {
        private int poolSize;
        private int activeCount;
        private long taskCount;
        private long completedTaskCount;
        private int queueSize;
        private int largestPoolSize;
        
        // Getters and Setters
        public int getPoolSize() { return poolSize; }
        public void setPoolSize(int poolSize) { this.poolSize = poolSize; }
        
        public int getActiveCount() { return activeCount; }
        public void setActiveCount(int activeCount) { this.activeCount = activeCount; }
        
        public long getTaskCount() { return taskCount; }
        public void setTaskCount(long taskCount) { this.taskCount = taskCount; }
        
        public long getCompletedTaskCount() { return completedTaskCount; }
        public void setCompletedTaskCount(long completedTaskCount) { this.completedTaskCount = completedTaskCount; }
        
        public int getQueueSize() { return queueSize; }
        public void setQueueSize(int queueSize) { this.queueSize = queueSize; }
        
        public int getLargestPoolSize() { return largestPoolSize; }
        public void setLargestPoolSize(int largestPoolSize) { this.largestPoolSize = largestPoolSize; }
    }
}
```

### 数据库优化

```java
// 数据库优化
public class DatabaseOptimization {
    
    // 连接池优化
    public class OptimizedConnectionPool {
        private final HikariDataSource dataSource;
        private final ConnectionPoolMonitor monitor;
        
        public OptimizedConnectionPool(DatabaseConfig config) {
            HikariConfig hikariConfig = new HikariConfig();
            hikariConfig.setJdbcUrl(config.getUrl());
            hikariConfig.setUsername(config.getUsername());
            hikariConfig.setPassword(config.getPassword());
            
            // 连接池配置优化
            hikariConfig.setMaximumPoolSize(50);           // 最大连接数
            hikariConfig.setMinimumIdle(10);               // 最小空闲连接数
            hikariConfig.setConnectionTimeout(30000);      // 连接超时时间
            hikariConfig.setIdleTimeout(600000);           // 空闲超时时间
            hikariConfig.setMaxLifetime(1800000);          // 连接最大生存时间
            hikariConfig.setLeakDetectionThreshold(60000); // 连接泄漏检测阈值
            
            // 性能优化配置
            hikariConfig.setConnectionTestQuery("SELECT 1");
            hikariConfig.setValidationTimeout(5000);
            hikariConfig.setAutoCommit(false);
            
            this.dataSource = new HikariDataSource(hikariConfig);
            this.monitor = new ConnectionPoolMonitor(dataSource);
        }
        
        // 获取连接
        public Connection getConnection() throws SQLException {
            return dataSource.getConnection();
        }
        
        // 获取连接池统计信息
        public ConnectionPoolStats getStats() {
            return monitor.getStats();
        }
        
        // 关闭连接池
        public void close() {
            dataSource.close();
        }
    }
    
    // 连接池监控器
    public class ConnectionPoolMonitor {
        private final HikariDataSource dataSource;
        private final ScheduledExecutorService monitorScheduler;
        
        public ConnectionPoolMonitor(HikariDataSource dataSource) {
            this.dataSource = dataSource;
            this.monitorScheduler = Executors.newScheduledThreadPool(1);
            this.monitorScheduler.scheduleAtFixedRate(this::logStats, 30, 30, TimeUnit.SECONDS);
        }
        
        // 记录统计信息
        private void logStats() {
            HikariPoolMXBean poolBean = dataSource.getHikariPoolMXBean();
            System.out.println("连接池统计 - 活跃连接: " + poolBean.getActiveConnections() +
                             ", 空闲连接: " + poolBean.getIdleConnections() +
                             ", 总连接: " + poolBean.getTotalConnections() +
                             ", 等待线程: " + poolBean.getThreadsAwaitingConnection());
        }
        
        // 获取统计信息
        public ConnectionPoolStats getStats() {
            HikariPoolMXBean poolBean = dataSource.getHikariPoolMXBean();
            ConnectionPoolStats stats = new ConnectionPoolStats();
            stats.setActiveConnections(poolBean.getActiveConnections());
            stats.setIdleConnections(poolBean.getIdleConnections());
            stats.setTotalConnections(poolBean.getTotalConnections());
            stats.setThreadsAwaitingConnection(poolBean.getThreadsAwaitingConnection());
            return stats;
        }
    }
    
    // 连接池统计信息
    public class ConnectionPoolStats {
        private int activeConnections;
        private int idleConnections;
        private int totalConnections;
        private int threadsAwaitingConnection;
        
        // Getters and Setters
        public int getActiveConnections() { return activeConnections; }
        public void setActiveConnections(int activeConnections) { this.activeConnections = activeConnections; }
        
        public int getIdleConnections() { return idleConnections; }
        public void setIdleConnections(int idleConnections) { this.idleConnections = idleConnections; }
        
        public int getTotalConnections() { return totalConnections; }
        public void setTotalConnections(int totalConnections) { this.totalConnections = totalConnections; }
        
        public int getThreadsAwaitingConnection() { return threadsAwaitingConnection; }
        public void setThreadsAwaitingConnection(int threadsAwaitingConnection) { this.threadsAwaitingConnection = threadsAwaitingConnection; }
    }
    
    // 数据库配置
    public class DatabaseConfig {
        private String url;
        private String username;
        private String password;
        
        // Getters and Setters
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
    
    // SQL优化工具
    public class SqlOptimization {
        
        // 慢查询分析
        public class SlowQueryAnalyzer {
            private final Map<String, QueryStats> queryStats = new ConcurrentHashMap<>();
            
            // 记录查询执行时间
            public void recordQuery(String sql, long executionTime, boolean success) {
                String normalizedSql = normalizeSql(sql);
                QueryStats stats = queryStats.computeIfAbsent(normalizedSql, 
                    k -> new QueryStats(normalizedSql));
                
                stats.addExecution(executionTime, success);
            }
            
            // 获取慢查询
            public List<QueryStats> getSlowQueries(long thresholdMs) {
                return queryStats.values().stream()
                    .filter(stats -> stats.getAverageTime() > thresholdMs)
                    .sorted((a, b) -> Long.compare(b.getAverageTime(), a.getAverageTime()))
                    .collect(Collectors.toList());
            }
            
            // SQL标准化（移除具体值）
            private String normalizeSql(String sql) {
                return sql.replaceAll("'[^']*'", "?")
                         .replaceAll("\\d+", "?");
            }
        }
        
        // 查询统计信息
        public class QueryStats {
            private final String sql;
            private final AtomicLong executionCount = new AtomicLong(0);
            private final AtomicLong totalTime = new AtomicLong(0);
            private final AtomicLong successCount = new AtomicLong(0);
            private final AtomicLong failureCount = new AtomicLong(0);
            private volatile long maxTime = 0;
            private volatile long minTime = Long.MAX_VALUE;
            
            public QueryStats(String sql) {
                this.sql = sql;
            }
            
            // 添加执行记录
            public void addExecution(long time, boolean success) {
                executionCount.incrementAndGet();
                totalTime.addAndGet(time);
                
                if (success) {
                    successCount.incrementAndGet();
                } else {
                    failureCount.incrementAndGet();
                }
                
                // 更新最大最小时间
                if (time > maxTime) {
                    maxTime = time;
                }
                if (time < minTime) {
                    minTime = time;
                }
            }
            
            // 计算平均时间
            public long getAverageTime() {
                long count = executionCount.get();
                return count > 0 ? totalTime.get() / count : 0;
            }
            
            // Getters
            public String getSql() { return sql; }
            public long getExecutionCount() { return executionCount.get(); }
            public long getTotalTime() { return totalTime.get(); }
            public long getSuccessCount() { return successCount.get(); }
            public long getFailureCount() { return failureCount.get(); }
            public long getMaxTime() { return maxTime; }
            public long getMinTime() { return minTime; }
        }
    }
}
```

## 性能测试与监控

性能测试和监控是验证优化效果和持续改进的重要手段。

### 性能测试框架

```java
// 性能测试框架
public class PerformanceTestingFramework {
    
    // 性能测试场景
    public class PerformanceTestScenario {
        private final String name;
        private final Runnable testRunnable;
        private final int concurrentUsers;
        private final int totalRequests;
        private final long rampUpTime;
        
        public PerformanceTestScenario(String name, Runnable testRunnable, 
                                     int concurrentUsers, int totalRequests, long rampUpTime) {
            this.name = name;
            this.testRunnable = testRunnable;
            this.concurrentUsers = concurrentUsers;
            this.totalRequests = totalRequests;
            this.rampUpTime = rampUpTime;
        }
        
        // 执行性能测试
        public PerformanceTestResult execute() {
            System.out.println("开始执行性能测试: " + name);
            
            PerformanceTestResult result = new PerformanceTestResult(name);
            CountDownLatch latch = new CountDownLatch(totalRequests);
            List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());
            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger failureCount = new AtomicInteger(0);
            
            // 创建线程池
            ExecutorService executor = Executors.newFixedThreadPool(concurrentUsers);
            
            long startTime = System.currentTimeMillis();
            
            // 提交测试任务
            for (int i = 0; i < totalRequests; i++) {
                final int requestId = i;
                executor.submit(() -> {
                    try {
                        long requestStartTime = System.currentTimeMillis();
                        testRunnable.run();
                        long requestEndTime = System.currentTimeMillis();
                        
                        responseTimes.add(requestEndTime - requestStartTime);
                        successCount.incrementAndGet();
                    } catch (Exception e) {
                        failureCount.incrementAndGet();
                        System.err.println("请求失败: " + requestId + ", 错误: " + e.getMessage());
                    } finally {
                        latch.countDown();
                    }
                });
                
                // 控制请求发送速率
                if (rampUpTime > 0 && i > 0) {
                    try {
                        Thread.sleep(rampUpTime / totalRequests);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            
            // 等待所有请求完成
            try {
                latch.await(5, TimeUnit.MINUTES);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            long endTime = System.currentTimeMillis();
            
            // 计算测试结果
            result.setTotalTime(endTime - startTime);
            result.setSuccessCount(successCount.get());
            result.setFailureCount(failureCount.get());
            result.setResponseTimes(new ArrayList<>(responseTimes));
            
            executor.shutdown();
            
            System.out.println("性能测试完成: " + name);
            return result;
        }
    }
    
    // 性能测试结果
    public class PerformanceTestResult {
        private final String testName;
        private long totalTime;
        private int successCount;
        private int failureCount;
        private List<Long> responseTimes;
        
        public PerformanceTestResult(String testName) {
            this.testName = testName;
        }
        
        // 计算统计指标
        public PerformanceMetrics calculateMetrics() {
            PerformanceMetrics metrics = new PerformanceMetrics();
            
            if (responseTimes.isEmpty()) {
                return metrics;
            }
            
            // 吞吐量
            double throughput = (double) (successCount + failureCount) / (totalTime / 1000.0);
            metrics.setThroughput((long) throughput);
            
            // 响应时间统计
            Collections.sort(responseTimes);
            metrics.setResponseTime(responseTimes.get(responseTimes.size() / 2)); // 中位数
            
            // 成功率
            double successRate = (double) successCount / (successCount + failureCount) * 100;
            
            // 其他指标...
            
            return metrics;
        }
        
        // 生成测试报告
        public String generateReport() {
            StringBuilder report = new StringBuilder();
            report.append("=== 性能测试报告: ").append(testName).append(" ===\n");
            report.append("总耗时: ").append(totalTime).append(" ms\n");
            report.append("成功请求数: ").append(successCount).append("\n");
            report.append("失败请求数: ").append(failureCount).append("\n");
            
            if (!responseTimes.isEmpty()) {
                long minTime = Collections.min(responseTimes);
                long maxTime = Collections.max(responseTimes);
                double avgTime = responseTimes.stream().mapToLong(Long::longValue).average().orElse(0);
                
                report.append("最小响应时间: ").append(minTime).append(" ms\n");
                report.append("最大响应时间: ").append(maxTime).append(" ms\n");
                report.append("平均响应时间: ").append(String.format("%.2f", avgTime)).append(" ms\n");
            }
            
            return report.toString();
        }
        
        // Getters and Setters
        public String getTestName() { return testName; }
        public long getTotalTime() { return totalTime; }
        public void setTotalTime(long totalTime) { this.totalTime = totalTime; }
        public int getSuccessCount() { return successCount; }
        public void setSuccessCount(int successCount) { this.successCount = successCount; }
        public int getFailureCount() { return failureCount; }
        public void setFailureCount(int failureCount) { this.failureCount = failureCount; }
        public List<Long> getResponseTimes() { return responseTimes; }
        public void setResponseTimes(List<Long> responseTimes) { this.responseTimes = responseTimes; }
    }
}
```

### 性能监控系统

```java
// 性能监控系统
public class PerformanceMonitoringSystem {
    
    // 监控指标收集器
    public class MetricsCollector {
        private final Map<String, Metric> metrics = new ConcurrentHashMap<>();
        private final ScheduledExecutorService reporter;
        
        public MetricsCollector() {
            this.reporter = Executors.newScheduledThreadPool(1);
            // 定期报告指标
            this.reporter.scheduleAtFixedRate(this::reportMetrics, 60, 60, TimeUnit.SECONDS);
        }
        
        // 记录计数指标
        public void recordCount(String name, long value) {
            metrics.computeIfAbsent(name, k -> new CountMetric(name))
                   .record(value);
        }
        
        // 记录计时指标
        public void recordTimer(String name, long duration) {
            metrics.computeIfAbsent(name, k -> new TimerMetric(name))
                   .record(duration);
        }
        
        // 记录直方图指标
        public void recordHistogram(String name, long value) {
            metrics.computeIfAbsent(name, k -> new HistogramMetric(name))
                   .record(value);
        }
        
        // 报告指标
        private void reportMetrics() {
            System.out.println("=== 系统性能指标报告 ===");
            for (Metric metric : metrics.values()) {
                System.out.println(metric.report());
            }
        }
        
        // 关闭收集器
        public void shutdown() {
            reporter.shutdown();
        }
    }
    
    // 监控指标接口
    interface Metric {
        void record(long value);
        String report();
    }
    
    // 计数指标
    public class CountMetric implements Metric {
        private final String name;
        private final AtomicLong count = new AtomicLong(0);
        
        public CountMetric(String name) {
            this.name = name;
        }
        
        @Override
        public void record(long value) {
            count.addAndGet(value);
        }
        
        @Override
        public String report() {
            return name + ": " + count.get();
        }
        
        public long getCount() {
            return count.get();
        }
    }
    
    // 计时指标
    public class TimerMetric implements Metric {
        private final String name;
        private final AtomicLong count = new AtomicLong(0);
        private final AtomicLong totalTime = new AtomicLong(0);
        private final AtomicLong maxTime = new AtomicLong(0);
        
        public TimerMetric(String name) {
            this.name = name;
        }
        
        @Override
        public void record(long duration) {
            count.incrementAndGet();
            totalTime.addAndGet(duration);
            
            // 更新最大时间
            long currentMax = maxTime.get();
            while (duration > currentMax) {
                if (maxTime.compareAndSet(currentMax, duration)) {
                    break;
                }
                currentMax = maxTime.get();
            }
        }
        
        @Override
        public String report() {
            long cnt = count.get();
            if (cnt == 0) {
                return name + ": 无数据";
            }
            
            long avgTime = totalTime.get() / cnt;
            return String.format("%s: 次数=%d, 平均时间=%dms, 最大时间=%dms", 
                               name, cnt, avgTime, maxTime.get());
        }
    }
    
    // 直方图指标
    public class HistogramMetric implements Metric {
        private final String name;
        private final AtomicLong count = new AtomicLong(0);
        private final Map<Long, AtomicLong> buckets = new ConcurrentHashMap<>();
        
        public HistogramMetric(String name) {
            this.name = name;
            // 初始化桶
            for (long bucket : new long[]{1, 10, 100, 1000, 10000}) {
                buckets.put(bucket, new AtomicLong(0));
            }
        }
        
        @Override
        public void record(long value) {
            count.incrementAndGet();
            
            // 找到合适的桶
            for (Map.Entry<Long, AtomicLong> entry : buckets.entrySet()) {
                if (value <= entry.getKey()) {
                    entry.getValue().incrementAndGet();
                    break;
                }
            }
        }
        
        @Override
        public String report() {
            StringBuilder sb = new StringBuilder();
            sb.append(name).append(" 直方图:\n");
            sb.append("  总次数: ").append(count.get()).append("\n");
            
            for (Map.Entry<Long, AtomicLong> entry : buckets.entrySet()) {
                long bucket = entry.getKey();
                long bucketCount = entry.getValue().get();
                double percentage = count.get() > 0 ? 
                    (double) bucketCount / count.get() * 100 : 0;
                sb.append("  <= ").append(bucket).append("ms: ")
                  .append(bucketCount).append(" (").append(String.format("%.2f", percentage)).append("%)\n");
            }
            
            return sb.toString();
        }
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示性能优化策略的实施：

```java
// 性能优化使用示例
public class PerformanceOptimizationExample {
    public static void main(String[] args) {
        try {
            // 模拟性能优化过程
            simulatePerformanceOptimization();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 模拟性能优化过程
    public static void simulatePerformanceOptimization() throws Exception {
        System.out.println("开始性能优化演示");
        
        // 1. 创建优化的线程池
        ThreadPoolOptimization.DynamicThreadPool threadPool = 
            new ThreadPoolOptimization().new DynamicThreadPool(10, 50, 70);
        
        // 2. 创建多级缓存
        CacheStrategyOptimization.MultiLevelCache cache = 
            new CacheStrategyOptimization().new MultiLevelCache();
        
        // 3. 创建性能监控系统
        PerformanceMonitoringSystem.MetricsCollector metricsCollector = 
            new PerformanceMonitoringSystem().new MetricsCollector();
        
        // 4. 模拟任务执行
        simulateTaskExecution(threadPool, cache, metricsCollector);
        
        // 5. 运行一段时间后查看统计信息
        Thread.sleep(60000);
        
        // 6. 输出缓存统计
        CacheStrategyOptimization.CacheStats cacheStats = cache.getCacheStats();
        System.out.println("缓存命中率: " + String.format("%.2f", cacheStats.calculateHitRate()) + "%");
        System.out.println("一级缓存命中: " + cacheStats.getL1Hit());
        System.out.println("二级缓存命中: " + cacheStats.getL2Hit());
        System.out.println("缓存未命中: " + cacheStats.getMiss());
        
        // 7. 关闭资源
        threadPool.shutdown();
        metricsCollector.shutdown();
        
        System.out.println("性能优化演示完成");
    }
    
    // 模拟任务执行
    private static void simulateTaskExecution(
            ThreadPoolOptimization.DynamicThreadPool threadPool,
            CacheStrategyOptimization.MultiLevelCache cache,
            PerformanceMonitoringSystem.MetricsCollector metricsCollector) {
        
        // 提交多个任务
        for (int i = 0; i < 100; i++) {
            final int taskId = i;
            threadPool.execute(() -> {
                long startTime = System.currentTimeMillis();
                
                try {
                    // 模拟任务处理
                    String cacheKey = "task_result_" + taskId;
                    
                    // 先查缓存
                    Object result = cache.get(cacheKey);
                    if (result == null) {
                        // 缓存未命中，执行计算
                        result = performComputation(taskId);
                        cache.put(cacheKey, result);
                        metricsCollector.recordCount("cache.miss", 1);
                    } else {
                        metricsCollector.recordCount("cache.hit", 1);
                    }
                    
                    // 模拟任务完成
                    Thread.sleep(100);
                    
                } catch (Exception e) {
                    System.err.println("任务执行失败: " + taskId + ", 错误: " + e.getMessage());
                    metricsCollector.recordCount("task.failure", 1);
                } finally {
                    long endTime = System.currentTimeMillis();
                    metricsCollector.recordTimer("task.duration", endTime - startTime);
                    metricsCollector.recordCount("task.completed", 1);
                }
            });
        }
    }
    
    // 模拟计算任务
    private static Object performComputation(int taskId) {
        // 模拟耗时计算
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return "result_" + taskId;
    }
}
```

## 最佳实践与注意事项

在实际应用中，需要注意以下最佳实践：

```java
// 性能优化最佳实践
public class OptimizationBestPractices {
    
    // 1. 测试驱动优化
    public void testDrivenOptimization() {
        System.out.println("测试驱动优化:");
        System.out.println("1. 建立性能基线 - 明确优化前的性能水平");
        System.out.println("2. 设定优化目标 - 制定可量化的性能目标");
        System.out.println("3. 验证优化效果 - 通过测试验证优化成果");
        System.out.println("4. 避免过度优化 - 关注实际收益而非理论优化");
    }
    
    // 2. 监控与告警
    public void monitoringAndAlerting() {
        System.out.println("监控与告警:");
        System.out.println("1. 建立全面的监控体系 - 覆盖应用、系统、网络等层面");
        System.out.println("2. 设置合理的告警阈值 - 避免误报和漏报");
        System.out.println("3. 实现实时监控 - 及时发现性能问题");
        System.out.println("4. 建立性能趋势分析 - 识别性能退化趋势");
    }
    
    // 3. 渐进式优化
    public void progressiveOptimization() {
        System.out.println("渐进式优化:");
        System.out.println("1. 优先解决瓶颈问题 - 集中资源解决关键瓶颈");
        System.out.println("2. 分阶段实施优化 - 避免一次性大规模改动");
        System.out.println("3. 建立回滚机制 - 确保优化失败时能快速回滚");
        System.out.println("4. 持续优化改进 - 建立长期优化机制");
    }
    
    // 4. 成本效益平衡
    public void costBenefitBalance() {
        System.out.println("成本效益平衡:");
        System.out.println("1. 评估优化成本 - 包括人力、时间、资源成本");
        System.out.println("2. 计算优化收益 - 量化性能提升带来的价值");
        System.out.println("3. 选择性价比高的方案 - 优先实施高性价比优化");
        System.out.println("4. 考虑长期维护成本 - 评估方案的可持续性");
    }
}
```

## 总结

通过本文的实现，我们深入了解了分布式调度系统的性能优化策略：

1. **核心概念**：理解了性能指标、评估方法和优化原则
2. **架构优化**：学习了微服务架构和缓存策略优化
3. **算法优化**：掌握了任务调度和分片算法优化技术
4. **资源优化**：了解了线程池和数据库优化方法
5. **测试监控**：掌握了性能测试和监控体系构建

性能优化是一个持续的过程，需要在实际应用中不断实践和改进。通过合理的优化策略和有效的实施方法，可以显著提升分布式调度系统的性能和用户体验。

至此，我们已经完成了第二部分实战篇2.3章节的所有文章。在接下来的文章中，我们将继续探讨分布式调度系统的其他重要主题。