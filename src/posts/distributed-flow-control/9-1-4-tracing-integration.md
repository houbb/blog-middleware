---
title: "链路追踪集成: 在调用链上标记被限流的请求"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在现代分布式系统中，链路追踪已成为理解和诊断系统行为的重要工具。通过在调用链上标记被限流的请求，我们可以清晰地看到限流策略在系统中的实际效果，分析限流对用户体验的影响，并快速定位性能瓶颈。本章将深入探讨如何将分布式限流系统与链路追踪技术集成，在调用链上准确标记被限流的请求，为系统优化和故障排查提供有力支持。

## 链路追踪基础

### 分布式追踪概念

分布式追踪是一种用于跟踪请求在分布式系统中流转的技术，它通过为每个请求分配唯一的追踪ID（Trace ID），并在请求流经各个服务时记录相关信息，最终形成完整的调用链路图。

核心概念包括：
1. **Trace**：一个完整的请求调用链路，由多个Span组成
2. **Span**：一次操作的执行单元，包含操作名称、开始时间、结束时间等信息
3. **Trace ID**：全局唯一的追踪标识符
4. **Span ID**：Span的唯一标识符
5. **Parent Span ID**：父级Span的标识符，用于构建调用关系

### OpenTelemetry集成

```java
// 链路追踪集成配置
@Configuration
public class TracingConfiguration {
    
    @Bean
    public OpenTelemetry openTelemetry() {
        // 初始化OpenTelemetry SDK
        return OpenTelemetrySdk.builder()
            .setTracerProvider(SdkTracerProvider.builder()
                .addSpanProcessor(BatchSpanProcessor.builder(OtlpGrpcSpanExporter.builder()
                    .setEndpoint("http://localhost:4317")
                    .build())
                    .build())
                .setResource(Resource.getDefault()
                    .toBuilder()
                    .put(ResourceAttributes.SERVICE_NAME, "distributed-flow-control")
                    .build())
                .build())
            .buildAndRegisterGlobal();
    }
    
    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer("flow-control-tracer");
    }
}
```

## 限流标记实现

### 限流Span创建

```java
// 限流追踪标记器
@Component
public class RateLimitTracingMarker {
    private final Tracer tracer;
    private final MeterRegistry meterRegistry;
    
    public RateLimitTracingMarker(Tracer tracer, MeterRegistry meterRegistry) {
        this.tracer = tracer;
        this.meterRegistry = meterRegistry;
    }
    
    public void markRateLimitedRequest(String resource, String ruleId, String reason) {
        try {
            // 获取当前活跃的Span
            Span currentSpan = getCurrentSpan();
            if (currentSpan != null) {
                // 在当前Span上添加限流标记
                markSpanAsRateLimited(currentSpan, resource, ruleId, reason);
            }
            
            // 创建独立的限流Span（可选）
            createRateLimitSpan(resource, ruleId, reason);
            
            // 记录限流指标
            recordRateLimitMetrics(resource, ruleId, reason);
        } catch (Exception e) {
            log.warn("Failed to mark rate limited request in tracing", e);
        }
    }
    
    private Span getCurrentSpan() {
        // 获取当前上下文中的Span
        return Span.current();
    }
    
    private void markSpanAsRateLimited(Span span, String resource, String ruleId, String reason) {
        // 添加限流相关属性
        span.setAttribute("flow.control.rate_limited", true);
        span.setAttribute("flow.control.resource", resource);
        span.setAttribute("flow.control.rule_id", ruleId);
        span.setAttribute("flow.control.reason", reason);
        span.setAttribute("flow.control.timestamp", System.currentTimeMillis());
        
        // 添加事件标记
        span.addEvent("Rate Limited", Attributes.builder()
            .put("resource", resource)
            .put("rule_id", ruleId)
            .put("reason", reason)
            .build());
        
        // 设置状态为错误（可选）
        span.setStatus(StatusCode.ERROR, "Request rate limited");
    }
    
    private void createRateLimitSpan(String resource, String ruleId, String reason) {
        // 创建专门的限流Span
        Span rateLimitSpan = tracer.spanBuilder("rate_limit_check")
            .setSpanKind(SpanKind.INTERNAL)
            .startSpan();
        
        try (Scope scope = rateLimitSpan.makeCurrent()) {
            // 添加详细属性
            rateLimitSpan.setAttribute("flow.control.resource", resource);
            rateLimitSpan.setAttribute("flow.control.rule_id", ruleId);
            rateLimitSpan.setAttribute("flow.control.reason", reason);
            rateLimitSpan.setAttribute("flow.control.action", "REJECTED");
            
            // 添加事件
            rateLimitSpan.addEvent("Request rejected due to rate limiting");
        } finally {
            rateLimitSpan.end();
        }
    }
    
    private void recordRateLimitMetrics(String resource, String ruleId, String reason) {
        // 记录限流指标到监控系统
        Counter.builder("flow.control.requests.rate_limited")
            .tag("resource", resource)
            .tag("rule_id", ruleId)
            .tag("reason", reason)
            .register(meterRegistry)
            .increment();
    }
}
```

