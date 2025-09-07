---
title: "集群流量控制: 精确控制整个集群的总并发量"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式系统中，单机限流虽然能够保护单个节点，但无法解决整个集群层面的流量控制问题。当面对大规模分布式部署时，我们需要一种能够精确控制整个集群总并发量的机制，以确保集群整体资源的合理利用和系统的稳定性。集群流量控制不仅需要考虑单个节点的处理能力，还需要协调整个集群的资源分配，实现全局最优的流量调度。本章将深入探讨集群流量控制的实现原理、关键技术以及最佳实践。

## 集群流量控制概述

### 问题背景

在大规模分布式系统中，传统的单机限流策略面临以下挑战：

1. **资源利用率不均**：不同节点的负载差异较大，部分节点过载而其他节点空闲
2. **全局控制缺失**：无法对整个集群的总流量进行精确控制
3. **扩容缩容困难**：节点数量变化时，限流阈值需要手动调整
4. **热点问题**：特定节点可能因为负载均衡策略成为热点

### 集群流量控制的价值

集群流量控制能够提供以下价值：

1. **全局资源优化**：合理分配集群资源，提高整体资源利用率
2. **精确流量控制**：能够精确控制整个集群的总并发量
3. **自动伸缩支持**：支持集群节点的自动扩容和缩容
4. **负载均衡优化**：结合负载均衡策略，实现更智能的流量分配

## 集群状态管理

### 集群节点发现与注册

```java
// 集群节点管理器
@Component
public class ClusterNodeManager {
    private final Map<String, ClusterNode> nodes = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatScheduler;
    private final NodeDiscoveryService discoveryService;
    private final ClusterConfig clusterConfig;
    
    public ClusterNodeManager(NodeDiscoveryService discoveryService, 
                            ClusterConfig clusterConfig) {
        this.discoveryService = discoveryService;
        this.clusterConfig = clusterConfig;
        this.heartbeatScheduler = Executors.newScheduledThreadPool(1);
        
        // 定期更新集群节点列表
        heartbeatScheduler.scheduleAtFixedRate(this::updateClusterNodes, 
            0, clusterConfig.getNodeDiscoveryInterval(), TimeUnit.SECONDS);
    }
    
    private void updateClusterNodes() {
        try {
            // 发现新的集群节点
            List<NodeInfo> discoveredNodes = discoveryService.discoverNodes();
            
            // 更新节点列表
            for (NodeInfo nodeInfo : discoveredNodes) {
                ClusterNode existingNode = nodes.get(nodeInfo.getNodeId());
                if (existingNode == null) {
                    // 新节点加入
                    ClusterNode newNode = new ClusterNode(nodeInfo);
                    nodes.put(nodeInfo.getNodeId(), newNode);
                    log.info("New node joined cluster: {}", nodeInfo.getNodeId());
                } else {
                    // 更新现有节点信息
                    existingNode.updateInfo(nodeInfo);
                }
            }
            
            // 移除已离线的节点
            cleanupOfflineNodes(discoveredNodes);
        } catch (Exception e) {
            log.error("Failed to update cluster nodes", e);
        }
    }
    
    private void cleanupOfflineNodes(List<NodeInfo> activeNodes) {
        Set<String> activeNodeIds = activeNodes.stream()
            .map(NodeInfo::getNodeId)
            .collect(Collectors.toSet());
        
        Iterator<Map.Entry<String, ClusterNode>> iterator = nodes.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, ClusterNode> entry = iterator.next();
            ClusterNode node = entry.getValue();
            
            // 如果节点长时间没有心跳，则认为已离线
            if (System.currentTimeMillis() - node.getLastHeartbeatTime() > 
                clusterConfig.getNodeOfflineTimeout()) {
                iterator.remove();
                log.info("Node left cluster: {}", node.getNodeId());
            }
        }
    }
    
    public List<ClusterNode> getActiveNodes() {
        return nodes.values().stream()
            .filter(node -> System.currentTimeMillis() - node.getLastHeartbeatTime() < 
                          clusterConfig.getNodeOfflineTimeout())
            .collect(Collectors.toList());
    }
    
    public int getActiveNodeCount() {
        return getActiveNodes().size();
    }
    
    public ClusterNode getNode(String nodeId) {
        return nodes.get(nodeId);
    }
    
    // 集群节点信息
    public static class ClusterNode {
        private final String nodeId;
        private volatile NodeInfo nodeInfo;
        private volatile long lastHeartbeatTime;
        private final AtomicLong currentConcurrency;
        private final AtomicInteger currentQPS;
        
        public ClusterNode(NodeInfo nodeInfo) {
            this.nodeId = nodeInfo.getNodeId();
            this.nodeInfo = nodeInfo;
            this.lastHeartbeatTime = System.currentTimeMillis();
            this.currentConcurrency = new AtomicLong(0);
            this.currentQPS = new AtomicInteger(0);
        }
        
        public void updateInfo(NodeInfo nodeInfo) {
            this.nodeInfo = nodeInfo;
            this.lastHeartbeatTime = System.currentTimeMillis();
        }
        
        public void updateMetrics(long concurrency, int qps) {
            this.currentConcurrency.set(concurrency);
            this.currentQPS.set(qps);
            this.lastHeartbeatTime = System.currentTimeMillis();
        }
        
        // getter方法
        public String getNodeId() { return nodeId; }
        public NodeInfo getNodeInfo() { return nodeInfo; }
        public long getLastHeartbeatTime() { return lastHeartbeatTime; }
        public long getCurrentConcurrency() { return currentConcurrency.get(); }
        public int getCurrentQPS() { return currentQPS.get(); }
    }
    
    // 节点信息
    public static class NodeInfo {
        private final String nodeId;
        private final String host;
        private final int port;
        private final int maxConcurrency;
        private final int maxQPS;
        private final Map<String, Object> metadata;
        
        public NodeInfo(String nodeId, String host, int port, 
                       int maxConcurrency, int maxQPS, 
                       Map<String, Object> metadata) {
            this.nodeId = nodeId;
            this.host = host;
            this.port = port;
            this.maxConcurrency = maxConcurrency;
            this.maxQPS = maxQPS;
            this.metadata = metadata != null ? metadata : new HashMap<>();
        }
        
        // getter方法
        public String getNodeId() { return nodeId; }
        public String getHost() { return host; }
        public int getPort() { return port; }
        public int getMaxConcurrency() { return maxConcurrency; }
        public int getMaxQPS() { return maxQPS; }
        public Map<String, Object> getMetadata() { return metadata; }
    }
}
```

