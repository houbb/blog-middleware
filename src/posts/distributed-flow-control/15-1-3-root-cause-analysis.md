---
title: "根因分析: 限流发生后的自动根因定位与故障诊断"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式系统中，当限流事件发生时，快速准确地定位根因对于系统恢复和问题解决至关重要。传统的手动排查方式效率低下且容易遗漏关键信息。通过引入智能化的根因分析技术，我们可以自动识别限流事件的根本原因，大幅缩短故障诊断时间，提高系统的可维护性。本章将深入探讨如何构建自动化的根因分析系统，实现限流事件的快速诊断和处理。

## 根因分析概述

### 限流事件的复杂性

限流事件的发生往往不是单一因素导致的，可能涉及多个维度的原因：

1. **业务流量激增**：促销活动、热点事件等导致正常业务流量突增
2. **系统性能下降**：数据库慢查询、缓存失效、GC频繁等导致处理能力下降
3. **资源配置不足**：CPU、内存、网络带宽等资源瓶颈
4. **依赖服务异常**：下游服务响应慢或不可用
5. **配置错误**：限流规则配置不当、阈值设置过低
6. **恶意攻击**：DDoS攻击、CC攻击等异常流量

### 根因分析的价值

自动化的根因分析能够带来以下价值：

1. **快速响应**：大幅缩短故障诊断时间
2. **准确定位**：提高根因识别的准确性
3. **降低影响**：减少故障对业务的影响时间
4. **经验积累**：形成知识库，提升团队整体故障处理能力
5. **预防机制**：基于历史数据建立预警机制

## 多维度根因分析器

### 系统指标分析器

```java
// 系统指标根因分析器
@Component
public class SystemMetricsRootCauseAnalyzer {
    private final RedisTemplate<String, String> redisTemplate;
    private final SystemMetricsCollector metricsCollector;
    
    public SystemMetricsRootCauseAnalyzer(RedisTemplate<String, String> redisTemplate,
                                        SystemMetricsCollector metricsCollector) {
        this.redisTemplate = redisTemplate;
        this.metricsCollector = metricsCollector;
    }
    
    public List<RootCause> analyze(RateLimitEvent event) {
        List<RootCause> rootCauses = new ArrayList<>();
        
        try {
            // 获取系统指标数据
            SystemMetrics currentMetrics = metricsCollector.collect();
            SystemMetrics baselineMetrics = getBaselineMetrics();
            
            // 分析CPU使用率
            analyzeCpuUsage(currentMetrics, baselineMetrics, rootCauses);
            
            // 分析内存使用率
            analyzeMemoryUsage(currentMetrics, baselineMetrics, rootCauses);
            
            // 分析GC情况
            analyzeGcMetrics(currentMetrics, baselineMetrics, rootCauses);
            
            // 分析线程池状态
            analyzeThreadPoolMetrics(currentMetrics, baselineMetrics, rootCauses);
            
        } catch (Exception e) {
            log.error("Failed to analyze system metrics for rate limit event: " + event, e);
        }
        
        return rootCauses;
    }
    
    private void analyzeCpuUsage(SystemMetrics current, SystemMetrics baseline, 
                               List<RootCause> rootCauses) {
        double currentCpu = current.getCpuUsage();
        double baselineCpu = baseline.getCpuUsage();
        double cpuVariance = currentCpu - baselineCpu;
        
        // 如果CPU使用率显著高于基线值
        if (cpuVariance > 20.0) { // 超过20%的差异
            RootCause cause = RootCause.builder()
                .type(RootCauseType.SYSTEM_PERFORMANCE)
                .category("CPU Usage")
                .description(String.format("CPU usage increased by %.2f%% from baseline", cpuVariance))
                .confidence(calculateConfidence(cpuVariance, 20.0))
                .severity(calculateSeverity(cpuVariance, 30.0))
                .details(Map.of(
                    "current_cpu", String.valueOf(currentCpu),
                    "baseline_cpu", String.valueOf(baselineCpu),
                    "difference", String.valueOf(cpuVariance)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeMemoryUsage(SystemMetrics current, SystemMetrics baseline, 
                                  List<RootCause> rootCauses) {
        double currentMemory = current.getMemoryUsage();
        double baselineMemory = baseline.getMemoryUsage();
        double memoryVariance = currentMemory - baselineMemory;
        
        // 如果内存使用率显著高于基线值
        if (memoryVariance > 15.0) { // 超过15%的差异
            RootCause cause = RootCause.builder()
                .type(RootCauseType.SYSTEM_PERFORMANCE)
                .category("Memory Usage")
                .description(String.format("Memory usage increased by %.2f%% from baseline", memoryVariance))
                .confidence(calculateConfidence(memoryVariance, 15.0))
                .severity(calculateSeverity(memoryVariance, 25.0))
                .details(Map.of(
                    "current_memory", String.valueOf(currentMemory),
                    "baseline_memory", String.valueOf(baselineMemory),
                    "difference", String.valueOf(memoryVariance)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeGcMetrics(SystemMetrics current, SystemMetrics baseline, 
                                List<RootCause> rootCauses) {
        long currentGcCount = current.getGcCount();
        long baselineGcCount = baseline.getGcCount();
        long gcCountDiff = currentGcCount - baselineGcCount;
        
        long currentGcTime = current.getGcTime();
        long baselineGcTime = baseline.getGcTime();
        long gcTimeDiff = currentGcTime - baselineGcTime;
        
        // 如果GC频率或时间显著增加
        if (gcCountDiff > 10 || gcTimeDiff > 5000) { // 10次GC或5秒GC时间增加
            RootCause cause = RootCause.builder()
                .type(RootCauseType.SYSTEM_PERFORMANCE)
                .category("Garbage Collection")
                .description("Frequent or long GC pauses detected")
                .confidence(calculateGcConfidence(gcCountDiff, gcTimeDiff))
                .severity(calculateGcSeverity(gcCountDiff, gcTimeDiff))
                .details(Map.of(
                    "current_gc_count", String.valueOf(currentGcCount),
                    "baseline_gc_count", String.valueOf(baselineGcCount),
                    "current_gc_time", String.valueOf(currentGcTime),
                    "baseline_gc_time", String.valueOf(baselineGcTime)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeThreadPoolMetrics(SystemMetrics current, SystemMetrics baseline, 
                                        List<RootCause> rootCauses) {
        double currentPoolUsage = current.getThreadPoolUsage();
        double baselinePoolUsage = baseline.getThreadPoolUsage();
        double poolUsageDiff = currentPoolUsage - baselinePoolUsage;
        
        // 如果线程池使用率过高
        if (currentPoolUsage > 90.0) {
            RootCause cause = RootCause.builder()
                .type(RootCauseType.SYSTEM_PERFORMANCE)
                .category("Thread Pool")
                .description(String.format("Thread pool usage is extremely high: %.2f%%", currentPoolUsage))
                .confidence(0.9)
                .severity(RootCauseSeverity.CRITICAL)
                .details(Map.of(
                    "current_pool_usage", String.valueOf(currentPoolUsage),
                    "baseline_pool_usage", String.valueOf(baselinePoolUsage)
                ))
                .build();
                
            rootCauses.add(cause);
        } else if (poolUsageDiff > 20.0) { // 使用率显著增加
            RootCause cause = RootCause.builder()
                .type(RootCauseType.SYSTEM_PERFORMANCE)
                .category("Thread Pool")
                .description(String.format("Thread pool usage increased by %.2f%% from baseline", poolUsageDiff))
                .confidence(calculateConfidence(poolUsageDiff, 20.0))
                .severity(calculateSeverity(poolUsageDiff, 30.0))
                .details(Map.of(
                    "current_pool_usage", String.valueOf(currentPoolUsage),
                    "baseline_pool_usage", String.valueOf(baselinePoolUsage),
                    "difference", String.valueOf(poolUsageDiff)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private double calculateConfidence(double variance, double threshold) {
        // 置信度随着差异的增加而增加
        double ratio = Math.abs(variance) / threshold;
        return Math.min(0.95, 0.5 + ratio * 0.1);
    }
    
    private RootCauseSeverity calculateSeverity(double variance, double criticalThreshold) {
        double ratio = Math.abs(variance) / criticalThreshold;
        if (ratio > 1.5) {
            return RootCauseSeverity.CRITICAL;
        } else if (ratio > 1.0) {
            return RootCauseSeverity.HIGH;
        } else if (ratio > 0.5) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateGcConfidence(long gcCountDiff, long gcTimeDiff) {
        double countConfidence = Math.min(0.9, Math.abs(gcCountDiff) / 20.0);
        double timeConfidence = Math.min(0.9, Math.abs(gcTimeDiff) / 10000.0);
        return Math.max(countConfidence, timeConfidence);
    }
    
    private RootCauseSeverity calculateGcSeverity(long gcCountDiff, long gcTimeDiff) {
        double countSeverity = Math.abs(gcCountDiff) / 30.0;
        double timeSeverity = Math.abs(gcTimeDiff) / 15000.0;
        double maxSeverity = Math.max(countSeverity, timeSeverity);
        
        if (maxSeverity > 1.5) {
            return RootCauseSeverity.CRITICAL;
        } else if (maxSeverity > 1.0) {
            return RootCauseSeverity.HIGH;
        } else if (maxSeverity > 0.5) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private SystemMetrics getBaselineMetrics() {
        try {
            // 从Redis获取基线指标数据
            String key = "system_metrics:baseline";
            String json = redisTemplate.opsForValue().get(key);
            
            if (json != null && !json.isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                return mapper.readValue(json, SystemMetrics.class);
            }
        } catch (Exception e) {
            log.warn("Failed to get baseline metrics", e);
        }
        
        // 返回默认基线值
        return SystemMetrics.builder()
            .cpuUsage(30.0)
            .memoryUsage(45.0)
            .gcCount(100)
            .gcTime(5000)
            .threadPoolUsage(60.0)
            .build();
    }
}
```