### 限流决策追踪

```java
// 限流决策追踪器
@Component
public class RateLimitDecisionTracer {
    private final Tracer tracer;
    private final MeterRegistry meterRegistry;
    
    public RateLimitDecisionTracer(Tracer tracer, MeterRegistry meterRegistry) {
        this.tracer = tracer;
        this.meterRegistry = meterRegistry;
    }
    
    public <T> T traceRateLimitDecision(String resource, String ruleId, 
                                      Supplier<RateLimitResult> decisionSupplier) {
        // 创建限流决策Span
        Span decisionSpan = tracer.spanBuilder("rate_limit_decision")
            .setSpanKind(SpanKind.INTERNAL)
            .startSpan();
        
        try (Scope scope = decisionSpan.makeCurrent()) {
            // 添加基础属性
            decisionSpan.setAttribute("flow.control.resource", resource);
            decisionSpan.setAttribute("flow.control.rule_id", ruleId);
            decisionSpan.setAttribute("flow.control.start_time", System.currentTimeMillis());
            
            long startTime = System.nanoTime();
            
            // 执行限流决策
            RateLimitResult result = decisionSupplier.get();
            
            long endTime = System.nanoTime();
            long durationMs = TimeUnit.NANOSECONDS.toMillis(endTime - startTime);
            
            // 记录决策结果
            decisionSpan.setAttribute("flow.control.result", result.isAllowed() ? "ALLOWED" : "REJECTED");
            decisionSpan.setAttribute("flow.control.duration_ms", durationMs);
            decisionSpan.setAttribute("flow.control.reason", result.getReason());
            
            if (result.getMetrics() != null) {
                // 记录详细指标
                recordDetailedMetrics(decisionSpan, result.getMetrics());
            }
            
            // 添加决策事件
            decisionSpan.addEvent("Rate limit decision made", Attributes.builder()
                .put("result", result.isAllowed() ? "ALLOWED" : "REJECTED")
                .put("reason", result.getReason())
                .put("duration_ms", durationMs)
                .build());
            
            // 如果被限流，标记Span
            if (!result.isAllowed()) {
                decisionSpan.setStatus(StatusCode.ERROR, "Rate limit exceeded");
            }
            
            return (T) result;
        } finally {
            decisionSpan.end();
        }
    }
    
    private void recordDetailedMetrics(Span span, RateLimitMetrics metrics) {
        if (metrics.getCurrentCount() != null) {
            span.setAttribute("flow.control.current_count", metrics.getCurrentCount());
        }
        if (metrics.getThreshold() != null) {
            span.setAttribute("flow.control.threshold", metrics.getThreshold());
        }
        if (metrics.getRemaining() != null) {
            span.setAttribute("flow.control.remaining", metrics.getRemaining());
        }
        if (metrics.getWindowSize() != null) {
            span.setAttribute("flow.control.window_size", metrics.getWindowSize());
        }
    }
    
    // 限流结果
    public static class RateLimitResult {
        private final boolean allowed;
        private final String reason;
        private final RateLimitMetrics metrics;
        
        public RateLimitResult(boolean allowed, String reason, RateLimitMetrics metrics) {
            this.allowed = allowed;
            this.reason = reason;
            this.metrics = metrics;
        }
        
        // getter方法
        public boolean isAllowed() { return allowed; }
        public String getReason() { return reason; }
        public RateLimitMetrics getMetrics() { return metrics; }
    }
    
    // 限流指标
    public static class RateLimitMetrics {
        private Long currentCount;
        private Long threshold;
        private Long remaining;
        private Long windowSize;
        
        // getter和setter方法
        public Long getCurrentCount() { return currentCount; }
        public void setCurrentCount(Long currentCount) { this.currentCount = currentCount; }
        public Long getThreshold() { return threshold; }
        public void setThreshold(Long threshold) { this.threshold = threshold; }
        public Long getRemaining() { return remaining; }
        public void setRemaining(Long remaining) { this.remaining = remaining; }
        public Long getWindowSize() { return windowSize; }
        public void setWindowSize(Long windowSize) { this.windowSize = windowSize; }
    }
}
```

## 网关层集成

### API网关限流追踪

