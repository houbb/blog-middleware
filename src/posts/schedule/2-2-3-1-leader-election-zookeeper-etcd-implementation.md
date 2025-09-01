---
title: 4.1 基于 ZooKeeper/etcd 的 Leader 选举实现
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式系统中，Leader 选举是一个核心概念，它确保在多个节点中只有一个节点承担特定的职责，如任务调度、数据写入等。这种机制可以避免多个节点同时执行相同操作导致的数据不一致问题。ZooKeeper 和 etcd 是两种常用的分布式协调服务，它们都提供了实现 Leader 选举的机制。本文将深入探讨如何基于 ZooKeeper 和 etcd 实现 Leader 选举，并分析它们的优缺点。

## Leader 选举的核心概念

Leader 选举是分布式系统中一种重要的协调机制，用于在多个节点中选出一个主节点来协调任务。理解其核心概念对于实现可靠的分布式调度系统至关重要。

### 为什么需要 Leader 选举

```java
// Leader 选举的价值分析
public class LeaderElectionValue {
    
    /*
     * Leader 选举的核心价值：
     * 1. 避免脑裂 - 确保同一时刻只有一个节点承担主节点职责
     * 2. 数据一致性 - 防止多个节点同时修改共享数据
     * 3. 任务协调 - 统一协调分布式任务的执行
     * 4. 故障恢复 - 主节点故障时自动选举新主节点
     * 5. 负载均衡 - 合理分配系统负载
     */
    
    // Leader 选举的应用场景
    public void electionScenarios() {
        System.out.println("Leader 选举的应用场景:");
        System.out.println("1. 分布式任务调度 - 确保只有一个调度器在工作");
        System.out.println("2. 数据库主从切换 - 确保只有一个主数据库");
        System.out.println("3. 分布式锁服务 - 确保锁服务的高可用");
        System.out.println("4. 配置管理 - 确保配置更新的一致性");
        System.out.println("5. 服务注册发现 - 确保服务注册中心的可用性");
    }
}
```

### Leader 选举的基本要求

```java
// Leader 选举的基本要求
public class LeaderElectionRequirements {
    
    /*
     * Leader 选举需要满足的基本要求：
     * 1. 安全性 - 同一时刻最多只能有一个 Leader
     * 2. 活性 - 当前 Leader 失效时能快速选举出新 Leader
     * 3. 一致性 - 所有节点对 Leader 的认知保持一致
     * 4. 容错性 - 能容忍部分节点失效
     * 5. 高效性 - 选举过程快速且资源消耗少
     */
    
    // Leader 状态枚举
    public enum LeaderState {
        LEADER("Leader节点"),      // 主节点
        FOLLOWER("Follower节点"),  // 从节点
        CANDIDATE("候选节点"),     // 候选节点
        UNKNOWN("未知状态");       // 未知状态
        
        private final String description;
        
        LeaderState(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
    
    // 节点信息
    public class NodeInfo {
        private String nodeId;           // 节点ID
        private String address;          // 节点地址
        private int port;               // 端口
        private LeaderState state;       // 节点状态
        private long lastHeartbeatTime;  // 最后心跳时间
        private int priority;           // 优先级
        
        // 构造函数
        public NodeInfo(String nodeId, String address, int port) {
            this.nodeId = nodeId;
            this.address = address;
            this.port = port;
            this.state = LeaderState.UNKNOWN;
            this.lastHeartbeatTime = System.currentTimeMillis();
            this.priority = 0;
        }
        
        // Getters and Setters
        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        
        public LeaderState getState() { return state; }
        public void setState(LeaderState state) { this.state = state; }
        
        public long getLastHeartbeatTime() { return lastHeartbeatTime; }
        public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
        
        public int getPriority() { return priority; }
        public void setPriority(int priority) { this.priority = priority; }
        
        // 检查节点是否存活
        public boolean isAlive() {
            return System.currentTimeMillis() - lastHeartbeatTime < 30000; // 30秒内有心跳
        }
    }
}
```

## 基于 ZooKeeper 的 Leader 选举实现

