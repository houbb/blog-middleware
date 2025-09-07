---
title: 事务监控与追踪：分布式事务系统的可视化洞察
date: 2025-09-01
categories: [DisTx]
tags: [dis-tx]
published: true
---

# 事务监控与追踪：分布式事务系统的可视化洞察

在复杂的分布式系统中，事务的执行过程涉及多个服务、数据库和中间件，其执行路径往往错综复杂。如果没有完善的监控和追踪机制，当系统出现问题时，我们很难快速定位故障原因和影响范围。事务监控与追踪是分布式事务系统中不可或缺的重要组成部分，它为我们提供了系统的可视化洞察，帮助我们更好地理解和优化系统性能。本章将深入探讨分布式事务的监控与追踪技术。

## 分布式事务链路可视化

### 链路追踪的重要性

在分布式事务系统中，一个事务可能涉及多个服务的调用，每个服务又可能访问不同的数据库或调用其他服务。这种复杂的调用关系形成了一个分布式调用链路，如果没有有效的追踪机制，我们很难理解事务的完整执行过程。

### OpenTelemetry与链路追踪

OpenTelemetry是当前主流的可观测性框架，它提供了统一的API和SDK来收集、处理和导出遥测数据。

#### 基础配置

```java
@Configuration
public class OpenTelemetryConfig {
    
    @Bean
    public OpenTelemetry openTelemetry() {
        // 创建OpenTelemetry实例
        return OpenTelemetrySdk.builder()
            .setTracerProvider(SdkTracerProvider.builder()
                .addSpanProcessor(BatchSpanProcessor.builder(OtlpGrpcSpanExporter.builder()
                    .setEndpoint("http://localhost:4317")
                    .build()).build())
                .setResource(Resource.getDefault()
                    .merge(Resource.create(Attributes.of(
                        ResourceAttributes.SERVICE_NAME, "order-service"))))
                .build())
            .buildAndRegisterGlobal();
    }
    
    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer("order-service");
    }
}
```

#### 事务链路追踪实现

```java
@Service
public class OrderService {
    
    @Autowired
    private Tracer tracer;
    
    @Autowired
    private AccountServiceClient accountServiceClient;
    
    @Autowired
    private InventoryServiceClient inventoryServiceClient;
    
    @GlobalTransactional
    public Order createOrder(OrderRequest request) {
        // 创建事务根Span
        Span rootSpan = tracer.spanBuilder("create-order-transaction")
            .setAttribute("order.id", request.getOrderId())
            .setAttribute("user.id", request.getUserId())
            .setAttribute("product.id", request.getProductId())
            .setAttribute("quantity", request.getQuantity())
            .startSpan();
            
        try (Scope scope = rootSpan.makeCurrent()) {
            
            // 1. 预留库存
            Span reserveInventorySpan = tracer.spanBuilder("reserve-inventory")
                .setAttribute("product.id", request.getProductId())
                .setAttribute("quantity", request.getQuantity())
                .startSpan();
                
            try (Scope inventoryScope = reserveInventorySpan.makeCurrent()) {
                inventoryServiceClient.reserve(request.getProductId(), request.getQuantity());
                reserveInventorySpan.setStatus(StatusCode.OK);
            } catch (Exception e) {
                reserveInventorySpan.setStatus(StatusCode.ERROR, e.getMessage());
                throw e;
            } finally {
                reserveInventorySpan.end();
            }
            
            // 2. 创建订单
            Span createOrderSpan = tracer.spanBuilder("create-order")
                .setAttribute("order.id", request.getOrderId())
                .startSpan();
                
            Order order;
            try (Scope orderScope = createOrderSpan.makeCurrent()) {
                order = doCreateOrder(request);
                createOrderSpan.setStatus(StatusCode.OK);
            } catch (Exception e) {
                createOrderSpan.setStatus(StatusCode.ERROR, e.getMessage());
                throw e;
            } finally {
                createOrderSpan.end();
            }
            
            // 3. 扣减账户余额
            Span debitAccountSpan = tracer.spanBuilder("debit-account")
                .setAttribute("user.id", request.getUserId())
                .setAttribute("amount", request.getAmount())
                .startSpan();
                
            try (Scope accountScope = debitAccountSpan.makeCurrent()) {
                accountServiceClient.debit(request.getUserId(), request.getAmount());
                debitAccountSpan.setStatus(StatusCode.OK);
            } catch (Exception e) {
                debitAccountSpan.setStatus(StatusCode.ERROR, e.getMessage());
                throw e;
            } finally {
                debitAccountSpan.end();
            }
            
            rootSpan.setStatus(StatusCode.OK);
            return order;
            
        } catch (Exception e) {
            rootSpan.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            rootSpan.end();
        }
    }
    
    private Order doCreateOrder(OrderRequest request) {
        Order order = new Order();
        order.setOrderId(request.getOrderId());
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setAmount(request.getAmount());
        order.setStatus(OrderStatus.CREATED);
        return orderRepository.save(order);
    }
}
```