### 节点心跳与健康检查

```java
// 节点心跳服务
@RestController
@RequestMapping("/api/v1/cluster")
public class NodeHeartbeatController {
    private final ClusterNodeManager nodeManager;
    private final MetricsCollector metricsCollector;
    private final HealthCheckService healthCheckService;
    
    @PostMapping("/heartbeat")
    public ResponseEntity<HeartbeatResponse> heartbeat(
            @RequestHeader("X-Node-Id") String nodeId,
            @RequestBody HeartbeatRequest request) {
        
        try {
            // 更新节点信息
            ClusterNodeManager.ClusterNode node = nodeManager.getNode(nodeId);
            if (node == null) {
                return ResponseEntity.notFound().build();
            }
            
            // 收集节点指标
            NodeMetrics metrics = metricsCollector.collectNodeMetrics();
            
            // 执行健康检查
            HealthCheckResult healthCheck = healthCheckService.checkNodeHealth();
            
            // 更新节点状态
            node.updateMetrics(metrics.getConcurrency(), metrics.getQPS());
            
            // 构造响应
            HeartbeatResponse response = new HeartbeatResponse();
            response.setTimestamp(System.currentTimeMillis());
            response.setAccepted(true);
            response.setClusterConcurrency(getClusterTotalConcurrency());
            response.setClusterQPS(getClusterTotalQPS());
            response.setNodeConcurrency(metrics.getConcurrency());
            response.setNodeQPS(metrics.getQPS());
            response.setHealthStatus(healthCheck.isHealthy() ? "HEALTHY" : "UNHEALTHY");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to process heartbeat from node: " + nodeId, e);
            return ResponseEntity.status(500).body(
                new HeartbeatResponse(System.currentTimeMillis(), false, 
                    "Internal error: " + e.getMessage())
            );
        }
    }
    
    private long getClusterTotalConcurrency() {
        return nodeManager.getActiveNodes().stream()
            .mapToLong(ClusterNodeManager.ClusterNode::getCurrentConcurrency)
            .sum();
    }
    
    private int getClusterTotalQPS() {
        return nodeManager.getActiveNodes().stream()
            .mapToInt(ClusterNodeManager.ClusterNode::getCurrentQPS)
            .sum();
    }
    
    // 心跳请求
    public static class HeartbeatRequest {
        private long timestamp;
        private long concurrency;
        private int qps;
        private Map<String, Object> metrics;
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public long getConcurrency() { return concurrency; }
        public void setConcurrency(long concurrency) { this.concurrency = concurrency; }
        public int getQps() { return qps; }
        public void setQps(int qps) { this.qps = qps; }
        public Map<String, Object> getMetrics() { return metrics; }
        public void setMetrics(Map<String, Object> metrics) { this.metrics = metrics; }
    }
    
    // 心跳响应
    public static class HeartbeatResponse {
        private long timestamp;
        private boolean accepted;
        private String errorMessage;
        private long clusterConcurrency;
        private int clusterQPS;
        private long nodeConcurrency;
        private int nodeQPS;
        private String healthStatus;
        
        public HeartbeatResponse() {}
        
        public HeartbeatResponse(long timestamp, boolean accepted, String errorMessage) {
            this.timestamp = timestamp;
            this.accepted = accepted;
            this.errorMessage = errorMessage;
        }
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public boolean isAccepted() { return accepted; }
        public void setAccepted(boolean accepted) { this.accepted = accepted; }
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
        public long getClusterConcurrency() { return clusterConcurrency; }
        public void setClusterConcurrency(long clusterConcurrency) { this.clusterConcurrency = clusterConcurrency; }
        public int getClusterQPS() { return clusterQPS; }
        public void setClusterQPS(int clusterQPS) { this.clusterQPS = clusterQPS; }
        public long getNodeConcurrency() { return nodeConcurrency; }
        public void setNodeConcurrency(long nodeConcurrency) { this.nodeConcurrency = nodeConcurrency; }
        public int getNodeQPS() { return nodeQPS; }
        public void setNodeQPS(int nodeQPS) { this.nodeQPS = nodeQPS; }
        public String getHealthStatus() { return healthStatus; }
        public void setHealthStatus(String healthStatus) { this.healthStatus = healthStatus; }
    }
}
```