```java
// API网关限流追踪过滤器
@Component
@Order(100)
public class RateLimitTracingGatewayFilter implements GlobalFilter {
    private final RateLimitTracingMarker tracingMarker;
    private final RateLimitDecisionTracer decisionTracer;
    private final RateLimitService rateLimitService;
    
    public RateLimitTracingGatewayFilter(RateLimitTracingMarker tracingMarker,
                                       RateLimitDecisionTracer decisionTracer,
                                       RateLimitService rateLimitService) {
        this.tracingMarker = tracingMarker;
        this.decisionTracer = decisionTracer;
        this.rateLimitService = rateLimitService;
    }
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        
        // 提取请求信息
        String resource = extractResource(request);
        String clientId = extractClientId(request);
        
        // 执行限流决策追踪
        return decisionTracer.traceRateLimitDecision(
            resource, 
            "gateway-rule", 
            () -> makeRateLimitDecision(resource, clientId)
        ).flatMap(result -> {
            if (result.isAllowed()) {
                // 允许请求通过
                return chain.filter(exchange);
            } else {
                // 标记被限流的请求并返回错误响应
                tracingMarker.markRateLimitedRequest(resource, "gateway-rule", result.getReason());
                return handleRateLimitExceeded(exchange, result);
            }
        });
    }
    
    private RateLimitDecisionTracer.RateLimitResult makeRateLimitDecision(String resource, String clientId) {
        try {
            // 执行限流检查
            RateLimitCheckResult checkResult = rateLimitService.checkRateLimit(resource, clientId);
            
            RateLimitDecisionTracer.RateLimitMetrics metrics = new RateLimitDecisionTracer.RateLimitMetrics();
            metrics.setCurrentCount(checkResult.getCurrentCount());
            metrics.setThreshold(checkResult.getThreshold());
            metrics.setRemaining(checkResult.getRemaining());
            metrics.setWindowSize(checkResult.getWindowSize());
            
            return new RateLimitDecisionTracer.RateLimitResult(
                checkResult.isAllowed(), 
                checkResult.getReason(), 
                metrics
            );
        } catch (Exception e) {
            log.error("Failed to make rate limit decision", e);
            return new RateLimitDecisionTracer.RateLimitResult(
                false, 
                "Internal error: " + e.getMessage(), 
                null
            );
        }
    }
    
    private String extractResource(ServerHttpRequest request) {
        // 提取资源标识（API路径等）
        return request.getPath().value();
    }
    
    private String extractClientId(ServerHttpRequest request) {
        // 提取客户端标识（IP、用户ID等）
        return request.getRemoteAddress().getAddress().getHostAddress();
    }
    
    private Mono<Void> handleRateLimitExceeded(ServerWebExchange exchange, 
                                             RateLimitDecisionTracer.RateLimitResult result) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        response.getHeaders().add("X-RateLimit-Reason", result.getReason());
        
        String responseBody = String.format(
            "{\"error\": \"Rate limit exceeded\", \"reason\": \"%s\"}", 
            result.getReason()
        );
        
        DataBuffer buffer = response.bufferFactory().wrap(responseBody.getBytes(StandardCharsets.UTF_8));
        response.getHeaders().add("Content-Type", "application/json;charset=UTF-8");
        
        return response.writeWith(Mono.just(buffer));
    }
}
```

### 微服务层集成

```java
// 微服务限流追踪拦截器
@Component
public class RateLimitTracingInterceptor implements HandlerInterceptor {
    private final RateLimitTracingMarker tracingMarker;
    private final RateLimitDecisionTracer decisionTracer;
    
    public RateLimitTracingInterceptor(RateLimitTracingMarker tracingMarker,
                                     RateLimitDecisionTracer decisionTracer) {
        this.tracingMarker = tracingMarker;
        this.decisionTracer = decisionTracer;
    }
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, 
                           Object handler) throws Exception {
        
        // 提取请求信息
        String resource = extractResource(request);
        String userId = extractUserId(request);
        
        // 执行限流决策追踪
        RateLimitDecisionTracer.RateLimitResult result = decisionTracer.traceRateLimitDecision(
            resource, 
            "service-rule", 
            () -> makeRateLimitDecision(resource, userId)
        );
        
        if (!result.isAllowed()) {
            // 标记被限流的请求
            tracingMarker.markRateLimitedRequest(resource, "service-rule", result.getReason());
            
            // 设置响应
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("X-RateLimit-Reason", result.getReason());
            response.getWriter().write(
                String.format("{\"error\": \"Rate limit exceeded\", \"reason\": \"%s\"}", 
                            result.getReason())
            );
            
            return false; // 阻止请求继续处理
        }
        
        return true; // 允许请求继续处理
    }
    
    private RateLimitDecisionTracer.RateLimitResult makeRateLimitDecision(String resource, String userId) {
        // 实现限流决策逻辑
        // 这里简化处理，实际应该调用限流服务
        return new RateLimitDecisionTracer.RateLimitResult(true, "Allowed", null);
    }
    
    private String extractResource(HttpServletRequest request) {
        return request.getRequestURI();
    }
    
    private String extractUserId(HttpServletRequest request) {
        // 从请求头或JWT中提取用户ID
        return request.getHeader("X-User-ID");
    }
}
```

