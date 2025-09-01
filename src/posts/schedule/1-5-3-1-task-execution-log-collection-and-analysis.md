---
title: 18.1 任务执行日志采集与分析
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，任务执行日志是了解系统运行状态、排查问题和优化性能的重要信息来源。有效的日志采集与分析机制不仅能够帮助运维人员快速定位和解决问题，还能为系统优化提供数据支持。本文将深入探讨任务执行日志的采集策略、存储方案以及分析方法。

## 日志采集的重要性

在复杂的分布式调度环境中，任务可能在不同的节点上执行，产生大量的日志信息。如果没有统一的日志采集和分析机制，将很难全面了解系统的运行状况，也无法及时发现和解决问题。

### 日志采集面临的挑战

1. **分布式环境**：任务可能在多个节点上执行，日志分散在不同位置
2. **海量数据**：大规模系统每天可能产生TB级别的日志数据
3. **实时性要求**：需要实时或近实时地采集和分析日志
4. **结构化处理**：需要将非结构化的日志信息转换为结构化数据便于分析

## 日志采集架构设计

一个完整的日志采集系统通常包含以下几个组件：

### 1. 日志生成

任务执行过程中产生的日志信息，包括任务开始、执行过程、结束状态等。

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import java.time.LocalDateTime;
import java.util.UUID;

public class TaskLogger {
    private static final Logger logger = LoggerFactory.getLogger(TaskLogger.class);
    
    /**
     * 记录任务开始日志
     */
    public static void logTaskStart(String taskId, String taskName, String groupName) {
        MDC.put("taskId", taskId);
        MDC.put("taskName", taskName);
        MDC.put("groupName", groupName);
        MDC.put("eventType", "TASK_START");
        
        logger.info("任务开始执行 - 任务ID: {}, 任务名称: {}, 分组: {}", 
                   taskId, taskName, groupName);
    }
    
    /**
     * 记录任务执行过程日志
     */
    public static void logTaskProgress(String taskId, String message, Object... params) {
        MDC.put("taskId", taskId);
        MDC.put("eventType", "TASK_PROGRESS");
        
        logger.info("任务执行进度 - 任务ID: {}, 消息: " + message, 
                   taskId, params);
    }
    
    /**
     * 记录任务完成日志
     */
    public static void logTaskCompletion(String taskId, boolean success, 
                                       String message, long durationMs) {
        MDC.put("taskId", taskId);
        MDC.put("eventType", "TASK_COMPLETION");
        MDC.put("success", String.valueOf(success));
        MDC.put("durationMs", String.valueOf(durationMs));
        
        if (success) {
            logger.info("任务执行成功 - 任务ID: {}, 执行时间: {}ms, 消息: {}", 
                       taskId, durationMs, message);
        } else {
            logger.error("任务执行失败 - 任务ID: {}, 执行时间: {}ms, 错误信息: {}", 
                        taskId, durationMs, message);
        }
    }
    
    /**
     * 记录任务异常日志
     */
    public static void logTaskException(String taskId, Exception exception) {
        MDC.put("taskId", taskId);
        MDC.put("eventType", "TASK_EXCEPTION");
        
        logger.error("任务执行异常 - 任务ID: " + taskId, exception);
    }
    
    /**
     * 清理MDC上下文
     */
    public static void clearContext() {
        MDC.clear();
    }
}

// 任务执行示例
public class SampleTask {
    private static final Logger logger = LoggerFactory.getLogger(SampleTask.class);
    
    public void execute(String taskId, String taskName) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 记录任务开始
            TaskLogger.logTaskStart(taskId, taskName, "DEFAULT_GROUP");
            
            // 模拟任务执行过程
            for (int i = 1; i <= 10; i++) {
                // 模拟工作
                Thread.sleep(1000);
                
                // 记录进度
                TaskLogger.logTaskProgress(taskId, "处理进度: {}%", i * 10);
            }
            