ZooKeeper 是一个分布式的协调服务，提供了高可用性和强一致性保证。它通过 ZAB 协议实现数据一致性，是实现 Leader 选举的理想选择。

### ZooKeeper 选举原理

```java
// ZooKeeper Leader 选举实现
public class ZooKeeperLeaderElection {
    private final CuratorFramework curator;
    private final String electionPath;
    private final String nodeId;
    private final LeaderSelector leaderSelector;
    private final AtomicBoolean isLeader = new AtomicBoolean(false);
    
    public ZooKeeperLeaderElection(CuratorFramework curator, String electionPath, String nodeId) {
        this.curator = curator;
        this.electionPath = electionPath;
        this.nodeId = nodeId;
        
        // 创建 Leader 选举器
        this.leaderSelector = new LeaderSelector(curator, electionPath, new LeaderSelectorListener() {
            @Override
            public void takeLeadership(CuratorFramework client) throws Exception {
                // 当前节点成为 Leader
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
                    isLeader.set(false);
                }
            }
        });
        
        // 设置自动重新排队
        this.leaderSelector.autoRequeue();
    }
    
    // 启动选举
    public void start() {
        leaderSelector.start();
        System.out.println("ZooKeeper Leader 选举已启动: " + nodeId);
    }
    
    // 停止选举
    public void stop() {
        leaderSelector.close();
        System.out.println("ZooKeeper Leader 选举已停止: " + nodeId);
    }
    
    // 获取当前是否为 Leader
    public boolean isLeader() {
        return isLeader.get();
    }
    
    // 获取 Leader ID
    public String getLeaderId() {
        try {
            Participant leader = leaderSelector.getLeader();
            return leader.getId();
        } catch (Exception e) {
            throw new RuntimeException("获取 Leader 信息失败", e);
        }
    }
    
    // 当获得领导权时调用
    private void onLeadershipAcquired() {
        isLeader.set(true);
        System.out.println("节点成为 Leader: " + nodeId);
        
        // 在这里可以执行需要 Leader 身份的操作
        // 例如：启动任务调度器、开始数据写入等
    }
    
    // 当失去领导权时调用
    private void onLeadershipLost() {
        isLeader.set(false);
        System.out.println("节点失去 Leader 身份: " + nodeId);
        
        // 在这里可以执行失去 Leader 身份后的清理操作
        // 例如：停止任务调度器、关闭资源等
    }
}

// ZooKeeper 配置示例
class ZooKeeperConfig {
    public CuratorFramework createCuratorFramework() {
        // 创建 ZooKeeper 客户端
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "127.0.0.1:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        
        // 启动客户端
        curator.start();
        
        return curator;
    }
}
```

### 基于临时节点的选举实现