## 集群限流算法

### 全局令牌桶算法

```java
// 全局令牌桶实现
@Component
public class GlobalTokenBucket {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScriptExecutor scriptExecutor;
    private final ClusterNodeManager nodeManager;
    private final ClusterConfig clusterConfig;
    
    // Lua脚本实现原子性全局令牌桶操作
    private static final String GLOBAL_TOKEN_BUCKET_SCRIPT = 
        "local key = KEYS[1]\n" +
        "local tokens_to_consume = tonumber(ARGV[1])\n" +
        "local max_tokens = tonumber(ARGV[2])\n" +
        "local refill_rate = tonumber(ARGV[3])\n" +
        "local refill_interval = tonumber(ARGV[4])\n" +
        "local current_time = tonumber(ARGV[5])\n" +
        "\n" +
        "local bucket = redis.call('HMGET', key, 'tokens', 'last_refill_time')\n" +
        "local tokens = tonumber(bucket[1]) or max_tokens\n" +
        "local last_refill_time = tonumber(bucket[2]) or current_time\n" +
        "\n" +
        "-- 计算需要补充的令牌数\n" +
        "local time_since_refill = current_time - last_refill_time\n" +
        "local tokens_to_add = math.floor(time_since_refill / refill_interval) * refill_rate\n" +
        "\n" +
        "-- 补充令牌\n" +
        "tokens = math.min(max_tokens, tokens + tokens_to_add)\n" +
        "local new_refill_time = last_refill_time + math.floor(time_since_refill / refill_interval) * refill_interval\n" +
        "\n" +
        "-- 尝试消费令牌\n" +
        "if tokens >= tokens_to_consume then\n" +
        "  tokens = tokens - tokens_to_consume\n" +
        "  redis.call('HMSET', key, 'tokens', tokens, 'last_refill_time', new_refill_time)\n" +
        "  redis.call('EXPIRE', key, 3600) -- 1小时过期\n" +
        "  return 1\n" +
        "else\n" +
        "  redis.call('HMSET', key, 'tokens', tokens, 'last_refill_time', new_refill_time)\n" +
        "  redis.call('EXPIRE', key, 3600) -- 1小时过期\n" +
        "  return 0\n" +
        "end";
    
    public GlobalTokenBucket(RedisTemplate<String, String> redisTemplate,
                           ClusterNodeManager nodeManager,
                           ClusterConfig clusterConfig) {
        this.redisTemplate = redisTemplate;
        this.scriptExecutor = new ScriptExecutor(redisTemplate);
        this.nodeManager = nodeManager;
        this.clusterConfig = clusterConfig;
    }
    
    public boolean tryAcquire(String resource, int tokens) {
        String key = "global_token_bucket:" + resource;
        int maxTokens = clusterConfig.getClusterMaxConcurrency();
        int refillRate = clusterConfig.getClusterRefillRate();
        int refillInterval = clusterConfig.getClusterRefillInterval();
        long currentTime = System.currentTimeMillis();
        
        try {
            Long result = scriptExecutor.execute(GLOBAL_TOKEN_BUCKET_SCRIPT,
                Collections.singletonList(key),
                String.valueOf(tokens),
                String.valueOf(maxTokens),
                String.valueOf(refillRate),
                String.valueOf(refillInterval),
                String.valueOf(currentTime));
            
            return result != null && result == 1;
        } catch (Exception e) {
            log.warn("Failed to acquire global token, fallback to local", e);
            return fallbackToLocalLimit(resource, tokens);
        }
    }
    
    private boolean fallbackToLocalLimit(String resource, int tokens) {
        // 降级到本地限流
        int activeNodes = nodeManager.getActiveNodeCount();
        if (activeNodes == 0) {
            return true; // 没有活跃节点时允许通过
        }
        
        // 按节点数平均分配令牌
        int tokensPerNode = Math.max(1, tokens / activeNodes);
        return true; // 简化示例
    }
}
```