            long duration = System.currentTimeMillis() - startTime;
            // 记录任务完成
            TaskLogger.logTaskCompletion(taskId, true, "任务执行完成", duration);
            
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            // 记录异常
            TaskLogger.logTaskException(taskId, e);
            // 记录任务失败
            TaskLogger.logTaskCompletion(taskId, false, "任务执行失败: " + e.getMessage(), duration);
        } finally {
            // 清理上下文
            TaskLogger.clearContext();
        }
    }
}
```

### 2. 日志收集器

负责从各个节点收集日志信息，并进行初步处理。

```java
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class LogCollector {
    private final String logDirectory;
    private final BlockingQueue<LogEntry> logQueue;
    private final ScheduledExecutorService scheduler;
    private final Pattern logPattern;
    private volatile boolean running = true;
    
    public LogCollector(String logDirectory) {
        this.logDirectory = logDirectory;
        this.logQueue = new LinkedBlockingQueue<>(10000);
        this.scheduler = Executors.newScheduledThreadPool(2);
        // 日志解析正则表达式
        this.logPattern = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}) \\[(.*?)\\] (INFO|WARN|ERROR) (.*)"
        );
    }
    
    /**
     * 启动日志收集器
     */
    public void start() {
        // 启动文件监控
        scheduler.scheduleAtFixedRate(this::collectLogs, 0, 5, TimeUnit.SECONDS);
        
        // 启动日志处理
        scheduler.scheduleAtFixedRate(this::processLogs, 0, 1, TimeUnit.SECONDS);
        
        System.out.println("日志收集器已启动，监控目录: " + logDirectory);
    }
    
    /**
     * 收集日志文件
     */
    private void collectLogs() {
        if (!running) return;
        
        try {
            Path logPath = Paths.get(logDirectory);
            if (!Files.exists(logPath)) {
                System.err.println("日志目录不存在: " + logDirectory);
                return;
            }
            
            // 遍历日志文件
            Files.walk(logPath)
                .filter(Files::isRegularFile)
                .filter(path -> path.toString().endsWith(".log"))
                .forEach(this::processLogFile);
                
        } catch (Exception e) {
            System.err.println("收集日志文件时出错: " + e.getMessage());
        }
    }
    
    /**
     * 处理单个日志文件
     */
    private void processLogFile(Path logFile) {
        try (BufferedReader reader = Files.newBufferedReader(logFile)) {
            String line;
            while ((line = reader.readLine()) != null) {
                LogEntry logEntry = parseLogLine(line);
                if (logEntry != null) {
                    // 将解析后的日志放入队列
                    if (!logQueue.offer(logEntry, 1, TimeUnit.SECONDS)) {
                        System.err.println("日志队列已满，丢弃日志: " + line);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("处理日志文件 " + logFile + " 时出错: " + e.getMessage());
        }
    }
    
    /**
     * 解析日志行
     */
    private LogEntry parseLogLine(String line) {
        Matcher matcher = logPattern.matcher(line);
        if (matcher.matches()) {
            try {
                LocalDateTime timestamp = LocalDateTime.parse(matcher.group(1));
                String thread = matcher.group(2);
                String level = matcher.group(3);
                String message = matcher.group(4);
                
                return new LogEntry(timestamp, thread, level, message, line);
            } catch (Exception e) {
                System.err.println("解析日志行失败: " + line);
            }
        }
        return null;
    }
    
    /**
     * 处理日志队列
     */
    private void processLogs() {
        try {
            int processedCount = 0;
            LogEntry logEntry;
            
            // 批量处理日志
            while ((logEntry = logQueue.poll()) != null && processedCount < 100) {
                // 这里可以进行日志过滤、转换等处理
                processLogEntry(logEntry);
                processedCount++;
            }
            
            if (processedCount > 0) {
                System.out.println("处理了 " + processedCount + " 条日志");
            }
            
        } catch (Exception e) {
            System.err.println("处理日志队列时出错: " + e.getMessage());
        }
    }
    
    /**
     * 处理单条日志
     */
    private void processLogEntry(LogEntry logEntry) {
        // 这里可以实现具体的日志处理逻辑
        // 例如：发送到消息队列、存储到数据库、转发到日志分析系统等
        
        // 示例：简单输出
        if ("ERROR".equals(logEntry.getLevel())) {
            System.err.println("错误日志: " + logEntry.getMessage());
        }
    }
    
    /**
     * 停止日志收集器
     */
    public void stop() {
        running = false;
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("日志收集器已停止");
    }
}

/**
 * 日志条目类
 */
class LogEntry {
    private final LocalDateTime timestamp;
    private final String thread;
    private final String level;
    private final String message;
    private final String rawLine;
    
    public LogEntry(LocalDateTime timestamp, String thread, String level, 
                   String message, String rawLine) {
        this.timestamp = timestamp;
        this.thread = thread;
        this.level = level;
        this.message = message;
        this.rawLine = rawLine;
    }
    
    // Getters
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getThread() { return thread; }
    public String getLevel() { return level; }
    public String getMessage() { return message; }
    public String getRawLine() { return rawLine; }
}
```

### 3. 日志传输

将收集到的日志信息传输到中央存储或分析系统。

```java
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import com.fasterxml.jackson.databind.ObjectMapper;

public class LogTransporter {
    private final BlockingQueue<LogEntry> transportQueue;
    private final ScheduledExecutorService scheduler;
    private final ObjectMapper objectMapper;
    private final AtomicLong sentCount = new AtomicLong(0);
    private final AtomicLong errorCount = new AtomicLong(0);
    
    // 模拟的日志存储服务
    private final LogStorageService logStorageService;
    
    public LogTransporter() {
        this.transportQueue = new LinkedBlockingQueue<>(5000);
        this.scheduler = Executors.newScheduledThreadPool(2);
        this.objectMapper = new ObjectMapper();
        this.logStorageService = new LogStorageService();
    }
    
    /**
     * 添加日志到传输队列
     */
    public boolean addLog(LogEntry logEntry) {
        return transportQueue.offer(logEntry);
    }
    
    /**
     * 批量添加日志
     */
    public boolean addLogs(List<LogEntry> logEntries) {
        for (LogEntry entry : logEntries) {
            if (!transportQueue.offer(entry)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 启动传输器
     */
    public void start() {
        // 启动批量传输任务
        scheduler.scheduleAtFixedRate(this::batchTransport, 0, 2, TimeUnit.SECONDS);
        
        // 启动监控任务
        scheduler.scheduleAtFixedRate(this::logStats, 0, 30, TimeUnit.SECONDS);
        
        System.out.println("日志传输器已启动");
    }
    
    /**
     * 批量传输日志
     */
    private void batchTransport() {
        try {
            int batchSize = 100;
            int processedCount = 0;
            
            while (processedCount < batchSize) {
                LogEntry logEntry = transportQueue.poll(100, TimeUnit.MILLISECONDS);
                if (logEntry == null) {
                    break;
                }
                
                // 批量处理日志
                processBatch(logEntry);
                processedCount++;
            }
            
            if (processedCount > 0) {
                sentCount.addAndGet(processedCount);
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            errorCount.incrementAndGet();
            System.err.println("批量传输日志时出错: " + e.getMessage());
        }
    }
    
    /**
     * 处理日志批次
     */
    private void processBatch(LogEntry logEntry) {
        try {
            // 将日志条目转换为JSON格式
            String jsonLog = objectMapper.writeValueAsString(logEntry);
            
            // 发送到日志存储服务
            logStorageService.storeLog(jsonLog);
            
        } catch (Exception e) {
            errorCount.incrementAndGet();
            System.err.println("处理日志批次时出错: " + e.getMessage());
        }
    }
    
    /**
     * 记录统计信息
     */
    private void logStats() {
        long sent = sentCount.get();
        long errors = errorCount.get();
        int queueSize = transportQueue.size();
        
        System.out.printf("日志传输统计 - 已发送: %d, 错误: %d, 队列大小: %d%n", 
                         sent, errors, queueSize);
    }
    
    /**
     * 停止传输器
     */
    public void stop() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("日志传输器已停止");
    }
}

/**
 * 模拟的日志存储服务
 */
class LogStorageService {
    public void storeLog(String jsonLog) {
        // 模拟日志存储
        // 在实际应用中，这里可能是发送到Kafka、Elasticsearch、数据库等
        System.out.println("存储日志: " + jsonLog.substring(0, Math.min(jsonLog.length(), 100)) + "...");
    }
}
```

## 日志存储方案

### 1. 关系型数据库存储

适用于结构化日志数据的存储和查询。

```sql
-- 任务执行日志表
CREATE TABLE task_execution_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(64) NOT NULL,
    task_name VARCHAR(128) NOT NULL,
    group_name VARCHAR(64),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms BIGINT,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    error_stack_trace TEXT,
    host_name VARCHAR(64),
    instance_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status)
);

-- 日志查询示例
SELECT * FROM task_execution_logs 
WHERE start_time >= '2025-08-01 00:00:00' 
AND status = 'ERROR' 
ORDER BY start_time DESC 
LIMIT 100;
```

### 2. Elasticsearch 存储

适用于海量日志数据的存储和全文检索。

```java
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.xcontent.XContentType;
import java.io.IOException;
import java.time.format.DateTimeFormatter;

public class ElasticsearchLogStorage {
    private final RestHighLevelClient client;
    private final String indexName;
    
    public ElasticsearchLogStorage(RestHighLevelClient client, String indexName) {
        this.client = client;
        this.indexName = indexName;
    }
    
    /**
     * 存储日志到Elasticsearch
     */
    public void storeLog(LogEntry logEntry) throws IOException {
        // 构建日志文档
        String logDocument = buildLogDocument(logEntry);
        
        // 创建索引请求
        IndexRequest request = new IndexRequest(indexName)
                .id(generateDocumentId(logEntry))
                .source(logDocument, XContentType.JSON);
        
        // 执行索引操作
        IndexResponse response = client.index(request, RequestOptions.DEFAULT);
        
        System.out.println("日志已存储到Elasticsearch，文档ID: " + response.getId());
    }
    
    /**
     * 构建日志文档
     */
    private String buildLogDocument(LogEntry logEntry) {
        return String.format("""
            {
                "timestamp": "%s",
                "thread": "%s",
                "level": "%s",
                "message": "%s",
                "raw_line": "%s"
            }
            """,
            logEntry.getTimestamp().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            logEntry.getThread(),
            logEntry.getLevel(),
            logEntry.getMessage().replace("\"", "\\\""),
            logEntry.getRawLine().replace("\"", "\\\"")
        );
    }
    
    /**
     * 生成文档ID
     */
    private String generateDocumentId(LogEntry logEntry) {
        return logEntry.getTimestamp().toString() + "_" + 
               logEntry.getThread() + "_" + 
               System.currentTimeMillis();
    }
}
```

## 日志分析与监控

### 1. 实时监控面板

```java
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.Map;

public class LogAnalyticsDashboard {
    private final Map<String, AtomicLong> errorCountByTask = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> executionCountByTask = new ConcurrentHashMap<>();
    private final AtomicLong totalErrors = new AtomicLong(0);
    private final AtomicLong totalExecutions = new AtomicLong(0);
    private final ConcurrentHashMap<String, Long> lastExecutionTime = new ConcurrentHashMap<>();
    
    /**
     * 处理日志条目并更新统计信息
     */
    public void processLogEntry(LogEntry logEntry) {
        // 解析任务相关信息（这里简化处理）
        String taskInfo = extractTaskInfo(logEntry.getMessage());
        if (taskInfo != null) {
            // 更新执行计数
            executionCountByTask.computeIfAbsent(taskInfo, k -> new AtomicLong(0))
                               .incrementAndGet();
            totalExecutions.incrementAndGet();
            
            // 更新最后执行时间
            lastExecutionTime.put(taskInfo, System.currentTimeMillis());
            
            // 如果是错误日志，更新错误计数
            if ("ERROR".equals(logEntry.getLevel())) {
                errorCountByTask.computeIfAbsent(taskInfo, k -> new AtomicLong(0))
                               .incrementAndGet();
                totalErrors.incrementAndGet();
            }
        }
    }
    
    /**
     * 提取任务信息
     */
    private String extractTaskInfo(String message) {
        // 简化的任务信息提取逻辑
        if (message.contains("任务ID:")) {
            int start = message.indexOf("任务ID:") + 5;
            int end = message.indexOf(",", start);
            if (end == -1) end = message.length();
            return message.substring(start, end).trim();
        }
        return null;
    }
    
    /**
     * 获取任务错误率
     */
    public double getTaskErrorRate(String taskId) {
        AtomicLong executions = executionCountByTask.get(taskId);
        AtomicLong errors = errorCountByTask.get(taskId);
        
        if (executions == null || executions.get() == 0) {
            return 0.0;
        }
        
        return (double) (errors != null ? errors.get() : 0) / executions.get();
    }
    
    /**
     * 获取系统整体错误率
     */
    public double getSystemErrorRate() {
        long totalExec = totalExecutions.get();
        if (totalExec == 0) {
            return 0.0;
        }
        return (double) totalErrors.get() / totalExec;
    }
    
    /**
     * 获取最近执行的任务
     */
    public Map<String, Long> getRecentExecutions(int limit) {
        return lastExecutionTime.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .collect(java.util.stream.Collectors.toMap(
                    Map.Entry::getKey, 
                    Map.Entry::getValue,
                    (e1, e2) -> e1, 
                    java.util.LinkedHashMap::new
                ));
    }
    
    /**
     * 打印统计信息
     */
    public void printStats() {
        System.out.println("=== 任务执行统计 ===");
        System.out.println("总执行次数: " + totalExecutions.get());
        System.out.println("总错误次数: " + totalErrors.get());
        System.out.println("系统错误率: " + String.format("%.2f%%", getSystemErrorRate() * 100));
        
        System.out.println("\n任务执行详情:");
        executionCountByTask.forEach((taskId, count) -> {
            long execCount = count.get();
            long errorCount = errorCountByTask.getOrDefault(taskId, new AtomicLong(0)).get();
            double errorRate = execCount > 0 ? (double) errorCount / execCount : 0.0;
            
            System.out.printf("  %s: 执行%d次, 错误%d次, 错误率%.2f%%%n", 
                            taskId, execCount, errorCount, errorRate * 100);
        });
    }
}
```

## 最佳实践

### 1. 日志级别管理

```properties
# logback.xml 配置示例
<configuration>
    <appender name="TASK_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/task-execution.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/task-execution.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>100MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level [%X{taskId}] [%X{taskName}] %msg%n</pattern>
        </encoder>
    </appender>
    
    <logger name="com.company.scheduler.task" level="INFO" additivity="false">
        <appender-ref ref="TASK_FILE"/>
    </logger>
    
    <root level="WARN">
        <appender-ref ref="TASK_FILE"/>
    </root>
</configuration>
```

### 2. 结构化日志

```java
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

public class StructuredTaskLog {
    private String taskId;
    private String taskName;
    private String groupName;
    private String eventType;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime timestamp;
    
    private String level;
    private String message;
    private String hostName;
    private String instanceId;
    private Long durationMs;
    private Boolean success;
    private String errorType;
    private String stackTrace;
    
    // Constructors
    public StructuredTaskLog() {
        this.timestamp = LocalDateTime.now();
    }
    
    // Getters and Setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }
    
    public String getInstanceId() { return instanceId; }
    public void setInstanceId(String instanceId) { this.instanceId = instanceId; }
    
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    
    public Boolean getSuccess() { return success; }
    public void setSuccess(Boolean success) { this.success = success; }
    
    public String getErrorType() { return errorType; }
    public void setErrorType(String errorType) { this.errorType = errorType; }
    
    public String getStackTrace() { return stackTrace; }
    public void setStackTrace(String stackTrace) { this.stackTrace = stackTrace; }
}
```

## 总结

任务执行日志的采集与分析是分布式调度系统监控运维的重要组成部分。通过建立完善的日志采集架构、选择合适的存储方案、实施有效的分析监控，可以显著提高系统的可观测性和运维效率。

关键要点包括：

1. **统一的日志格式**：使用结构化日志便于后续处理和分析
2. **分布式采集**：在各个节点部署日志收集器，确保日志不丢失
3. **实时传输**：建立高效的日志传输机制，保证日志的及时性
4. **多维度存储**：根据不同的使用场景选择合适的存储方案
5. **智能分析**：通过日志分析发现系统问题和优化机会

在下一节中，我们将探讨调度指标监控，包括关键性能指标的收集、监控面板的设计以及告警机制的实现。