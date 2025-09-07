---
title: 监控与运维
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，监控与运维是确保系统稳定运行和快速故障响应的关键环节。一个完善的监控体系不仅能够实时反映系统运行状态，还能帮助运维人员快速定位和解决问题。本文将深入探讨任务执行日志采集、调度指标监控、告警与自动化运维等核心技术，帮助构建可靠的调度监控运维体系。

## 任务执行日志采集

任务执行日志是了解任务运行状态、排查问题的重要信息来源。在分布式环境中，如何高效地采集、存储和查询日志成为了一个重要挑战。

### 日志采集架构

```java
// 任务执行日志实体
public class TaskExecutionLog {
    private String logId;
    private String taskId;
    private String taskName;
    private String groupName;
    private String instanceId;
    private TaskStatus status;
    private String message;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private long durationMs;
    private String hostName;
    private int port;
    private Map<String, Object> parameters;
    private String errorStackTrace;
    private String tenantId;
    private String userId;
    
    // constructors
    public TaskExecutionLog(String taskId, String taskName, String groupName) {
        this.logId = UUID.randomUUID().toString();
        this.taskId = taskId;
        this.taskName = taskName;
        this.groupName = groupName;
        this.startTime = LocalDateTime.now();
        this.status = TaskStatus.RUNNING;
    }
    
    // 更新结束状态
    public void complete(TaskStatus finalStatus, String message) {
        this.status = finalStatus;
        this.message = message;
        this.endTime = LocalDateTime.now();
        this.durationMs = java.time.Duration.between(startTime, endTime).toMillis();
    }
    
    // 记录错误
    public void setError(Exception error) {
        this.status = TaskStatus.FAILED;
        this.errorStackTrace = ExceptionUtils.getStackTrace(error);
        this.endTime = LocalDateTime.now();
        this.durationMs = java.time.Duration.between(startTime, endTime).toMillis();
    }
    
    // getters and setters
    public String getLogId() { return logId; }
    public void setLogId(String logId) { this.logId = logId; }
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public String getInstanceId() { return instanceId; }
    public void setInstanceId(String instanceId) { this.instanceId = instanceId; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }
    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
    public String getErrorStackTrace() { return errorStackTrace; }
    public void setErrorStackTrace(String errorStackTrace) { this.errorStackTrace = errorStackTrace; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}

// 任务状态枚举
public enum TaskStatus {
    RUNNING,     // 运行中
    SUCCESS,     // 成功
    FAILED,      // 失败
    TIMEOUT,     // 超时
    CANCELLED    // 已取消
}

// 日志采集器接口
public interface LogCollector {
    void collectLog(TaskExecutionLog log);
    void flush();
    void close();
}

// 异步日志采集器
public class AsyncLogCollector implements LogCollector {
    private final BlockingQueue<TaskExecutionLog> logQueue;
    private final LogStorage logStorage;
    private final Thread collectorThread;
    private final AtomicInteger pendingLogs = new AtomicInteger(0);
    private volatile boolean running = true;
    
    public AsyncLogCollector(LogStorage logStorage, int queueSize) {
        this.logStorage = logStorage;
        this.logQueue = new LinkedBlockingQueue<>(queueSize);
        this.collectorThread = new Thread(this::collectLogs);
        this.collectorThread.setDaemon(true);
        this.collectorThread.start();
    }
    
    @Override
    public void collectLog(TaskExecutionLog log) {
        if (!logQueue.offer(log)) {
            System.err.println("日志队列已满，丢弃日志: " + log.getTaskId());
        } else {
            pendingLogs.incrementAndGet();
        }
    }
    
    @Override
    public void flush() {
        // 等待所有日志被处理
        while (pendingLogs.get() > 0 && running) {
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
    
    @Override
    public void close() {
        running = false;
        collectorThread.interrupt();
    }
    
    private void collectLogs() {
        List<TaskExecutionLog> batch = new ArrayList<>(100);
        
        while (running) {
            try {
                // 批量获取日志
                TaskExecutionLog log = logQueue.poll(1, TimeUnit.SECONDS);
                if (log != null) {
                    batch.add(log);
                    pendingLogs.decrementAndGet();
                }
                
                // 如果批次已满或超时，批量存储
                if (batch.size() >= 100 || (log == null && !batch.isEmpty())) {
                    try {
                        logStorage.storeLogs(batch);
                        batch.clear();
                    } catch (Exception e) {
                        System.err.println("存储日志失败: " + e.getMessage());
                        // 重新加入队列进行重试
                        logQueue.addAll(batch);
                        pendingLogs.addAndGet(batch.size());
                        batch.clear();
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                System.err.println("日志采集异常: " + e.getMessage());
            }
        }
    }
}

// 日志存储接口
public interface LogStorage {
    void storeLogs(List<TaskExecutionLog> logs) throws Exception;
    List<TaskExecutionLog> queryLogs(LogQueryCondition condition) throws Exception;
    long countLogs(LogQueryCondition condition) throws Exception;
}

// 数据库日志存储实现
public class DatabaseLogStorage implements LogStorage {
    private final DataSource dataSource;
    
    public DatabaseLogStorage(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public void storeLogs(List<TaskExecutionLog> logs) throws Exception {
        String sql = "INSERT INTO task_execution_logs (" +
                    "log_id, task_id, task_name, group_name, instance_id, status, " +
                    "message, start_time, end_time, duration_ms, host_name, port, " +
                    "parameters, error_stack_trace, tenant_id, user_id) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            conn.setAutoCommit(false);
            
            for (TaskExecutionLog log : logs) {
                stmt.setString(1, log.getLogId());
                stmt.setString(2, log.getTaskId());
                stmt.setString(3, log.getTaskName());
                stmt.setString(4, log.getGroupName());
                stmt.setString(5, log.getInstanceId());
                stmt.setString(6, log.getStatus().name());
                stmt.setString(7, log.getMessage());
                stmt.setTimestamp(8, Timestamp.valueOf(log.getStartTime()));
                stmt.setTimestamp(9, log.getEndTime() != null ? Timestamp.valueOf(log.getEndTime()) : null);
                stmt.setLong(10, log.getDurationMs());
                stmt.setString(11, log.getHostName());
                stmt.setInt(12, log.getPort());
                stmt.setString(13, log.getParameters() != null ? JSON.toJSONString(log.getParameters()) : null);
                stmt.setString(14, log.getErrorStackTrace());
                stmt.setString(15, log.getTenantId());
                stmt.setString(16, log.getUserId());
                
                stmt.addBatch();
            }
            
            stmt.executeBatch();
            conn.commit();
        }
    }
    
    @Override
    public List<TaskExecutionLog> queryLogs(LogQueryCondition condition) throws Exception {
        StringBuilder sql = new StringBuilder("SELECT * FROM task_execution_logs WHERE 1=1");
        List<Object> parameters = new ArrayList<>();
        
        // 构建查询条件
        if (condition.getTaskId() != null) {
            sql.append(" AND task_id = ?");
            parameters.add(condition.getTaskId());
        }
        
        if (condition.getStatus() != null) {
            sql.append(" AND status = ?");
            parameters.add(condition.getStatus().name());
        }
        
        if (condition.getStartTime() != null) {
            sql.append(" AND start_time >= ?");
            parameters.add(Timestamp.valueOf(condition.getStartTime()));
        }
        
        if (condition.getEndTime() != null) {
            sql.append(" AND start_time <= ?");
            parameters.add(Timestamp.valueOf(condition.getEndTime()));
        }
        
        sql.append(" ORDER BY start_time DESC");
        
        if (condition.getLimit() > 0) {
            sql.append(" LIMIT ").append(condition.getLimit());
        }
        
        List<TaskExecutionLog> logs = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
            
            // 设置参数
            for (int i = 0; i < parameters.size(); i++) {
                stmt.setObject(i + 1, parameters.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    logs.add(mapResultSetToLog(rs));
                }
            }
        }
        
        return logs;
    }
    
    @Override
    public long countLogs(LogQueryCondition condition) throws Exception {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM task_execution_logs WHERE 1=1");
        List<Object> parameters = new ArrayList<>();
        
        // 构建查询条件
        if (condition.getTaskId() != null) {
            sql.append(" AND task_id = ?");
            parameters.add(condition.getTaskId());
        }
        
        if (condition.getStatus() != null) {
            sql.append(" AND status = ?");
            parameters.add(condition.getStatus().name());
        }
        
        if (condition.getStartTime() != null) {
            sql.append(" AND start_time >= ?");
            parameters.add(Timestamp.valueOf(condition.getStartTime()));
        }
        
        if (condition.getEndTime() != null) {
            sql.append(" AND start_time <= ?");
            parameters.add(Timestamp.valueOf(condition.getEndTime()));
        }
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
            
            // 设置参数
            for (int i = 0; i < parameters.size(); i++) {
                stmt.setObject(i + 1, parameters.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        }
        
        return 0;
    }
    
    private TaskExecutionLog mapResultSetToLog(ResultSet rs) throws SQLException {
        TaskExecutionLog log = new TaskExecutionLog("", "", "");
        log.setLogId(rs.getString("log_id"));
        log.setTaskId(rs.getString("task_id"));
        log.setTaskName(rs.getString("task_name"));
        log.setGroupName(rs.getString("group_name"));
        log.setInstanceId(rs.getString("instance_id"));
        log.setStatus(TaskStatus.valueOf(rs.getString("status")));
        log.setMessage(rs.getString("message"));
        log.setStartTime(rs.getTimestamp("start_time").toLocalDateTime());
        Timestamp endTime = rs.getTimestamp("end_time");
        if (endTime != null) {
            log.setEndTime(endTime.toLocalDateTime());
        }
        log.setDurationMs(rs.getLong("duration_ms"));
        log.setHostName(rs.getString("host_name"));
        log.setPort(rs.getInt("port"));
        String parametersJson = rs.getString("parameters");
        if (parametersJson != null) {
            log.setParameters(JSON.parseObject(parametersJson, Map.class));
        }
        log.setErrorStackTrace(rs.getString("error_stack_trace"));
        log.setTenantId(rs.getString("tenant_id"));
        log.setUserId(rs.getString("user_id"));
        return log;
    }
}

// 日志查询条件
public class LogQueryCondition {
    private String taskId;
    private TaskStatus status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private int limit = 100;
    
    // builders
    public static LogQueryConditionBuilder builder() {
        return new LogQueryConditionBuilder();
    }
    
    // getters and setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }
}

// 日志查询条件构建器
public class LogQueryConditionBuilder {
    private LogQueryCondition condition = new LogQueryCondition();
    
    public LogQueryConditionBuilder taskId(String taskId) {
        condition.setTaskId(taskId);
        return this;
    }
    
    public LogQueryConditionBuilder status(TaskStatus status) {
        condition.setStatus(status);
        return this;
    }
    
    public LogQueryConditionBuilder startTime(LocalDateTime startTime) {
        condition.setStartTime(startTime);
        return this;
    }
    
    public LogQueryConditionBuilder endTime(LocalDateTime endTime) {
        condition.setEndTime(endTime);
        return this;
    }
    
    public LogQueryConditionBuilder limit(int limit) {
        condition.setLimit(limit);
        return this;
    }
    
    public LogQueryCondition build() {
        return condition;
    }
}
```