### 加权轮询算法

```java
// 加权轮询负载均衡器
@Component
public class WeightedRoundRobinBalancer {
    private final ClusterNodeManager nodeManager;
    private final Map<String, AtomicInteger> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> currentWeights = new ConcurrentHashMap<>();
    private final AtomicLong lastUpdate = new AtomicLong(0);
    
    public WeightedRoundRobinBalancer(ClusterNodeManager nodeManager) {
        this.nodeManager = nodeManager;
    }
    
    public ClusterNodeManager.ClusterNode selectNode(String resource) {
        List<ClusterNodeManager.ClusterNode> activeNodes = nodeManager.getActiveNodes();
        if (activeNodes.isEmpty()) {
            return null;
        }
        
        // 更新权重
        updateWeights(activeNodes);
        
        // 选择权重最高的节点
        return selectNodeByWeight(activeNodes);
    }
    
    private void updateWeights(List<ClusterNodeManager.ClusterNode> nodes) {
        long now = System.currentTimeMillis();
        // 避免频繁更新权重
        if (now - lastUpdate.get() < 1000) {
            return;
        }
        
        lastUpdate.set(now);
        
        for (ClusterNodeManager.ClusterNode node : nodes) {
            String nodeId = node.getNodeId();
            
            // 初始化权重计数器
            nodeWeights.computeIfAbsent(nodeId, k -> new AtomicInteger(0));
            currentWeights.computeIfAbsent(nodeId, k -> new AtomicInteger(0));
            
            // 计算节点权重（基于剩余容量）
            int maxConcurrency = node.getNodeInfo().getMaxConcurrency();
            long currentConcurrency = node.getCurrentConcurrency();
            int remainingCapacity = (int) Math.max(0, maxConcurrency - currentConcurrency);
            
            // 权重计算公式：剩余容量 + 健康度因子
            int weight = remainingCapacity;
            
            // 考虑节点健康状态
            if ("UNHEALTHY".equals(getNodeHealthStatus(nodeId))) {
                weight = Math.max(0, weight - 10); // 降低不健康节点的权重
            }
            
            nodeWeights.get(nodeId).set(Math.max(1, weight));
            currentWeights.get(nodeId).set(weight);
        }
    }
    
    private ClusterNodeManager.ClusterNode selectNodeByWeight(
            List<ClusterNodeManager.ClusterNode> nodes) {
        
        // 计算总权重
        int totalWeight = nodes.stream()
            .mapToInt(node -> nodeWeights.getOrDefault(node.getNodeId(), new AtomicInteger(0)).get())
            .sum();
        
        if (totalWeight <= 0) {
            // 如果总权重为0，随机选择一个节点
            return nodes.get(ThreadLocalRandom.current().nextInt(nodes.size()));
        }
        
        // 加权随机选择
        int randomWeight = ThreadLocalRandom.current().nextInt(totalWeight);
        int currentWeight = 0;
        
        for (ClusterNodeManager.ClusterNode node : nodes) {
            String nodeId = node.getNodeId();
            int weight = nodeWeights.getOrDefault(nodeId, new AtomicInteger(0)).get();
            currentWeight += weight;
            
            if (randomWeight < currentWeight) {
                // 更新当前权重（减少选中节点的权重）
                currentWeights.get(nodeId).addAndGet(-1);
                return node;
            }
        }
        
        // 如果没有选中节点，返回第一个节点
        return nodes.get(0);
    }
    
    private String getNodeHealthStatus(String nodeId) {
        // 获取节点健康状态的实现
        return "HEALTHY"; // 简化示例
    }
    
    public void adjustNodeWeight(String nodeId, int adjustment) {
        AtomicInteger weight = currentWeights.get(nodeId);
        if (weight != null) {
            weight.addAndGet(adjustment);
        }
    }
}
```

