---
title: "实时仪表盘: 全局流量态势、限流热点图、规则效果可视化"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式限流系统中，实时仪表盘是运维人员了解系统状态、快速定位问题和做出决策的重要工具。一个设计良好的仪表盘能够将复杂的监控数据以直观、易懂的方式呈现出来，帮助运维人员快速掌握全局流量态势、识别限流热点、评估规则效果。本章将深入探讨如何设计和实现一个功能完善的分布式限流实时仪表盘，包括全局流量态势展示、限流热点图绘制、规则效果可视化等核心功能。

## 仪表盘设计原则

### 用户体验设计

一个优秀的限流仪表盘需要遵循以下设计原则：

1. **信息层次清晰**：重要信息突出显示，次要信息适当弱化
2. **数据实时性**：关键指标能够实时更新，反映系统最新状态
3. **交互友好**：支持灵活的筛选、钻取和联动操作
4. **视觉美观**：采用合适的颜色搭配和图表类型，提升用户体验
5. **响应式设计**：适配不同屏幕尺寸和设备

### 功能模块划分

限流仪表盘通常包含以下功能模块：

1. **全局概览**：展示系统整体流量态势和健康状况
2. **资源监控**：按资源维度展示流量分布和限流情况
3. **规则分析**：展示各限流规则的执行效果
4. **热点识别**：识别和展示系统中的热点资源和参数
5. **历史趋势**：展示关键指标的历史变化趋势
6. **告警面板**：展示当前活跃的告警信息

## 全局流量态势展示

### 实时流量概览

```java
// 全局流量态势控制器
@RestController
@RequestMapping("/api/v1/dashboard/global")
public class GlobalTrafficController {
    private final TrafficMetricsService metricsService;
    private final ClusterNodeManager nodeManager;
    
    @GetMapping("/overview")
    public ResponseEntity<GlobalTrafficOverview> getGlobalOverview() {
        try {
            GlobalTrafficOverview overview = new GlobalTrafficOverview();
            
            // 获取全局流量指标
            TrafficMetrics globalMetrics = metricsService.getGlobalMetrics();
            overview.setTotalQps(globalMetrics.getTotalQps());
            overview.setAllowedQps(globalMetrics.getAllowedQps());
            overview.setRateLimitedQps(globalMetrics.getRateLimitedQps());
            overview.setBlockedRequests(globalMetrics.getBlockedRequests());
            
            // 计算成功率和限流率
            overview.setSuccessRate(calculateSuccessRate(globalMetrics));
            overview.setRateLimitRatio(calculateRateLimitRatio(globalMetrics));
            
            // 获取集群状态
            overview.setActiveNodes(nodeManager.getActiveNodeCount());
            overview.setTotalNodes(nodeManager.getAllNodesCount());
            overview.setClusterHealth(calculateClusterHealth());
            
            // 设置时间戳
            overview.setTimestamp(System.currentTimeMillis());
            
            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            log.error("Failed to get global traffic overview", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/trend")
    public ResponseEntity<List<TrafficTrendPoint>> getTrafficTrend(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) 
            LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) 
            LocalDateTime endTime,
            @RequestParam(defaultValue = "1m") String interval) {
        
        try {
            List<TrafficTrendPoint> trendData = metricsService.getTrafficTrend(
                startTime, endTime, interval);
            return ResponseEntity.ok(trendData);
        } catch (Exception e) {
            log.error("Failed to get traffic trend", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    private double calculateSuccessRate(TrafficMetrics metrics) {
        long total = metrics.getAllowedQps() + metrics.getRateLimitedQps();
        if (total == 0) return 1.0;
        return (double) metrics.getAllowedQps() / total;
    }
    
    private double calculateRateLimitRatio(TrafficMetrics metrics) {
        long total = metrics.getAllowedQps() + metrics.getRateLimitedQps();
        if (total == 0) return 0.0;
        return (double) metrics.getRateLimitedQps() / total;
    }
    
    private String calculateClusterHealth() {
        int activeNodes = nodeManager.getActiveNodeCount();
        int totalNodes = nodeManager.getAllNodesCount();
        
        if (totalNodes == 0) return "UNKNOWN";
        
        double healthRatio = (double) activeNodes / totalNodes;
        if (healthRatio >= 0.9) return "HEALTHY";
        if (healthRatio >= 0.7) return "WARNING";
        return "CRITICAL";
    }
    
    // 全局流量概览数据结构
    public static class GlobalTrafficOverview {
        private long timestamp;
        private double totalQps;
        private double allowedQps;
        private double rateLimitedQps;
        private long blockedRequests;
        private double successRate;
        private double rateLimitRatio;
        private int activeNodes;
        private int totalNodes;
        private String clusterHealth;
        
        // 构造函数和getter/setter方法
        public GlobalTrafficOverview() {}
        
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
        public double getSuccessRate() { return successRate; }
        public void setSuccessRate(double successRate) { this.successRate = successRate; }
        public double getRateLimitRatio() { return rateLimitRatio; }
        public void setRateLimitRatio(double rateLimitRatio) { this.rateLimitRatio = rateLimitRatio; }
        public int getActiveNodes() { return activeNodes; }
        public void setActiveNodes(int activeNodes) { this.activeNodes = activeNodes; }
        public int getTotalNodes() { return totalNodes; }
        public void setTotalNodes(int totalNodes) { this.totalNodes = totalNodes; }
        public String getClusterHealth() { return clusterHealth; }
        public void setClusterHealth(String clusterHealth) { this.clusterHealth = clusterHealth; }
    }
    
    // 流量趋势数据点
    public static class TrafficTrendPoint {
        private long timestamp;
        private double totalQps;
        private double allowedQps;
        private double rateLimitedQps;
        private long blockedRequests;
        
        public TrafficTrendPoint() {}
        
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
    }
}
```