### 日志采集集成

```java
// 任务执行拦截器
@Component
public class TaskExecutionInterceptor implements JobListener {
    private final LogCollector logCollector;
    private final ThreadLocal<TaskExecutionLog> logContext = new ThreadLocal<>();
    
    public TaskExecutionInterceptor(LogCollector logCollector) {
        this.logCollector = logCollector;
    }
    
    @Override
    public String getName() {
        return "TaskExecutionInterceptor";
    }
    
    @Override
    public void jobToBeExecuted(JobExecutionContext context) {
        JobDetail jobDetail = context.getJobDetail();
        String taskId = jobDetail.getKey().getName();
        String groupName = jobDetail.getKey().getGroup();
        String taskName = jobDetail.getDescription();
        
        TaskExecutionLog log = new TaskExecutionLog(taskId, taskName, groupName);
        log.setInstanceId(getInstanceId());
        log.setHostName(getHostName());
        log.setPort(getPort());
        log.setParameters(context.getMergedJobDataMap().getWrappedMap());
        
        logContext.set(log);
    }
    
    @Override
    public void jobExecutionVetoed(JobExecutionContext context) {
        TaskExecutionLog log = logContext.get();
        if (log != null) {
            log.complete(TaskStatus.CANCELLED, "任务被否决执行");
            logCollector.collectLog(log);
            logContext.remove();
        }
    }
    
    @Override
    public void jobWasExecuted(JobExecutionContext context, JobExecutionException jobException) {
        TaskExecutionLog log = logContext.get();
        if (log != null) {
            if (jobException != null) {
                log.setError(jobException);
            } else {
                log.complete(TaskStatus.SUCCESS, "任务执行成功");
            }
            logCollector.collectLog(log);
            logContext.remove();
        }
    }
    
    private String getInstanceId() {
        try {
            return InetAddress.getLocalHost().getHostName() + "-" + 
                   ManagementFactory.getRuntimeMXBean().getName().split("@")[0];
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }
    
    private String getHostName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }
    
    private int getPort() {
        // 在实际应用中，可能需要从配置或环境变量中获取端口
        return 8080;
    }
}

// Elasticsearch 日志存储实现
public class ElasticsearchLogStorage implements LogStorage {
    private final RestHighLevelClient client;
    private final String indexName;
    
    public ElasticsearchLogStorage(RestHighLevelClient client, String indexName) {
        this.client = client;
        this.indexName = indexName;
    }
    
    @Override
    public void storeLogs(List<TaskExecutionLog> logs) throws Exception {
        BulkRequest bulkRequest = new BulkRequest();
        
        for (TaskExecutionLog log : logs) {
            IndexRequest indexRequest = new IndexRequest(indexName)
                .id(log.getLogId())
                .source(JSON.toJSONString(log), XContentType.JSON);
            bulkRequest.add(indexRequest);
        }
        
        BulkResponse bulkResponse = client.bulk(bulkRequest, RequestOptions.DEFAULT);
        if (bulkResponse.hasFailures()) {
            throw new RuntimeException("批量存储日志失败: " + bulkResponse.buildFailureMessage());
        }
    }
    
    @Override
    public List<TaskExecutionLog> queryLogs(LogQueryCondition condition) throws Exception {
        SearchRequest searchRequest = new SearchRequest(indexName);
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        
        // 构建查询条件
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        
        if (condition.getTaskId() != null) {
            boolQuery.must(QueryBuilders.termQuery("taskId", condition.getTaskId()));
        }
        
        if (condition.getStatus() != null) {
            boolQuery.must(QueryBuilders.termQuery("status", condition.getStatus().name()));
        }
        
        if (condition.getStartTime() != null) {
            boolQuery.must(QueryBuilders.rangeQuery("startTime")
                .gte(condition.getStartTime().toString()));
        }
        
        if (condition.getEndTime() != null) {
            boolQuery.must(QueryBuilders.rangeQuery("startTime")
                .lte(condition.getEndTime().toString()));
        }
        
        searchSourceBuilder.query(boolQuery);
        searchSourceBuilder.sort("startTime", SortOrder.DESC);
        searchSourceBuilder.size(condition.getLimit());
        
        searchRequest.source(searchSourceBuilder);
        
        SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
        
        List<TaskExecutionLog> logs = new ArrayList<>();
        for (SearchHit hit : searchResponse.getHits().getHits()) {
            String json = hit.getSourceAsString();
            TaskExecutionLog log = JSON.parseObject(json, TaskExecutionLog.class);
            logs.add(log);
        }
        
        return logs;
    }
    
    @Override
    public long countLogs(LogQueryCondition condition) throws Exception {
        CountRequest countRequest = new CountRequest(indexName);
        CountSourceBuilder countSourceBuilder = new CountSourceBuilder();
        
        // 构建查询条件
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        
        if (condition.getTaskId() != null) {
            boolQuery.must(QueryBuilders.termQuery("taskId", condition.getTaskId()));
        }
        
        if (condition.getStatus() != null) {
            boolQuery.must(QueryBuilders.termQuery("status", condition.getStatus().name()));
        }
        
        countSourceBuilder.query(boolQuery);
        countRequest.source(countSourceBuilder);
        
        CountResponse countResponse = client.count(countRequest, RequestOptions.DEFAULT);
        return countResponse.getCount();
    }
}
```