```java
// 基于临时节点的 ZooKeeper 选举实现
public class ZNodeBasedLeaderElection {
    private final CuratorFramework curator;
    private final String electionPath;
    private final String nodeId;
    private final String nodePath;
    private final PathChildrenCache childrenCache;
    private final AtomicBoolean isLeader = new AtomicBoolean(false);
    private final LeaderChangeListener listener;
    
    public ZNodeBasedLeaderElection(CuratorFramework curator, String electionPath, 
                                  String nodeId, LeaderChangeListener listener) {
        this.curator = curator;
        this.electionPath = electionPath;
        this.nodeId = nodeId;
        this.nodePath = electionPath + "/" + nodeId;
        this.listener = listener;
        
        // 创建子节点监听器
        this.childrenCache = new PathChildrenCache(curator, electionPath, true);
        this.childrenCache.getListenable().addListener(new PathChildrenCacheListener() {
            @Override
            public void childEvent(CuratorFramework client, PathChildrenCacheEvent event) throws Exception {
                switch (event.getType()) {
                    case CHILD_ADDED:
                    case CHILD_REMOVED:
                    case CHILD_UPDATED:
                        // 子节点变化时重新检查 Leader
                        checkLeader();
                        break;
                    default:
                        break;
                }
            }
        });
    }
    
    // 启动选举
    public void start() throws Exception {
        // 创建选举路径
        curator.create().creatingParentsIfNeeded().forPath(electionPath);
        
        // 启动子节点监听器
        childrenCache.start(PathChildrenCache.StartMode.BUILD_INITIAL_CACHE);
        
        // 创建临时顺序节点
        String createdPath = curator.create()
            .withMode(CreateMode.EPHEMERAL_SEQUENTIAL)
            .forPath(nodePath + "-", nodeId.getBytes());
        
        System.out.println("节点已注册: " + createdPath);
        
        // 检查是否成为 Leader
        checkLeader();
    }
    
    // 停止选举
    public void stop() throws Exception {
        childrenCache.close();
        System.out.println("ZooKeeper 节点选举已停止: " + nodeId);
    }
    
    // 检查 Leader
    private void checkLeader() throws Exception {
        // 获取所有子节点
        List<String> children = curator.getChildren().forPath(electionPath);
        
        if (children.isEmpty()) {
            return;
        }
        
        // 按节点序号排序
        children.sort(String::compareTo);
        
        // 获取最小序号的节点作为 Leader
        String leaderNode = children.get(0);
        
        // 检查当前节点是否为 Leader
        boolean wasLeader = isLeader.get();
        boolean newLeader = nodePath.substring(electionPath.length() + 1).startsWith(leaderNode);
        
        if (newLeader && !wasLeader) {
            // 成为 Leader
            isLeader.set(true);
            if (listener != null) {
                listener.onLeaderAcquired(nodeId);
            }
            System.out.println("节点成为 Leader: " + nodeId);
        } else if (!newLeader && wasLeader) {
            // 失去 Leader 身份
            isLeader.set(false);
            if (listener != null) {
                listener.onLeaderLost(nodeId);
            }
            System.out.println("节点失去 Leader 身份: " + nodeId);
        }
    }
    
    // 获取当前是否为 Leader
    public boolean isLeader() {
        return isLeader.get();
    }
    
    // Leader 变化监听器
    public interface LeaderChangeListener {
        void onLeaderAcquired(String nodeId);
        void onLeaderLost(String nodeId);
    }
}
```

## 基于 etcd 的 Leader 选举实现

etcd 是一个高可用的键值存储系统，常用于共享配置和服务发现。它提供了分布式锁和 Leader 选举功能，是实现 Leader 选举的另一种选择。

### etcd 选举原理