### 集群节点状态监控

```java
// 集群节点状态控制器
@RestController
@RequestMapping("/api/v1/dashboard/nodes")
public class ClusterNodesController {
    private final ClusterNodeManager nodeManager;
    private final NodeMetricsService metricsService;
    
    @GetMapping("/status")
    public ResponseEntity<List<NodeStatus>> getNodesStatus() {
        try {
            List<ClusterNodeManager.ClusterNode> nodes = nodeManager.getAllNodes();
            List<NodeStatus> nodeStatuses = new ArrayList<>();
            
            for (ClusterNodeManager.ClusterNode node : nodes) {
                NodeStatus status = new NodeStatus();
                status.setNodeId(node.getNodeId());
                status.setHost(node.getHost());
                status.setPort(node.getPort());
                status.setStatus(node.isOnline() ? "ONLINE" : "OFFLINE");
                status.setLastHeartbeat(node.getLastHeartbeatTime());
                
                // 获取节点指标
                NodeMetrics metrics = metricsService.getNodeMetrics(node.getNodeId());
                status.setCurrentQps(metrics.getCurrentQps());
                status.setCurrentConcurrency(metrics.getCurrentConcurrency());
                status.setCpuUsage(metrics.getCpuUsage());
                status.setMemoryUsage(metrics.getMemoryUsage());
                
                // 计算节点健康度
                status.setHealthScore(calculateHealthScore(metrics));
                
                nodeStatuses.add(status);
            }
            
            return ResponseEntity.ok(nodeStatuses);
        } catch (Exception e) {
            log.error("Failed to get nodes status", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    private int calculateHealthScore(NodeMetrics metrics) {
        // 基于CPU、内存、QPS等指标计算健康度分数
        int cpuScore = 100 - (int) Math.min(100, metrics.getCpuUsage());
        int memoryScore = 100 - (int) Math.min(100, metrics.getMemoryUsage());
        int qpsScore = 100 - Math.min(100, metrics.getCurrentQps() / 100);
        
        return (cpuScore + memoryScore + qpsScore) / 3;
    }
    
    // 节点状态数据结构
    public static class NodeStatus {
        private String nodeId;
        private String host;
        private int port;
        private String status;
        private long lastHeartbeat;
        private double currentQps;
        private long currentConcurrency;
        private double cpuUsage;
        private double memoryUsage;
        private int healthScore;
        
        // 构造函数和getter/setter方法
        public NodeStatus() {}
        
        // getter和setter方法
        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        public String getHost() { return host; }
        public void setHost(String host) { this.host = host; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public long getLastHeartbeat() { return lastHeartbeat; }
        public void setLastHeartbeat(long lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }
        public double getCurrentQps() { return currentQps; }
        public void setCurrentQps(double currentQps) { this.currentQps = currentQps; }
        public long getCurrentConcurrency() { return currentConcurrency; }
        public void setCurrentConcurrency(long currentConcurrency) { this.currentConcurrency = currentConcurrency; }
        public double getCpuUsage() { return cpuUsage; }
        public void setCpuUsage(double cpuUsage) { this.cpuUsage = cpuUsage; }
        public double getMemoryUsage() { return memoryUsage; }
        public void setMemoryUsage(double memoryUsage) { this.memoryUsage = memoryUsage; }
        public int getHealthScore() { return healthScore; }
        public void setHealthScore(int healthScore) { this.healthScore = healthScore; }
    }
}
```