### 链路数据可视化

通过Jaeger、Zipkin等链路追踪系统，我们可以将收集到的链路数据进行可视化展示：

```
┌─────────────────────────────────────────────────────────────┐
│                    create-order-transaction                 │
│  Trace ID: 1234567890abcdef                                 │
│  Duration: 1.2s                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─ reserve-inventory (200ms)                              │
│  │  Product ID: PROD_001                                   │
│  │  Quantity: 2                                            │
│  └─────────────────────────────────────────────────────────┤
│  ┌─ create-order (300ms)                                   │
│  │  Order ID: ORDER_001                                    │
│  └─────────────────────────────────────────────────────────┤
│  ┌─ debit-account (400ms)                                  │
│  │  User ID: USER_001                                      │
│  │  Amount: 200.00                                         │
│  └─────────────────────────────────────────────────────────┤
│  ┌─ send-notification (300ms)                              │
│  │  Type: ORDER_CREATED                                    │
│  └─────────────────────────────────────────────────────────┘
```

## 异常告警与补偿机制

### 异常检测机制

在分布式事务系统中，及时发现异常并进行处理是保证系统稳定性的关键。

#### 事务状态监控

```java
@Component
public class TransactionStatusMonitor {
    
    @Autowired
    private TransactionRepository transactionRepository;
    
    @Autowired
    private AlertService alertService;
    
    @Scheduled(fixedRate = 60000) // 每分钟检查一次
    public void monitorTransactionStatus() {
        // 检查超时事务
        List<Transaction> timeoutTransactions = transactionRepository
            .findTimeoutTransactions(5); // 5分钟超时
        
        for (Transaction transaction : timeoutTransactions) {
            // 发送告警
            alertService.sendAlert("Transaction timeout detected", 
                "Transaction ID: " + transaction.getId() + 
                ", Status: " + transaction.getStatus() + 
                ", Created Time: " + transaction.getCreateTime());
            
            // 记录监控指标
            meterRegistry.counter("transaction.timeout").increment();
        }
        
        // 检查失败事务
        List<Transaction> failedTransactions = transactionRepository
            .findFailedTransactions(10); // 10分钟内的失败事务
        
        if (!failedTransactions.isEmpty()) {
            // 发送告警
            alertService.sendAlert("Transaction failures detected", 
                "Failed transaction count: " + failedTransactions.size());
            
            // 记录监控指标
            meterRegistry.counter("transaction.failure").increment(failedTransactions.size());
        }
    }
}
```

#### 性能指标监控

```java
@Component
public class TransactionPerformanceMonitor {
    
    private final MeterRegistry meterRegistry;
    
    public void recordTransactionMetrics(String transactionType, boolean success, 
                                       long duration, int retryCount) {
        // 记录事务执行时间
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("transaction.duration")
            .tag("type", transactionType)
            .tag("success", String.valueOf(success))
            .register(meterRegistry));
        
        // 记录重试次数
        if (retryCount > 0) {
            Counter.builder("transaction.retry")
                .tag("type", transactionType)
                .register(meterRegistry)
                .increment(retryCount);
        }
        
        // 记录成功率
        Counter.builder("transaction." + (success ? "success" : "failure"))
            .tag("type", transactionType)
            .register(meterRegistry)
            .increment();
    }
}
```

### 补偿机制触发

当检测到事务异常时，需要及时触发补偿机制：