## 调度指标监控

除了日志信息，调度系统的各项性能指标也是监控的重要内容。通过监控关键指标，可以及时发现系统性能瓶颈和异常情况。

### 指标收集与上报

```java
// 调度指标收集器
@Component
public class SchedulingMetricsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Timer.Sample> taskSamples = new ConcurrentHashMap<>();
    
    public SchedulingMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    /**
     * 记录任务开始
     */
    public void recordTaskStart(String taskId, String groupName) {
        Timer.Sample sample = Timer.start(meterRegistry);
        taskSamples.put(taskId, sample);
        
        // 记录任务开始计数
        Counter.builder("scheduling.task.started")
            .tag("group", groupName)
            .register(meterRegistry)
            .increment();
    }
    
    /**
     * 记录任务完成
     */
    public void recordTaskCompletion(String taskId, String groupName, boolean success, long durationMs) {
        Timer.Sample sample = taskSamples.remove(taskId);
        if (sample != null) {
            sample.stop(Timer.builder("scheduling.task.duration")
                .tag("group", groupName)
                .tag("success", String.valueOf(success))
                .register(meterRegistry));
        }
        
        // 记录任务完成计数
        Counter.builder("scheduling.task.completed")
            .tag("group", groupName)
            .tag("success", String.valueOf(success))
            .register(meterRegistry)
            .increment();
        
        // 记录任务持续时间分布
        DistributionSummary.builder("scheduling.task.duration.summary")
            .tag("group", groupName)
            .tag("success", String.valueOf(success))
            .register(meterRegistry)
            .record(durationMs);
    }
    
    /**
     * 记录任务失败
     */
    public void recordTaskFailure(String taskId, String groupName, String errorType) {
        Counter.builder("scheduling.task.failed")
            .tag("group", groupName)
            .tag("error", errorType)
            .register(meterRegistry)
            .increment();
    }
    
    /**
     * 记录调度器状态
     */
    public void recordSchedulerStatus(boolean isRunning, int threadPoolSize, int activeThreads) {
        Gauge.builder("scheduling.scheduler.running")
            .register(meterRegistry, isRunning ? 1 : 0);
        
        Gauge.builder("scheduling.scheduler.threadpool.size")
            .register(meterRegistry, threadPoolSize);
        
        Gauge.builder("scheduling.scheduler.threadpool.active")
            .register(meterRegistry, activeThreads);
    }
    
    /**
     * 记录任务队列状态
     */
    public void recordTaskQueueStatus(int queueSize, int pendingTasks) {
        Gauge.builder("scheduling.task.queue.size")
            .register(meterRegistry, queueSize);
        
        Gauge.builder("scheduling.task.queue.pending")
            .register(meterRegistry, pendingTasks);
    }
}

// 调度监控拦截器
@Component
public class SchedulingMonitorInterceptor implements JobListener {
    private final SchedulingMetricsCollector metricsCollector;
    
    public SchedulingMonitorInterceptor(SchedulingMetricsCollector metricsCollector) {
        this.metricsCollector = metricsCollector;
    }
    
    @Override
    public String getName() {
        return "SchedulingMonitorInterceptor";
    }
    
    @Override
    public void jobToBeExecuted(JobExecutionContext context) {
        JobDetail jobDetail = context.getJobDetail();
        String taskId = jobDetail.getKey().getName();
        String groupName = jobDetail.getKey().getGroup();
        
        metricsCollector.recordTaskStart(taskId, groupName);
    }
    
    @Override
    public void jobExecutionVetoed(JobExecutionContext context) {
        JobDetail jobDetail = context.getJobDetail();
        String taskId = jobDetail.getKey().getName();
        String groupName = jobDetail.getKey().getGroup();
        
        metricsCollector.recordTaskFailure(taskId, groupName, "VETOED");
    }
    
    @Override
    public void jobWasExecuted(JobExecutionContext context, JobExecutionException jobException) {
        JobDetail jobDetail = context.getJobDetail();
        String taskId = jobDetail.getKey().getName();
        String groupName = jobDetail.getKey().getGroup();
        
        long durationMs = context.getJobRunTime();
        boolean success = jobException == null;
        
        metricsCollector.recordTaskCompletion(taskId, groupName, success, durationMs);
        
        if (jobException != null) {
            String errorType = jobException.getClass().getSimpleName();
            metricsCollector.recordTaskFailure(taskId, groupName, errorType);
        }
    }
}

// 系统资源监控
@Component
public class SystemResourceMonitor {
    private final MeterRegistry meterRegistry;
    private final ScheduledExecutorService scheduler;
    
    public SystemResourceMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.scheduler = Executors.newScheduledThreadPool(1);
        startMonitoring();
    }
    
    private void startMonitoring() {
        scheduler.scheduleAtFixedRate(this::collectSystemMetrics, 0, 30, TimeUnit.SECONDS);
    }
    
    private void collectSystemMetrics() {
        // CPU 使用率
        OperatingSystemMXBean osBean = ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);
        double cpuLoad = osBean.getSystemCpuLoad();
        if (cpuLoad >= 0) {
            Gauge.builder("system.cpu.load")
                .register(meterRegistry, cpuLoad);
        }
        
        // 内存使用情况
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
        MemoryUsage nonHeapUsage = memoryBean.getNonHeapMemoryUsage();
        
        Gauge.builder("jvm.memory.heap.used")
            .register(meterRegistry, heapUsage.getUsed());
        Gauge.builder("jvm.memory.heap.max")
            .register(meterRegistry, heapUsage.getMax());
        Gauge.builder("jvm.memory.nonheap.used")
            .register(meterRegistry, nonHeapUsage.getUsed());
        Gauge.builder("jvm.memory.nonheap.max")
            .register(meterRegistry, nonHeapUsage.getMax());
        
        // 线程信息
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        Gauge.builder("jvm.threads.live")
            .register(meterRegistry, threadBean.getThreadCount());
        Gauge.builder("jvm.threads.daemon")
            .register(meterRegistry, threadBean.getDaemonThreadCount());
        Gauge.builder("jvm.threads.peak")
            .register(meterRegistry, threadBean.getPeakThreadCount());
    }
    
    public void shutdown() {
        scheduler.shutdown();
    }
}
```

