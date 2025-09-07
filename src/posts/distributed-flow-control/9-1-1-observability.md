---
title: "核心监控指标: 限流QPS、通过QPS、阻塞请求数、规则触发次数"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式限流系统中，监控是保障系统稳定运行和持续优化的重要手段。通过全面、准确的监控指标，运维人员可以实时了解系统的运行状态，及时发现潜在问题，并基于数据做出合理的优化决策。本章将深入探讨分布式限流系统的核心监控指标，包括限流QPS、通过QPS、阻塞请求数、规则触发次数等，分析这些指标的意义、收集方法以及在实际运维中的应用。

## 监控指标体系设计

### 指标分类

分布式限流系统的监控指标可以从多个维度进行分类：

1. **流量指标**：反映系统的请求处理情况
2. **性能指标**：反映系统的处理效率和响应能力
3. **规则指标**：反映限流规则的执行情况
4. **资源指标**：反映系统资源的使用情况
5. **业务指标**：反映业务层面的影响

### 指标设计原则

在设计监控指标时，需要遵循以下原则：

1. **全面性**：覆盖系统的关键方面，不遗漏重要信息
2. **准确性**：指标数据真实反映系统状态
3. **实时性**：能够及时反映系统变化
4. **可解释性**：指标含义明确，便于理解和分析
5. **可操作性**：能够基于指标采取相应的行动

## 核心流量指标

### 限流QPS (Rate Limited QPS)

限流QPS是指被限流系统拒绝的请求速率，是衡量限流效果的重要指标。

```java
// 限流QPS收集器
@Component
public class RateLimitedQpsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> rateLimitedCounters = new ConcurrentHashMap<>();
    
    public RateLimitedQpsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordRateLimitedRequest(String resource, String ruleId, String reason) {
        String counterName = "flow.control.rate.limited";
        
        Counter counter = rateLimitedCounters.computeIfAbsent(
            resource + ":" + ruleId,
            k -> Counter.builder(counterName)
                .tag("resource", resource)
                .tag("rule", ruleId)
                .tag("reason", reason)
                .register(meterRegistry)
        );
        
        counter.increment();
    }
    
    // 计算限流QPS
    public double calculateRateLimitedQps(String resource, String ruleId, Duration window) {
        String metricName = "flow.control.rate.limited";
        // 实现QPS计算逻辑
        return 0.0; // 简化示例
    }
}
```

### 通过QPS (Allowed QPS)

通过QPS是指被限流系统允许通过的请求速率，反映了系统的实际处理能力。

```java
// 通过QPS收集器
@Component
public class AllowedQpsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> allowedCounters = new ConcurrentHashMap<>();
    
    public AllowedQpsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordAllowedRequest(String resource, String ruleId) {
        String counterName = "flow.control.allowed";
        
        Counter counter = allowedCounters.computeIfAbsent(
            resource + ":" + ruleId,
            k -> Counter.builder(counterName)
                .tag("resource", resource)
                .tag("rule", ruleId)
                .register(meterRegistry)
        );
        
        counter.increment();
    }
    
    // 计算通过QPS
    public double calculateAllowedQps(String resource, String ruleId, Duration window) {
        // 实现QPS计算逻辑
        return 0.0; // 简化示例
    }
}
```

### 阻塞请求数 (Blocked Requests)

阻塞请求数是指因限流而被阻塞的请求数量，通常与排队等待模式相关。

```java
// 阻塞请求数收集器
@Component
public class BlockedRequestsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> blockedCounters = new ConcurrentHashMap<>();
    private final Map<String, Gauge> currentBlockedGauges = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> currentBlockedCounts = new ConcurrentHashMap<>();
    
    public BlockedRequestsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordBlockedRequest(String resource, String ruleId) {
        String counterName = "flow.control.blocked";
        
        Counter counter = blockedCounters.computeIfAbsent(
            resource + ":" + ruleId,
            k -> Counter.builder(counterName)
                .tag("resource", resource)
                .tag("rule", ruleId)
                .register(meterRegistry)
        );
        
        counter.increment();
        
        // 更新当前阻塞请求数
        String gaugeKey = resource + ":" + ruleId;
        currentBlockedCounts.computeIfAbsent(gaugeKey, k -> new AtomicInteger(0))
            .incrementAndGet();
    }
    
    public void recordUnblockedRequest(String resource, String ruleId) {
        String gaugeKey = resource + ":" + ruleId;
        AtomicInteger count = currentBlockedCounts.get(gaugeKey);
        if (count != null) {
            count.decrementAndGet();
        }
    }
    
    @PostConstruct
    public void initGauges() {
        // 初始化当前阻塞请求数指标
        Gauge.builder("flow.control.blocked.current")
            .description("Current number of blocked requests")
            .register(meterRegistry, this, collector -> getCurrentBlockedCount());
    }
    
    private double getCurrentBlockedCount() {
        return currentBlockedCounts.values().stream()
            .mapToInt(AtomicInteger::get)
            .sum();
    }
}
```