### 业务指标分析器

```java
// 业务指标根因分析器
@Component
public class BusinessMetricsRootCauseAnalyzer {
    private final RedisTemplate<String, String> redisTemplate;
    private final BusinessMetricsCollector metricsCollector;
    
    public BusinessMetricsRootCauseAnalyzer(RedisTemplate<String, String> redisTemplate,
                                          BusinessMetricsCollector metricsCollector) {
        this.redisTemplate = redisTemplate;
        this.metricsCollector = metricsCollector;
    }
    
    public List<RootCause> analyze(RateLimitEvent event) {
        List<RootCause> rootCauses = new ArrayList<>();
        
        try {
            // 分析限流资源的业务指标
            analyzeResourceMetrics(event, rootCauses);
            
            // 分析用户行为模式
            analyzeUserBehavior(event, rootCauses);
            
            // 分析业务趋势
            analyzeBusinessTrends(event, rootCauses);
            
        } catch (Exception e) {
            log.error("Failed to analyze business metrics for rate limit event: " + event, e);
        }
        
        return rootCauses;
    }
    
    private void analyzeResourceMetrics(RateLimitEvent event, List<RootCause> rootCauses) {
        String resource = event.getResource();
        
        try {
            // 获取资源的业务指标
            ResourceMetrics currentMetrics = metricsCollector.getResourceMetrics(resource);
            ResourceMetrics baselineMetrics = getBaselineResourceMetrics(resource);
            
            // 分析请求量变化
            analyzeRequestVolume(currentMetrics, baselineMetrics, resource, rootCauses);
            
            // 分析错误率变化
            analyzeErrorRate(currentMetrics, baselineMetrics, resource, rootCauses);
            
            // 分析响应时间变化
            analyzeResponseTime(currentMetrics, baselineMetrics, resource, rootCauses);
            
        } catch (Exception e) {
            log.warn("Failed to analyze resource metrics for resource: " + resource, e);
        }
    }
    
    private void analyzeRequestVolume(ResourceMetrics current, ResourceMetrics baseline, 
                                    String resource, List<RootCause> rootCauses) {
        long currentRequests = current.getRequestCount();
        long baselineRequests = baseline.getRequestCount();
        
        if (baselineRequests > 0) {
            double volumeIncrease = (double) (currentRequests - baselineRequests) / baselineRequests * 100;
            
            // 如果请求量显著增加
            if (volumeIncrease > 50.0) { // 增加超过50%
                RootCause cause = RootCause.builder()
                    .type(RootCauseType.BUSINESS_TRAFFIC)
                    .category("Request Volume")
                    .description(String.format("Request volume for %s increased by %.2f%%", resource, volumeIncrease))
                    .confidence(calculateVolumeConfidence(volumeIncrease))
                    .severity(calculateVolumeSeverity(volumeIncrease))
                    .details(Map.of(
                        "resource", resource,
                        "current_requests", String.valueOf(currentRequests),
                        "baseline_requests", String.valueOf(baselineRequests),
                        "increase_percentage", String.format("%.2f%%", volumeIncrease)
                    ))
                    .build();
                    
                rootCauses.add(cause);
            }
        }
    }
    
    private void analyzeErrorRate(ResourceMetrics current, ResourceMetrics baseline, 
                                String resource, List<RootCause> rootCauses) {
        double currentErrorRate = current.getErrorRate();
        double baselineErrorRate = baseline.getErrorRate();
        double errorRateIncrease = currentErrorRate - baselineErrorRate;
        
        // 如果错误率显著增加
        if (errorRateIncrease > 5.0) { // 增加超过5%
            RootCause cause = RootCause.builder()
                .type(RootCauseType.BUSINESS_PERFORMANCE)
                .category("Error Rate")
                .description(String.format("Error rate for %s increased by %.2f%%", resource, errorRateIncrease))
                .confidence(calculateErrorRateConfidence(errorRateIncrease))
                .severity(calculateErrorRateSeverity(errorRateIncrease))
                .details(Map.of(
                    "resource", resource,
                    "current_error_rate", String.format("%.2f%%", currentErrorRate),
                    "baseline_error_rate", String.format("%.2f%%", baselineErrorRate),
                    "increase", String.format("%.2f%%", errorRateIncrease)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeResponseTime(ResourceMetrics current, ResourceMetrics baseline, 
                                   String resource, List<RootCause> rootCauses) {
        double currentResponseTime = current.getAverageResponseTime();
        double baselineResponseTime = baseline.getAverageResponseTime();
        double responseTimeIncrease = currentResponseTime - baselineResponseTime;
        
        // 如果响应时间显著增加
        if (responseTimeIncrease > 100.0) { // 增加超过100ms
            RootCause cause = RootCause.builder()
                .type(RootCauseType.BUSINESS_PERFORMANCE)
                .category("Response Time")
                .description(String.format("Response time for %s increased by %.2fms", resource, responseTimeIncrease))
                .confidence(calculateResponseTimeConfidence(responseTimeIncrease))
                .severity(calculateResponseTimeSeverity(responseTimeIncrease))
                .details(Map.of(
                    "resource", resource,
                    "current_response_time", String.format("%.2fms", currentResponseTime),
                    "baseline_response_time", String.format("%.2fms", baselineResponseTime),
                    "increase", String.format("%.2fms", responseTimeIncrease)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeUserBehavior(RateLimitEvent event, List<RootCause> rootCauses) {
        try {
            String resource = event.getResource();
            Map<String, String> dimensions = event.getDimensions();
            
            // 分析用户类型分布
            analyzeUserTypeDistribution(resource, dimensions, rootCauses);
            
            // 分析地理位置分布
            analyzeGeoDistribution(resource, dimensions, rootCauses);
            
        } catch (Exception e) {
            log.warn("Failed to analyze user behavior", e);
        }
    }
    
    private void analyzeUserTypeDistribution(String resource, Map<String, String> dimensions, 
                                           List<RootCause> rootCauses) {
        try {
            // 获取用户类型分布数据
            Map<String, Long> currentUserTypeDistribution = 
                metricsCollector.getUserTypeDistribution(resource);
            Map<String, Long> baselineUserTypeDistribution = 
                getBaselineUserTypeDistribution(resource);
            
            // 比较分布变化
            for (Map.Entry<String, Long> entry : currentUserTypeDistribution.entrySet()) {
                String userType = entry.getKey();
                Long currentCount = entry.getValue();
                Long baselineCount = baselineUserTypeDistribution.getOrDefault(userType, 0L);
                
                if (baselineCount > 0) {
                    double increase = (double) (currentCount - baselineCount) / baselineCount * 100;
                    
                    // 如果某种用户类型的请求量显著增加
                    if (increase > 100.0) { // 增加超过100%
                        RootCause cause = RootCause.builder()
                            .type(RootCauseType.USER_BEHAVIOR)
                            .category("User Type Distribution")
                            .description(String.format("Requests from %s users increased by %.2f%%", userType, increase))
                            .confidence(calculateDistributionConfidence(increase))
                            .severity(calculateDistributionSeverity(increase))
                            .details(Map.of(
                                "user_type", userType,
                                "current_count", String.valueOf(currentCount),
                                "baseline_count", String.valueOf(baselineCount),
                                "increase_percentage", String.format("%.2f%%", increase)
                            ))
                            .build();
                            
                        rootCauses.add(cause);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to analyze user type distribution", e);
        }
    }
    
    private void analyzeGeoDistribution(String resource, Map<String, String> dimensions, 
                                      List<RootCause> rootCauses) {
        try {
            // 检查是否包含地理位置维度
            if (dimensions.containsKey("geo")) {
                String geo = dimensions.get("geo");
                
                // 获取该地理位置的历史请求数据
                long currentGeoRequests = metricsCollector.getGeoRequests(resource, geo);
                long baselineGeoRequests = getBaselineGeoRequests(resource, geo);
                
                if (baselineGeoRequests > 0) {
                    double increase = (double) (currentGeoRequests - baselineGeoRequests) / baselineGeoRequests * 100;
                    
                    // 如果某个地理位置的请求量显著增加
                    if (increase > 200.0) { // 增加超过200%
                        RootCause cause = RootCause.builder()
                            .type(RootCauseType.USER_BEHAVIOR)
                            .category("Geographic Distribution")
                            .description(String.format("Requests from %s increased by %.2f%%", geo, increase))
                            .confidence(calculateGeoConfidence(increase))
                            .severity(calculateGeoSeverity(increase))
                            .details(Map.of(
                                "geo", geo,
                                "current_requests", String.valueOf(currentGeoRequests),
                                "baseline_requests", String.valueOf(baselineGeoRequests),
                                "increase_percentage", String.format("%.2f%%", increase)
                            ))
                            .build();
                            
                        rootCauses.add(cause);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to analyze geographic distribution", e);
        }
    }
    
    private void analyzeBusinessTrends(RateLimitEvent event, List<RootCause> rootCauses) {
        try {
            String resource = event.getResource();
            
            // 分析时间趋势
            analyzeTimeTrends(resource, rootCauses);
            
            // 分析周期性模式
            analyzePeriodicPatterns(resource, rootCauses);
            
        } catch (Exception e) {
            log.warn("Failed to analyze business trends", e);
        }
    }
    
    private void analyzeTimeTrends(String resource, List<RootCause> rootCauses) {
        try {
            // 获取最近的请求趋势数据
            List<TimeSeriesData> recentTrend = metricsCollector.getRequestTrend(resource, 60); // 最近60分钟
            List<TimeSeriesData> baselineTrend = getBaselineRequestTrend(resource, 60);
            
            // 检查是否存在明显的上升趋势
            double recentAverage = recentTrend.stream()
                .mapToDouble(TimeSeriesData::getValue)
                .average()
                .orElse(0);
                
            double baselineAverage = baselineTrend.stream()
                .mapToDouble(TimeSeriesData::getValue)
                .average()
                .orElse(0);
                
            if (baselineAverage > 0) {
                double trendIncrease = (recentAverage - baselineAverage) / baselineAverage * 100;
                
                if (trendIncrease > 30.0) { // 趋势增加超过30%
                    RootCause cause = RootCause.builder()
                        .type(RootCauseType.BUSINESS_TREND)
                        .category("Traffic Trend")
                        .description(String.format("Overall traffic trend for %s increased by %.2f%%", resource, trendIncrease))
                        .confidence(calculateTrendConfidence(trendIncrease))
                        .severity(calculateTrendSeverity(trendIncrease))
                        .details(Map.of(
                            "resource", resource,
                            "recent_average", String.format("%.2f", recentAverage),
                            "baseline_average", String.format("%.2f", baselineAverage),
                            "increase_percentage", String.format("%.2f%%", trendIncrease)
                        ))
                        .build();
                        
                    rootCauses.add(cause);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to analyze time trends", e);
        }
    }
    
    private double calculateVolumeConfidence(double increase) {
        return Math.min(0.95, 0.3 + increase / 200.0);
    }
    
    private RootCauseSeverity calculateVolumeSeverity(double increase) {
        if (increase > 200.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 100.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 50.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateErrorRateConfidence(double increase) {
        return Math.min(0.95, 0.4 + increase / 20.0);
    }
    
    private RootCauseSeverity calculateErrorRateSeverity(double increase) {
        if (increase > 15.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 10.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 5.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateResponseTimeConfidence(double increase) {
        return Math.min(0.95, 0.3 + increase / 500.0);
    }
    
    private RootCauseSeverity calculateResponseTimeSeverity(double increase) {
        if (increase > 500.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 300.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 100.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateDistributionConfidence(double increase) {
        return Math.min(0.95, 0.2 + increase / 300.0);
    }
    
    private RootCauseSeverity calculateDistributionSeverity(double increase) {
        if (increase > 300.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 200.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 100.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateGeoConfidence(double increase) {
        return Math.min(0.95, 0.3 + increase / 400.0);
    }
    
    private RootCauseSeverity calculateGeoSeverity(double increase) {
        if (increase > 400.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 300.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 200.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateTrendConfidence(double increase) {
        return Math.min(0.95, 0.2 + increase / 100.0);
    }
    
    private RootCauseSeverity calculateTrendSeverity(double increase) {
        if (increase > 100.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 60.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 30.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private ResourceMetrics getBaselineResourceMetrics(String resource) {
        try {
            String key = "business_metrics:baseline:" + resource;
            String json = redisTemplate.opsForValue().get(key);
            
            if (json != null && !json.isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                return mapper.readValue(json, ResourceMetrics.class);
            }
        } catch (Exception e) {
            log.warn("Failed to get baseline resource metrics for: " + resource, e);
        }
        
        return ResourceMetrics.builder()
            .requestCount(1000)
            .errorRate(1.0)
            .averageResponseTime(50.0)
            .build();
    }
    
    private Map<String, Long> getBaselineUserTypeDistribution(String resource) {
        try {
            String key = "business_metrics:baseline:user_type:" + resource;
            String json = redisTemplate.opsForValue().get(key);
            
            if (json != null && !json.isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                JavaType type = mapper.getTypeFactory()
                    .constructMapType(Map.class, String.class, Long.class);
                return mapper.readValue(json, type);
            }
        } catch (Exception e) {
            log.warn("Failed to get baseline user type distribution for: " + resource, e);
        }
        
        Map<String, Long> defaultDistribution = new HashMap<>();
        defaultDistribution.put("normal", 800L);
        defaultDistribution.put("vip", 150L);
        defaultDistribution.put("guest", 50L);
        return defaultDistribution;
    }
    
    private long getBaselineGeoRequests(String resource, String geo) {
        try {
            String key = "business_metrics:baseline:geo:" + resource + ":" + geo;
            String value = redisTemplate.opsForValue().get(key);
            
            if (value != null && !value.isEmpty()) {
                return Long.parseLong(value);
            }
        } catch (Exception e) {
            log.warn("Failed to get baseline geo requests for: " + resource + ", " + geo, e);
        }
        
        return 100L; // 默认值
    }
    
    private List<TimeSeriesData> getBaselineRequestTrend(String resource, int minutes) {
        List<TimeSeriesData> trend = new ArrayList<>();
        long currentTime = System.currentTimeMillis();
        
        // 生成默认的基线趋势数据
        for (int i = minutes - 1; i >= 0; i--) {
            long timestamp = currentTime - i * 60000L; // 每分钟一个点
            double value = 1000.0 + Math.random() * 200.0; // 1000 ± 200的随机值
            trend.add(new TimeSeriesData(timestamp, value));
        }
        
        return trend;
    }
}
```

