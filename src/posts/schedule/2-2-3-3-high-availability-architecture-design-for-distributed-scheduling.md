---
title: 4.3 分布式调度系统的高可用架构设计
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

高可用性是分布式任务调度系统的核心要求之一。在生产环境中，调度系统必须能够持续稳定地运行，即使在部分组件发生故障的情况下也能保证任务的正常执行。本文将深入探讨如何设计高可用的分布式调度系统架构，包括主备切换、负载均衡、数据复制、故障隔离等关键技术。

## 高可用架构的核心概念

高可用架构设计是确保系统在各种故障场景下仍能提供服务的关键。理解其核心概念对于构建可靠的分布式调度系统至关重要。

### 高可用性的定义与指标

```java
// 高可用性定义与指标
public class HighAvailabilityConcepts {
    
    /*
     * 高可用性的核心定义：
     * 高可用性（High Availability）是指系统在面对各种故障时仍能持续提供服务的能力。
     * 通常用可用性百分比来衡量，如 99.9%、99.99% 等。
     */
    
    // 可用性等级与停机时间
    public void availabilityLevels() {
        System.out.println("可用性等级与年停机时间:");
        System.out.println("99% (2个9)    - 3.65天");
        System.out.println("99.9% (3个9)  - 8.76小时");
        System.out.println("99.99% (4个9) - 52.56分钟");
        System.out.println("99.999% (5个9) - 5.26分钟");
    }
    
    // 高可用架构设计原则
    public class HA DesignPrinciples {
        
        /*
         * 高可用架构设计的核心原则：
         * 1. 冗余设计 - 消除单点故障
         * 2. 故障隔离 - 防止故障扩散
         * 3. 快速恢复 - 缩短故障恢复时间
         * 4. 负载均衡 - 合理分配系统负载
         * 5. 监控告警 - 及时发现和处理问题
         */
        
        // 冗余设计策略
        public void redundancyStrategies() {
            System.out.println("冗余设计策略:");
            System.out.println("1. 硬件冗余 - 多台服务器、网络设备");
            System.out.println("2. 软件冗余 - 多个服务实例");
            System.out.println("3. 数据冗余 - 多副本存储");
            System.out.println("4. 网络冗余 - 多条网络链路");
        }
        
        // 故障隔离策略
        public void faultIsolationStrategies() {
            System.out.println("故障隔离策略:");
            System.out.println("1. 服务隔离 - 不同服务独立部署");
            System.out.println("2. 数据隔离 - 不同数据独立存储");
            System.out.println("3. 网络隔离 - 不同网络分区");
            System.out.println("4. 资源隔离 - 不同资源独立分配");
        }
    }
    
    // 高可用性指标
    public class AvailabilityMetrics {
        private double availability;          // 可用性百分比
        private long uptime;                 // 运行时间(秒)
        private long downtime;               // 停机时间(秒)
        private int failureCount;            // 故障次数
        private double mtbf;                 // 平均故障间隔时间
        private double mttr;                 // 平均修复时间
        
        // 计算可用性
        public double calculateAvailability() {
            if (uptime + downtime == 0) return 0;
            return (double) uptime / (uptime + downtime) * 100;
        }
        
        // 计算 MTBF
        public double calculateMTBF() {
            if (failureCount == 0) return 0;
            return (double) uptime / failureCount;
        }
        
        // 计算 MTTR
        public double calculateMTTR() {
            if (failureCount == 0) return 0;
            return (double) downtime / failureCount;
        }
        
        // Getters and Setters
        public double getAvailability() { return availability; }
        public void setAvailability(double availability) { this.availability = availability; }
        
        public long getUptime() { return uptime; }
        public void setUptime(long uptime) { this.uptime = uptime; }
        
        public long getDowntime() { return downtime; }
        public void setDowntime(long downtime) { this.downtime = downtime; }
        
        public int getFailureCount() { return failureCount; }
        public void setFailureCount(int failureCount) { this.failureCount = failureCount; }
        
        public double getMtbf() { return mtbf; }
        public void setMtbf(double mtbf) { this.mtbf = mtbf; }
        
        public double getMttr() { return mttr; }
        public void setMttr(double mttr) { this.mttr = mttr; }
    }
}
```

### 高可用调度系统的架构组件