### 规则触发次数 (Rule Trigger Count)

规则触发次数是指限流规则被触发的次数，反映了规则的活跃程度。

```java
// 规则触发次数收集器
@Component
public class RuleTriggerCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> triggerCounters = new ConcurrentHashMap<>();
    private final Map<String, Timer> triggerTimers = new ConcurrentHashMap<>();
    
    public RuleTriggerCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordRuleTrigger(String ruleId, String resource, long durationMs) {
        String counterName = "flow.control.rule.trigger";
        
        Counter counter = triggerCounters.computeIfAbsent(
            ruleId + ":" + resource,
            k -> Counter.builder(counterName)
                .tag("rule", ruleId)
                .tag("resource", resource)
                .register(meterRegistry)
        );
        
        counter.increment();
        
        // 记录触发耗时
        String timerName = "flow.control.rule.trigger.duration";
        Timer timer = triggerTimers.computeIfAbsent(
            ruleId + ":" + resource,
            k -> Timer.builder(timerName)
                .tag("rule", ruleId)
                .tag("resource", resource)
                .register(meterRegistry)
        );
        
        timer.record(durationMs, TimeUnit.MILLISECONDS);
    }
    
    // 获取规则触发统计
    public RuleTriggerStats getRuleTriggerStats(String ruleId, Duration window) {
        // 实现统计逻辑
        return new RuleTriggerStats(); // 简化示例
    }
    
    public static class RuleTriggerStats {
        private long totalCount;
        private double averageDuration;
        private long maxDuration;
        private Map<String, Long> resourceTriggers;
        
        // 构造函数和getter/setter方法
        public RuleTriggerStats() {
            this.resourceTriggers = new HashMap<>();
        }
        
        // getter和setter方法
        public long getTotalCount() { return totalCount; }
        public void setTotalCount(long totalCount) { this.totalCount = totalCount; }
        public double getAverageDuration() { return averageDuration; }
        public void setAverageDuration(double averageDuration) { this.averageDuration = averageDuration; }
        public long getMaxDuration() { return maxDuration; }
        public void setMaxDuration(long maxDuration) { this.maxDuration = maxDuration; }
        public Map<String, Long> getResourceTriggers() { return resourceTriggers; }
        public void setResourceTriggers(Map<String, Long> resourceTriggers) { this.resourceTriggers = resourceTriggers; }
    }
}
```

## 综合指标仪表板

### 指标聚合计算