### 依赖服务分析器

```java
// 依赖服务根因分析器
@Component
public class DependencyRootCauseAnalyzer {
    private final RedisTemplate<String, String> redisTemplate;
    private final DependencyMetricsCollector metricsCollector;
    
    public DependencyRootCauseAnalyzer(RedisTemplate<String, String> redisTemplate,
                                     DependencyMetricsCollector metricsCollector) {
        this.redisTemplate = redisTemplate;
        this.metricsCollector = metricsCollector;
    }
    
    public List<RootCause> analyze(RateLimitEvent event) {
        List<RootCause> rootCauses = new ArrayList<>();
        
        try {
            // 分析直接依赖服务
            analyzeDirectDependencies(event, rootCauses);
            
            // 分析间接依赖服务
            analyzeIndirectDependencies(event, rootCauses);
            
        } catch (Exception e) {
            log.error("Failed to analyze dependencies for rate limit event: " + event, e);
        }
        
        return rootCauses;
    }
    
    private void analyzeDirectDependencies(RateLimitEvent event, List<RootCause> rootCauses) {
        try {
            String resource = event.getResource();
            
            // 获取该资源依赖的服务列表
            List<String> dependentServices = getDependentServices(resource);
            
            for (String service : dependentServices) {
                // 分析服务健康状态
                analyzeServiceHealth(service, rootCauses);
                
                // 分析服务性能指标
                analyzeServicePerformance(service, rootCauses);
                
                // 分析服务调用链路
                analyzeServiceCallChain(service, resource, rootCauses);
            }
        } catch (Exception e) {
            log.warn("Failed to analyze direct dependencies", e);
        }
    }
    
    private void analyzeIndirectDependencies(RateLimitEvent event, List<RootCause> rootCauses) {
        try {
            String resource = event.getResource();
            
            // 获取间接依赖服务
            List<String> indirectDependencies = getIndirectDependencies(resource);
            
            for (String service : indirectDependencies) {
                // 分析间接依赖的健康状态
                analyzeServiceHealth(service, rootCauses);
            }
        } catch (Exception e) {
            log.warn("Failed to analyze indirect dependencies", e);
        }
    }
    
    private void analyzeServiceHealth(String service, List<RootCause> rootCauses) {
        try {
            // 获取服务健康状态
            ServiceHealth health = metricsCollector.getServiceHealth(service);
            
            // 检查服务是否不健康
            if (!health.isHealthy()) {
                RootCause cause = RootCause.builder()
                    .type(RootCauseType.DEPENDENCY_FAILURE)
                    .category("Service Health")
                    .description(String.format("Dependency service %s is unhealthy", service))
                    .confidence(0.9)
                    .severity(RootCauseSeverity.HIGH)
                    .details(Map.of(
                        "service", service,
                        "status", health.getStatus(),
                        "message", health.getMessage()
                    ))
                    .build();
                    
                rootCauses.add(cause);
            }
        } catch (Exception e) {
            log.warn("Failed to analyze service health for: " + service, e);
        }
    }
    
    private void analyzeServicePerformance(String service, List<RootCause> rootCauses) {
        try {
            // 获取服务性能指标
            ServiceMetrics currentMetrics = metricsCollector.getServiceMetrics(service);
            ServiceMetrics baselineMetrics = getBaselineServiceMetrics(service);
            
            // 分析响应时间
            analyzeServiceResponseTime(currentMetrics, baselineMetrics, service, rootCauses);
            
            // 分析错误率
            analyzeServiceErrorRate(currentMetrics, baselineMetrics, service, rootCauses);
            
            // 分析吞吐量
            analyzeServiceThroughput(currentMetrics, baselineMetrics, service, rootCauses);
        } catch (Exception e) {
            log.warn("Failed to analyze service performance for: " + service, e);
        }
    }
    
    private void analyzeServiceResponseTime(ServiceMetrics current, ServiceMetrics baseline, 
                                         String service, List<RootCause> rootCauses) {
        double currentResponseTime = current.getAverageResponseTime();
        double baselineResponseTime = baseline.getAverageResponseTime();
        double responseTimeIncrease = currentResponseTime - baselineResponseTime;
        
        // 如果响应时间显著增加
        if (responseTimeIncrease > 200.0) { // 增加超过200ms
            double increasePercentage = (responseTimeIncrease / baselineResponseTime) * 100;
            
            RootCause cause = RootCause.builder()
                .type(RootCauseType.DEPENDENCY_PERFORMANCE)
                .category("Service Response Time")
                .description(String.format("Dependency service %s response time increased by %.2fms (%.2f%%)", 
                    service, responseTimeIncrease, increasePercentage))
                .confidence(calculateResponseTimeConfidence(responseTimeIncrease, baselineResponseTime))
                .severity(calculateResponseTimeSeverity(responseTimeIncrease))
                .details(Map.of(
                    "service", service,
                    "current_response_time", String.format("%.2fms", currentResponseTime),
                    "baseline_response_time", String.format("%.2fms", baselineResponseTime),
                    "increase", String.format("%.2fms", responseTimeIncrease),
                    "increase_percentage", String.format("%.2f%%", increasePercentage)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeServiceErrorRate(ServiceMetrics current, ServiceMetrics baseline, 
                                       String service, List<RootCause> rootCauses) {
        double currentErrorRate = current.getErrorRate();
        double baselineErrorRate = baseline.getErrorRate();
        double errorRateIncrease = currentErrorRate - baselineErrorRate;
        
        // 如果错误率显著增加
        if (errorRateIncrease > 3.0) { // 增加超过3%
            RootCause cause = RootCause.builder()
                .type(RootCauseType.DEPENDENCY_PERFORMANCE)
                .category("Service Error Rate")
                .description(String.format("Dependency service %s error rate increased by %.2f%%", 
                    service, errorRateIncrease))
                .confidence(calculateErrorRateConfidence(errorRateIncrease))
                .severity(calculateErrorRateSeverity(errorRateIncrease))
                .details(Map.of(
                    "service", service,
                    "current_error_rate", String.format("%.2f%%", currentErrorRate),
                    "baseline_error_rate", String.format("%.2f%%", baselineErrorRate),
                    "increase", String.format("%.2f%%", errorRateIncrease)
                ))
                .build();
                
            rootCauses.add(cause);
        }
    }
    
    private void analyzeServiceThroughput(ServiceMetrics current, ServiceMetrics baseline, 
                                        String service, List<RootCause> rootCauses) {
        double currentThroughput = current.getThroughput();
        double baselineThroughput = baseline.getThroughput();
        
        if (baselineThroughput > 0) {
            double throughputDecrease = baselineThroughput - currentThroughput;
            double decreasePercentage = (throughputDecrease / baselineThroughput) * 100;
            
            // 如果吞吐量显著下降
            if (decreasePercentage > 20.0) { // 下降超过20%
                RootCause cause = RootCause.builder()
                    .type(RootCauseType.DEPENDENCY_PERFORMANCE)
                    .category("Service Throughput")
                    .description(String.format("Dependency service %s throughput decreased by %.2f%%", 
                        service, decreasePercentage))
                    .confidence(calculateThroughputConfidence(decreasePercentage))
                    .severity(calculateThroughputSeverity(decreasePercentage))
                    .details(Map.of(
                        "service", service,
                        "current_throughput", String.format("%.2f", currentThroughput),
                        "baseline_throughput", String.format("%.2f", baselineThroughput),
                        "decrease_percentage", String.format("%.2f%%", decreasePercentage)
                    ))
                    .build();
                    
                rootCauses.add(cause);
            }
        }
    }
    
    private void analyzeServiceCallChain(String service, String resource, List<RootCause> rootCauses) {
        try {
            // 分析调用链路中的异常
            List<CallChainSpan> spans = metricsCollector.getCallChainSpans(resource, service);
            
            // 检查是否存在异常的调用模式
            for (CallChainSpan span : spans) {
                if (span.getDuration() > 5000) { // 调用超过5秒
                    RootCause cause = RootCause.builder()
                        .type(RootCauseType.DEPENDENCY_PERFORMANCE)
                        .category("Call Chain Analysis")
                        .description(String.format("Slow call to service %s detected in call chain", service))
                        .confidence(0.8)
                        .severity(RootCauseSeverity.MEDIUM)
                        .details(Map.of(
                            "service", service,
                            "resource", resource,
                            "duration", String.valueOf(span.getDuration()),
                            "trace_id", span.getTraceId()
                        ))
                        .build();
                        
                    rootCauses.add(cause);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to analyze service call chain for: " + service, e);
        }
    }
    
    private double calculateResponseTimeConfidence(double increase, double baseline) {
        if (baseline <= 0) return 0.5;
        double ratio = increase / baseline;
        return Math.min(0.95, 0.4 + ratio * 0.2);
    }
    
    private RootCauseSeverity calculateResponseTimeSeverity(double increase) {
        if (increase > 1000.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 500.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 200.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateErrorRateConfidence(double increase) {
        return Math.min(0.95, 0.3 + increase / 10.0);
    }
    
    private RootCauseSeverity calculateErrorRateSeverity(double increase) {
        if (increase > 10.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (increase > 6.0) {
            return RootCauseSeverity.HIGH;
        } else if (increase > 3.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private double calculateThroughputConfidence(double decreasePercentage) {
        return Math.min(0.95, 0.2 + decreasePercentage / 50.0);
    }
    
    private RootCauseSeverity calculateThroughputSeverity(double decreasePercentage) {
        if (decreasePercentage > 50.0) {
            return RootCauseSeverity.CRITICAL;
        } else if (decreasePercentage > 35.0) {
            return RootCauseSeverity.HIGH;
        } else if (decreasePercentage > 20.0) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private List<String> getDependentServices(String resource) {
        try {
            String key = "dependencies:direct:" + resource;
            return redisTemplate.opsForList().range(key, 0, -1);
        } catch (Exception e) {
            log.warn("Failed to get dependent services for: " + resource, e);
            return new ArrayList<>();
        }
    }
    
    private List<String> getIndirectDependencies(String resource) {
        try {
            String key = "dependencies:indirect:" + resource;
            return redisTemplate.opsForList().range(key, 0, -1);
        } catch (Exception e) {
            log.warn("Failed to get indirect dependencies for: " + resource, e);
            return new ArrayList<>();
        }
    }
    
    private ServiceMetrics getBaselineServiceMetrics(String service) {
        try {
            String key = "service_metrics:baseline:" + service;
            String json = redisTemplate.opsForValue().get(key);
            
            if (json != null && !json.isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                return mapper.readValue(json, ServiceMetrics.class);
            }
        } catch (Exception e) {
            log.warn("Failed to get baseline service metrics for: " + service, e);
        }
        
        return ServiceMetrics.builder()
            .averageResponseTime(100.0)
            .errorRate(0.5)
            .throughput(1000.0)
            .build();
    }
}
```