## 限流热点图绘制

### 热点资源识别

```java
// 热点资源识别服务
@Service
public class HotspotResourceService {
    private final MetricsQueryService metricsService;
    private final HotspotDetectionAlgorithm detectionAlgorithm;
    
    public HotspotResourceService(MetricsQueryService metricsService,
                                HotspotDetectionAlgorithm detectionAlgorithm) {
        this.metricsService = metricsService;
        this.detectionAlgorithm = detectionAlgorithm;
    }
    
    public List<HotspotResource> getHotspotResources(int limit) {
        try {
            // 获取所有资源的流量数据
            List<ResourceMetrics> allResources = metricsService.getAllResourceMetrics();
            
            // 应用热点检测算法
            List<HotspotResource> hotspots = detectionAlgorithm.detectHotspots(allResources);
            
            // 按热度排序并限制数量
            return hotspots.stream()
                .sorted(Comparator.comparing(HotspotResource::getHeatScore).reversed())
                .limit(limit)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to get hotspot resources", e);
            return Collections.emptyList();
        }
    }
    
    public HotspotMapData getHotspotMapData() {
        HotspotMapData mapData = new HotspotMapData();
        
        // 获取热点资源
        List<HotspotResource> hotspots = getHotspotResources(50);
        mapData.setHotspots(hotspots);
        
        // 计算统计信息
        mapData.setTotalResources(hotspots.size());
        mapData.setMaxHeatScore(hotspots.stream()
            .mapToDouble(HotspotResource::getHeatScore)
            .max()
            .orElse(0.0));
        mapData.setAvgHeatScore(hotspots.stream()
            .mapToDouble(HotspotResource::getHeatScore)
            .average()
            .orElse(0.0));
        
        return mapData;
    }
    
    // 热点检测算法
    @Component
    public static class HotspotDetectionAlgorithm {
        public List<HotspotResource> detectHotspots(List<ResourceMetrics> resources) {
            List<HotspotResource> hotspots = new ArrayList<>();
            
            // 计算基准值
            double avgQps = resources.stream()
                .mapToDouble(ResourceMetrics::getQps)
                .average()
                .orElse(1.0);
            
            double avgRateLimitedQps = resources.stream()
                .mapToDouble(ResourceMetrics::getRateLimitedQps)
                .average()
                .orElse(1.0);
            
            for (ResourceMetrics resource : resources) {
                // 计算热度分数
                double qpsScore = resource.getQps() / avgQps;
                double rateLimitScore = resource.getRateLimitedQps() / avgRateLimitedQps;
                double heatScore = (qpsScore * 0.7 + rateLimitScore * 0.3) * 100;
                
                // 判断是否为热点
                if (heatScore > 150) { // 超过平均值1.5倍
                    HotspotResource hotspot = new HotspotResource();
                    hotspot.setResourceName(resource.getResourceName());
                    hotspot.setQps(resource.getQps());
                    hotspot.setRateLimitedQps(resource.getRateLimitedQps());
                    hotspot.setHeatScore(heatScore);
                    hotspot.setTrend(calculateTrend(resource));
                    
                    hotspots.add(hotspot);
                }
            }
            
            return hotspots;
        }
        
        private String calculateTrend(ResourceMetrics resource) {
            // 简化的趋势计算
            if (resource.getQps() > resource.getPreviousQps() * 1.2) {
                return "UP";
            } else if (resource.getQps() < resource.getPreviousQps() * 0.8) {
                return "DOWN";
            } else {
                return "STABLE";
            }
        }
    }
    
    // 热点资源数据结构
    public static class HotspotResource {
        private String resourceName;
        private double qps;
        private double rateLimitedQps;
        private double heatScore;
        private String trend;
        
        // 构造函数和getter/setter方法
        public HotspotResource() {}
        
        // getter和setter方法
        public String getResourceName() { return resourceName; }
        public void setResourceName(String resourceName) { this.resourceName = resourceName; }
        public double getQps() { return qps; }
        public void setQps(double qps) { this.qps = qps; }
        public double getRateLimitedQps() { return rateLimitedQps; }
        public void setRateLimitedQps(double rateLimitedQps) { this.rateLimitedQps = rateLimitedQps; }
        public double getHeatScore() { return heatScore; }
        public void setHeatScore(double heatScore) { this.heatScore = heatScore; }
        public String getTrend() { return trend; }
        public void setTrend(String trend) { this.trend = trend; }
    }
    
    // 热点地图数据结构
    public static class HotspotMapData {
        private List<HotspotResource> hotspots;
        private int totalResources;
        private double maxHeatScore;
        private double avgHeatScore;
        
        public HotspotMapData() {
            this.hotspots = new ArrayList<>();
        }
        
        // getter和setter方法
        public List<HotspotResource> getHotspots() { return hotspots; }
        public void setHotspots(List<HotspotResource> hotspots) { this.hotspots = hotspots; }
        public int getTotalResources() { return totalResources; }
        public void setTotalResources(int totalResources) { this.totalResources = totalResources; }
        public double getMaxHeatScore() { return maxHeatScore; }
        public void setMaxHeatScore(double maxHeatScore) { this.maxHeatScore = maxHeatScore; }
        public double getAvgHeatScore() { return avgHeatScore; }
        public void setAvgHeatScore(double avgHeatScore) { this.avgHeatScore = avgHeatScore; }
    }
}
```