```java
// 高可用调度系统架构组件
public class HA ArchitectureComponents {
    
    /*
     * 高可用调度系统的核心组件：
     * 1. 调度中心集群 - 负责任务调度和管理
     * 2. 执行节点集群 - 负责任务执行
     * 3. 存储集群 - 负责数据存储
     * 4. 负载均衡器 - 负责流量分发
     * 5. 监控告警系统 - 负责系统监控
     */
    
    // 调度中心集群
    public class SchedulerCluster {
        private List<SchedulerNode> nodes;           // 调度节点列表
        private LoadBalancer loadBalancer;           // 负载均衡器
        private LeaderElectionService leaderElection; // Leader选举服务
        private HealthCheckService healthCheck;      // 健康检查服务
        
        // 获取活跃节点
        public List<SchedulerNode> getActiveNodes() {
            return nodes.stream()
                .filter(SchedulerNode::isActive)
                .collect(Collectors.toList());
        }
        
        // 获取Leader节点
        public SchedulerNode getLeaderNode() {
            return nodes.stream()
                .filter(SchedulerNode::isLeader)
                .findFirst()
                .orElse(null);
        }
        
        // 故障转移
        public void failover() {
            // 实现故障转移逻辑
            System.out.println("执行调度中心故障转移");
        }
    }
    
    // 执行节点集群
    public class ExecutorCluster {
        private List<ExecutorNode> nodes;            // 执行节点列表
        private TaskAssignmentService taskAssignment; // 任务分配服务
        private ResourceMonitoringService resourceMonitor; // 资源监控服务
        
        // 获取可用节点
        public List<ExecutorNode> getAvailableNodes() {
            return nodes.stream()
                .filter(ExecutorNode::isAvailable)
                .collect(Collectors.toList());
        }
        
        // 负载均衡分配任务
        public ExecutorNode assignTask(Task task) {
            // 实现负载均衡算法
            return getAvailableNodes().stream()
                .min(Comparator.comparing(ExecutorNode::getTaskCount))
                .orElse(null);
        }
    }
    
    // 存储集群
    public class StorageCluster {
        private List<StorageNode> nodes;             // 存储节点列表
        private DataReplicationService replication;   // 数据复制服务
        private ConsistencyService consistency;       // 一致性服务
        
        // 获取健康节点
        public List<StorageNode> getHealthyNodes() {
            return nodes.stream()
                .filter(StorageNode::isHealthy)
                .collect(Collectors.toList());
        }
        
        // 数据复制
        public void replicateData(Data data) {
            // 实现数据复制逻辑
            List<StorageNode> healthyNodes = getHealthyNodes();
            for (StorageNode node : healthyNodes) {
                node.storeData(data);
            }
        }
    }
}
```

## 主备切换机制

主备切换是实现高可用性的关键技术之一，当主节点发生故障时，备用节点能够快速接管服务。

### 基于 ZooKeeper 的主备切换

```java
// 基于 ZooKeeper 的主备切换实现
public class ZooKeeperBasedFailover {
    private final CuratorFramework curator;
    private final String failoverPath;
    private final String nodeId;
    private final LeaderSelector leaderSelector;
    private final AtomicBoolean isLeader = new AtomicBoolean(false);
    private final FailoverListener failoverListener;
    
    public ZooKeeperBasedFailover(CuratorFramework curator, String failoverPath, 
                                String nodeId, FailoverListener listener) {
        this.curator = curator;
        this.failoverPath = failoverPath;
        this.nodeId = nodeId;
        this.failoverListener = listener;
        
        // 创建 Leader 选举器
        this.leaderSelector = new LeaderSelector(curator, failoverPath, 
            new LeaderSelectorListener() {
                @Override
                public void takeLeadership(CuratorFramework client) throws Exception {
                    // 当前节点成为 Leader（主节点）
                    onLeadershipAcquired();
                    
                    // 保持 Leader 状态直到显式释放
                    try {
                        Thread.currentThread().join();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        onLeadershipLost();
                    }
                }
                
                @Override
                public void stateChanged(CuratorFramework client, ConnectionState newState) {
                    // 连接状态变化处理
                    if (newState == ConnectionState.LOST || newState == ConnectionState.SUSPENDED) {
                        // 连接丢失或挂起时，可能失去 Leader 身份
                        if (isLeader.compareAndSet(true, false)) {
                            if (failoverListener != null) {
                                failoverListener.onFailover(nodeId, false);
                            }
                        }
                    }
                }
            });
        
        // 设置自动重新排队
        this.leaderSelector.autoRequeue();
    }
    
    // 启动主备切换服务
    public void start() {
        leaderSelector.start();
        System.out.println("ZooKeeper 主备切换服务已启动: " + nodeId);
    }
    
    // 停止主备切换服务
    public void stop() {
        leaderSelector.close();
        System.out.println("ZooKeeper 主备切换服务已停止: " + nodeId);
    }
    
    // 获取当前是否为 Leader（主节点）
    public boolean isLeader() {
        return isLeader.get();
    }
    
    // 当获得领导权时调用（成为主节点）
    private void onLeadershipAcquired() {
        if (isLeader.compareAndSet(false, true)) {
            System.out.println("节点成为主节点: " + nodeId);
            
            // 启动主节点服务
            startMasterServices();
            
            // 通知监听器
            if (failoverListener != null) {
                failoverListener.onFailover(nodeId, true);
            }
        }
    }
    
    // 当失去领导权时调用（不再是主节点）
    private void onLeadershipLost() {
        if (isLeader.compareAndSet(true, false)) {
            System.out.println("节点失去主节点身份: " + nodeId);
            
            // 停止主节点服务
            stopMasterServices();
            
            // 通知监听器
            if (failoverListener != null) {
                failoverListener.onFailover(nodeId, false);
            }
        }
    }
    
    // 启动主节点服务
    private void startMasterServices() {
        // 启动调度服务
        // 启动管理服务
        // 启动监控服务
        System.out.println("主节点服务已启动: " + nodeId);
    }
    
    // 停止主节点服务
    private void stopMasterServices() {
        // 停止调度服务
        // 停止管理服务
        // 停止监控服务
        System.out.println("主节点服务已停止: " + nodeId);
    }
    
    // 主备切换监听器
    public interface FailoverListener {
        void onFailover(String nodeId, boolean isLeader);
    }
}

// ZooKeeper 配置示例
class ZooKeeperConfig {
    public CuratorFramework createCuratorFramework() {
        // 创建 ZooKeeper 客户端
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "zk1:2181,zk2:2181,zk3:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        
        // 启动客户端
        curator.start();
        
        return curator;
    }
}
```