## 综合根因分析器

### 多维度分析融合

```java
// 综合根因分析器
@Component
public class ComprehensiveRootCauseAnalyzer {
    private final SystemMetricsRootCauseAnalyzer systemAnalyzer;
    private final BusinessMetricsRootCauseAnalyzer businessAnalyzer;
    private final DependencyRootCauseAnalyzer dependencyAnalyzer;
    private final RedisTemplate<String, String> redisTemplate;
    
    public ComprehensiveRootCauseAnalyzer(SystemMetricsRootCauseAnalyzer systemAnalyzer,
                                        BusinessMetricsRootCauseAnalyzer businessAnalyzer,
                                        DependencyRootCauseAnalyzer dependencyAnalyzer,
                                        RedisTemplate<String, String> redisTemplate) {
        this.systemAnalyzer = systemAnalyzer;
        this.businessAnalyzer = businessAnalyzer;
        this.dependencyAnalyzer = dependencyAnalyzer;
        this.redisTemplate = redisTemplate;
    }
    
    public RootCauseAnalysisResult analyze(RateLimitEvent event) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. 并行执行各维度分析
            List<RootCause> systemRootCauses = systemAnalyzer.analyze(event);
            List<RootCause> businessRootCauses = businessAnalyzer.analyze(event);
            List<RootCause> dependencyRootCauses = dependencyAnalyzer.analyze(event);
            
            // 2. 合并所有根因
            List<RootCause> allRootCauses = new ArrayList<>();
            allRootCauses.addAll(systemRootCauses);
            allRootCauses.addAll(businessRootCauses);
            allRootCauses.addAll(dependencyRootCauses);
            
            // 3. 根因去重和合并
            List<RootCause> mergedRootCauses = mergeRootCauses(allRootCauses);
            
            // 4. 根因排序
            List<RootCause> sortedRootCauses = sortRootCauses(mergedRootCauses);
            
            // 5. 生成分析报告
            RootCauseAnalysisResult result = generateAnalysisResult(event, sortedRootCauses, startTime);
            
            // 6. 记录分析结果
            recordAnalysisResult(result);
            
            return result;
        } catch (Exception e) {
            log.error("Failed to perform comprehensive root cause analysis for event: " + event, e);
            
            // 返回默认分析结果
            return RootCauseAnalysisResult.builder()
                .eventId(event.getId())
                .timestamp(System.currentTimeMillis())
                .rootCauses(new ArrayList<>())
                .confidence(0.0)
                .processingTime(System.currentTimeMillis() - startTime)
                .status(AnalysisStatus.FAILED)
                .errorMessage(e.getMessage())
                .build();
        }
    }
    
    private List<RootCause> mergeRootCauses(List<RootCause> rootCauses) {
        Map<String, RootCause> mergedMap = new HashMap<>();
        
        for (RootCause cause : rootCauses) {
            String key = generateCauseKey(cause);
            
            if (mergedMap.containsKey(key)) {
                // 合并相同类型的根因
                RootCause existing = mergedMap.get(key);
                RootCause merged = mergeRootCause(existing, cause);
                mergedMap.put(key, merged);
            } else {
                mergedMap.put(key, cause);
            }
        }
        
        return new ArrayList<>(mergedMap.values());
    }
    
    private String generateCauseKey(RootCause cause) {
        return cause.getType().name() + ":" + cause.getCategory() + ":" + 
               cause.getDescription().hashCode();
    }
    
    private RootCause mergeRootCause(RootCause existing, RootCause newCause) {
        // 合并置信度（取最大值）
        double mergedConfidence = Math.max(existing.getConfidence(), newCause.getConfidence());
        
        // 合并严重程度（取较高值）
        RootCauseSeverity mergedSeverity = getHigherSeverity(existing.getSeverity(), newCause.getSeverity());
        
        // 合并详情信息
        Map<String, String> mergedDetails = new HashMap<>(existing.getDetails());
        mergedDetails.putAll(newCause.getDetails());
        
        return RootCause.builder()
            .type(existing.getType())
            .category(existing.getCategory())
            .description(existing.getDescription())
            .confidence(mergedConfidence)
            .severity(mergedSeverity)
            .details(mergedDetails)
            .build();
    }
    
    private RootCauseSeverity getHigherSeverity(RootCauseSeverity s1, RootCauseSeverity s2) {
        if (s1 == RootCauseSeverity.CRITICAL || s2 == RootCauseSeverity.CRITICAL) {
            return RootCauseSeverity.CRITICAL;
        } else if (s1 == RootCauseSeverity.HIGH || s2 == RootCauseSeverity.HIGH) {
            return RootCauseSeverity.HIGH;
        } else if (s1 == RootCauseSeverity.MEDIUM || s2 == RootCauseSeverity.MEDIUM) {
            return RootCauseSeverity.MEDIUM;
        } else {
            return RootCauseSeverity.LOW;
        }
    }
    
    private List<RootCause> sortRootCauses(List<RootCause> rootCauses) {
        return rootCauses.stream()
            .sorted((c1, c2) -> {
                // 首先按严重程度排序
                int severityComparison = c2.getSeverity().compareTo(c1.getSeverity());
                if (severityComparison != 0) {
                    return severityComparison;
                }
                
                // 然后按置信度排序
                return Double.compare(c2.getConfidence(), c1.getConfidence());
            })
            .collect(Collectors.toList());
    }
    
    private RootCauseAnalysisResult generateAnalysisResult(RateLimitEvent event, 
                                                         List<RootCause> rootCauses,
                                                         long startTime) {
        // 计算整体置信度
        double overallConfidence = calculateOverallConfidence(rootCauses);
        
        // 确定分析状态
        AnalysisStatus status = rootCauses.isEmpty() ? 
            AnalysisStatus.NO_ROOT_CAUSE_FOUND : AnalysisStatus.SUCCESS;
        
        return RootCauseAnalysisResult.builder()
            .eventId(event.getId())
            .timestamp(System.currentTimeMillis())
            .rootCauses(rootCauses)
            .confidence(overallConfidence)
            .processingTime(System.currentTimeMillis() - startTime)
            .status(status)
            .build();
    }
    
    private double calculateOverallConfidence(List<RootCause> rootCauses) {
        if (rootCauses.isEmpty()) {
            return 0.0;
        }
        
        // 计算加权平均置信度
        double totalWeightedConfidence = 0.0;
        double totalWeight = 0.0;
        
        for (RootCause cause : rootCauses) {
            double weight = getSeverityWeight(cause.getSeverity());
            totalWeightedConfidence += cause.getConfidence() * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? totalWeightedConfidence / totalWeight : 0.0;
    }
    
    private double getSeverityWeight(RootCauseSeverity severity) {
        switch (severity) {
            case CRITICAL: return 4.0;
            case HIGH: return 3.0;
            case MEDIUM: return 2.0;
            case LOW: return 1.0;
            default: return 1.0;
        }
    }
    
    private void recordAnalysisResult(RootCauseAnalysisResult result) {
        try {
            String key = "root_cause_analysis:result:" + result.getEventId();
            String value = serializeResult(result);
            
            // 保存分析结果
            redisTemplate.opsForValue().set(key, value, Duration.ofHours(24));
            
            // 记录到历史分析记录中
            String historyKey = "root_cause_analysis:history";
            redisTemplate.opsForList().leftPush(historyKey, value);
            redisTemplate.opsForList().trim(historyKey, 0, 999); // 保留最近1000条记录
        } catch (Exception e) {
            log.warn("Failed to record analysis result", e);
        }
    }
    
    private String serializeResult(RootCauseAnalysisResult result) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("Failed to serialize analysis result", e);
            return "";
        }
    }
}
```