### 热点图可视化接口

```java
// 热点图可视化控制器
@RestController
@RequestMapping("/api/v1/dashboard/hotspot")
public class HotspotMapController {
    private final HotspotResourceService hotspotService;
    
    @GetMapping("/map")
    public ResponseEntity<HotspotMapVisualization> getHotspotMap() {
        try {
            HotspotResourceService.HotspotMapData mapData = hotspotService.getHotspotMapData();
            
            HotspotMapVisualization visualization = new HotspotMapVisualization();
            visualization.setTimestamp(System.currentTimeMillis());
            
            // 转换为可视化数据格式
            List<HotspotPoint> points = mapData.getHotspots().stream()
                .map(this::convertToHotspotPoint)
                .collect(Collectors.toList());
            
            visualization.setPoints(points);
            visualization.setTotalResources(mapData.getTotalResources());
            visualization.setMaxHeatScore(mapData.getMaxHeatScore());
            visualization.setAvgHeatScore(mapData.getAvgHeatScore());
            
            return ResponseEntity.ok(visualization);
        } catch (Exception e) {
            log.error("Failed to get hotspot map", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    private HotspotPoint convertToHotspotPoint(HotspotResourceService.HotspotResource resource) {
        HotspotPoint point = new HotspotPoint();
        point.setName(resource.getResourceName());
        point.setValue(resource.getQps());
        point.setSize(resource.getHeatScore() / 10); // 调整大小比例
        point.setColor(calculateColor(resource.getHeatScore()));
        point.setTrend(resource.getTrend());
        point.setRateLimitedQps(resource.getRateLimitedQps());
        
        return point;
    }
    
    private String calculateColor(double heatScore) {
        if (heatScore > 300) return "#FF0000"; // 红色
        if (heatScore > 200) return "#FF8C00"; // 橙色
        if (heatScore > 150) return "#FFD700"; // 黄色
        return "#32CD32"; // 绿色
    }
    
    // 热点图可视化数据结构
    public static class HotspotMapVisualization {
        private long timestamp;
        private List<HotspotPoint> points;
        private int totalResources;
        private double maxHeatScore;
        private double avgHeatScore;
        
        public HotspotMapVisualization() {
            this.points = new ArrayList<>();
        }
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public List<HotspotPoint> getPoints() { return points; }
        public void setPoints(List<HotspotPoint> points) { this.points = points; }
        public int getTotalResources() { return totalResources; }
        public void setTotalResources(int totalResources) { this.totalResources = totalResources; }
        public double getMaxHeatScore() { return maxHeatScore; }
        public void setMaxHeatScore(double maxHeatScore) { this.maxHeatScore = maxHeatScore; }
        public double getAvgHeatScore() { return avgHeatScore; }
        public void setAvgHeatScore(double avgHeatScore) { this.avgHeatScore = avgHeatScore; }
    }
    
    // 热点点数据结构
    public static class HotspotPoint {
        private String name;
        private double value;
        private double size;
        private String color;
        private String trend;
        private double rateLimitedQps;
        
        // 构造函数和getter/setter方法
        public HotspotPoint() {}
        
        // getter和setter方法
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public double getValue() { return value; }
        public void setValue(double value) { this.value = value; }
        public double getSize() { return size; }
        public void setSize(double size) { this.size = size; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
        public String getTrend() { return trend; }
        public void setTrend(String trend) { this.trend = trend; }
        public double getRateLimitedQps() { return rateLimitedQps; }
        public void setRateLimitedQps(double rateLimitedQps) { this.rateLimitedQps = rateLimitedQps; }
    }
}
```