```java
// etcd Leader 选举实现
public class EtcdLeaderElection {
    private final Client etcdClient;
    private final String electionKey;
    private final String nodeId;
    private Lease lease;
    private volatile boolean isLeader = false;
    private final LeaderChangeListener listener;
    private final ScheduledExecutorService scheduler;
    
    public EtcdLeaderElection(Client etcdClient, String electionKey, String nodeId, 
                            LeaderChangeListener listener) {
        this.etcdClient = etcdClient;
        this.electionKey = electionKey;
        this.nodeId = nodeId;
        this.listener = listener;
        this.scheduler = Executors.newScheduledThreadPool(1);
    }
    
    // 启动选举
    public void start() {
        // 创建租约
        lease = etcdClient.getLeaseClient().grant(10).join();
        
        // 启动心跳续期
        scheduler.scheduleAtFixedRate(this::renewLease, 3, 3, TimeUnit.SECONDS);
        
        // 尝试成为 Leader
        tryBecomeLeader();
        
        System.out.println("etcd Leader 选举已启动: " + nodeId);
    }
    
    // 停止选举
    public void stop() {
        scheduler.shutdown();
        if (lease != null) {
            etcdClient.getLeaseClient().revoke(lease.getID()).join();
        }
        System.out.println("etcd Leader 选举已停止: " + nodeId);
    }
    
    // 尝试成为 Leader
    private void tryBecomeLeader() {
        try {
            // 尝试创建 Leader 键
            PutResponse response = etcdClient.getKVClient()
                .put(ByteSequence.from(electionKey, StandardCharsets.UTF_8),
                     ByteSequence.from(nodeId, StandardCharsets.UTF_8),
                     PutOption.newBuilder().withLease(lease.getID()).build())
                .get();
            
            if (response != null) {
                isLeader = true;
                if (listener != null) {
                    listener.onLeaderAcquired(nodeId);
                }
                System.out.println("节点成为 Leader: " + nodeId);
            }
        } catch (Exception e) {
            // 可能已经有其他节点成为 Leader
            isLeader = false;
            System.out.println("节点未能成为 Leader: " + nodeId);
        }
    }
    
    // 监听 Leader 变化
    public void watchLeaderChanges() {
        Watch.Listener listener = Watch.listener(response -> {
            for (WatchEvent event : response.getEvents()) {
                if (event.getEventType() == EventType.DELETE) {
                    // Leader 键被删除，尝试成为新 Leader
                    tryBecomeLeader();
                }
            }
        });
        
        // 开始监听
        etcdClient.getWatchClient().watch(
            ByteSequence.from(electionKey, StandardCharsets.UTF_8), listener);
    }
    
    // 续期租约
    private void renewLease() {
        try {
            if (lease != null) {
                etcdClient.getLeaseClient().keepAliveOnce(lease.getID()).join();
            }
        } catch (Exception e) {
            System.err.println("租约续期失败: " + e.getMessage());
        }
    }
    
    // 获取当前是否为 Leader
    public boolean isLeader() {
        return isLeader;
    }
    
    // Leader 变化监听器
    public interface LeaderChangeListener {
        void onLeaderAcquired(String nodeId);
        void onLeaderLost(String nodeId);
    }
}

// etcd 客户端配置示例
class EtcdConfig {
    public Client createEtcdClient() {
        // 创建 etcd 客户端
        Client client = Client.builder()
            .endpoints("http://127.0.0.1:2379")
            .build();
        
        return client;
    }
}
```

### 基于分布式锁的选举实现

```java
// 基于分布式锁的 etcd 选举实现
public class LockBasedEtcdElection {
    private final Client etcdClient;
    private final String lockKey;
    private final String nodeId;
    private Lock lock;
    private final AtomicBoolean isLeader = new AtomicBoolean(false);
    private final LeaderChangeListener listener;
    private final ScheduledExecutorService scheduler;
    
    public LockBasedEtcdElection(Client etcdClient, String lockKey, String nodeId,
                               LeaderChangeListener listener) {
        this.etcdClient = etcdClient;
        this.lockKey = lockKey;
        this.nodeId = nodeId;
        this.listener = listener;
        this.scheduler = Executors.newScheduledThreadPool(1);
    }
    
    // 启动选举
    public void start() {
        // 定期尝试获取锁
        scheduler.scheduleAtFixedRate(this::tryAcquireLock, 0, 5, TimeUnit.SECONDS);
        System.out.println("基于锁的 etcd 选举已启动: " + nodeId);
    }
    
    // 停止选举
    public void stop() {
        scheduler.shutdown();
        releaseLock();
        System.out.println("基于锁的 etcd 选举已停止: " + nodeId);
    }
    
    // 尝试获取锁
    private void tryAcquireLock() {
        try {
            if (lock == null) {
                // 创建锁
                lock = etcdClient.getLockClient().newLock(lockKey);
            }
            
            // 尝试获取锁，超时时间为 1 秒
            if (lock.tryLock(1, TimeUnit.SECONDS)) {
                if (!isLeader.get()) {
                    isLeader.set(true);
                    if (listener != null) {
                        listener.onLeaderAcquired(nodeId);
                    }
                    System.out.println("节点通过获取锁成为 Leader: " + nodeId);
                }
            } else {
                if (isLeader.get()) {
                    isLeader.set(false);
                    if (listener != null) {
                        listener.onLeaderLost(nodeId);
                    }
                    System.out.println("节点失去 Leader 身份: " + nodeId);
                }
            }
        } catch (Exception e) {
            System.err.println("获取锁时出错: " + e.getMessage());
            if (isLeader.get()) {
                isLeader.set(false);
                if (listener != null) {
                    listener.onLeaderLost(nodeId);
                }
            }
        }
    }
    
    // 释放锁
    private void releaseLock() {
        if (lock != null) {
            try {
                lock.unlock();
            } catch (Exception e) {
                System.err.println("释放锁时出错: " + e.getMessage());
            }
        }
    }
    
    // 获取当前是否为 Leader
    public boolean isLeader() {
        return isLeader.get();
    }
    
    // Leader 变化监听器
    public interface LeaderChangeListener {
        void onLeaderAcquired(String nodeId);
        void onLeaderLost(String nodeId);
    }
}
```