```java
@Component
public class TransactionCompensationHandler {
    
    @Autowired
    private CompensationService compensationService;
    
    @Autowired
    private TransactionRepository transactionRepository;
    
    @EventListener
    public void handleTransactionTimeout(TransactionTimeoutEvent event) {
        Transaction transaction = event.getTransaction();
        
        // 更新事务状态
        transaction.setStatus(TransactionStatus.COMPENSATING);
        transactionRepository.update(transaction);
        
        try {
            // 执行补偿操作
            compensationService.compensate(transaction);
            
            // 更新事务状态为已补偿
            transaction.setStatus(TransactionStatus.COMPENSATED);
            transactionRepository.update(transaction);
            
            // 发送补偿完成通知
            notificationService.sendCompensationCompletedNotification(transaction);
            
        } catch (Exception e) {
            // 补偿失败，记录日志并告警
            log.error("Compensation failed for transaction: " + transaction.getId(), e);
            alertService.sendAlert("Transaction compensation failed", 
                "Transaction ID: " + transaction.getId() + ", Error: " + e.getMessage());
            
            // 更新事务状态为补偿失败
            transaction.setStatus(TransactionStatus.COMPENSATION_FAILED);
            transactionRepository.update(transaction);
        }
    }
}
```

## 日志与审计

### 结构化日志设计

在分布式事务系统中，良好的日志设计对于问题排查和系统审计至关重要。

#### 事务日志结构

```java
public class TransactionLog {
    
    private String logId;
    private String transactionId;
    private String businessType;
    private String businessId;
    private String service;
    private String operation;
    private String status;
    private Object requestData;
    private Object responseData;
    private String errorMessage;
    private Date startTime;
    private Date endTime;
    private Long duration;
    private String traceId;
    private String spanId;
    
    // getters and setters
}

@Component
public class TransactionLogger {
    
    private static final Logger logger = LoggerFactory.getLogger(TransactionLogger.class);
    
    public void logTransactionStart(TransactionContext context) {
        TransactionLog log = new TransactionLog();
        log.setLogId(UUID.randomUUID().toString());
        log.setTransactionId(context.getTransactionId());
        log.setBusinessType(context.getBusinessType());
        log.setBusinessId(context.getBusinessId());
        log.setService(context.getServiceName());
        log.setOperation(context.getOperation());
        log.setStatus("STARTED");
        log.setRequestData(context.getRequestData());
        log.setStartTime(new Date());
        log.setTraceId(context.getTraceId());
        log.setSpanId(context.getSpanId());
        
        logger.info("Transaction started: {}", toJson(log));
    }
    
    public void logTransactionSuccess(TransactionContext context) {
        TransactionLog log = new TransactionLog();
        log.setLogId(UUID.randomUUID().toString());
        log.setTransactionId(context.getTransactionId());
        log.setBusinessType(context.getBusinessType());
        log.setBusinessId(context.getBusinessId());
        log.setService(context.getServiceName());
        log.setOperation(context.getOperation());
        log.setStatus("SUCCESS");
        log.setResponseData(context.getResponseData());
        log.setStartTime(context.getStartTime());
        log.setEndTime(new Date());
        log.setDuration(System.currentTimeMillis() - context.getStartTime().getTime());
        log.setTraceId(context.getTraceId());
        log.setSpanId(context.getSpanId());
        
        logger.info("Transaction succeeded: {}", toJson(log));
    }
    
    public void logTransactionFailure(TransactionContext context, Exception e) {
        TransactionLog log = new TransactionLog();
        log.setLogId(UUID.randomUUID().toString());
        log.setTransactionId(context.getTransactionId());
        log.setBusinessType(context.getBusinessType());
        log.setBusinessId(context.getBusinessId());
        log.setService(context.getServiceName());
        log.setOperation(context.getOperation());
        log.setStatus("FAILED");
        log.setRequestData(context.getRequestData());
        log.setErrorMessage(e.getMessage());
        log.setStartTime(context.getStartTime());
        log.setEndTime(new Date());
        log.setDuration(System.currentTimeMillis() - context.getStartTime().getTime());
        log.setTraceId(context.getTraceId());
        log.setSpanId(context.getSpanId());
        
        logger.error("Transaction failed: {}", toJson(log), e);
    }
    
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }
}
```