## 根因分析结果处理

### 自动化处理机制

```java
// 根因分析结果处理器
@Component
public class RootCauseAnalysisResultProcessor {
    private final NotificationService notificationService;
    private final IncidentManagementService incidentService;
    private final ConfigurationService configurationService;
    private final RedisTemplate<String, String> redisTemplate;
    
    public RootCauseAnalysisResultProcessor(NotificationService notificationService,
                                          IncidentManagementService incidentService,
                                          ConfigurationService configurationService,
                                          RedisTemplate<String, String> redisTemplate) {
        this.notificationService = notificationService;
        this.incidentService = incidentService;
        this.configurationService = configurationService;
        this.redisTemplate = redisTemplate;
    }
    
    public void processAnalysisResult(RootCauseAnalysisResult result) {
        try {
            // 1. 发送通知
            sendNotifications(result);
            
            // 2. 创建或更新事件单
            createOrUpdateIncident(result);
            
            // 3. 自动调整配置（如果适用）
            autoAdjustConfiguration(result);
            
            // 4. 记录处理历史
            recordProcessingHistory(result);
            
        } catch (Exception e) {
            log.error("Failed to process root cause analysis result: " + result, e);
        }
    }
    
    private void sendNotifications(RootCauseAnalysisResult result) {
        try {
            if (result.getStatus() == AnalysisStatus.SUCCESS && !result.getRootCauses().isEmpty()) {
                // 获取高严重程度的根因
                List<RootCause> highSeverityCauses = result.getRootCauses().stream()
                    .filter(cause -> cause.getSeverity() == RootCauseSeverity.CRITICAL || 
                                   cause.getSeverity() == RootCauseSeverity.HIGH)
                    .collect(Collectors.toList());
                
                if (!highSeverityCauses.isEmpty()) {
                    // 发送紧急通知
                    Notification notification = Notification.builder()
                        .type(NotificationType.URGENT)
                        .title("High Severity Root Cause Detected")
                        .content(generateNotificationContent(result, highSeverityCauses))
                        .recipients(getNotificationRecipients())
                        .timestamp(System.currentTimeMillis())
                        .build();
                    
                    notificationService.sendNotification(notification);
                }
                
                // 发送常规通知给相关人员
                Notification regularNotification = Notification.builder()
                    .type(NotificationType.REGULAR)
                    .title("Root Cause Analysis Completed")
                    .content(generateRegularNotificationContent(result))
                    .recipients(getRegularNotificationRecipients())
                    .timestamp(System.currentTimeMillis())
                    .build();
                
                notificationService.sendNotification(regularNotification);
            }
        } catch (Exception e) {
            log.warn("Failed to send notifications for analysis result: " + result, e);
        }
    }
    
    private void createOrUpdateIncident(RootCauseAnalysisResult result) {
        try {
            if (result.getStatus() == AnalysisStatus.SUCCESS && !result.getRootCauses().isEmpty()) {
                // 检查是否已存在相关事件单
                String existingIncidentId = findExistingIncident(result);
                
                if (existingIncidentId != null) {
                    // 更新现有事件单
                    incidentService.updateIncident(existingIncidentId, result);
                } else {
                    // 创建新事件单
                    Incident incident = Incident.builder()
                        .id(UUID.randomUUID().toString())
                        .title("Rate Limit Root Cause Analysis")
                        .description(generateIncidentDescription(result))
                        .severity(calculateIncidentSeverity(result))
                        .status(IncidentStatus.OPEN)
                        .rootCauseAnalysis(result)
                        .createdAt(System.currentTimeMillis())
                        .build();
                    
                    incidentService.createIncident(incident);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to create or update incident for analysis result: " + result, e);
        }
    }
    
    private void autoAdjustConfiguration(RootCauseAnalysisResult result) {
        try {
            if (result.getConfidence() > 0.8) { // 高置信度才进行自动调整
                for (RootCause cause : result.getRootCauses()) {
                    if (cause.getSeverity() == RootCauseSeverity.CRITICAL) {
                        // 根据根因类型自动调整配置
                        switch (cause.getType()) {
                            case SYSTEM_PERFORMANCE:
                                adjustSystemConfiguration(cause);
                                break;
                            case BUSINESS_TRAFFIC:
                                adjustRateLimitConfiguration(cause);
                                break;
                            case DEPENDENCY_FAILURE:
                                adjustDependencyConfiguration(cause);
                                break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to auto-adjust configuration based on analysis result: " + result, e);
        }
    }
    
    private void adjustSystemConfiguration(RootCause cause) {
        try {
            String category = cause.getCategory();
            
            if ("CPU Usage".equals(category) || "Memory Usage".equals(category)) {
                // 增加资源配额
                configurationService.increaseResourceQuota(cause.getDetails());
                log.info("Auto-adjusted system configuration for: " + category);
            } else if ("Thread Pool".equals(category)) {
                // 调整线程池大小
                configurationService.adjustThreadPoolSize(cause.getDetails());
                log.info("Auto-adjusted thread pool configuration");
            }
        } catch (Exception e) {
            log.warn("Failed to adjust system configuration for cause: " + cause, e);
        }
    }
    
    private void adjustRateLimitConfiguration(RootCause cause) {
        try {
            String category = cause.getCategory();
            
            if ("Request Volume".equals(category)) {
                // 临时提高限流阈值
                configurationService.increaseRateLimitThreshold(cause.getDetails());
                log.info("Auto-adjusted rate limit configuration for high traffic");
            }
        } catch (Exception e) {
            log.warn("Failed to adjust rate limit configuration for cause: " + cause, e);
        }
    }
    
    private void adjustDependencyConfiguration(RootCause cause) {
        try {
            String category = cause.getCategory();
            
            if ("Service Health".equals(category)) {
                // 启用备用服务或降级策略
                configurationService.enableFallbackStrategy(cause.getDetails());
                log.info("Auto-enabled fallback strategy for unhealthy dependency");
            }
        } catch (Exception e) {
            log.warn("Failed to adjust dependency configuration for cause: " + cause, e);
        }
    }
    
    private String generateNotificationContent(RootCauseAnalysisResult result, 
                                             List<RootCause> highSeverityCauses) {
        StringBuilder content = new StringBuilder();
        content.append("High severity root cause detected in rate limit event.\n\n");
        content.append("Event ID: ").append(result.getEventId()).append("\n");
        content.append("Overall Confidence: ").append(String.format("%.2f%%", result.getConfidence() * 100)).append("\n\n");
        content.append("High Severity Root Causes:\n");
        
        for (RootCause cause : highSeverityCauses) {
            content.append("- ").append(cause.getDescription())
                   .append(" (Severity: ").append(cause.getSeverity())
                   .append(", Confidence: ").append(String.format("%.2f%%", cause.getConfidence() * 100))
                   .append(")\n");
        }
        
        return content.toString();
    }
    
    private String generateRegularNotificationContent(RootCauseAnalysisResult result) {
        StringBuilder content = new StringBuilder();
        content.append("Root cause analysis completed for rate limit event.\n\n");
        content.append("Event ID: ").append(result.getEventId()).append("\n");
        content.append("Status: ").append(result.getStatus()).append("\n");
        content.append("Processing Time: ").append(result.getProcessingTime()).append("ms\n");
        content.append("Overall Confidence: ").append(String.format("%.2f%%", result.getConfidence() * 100)).append("\n");
        content.append("Root Causes Found: ").append(result.getRootCauses().size()).append("\n");
        
        return content.toString();
    }
    
    private String generateIncidentDescription(RootCauseAnalysisResult result) {
        StringBuilder description = new StringBuilder();
        description.append("Root cause analysis for rate limit event completed.\n\n");
        
        if (!result.getRootCauses().isEmpty()) {
            description.append("Identified Root Causes:\n");
            for (RootCause cause : result.getRootCauses()) {
                description.append("- ").append(cause.getDescription())
                           .append(" (").append(cause.getType()).append(", ")
                           .append(cause.getSeverity()).append(", ")
                           .append(String.format("%.2f%%", cause.getConfidence() * 100)).append(")\n");
            }
        } else {
            description.append("No root causes identified.\n");
        }
        
        return description.toString();
    }
    
    private IncidentSeverity calculateIncidentSeverity(RootCauseAnalysisResult result) {
        for (RootCause cause : result.getRootCauses()) {
            if (cause.getSeverity() == RootCauseSeverity.CRITICAL) {
                return IncidentSeverity.CRITICAL;
            }
        }
        
        for (RootCause cause : result.getRootCauses()) {
            if (cause.getSeverity() == RootCauseSeverity.HIGH) {
                return IncidentSeverity.HIGH;
            }
        }
        
        return IncidentSeverity.MEDIUM;
    }
    
    private String findExistingIncident(RootCauseAnalysisResult result) {
        try {
            // 简化实现：检查最近24小时内的事件单
            String key = "incidents:recent";
            List<String> recentIncidents = redisTemplate.opsForList().range(key, 0, 99);
            
            // 实际实现中需要更复杂的匹配逻辑
            return null;
        } catch (Exception e) {
            log.warn("Failed to find existing incident", e);
            return null;
        }
    }
    
    private List<String> getNotificationRecipients() {
        // 获取紧急通知接收者列表
        return Arrays.asList("ops-team@example.com", "sre-team@example.com");
    }
    
    private List<String> getRegularNotificationRecipients() {
        // 获取常规通知接收者列表
        return Arrays.asList("dev-team@example.com", "platform-team@example.com");
    }
    
    private void recordProcessingHistory(RootCauseAnalysisResult result) {
        try {
            String key = "root_cause_analysis:processing_history";
            String value = serializeResult(result);
            
            redisTemplate.opsForList().leftPush(key, value);
            redisTemplate.opsForList().trim(key, 0, 999); // 保留最近1000条记录
        } catch (Exception e) {
            log.warn("Failed to record processing history", e);
        }
    }
    
    private String serializeResult(RootCauseAnalysisResult result) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("Failed to serialize result", e);
            return "";
        }
    }
}
```