## 选举实现对比与选择

不同的选举实现方式各有优缺点，需要根据具体场景进行选择。

### 实现方式对比

```java
// 选举实现方式对比
public class ElectionComparison {
    
    /*
     * 不同选举实现方式的对比：
     * 
     * 1. ZooKeeper LeaderSelector:
     *    优点：实现简单，可靠性高，自动故障恢复
     *    缺点：依赖 ZooKeeper，增加系统复杂性
     *    适用场景：对一致性要求高的场景
     * 
     * 2. ZooKeeper 临时节点:
     *    优点：灵活性高，可以实现更复杂的选举逻辑
     *    缺点：实现复杂，需要处理更多边界情况
     *    适用场景：需要自定义选举策略的场景
     * 
     * 3. etcd 直接键值:
     *    优点：轻量级，易于集成
     *    缺点：需要手动处理租约和故障恢复
     *    适用场景：简单的主备模式
     * 
     * 4. etcd 分布式锁:
     *    优点：实现简单，语义清晰
     *    缺点：锁竞争可能影响性能
     *    适用场景：对性能要求不高的场景
     */
    
    // 性能对比表
    public void performanceComparison() {
        System.out.println("选举实现性能对比:");
        System.out.println("实现方式\t\t选举时间\t资源消耗\t可靠性");
        System.out.println("ZooKeeper Selector\t<1s\t\t中等\t\t高");
        System.out.println("ZooKeeper 节点\t\t<1s\t\t中等\t\t高");
        System.out.println("etcd 键值\t\t<1s\t\t低\t\t中等");
        System.out.println("etcd 锁\t\t\t<1s\t\t低\t\t中等");
    }
    
    // 选型建议
    public void selectionAdvice() {
        System.out.println("选举实现选型建议:");
        System.out.println("1. 如果系统已使用 ZooKeeper，推荐使用 LeaderSelector");
        System.out.println("2. 如果需要自定义选举逻辑，推荐使用临时节点方式");
        System.out.println("3. 如果系统已使用 etcd，推荐使用分布式锁方式");
        System.out.println("4. 如果对一致性要求极高，推荐使用 ZooKeeper");
        System.out.println("5. 如果追求轻量级实现，推荐使用 etcd");
    }
}
```

## 使用示例

让我们通过一个完整的示例来演示如何使用 Leader 选举：