```java
// 综合指标计算器
@Component
public class ComprehensiveMetricsCalculator {
    private final MeterRegistry meterRegistry;
    private final RateLimitedQpsCollector rateLimitedCollector;
    private final AllowedQpsCollector allowedCollector;
    private final BlockedRequestsCollector blockedCollector;
    private final RuleTriggerCollector triggerCollector;
    private final ScheduledExecutorService scheduler;
    
    public ComprehensiveMetricsCalculator(
            MeterRegistry meterRegistry,
            RateLimitedQpsCollector rateLimitedCollector,
            AllowedQpsCollector allowedCollector,
            BlockedRequestsCollector blockedCollector,
            RuleTriggerCollector triggerCollector) {
        this.meterRegistry = meterRegistry;
        this.rateLimitedCollector = rateLimitedCollector;
        this.allowedCollector = allowedCollector;
        this.blockedCollector = blockedCollector;
        this.triggerCollector = triggerCollector;
        this.scheduler = Executors.newScheduledThreadPool(1);
        
        // 定期计算综合指标
        scheduler.scheduleAtFixedRate(this::calculateComprehensiveMetrics, 
            0, 10, TimeUnit.SECONDS);
    }
    
    private void calculateComprehensiveMetrics() {
        try {
            // 计算总体QPS
            double totalQps = calculateTotalQps();
            
            // 计算限流率
            double rateLimitRatio = calculateRateLimitRatio();
            
            // 计算成功率
            double successRate = calculateSuccessRate();
            
            // 注册综合指标
            Gauge.builder("flow.control.qps.total")
                .description("Total QPS (allowed + rate limited)")
                .register(meterRegistry, this, calc -> totalQps);
                
            Gauge.builder("flow.control.rate.limit.ratio")
                .description("Ratio of rate limited requests to total requests")
                .register(meterRegistry, this, calc -> rateLimitRatio);
                
            Gauge.builder("flow.control.success.rate")
                .description("Success rate of requests")
                .register(meterRegistry, this, calc -> successRate);
        } catch (Exception e) {
            log.error("Failed to calculate comprehensive metrics", e);
        }
    }
    
    private double calculateTotalQps() {
        // 实现总QPS计算逻辑
        return 0.0; // 简化示例
    }
    
    private double calculateRateLimitRatio() {
        // 实现限流率计算逻辑
        return 0.0; // 简化示例
    }
    
    private double calculateSuccessRate() {
        // 实现成功率计算逻辑
        return 0.0; // 简化示例
    }
}
```

### 实时指标查询接口