## 根因分析系统集成

### 统一根因分析服务

```java
// 统一根因分析服务
@Service
public class UnifiedRootCauseAnalysisService {
    private final ComprehensiveRootCauseAnalyzer analyzer;
    private final RootCauseAnalysisResultProcessor resultProcessor;
    private final RedisTemplate<String, String> redisTemplate;
    private final ScheduledExecutorService analysisScheduler = Executors.newScheduledThreadPool(2);
    
    public UnifiedRootCauseAnalysisService(ComprehensiveRootCauseAnalyzer analyzer,
                                         RootCauseAnalysisResultProcessor resultProcessor,
                                         RedisTemplate<String, String> redisTemplate) {
        this.analyzer = analyzer;
        this.resultProcessor = resultProcessor;
        this.redisTemplate = redisTemplate;
        
        // 启动定期分析任务
        startPeriodicAnalysis();
    }
    
    public CompletableFuture<RootCauseAnalysisResult> analyzeAsync(RateLimitEvent event) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // 执行根因分析
                RootCauseAnalysisResult result = analyzer.analyze(event);
                
                // 异步处理分析结果
                CompletableFuture.runAsync(() -> resultProcessor.processAnalysisResult(result));
                
                return result;
            } catch (Exception e) {
                log.error("Failed to analyze root cause for event: " + event, e);
                
                // 返回失败的分析结果
                return RootCauseAnalysisResult.builder()
                    .eventId(event.getId())
                    .timestamp(System.currentTimeMillis())
                    .rootCauses(new ArrayList<>())
                    .confidence(0.0)
                    .processingTime(0)
                    .status(AnalysisStatus.FAILED)
                    .errorMessage(e.getMessage())
                    .build();
            }
        });
    }
    
    public RootCauseAnalysisResult analyzeSync(RateLimitEvent event) {
        try {
            // 执行根因分析
            RootCauseAnalysisResult result = analyzer.analyze(event);
            
            // 处理分析结果
            resultProcessor.processAnalysisResult(result);
            
            return result;
        } catch (Exception e) {
            log.error("Failed to analyze root cause for event: " + event, e);
            
            return RootCauseAnalysisResult.builder()
                .eventId(event.getId())
                .timestamp(System.currentTimeMillis())
                .rootCauses(new ArrayList<>())
                .confidence(0.0)
                .processingTime(0)
                .status(AnalysisStatus.FAILED)
                .errorMessage(e.getMessage())
                .build();
        }
    }
    
    public List<RootCauseAnalysisResult> getRecentAnalysisResults(int count) {
        try {
            String key = "root_cause_analysis:history";
            List<String> results = redisTemplate.opsForList().range(key, 0, count - 1);
            
            return results.stream()
                .map(this::deserializeResult)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get recent analysis results", e);
            return new ArrayList<>();
        }
    }
    
    public RootCauseAnalysisResult getAnalysisResult(String eventId) {
        try {
            String key = "root_cause_analysis:result:" + eventId;
            String json = redisTemplate.opsForValue().get(key);
            
            if (json != null && !json.isEmpty()) {
                return deserializeResult(json);
            }
        } catch (Exception e) {
            log.warn("Failed to get analysis result for event: " + eventId, e);
        }
        
        return null;
    }
    
    private void startPeriodicAnalysis() {
        // 定期分析未处理的限流事件
        analysisScheduler.scheduleAtFixedRate(this::analyzePendingEvents, 
            60, 300, TimeUnit.SECONDS); // 启动后1分钟执行，之后每5分钟执行一次
    }
    
    private void analyzePendingEvents() {
        try {
            log.info("Analyzing pending rate limit events...");
            
            // 获取未分析的限流事件
            List<RateLimitEvent> pendingEvents = getPendingEvents(100);
            
            for (RateLimitEvent event : pendingEvents) {
                try {
                    // 异步分析事件
                    analyzeAsync(event);
                    
                    // 标记事件为已处理
                    markEventAsProcessed(event);
                } catch (Exception e) {
                    log.warn("Failed to analyze pending event: " + event.getId(), e);
                }
            }
            
            log.info("Finished analyzing {} pending events", pendingEvents.size());
        } catch (Exception e) {
            log.error("Failed to analyze pending events", e);
        }
    }
    
    private List<RateLimitEvent> getPendingEvents(int count) {
        try {
            String key = "rate_limit_events:pending";
            List<String> events = redisTemplate.opsForList().range(key, 0, count - 1);
            
            return events.stream()
                .map(this::deserializeEvent)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get pending events", e);
            return new ArrayList<>();
        }
    }
    
    private void markEventAsProcessed(RateLimitEvent event) {
        try {
            String pendingKey = "rate_limit_events:pending";
            String processedKey = "rate_limit_events:processed";
            
            // 从待处理队列中移除
            redisTemplate.opsForList().remove(pendingKey, 1, serializeEvent(event));
            
            // 添加到已处理队列
            redisTemplate.opsForList().leftPush(processedKey, serializeEvent(event));
            redisTemplate.opsForList().trim(processedKey, 0, 999); // 保留最近1000条记录
        } catch (Exception e) {
            log.warn("Failed to mark event as processed: " + event.getId(), e);
        }
    }
    
    private RateLimitEvent deserializeEvent(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(json, RateLimitEvent.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize event: " + json, e);
            return null;
        }
    }
    
    private String serializeEvent(RateLimitEvent event) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(event);
        } catch (Exception e) {
            log.warn("Failed to serialize event", e);
            return "";
        }
    }
    
    private RootCauseAnalysisResult deserializeResult(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(json, RootCauseAnalysisResult.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize result: " + json, e);
            return null;
        }
    }
}
```