```java
// Leader 选举使用示例
public class LeaderElectionExample {
    public static void main(String[] args) {
        try {
            // 模拟多个节点进行 Leader 选举
            simulateMultiNodeElection();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // 模拟多节点选举
    public static void simulateMultiNodeElection() throws Exception {
        // 创建 ZooKeeper 客户端
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "127.0.0.1:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        curator.start();
        
        // 确保连接成功
        curator.blockUntilConnected();
        
        // 选举路径
        String electionPath = "/scheduler/leader-election";
        
        // 创建多个节点
        List<ZooKeeperLeaderElection> nodes = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            String nodeId = "node-" + i;
            ZooKeeperLeaderElection election = new ZooKeeperLeaderElection(
                curator, electionPath, nodeId);
            nodes.add(election);
            
            // 启动选举
            election.start();
        }
        
        // 运行一段时间观察选举结果
        System.out.println("开始观察 Leader 选举结果...");
        Thread.sleep(10000);
        
        // 检查各节点状态
        for (ZooKeeperLeaderElection node : nodes) {
            System.out.println("节点 " + node.getClass().getSimpleName() + 
                             " 是否为 Leader: " + node.isLeader());
        }
        
        // 停止所有节点
        for (ZooKeeperLeaderElection node : nodes) {
            node.stop();
        }
        
        // 关闭 ZooKeeper 客户端
        curator.close();
    }
    
    // Leader 变化监听示例
    public static void leaderChangeListenerExample() throws Exception {
        // 创建 ZooKeeper 客户端
        CuratorFramework curator = CuratorFrameworkFactory.newClient(
            "127.0.0.1:2181", 
            new ExponentialBackoffRetry(1000, 3)
        );
        curator.start();
        curator.blockUntilConnected();
        
        // 选举路径
        String electionPath = "/scheduler/leader-election";
        String nodeId = "test-node";
        
        // 创建基于节点的选举
        ZNodeBasedLeaderElection election = new ZNodeBasedLeaderElection(
            curator, electionPath, nodeId, new ZNodeBasedLeaderElection.LeaderChangeListener() {
                @Override
                public void onLeaderAcquired(String nodeId) {
                    System.out.println("节点 " + nodeId + " 成为 Leader");
                    // 在这里可以启动需要 Leader 身份的服务
                }
                
                @Override
                public void onLeaderLost(String nodeId) {
                    System.out.println("节点 " + nodeId + " 失去 Leader 身份");
                    // 在这里可以停止需要 Leader 身份的服务
                }
            });
        
        // 启动选举
        election.start();
        
        // 运行一段时间
        Thread.sleep(30000);
        
        // 停止选举
        election.stop();
        curator.close();
    }
}
```

## 最佳实践与注意事项

在实际应用中，需要注意以下最佳实践：

```java
// Leader 选举最佳实践
public class LeaderElectionBestPractices {
    
    // 1. 心跳机制
    public void heartbeatMechanism() {
        System.out.println("心跳机制最佳实践:");
        System.out.println("1. 设置合理的心跳间隔，避免网络抖动");
        System.out.println("2. 实现心跳超时检测机制");
        System.out.println("3. 心跳信息应包含节点状态和负载信息");
    }
    
    // 2. 故障恢复
    public void faultRecovery() {
        System.out.println("故障恢复最佳实践:");
        System.out.println("1. 实现快速故障检测机制");
        System.out.println("2. 确保故障节点能自动重新加入集群");
        System.out.println("3. 避免脑裂现象的发生");
    }
    
    // 3. 性能优化
    public void performanceOptimization() {
        System.out.println("性能优化最佳实践:");
        System.out.println("1. 减少选举过程中的网络通信");
        System.out.println("2. 合理设置超时时间");
        System.out.println("3. 使用连接池管理协调服务连接");
    }
    
    // 4. 监控告警
    public void monitoringAlerting() {
        System.out.println("监控告警最佳实践:");
        System.out.println("1. 监控选举过程和结果");
        System.out.println("2. 记录 Leader 变更历史");
        System.out.println("3. 设置选举失败告警");
        System.out.println("4. 监控节点健康状态");
    }
    
    // 5. 安全考虑
    public void securityConsiderations() {
        System.out.println("安全考虑:");
        System.out.println("1. 对协调服务进行认证和授权");
        System.out.println("2. 加密节点间通信");
        System.out.println("3. 防止恶意节点干扰选举过程");
    }
}
```

## 总结

通过本文的实现，我们深入了解了基于 ZooKeeper 和 etcd 的 Leader 选举实现方式：

1. **核心概念**：理解了 Leader 选举的价值和基本要求
2. **ZooKeeper 实现**：学习了基于 LeaderSelector 和临时节点的选举实现
3. **etcd 实现**：掌握了基于键值存储和分布式锁的选举方式
4. **实现对比**：分析了不同实现方式的优缺点和适用场景
5. **最佳实践**：总结了在实际应用中需要注意的关键点

Leader 选举是构建高可用分布式系统的关键技术之一。在实际应用中，需要根据具体的业务场景和技术栈选择合适的实现方式，并遵循最佳实践来确保系统的稳定性和可靠性。

在下一节中，我们将探讨如何实现任务分片和负载均衡，进一步提升分布式调度系统的性能和可扩展性。