### 基于数据库的主备切换

```java
// 基于数据库的主备切换实现
public class DatabaseBasedFailover {
    private final DataSource dataSource;
    private final String nodeId;
    private final String serviceName;
    private final ScheduledExecutorService failoverScheduler;
    private final FailoverListener failoverListener;
    private final long heartbeatInterval;
    private final long failoverTimeout;
    private volatile boolean isMaster = false;
    private volatile long lastHeartbeatTime;
    
    public DatabaseBasedFailover(DataSource dataSource, String serviceName, 
                               String nodeId, FailoverListener listener,
                               long heartbeatInterval, long failoverTimeout) {
        this.dataSource = dataSource;
        this.serviceName = serviceName;
        this.nodeId = nodeId;
        this.failoverListener = listener;
        this.heartbeatInterval = heartbeatInterval;
        this.failoverTimeout = failoverTimeout;
        this.failoverScheduler = Executors.newScheduledThreadPool(2);
        this.lastHeartbeatTime = System.currentTimeMillis();
    }
    
    // 启动主备切换服务
    public void start() {
        // 定期发送心跳
        failoverScheduler.scheduleAtFixedRate(this::sendHeartbeat,
            0, heartbeatInterval, TimeUnit.MILLISECONDS);
        
        // 定期检查主节点状态
        failoverScheduler.scheduleAtFixedRate(this::checkMasterStatus,
            heartbeatInterval, heartbeatInterval, TimeUnit.MILLISECONDS);
        
        System.out.println("数据库主备切换服务已启动: " + nodeId);
    }
    
    // 停止主备切换服务
    public void stop() {
        failoverScheduler.shutdown();
        try {
            if (!failoverScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                failoverScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            failoverScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        // 清理数据库中的节点信息
        cleanupNodeInfo();
        System.out.println("数据库主备切换服务已停止: " + nodeId);
    }
    
    // 发送心跳
    private void sendHeartbeat() {
        try {
            String sql = "INSERT INTO service_nodes (service_name, node_id, last_heartbeat, is_active) " +
                        "VALUES (?, ?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE last_heartbeat = ?, is_active = ?";
            
            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                
                Timestamp now = new Timestamp(System.currentTimeMillis());
                stmt.setString(1, serviceName);
                stmt.setString(2, nodeId);
                stmt.setTimestamp(3, now);
                stmt.setBoolean(4, true);
                stmt.setTimestamp(5, now);
                stmt.setBoolean(6, true);
                
                stmt.executeUpdate();
                lastHeartbeatTime = System.currentTimeMillis();
            }
        } catch (SQLException e) {
            System.err.println("发送心跳失败: " + e.getMessage());
        }
    }
    
    // 检查主节点状态
    private void checkMasterStatus() {
        try {
            // 获取当前主节点
            String currentMaster = getCurrentMaster();
            
            if (currentMaster == null) {
                // 没有主节点，尝试成为主节点
                tryBecomeMaster();
            } else if (currentMaster.equals(nodeId)) {
                // 当前节点是主节点
                if (!isMaster) {
                    isMaster = true;
                    onBecomeMaster();
                }
            } else {
                // 其他节点是主节点
                if (isMaster) {
                    isMaster = false;
                    onLoseMaster();
                }
                
                // 检查主节点是否存活
                if (!isMasterNodeAlive(currentMaster)) {
                    // 主节点失效，尝试成为新主节点
                    tryBecomeMaster();
                }
            }
        } catch (Exception e) {
            System.err.println("检查主节点状态失败: " + e.getMessage());
        }
    }
    
    // 获取当前主节点
    private String getCurrentMaster() throws SQLException {
        String sql = "SELECT node_id FROM service_nodes " +
                    "WHERE service_name = ? AND is_active = TRUE " +
                    "ORDER BY last_heartbeat DESC LIMIT 1";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, serviceName);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("node_id");
                }
            }
        }
        return null;
    }
    
    // 检查主节点是否存活
    private boolean isMasterNodeAlive(String masterNodeId) throws SQLException {
        String sql = "SELECT last_heartbeat FROM service_nodes " +
                    "WHERE node_id = ? AND service_name = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, masterNodeId);
            stmt.setString(2, serviceName);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    Timestamp lastHeartbeat = rs.getTimestamp("last_heartbeat");
                    long timeDiff = System.currentTimeMillis() - lastHeartbeat.getTime();
                    return timeDiff < failoverTimeout;
                }
            }
        }
        return false;
    }
    
    // 尝试成为主节点
    private void tryBecomeMaster() {
        try {
            String sql = "UPDATE service_nodes SET is_master = TRUE " +
                        "WHERE service_name = ? AND node_id = ? AND " +
                        "NOT EXISTS (SELECT 1 FROM service_nodes WHERE service_name = ? " +
                        "AND is_master = TRUE AND last_heartbeat > ?)";
            
            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                
                Timestamp timeoutThreshold = new Timestamp(
                    System.currentTimeMillis() - failoverTimeout);
                
                stmt.setString(1, serviceName);
                stmt.setString(2, nodeId);
                stmt.setString(3, serviceName);
                stmt.setTimestamp(4, timeoutThreshold);
                
                int updated = stmt.executeUpdate();
                if (updated > 0) {
                    // 成功成为主节点
                    if (!isMaster) {
                        isMaster = true;
                        onBecomeMaster();
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("尝试成为主节点失败: " + e.getMessage());
        }
    }
    
    // 当成为主节点时调用
    private void onBecomeMaster() {
        System.out.println("节点成为主节点: " + nodeId);
        
        // 启动主节点服务
        startMasterServices();
        
        // 通知监听器
        if (failoverListener != null) {
            failoverListener.onFailover(nodeId, true);
        }
    }
    
    // 当失去主节点身份时调用
    private void onLoseMaster() {
        System.out.println("节点失去主节点身份: " + nodeId);
        
        // 停止主节点服务
        stopMasterServices();
        
        // 通知监听器
        if (failoverListener != null) {
            failoverListener.onFailover(nodeId, false);
        }
    }
    
    // 启动主节点服务
    private void startMasterServices() {
        // 启动调度服务
        // 启动管理服务
        // 启动监控服务
        System.out.println("主节点服务已启动: " + nodeId);
    }
    
    // 停止主节点服务
    private void stopMasterServices() {
        // 停止调度服务
        // 停止管理服务
        // 停止监控服务
        System.out.println("主节点服务已停止: " + nodeId);
    }
    
    // 清理节点信息
    private void cleanupNodeInfo() {
        try {
            String sql = "UPDATE service_nodes SET is_active = FALSE " +
                        "WHERE service_name = ? AND node_id = ?";
            
            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                
                stmt.setString(1, serviceName);
                stmt.setString(2, nodeId);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("清理节点信息失败: " + e.getMessage());
        }
    }
    
    // 获取当前是否为主节点
    public boolean isMaster() {
        return isMaster;
    }
    
    // 主备切换监听器
    public interface FailoverListener {
        void onFailover(String nodeId, boolean isMaster);
    }
}

// 服务节点表结构
/*
CREATE TABLE service_nodes (
    service_name VARCHAR(64) NOT NULL COMMENT '服务名称',
    node_id VARCHAR(64) NOT NULL COMMENT '节点ID',
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后心跳时间',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否活跃',
    is_master BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否为主节点',
    PRIMARY KEY (service_name, node_id),
    INDEX idx_service_heartbeat (service_name, last_heartbeat),
    INDEX idx_service_master (service_name, is_master)
) COMMENT='服务节点表';
*/
```