## 规则效果可视化

### 限流规则执行分析

```java
// 规则效果分析服务
@Service
public class RuleEffectAnalysisService {
    private final RuleMetricsService metricsService;
    private final RuleConfigurationService configService;
    
    public RuleEffectAnalysisService(RuleMetricsService metricsService,
                                   RuleConfigurationService configService) {
        this.metricsService = metricsService;
        this.configService = configService;
    }
    
    public List<RuleEffectData> getRuleEffectAnalysis() {
        try {
            List<RateLimitRule> allRules = configService.getAllRules();
            List<RuleEffectData> effectDataList = new ArrayList<>();
            
            for (RateLimitRule rule : allRules) {
                RuleEffectData effectData = new RuleEffectData();
                effectData.setRuleId(rule.getId());
                effectData.setRuleName(rule.getName());
                effectData.setResource(rule.getResource());
                effectData.setLimit(rule.getLimit());
                effectData.setWindow(rule.getWindow());
                effectData.setStatus(rule.isEnabled() ? "ENABLED" : "DISABLED");
                
                // 获取规则执行指标
                RuleMetrics metrics = metricsService.getRuleMetrics(rule.getId());
                effectData.setTriggerCount(metrics.getTriggerCount());
                effectData.setAllowedCount(metrics.getAllowedCount());
                effectData.setRateLimitedCount(metrics.getRateLimitedCount());
                effectData.setAvgLatency(metrics.getAvgLatency());
                
                // 计算效果指标
                effectData.setEffectiveness(calculateEffectiveness(metrics));
                effectData.setEfficiency(calculateEfficiency(metrics, rule));
                effectData.setLastTriggerTime(metrics.getLastTriggerTime());
                
                effectDataList.add(effectData);
            }
            
            return effectDataList;
        } catch (Exception e) {
            log.error("Failed to get rule effect analysis", e);
            return Collections.emptyList();
        }
    }
    
    private double calculateEffectiveness(RuleMetrics metrics) {
        long total = metrics.getAllowedCount() + metrics.getRateLimitedCount();
        if (total == 0) return 0.0;
        
        // 有效性 = 限流请求数 / 总请求数
        return (double) metrics.getRateLimitedCount() / total;
    }
    
    private double calculateEfficiency(RuleMetrics metrics, RateLimitRule rule) {
        if (metrics.getTriggerCount() == 0) return 0.0;
        
        // 效率 = (限流请求数 / 规则触发次数) / (规则限制 / 100)
        // 这个指标衡量规则触发的精准度
        double triggerEfficiency = (double) metrics.getRateLimitedCount() / metrics.getTriggerCount();
        double limitRatio = (double) rule.getLimit() / 100.0;
        
        return triggerEfficiency / limitRatio;
    }
    
    public RuleEffectTrend getRuleEffectTrend(String ruleId, LocalDateTime startTime, 
                                            LocalDateTime endTime) {
        try {
            List<RuleMetrics> trendData = metricsService.getRuleMetricsTrend(
                ruleId, startTime, endTime);
            
            RuleEffectTrend trend = new RuleEffectTrend();
            trend.setRuleId(ruleId);
            
            List<RuleEffectTrendPoint> points = trendData.stream()
                .map(this::convertToTrendPoint)
                .collect(Collectors.toList());
            
            trend.setPoints(points);
            
            return trend;
        } catch (Exception e) {
            log.error("Failed to get rule effect trend", e);
            return new RuleEffectTrend();
        }
    }
    
    private RuleEffectTrendPoint convertToTrendPoint(RuleMetrics metrics) {
        RuleEffectTrendPoint point = new RuleEffectTrendPoint();
        point.setTimestamp(metrics.getTimestamp());
        point.setTriggerCount(metrics.getTriggerCount());
        point.setAllowedCount(metrics.getAllowedCount());
        point.setRateLimitedCount(metrics.getRateLimitedCount());
        point.setAvgLatency(metrics.getAvgLatency());
        
        return point;
    }
    
    // 规则效果数据结构
    public static class RuleEffectData {
        private String ruleId;
        private String ruleName;
        private String resource;
        private int limit;
        private int window;
        private String status;
        private long triggerCount;
        private long allowedCount;
        private long rateLimitedCount;
        private double avgLatency;
        private double effectiveness;
        private double efficiency;
        private long lastTriggerTime;
        
        // 构造函数和getter/setter方法
        public RuleEffectData() {}
        
        // getter和setter方法
        public String getRuleId() { return ruleId; }
        public void setRuleId(String ruleId) { this.ruleId = ruleId; }
        public String getRuleName() { return ruleName; }
        public void setRuleName(String ruleName) { this.ruleName = ruleName; }
        public String getResource() { return resource; }
        public void setResource(String resource) { this.resource = resource; }
        public int getLimit() { return limit; }
        public void setLimit(int limit) { this.limit = limit; }
        public int getWindow() { return window; }
        public void setWindow(int window) { this.window = window; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public long getTriggerCount() { return triggerCount; }
        public void setTriggerCount(long triggerCount) { this.triggerCount = triggerCount; }
        public long getAllowedCount() { return allowedCount; }
        public void setAllowedCount(long allowedCount) { this.allowedCount = allowedCount; }
        public long getRateLimitedCount() { return rateLimitedCount; }
        public void setRateLimitedCount(long rateLimitedCount) { this.rateLimitedCount = rateLimitedCount; }
        public double getAvgLatency() { return avgLatency; }
        public void setAvgLatency(double avgLatency) { this.avgLatency = avgLatency; }
        public double getEffectiveness() { return effectiveness; }
        public void setEffectiveness(double effectiveness) { this.effectiveness = effectiveness; }
        public double getEfficiency() { return efficiency; }
        public void setEfficiency(double efficiency) { this.efficiency = efficiency; }
        public long getLastTriggerTime() { return lastTriggerTime; }
        public void setLastTriggerTime(long lastTriggerTime) { this.lastTriggerTime = lastTriggerTime; }
    }
    
    // 规则效果趋势数据结构
    public static class RuleEffectTrend {
        private String ruleId;
        private List<RuleEffectTrendPoint> points;
        
        public RuleEffectTrend() {
            this.points = new ArrayList<>();
        }
        
        // getter和setter方法
        public String getRuleId() { return ruleId; }
        public void setRuleId(String ruleId) { this.ruleId = ruleId; }
        public List<RuleEffectTrendPoint> getPoints() { return points; }
        public void setPoints(List<RuleEffectTrendPoint> points) { this.points = points; }
    }
    
    // 规则效果趋势点数据结构
    public static class RuleEffectTrendPoint {
        private long timestamp;
        private long triggerCount;
        private long allowedCount;
        private long rateLimitedCount;
        private double avgLatency;
        
        // 构造函数和getter/setter方法
        public RuleEffectTrendPoint() {}
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public long getTriggerCount() { return triggerCount; }
        public void setTriggerCount(long triggerCount) { this.triggerCount = triggerCount; }
        public long getAllowedCount() { return allowedCount; }
        public void setAllowedCount(long allowedCount) { this.allowedCount = allowedCount; }
        public long getRateLimitedCount() { return rateLimitedCount; }
        public void setRateLimitedCount(long rateLimitedCount) { this.rateLimitedCount = rateLimitedCount; }
        public double getAvgLatency() { return avgLatency; }
        public void setAvgLatency(double avgLatency) { this.avgLatency = avgLatency; }
    }
}
```