```java
// 实时指标查询控制器
@RestController
@RequestMapping("/api/v1/metrics")
public class MetricsQueryController {
    private final ComprehensiveMetricsCalculator metricsCalculator;
    private final RateLimitedQpsCollector rateLimitedCollector;
    private final AllowedQpsCollector allowedCollector;
    private final BlockedRequestsCollector blockedCollector;
    private final RuleTriggerCollector triggerCollector;
    
    @GetMapping("/realtime")
    public ResponseEntity<RealTimeMetrics> getRealTimeMetrics(
            @RequestParam(required = false) String resource,
            @RequestParam(required = false) String ruleId) {
        
        try {
            RealTimeMetrics metrics = new RealTimeMetrics();
            
            // 获取实时指标
            metrics.setTimestamp(System.currentTimeMillis());
            metrics.setTotalQps(getTotalQps());
            metrics.setAllowedQps(getAllowedQps(resource, ruleId));
            metrics.setRateLimitedQps(getRateLimitedQps(resource, ruleId));
            metrics.setBlockedRequests(getBlockedRequests(resource, ruleId));
            metrics.setRuleTriggerCount(getRuleTriggerCount(ruleId));
            metrics.setRateLimitRatio(getRateLimitRatio());
            metrics.setSuccessRate(getSuccessRate());
            
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            log.error("Failed to get real-time metrics", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/historical")
    public ResponseEntity<HistoricalMetrics> getHistoricalMetrics(
            @RequestParam String metricName,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(required = false) String resource,
            @RequestParam(required = false) String ruleId) {
        
        try {
            HistoricalMetrics metrics = new HistoricalMetrics();
            
            // 获取历史指标数据
            metrics.setMetricName(metricName);
            metrics.setStartTime(startTime);
            metrics.setEndTime(endTime);
            metrics.setDataPoints(queryHistoricalData(metricName, startTime, endTime, resource, ruleId));
            
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            log.error("Failed to get historical metrics", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    private double getTotalQps() {
        // 实现总QPS获取逻辑
        return 0.0; // 简化示例
    }
    
    private double getAllowedQps(String resource, String ruleId) {
        // 实现通过QPS获取逻辑
        return 0.0; // 简化示例
    }
    
    private double getRateLimitedQps(String resource, String ruleId) {
        // 实现限流QPS获取逻辑
        return 0.0; // 简化示例
    }
    
    private long getBlockedRequests(String resource, String ruleId) {
        // 实现阻塞请求数获取逻辑
        return 0L; // 简化示例
    }
    
    private long getRuleTriggerCount(String ruleId) {
        // 实现规则触发次数获取逻辑
        return 0L; // 简化示例
    }
    
    private double getRateLimitRatio() {
        // 实现限流率获取逻辑
        return 0.0; // 简化示例
    }
    
    private double getSuccessRate() {
        // 实现成功率获取逻辑
        return 0.0; // 简化示例
    }
    
    private List<DataPoint> queryHistoricalData(String metricName, LocalDateTime startTime, 
                                              LocalDateTime endTime, String resource, String ruleId) {
        // 实现历史数据查询逻辑
        return new ArrayList<>(); // 简化示例
    }
    
    // 实时指标数据结构
    public static class RealTimeMetrics {
        private long timestamp;
        private double totalQps;
        private double allowedQps;
        private double rateLimitedQps;
        private long blockedRequests;
        private long ruleTriggerCount;
        private double rateLimitRatio;
        private double successRate;
        
        // 构造函数和getter/setter方法
        public RealTimeMetrics() {}
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public double getTotalQps() { return totalQps; }
        public void setTotalQps(double totalQps) { this.totalQps = totalQps; }
        public double getAllowedQps() { return allowedQps; }
        public void setAllowedQps(double allowedQps) { this.allowedQps = allowedQps; }
        public double getRateLimitedQps() { return rateLimitedQps; }
        public void setRateLimitedQps(double rateLimitedQps) { this.rateLimitedQps = rateLimitedQps; }
        public long getBlockedRequests() { return blockedRequests; }
        public void setBlockedRequests(long blockedRequests) { this.blockedRequests = blockedRequests; }
        public long getRuleTriggerCount() { return ruleTriggerCount; }
        public void setRuleTriggerCount(long ruleTriggerCount) { this.ruleTriggerCount = ruleTriggerCount; }
        public double getRateLimitRatio() { return rateLimitRatio; }
        public void setRateLimitRatio(double rateLimitRatio) { this.rateLimitRatio = rateLimitRatio; }
        public double getSuccessRate() { return successRate; }
        public void setSuccessRate(double successRate) { this.successRate = successRate; }
    }
    
    // 历史指标数据结构
    public static class HistoricalMetrics {
        private String metricName;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private List<DataPoint> dataPoints;
        
        // 构造函数和getter/setter方法
        public HistoricalMetrics() {}
        
        // getter和setter方法
        public String getMetricName() { return metricName; }
        public void setMetricName(String metricName) { this.metricName = metricName; }
        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
        public LocalDateTime getEndTime() { return endTime; }
        public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
        public List<DataPoint> getDataPoints() { return dataPoints; }
        public void setDataPoints(List<DataPoint> dataPoints) { this.dataPoints = dataPoints; }
    }
    
    // 数据点结构
    public static class DataPoint {
        private long timestamp;
        private double value;
        private Map<String, String> tags;
        
        public DataPoint() {
            this.tags = new HashMap<>();
        }
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public double getValue() { return value; }
        public void setValue(double value) { this.value = value; }
        public Map<String, String> getTags() { return tags; }
        public void setTags(Map<String, String> tags) { this.tags = tags; }
    }
}
```

## 指标存储与查询

### 基于Prometheus的实现

```java
// Prometheus指标导出配置
@Configuration
public class PrometheusMetricsConfig {
    
    @Bean
    public CollectorRegistry collectorRegistry() {
        return CollectorRegistry.defaultRegistry;
    }
    
    @Bean
    public PrometheusMeterRegistry prometheusMeterRegistry(CollectorRegistry collectorRegistry) {
        PrometheusMeterRegistry prometheusRegistry = new PrometheusMeterRegistry(
            PrometheusConfig.DEFAULT, collectorRegistry, Clock.SYSTEM);
        
        // 注册核心限流指标
        registerCoreMetrics(prometheusRegistry);
        
        return prometheusRegistry;
    }
    
    private void registerCoreMetrics(MeterRegistry registry) {
        // 限流QPS指标
        Counter.builder("flow_control_rate_limited_total")
            .description("Total number of rate limited requests")
            .register(registry);
            
        // 通过QPS指标
        Counter.builder("flow_control_allowed_total")
            .description("Total number of allowed requests")
            .register(registry);
            
        // 阻塞请求数指标
        Gauge.builder("flow_control_blocked_current")
            .description("Current number of blocked requests")
            .register(registry, this, calculator -> getCurrentBlockedRequests());
            
        // 规则触发次数指标
        Counter.builder("flow_control_rule_triggers_total")
            .description("Total number of rule triggers")
            .register(registry);
    }
    
    private double getCurrentBlockedRequests() {
        // 获取当前阻塞请求数
        return 0.0; // 简化示例
    }
}
```