## 集群流量控制实现

### 基于Redis的分布式实现

```java
// 分布式集群流量控制器
@Component
public class DistributedClusterFlowController {
    private final GlobalTokenBucket globalTokenBucket;
    private final WeightedRoundRobinBalancer loadBalancer;
    private final ClusterNodeManager nodeManager;
    private final MetricsCollector metricsCollector;
    private final ClusterConfig clusterConfig;
    
    public DistributedClusterFlowController(
            GlobalTokenBucket globalTokenBucket,
            WeightedRoundRobinBalancer loadBalancer,
            ClusterNodeManager nodeManager,
            MetricsCollector metricsCollector,
            ClusterConfig clusterConfig) {
        this.globalTokenBucket = globalTokenBucket;
        this.loadBalancer = loadBalancer;
        this.nodeManager = nodeManager;
        this.metricsCollector = metricsCollector;
        this.clusterConfig = clusterConfig;
    }
    
    public ClusterFlowControlResult controlFlow(String resource, int concurrency) {
        // 首先进行全局集群限流
        if (!globalTokenBucket.tryAcquire(resource, concurrency)) {
            return new ClusterFlowControlResult(false, null, 
                "Cluster concurrency limit exceeded");
        }
        
        // 选择合适的节点
        ClusterNodeManager.ClusterNode selectedNode = loadBalancer.selectNode(resource);
        if (selectedNode == null) {
            return new ClusterFlowControlResult(false, null, "No available nodes");
        }
        
        // 检查节点本地限流
        if (!checkNodeLocalLimit(selectedNode, concurrency)) {
            return new ClusterFlowControlResult(false, selectedNode, 
                "Node concurrency limit exceeded");
        }
        
        // 记录指标
        metricsCollector.recordClusterFlowControl(resource, concurrency, true);
        
        return new ClusterFlowControlResult(true, selectedNode, null);
    }
    
    private boolean checkNodeLocalLimit(ClusterNodeManager.ClusterNode node, int concurrency) {
        long currentConcurrency = node.getCurrentConcurrency();
        int maxConcurrency = node.getNodeInfo().getMaxConcurrency();
        
        return currentConcurrency + concurrency <= maxConcurrency;
    }
    
    // 集群流量控制结果
    public static class ClusterFlowControlResult {
        private final boolean allowed;
        private final ClusterNodeManager.ClusterNode selectedNode;
        private final String reason;
        
        public ClusterFlowControlResult(boolean allowed, 
                                      ClusterNodeManager.ClusterNode selectedNode, 
                                      String reason) {
            this.allowed = allowed;
            this.selectedNode = selectedNode;
            this.reason = reason;
        }
        
        public boolean isAllowed() { return allowed; }
        public ClusterNodeManager.ClusterNode getSelectedNode() { return selectedNode; }
        public String getReason() { return reason; }
    }
}
```

### 自适应集群限流