### 审计日志实现

审计日志用于记录系统中的重要操作，满足合规性要求：

```java
public class AuditLog {
    
    private String auditId;
    private String userId;
    private String operation;
    private String resourceType;
    private String resourceId;
    private Object beforeData;
    private Object afterData;
    private String ipAddress;
    private Date timestamp;
    private String traceId;
    
    // getters and setters
}

@Aspect
@Component
public class AuditLogAspect {
    
    private static final Logger auditLogger = LoggerFactory.getLogger("AUDIT");
    
    @Autowired
    private HttpServletRequest request;
    
    @Around("@annotation(Auditable)")
    public Object auditOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        Auditable auditable = getAuditableAnnotation(joinPoint);
        
        AuditLog auditLog = new AuditLog();
        auditLog.setAuditId(UUID.randomUUID().toString());
        auditLog.setUserId(getCurrentUserId());
        auditLog.setOperation(auditable.operation());
        auditLog.setResourceType(auditable.resourceType());
        auditLog.setTimestamp(new Date());
        auditLog.setIpAddress(getClientIpAddress());
        
        // 记录操作前的数据
        if (auditable.logBefore()) {
            auditLog.setBeforeData(getResourceData(auditable, joinPoint));
        }
        
        try {
            Object result = joinPoint.proceed();
            
            // 记录操作后的数据
            if (auditable.logAfter()) {
                auditLog.setAfterData(result);
            }
            
            auditLogger.info("Audit log: {}", toJson(auditLog));
            return result;
            
        } catch (Exception e) {
            auditLog.setAfterData("ERROR: " + e.getMessage());
            auditLogger.error("Audit log (failed): {}", toJson(auditLog));
            throw e;
        }
    }
    
    private Auditable getAuditableAnnotation(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        return signature.getMethod().getAnnotation(Auditable.class);
    }
    
    private String getCurrentUserId() {
        // 从SecurityContext或JWT中获取用户ID
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) authentication.getPrincipal()).getUsername();
        }
        return "anonymous";
    }
    
    private String getClientIpAddress() {
        return request.getRemoteAddr();
    }
}
```

### 日志收集与分析

通过ELK（Elasticsearch、Logstash、Kibana）或类似的日志分析平台，我们可以对事务日志进行集中收集和分析：

```java
@Component
public class LogAnalysisService {
    
    @Autowired
    private ElasticsearchTemplate elasticsearchTemplate;
    
    public List<TransactionAnalysis> analyzeTransactionPerformance(Date startTime, Date endTime) {
        // 构建查询条件
        Query query = new NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.rangeQuery("timestamp")
                .from(startTime.getTime())
                .to(endTime.getTime()))
            .withAggregation(AggregationBuilders.terms("by_service")
                .field("service")
                .subAggregation(AggregationBuilders.avg("avg_duration").field("duration"))
                .subAggregation(AggregationBuilders.max("max_duration").field("duration")))
            .build();
        
        // 执行查询
        SearchHits<TransactionLog> searchHits = elasticsearchTemplate.search(query, TransactionLog.class);
        
        // 分析结果
        List<TransactionAnalysis> analysisList = new ArrayList<>();
        // ... 分析逻辑
        
        return analysisList;
    }
    
    public List<ErrorAnalysis> analyzeTransactionErrors(Date startTime, Date endTime) {
        // 构建错误查询条件
        Query query = new NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.boolQuery()
                .must(QueryBuilders.rangeQuery("timestamp")
                    .from(startTime.getTime())
                    .to(endTime.getTime()))
                .must(QueryBuilders.termQuery("status", "FAILED")))
            .withAggregation(AggregationBuilders.terms("by_error")
                .field("errorMessage")
                .size(10))
            .build();
        
        // 执行查询并分析
        // ... 分析逻辑
        
        return errorAnalysisList;
    }
}
```

## 监控面板设计

### Grafana监控面板

通过Grafana等可视化工具，我们可以创建丰富的监控面板来展示事务系统的运行状态：