## 负载均衡与故障隔离

负载均衡和故障隔离是实现高可用性的另外两个关键技术，能够提高系统的性能和稳定性。

### 负载均衡策略

```java
// 负载均衡策略接口
public interface LoadBalancingStrategy {
    /**
     * 选择执行节点
     * @param task 任务信息
     * @param nodes 可用节点列表
     * @return 选中的节点
     */
    ExecutorNode selectNode(Task task, List<ExecutorNode> nodes);
}

// 轮询负载均衡策略
public class RoundRobinLoadBalancingStrategy implements LoadBalancingStrategy {
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    
    @Override
    public ExecutorNode selectNode(Task task, List<ExecutorNode> nodes) {
        if (nodes.isEmpty()) {
            return null;
        }
        
        int index = Math.abs(currentIndex.getAndIncrement() % nodes.size());
        return nodes.get(index);
    }
}

// 最少连接数负载均衡策略
public class LeastConnectionsLoadBalancingStrategy implements LoadBalancingStrategy {
    
    @Override
    public ExecutorNode selectNode(Task task, List<ExecutorNode> nodes) {
        if (nodes.isEmpty()) {
            return null;
        }
        
        return nodes.stream()
            .min(Comparator.comparing(ExecutorNode::getTaskCount))
            .orElse(nodes.get(0));
    }
}

// 加权负载均衡策略
public class WeightedLoadBalancingStrategy implements LoadBalancingStrategy {
    
    @Override
    public ExecutorNode selectNode(Task task, List<ExecutorNode> nodes) {
        if (nodes.isEmpty()) {
            return null;
        }
        
        // 计算总权重
        int totalWeight = nodes.stream()
            .mapToInt(ExecutorNode::getWeight)
            .sum();
        
        if (totalWeight <= 0) {
            return nodes.get(0);
        }
        
        // 随机选择
        int random = new Random().nextInt(totalWeight);
        int currentWeight = 0;
        
        for (ExecutorNode node : nodes) {
            currentWeight += node.getWeight();
            if (random < currentWeight) {
                return node;
            }
        }
        
        return nodes.get(nodes.size() - 1);
    }
}

// 一致性哈希负载均衡策略
public class ConsistentHashLoadBalancingStrategy implements LoadBalancingStrategy {
    private final TreeMap<Integer, ExecutorNode> circle = new TreeMap<>();
    private final int numberOfReplicas = 160; // 虚拟节点数
    
    @Override
    public ExecutorNode selectNode(Task task, List<ExecutorNode> nodes) {
        if (nodes.isEmpty()) {
            return null;
        }
        
        // 构建一致性哈希环
        buildCircle(nodes);
        
        // 获取节点
        return getNode(task.getTaskId());
    }
    
    // 构建一致性哈希环
    private void buildCircle(List<ExecutorNode> nodes) {
        circle.clear();
        
        for (ExecutorNode node : nodes) {
            for (int i = 0; i < numberOfReplicas; i++) {
                String key = node.getNodeId() + ":" + i;
                int hash = hash(key);
                circle.put(hash, node);
            }
        }
    }
    
    // 获取节点
    private ExecutorNode getNode(String key) {
        if (circle.isEmpty()) {
            return null;
        }
        
        int hash = hash(key);
        SortedMap<Integer, ExecutorNode> tailMap = circle.tailMap(hash);
        Integer nodeHash = tailMap.isEmpty() ? circle.firstKey() : tailMap.firstKey();
        return circle.get(nodeHash);
    }
    
    // 简单哈希函数
    private int hash(String key) {
        return key.hashCode();
    }
}
```