## 上下文传播

### 限流上下文传递

```java
// 限流上下文传播工具
public class RateLimitContextPropagator {
    private static final String RATE_LIMIT_HEADER = "X-RateLimit-Context";
    
    // 注入限流上下文到HTTP请求头
    public static void injectRateLimitContext(HttpHeaders headers, RateLimitContext context) {
        try {
            String contextJson = ObjectMapperUtils.toJson(context);
            String encodedContext = Base64.getEncoder().encodeToString(contextJson.getBytes(StandardCharsets.UTF_8));
            headers.set(RATE_LIMIT_HEADER, encodedContext);
        } catch (Exception e) {
            log.warn("Failed to inject rate limit context", e);
        }
    }
    
    // 从HTTP请求头提取限流上下文
    public static RateLimitContext extractRateLimitContext(HttpHeaders headers) {
        try {
            String encodedContext = headers.getFirst(RATE_LIMIT_HEADER);
            if (encodedContext != null) {
                byte[] decodedBytes = Base64.getDecoder().decode(encodedContext);
                String contextJson = new String(decodedBytes, StandardCharsets.UTF_8);
                return ObjectMapperUtils.fromJson(contextJson, RateLimitContext.class);
            }
        } catch (Exception e) {
            log.warn("Failed to extract rate limit context", e);
        }
        return null;
    }
    
    // 在gRPC元数据中传播限流上下文
    public static void injectRateLimitContext(Metadata metadata, RateLimitContext context) {
        try {
            String contextJson = ObjectMapperUtils.toJson(context);
            Metadata.Key<String> key = Metadata.Key.of(RATE_LIMIT_HEADER, Metadata.ASCII_STRING_MARSHALLER);
            metadata.put(key, contextJson);
        } catch (Exception e) {
            log.warn("Failed to inject rate limit context to gRPC metadata", e);
        }
    }
    
    public static RateLimitContext extractRateLimitContext(Metadata metadata) {
        try {
            Metadata.Key<String> key = Metadata.Key.of(RATE_LIMIT_HEADER, Metadata.ASCII_STRING_MARSHALLER);
            String contextJson = metadata.get(key);
            if (contextJson != null) {
                return ObjectMapperUtils.fromJson(contextJson, RateLimitContext.class);
            }
        } catch (Exception e) {
            log.warn("Failed to extract rate limit context from gRPC metadata", e);
        }
        return null;
    }
    
    // 限流上下文数据结构
    public static class RateLimitContext {
        private String traceId;
        private String spanId;
        private String resource;
        private String ruleId;
        private boolean rateLimited;
        private String reason;
        private long timestamp;
        private Map<String, Object> customAttributes;
        
        public RateLimitContext() {
            this.customAttributes = new HashMap<>();
        }
        
        // getter和setter方法
        public String getTraceId() { return traceId; }
        public void setTraceId(String traceId) { this.traceId = traceId; }
        public String getSpanId() { return spanId; }
        public void setSpanId(String spanId) { this.spanId = spanId; }
        public String getResource() { return resource; }
        public void setResource(String resource) { this.resource = resource; }
        public String getRuleId() { return ruleId; }
        public void setRuleId(String ruleId) { this.ruleId = ruleId; }
        public boolean isRateLimited() { return rateLimited; }
        public void setRateLimited(boolean rateLimited) { this.rateLimited = rateLimited; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public Map<String, Object> getCustomAttributes() { return customAttributes; }
        public void setCustomAttributes(Map<String, Object> customAttributes) { this.customAttributes = customAttributes; }
    }
}
```

### 分布式上下文管理