### 自定义指标仪表板

```java
// 指标查询服务
@Service
public class MetricsQueryService {
    private final MeterRegistry meterRegistry;
    
    public MetricsQueryService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    /**
     * 获取任务执行统计
     */
    public TaskExecutionStats getTaskExecutionStats(String groupName, Duration timeWindow) {
        TaskExecutionStats stats = new TaskExecutionStats();
        
        // 获取任务执行计数
        Counter startedCounter = meterRegistry.find("scheduling.task.started")
            .tag("group", groupName).counter();
        Counter completedCounter = meterRegistry.find("scheduling.task.completed")
            .tag("group", groupName).tag("success", "true").counter();
        Counter failedCounter = meterRegistry.find("scheduling.task.completed")
            .tag("group", groupName).tag("success", "false").counter();
        
        stats.setTasksStarted(startedCounter != null ? (long) startedCounter.count() : 0);
        stats.setTasksCompleted(completedCounter != null ? (long) completedCounter.count() : 0);
        stats.setTasksFailed(failedCounter != null ? (long) failedCounter.count() : 0);
        
        // 获取任务持续时间统计
        Timer durationTimer = meterRegistry.find("scheduling.task.duration")
            .tag("group", groupName).tag("success", "true").timer();
        
        if (durationTimer != null) {
            stats.setAverageDurationMs((long) durationTimer.mean(TimeUnit.MILLISECONDS));
            stats.setMaxDurationMs((long) durationTimer.max(TimeUnit.MILLISECONDS));
        }
        
        return stats;
    }
    
    /**
     * 获取系统资源统计
     */
    public SystemResourceStats getSystemResourceStats() {
        SystemResourceStats stats = new SystemResourceStats();
        
        // 获取 CPU 使用率
        Gauge cpuLoadGauge = meterRegistry.find("system.cpu.load").gauge();
        stats.setCpuLoad(cpuLoadGauge != null ? cpuLoadGauge.value() : 0.0);
        
        // 获取内存使用情况
        Gauge heapUsedGauge = meterRegistry.find("jvm.memory.heap.used").gauge();
        Gauge heapMaxGauge = meterRegistry.find("jvm.memory.heap.max").gauge();
        
        if (heapUsedGauge != null && heapMaxGauge != null) {
            stats.setHeapMemoryUsed((long) heapUsedGauge.value());
            stats.setHeapMemoryMax((long) heapMaxGauge.value());
            stats.setHeapMemoryUsage(heapMaxGauge.value() > 0 ? 
                heapUsedGauge.value() / heapMaxGauge.value() : 0.0);
        }
        
        // 获取线程信息
        Gauge liveThreadsGauge = meterRegistry.find("jvm.threads.live").gauge();
        Gauge daemonThreadsGauge = meterRegistry.find("jvm.threads.daemon").gauge();
        
        stats.setLiveThreads(liveThreadsGauge != null ? (int) liveThreadsGauge.value() : 0);
        stats.setDaemonThreads(daemonThreadsGauge != null ? (int) daemonThreadsGauge.value() : 0);
        
        return stats;
    }
}

// 任务执行统计
public class TaskExecutionStats {
    private long tasksStarted;
    private long tasksCompleted;
    private long tasksFailed;
    private long averageDurationMs;
    private long maxDurationMs;
    private double successRate;
    
    // 计算成功率
    public double getSuccessRate() {
        if (tasksStarted > 0) {
            return (double) tasksCompleted / tasksStarted;
        }
        return 0.0;
    }
    
    // getters and setters
    public long getTasksStarted() { return tasksStarted; }
    public void setTasksStarted(long tasksStarted) { this.tasksStarted = tasksStarted; }
    public long getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(long tasksCompleted) { this.tasksCompleted = tasksCompleted; }
    public long getTasksFailed() { return tasksFailed; }
    public void setTasksFailed(long tasksFailed) { this.tasksFailed = tasksFailed; }
    public long getAverageDurationMs() { return averageDurationMs; }
    public void setAverageDurationMs(long averageDurationMs) { this.averageDurationMs = averageDurationMs; }
    public long getMaxDurationMs() { return maxDurationMs; }
    public void setMaxDurationMs(long maxDurationMs) { this.maxDurationMs = maxDurationMs; }
    public void setSuccessRate(double successRate) { this.successRate = successRate; }
}

// 系统资源统计
public class SystemResourceStats {
    private double cpuLoad;
    private long heapMemoryUsed;
    private long heapMemoryMax;
    private double heapMemoryUsage;
    private int liveThreads;
    private int daemonThreads;
    
    // getters and setters
    public double getCpuLoad() { return cpuLoad; }
    public void setCpuLoad(double cpuLoad) { this.cpuLoad = cpuLoad; }
    public long getHeapMemoryUsed() { return heapMemoryUsed; }
    public void setHeapMemoryUsed(long heapMemoryUsed) { this.heapMemoryUsed = heapMemoryUsed; }
    public long getHeapMemoryMax() { return heapMemoryMax; }
    public void setHeapMemoryMax(long heapMemoryMax) { this.heapMemoryMax = heapMemoryMax; }
    public double getHeapMemoryUsage() { return heapMemoryUsage; }
    public void setHeapMemoryUsage(double heapMemoryUsage) { this.heapMemoryUsage = heapMemoryUsage; }
    public int getLiveThreads() { return liveThreads; }
    public void setLiveThreads(int liveThreads) { this.liveThreads = liveThreads; }
    public int getDaemonThreads() { return daemonThreads; }
    public void setDaemonThreads(int daemonThreads) { this.daemonThreads = daemonThreads; }
}

// 监控仪表板控制器
@RestController
@RequestMapping("/api/monitoring")
public class MonitoringDashboardController {
    private final MetricsQueryService metricsQueryService;
    private final LogStorage logStorage;
    
    public MonitoringDashboardController(MetricsQueryService metricsQueryService, 
                                       LogStorage logStorage) {
        this.metricsQueryService = metricsQueryService;
        this.logStorage = logStorage;
    }
    
    @GetMapping("/stats/tasks")
    public ResponseEntity<TaskExecutionStats> getTaskStats(
            @RequestParam(defaultValue = "DEFAULT") String groupName,
            @RequestParam(defaultValue = "PT1H") String timeWindow) {
        
        Duration duration = Duration.parse(timeWindow);
        TaskExecutionStats stats = metricsQueryService.getTaskExecutionStats(groupName, duration);
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/stats/system")
    public ResponseEntity<SystemResourceStats> getSystemStats() {
        SystemResourceStats stats = metricsQueryService.getSystemResourceStats();
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/logs")
    public ResponseEntity<List<TaskExecutionLog>> getLogs(
            @RequestParam(required = false) String taskId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "100") int limit) {
        
        LogQueryCondition condition = LogQueryCondition.builder()
            .taskId(taskId)
            .limit(limit)
            .build();
            
        if (status != null) {
            condition.setStatus(TaskStatus.valueOf(status.toUpperCase()));
        }
        
        try {
            List<TaskExecutionLog> logs = logStorage.queryLogs(condition);
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
```