### 故障隔离机制

```java
// 故障隔离服务
public class FaultIsolationService {
    private final Map<String, CircuitBreaker> circuitBreakers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService isolationScheduler;
    private final IsolationListener isolationListener;
    
    public FaultIsolationService(IsolationListener listener) {
        this.isolationListener = listener;
        this.isolationScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 启动故障隔离服务
    public void start() {
        // 定期检查熔断器状态
        isolationScheduler.scheduleAtFixedRate(this::checkCircuitBreakers,
            30, 30, TimeUnit.SECONDS);
        System.out.println("故障隔离服务已启动");
    }
    
    // 停止故障隔离服务
    public void stop() {
        isolationScheduler.shutdown();
        try {
            if (!isolationScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                isolationScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            isolationScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("故障隔离服务已停止");
    }
    
    // 获取熔断器
    public CircuitBreaker getCircuitBreaker(String serviceId) {
        return circuitBreakers.computeIfAbsent(serviceId, 
            k -> new CircuitBreaker(serviceId, isolationListener));
    }
    
    // 检查熔断器状态
    private void checkCircuitBreakers() {
        for (CircuitBreaker breaker : circuitBreakers.values()) {
            breaker.checkAndReset();
        }
    }
    
    // 故障隔离监听器
    public interface IsolationListener {
        void onCircuitOpen(String serviceId);
        void onCircuitClose(String serviceId);
    }
}

// 熔断器实现
public class CircuitBreaker {
    private final String serviceId;
    private final IsolationListener isolationListener;
    private volatile CircuitState state = CircuitState.CLOSED;
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicInteger successCount = new AtomicInteger(0);
    private volatile long lastFailureTime;
    private final int failureThreshold;
    private final int successThreshold;
    private final long timeout;
    
    public CircuitBreaker(String serviceId, IsolationListener listener) {
        this.serviceId = serviceId;
        this.isolationListener = listener;
        this.failureThreshold = 5;    // 失败阈值
        this.successThreshold = 10;   // 成功阈值
        this.timeout = 60000;         // 超时时间(毫秒)
    }
    
    // 执行受保护的操作
    public <T> T execute(Supplier<T> operation) throws Exception {
        // 检查熔断器状态
        if (state == CircuitState.OPEN) {
            long timeSinceFailure = System.currentTimeMillis() - lastFailureTime;
            if (timeSinceFailure > timeout) {
                // 半开状态，允许一次尝试
                state = CircuitState.HALF_OPEN;
                System.out.println("熔断器半开: " + serviceId);
            } else {
                throw new CircuitBreakerOpenException("熔断器已打开: " + serviceId);
            }
        }
        
        try {
            // 执行操作
            T result = operation.get();
            
            // 操作成功
            onSuccess();
            return result;
        } catch (Exception e) {
            // 操作失败
            onFailure();
            throw e;
        }
    }
    
    // 操作成功
    private void onSuccess() {
        if (state == CircuitState.HALF_OPEN) {
            // 半开状态下成功，关闭熔断器
            successCount.incrementAndGet();
            if (successCount.get() >= successThreshold) {
                close();
            }
        } else {
            // 重置失败计数
            failureCount.set(0);
            successCount.incrementAndGet();
        }
    }
    
    // 操作失败
    private void onFailure() {
        failureCount.incrementAndGet();
        lastFailureTime = System.currentTimeMillis();
        
        if (failureCount.get() >= failureThreshold) {
            open();
        }
    }
    
    // 打开熔断器
    private void open() {
        if (state != CircuitState.OPEN) {
            state = CircuitState.OPEN;
            System.out.println("熔断器打开: " + serviceId);
            if (isolationListener != null) {
                isolationListener.onCircuitOpen(serviceId);
            }
        }
    }
    
    // 关闭熔断器
    private void close() {
        if (state != CircuitState.CLOSED) {
            state = CircuitState.CLOSED;
            failureCount.set(0);
            successCount.set(0);
            System.out.println("熔断器关闭: " + serviceId);
            if (isolationListener != null) {
                isolationListener.onCircuitClose(serviceId);
            }
        }
    }
    
    // 检查并重置状态
    public void checkAndReset() {
        if (state == CircuitState.CLOSED) {
            // 定期重置计数器
            if (failureCount.get() > 0 || successCount.get() > 0) {
                failureCount.set(0);
                successCount.set(0);
            }
        }
    }
    
    // 熔断器状态枚举
    public enum CircuitState {
        CLOSED,   // 关闭状态
        OPEN,     // 打开状态
        HALF_OPEN // 半开状态
    }
    
    // 熔断器打开异常
    public static class CircuitBreakerOpenException extends Exception {
        public CircuitBreakerOpenException(String message) {
            super(message);
        }
    }
    
    // Getters
    public CircuitState getState() { return state; }
    public int getFailureCount() { return failureCount.get(); }
    public int getSuccessCount() { return successCount.get(); }
    public long getLastFailureTime() { return lastFailureTime; }
}
```