```json
{
  "dashboard": {
    "title": "分布式事务监控面板",
    "panels": [
      {
        "title": "事务成功率",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(transaction_success[5m]) / (rate(transaction_success[5m]) + rate(transaction_failure[5m]))",
            "legendFormat": "成功率"
          }
        ]
      },
      {
        "title": "事务执行时间分布",
        "type": "heatmap",
        "targets": [
          {
            "expr": "transaction_duration_bucket",
            "format": "heatmap"
          }
        ]
      },
      {
        "title": "各服务事务量",
        "type": "barchart",
        "targets": [
          {
            "expr": "sum by(service) (transaction_count)",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "事务超时统计",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(transaction_timeout)",
            "legendFormat": "超时事务数"
          }
        ]
      }
    ]
  }
}
```

### 自定义监控指标

```java
@Component
public class CustomTransactionMetrics {
    
    private final MeterRegistry meterRegistry;
    
    // 事务并发数
    private final Gauge concurrentTransactions;
    private final AtomicInteger currentTransactionCount = new AtomicInteger(0);
    
    // 事务队列长度
    private final Gauge transactionQueueLength;
    private final AtomicInteger queueLength = new AtomicInteger(0);
    
    public CustomTransactionMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        this.concurrentTransactions = Gauge.builder("transaction.concurrent")
            .description("当前并发事务数")
            .register(meterRegistry, currentTransactionCount, AtomicInteger::get);
            
        this.transactionQueueLength = Gauge.builder("transaction.queue.length")
            .description("事务队列长度")
            .register(meterRegistry, queueLength, AtomicInteger::get);
    }
    
    public void incrementTransactionCount() {
        currentTransactionCount.incrementAndGet();
    }
    
    public void decrementTransactionCount() {
        currentTransactionCount.decrementAndGet();
    }
    
    public void setQueueLength(int length) {
        queueLength.set(length);
    }
}
```

## 告警策略设计

### 多维度告警规则

```yaml
# alert-rules.yml
groups:
  - name: transaction-alerts
    rules:
      # 事务成功率告警
      - alert: TransactionSuccessRateLow
        expr: rate(transaction_success[5m]) / (rate(transaction_success[5m]) + rate(transaction_failure[5m])) < 0.95
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "事务成功率过低"
          description: "过去5分钟事务成功率低于95%: {{ $value }}"

      # 事务超时告警
      - alert: TransactionTimeoutHigh
        expr: rate(transaction_timeout[5m]) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "事务超时过多"
          description: "过去5分钟事务超时数量超过10个: {{ $value }}"

      # 事务执行时间异常告警
      - alert: TransactionDurationHigh
        expr: histogram_quantile(0.95, sum(rate(transaction_duration_bucket[5m])) by (le)) > 5000
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "事务执行时间过长"
          description: "95%的事务执行时间超过5秒: {{ $value }}ms"
```

### 告警通知渠道

```java
@Component
public class AlertNotificationService {
    
    private final List<NotificationChannel> channels;
    
    public void sendAlert(String title, String message, AlertLevel level) {
        Alert alert = new Alert();
        alert.setTitle(title);
        alert.setMessage(message);
        alert.setLevel(level);
        alert.setTimestamp(new Date());
        
        for (NotificationChannel channel : channels) {
            if (channel.supportsLevel(level)) {
                try {
                    channel.send(alert);
                } catch (Exception e) {
                    log.error("Failed to send alert via channel: " + channel.getName(), e);
                }
            }
        }
    }
}

public interface NotificationChannel {
    
    String getName();
    
    boolean supportsLevel(AlertLevel level);
    
    void send(Alert alert) throws Exception;
}

@Component
public class EmailNotificationChannel implements NotificationChannel {
    
    @Override
    public String getName() {
        return "email";
    }
    
    @Override
    public boolean supportsLevel(AlertLevel level) {
        return level == AlertLevel.CRITICAL || level == AlertLevel.WARNING;
    }
    
    @Override
    public void send(Alert alert) throws Exception {
        // 发送邮件告警
        emailService.sendAlertEmail(alert);
    }
}

@Component
public class SmsNotificationChannel implements NotificationChannel {
    
    @Override
    public String getName() {
        return "sms";
    }
    
    @Override
    public boolean supportsLevel(AlertLevel level) {
        return level == AlertLevel.CRITICAL;
    }
    
    @Override
    public void send(Alert alert) throws Exception {
        // 发送短信告警
        smsService.sendAlertSms(alert);
    }
}

@Component
public class WebhookNotificationChannel implements NotificationChannel {
    
    @Override
    public String getName() {
        return "webhook";
    }
    
    @Override
    public boolean supportsLevel(AlertLevel level) {
        return true;
    }
    
    @Override
    public void send(Alert alert) throws Exception {
        // 发送Webhook告警
        webhookService.sendAlertWebhook(alert);
    }
}
```