## 告警与自动化运维

完善的告警机制和自动化运维能力是保障调度系统稳定运行的重要手段。通过设置合理的告警规则和自动化处理流程，可以大幅减少人工干预，提高运维效率。

### 告警规则引擎

```java
// 告警规则
public class AlertRule {
    private String ruleId;
    private String name;
    private String description;
    private AlertCondition condition;
    private AlertAction action;
    private int severity; // 1-5，数字越大严重程度越高
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // constructors
    public AlertRule(String ruleId, String name, AlertCondition condition, AlertAction action) {
        this.ruleId = ruleId;
        this.name = name;
        this.condition = condition;
        this.action = action;
        this.severity = 3;
        this.enabled = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    // getters and setters
    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public AlertCondition getCondition() { return condition; }
    public void setCondition(AlertCondition condition) { this.condition = condition; }
    public AlertAction getAction() { return action; }
    public void setAction(AlertAction action) { this.action = action; }
    public int getSeverity() { return severity; }
    public void setSeverity(int severity) { this.severity = severity; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

// 告警条件接口
public interface AlertCondition {
    boolean evaluate(MeterRegistry meterRegistry);
    String getDescription();
}

// 任务失败率告警条件
public class TaskFailureRateCondition implements AlertCondition {
    private final String groupName;
    private final double threshold; // 失败率阈值 (0-1)
    private final Duration timeWindow; // 时间窗口
    
    public TaskFailureRateCondition(String groupName, double threshold, Duration timeWindow) {
        this.groupName = groupName;
        this.threshold = threshold;
        this.timeWindow = timeWindow;
    }
    
    @Override
    public boolean evaluate(MeterRegistry meterRegistry) {
        Counter failedCounter = meterRegistry.find("scheduling.task.completed")
            .tag("group", groupName).tag("success", "false").counter();
        Counter totalCounter = meterRegistry.find("scheduling.task.completed")
            .tag("group", groupName).counter();
        
        if (failedCounter == null || totalCounter == null) {
            return false;
        }
        
        double failedCount = failedCounter.count();
        double totalCount = totalCounter.count();
        
        if (totalCount == 0) {
            return false;
        }
        
        double failureRate = failedCount / totalCount;
        return failureRate >= threshold;
    }
    
    @Override
    public String getDescription() {
        return String.format("任务组 %s 失败率超过 %.2f%%", groupName, threshold * 100);
    }
}

// 系统资源告警条件
public class SystemResourceCondition implements AlertCondition {
    private final String resourceType; // cpu, memory, threads
    private final double threshold;
    
    public SystemResourceCondition(String resourceType, double threshold) {
        this.resourceType = resourceType;
        this.threshold = threshold;
    }
    
    @Override
    public boolean evaluate(MeterRegistry meterRegistry) {
        Gauge gauge = null;
        
        switch (resourceType.toLowerCase()) {
            case "cpu":
                gauge = meterRegistry.find("system.cpu.load").gauge();
                break;
            case "memory":
                Gauge heapMax = meterRegistry.find("jvm.memory.heap.max").gauge();
                Gauge heapUsed = meterRegistry.find("jvm.memory.heap.used").gauge();
                if (heapMax != null && heapUsed != null && heapMax.value() > 0) {
                    return (heapUsed.value() / heapMax.value()) >= threshold;
                }
                return false;
            case "threads":
                gauge = meterRegistry.find("jvm.threads.live").gauge();
                break;
        }
        
        return gauge != null && gauge.value() >= threshold;
    }
    
    @Override
    public String getDescription() {
        return String.format("系统资源 %s 使用率超过 %.2f%%", resourceType, threshold * 100);
    }
}

// 告警动作接口
public interface AlertAction {
    void execute(AlertRule rule, String message);
}

// 邮件告警动作
public class EmailAlertAction implements AlertAction {
    private final EmailService emailService;
    private final List<String> recipients;
    
    public EmailAlertAction(EmailService emailService, List<String> recipients) {
        this.emailService = emailService;
        this.recipients = new ArrayList<>(recipients);
    }
    
    @Override
    public void execute(AlertRule rule, String message) {
        String subject = String.format("[告警] %s - %s", 
                                     rule.getSeverity() >= 4 ? "紧急" : "一般", 
                                     rule.getName());
        
        for (String recipient : recipients) {
            try {
                emailService.sendEmail(recipient, subject, message);
            } catch (Exception e) {
                System.err.println("发送告警邮件失败: " + e.getMessage());
            }
        }
    }
}

// 短信告警动作
public class SmsAlertAction implements AlertAction {
    private final SmsService smsService;
    private final List<String> phoneNumbers;
    
    public SmsAlertAction(SmsService smsService, List<String> phoneNumbers) {
        this.smsService = smsService;
        this.phoneNumbers = new ArrayList<>(phoneNumbers);
    }
    
    @Override
    public void execute(AlertRule rule, String message) {
        String smsMessage = String.format("[调度系统告警] %s: %s", rule.getName(), message);
        
        for (String phoneNumber : phoneNumbers) {
            try {
                smsService.sendSms(phoneNumber, smsMessage);
            } catch (Exception e) {
                System.err.println("发送告警短信失败: " + e.getMessage());
            }
        }
    }
}

// Webhook 告警动作
public class WebhookAlertAction implements AlertAction {
    private final RestTemplate restTemplate;
    private final String webhookUrl;
    private final Map<String, String> headers;
    
    public WebhookAlertAction(RestTemplate restTemplate, String webhookUrl, 
                             Map<String, String> headers) {
        this.restTemplate = restTemplate;
        this.webhookUrl = webhookUrl;
        this.headers = new HashMap<>(headers);
    }
    
    @Override
    public void execute(AlertRule rule, String message) {
        try {
            HttpHeaders httpHeaders = new HttpHeaders();
            headers.forEach(httpHeaders::add);
            httpHeaders.setContentType(MediaType.APPLICATION_JSON);
            
            AlertWebhookPayload payload = new AlertWebhookPayload();
            payload.setRuleId(rule.getRuleId());
            payload.setRuleName(rule.getName());
            payload.setSeverity(rule.getSeverity());
            payload.setMessage(message);
            payload.setTimestamp(System.currentTimeMillis());
            
            HttpEntity<AlertWebhookPayload> entity = new HttpEntity<>(payload, httpHeaders);
            restTemplate.postForEntity(webhookUrl, entity, String.class);
        } catch (Exception e) {
            System.err.println("发送 Webhook 告警失败: " + e.getMessage());
        }
    }
}

// Webhook 告警载荷
public class AlertWebhookPayload {
    private String ruleId;
    private String ruleName;
    private int severity;
    private String message;
    private long timestamp;
    
    // getters and setters
    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }
    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }
    public int getSeverity() { return severity; }
    public void setSeverity(int severity) { this.severity = severity; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}

// 告警规则管理器
@Component
public class AlertRuleManager {
    private final List<AlertRule> alertRules = new CopyOnWriteArrayList<>();
    private final MeterRegistry meterRegistry;
    private final ScheduledExecutorService scheduler;
    
    public AlertRuleManager(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.scheduler = Executors.newScheduledThreadPool(2);
        startRuleEvaluation();
    }
    
    /**
     * 添加告警规则
     */
    public void addAlertRule(AlertRule rule) {
        alertRules.add(rule);
    }
    
    /**
     * 移除告警规则
     */
    public void removeAlertRule(String ruleId) {
        alertRules.removeIf(rule -> rule.getRuleId().equals(ruleId));
    }
    
    /**
     * 更新告警规则
     */
    public void updateAlertRule(AlertRule updatedRule) {
        alertRules.removeIf(rule -> rule.getRuleId().equals(updatedRule.getRuleId()));
        alertRules.add(updatedRule);
    }
    
    /**
     * 获取所有告警规则
     */
    public List<AlertRule> getAllAlertRules() {
        return new ArrayList<>(alertRules);
    }
    
    /**
     * 开始规则评估
     */
    private void startRuleEvaluation() {
        scheduler.scheduleAtFixedRate(this::evaluateRules, 0, 60, TimeUnit.SECONDS);
    }
    
    /**
     * 评估所有规则
     */
    private void evaluateRules() {
        for (AlertRule rule : alertRules) {
            if (!rule.isEnabled()) {
                continue;
            }
            
            try {
                if (rule.getCondition().evaluate(meterRegistry)) {
                    String message = String.format("告警规则触发: %s - %s", 
                                                 rule.getName(), 
                                                 rule.getCondition().getDescription());
                    rule.getAction().execute(rule, message);
                }
            } catch (Exception e) {
                System.err.println("评估告警规则失败: " + rule.getRuleId() + ", " + e.getMessage());
            }
        }
    }
    
    public void shutdown() {
        scheduler.shutdown();
    }
}
```