### 规则效果可视化接口

```java
// 规则效果可视化控制器
@RestController
@RequestMapping("/api/v1/dashboard/rules")
public class RuleEffectController {
    private final RuleEffectAnalysisService analysisService;
    
    @GetMapping("/effect")
    public ResponseEntity<List<RuleEffectAnalysisService.RuleEffectData>> getRuleEffect() {
        try {
            List<RuleEffectAnalysisService.RuleEffectData> effectData = 
                analysisService.getRuleEffectAnalysis();
            return ResponseEntity.ok(effectData);
        } catch (Exception e) {
            log.error("Failed to get rule effect", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/effect/{ruleId}/trend")
    public ResponseEntity<RuleEffectAnalysisService.RuleEffectTrend> getRuleEffectTrend(
            @PathVariable String ruleId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) 
            LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) 
            LocalDateTime endTime) {
        
        try {
            RuleEffectAnalysisService.RuleEffectTrend trend = 
                analysisService.getRuleEffectTrend(ruleId, startTime, endTime);
            return ResponseEntity.ok(trend);
        } catch (Exception e) {
            log.error("Failed to get rule effect trend", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    @GetMapping("/summary")
    public ResponseEntity<RuleEffectSummary> getRuleEffectSummary() {
        try {
            List<RuleEffectAnalysisService.RuleEffectData> effectData = 
                analysisService.getRuleEffectAnalysis();
            
            RuleEffectSummary summary = new RuleEffectSummary();
            summary.setTotalRules(effectData.size());
            summary.setEnabledRules((int) effectData.stream()
                .filter(data -> "ENABLED".equals(data.getStatus()))
                .count());
            
            // 计算平均有效性
            summary.setAvgEffectiveness(effectData.stream()
                .mapToDouble(RuleEffectAnalysisService.RuleEffectData::getEffectiveness)
                .average()
                .orElse(0.0));
            
            // 计算平均效率
            summary.setAvgEfficiency(effectData.stream()
                .mapToDouble(RuleEffectAnalysisService.RuleEffectData::getEfficiency)
                .average()
                .orElse(0.0));
            
            // 找出最有效的规则
            Optional<RuleEffectAnalysisService.RuleEffectData> mostEffective = effectData.stream()
                .max(Comparator.comparing(RuleEffectAnalysisService.RuleEffectData::getEffectiveness));
            summary.setMostEffectiveRule(mostEffective.map(RuleEffectAnalysisService.RuleEffectData::getRuleName)
                .orElse("N/A"));
            
            // 找出效率最高的规则
            Optional<RuleEffectAnalysisService.RuleEffectData> mostEfficient = effectData.stream()
                .max(Comparator.comparing(RuleEffectAnalysisService.RuleEffectData::getEfficiency));
            summary.setMostEfficientRule(mostEfficient.map(RuleEffectAnalysisService.RuleEffectData::getRuleName)
                .orElse("N/A"));
            
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Failed to get rule effect summary", e);
            return ResponseEntity.status(500).build();
        }
    }
    
    // 规则效果摘要数据结构
    public static class RuleEffectSummary {
        private int totalRules;
        private int enabledRules;
        private double avgEffectiveness;
        private double avgEfficiency;
        private String mostEffectiveRule;
        private String mostEfficientRule;
        
        // 构造函数和getter/setter方法
        public RuleEffectSummary() {}
        
        // getter和setter方法
        public int getTotalRules() { return totalRules; }
        public void setTotalRules(int totalRules) { this.totalRules = totalRules; }
        public int getEnabledRules() { return enabledRules; }
        public void setEnabledRules(int enabledRules) { this.enabledRules = enabledRules; }
        public double getAvgEffectiveness() { return avgEffectiveness; }
        public void setAvgEffectiveness(double avgEffectiveness) { this.avgEffectiveness = avgEffectiveness; }
        public double getAvgEfficiency() { return avgEfficiency; }
        public void setAvgEfficiency(double avgEfficiency) { this.avgEfficiency = avgEfficiency; }
        public String getMostEffectiveRule() { return mostEffectiveRule; }
        public void setMostEffectiveRule(String mostEffectiveRule) { this.mostEffectiveRule = mostEffectiveRule; }
        public String getMostEfficientRule() { return mostEfficientRule; }
        public void setMostEfficientRule(String mostEfficientRule) { this.mostEfficientRule = mostEfficientRule; }
    }
}
```