## 最佳实践总结

### 1. 多维度分析策略

- **系统指标分析**：监控CPU、内存、GC、线程池等系统级指标
- **业务指标分析**：分析请求量、错误率、响应时间等业务级指标
- **依赖服务分析**：检查下游服务的健康状态和性能表现
- **用户行为分析**：识别异常的用户行为模式

### 2. 智能化处理机制

- **自动通知**：根据根因严重程度自动发送相应级别的通知
- **事件单管理**：自动创建和更新故障事件单
- **配置调整**：在高置信度情况下自动调整相关配置
- **历史记录**：维护完整的分析和处理历史记录

### 3. 性能与可扩展性

- **并行处理**：各维度分析并行执行以提高效率
- **异步处理**：使用异步方式处理分析结果避免阻塞
- **缓存机制**：合理使用Redis缓存提高数据访问速度
- **定期任务**：通过定时任务处理积压的分析任务

### 4. 监控与优化

- **分析准确性监控**：跟踪分析结果的准确性并持续优化
- **处理时效性监控**：监控根因分析和处理的时效性
- **系统性能监控**：监控分析系统自身的性能表现
- **反馈机制**：建立人工反馈机制持续改进分析算法

通过以上实现，我们可以构建一个完整的根因分析系统，实现限流事件的自动诊断和处理，大幅提高故障处理效率和系统稳定性。