```java
// 分布式限流上下文管理器
@Component
public class DistributedRateLimitContextManager {
    private final Tracer tracer;
    private final MeterRegistry meterRegistry;
    
    public DistributedRateLimitContextManager(Tracer tracer, MeterRegistry meterRegistry) {
        this.tracer = tracer;
        this.meterRegistry = meterRegistry;
    }
    
    // 创建限流上下文
    public RateLimitContext createRateLimitContext(String resource, String ruleId, 
                                                 boolean rateLimited, String reason) {
        Span currentSpan = Span.current();
        
        RateLimitContext context = new RateLimitContext();
        context.setTraceId(currentSpan.getSpanContext().getTraceId());
        context.setSpanId(currentSpan.getSpanContext().getSpanId());
        context.setResource(resource);
        context.setRuleId(ruleId);
        context.setRateLimited(rateLimited);
        context.setReason(reason);
        context.setTimestamp(System.currentTimeMillis());
        
        return context;
    }
    
    // 传播限流上下文
    public void propagateRateLimitContext(RateLimitContext context, HttpHeaders headers) {
        RateLimitContextPropagator.injectRateLimitContext(headers, context);
        
        // 同时在当前Span上标记
        Span currentSpan = Span.current();
        if (currentSpan != null) {
            currentSpan.setAttribute("flow.control.context_propagated", true);
            currentSpan.setAttribute("flow.control.remote_rate_limited", context.isRateLimited());
        }
    }
    
    // 接收并处理限流上下文
    public void handleReceivedRateLimitContext(RateLimitContext context) {
        if (context.isRateLimited()) {
            // 记录接收到的限流信息
            log.info("Received rate limited request from upstream: resource={}, rule={}, reason={}", 
                    context.getResource(), context.getRuleId(), context.getReason());
            
            // 在当前Span上标记
            Span currentSpan = Span.current();
            if (currentSpan != null) {
                currentSpan.setAttribute("flow.control.upstream_rate_limited", true);
                currentSpan.setAttribute("flow.control.upstream_resource", context.getResource());
                currentSpan.setAttribute("flow.control.upstream_rule", context.getRuleId());
                currentSpan.setAttribute("flow.control.upstream_reason", context.getReason());
                
                currentSpan.addEvent("Upstream rate limit detected", Attributes.builder()
                    .put("resource", context.getResource())
                    .put("rule", context.getRuleId())
                    .put("reason", context.getReason())
                    .build());
            }
            
            // 记录指标
            Counter.builder("flow.control.upstream_rate_limited")
                .tag("resource", context.getResource())
                .tag("rule", context.getRuleId())
                .register(meterRegistry)
                .increment();
        }
    }
    
    // 获取完整的限流历史
    public List<RateLimitContext> getRateLimitHistory() {
        // 实现获取限流历史的逻辑
        // 可以从Trace系统查询相关的限流事件
        return new ArrayList<>();
    }
}
```

## 追踪数据分析

### 限流追踪查询