```java
// 自适应集群流量控制器
@Component
public class AdaptiveClusterFlowController {
    private final DistributedClusterFlowController clusterController;
    private final SystemMetricsCollector metricsCollector;
    private final ClusterNodeManager nodeManager;
    private final ScheduledExecutorService adjustmentScheduler;
    private final AtomicReference<ClusterLimits> currentLimits;
    
    public AdaptiveClusterFlowController(
            DistributedClusterFlowController clusterController,
            SystemMetricsCollector metricsCollector,
            ClusterNodeManager nodeManager) {
        this.clusterController = clusterController;
        this.metricsCollector = metricsCollector;
        this.nodeManager = nodeManager;
        this.adjustmentScheduler = Executors.newScheduledThreadPool(1);
        this.currentLimits = new AtomicReference<>(new ClusterLimits(1000, 10000));
        
        // 定期调整集群限流阈值
        adjustmentScheduler.scheduleAtFixedRate(this::adjustClusterLimits, 
            30, 30, TimeUnit.SECONDS);
    }
    
    public DistributedClusterFlowController.ClusterFlowControlResult controlFlow(
            String resource, int concurrency) {
        
        // 获取当前集群限制
        ClusterLimits limits = currentLimits.get();
        
        // 如果请求的并发数超过集群限制，直接拒绝
        if (concurrency > limits.getMaxConcurrencyPerRequest()) {
            return new DistributedClusterFlowController.ClusterFlowControlResult(
                false, null, "Request concurrency exceeds cluster limit");
        }
        
        // 执行集群流量控制
        return clusterController.controlFlow(resource, concurrency);
    }
    
    private void adjustClusterLimits() {
        try {
            // 收集系统指标
            SystemMetrics metrics = metricsCollector.collect();
            
            // 计算集群整体负载
            double clusterLoad = calculateClusterLoad(metrics);
            
            // 获取当前活跃节点数
            int activeNodes = nodeManager.getActiveNodeCount();
            
            // 根据负载和节点数调整限流阈值
            ClusterLimits newLimits = calculateNewLimits(clusterLoad, activeNodes);
            
            // 更新限流阈值
            ClusterLimits oldLimits = currentLimits.getAndSet(newLimits);
            
            log.info("Adjusted cluster limits: {} -> {}", oldLimits, newLimits);
        } catch (Exception e) {
            log.error("Failed to adjust cluster limits", e);
        }
    }
    
    private double calculateClusterLoad(SystemMetrics metrics) {
        // 综合计算集群负载
        double cpuLoad = metrics.getCpuUsage() / 100.0;
        double memoryLoad = metrics.getMemoryUsage() / 100.0;
        double diskLoad = metrics.getDiskUsage() / 100.0;
        
        // 加权平均
        return (cpuLoad * 0.5 + memoryLoad * 0.3 + diskLoad * 0.2);
    }
    
    private ClusterLimits calculateNewLimits(double clusterLoad, int activeNodes) {
        ClusterLimits current = currentLimits.get();
        
        // 基础阈值
        int baseMaxConcurrency = 1000 * activeNodes;
        int baseMaxQPS = 10000 * activeNodes;
        
        // 根据集群负载调整阈值
        double adjustmentFactor = 1.0;
        if (clusterLoad > 0.8) {
            adjustmentFactor = 0.7; // 高负载时降低阈值
        } else if (clusterLoad < 0.3) {
            adjustmentFactor = 1.3; // 低负载时提高阈值
        }
        
        int newMaxConcurrency = (int) (baseMaxConcurrency * adjustmentFactor);
        int newMaxQPS = (int) (baseMaxQPS * adjustmentFactor);
        
        // 确保阈值在合理范围内
        newMaxConcurrency = Math.max(100, Math.min(baseMaxConcurrency * 2, newMaxConcurrency));
        newMaxQPS = Math.max(1000, Math.min(baseMaxQPS * 2, newMaxQPS));
        
        // 单个请求的最大并发数限制
        int maxConcurrencyPerRequest = Math.max(50, newMaxConcurrency / 10);
        
        return new ClusterLimits(maxConcurrencyPerRequest, newMaxConcurrency);
    }
    
    // 集群限制配置
    private static class ClusterLimits {
        private final int maxConcurrencyPerRequest;
        private final int maxTotalConcurrency;
        
        public ClusterLimits(int maxConcurrencyPerRequest, int maxTotalConcurrency) {
            this.maxConcurrencyPerRequest = maxConcurrencyPerRequest;
            this.maxTotalConcurrency = maxTotalConcurrency;
        }
        
        public int getMaxConcurrencyPerRequest() { return maxConcurrencyPerRequest; }
        public int getMaxTotalConcurrency() { return maxTotalConcurrency; }
        
        @Override
        public String toString() {
            return "ClusterLimits{" +
                "maxConcurrencyPerRequest=" + maxConcurrencyPerRequest +
                ", maxTotalConcurrency=" + maxTotalConcurrency +
                '}';
        }
    }
}
```