## 数据复制与一致性

在高可用架构中，数据的复制和一致性保证是关键环节。

### 多副本数据存储

```java
// 多副本数据存储服务
public class ReplicatedDataStore {
    private final List<DataNode> dataNodes;
    private final int replicationFactor;
    private final ConsistencyProtocol consistencyProtocol;
    private final ScheduledExecutorService replicationScheduler;
    
    public ReplicatedDataStore(List<DataNode> dataNodes, int replicationFactor,
                             ConsistencyProtocol protocol) {
        this.dataNodes = dataNodes;
        this.replicationFactor = replicationFactor;
        this.consistencyProtocol = protocol;
        this.replicationScheduler = Executors.newScheduledThreadPool(2);
    }
    
    // 启动数据存储服务
    public void start() {
        // 定期检查数据一致性
        replicationScheduler.scheduleAtFixedRate(this::checkDataConsistency,
            60, 300, TimeUnit.SECONDS);
        System.out.println("多副本数据存储服务已启动");
    }
    
    // 停止数据存储服务
    public void stop() {
        replicationScheduler.shutdown();
        try {
            if (!replicationScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                replicationScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            replicationScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("多副本数据存储服务已停止");
    }
    
    // 存储数据
    public boolean storeData(String key, Object data) {
        try {
            // 选择副本节点
            List<DataNode> replicaNodes = selectReplicaNodes(key);
            
            // 并行存储到多个节点
            List<CompletableFuture<Boolean>> futures = new ArrayList<>();
            for (DataNode node : replicaNodes) {
                CompletableFuture<Boolean> future = CompletableFuture.supplyAsync(() -> {
                    try {
                        return node.storeData(key, data);
                    } catch (Exception e) {
                        System.err.println("存储数据到节点失败: " + node.getNodeId() + 
                                         ", 错误: " + e.getMessage());
                        return false;
                    }
                });
                futures.add(future);
            }
            
            // 等待存储完成
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            try {
                allFutures.get(5, TimeUnit.SECONDS); // 5秒超时
                
                // 检查存储结果
                long successCount = futures.stream()
                    .mapToLong(f -> f.getNow(false) ? 1 : 0)
                    .sum();
                
                // 根据一致性协议判断是否成功
                return consistencyProtocol.isWriteSuccessful(successCount, replicaNodes.size());
            } catch (TimeoutException e) {
                System.err.println("存储数据超时: " + key);
                return false;
            }
        } catch (Exception e) {
            System.err.println("存储数据失败: " + key + ", 错误: " + e.getMessage());
            return false;
        }
    }
    
    // 读取数据
    public Object readData(String key) {
        try {
            // 选择读取节点
            List<DataNode> readNodes = selectReadNodes(key);
            
            // 并行从多个节点读取
            List<CompletableFuture<Object>> futures = new ArrayList<>();
            for (DataNode node : readNodes) {
                CompletableFuture<Object> future = CompletableFuture.supplyAsync(() -> {
                    try {
                        return node.readData(key);
                    } catch (Exception e) {
                        System.err.println("从节点读取数据失败: " + node.getNodeId() + 
                                         ", 错误: " + e.getMessage());
                        return null;
                    }
                });
                futures.add(future);
            }
            
            // 等待读取完成
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            try {
                allFutures.get(3, TimeUnit.SECONDS); // 3秒超时
                
                // 根据一致性协议选择合适的值
                List<Object> results = futures.stream()
                    .map(f -> f.getNow(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
                
                return consistencyProtocol.selectValue(results);
            } catch (TimeoutException e) {
                System.err.println("读取数据超时: " + key);
                return null;
            }
        } catch (Exception e) {
            System.err.println("读取数据失败: " + key + ", 错误: " + e.getMessage());
            return null;
        }
    }
    
    // 选择副本节点
    private List<DataNode> selectReplicaNodes(String key) {
        // 使用一致性哈希选择节点
        List<DataNode> availableNodes = dataNodes.stream()
            .filter(DataNode::isHealthy)
            .collect(Collectors.toList());
        
        if (availableNodes.size() < replicationFactor) {
            System.err.println("可用节点数不足，需要: " + replicationFactor + 
                             ", 实际: " + availableNodes.size());
        }
        
        // 简化实现，实际应用中可以使用一致性哈希算法
        return availableNodes.stream()
            .limit(replicationFactor)
            .collect(Collectors.toList());
    }
    
    // 选择读取节点
    private List<DataNode> selectReadNodes(String key) {
        // 优先选择本地节点，然后选择其他节点
        List<DataNode> availableNodes = dataNodes.stream()
            .filter(DataNode::isHealthy)
            .collect(Collectors.toList());
        
        // 简化实现，实际应用中可以考虑节点距离、负载等因素
        return availableNodes.stream()
            .limit(Math.min(3, availableNodes.size())) // 最多读取3个节点
            .collect(Collectors.toList());
    }
    
    // 检查数据一致性
    private void checkDataConsistency() {
        try {
            System.out.println("开始检查数据一致性");
            
            // 这里可以实现具体的检查逻辑
            // 例如：比较不同节点上的数据版本、校验和等
            
        } catch (Exception e) {
            System.err.println("检查数据一致性时出错: " + e.getMessage());
        }
    }
}

// 数据节点接口
interface DataNode {
    String getNodeId();
    boolean isHealthy();
    boolean storeData(String key, Object data) throws Exception;
    Object readData(String key) throws Exception;
}

// 一致性协议接口
interface ConsistencyProtocol {
    boolean isWriteSuccessful(long successCount, long totalCount);
    Object selectValue(List<Object> values);
}

// 强一致性协议实现
class StrongConsistencyProtocol implements ConsistencyProtocol {
    
    @Override
    public boolean isWriteSuccessful(long successCount, long totalCount) {
        // 要求所有节点都写入成功
        return successCount == totalCount;
    }
    
    @Override
    public Object selectValue(List<Object> values) {
        if (values.isEmpty()) {
            return null;
        }
        
        // 检查所有值是否一致
        Object firstValue = values.get(0);
        for (Object value : values) {
            if (!Objects.equals(firstValue, value)) {
                throw new InconsistentDataException("数据不一致");
            }
        }
        
        return firstValue;
    }
}

// 最终一致性协议实现
class EventualConsistencyProtocol implements ConsistencyProtocol {
    
    @Override
    public boolean isWriteSuccessful(long successCount, long totalCount) {
        // 要求大多数节点写入成功
        return successCount > totalCount / 2;
    }
    
    @Override
    public Object selectValue(List<Object> values) {
        if (values.isEmpty()) {
            return null;
        }
        
        // 返回最新的值或多数派的值
        return values.get(0);
    }
}

// 数据不一致异常
class InconsistentDataException extends RuntimeException {
    public InconsistentDataException(String message) {
        super(message);
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示高可用架构设计：

```java
// 高可用架构设计使用示例
public class HighAvailabilityExample {
    public static void main(String[] args) {
        try {
            // 模拟高可用调度系统
            simulateHighAvailabilitySystem();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 模拟高可用调度系统
    public static void simulateHighAvailabilitySystem() throws Exception {
        // 创建 ZooKeeper 客户端
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "zk1:2181,zk2:2181,zk3:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        curator.start();
        curator.blockUntilConnected();
        
        // 创建多个调度节点
        List<SchedulerNode> schedulerNodes = new ArrayList<>();
        List<ZooKeeperBasedFailover> failoverServices = new ArrayList<>();
        
        for (int i = 1; i <= 3; i++) {
            String nodeId = "scheduler-" + i;
            
            // 创建调度节点
            SchedulerNode schedulerNode = new SchedulerNode(nodeId);
            schedulerNodes.add(schedulerNode);
            
            // 创建主备切换服务
            ZooKeeperBasedFailover failover = new ZooKeeperBasedFailover(
                curator, "/scheduler/failover", nodeId,
                new ZooKeeperBasedFailover.FailoverListener() {
                    @Override
                    public void onFailover(String nodeId, boolean isLeader) {
                        System.out.println("节点 " + nodeId + " 切换状态: " + 
                                         (isLeader ? "主节点" : "备节点"));
                    }
                });
            
            failoverServices.add(failover);
            
            // 启动主备切换服务
            failover.start();
        }
        
        // 运行一段时间观察主备切换效果
        System.out.println("开始观察主备切换效果...");
        Thread.sleep(30000);
        
        // 检查当前主节点
        for (int i = 0; i < failoverServices.size(); i++) {
            ZooKeeperBasedFailover failover = failoverServices.get(i);
            System.out.println("节点 " + failover.getClass().getSimpleName() + 
                             " 是否为主节点: " + failover.isLeader());
        }
        
        // 停止所有服务
        for (ZooKeeperBasedFailover failover : failoverServices) {
            failover.stop();
        }
        
        curator.close();
    }
}

// 调度节点实现
class SchedulerNode {
    private final String nodeId;
    private volatile boolean active = false;
    private volatile boolean leader = false;
    
    public SchedulerNode(String nodeId) {
        this.nodeId = nodeId;
    }
    
    // 激活节点
    public void activate() {
        this.active = true;
        System.out.println("调度节点激活: " + nodeId);
    }
    
    // 停用节点
    public void deactivate() {
        this.active = false;
        this.leader = false;
        System.out.println("调度节点停用: " + nodeId);
    }
    
    // 设置为 Leader
    public void setLeader(boolean leader) {
        this.leader = leader;
        System.out.println("调度节点 " + nodeId + " " + (leader ? "成为" : "失去") + " Leader");
    }
    
    // Getters
    public String getNodeId() { return nodeId; }
    public boolean isActive() { return active; }
    public boolean isLeader() { return leader; }
}
```

## 最佳实践与注意事项

在实际应用中，需要注意以下最佳实践：

```java
// 高可用架构最佳实践
public class HABestPractices {
    
    // 1. 架构设计
    public void architectureDesign() {
        System.out.println("架构设计最佳实践:");
        System.out.println("1. 采用微服务架构，服务间松耦合");
        System.out.println("2. 实现服务无状态化，便于水平扩展");
        System.out.println("3. 使用容器化部署，提高部署效率");
        System.out.println("4. 设计优雅降级方案，确保核心功能可用");
    }
    
    // 2. 数据保护
    public void dataProtection() {
        System.out.println("数据保护最佳实践:");
        System.out.println("1. 实现多副本数据存储");
        System.out.println("2. 定期备份重要数据");
        System.out.println("3. 使用事务保证数据一致性");
        System.out.println("4. 实现数据恢复机制");
    }
    
    // 3. 监控告警
    public void monitoringAlerting() {
        System.out.println("监控告警最佳实践:");
        System.out.println("1. 建立完善的监控指标体系");
        System.out.println("2. 设置合理的告警阈值");
        System.out.println("3. 实现多维度监控（应用、系统、网络等）");
        System.out.println("4. 建立故障响应流程");
    }
    
    // 4. 测试验证
    public void testingValidation() {
        System.out.println("测试验证最佳实践:");
        System.out.println("1. 定期进行故障演练");
        System.out.println("2. 实施混沌工程测试");
        System.out.println("3. 进行性能压力测试");
        System.out.println("4. 验证恢复流程的有效性");
    }
    
    // 5. 运维管理
    public void operationsManagement() {
        System.out.println("运维管理最佳实践:");
        System.out.println("1. 建立标准化运维流程");
        System.out.println("2. 实现自动化部署和升级");
        System.out.println("3. 建立完善的日志体系");
        System.out.println("4. 定期进行系统优化");
    }
}
```

## 总结

通过本文的实现，我们深入了解了分布式调度系统的高可用架构设计：

1. **核心概念**：理解了高可用性的定义、指标和设计原则
2. **主备切换**：学习了基于 ZooKeeper 和数据库的主备切换实现
3. **负载均衡**：掌握了多种负载均衡策略的实现方式
4. **故障隔离**：了解了熔断器模式在故障隔离中的应用
5. **数据复制**：学习了多副本数据存储和一致性保证机制

高可用架构设计是构建稳定可靠分布式系统的基础。在实际应用中，需要根据具体的业务场景和技术栈选择合适的实现方式，并遵循最佳实践来确保系统的稳定性和可靠性。

在下一节中，我们将探讨分布式调度系统的性能优化策略，进一步提升系统的处理能力和响应速度。