```java
// 限流追踪查询服务
@Service
public class RateLimitTracingQueryService {
    private final TracingBackendClient tracingClient;
    private final MetricsQueryService metricsService;
    
    public RateLimitTracingQueryService(TracingBackendClient tracingClient,
                                      MetricsQueryService metricsService) {
        this.tracingClient = tracingClient;
        this.metricsService = metricsService;
    }
    
    // 查询被限流的请求
    public List<RateLimitedRequestInfo> queryRateLimitedRequests(LocalDateTime startTime, 
                                                              LocalDateTime endTime,
                                                              String resource,
                                                              String ruleId) {
        try {
            // 构造查询条件
            TraceQueryCondition condition = new TraceQueryCondition();
            condition.setStartTime(startTime);
            condition.setEndTime(endTime);
            condition.setServiceName("distributed-flow-control");
            
            // 添加限流相关标签过滤
            Map<String, String> tags = new HashMap<>();
            tags.put("flow.control.rate_limited", "true");
            if (resource != null) {
                tags.put("flow.control.resource", resource);
            }
            if (ruleId != null) {
                tags.put("flow.control.rule_id", ruleId);
            }
            condition.setTags(tags);
            
            // 执行查询
            List<TraceInfo> traces = tracingClient.queryTraces(condition);
            
            // 转换为限流请求信息
            return traces.stream()
                .map(this::convertToRateLimitedRequestInfo)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to query rate limited requests", e);
            return new ArrayList<>();
        }
    }
    
    private RateLimitedRequestInfo convertToRateLimitedRequestInfo(TraceInfo trace) {
        RateLimitedRequestInfo info = new RateLimitedRequestInfo();
        info.setTraceId(trace.getTraceId());
        info.setStartTime(trace.getStartTime());
        info.setDuration(trace.getDuration());
        
        // 查找限流相关的Span
        SpanInfo rateLimitSpan = findRateLimitSpan(trace.getSpans());
        if (rateLimitSpan != null) {
            info.setResource(rateLimitSpan.getTags().get("flow.control.resource"));
            info.setRuleId(rateLimitSpan.getTags().get("flow.control.rule_id"));
            info.setReason(rateLimitSpan.getTags().get("flow.control.reason"));
            info.setRateLimitedTimestamp(
                Long.parseLong(rateLimitSpan.getTags().getOrDefault("flow.control.timestamp", "0"))
            );
        }
        
        // 获取调用链信息
        info.setCallChain(buildCallChain(trace.getSpans()));
        
        return info;
    }
    
    private SpanInfo findRateLimitSpan(List<SpanInfo> spans) {
        return spans.stream()
            .filter(span -> "true".equals(span.getTags().get("flow.control.rate_limited")))
            .findFirst()
            .orElse(null);
    }
    
    private List<CallChainNode> buildCallChain(List<SpanInfo> spans) {
        List<CallChainNode> chain = new ArrayList<>();
        
        // 按时间排序
        spans.sort(Comparator.comparing(SpanInfo::getStartTime));
        
        for (SpanInfo span : spans) {
            CallChainNode node = new CallChainNode();
            node.setSpanId(span.getSpanId());
            node.setParentSpanId(span.getParentSpanId());
            node.setOperationName(span.getOperationName());
            node.setStartTime(span.getStartTime());
            node.setDuration(span.getDuration());
            node.setServiceName(span.getServiceName());
            node.setTags(span.getTags());
            
            chain.add(node);
        }
        
        return chain;
    }
    
    // 获取限流统计信息
    public RateLimitStatistics getRateLimitStatistics(LocalDateTime startTime, 
                                                    LocalDateTime endTime) {
        try {
            RateLimitStatistics stats = new RateLimitStatistics();
            
            // 查询限流指标
            List<MetricDataPoint> rateLimitedPoints = metricsService.queryMetrics(
                "flow.control.requests.rate_limited", startTime, endTime);
            
            List<MetricDataPoint> allowedPoints = metricsService.queryMetrics(
                "flow.control.requests.allowed", startTime, endTime);
            
            // 计算统计数据
            stats.setTotalRateLimitedRequests(rateLimitedPoints.stream()
                .mapToLong(MetricDataPoint::getValue)
                .sum());
                
            stats.setTotalAllowedRequests(allowedPoints.stream()
                .mapToLong(MetricDataPoint::getValue)
                .sum());
                
            long totalRequests = stats.getTotalRateLimitedRequests() + stats.getTotalAllowedRequests();
            if (totalRequests > 0) {
                stats.setRateLimitRatio((double) stats.getTotalRateLimitedRequests() / totalRequests);
            }
            
            // 按资源统计
            stats.setRateLimitedByResource(analyzeByResource(rateLimitedPoints));
            
            // 按规则统计
            stats.setRateLimitedByRule(analyzeByRule(rateLimitedPoints));
            
            return stats;
        } catch (Exception e) {
            log.error("Failed to get rate limit statistics", e);
            return new RateLimitStatistics();
        }
    }
    
    private Map<String, Long> analyzeByResource(List<MetricDataPoint> points) {
        return points.stream()
            .filter(point -> point.getTags().containsKey("resource"))
            .collect(Collectors.groupingBy(
                point -> point.getTags().get("resource"),
                Collectors.summingLong(MetricDataPoint::getValue)
            ));
    }
    
    private Map<String, Long> analyzeByRule(List<MetricDataPoint> points) {
        return points.stream()
            .filter(point -> point.getTags().containsKey("rule_id"))
            .collect(Collectors.groupingBy(
                point -> point.getTags().get("rule_id"),
                Collectors.summingLong(MetricDataPoint::getValue)
            ));
    }
    
    // 限流请求信息
    public static class RateLimitedRequestInfo {
        private String traceId;
        private LocalDateTime startTime;
        private long duration;
        private String resource;
        private String ruleId;
        private String reason;
        private long rateLimitedTimestamp;
        private List<CallChainNode> callChain;
        
        public RateLimitedRequestInfo() {
            this.callChain = new ArrayList<>();
        }
        
        // getter和setter方法
        public String getTraceId() { return traceId; }
        public void setTraceId(String traceId) { this.traceId = traceId; }
        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }
        public String getResource() { return resource; }
        public void setResource(String resource) { this.resource = resource; }
        public String getRuleId() { return ruleId; }
        public void setRuleId(String ruleId) { this.ruleId = ruleId; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public long getRateLimitedTimestamp() { return rateLimitedTimestamp; }
        public void setRateLimitedTimestamp(long rateLimitedTimestamp) { this.rateLimitedTimestamp = rateLimitedTimestamp; }
        public List<CallChainNode> getCallChain() { return callChain; }
        public void setCallChain(List<CallChainNode> callChain) { this.callChain = callChain; }
    }
    
    // 调用链节点
    public static class CallChainNode {
        private String spanId;
        private String parentSpanId;
        private String operationName;
        private LocalDateTime startTime;
        private long duration;
        private String serviceName;
        private Map<String, String> tags;
        
        public CallChainNode() {
            this.tags = new HashMap<>();
        }
        
        // getter和setter方法
        public String getSpanId() { return spanId; }
        public void setSpanId(String spanId) { this.spanId = spanId; }
        public String getParentSpanId() { return parentSpanId; }
        public void setParentSpanId(String parentSpanId) { this.parentSpanId = parentSpanId; }
        public String getOperationName() { return operationName; }
        public void setOperationName(String operationName) { this.operationName = operationName; }
        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }
        public String getServiceName() { return serviceName; }
        public void setServiceName(String serviceName) { this.serviceName = serviceName; }
        public Map<String, String> getTags() { return tags; }
        public void setTags(Map<String, String> tags) { this.tags = tags; }
    }
    
    // 限流统计信息
    public static class RateLimitStatistics {
        private long totalRateLimitedRequests;
        private long totalAllowedRequests;
        private double rateLimitRatio;
        private Map<String, Long> rateLimitedByResource;
        private Map<String, Long> rateLimitedByRule;
        
        public RateLimitStatistics() {
            this.rateLimitedByResource = new HashMap<>();
            this.rateLimitedByRule = new HashMap<>();
        }
        
        // getter和setter方法
        public long getTotalRateLimitedRequests() { return totalRateLimitedRequests; }
        public void setTotalRateLimitedRequests(long totalRateLimitedRequests) { this.totalRateLimitedRequests = totalRateLimitedRequests; }
        public long getTotalAllowedRequests() { return totalAllowedRequests; }
        public void setTotalAllowedRequests(long totalAllowedRequests) { this.totalAllowedRequests = totalAllowedRequests; }
        public double getRateLimitRatio() { return rateLimitRatio; }
        public void setRateLimitRatio(double rateLimitRatio) { this.rateLimitRatio = rateLimitRatio; }
        public Map<String, Long> getRateLimitedByResource() { return rateLimitedByResource; }
        public void setRateLimitedByResource(Map<String, Long> rateLimitedByResource) { this.rateLimitedByResource = rateLimitedByResource; }
        public Map<String, Long> getRateLimitedByRule() { return rateLimitedByRule; }
        public void setRateLimitedByRule(Map<String, Long> rateLimitedByRule) { this.rateLimitedByRule = rateLimitedByRule; }
    }
}
```