### 基于InfluxDB的实现

```java
// InfluxDB指标存储
@Component
public class InfluxDbMetricsStorage {
    private final InfluxDB influxDB;
    private final String databaseName;
    private final ScheduledExecutorService batchScheduler;
    private final Queue<MetricPoint> metricQueue = new ConcurrentLinkedQueue<>();
    
    public InfluxDbMetricsStorage(InfluxDB influxDB, String databaseName) {
        this.influxDB = influxDB;
        this.databaseName = databaseName;
        this.batchScheduler = Executors.newScheduledThreadPool(1);
        
        // 创建数据库
        influxDB.createDatabase(databaseName);
        
        // 定期批量写入指标
        batchScheduler.scheduleAtFixedRate(this::batchWriteMetrics, 
            0, 10, TimeUnit.SECONDS);
    }
    
    public void writeMetric(String measurement, Map<String, String> tags, 
                          Map<String, Object> fields, long timestamp) {
        MetricPoint point = new MetricPoint(measurement, tags, fields, timestamp);
        metricQueue.offer(point);
    }
    
    private void batchWriteMetrics() {
        if (metricQueue.isEmpty()) {
            return;
        }
        
        try {
            BatchPoints batchPoints = BatchPoints
                .database(databaseName)
                .retentionPolicy("autogen")
                .build();
            
            int batchSize = Math.min(1000, metricQueue.size());
            for (int i = 0; i < batchSize; i++) {
                MetricPoint metricPoint = metricQueue.poll();
                if (metricPoint != null) {
                    Point point = Point.measurement(metricPoint.getMeasurement())
                        .time(metricPoint.getTimestamp(), TimeUnit.MILLISECONDS)
                        .tag(metricPoint.getTags())
                        .fields(metricPoint.getFields())
                        .build();
                    
                    batchPoints.point(point);
                }
            }
            
            influxDB.write(batchPoints);
        } catch (Exception e) {
            log.error("Failed to write metrics to InfluxDB", e);
        }
    }
    
    // 指标点数据结构
    private static class MetricPoint {
        private final String measurement;
        private final Map<String, String> tags;
        private final Map<String, Object> fields;
        private final long timestamp;
        
        public MetricPoint(String measurement, Map<String, String> tags, 
                          Map<String, Object> fields, long timestamp) {
            this.measurement = measurement;
            this.tags = tags != null ? tags : new HashMap<>();
            this.fields = fields != null ? fields : new HashMap<>();
            this.timestamp = timestamp;
        }
        
        // getter方法
        public String getMeasurement() { return measurement; }
        public Map<String, String> getTags() { return tags; }
        public Map<String, Object> getFields() { return fields; }
        public long getTimestamp() { return timestamp; }
    }
}
```

## 告警规则设计

### 基于指标的告警规则

```yaml
# 核心监控指标告警规则
alerting:
  rules:
    # 限流QPS过高告警
    - name: "High Rate Limited QPS"
      metric: "flow.control.rate.limited"
      condition: "rate(value[1m]) > 1000"
      duration: "1m"
      severity: "warning"
      message: "High rate of rate limited requests: {{value}}/sec for resource {{resource}}"
      
    # 通过QPS异常告警
    - name: "Abnormal Allowed QPS"
      metric: "flow.control.allowed"
      condition: "value < 50 or value > 5000"
      duration: "2m"
      severity: "warning"
      message: "Abnormal allowed QPS: {{value}} for resource {{resource}}"
      
    # 阻塞请求数过多告警
    - name: "Too Many Blocked Requests"
      metric: "flow.control.blocked.current"
      condition: "value > 100"
      duration: "30s"
      severity: "critical"
      message: "Too many blocked requests: {{value}}"
      
    # 规则频繁触发告警
    - name: "Frequent Rule Triggers"
      metric: "flow.control.rule.trigger"
      condition: "rate(value[5m]) > 50"
      duration: "1m"
      severity: "warning"
      message: "Rule {{rule}} triggered frequently: {{value}}/sec"
      
    # 限流率过高告警
    - name: "High Rate Limit Ratio"
      metric: "flow.control.rate.limit.ratio"
      condition: "value > 0.3"
      duration: "1m"
      severity: "critical"
      message: "High rate limit ratio: {{value}}% of requests are being rate limited"
      
    # 成功率下降告警
    - name: "Success Rate Drop"
      metric: "flow.control.success.rate"
      condition: "value < 0.95"
      duration: "2m"
      severity: "critical"
      message: "Success rate dropped to {{value}}%"
```