## 最佳实践总结

### 1. 全链路追踪实现

```java
@Component
public class FullLinkTracingService {
    
    @Autowired
    private Tracer tracer;
    
    public <T> T traceTransaction(String operationName, Supplier<T> operation) {
        Span span = tracer.spanBuilder(operationName).startSpan();
        try (Scope scope = span.makeCurrent()) {
            T result = operation.get();
            span.setStatus(StatusCode.OK);
            return result;
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

### 2. 统一日志格式

```java
public class UnifiedLogger {
    
    private static final Logger logger = LoggerFactory.getLogger("UNIFIED");
    
    public static void info(String businessType, String businessId, String message, Object... args) {
        LogEntry entry = new LogEntry();
        entry.setTimestamp(System.currentTimeMillis());
        entry.setLevel("INFO");
        entry.setBusinessType(businessType);
        entry.setBusinessId(businessId);
        entry.setMessage(message);
        entry.setArgs(Arrays.asList(args));
        entry.setTraceId(MDC.get("traceId"));
        entry.setSpanId(MDC.get("spanId"));
        
        logger.info(toJson(entry));
    }
    
    public static void error(String businessType, String businessId, String message, Throwable throwable) {
        LogEntry entry = new LogEntry();
        entry.setTimestamp(System.currentTimeMillis());
        entry.setLevel("ERROR");
        entry.setBusinessType(businessType);
        entry.setBusinessId(businessId);
        entry.setMessage(message);
        entry.setThrowable(throwable);
        entry.setTraceId(MDC.get("traceId"));
        entry.setSpanId(MDC.get("spanId"));
        
        logger.error(toJson(entry), throwable);
    }
}
```

### 3. 监控数据持久化

```java
@Component
public class MonitoringDataPersistence {
    
    @Autowired
    private MonitoringDataRepository monitoringDataRepository;
    
    @Scheduled(fixedRate = 60000) // 每分钟持久化一次
    public void persistMonitoringData() {
        // 收集监控数据
        MonitoringData data = collectMonitoringData();
        
        // 持久化到数据库
        monitoringDataRepository.save(data);
        
        // 清理过期数据
        monitoringDataRepository.deleteExpiredData(7); // 保留7天数据
    }
    
    private MonitoringData collectMonitoringData() {
        MonitoringData data = new MonitoringData();
        data.setTimestamp(new Date());
        data.setTransactionSuccessCount(getCounterValue("transaction.success"));
        data.setTransactionFailureCount(getCounterValue("transaction.failure"));
        data.setAverageTransactionDuration(getTimerAverage("transaction.duration"));
        // ... 收集其他监控数据
        return data;
    }
}
```

## 总结

事务监控与追踪是分布式事务系统中不可或缺的重要组成部分。通过完善的监控体系，我们可以：

1. **实时了解系统状态**：通过可视化面板实时监控事务执行情况
2. **快速定位问题**：通过链路追踪快速定位故障点
3. **预防潜在风险**：通过告警机制及时发现和处理异常
4. **满足合规要求**：通过审计日志满足业务合规性要求
5. **持续优化系统**：通过数据分析持续优化系统性能

在实际应用中，我们需要：

1. **选择合适的监控工具**：根据团队技术栈选择合适的监控和追踪工具
2. **设计合理的监控指标**：从业务和系统两个维度设计监控指标
3. **建立完善的告警机制**：设置合理的告警阈值和通知渠道
4. **规范日志格式**：统一日志格式，便于分析和排查问题
5. **持续优化监控体系**：根据系统演进持续优化监控体系

通过建立完善的事务监控与追踪体系，我们可以大大提升分布式事务系统的可观测性和可靠性，为业务的稳定运行提供有力保障。