### 追踪数据可视化

```java
// 限流追踪数据控制器
@RestController
@RequestMapping("/api/v1/tracing/rate-limit")
public class RateLimitTracingController {
    private final RateLimitTracingQueryService queryService;
    
    public RateLimitTracingController(RateLimitTracingQueryService queryService) {
        this.queryService = queryService;
    }
    
    @GetMapping("/requests")
    public ResponseEntity<List<RateLimitTracingQueryService.RateLimitedRequestInfo>> queryRateLimitedRequests(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(required = false) String resource,
            @RequestParam(required = false) String ruleId) {
        
        try {
            List<RateLimitTracingQueryService.RateLimitedRequestInfo> requests = 
                queryService.queryRateLimitedRequests(startTime, endTime, resource, ruleId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            log.error("Failed to query rate limited requests", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/statistics")
    public ResponseEntity<RateLimitTracingQueryService.RateLimitStatistics> getRateLimitStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        
        try {
            RateLimitTracingQueryService.RateLimitStatistics statistics = 
                queryService.getRateLimitStatistics(startTime, endTime);
            return ResponseEntity.ok(statistics);
        } catch (Exception e) {
            log.error("Failed to get rate limit statistics", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/timeline")
    public ResponseEntity<List<RateLimitTimelinePoint>> getRateLimitTimeline(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(defaultValue = "1m") String interval) {
        
        try {
            List<RateLimitTimelinePoint> timeline = buildRateLimitTimeline(startTime, endTime, interval);
            return ResponseEntity.ok(timeline);
        } catch (Exception e) {
            log.error("Failed to build rate limit timeline", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    private List<RateLimitTimelinePoint> buildRateLimitTimeline(LocalDateTime startTime, 
                                                              LocalDateTime endTime, 
                                                              String interval) {
        // 实现时间线数据构建逻辑
        return new ArrayList<>(); // 简化示例
    }
    
    // 限流时间线数据点
    public static class RateLimitTimelinePoint {
        private LocalDateTime timestamp;
        private long rateLimitedCount;
        private long allowedCount;
        private double rateLimitRatio;
        private Map<String, Long> byResource;
        private Map<String, Long> byRule;
        
        public RateLimitTimelinePoint() {
            this.byResource = new HashMap<>();
            this.byRule = new HashMap<>();
        }
        
        // getter和setter方法
        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
        public long getRateLimitedCount() { return rateLimitedCount; }
        public void setRateLimitedCount(long rateLimitedCount) { this.rateLimitedCount = rateLimitedCount; }
        public long getAllowedCount() { return allowedCount; }
        public void setAllowedCount(long allowedCount) { this.allowedCount = allowedCount; }
        public double getRateLimitRatio() { return rateLimitRatio; }
        public void setRateLimitRatio(double rateLimitRatio) { this.rateLimitRatio = rateLimitRatio; }
        public Map<String, Long> getByResource() { return byResource; }
        public void setByResource(Map<String, Long> byResource) { this.byResource = byResource; }
        public Map<String, Long> getByRule() { return byRule; }
        public void setByRule(Map<String, Long> byRule) { this.byRule = byRule; }
    }
}
```