### 自动化运维

```java
// 自动化运维服务
@Service
public class AutomatedOperationsService {
    private final Scheduler scheduler;
    private final JobSchedulingService jobSchedulingService;
    private final LogStorage logStorage;
    
    public AutomatedOperationsService(Scheduler scheduler, 
                                   JobSchedulingService jobSchedulingService,
                                   LogStorage logStorage) {
        this.scheduler = scheduler;
        this.jobSchedulingService = jobSchedulingService;
        this.logStorage = logStorage;
    }
    
    /**
     * 自动重启失败的任务
     */
    public void autoRestartFailedTasks(String groupName, int maxRetries) {
        try {
            // 查询最近失败的任务
            LogQueryCondition condition = LogQueryCondition.builder()
                .status(TaskStatus.FAILED)
                .limit(100)
                .build();
            
            List<TaskExecutionLog> failedLogs = logStorage.queryLogs(condition);
            
            // 按任务ID分组，统计失败次数
            Map<String, List<TaskExecutionLog>> taskFailures = failedLogs.stream()
                .filter(log -> groupName.equals(log.getGroupName()))
                .collect(Collectors.groupingBy(TaskExecutionLog::getTaskId));
            
            // 重启失败次数在阈值内的任务
            for (Map.Entry<String, List<TaskExecutionLog>> entry : taskFailures.entrySet()) {
                String taskId = entry.getKey();
                List<TaskExecutionLog> failures = entry.getValue();
                
                if (failures.size() <= maxRetries) {
                    System.out.println("自动重启任务: " + taskId);
                    // 这里应该触发任务重启逻辑
                    // jobSchedulingService.restartJob(taskId, groupName);
                }
            }
        } catch (Exception e) {
            System.err.println("自动重启失败任务时出错: " + e.getMessage());
        }
    }
    
    /**
     * 自动清理过期日志
     */
    public void autoCleanupExpiredLogs(Duration retentionPeriod) {
        try {
            LocalDateTime cutoffTime = LocalDateTime.now().minus(retentionPeriod);
            
            // 这里应该实现日志清理逻辑
            // logStorage.deleteLogsBefore(cutoffTime);
            
            System.out.println("自动清理过期日志完成");
        } catch (Exception e) {
            System.err.println("自动清理过期日志时出错: " + e.getMessage());
        }
    }
    
    /**
     * 自动生成健康报告
     */
    public void generateHealthReport() {
        try {
            // 收集系统健康信息
            HealthReport report = new HealthReport();
            report.setGeneratedAt(LocalDateTime.now());
            
            // 收集调度器状态
            report.setSchedulerStatus(scheduler.isStarted() ? "RUNNING" : "STOPPED");
            
            // 收集任务执行统计
            // 这里应该调用指标收集服务获取统计数据
            
            // 发送报告
            sendHealthReport(report);
            
            System.out.println("健康报告生成完成");
        } catch (Exception e) {
            System.err.println("生成健康报告时出错: " + e.getMessage());
        }
    }
    
    private void sendHealthReport(HealthReport report) {
        // 实现报告发送逻辑
        System.out.println("发送健康报告: " + report.getGeneratedAt());
    }
}

// 健康报告
public class HealthReport {
    private LocalDateTime generatedAt;
    private String schedulerStatus;
    private TaskExecutionStats taskStats;
    private SystemResourceStats resourceStats;
    private List<String> warnings = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    
    // getters and setters
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public String getSchedulerStatus() { return schedulerStatus; }
    public void setSchedulerStatus(String schedulerStatus) { this.schedulerStatus = schedulerStatus; }
    public TaskExecutionStats getTaskStats() { return taskStats; }
    public void setTaskStats(TaskExecutionStats taskStats) { this.taskStats = taskStats; }
    public SystemResourceStats getResourceStats() { return resourceStats; }
    public void setResourceStats(SystemResourceStats resourceStats) { this.resourceStats = resourceStats; }
    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
}

// 自动化运维调度器
@Component
public class AutomatedOperationsScheduler {
    private final ScheduledExecutorService scheduler;
    private final AutomatedOperationsService operationsService;
    
    public AutomatedOperationsScheduler(AutomatedOperationsService operationsService) {
        this.operationsService = operationsService;
        this.scheduler = Executors.newScheduledThreadPool(2);
        scheduleAutomatedOperations();
    }
    
    private void scheduleAutomatedOperations() {
        // 每小时检查并重启失败任务
        scheduler.scheduleAtFixedRate(() -> {
            operationsService.autoRestartFailedTasks("DEFAULT", 3);
        }, 0, 1, TimeUnit.HOURS);
        
        // 每天凌晨2点清理过期日志（保留30天）
        scheduler.scheduleAtFixedRate(() -> {
            operationsService.autoCleanupExpiredLogs(Duration.ofDays(30));
        }, 0, 1, TimeUnit.DAYS);
        
        // 每天上午9点生成健康报告
        scheduler.scheduleAtFixedRate(() -> {
            operationsService.generateHealthReport();
        }, 0, 1, TimeUnit.DAYS);
    }
    
    public void shutdown() {
        scheduler.shutdown();
    }
}
```