## 容错与降级机制

### 集群故障处理

```java
// 集群故障处理器
@Component
public class ClusterFailureHandler {
    private final ClusterNodeManager nodeManager;
    private final FailoverStrategy failoverStrategy;
    private final CircuitBreaker circuitBreaker;
    private final ScheduledExecutorService recoveryScheduler;
    
    public ClusterFailureHandler(ClusterNodeManager nodeManager,
                               FailoverStrategy failoverStrategy,
                               CircuitBreaker circuitBreaker) {
        this.nodeManager = nodeManager;
        this.failoverStrategy = failoverStrategy;
        this.circuitBreaker = circuitBreaker;
        this.recoveryScheduler = Executors.newScheduledThreadPool(1);
    }
    
    public ClusterNodeManager.ClusterNode handleNodeFailure(
            String failedNodeId, String resource, int concurrency) {
        
        // 记录节点故障
        recordNodeFailure(failedNodeId);
        
        // 触发熔断器
        circuitBreaker.onError();
        
        // 执行故障转移
        return failoverStrategy.failover(failedNodeId, resource, concurrency);
    }
    
    private void recordNodeFailure(String nodeId) {
        // 记录节点故障信息
        log.warn("Node failure recorded: {}", nodeId);
        
        // 更新节点状态
        ClusterNodeManager.ClusterNode node = nodeManager.getNode(nodeId);
        if (node != null) {
            // 可以更新节点的故障状态
        }
    }
    
    public void startRecoveryProcess() {
        if (!circuitBreaker.canExecute()) {
            return;
        }
        
        // 启动恢复过程
        recoveryScheduler.schedule(this::attemptRecovery, 
            30, TimeUnit.SECONDS);
    }
    
    private void attemptRecovery() {
        try {
            // 执行健康检查
            boolean isHealthy = performHealthCheck();
            
            if (isHealthy) {
                // 恢复成功
                circuitBreaker.onSuccess();
                log.info("Cluster recovery successful");
            } else {
                // 恢复失败，继续熔断
                circuitBreaker.onError();
                log.warn("Cluster recovery failed, remaining in failure state");
                
                // 重新调度恢复尝试
                startRecoveryProcess();
            }
        } catch (Exception e) {
            log.error("Error during cluster recovery attempt", e);
            circuitBreaker.onError();
            startRecoveryProcess();
        }
    }
    
    private boolean performHealthCheck() {
        // 执行集群健康检查
        List<ClusterNodeManager.ClusterNode> activeNodes = nodeManager.getActiveNodes();
        if (activeNodes.isEmpty()) {
            return false;
        }
        
        // 检查大多数节点是否健康
        long healthyNodes = activeNodes.stream()
            .filter(this::isNodeHealthy)
            .count();
        
        return healthyNodes >= activeNodes.size() * 0.5;
    }
    
    private boolean isNodeHealthy(ClusterNodeManager.ClusterNode node) {
        // 检查节点是否健康
        return System.currentTimeMillis() - node.getLastHeartbeatTime() < 30000; // 30秒内有心跳
    }
    
    // 故障转移策略
    public static class FailoverStrategy {
        private final ClusterNodeManager nodeManager;
        private final WeightedRoundRobinBalancer loadBalancer;
        
        public FailoverStrategy(ClusterNodeManager nodeManager,
                              WeightedRoundRobinBalancer loadBalancer) {
            this.nodeManager = nodeManager;
            this.loadBalancer = loadBalancer;
        }
        
        public ClusterNodeManager.ClusterNode failover(String failedNodeId, 
                                                     String resource, 
                                                     int concurrency) {
            // 获取除故障节点外的其他活跃节点
            List<ClusterNodeManager.ClusterNode> candidateNodes = 
                nodeManager.getActiveNodes().stream()
                    .filter(node -> !node.getNodeId().equals(failedNodeId))
                    .collect(Collectors.toList());
            
            if (candidateNodes.isEmpty()) {
                return null;
            }
            
            // 使用负载均衡器选择节点
            return loadBalancer.selectNode(resource);
        }
    }
}
```