## 最佳实践与优化

### 性能优化建议

```java
// 高性能限流追踪实现
@Component
public class HighPerformanceRateLimitTracer {
    private final Tracer tracer;
    private final AsyncMetricsRecorder metricsRecorder;
    private final RateLimitContextCache contextCache;
    
    public HighPerformanceRateLimitTracer(Tracer tracer, 
                                        AsyncMetricsRecorder metricsRecorder,
                                        RateLimitContextCache contextCache) {
        this.tracer = tracer;
        this.metricsRecorder = metricsRecorder;
        this.contextCache = contextCache;
    }
    
    // 异步标记限流请求
    public void markRateLimitedAsync(String resource, String ruleId, String reason) {
        // 使用异步方式记录指标，避免阻塞主流程
        metricsRecorder.recordRateLimitMetricAsync(resource, ruleId, reason);
        
        // 缓存限流上下文，供后续查询使用
        RateLimitContext context = createCachedContext(resource, ruleId, reason);
        contextCache.put(context);
    }
    
    // 轻量级Span标记
    public void markSpanLightweight(String reason) {
        Span currentSpan = Span.current();
        if (currentSpan != null) {
            // 只添加必要的属性，避免过多的元数据
            currentSpan.setAttribute("rate_limited", true);
            currentSpan.setAttribute("reason", reason);
        }
    }
    
    private RateLimitContext createCachedContext(String resource, String ruleId, String reason) {
        RateLimitContext context = new RateLimitContext();
        context.setTraceId(getCurrentTraceId());
        context.setTimestamp(System.currentTimeMillis());
        context.setResource(resource);
        context.setRuleId(ruleId);
        context.setReason(reason);
        return context;
    }
    
    private String getCurrentTraceId() {
        Span currentSpan = Span.current();
        return currentSpan != null ? currentSpan.getSpanContext().getTraceId() : "";
    }
    
    // 异步指标记录器
    @Component
    public static class AsyncMetricsRecorder {
        private final MeterRegistry meterRegistry;
        private final ExecutorService executorService;
        
        public AsyncMetricsRecorder(MeterRegistry meterRegistry) {
            this.meterRegistry = meterRegistry;
            this.executorService = Executors.newFixedThreadPool(10);
        }
        
        public void recordRateLimitMetricAsync(String resource, String ruleId, String reason) {
            executorService.submit(() -> {
                try {
                    Counter.builder("flow.control.requests.rate_limited")
                        .tag("resource", resource)
                        .tag("rule_id", ruleId)
                        .tag("reason", reason)
                        .register(meterRegistry)
                        .increment();
                } catch (Exception e) {
                    log.warn("Failed to record rate limit metric asynchronously", e);
                }
            });
        }
    }
    
    // 限流上下文缓存
    @Component
    public static class RateLimitContextCache {
        private final Cache<String, RateLimitContext> cache;
        
        public RateLimitContextCache() {
            this.cache = Caffeine.newBuilder()
                .maximumSize(10000)
                .expireAfterWrite(10, TimeUnit.MINUTES)
                .build();
        }
        
        public void put(RateLimitContext context) {
            String key = context.getTraceId() + ":" + context.getTimestamp();
            cache.put(key, context);
        }
        
        public RateLimitContext get(String traceId, long timestamp) {
            String key = traceId + ":" + timestamp;
            return cache.getIfPresent(key);
        }
    }
}
```

通过以上实现，我们构建了一个完整的分布式限流系统与链路追踪集成方案，能够在调用链上准确标记被限流的请求。该方案不仅提供了详细的追踪信息，还支持丰富的查询和分析功能，为系统优化和故障排查提供了有力支持。在实际应用中，需要根据具体的业务场景和技术栈选择合适的追踪工具和集成方式，以达到最佳的监控效果。