## 监控与运维最佳实践

### 1. 监控指标设计

```java
// 核心监控指标枚举
public enum SchedulingMetrics {
    TASK_STARTED("scheduling.task.started", "任务开始执行次数"),
    TASK_COMPLETED("scheduling.task.completed", "任务完成次数"),
    TASK_FAILED("scheduling.task.failed", "任务失败次数"),
    TASK_DURATION("scheduling.task.duration", "任务执行时长"),
    SCHEDULER_RUNNING("scheduling.scheduler.running", "调度器运行状态"),
    THREAD_POOL_SIZE("scheduling.scheduler.threadpool.size", "线程池大小"),
    ACTIVE_THREADS("scheduling.scheduler.threadpool.active", "活跃线程数"),
    TASK_QUEUE_SIZE("scheduling.task.queue.size", "任务队列大小"),
    PENDING_TASKS("scheduling.task.queue.pending", "待处理任务数");
    
    private final String name;
    private final String description;
    
    SchedulingMetrics(String name, String description) {
        this.name = name;
        this.description = description;
    }
    
    public String getName() { return name; }
    public String getDescription() { return description; }
}
```

### 2. 告警策略配置

```java
// 告警策略配置
@Configuration
public class AlertingConfiguration {
    
    @Bean
    public AlertRule taskFailureRateAlertRule(MeterRegistry meterRegistry) {
        AlertCondition condition = new TaskFailureRateCondition("DEFAULT", 0.1, Duration.ofMinutes(5));
        AlertAction action = new EmailAlertAction(emailService(), Arrays.asList("admin@example.com"));
        
        AlertRule rule = new AlertRule("TASK_FAILURE_HIGH", "任务高失败率告警", condition, action);
        rule.setDescription("默认任务组5分钟内失败率超过10%");
        rule.setSeverity(4);
        
        return rule;
    }
    
    @Bean
    public AlertRule systemResourceAlertRule(MeterRegistry meterRegistry) {
        AlertCondition condition = new SystemResourceCondition("memory", 0.85);
        AlertAction action = new WebhookAlertAction(restTemplate(), 
            "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK", 
            Collections.singletonMap("Authorization", "Bearer your-token"));
        
        AlertRule rule = new AlertRule("HIGH_MEMORY_USAGE", "高内存使用率告警", condition, action);
        rule.setDescription("系统内存使用率超过85%");
        rule.setSeverity(3);
        
        return rule;
    }
    
    private EmailService emailService() {
        // 邮件服务实现
        return new EmailService();
    }
    
    private RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

## 总结

监控与运维是保障分布式任务调度系统稳定运行的关键环节。通过建立完善的日志采集体系、指标监控机制和自动化运维能力，可以显著提高系统的可靠性和运维效率。

关键要点包括：

1. **日志采集**：实现异步、批量的日志采集和存储，支持多种存储后端
2. **指标监控**：收集关键性能指标，提供实时监控和历史数据分析
3. **告警机制**：建立灵活的告警规则引擎，支持多种告警方式
4. **自动化运维**：实现故障自愈、日志清理、健康报告等自动化操作

在实际应用中，需要根据具体的业务需求和系统规模，选择合适的监控工具和技术栈，并建立完善的监控运维体系，确保调度系统能够稳定可靠地运行。

在下一章中，我们将展望调度系统的未来发展趋势，包括云原生与容器化调度、AI驱动的智能调度、调度平台的未来演进等内容。