### 告警通知实现

```java
// 告警通知服务
@Component
public class AlertNotificationService {
    private final List<NotificationChannel> notificationChannels;
    private final AlertRuleEvaluator ruleEvaluator;
    private final MetricsQueryService metricsQueryService;
    
    public AlertNotificationService(List<NotificationChannel> notificationChannels,
                                  AlertRuleEvaluator ruleEvaluator,
                                  MetricsQueryService metricsQueryService) {
        this.notificationChannels = notificationChannels;
        this.ruleEvaluator = ruleEvaluator;
        this.metricsQueryService = metricsQueryService;
    }
    
    public void processAlert(AlertRule rule, MetricData metricData) {
        try {
            // 构造告警消息
            AlertMessage alertMessage = buildAlertMessage(rule, metricData);
            
            // 发送告警通知
            for (NotificationChannel channel : notificationChannels) {
                try {
                    channel.send(alertMessage);
                } catch (Exception e) {
                    log.error("Failed to send alert via channel: " + channel.getName(), e);
                }
            }
            
            // 记录告警事件
            recordAlertEvent(rule, metricData, alertMessage);
        } catch (Exception e) {
            log.error("Failed to process alert", e);
        }
    }
    
    private AlertMessage buildAlertMessage(AlertRule rule, MetricData metricData) {
        AlertMessage message = new AlertMessage();
        message.setRuleName(rule.getName());
        message.setSeverity(rule.getSeverity());
        message.setTimestamp(System.currentTimeMillis());
        message.setMetricName(metricData.getMetricName());
        message.setMetricValue(metricData.getValue());
        message.setTags(metricData.getTags());
        
        // 替换消息模板中的变量
        String messageTemplate = rule.getMessage();
        String formattedMessage = formatMessage(messageTemplate, metricData);
        message.setMessage(formattedMessage);
        
        return message;
    }
    
    private String formatMessage(String template, MetricData metricData) {
        String formatted = template;
        formatted = formatted.replace("{{value}}", String.valueOf(metricData.getValue()));
        
        // 替换标签变量
        for (Map.Entry<String, String> tag : metricData.getTags().entrySet()) {
            formatted = formatted.replace("{{" + tag.getKey() + "}}", tag.getValue());
        }
        
        return formatted;
    }
    
    private void recordAlertEvent(AlertRule rule, MetricData metricData, AlertMessage message) {
        // 记录告警事件到数据库或日志系统
        log.info("Alert triggered: {} - {}", rule.getName(), message.getMessage());
    }
    
    // 告警消息
    public static class AlertMessage {
        private String ruleName;
        private String severity;
        private long timestamp;
        private String metricName;
        private double metricValue;
        private Map<String, String> tags;
        private String message;
        
        public AlertMessage() {
            this.tags = new HashMap<>();
        }
        
        // getter和setter方法
        public String getRuleName() { return ruleName; }
        public void setRuleName(String ruleName) { this.ruleName = ruleName; }
        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public String getMetricName() { return metricName; }
        public void setMetricName(String metricName) { this.metricName = metricName; }
        public double getMetricValue() { return metricValue; }
        public void setMetricValue(double metricValue) { this.metricValue = metricValue; }
        public Map<String, String> getTags() { return tags; }
        public void setTags(Map<String, String> tags) { this.tags = tags; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
```

通过以上实现，我们构建了一个完整的分布式限流系统核心监控指标体系，能够全面、准确地反映系统的运行状态。这些指标不仅有助于实时监控系统健康状况，还能为系统的优化和故障排查提供数据支持。在实际应用中，需要根据具体业务场景调整指标收集频率和告警阈值，以达到最佳的监控效果。