## 监控与告警

### 集群指标收集

```java
// 集群指标收集器
@Component
public class ClusterMetricsCollector {
    private final MeterRegistry meterRegistry;
    private final ClusterNodeManager nodeManager;
    private final Map<String, Gauge> clusterGauges = new ConcurrentHashMap<>();
    
    public ClusterMetricsCollector(MeterRegistry meterRegistry,
                                 ClusterNodeManager nodeManager) {
        this.meterRegistry = meterRegistry;
        this.nodeManager = nodeManager;
    }
    
    @PostConstruct
    public void initClusterMetrics() {
        // 注册集群指标
        registerClusterGauges();
    }
    
    private void registerClusterGauges() {
        // 集群节点数
        Gauge.builder("cluster.nodes.count")
            .description("Number of active nodes in the cluster")
            .register(meterRegistry, nodeManager, nm -> nm.getActiveNodeCount());
        
        // 集群总并发数
        Gauge.builder("cluster.concurrency.total")
            .description("Total concurrency across all nodes in the cluster")
            .register(meterRegistry, this, cmc -> calculateTotalConcurrency());
        
        // 集群总QPS
        Gauge.builder("cluster.qps.total")
            .description("Total QPS across all nodes in the cluster")
            .register(meterRegistry, this, cmc -> calculateTotalQPS());
        
        // 集群平均负载
        Gauge.builder("cluster.load.average")
            .description("Average load across all nodes in the cluster")
            .register(meterRegistry, this, cmc -> calculateAverageLoad());
    }
    
    private long calculateTotalConcurrency() {
        return nodeManager.getActiveNodes().stream()
            .mapToLong(ClusterNodeManager.ClusterNode::getCurrentConcurrency)
            .sum();
    }
    
    private int calculateTotalQPS() {
        return nodeManager.getActiveNodes().stream()
            .mapToInt(ClusterNodeManager.ClusterNode::getCurrentQPS)
            .sum();
    }
    
    private double calculateAverageLoad() {
        List<ClusterNodeManager.ClusterNode> nodes = nodeManager.getActiveNodes();
        if (nodes.isEmpty()) {
            return 0.0;
        }
        
        double totalLoad = nodes.stream()
            .mapToDouble(node -> (double) node.getCurrentConcurrency() / 
                               node.getNodeInfo().getMaxConcurrency())
            .sum();
        
        return totalLoad / nodes.size();
    }
    
    public void recordClusterFlowControl(String resource, int concurrency, boolean allowed) {
        // 记录集群流量控制指标
        Counter.builder("cluster.flow.control.requests")
            .tag("resource", resource)
            .tag("allowed", String.valueOf(allowed))
            .register(meterRegistry)
            .increment();
        
        if (allowed) {
            Timer.builder("cluster.flow.control.duration")
                .tag("resource", resource)
                .register(meterRegistry)
                .record(concurrency, TimeUnit.MILLISECONDS);
        }
    }
}
```

### 告警规则配置

```yaml
# 集群流量控制告警规则
alerting:
  rules:
    - name: "Cluster Concurrency High"
      metric: "cluster.concurrency.total"
      condition: "value > 8000"
      duration: "1m"
      severity: "warning"
      message: "Cluster total concurrency is high: {{value}}"
      
    - name: "Cluster Load Average High"
      metric: "cluster.load.average"
      condition: "value > 0.8"
      duration: "2m"
      severity: "critical"
      message: "Cluster average load is high: {{value}}"
      
    - name: "Low Cluster Node Count"
      metric: "cluster.nodes.count"
      condition: "value < 3"
      duration: "5m"
      severity: "critical"
      message: "Cluster node count is low: {{value}} nodes"
      
    - name: "Cluster Flow Control Rejection"
      metric: "cluster.flow.control.requests"
      condition: "allowed == 'false' and rate(value[1m]) > 100"
      duration: "30s"
      severity: "warning"
      message: "High rate of cluster flow control rejections: {{value}}/sec"
```

通过以上实现，我们构建了一个完整的集群流量控制系统，能够精确控制整个集群的总并发量。该系统结合了全局令牌桶、加权轮询、自适应调整等关键技术，在保障集群稳定性的同时，实现了资源的最优利用。在实际应用中，需要根据具体业务场景调整参数和策略，以达到最佳的控制效果。