## 前端可视化实现

### 仪表盘组件设计

```javascript
// 全局流量概览组件
class GlobalTrafficOverview extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            overviewData: null,
            trendData: [],
            loading: true
        };
    }
    
    componentDidMount() {
        this.fetchOverviewData();
        this.fetchTrendData();
        this.startAutoRefresh();
    }
    
    fetchOverviewData = async () => {
        try {
            const response = await fetch('/api/v1/dashboard/global/overview');
            const data = await response.json();
            this.setState({ overviewData: data });
        } catch (error) {
            console.error('Failed to fetch overview data:', error);
        }
    }
    
    fetchTrendData = async () => {
        try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1小时前
            
            const response = await fetch(`/api/v1/dashboard/global/trend?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`);
            const data = await response.json();
            this.setState({ trendData: data });
        } catch (error) {
            console.error('Failed to fetch trend data:', error);
        }
    }
    
    startAutoRefresh = () => {
        setInterval(() => {
            this.fetchOverviewData();
            this.fetchTrendData();
        }, 10000); // 每10秒刷新一次
    }
    
    render() {
        const { overviewData, trendData, loading } = this.state;
        
        if (loading && !overviewData) {
            return <div>Loading...</div>;
        }
        
        return (
            <div className="global-overview">
                <div className="metrics-cards">
                    <MetricCard 
                        title="总QPS" 
                        value={overviewData?.totalQps?.toFixed(2) || 0}
                        trend={overviewData?.totalQpsTrend || 'stable'}
                    />
                    <MetricCard 
                        title="通过QPS" 
                        value={overviewData?.allowedQps?.toFixed(2) || 0}
                        trend={overviewData?.allowedQpsTrend || 'stable'}
                    />
                    <MetricCard 
                        title="限流QPS" 
                        value={overviewData?.rateLimitedQps?.toFixed(2) || 0}
                        trend={overviewData?.rateLimitedQpsTrend || 'stable'}
                    />
                    <MetricCard 
                        title="成功率" 
                        value={`${(overviewData?.successRate * 100)?.toFixed(2) || 0}%`}
                        trend={overviewData?.successRateTrend || 'stable'}
                    />
                </div>
                
                <div className="trend-chart">
                    <h3>流量趋势</h3>
                    <LineChart data={trendData} />
                </div>
            </div>
        );
    }
}

// 热点图组件
class HotspotMap extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hotspotData: null,
            loading: true
        };
    }
    
    componentDidMount() {
        this.fetchHotspotData();
        this.startAutoRefresh();
    }
    
    fetchHotspotData = async () => {
        try {
            const response = await fetch('/api/v1/dashboard/hotspot/map');
            const data = await response.json();
            this.setState({ hotspotData: data, loading: false });
        } catch (error) {
            console.error('Failed to fetch hotspot data:', error);
            this.setState({ loading: false });
        }
    }
    
    startAutoRefresh = () => {
        setInterval(() => {
            this.fetchHotspotData();
        }, 15000); // 每15秒刷新一次
    }
    
    render() {
        const { hotspotData, loading } = this.state;
        
        if (loading) {
            return <div>Loading hotspot map...</div>;
        }
        
        return (
            <div className="hotspot-map">
                <h3>限流热点图</h3>
                <div className="map-container">
                    <BubbleChart data={hotspotData?.points || []} />
                </div>
                <div className="hotspot-stats">
                    <span>总资源数: {hotspotData?.totalResources || 0}</span>
                    <span>最高热度: {hotspotData?.maxHeatScore?.toFixed(2) || 0}</span>
                    <span>平均热度: {hotspotData?.avgHeatScore?.toFixed(2) || 0}</span>
                </div>
            </div>
        );
    }
}

// 规则效果组件
class RuleEffectDashboard extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ruleEffectData: [],
            summaryData: null,
            loading: true
        };
    }
    
    componentDidMount() {
        this.fetchRuleEffectData();
        this.fetchSummaryData();
        this.startAutoRefresh();
    }
    
    fetchRuleEffectData = async () => {
        try {
            const response = await fetch('/api/v1/dashboard/rules/effect');
            const data = await response.json();
            this.setState({ ruleEffectData: data, loading: false });
        } catch (error) {
            console.error('Failed to fetch rule effect data:', error);
            this.setState({ loading: false });
        }
    }
    
    fetchSummaryData = async () => {
        try {
            const response = await fetch('/api/v1/dashboard/rules/summary');
            const data = await response.json();
            this.setState({ summaryData: data });
        } catch (error) {
            console.error('Failed to fetch summary data:', error);
        }
    }
    
    startAutoRefresh = () => {
        setInterval(() => {
            this.fetchRuleEffectData();
            this.fetchSummaryData();
        }, 20000); // 每20秒刷新一次
    }
    
    render() {
        const { ruleEffectData, summaryData, loading } = this.state;
        
        if (loading) {
            return <div>Loading rule effect data...</div>;
        }
        
        return (
            <div className="rule-effect-dashboard">
                <div className="summary-cards">
                    <SummaryCard 
                        title="总规则数" 
                        value={summaryData?.totalRules || 0}
                    />
                    <SummaryCard 
                        title="启用规则数" 
                        value={summaryData?.enabledRules || 0}
                    />
                    <SummaryCard 
                        title="平均有效性" 
                        value={`${(summaryData?.avgEffectiveness * 100)?.toFixed(2) || 0}%`}
                    />
                    <SummaryCard 
                        title="平均效率" 
                        value={`${(summaryData?.avgEfficiency * 100)?.toFixed(2) || 0}%`}
                    />
                </div>
                
                <div className="rules-table">
                    <h3>规则效果详情</h3>
                    <RulesTable data={ruleEffectData} />
                </div>
            </div>
        );
    }
}
```

通过以上实现，我们构建了一个功能完善的分布式限流实时仪表盘，能够全面展示系统的全局流量态势、识别限流热点、分析规则效果。这个仪表盘不仅提供了丰富的可视化功能，还具备实时更新和自动刷新能力，帮助运维人员更好地监控和管理分布式限流系统。在实际应用中，可以根据具体需求调整仪表盘的布局和功能，以满足不同的监控场景。