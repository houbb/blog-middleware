---
title: Redis Cluster原理与应用：构建高可用分布式缓存系统
date: 2025-08-30
categories: [Cache]
tags: [cache]
published: true
---

Redis Cluster是Redis官方提供的分布式解决方案，它通过分片机制实现了数据的分布式存储和高可用性。Redis Cluster不仅能够水平扩展Redis的存储容量和处理能力，还提供了自动故障转移和数据冗余等高级特性。本节将深入探讨Redis Cluster的原理、架构设计和实际应用。

## Redis Cluster概述

Redis Cluster是Redis 3.0版本引入的分布式解决方案，它通过哈希槽（Hash Slot）机制将数据分布到多个节点上，每个节点负责一部分数据。Redis Cluster具有以下核心特性：

1. **自动分片**：数据自动分布到多个节点
2. **高可用性**：支持主从复制和自动故障转移
3. **无中心架构**：去中心化设计，无单点故障
4. **线性扩展**：支持动态添加和删除节点
5. **客户端路由**：客户端直接与节点通信

## Redis Cluster核心原理

### 1. 哈希槽机制

Redis Cluster使用哈希槽（Hash Slot）来实现数据分片。整个集群共有16384个哈希槽，每个键通过CRC16算法计算出对应的哈希槽，然后根据哈希槽的分配情况确定数据存储在哪个节点。

```java
// 哈希槽计算示例
public class HashSlotCalculator {
    
    private static final int SLOT_COUNT = 16384;
    
    // 计算键对应的哈希槽
    public static int calculateSlot(String key) {
        // 提取键中的哈希标签（如果存在）
        String hashTag = extractHashTag(key);
        if (hashTag != null) {
            return CRC16.crc16(hashTag.getBytes()) % SLOT_COUNT;
        }
        return CRC16.crc16(key.getBytes()) % SLOT_COUNT;
    }
    
    // 提取哈希标签
    private static String extractHashTag(String key) {
        int start = key.indexOf('{');
        if (start != -1) {
            int end = key.indexOf('}', start);
            if (end != -1 && end > start + 1) {
                return key.substring(start + 1, end);
            }
        }
        return null;
    }
    
    // CRC16算法实现
    public static class CRC16 {
        private static final int[] CRC16_TABLE = new int[256];
        
        static {
            for (int i = 0; i < 256; i++) {
                int crc = i << 8;
                for (int j = 0; j < 8; j++) {
                    if ((crc & 0x8000) != 0) {
                        crc = (crc << 1) ^ 0x1021;
                    } else {
                        crc <<= 1;
                    }
                }
                CRC16_TABLE[i] = crc & 0xFFFF;
            }
        }
        
        public static int crc16(byte[] data) {
            int crc = 0;
            for (byte b : data) {
                crc = ((crc << 8) ^ CRC16_TABLE[((crc >> 8) ^ (b & 0xFF)) & 0xFF]) & 0xFFFF;
            }
            return crc;
        }
    }
    
    // 哈希槽分布示例
    public static void demonstrateSlotDistribution() {
        String[] keys = {"user:1001", "user:1002", "product:2001", "order:3001", 
                        "cart:{user:1001}", "wishlist:{user:1001}"};
        
        for (String key : keys) {
            int slot = calculateSlot(key);
            System.out.println("Key: " + key + " -> Slot: " + slot);
        }
    }
}
```

### 2. 节点间通信

Redis Cluster节点之间通过Gossip协议进行通信，交换集群状态信息。每个节点都维护着集群的完整视图，包括其他节点的状态、哈希槽分配情况等。

```java
// 节点间通信机制
public class ClusterNodeCommunication {
    
    /*
    Redis Cluster节点间通信特点：
    
    1. MEET消息：新节点加入集群时发送
    2. PING消息：定期发送，检查节点健康状态
    3. PONG消息：对PING消息的响应
    4. FAIL消息：标记节点为失败状态
    5. PUBLISH消息：发布订阅消息传播
    
    通信端口：
    - 客户端端口：6379（默认）
    - 集群总线端口：6379 + 10000 = 16379
    */
    
    // 节点状态枚举
    public enum NodeState {
        ONLINE,      // 在线
        FAIL,        // 故障
        PFAIL,       // 可能故障（疑似故障）
        HANDSHAKE    // 握手状态
    }
    
    // 集群节点信息
    public static class ClusterNode {
        private String nodeId;
        private String host;
        private int port;
        private int clusterBusPort;
        private Set<Integer> slots;
        private NodeState state;
        private long lastPingTime;
        private long lastPongTime;
        
        // 构造函数、getter、setter...
    }
    
    // Gossip消息类型
    public enum GossipMessageType {
        MEET, PING, PONG, FAIL, PUBLISH
    }
}
```

### 3. 故障检测与转移

Redis Cluster通过多个节点的投票机制来检测节点故障，并自动进行主从切换。

```java
// 故障检测与转移机制
public class ClusterFailoverMechanism {
    
    /*
    故障检测流程：
    1. 节点定期发送PING消息
    2. 超时未收到PONG响应标记为PFAIL
    3. 多个节点确认后标记为FAIL
    4. 触发故障转移流程
    
    故障转移流程：
    1. 从节点检测到主节点FAIL状态
    2. 从节点发起选举
    3. 获得多数票后成为新主节点
    4. 更新集群配置
    5. 通知客户端
    */
    
    // 故障检测参数
    public static class FailoverConfig {
        // 节点超时时间（毫秒）
        public static final int NODE_TIMEOUT = 15000;
        
        // 节点超时时间的放大因子
        public static final int NODE_TIMEOUT_SCALE = 2;
        
        // 故障转移超时时间
        public static final int FAILOVER_TIMEOUT = 60000;
        
        // 从节点优先级
        public static final int SLAVE_PRIORITY = 100;
    }
    
    // 故障状态检测
    public static class FailureDetection {
        private Map<String, Long> nodePingTimes;
        private Map<String, NodeFailureState> nodeFailureStates;
        
        public enum NodeFailureState {
            HEALTHY,     // 健康
            SUSPECTED,   // 疑似故障
            CONFIRMED    // 确认故障
        }
        
        // 检测节点状态
        public NodeFailureState checkNodeStatus(String nodeId) {
            Long lastPingTime = nodePingTimes.get(nodeId);
            if (lastPingTime == null) {
                return NodeFailureState.HEALTHY;
            }
            
            long currentTime = System.currentTimeMillis();
            long timeSinceLastPing = currentTime - lastPingTime;
            
            if (timeSinceLastPing > FailoverConfig.NODE_TIMEOUT) {
                // 检查是否有其他节点也报告该节点故障
                int failureReports = getFailureReports(nodeId);
                int totalNodes = getTotalNodes();
                
                // 如果超过一半节点报告故障，则确认故障
                if (failureReports > totalNodes / 2) {
                    return NodeFailureState.CONFIRMED;
                } else {
                    return NodeFailureState.SUSPECTED;
                }
            }
            
            return NodeFailureState.HEALTHY;
        }
        
        private int getFailureReports(String nodeId) {
            // 获取其他节点对该节点的故障报告数量
            return 0; // 简化实现
        }
        
        private int getTotalNodes() {
            // 获取集群总节点数
            return 0; // 简化实现
        }
    }
}
```

## Redis Cluster架构设计

### 1. 集群拓扑结构

Redis Cluster采用无中心架构，每个节点都保存着集群的完整拓扑信息。

```java
// Redis Cluster拓扑结构
public class ClusterTopology {
    
    /*
    集群拓扑特点：
    1. 无中心节点：每个节点都是平等的
    2. 哈希槽分配：16384个槽均匀分配给节点
    3. 主从复制：每个主节点可以有多个从节点
    4. 数据冗余：通过主从复制实现数据备份
    */
    
    // 集群配置信息
    public static class ClusterConfig {
        // 集群节点列表
        private List<ClusterNode> nodes;
        
        // 哈希槽分配映射
        private Map<Integer, String> slotToNodeMapping;
        
        // 集群状态
        private ClusterState state;
        
        // 集群配置版本
        private long configEpoch;
    }
    
    // 集群状态枚举
    public enum ClusterState {
        OK,          // 正常状态
        FAIL,        // 集群故障
        UPDATING     // 配置更新中
    }
    
    // 哈希槽分配策略
    public static class SlotAssignmentStrategy {
        
        // 均匀分配哈希槽
        public static Map<Integer, String> distributeSlotsEvenly(List<String> nodes) {
            Map<Integer, String> slotMapping = new HashMap<>();
            int slotsPerNode = 16384 / nodes.size();
            int remainingSlots = 16384 % nodes.size();
            
            int slotIndex = 0;
            for (int i = 0; i < nodes.size(); i++) {
                String node = nodes.get(i);
                int slotsForNode = slotsPerNode + (i < remainingSlots ? 1 : 0);
                
                for (int j = 0; j < slotsForNode; j++) {
                    slotMapping.put(slotIndex++, node);
                }
            }
            
            return slotMapping;
        }
        
        // 根据节点权重分配哈希槽
        public static Map<Integer, String> distributeSlotsByWeight(
                Map<String, Integer> nodeWeights) {
            Map<Integer, String> slotMapping = new HashMap<>();
            int totalWeight = nodeWeights.values().stream().mapToInt(Integer::intValue).sum();
            
            int slotIndex = 0;
            for (Map.Entry<String, Integer> entry : nodeWeights.entrySet()) {
                String node = entry.getKey();
                int weight = entry.getValue();
                int slotsForNode = (int) Math.round(16384.0 * weight / totalWeight);
                
                for (int i = 0; i < slotsForNode && slotIndex < 16384; i++) {
                    slotMapping.put(slotIndex++, node);
                }
            }
            
            return slotMapping;
        }
    }
}
```

### 2. 数据分布与复制

Redis Cluster通过主从复制机制实现数据冗余和高可用性。

```java
// 数据分布与复制机制
public class DataDistributionAndReplication {
    
    /*
    数据分布特点：
    1. 数据分片：16384个哈希槽分布到不同节点
    2. 主从复制：每个主节点可以有多个从节点
    3. 读写分离：读操作可以路由到从节点
    4. 数据同步：主节点异步复制数据到从节点
    */
    
    // 主从复制配置
    public static class ReplicationConfig {
        // 复制超时时间
        public static final int REPL_TIMEOUT = 60000;
        
        // 复制缓冲区大小
        public static final int REPL_BACKLOG_SIZE = 1024 * 1024; // 1MB
        
        // 从节点最大滞后时间
        public static final int REPL_MAX_LAG = 10; // 10秒
    }
    
    // 数据分片管理
    public static class DataShardingManager {
        private Map<Integer, ClusterNode> slotToMasterNode;
        private Map<String, List<ClusterNode>> masterToSlaveNodes;
        
        // 获取键对应的主节点
        public ClusterNode getMasterNodeForKey(String key) {
            int slot = HashSlotCalculator.calculateSlot(key);
            return slotToMasterNode.get(slot);
        }
        
        // 获取主节点的所有从节点
        public List<ClusterNode> getSlaveNodesForMaster(String masterNodeId) {
            return masterToSlaveNodes.getOrDefault(masterNodeId, new ArrayList<>());
        }
        
        // 重新分片数据
        public void reshardData(int slot, String newMasterNodeId) {
            ClusterNode oldMaster = slotToMasterNode.get(slot);
            ClusterNode newMaster = findNodeById(newMasterNodeId);
            
            if (oldMaster != null && newMaster != null) {
                // 迁移数据
                migrateData(slot, oldMaster, newMaster);
                
                // 更新槽分配
                slotToMasterNode.put(slot, newMaster);
                
                // 通知集群更新配置
                notifyClusterConfigUpdate();
            }
        }
        
        private void migrateData(int slot, ClusterNode fromNode, ClusterNode toNode) {
            // 实现数据迁移逻辑
            // 1. 在目标节点创建槽
            // 2. 从源节点迁移数据
            // 3. 在源节点删除槽
        }
        
        private ClusterNode findNodeById(String nodeId) {
            // 根据节点ID查找节点
            return null; // 简化实现
        }
        
        private void notifyClusterConfigUpdate() {
            // 通知集群配置更新
        }
    }
}
```

## Redis Cluster部署与配置

### 1. 集群部署

```bash
# Redis Cluster部署步骤

# 1. 创建配置文件目录
mkdir -p /etc/redis-cluster
cd /etc/redis-cluster

# 2. 创建6个Redis实例配置文件
for port in 7000 7001 7002 7003 7004 7005; do
  cat > redis-${port}.conf << EOF
port ${port}
cluster-enabled yes
cluster-config-file nodes-${port}.conf
cluster-node-timeout 5000
appendonly yes
daemonize yes
pidfile /var/run/redis-${port}.pid
logfile /var/log/redis-${port}.log
dir /var/lib/redis-${port}
EOF
done

# 3. 创建数据目录
for port in 7000 7001 7002 7003 7004 7005; do
  mkdir -p /var/lib/redis-${port}
done

# 4. 启动Redis实例
for port in 7000 7001 7002 7003 7004 7005; do
  redis-server /etc/redis-cluster/redis-${port}.conf
done

# 5. 创建集群
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

### 2. Java客户端配置

```java
// Redis Cluster Java客户端配置
@Configuration
public class RedisClusterConfig {
    
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        // 配置集群节点
        RedisClusterConfiguration clusterConfig = new RedisClusterConfiguration(
            Arrays.asList(
                "127.0.0.1:7000",
                "127.0.0.1:7001",
                "127.0.0.1:7002",
                "127.0.0.1:7003",
                "127.0.0.1:7004",
                "127.0.0.1:7005"
            )
        );
        
        // 设置最大重定向次数
        clusterConfig.setMaxRedirects(3);
        
        // 创建连接工厂
        LettuceConnectionFactory factory = new LettuceConnectionFactory(clusterConfig);
        return factory;
    }
    
    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory());
        
        // 设置序列化器
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        template.afterPropertiesSet();
        return template;
    }
}

// Redis Cluster操作示例
@Service
public class RedisClusterOperations {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 存储数据
    public void setData(String key, Object value) {
        redisTemplate.opsForValue().set(key, value, 3600, TimeUnit.SECONDS);
    }
    
    // 获取数据
    public Object getData(String key) {
        return redisTemplate.opsForValue().get(key);
    }
    
    // 删除数据
    public void deleteData(String key) {
        redisTemplate.delete(key);
    }
    
    // 获取集群信息
    public Properties getClusterInfo() {
        return redisTemplate.getConnectionFactory().getConnection().clusterGetClusterInfo();
    }
    
    // 获取节点信息
    public List<RedisClusterNode> getClusterNodes() {
        return redisTemplate.getConnectionFactory().getConnection().clusterGetNodes();
    }
    
    // 添加节点
    public void addNode(String host, int port) {
        redisTemplate.getConnectionFactory().getConnection()
            .clusterAddSlots(new RedisClusterNode(host, port));
    }
    
    // 删除节点
    public void removeNode(String nodeId) {
        redisTemplate.getConnectionFactory().getConnection()
            .clusterForget(nodeId);
    }
}
```

## Redis Cluster实际应用

### 1. 会话存储

```java
// 基于Redis Cluster的会话存储
@Service
public class ClusterSessionStorage {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 存储会话
    public void saveSession(String sessionId, Map<String, Object> sessionData) {
        String key = "session:" + sessionId;
        redisTemplate.opsForHash().putAll(key, sessionData);
        // 设置会话过期时间
        redisTemplate.expire(key, 1800, TimeUnit.SECONDS);
    }
    
    // 获取会话
    public Map<Object, Object> getSession(String sessionId) {
        String key = "session:" + sessionId;
        return redisTemplate.opsForHash().entries(key);
    }
    
    // 删除会话
    public void removeSession(String sessionId) {
        String key = "session:" + sessionId;
        redisTemplate.delete(key);
    }
    
    // 更新会话
    public void updateSession(String sessionId, String field, Object value) {
        String key = "session:" + sessionId;
        redisTemplate.opsForHash().put(key, field, value);
    }
    
    // 扩展会话过期时间
    public void extendSession(String sessionId, int seconds) {
        String key = "session:" + sessionId;
        redisTemplate.expire(key, seconds, TimeUnit.SECONDS);
    }
}
```

### 2. 缓存系统

```java
// 基于Redis Cluster的缓存系统
@Service
public class ClusterCacheSystem {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Autowired
    private DatabaseService databaseService;
    
    // 获取缓存数据
    public Object getCachedData(String key) {
        // 先从缓存获取
        Object data = redisTemplate.opsForValue().get(key);
        if (data == null) {
            // 缓存未命中，从数据库获取
            data = databaseService.query(key);
            if (data != null) {
                // 存入缓存
                redisTemplate.opsForValue().set(key, data, 3600, TimeUnit.SECONDS);
            }
        }
        return data;
    }
    
    // 更新缓存数据
    public void updateCachedData(String key, Object newData) {
        // 更新数据库
        databaseService.update(key, newData);
        // 更新缓存
        redisTemplate.opsForValue().set(key, newData, 3600, TimeUnit.SECONDS);
    }
    
    // 删除缓存数据
    public void deleteCachedData(String key) {
        // 删除数据库记录
        databaseService.delete(key);
        // 删除缓存
        redisTemplate.delete(key);
    }
    
    // 批量获取缓存数据
    public Map<String, Object> getBatchCachedData(List<String> keys) {
        List<Object> values = redisTemplate.opsForValue().multiGet(keys);
        Map<String, Object> result = new HashMap<>();
        
        List<String> missingKeys = new ArrayList<>();
        for (int i = 0; i < keys.size(); i++) {
            String key = keys.get(i);
            Object value = values.get(i);
            if (value != null) {
                result.put(key, value);
            } else {
                missingKeys.add(key);
            }
        }
        
        // 处理缓存未命中的键
        if (!missingKeys.isEmpty()) {
            Map<String, Object> dbData = databaseService.batchQuery(missingKeys);
            result.putAll(dbData);
            
            // 将数据库数据存入缓存
            for (Map.Entry<String, Object> entry : dbData.entrySet()) {
                redisTemplate.opsForValue().set(entry.getKey(), entry.getValue(), 
                                              3600, TimeUnit.SECONDS);
            }
        }
        
        return result;
    }
}
```

### 3. 分布式锁

```java
// 基于Redis Cluster的分布式锁
@Service
public class ClusterDistributedLock {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 获取分布式锁
    public boolean tryLock(String lockKey, String lockValue, int expireTime) {
        Boolean result = redisTemplate.opsForValue().setIfAbsent(
            lockKey, lockValue, expireTime, TimeUnit.SECONDS);
        return result != null && result;
    }
    
    // 释放分布式锁
    public boolean releaseLock(String lockKey, String lockValue) {
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                       "return redis.call('del', KEYS[1]) " +
                       "else return 0 end";
        
        DefaultRedisScript<Long> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(script);
        redisScript.setResultType(Long.class);
        
        Long result = redisTemplate.execute(redisScript, 
                                         Collections.singletonList(lockKey), 
                                         lockValue);
        return result != null && result == 1;
    }
    
    // 带重试的获取锁
    public boolean tryLockWithRetry(String lockKey, String lockValue, 
                                   int expireTime, int maxRetries, long retryDelay) {
        for (int i = 0; i < maxRetries; i++) {
            if (tryLock(lockKey, lockValue, expireTime)) {
                return true;
            }
            try {
                Thread.sleep(retryDelay);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }
    
    // 可重入锁实现
    public class ReentrantLock {
        private final String lockKey;
        private final String lockValue;
        private final ThreadLocal<Integer> lockCount = new ThreadLocal<Integer>() {
            @Override
            protected Integer initialValue() {
                return 0;
            }
        };
        
        public ReentrantLock(String lockKey, String lockValue) {
            this.lockKey = lockKey;
            this.lockValue = lockValue;
        }
        
        public boolean lock(int expireTime) {
            if (lockCount.get() > 0) {
                // 重入，增加计数
                lockCount.set(lockCount.get() + 1);
                return true;
            }
            
            if (tryLock(lockKey, lockValue, expireTime)) {
                lockCount.set(1);
                return true;
            }
            
            return false;
        }
        
        public boolean unlock() {
            if (lockCount.get() <= 0) {
                return false;
            }
            
            if (lockCount.get() == 1) {
                // 最后一次释放锁
                boolean released = releaseLock(lockKey, lockValue);
                if (released) {
                    lockCount.set(0);
                }
                return released;
            } else {
                // 减少重入计数
                lockCount.set(lockCount.get() - 1);
                return true;
            }
        }
    }
}
```

### 4. 计数器系统

```java
// 基于Redis Cluster的计数器系统
@Service
public class ClusterCounterSystem {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 原子性递增计数器
    public Long incrementCounter(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }
    
    // 原子性递减计数器
    public Long decrementCounter(String key, long delta) {
        return redisTemplate.opsForValue().decrement(key, delta);
    }
    
    // 获取计数器值
    public Long getCounter(String key) {
        Object value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.valueOf(value.toString()) : 0L;
    }
    
    // 重置计数器
    public void resetCounter(String key) {
        redisTemplate.opsForValue().set(key, "0");
    }
    
    // 限流计数器
    public boolean isAllowed(String key, int maxRequests, int windowSeconds) {
        Long current = redisTemplate.opsForValue().increment(key, 1);
        if (current == 1) {
            redisTemplate.expire(key, windowSeconds, TimeUnit.SECONDS);
        }
        return current <= maxRequests;
    }
    
    // 滑动窗口限流
    public boolean isAllowedSlidingWindow(String key, int maxRequests, int windowSeconds) {
        long currentTime = System.currentTimeMillis();
        long windowStart = currentTime - (windowSeconds * 1000);
        
        // 移除窗口外的请求记录
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
        
        // 获取当前窗口内的请求数
        Long currentRequests = redisTemplate.opsForZSet().zCard(key);
        
        if (currentRequests < maxRequests) {
            // 添加当前请求记录
            redisTemplate.opsForZSet().add(key, String.valueOf(currentTime), currentTime);
            return true;
        }
        
        return false;
    }
    
    // 分布式计数器（支持多节点）
    public Long incrementDistributedCounter(String key, long delta) {
        String nodeKey = key + ":" + getCurrentNodeHash();
        Long localCount = redisTemplate.opsForValue().increment(nodeKey, delta);
        
        // 更新全局计数器
        String globalKey = key + ":global";
        Long globalCount = redisTemplate.opsForValue().increment(globalKey, delta);
        
        return globalCount;
    }
    
    private String getCurrentNodeHash() {
        // 获取当前节点的哈希值
        return "node1"; // 简化实现
    }
}
```

## Redis Cluster监控与运维

### 1. 集群监控

```java
// Redis Cluster监控实现
@Component
public class ClusterMonitoring {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 获取集群状态信息
    public ClusterStatus getClusterStatus() {
        ClusterStatus status = new ClusterStatus();
        
        try {
            // 获取集群信息
            Properties clusterInfo = redisTemplate.getConnectionFactory()
                .getConnection().clusterGetClusterInfo();
            
            status.setClusterState(clusterInfo.getProperty("cluster_state"));
            status.setClusterSlotsAssigned(Integer.parseInt(
                clusterInfo.getProperty("cluster_slots_assigned")));
            status.setClusterSlotsOk(Integer.parseInt(
                clusterInfo.getProperty("cluster_slots_ok")));
            status.setClusterSlotsFail(Integer.parseInt(
                clusterInfo.getProperty("cluster_slots_fail")));
            status.setClusterKnownNodes(Integer.parseInt(
                clusterInfo.getProperty("cluster_known_nodes")));
            status.setClusterSize(Integer.parseInt(
                clusterInfo.getProperty("cluster_size")));
            
            // 获取节点信息
            List<RedisClusterNode> nodes = redisTemplate.getConnectionFactory()
                .getConnection().clusterGetNodes();
            status.setNodes(nodes);
            
        } catch (Exception e) {
            log.error("Failed to get cluster status", e);
        }
        
        return status;
    }
    
    // 监控节点健康状态
    public List<NodeHealthStatus> getNodeHealthStatus() {
        List<NodeHealthStatus> healthStatusList = new ArrayList<>();
        
        try {
            List<RedisClusterNode> nodes = redisTemplate.getConnectionFactory()
                .getConnection().clusterGetNodes();
            
            for (RedisClusterNode node : nodes) {
                NodeHealthStatus healthStatus = new NodeHealthStatus();
                healthStatus.setNodeId(node.getId());
                healthStatus.setHost(node.getHost());
                healthStatus.setPort(node.getPort());
                healthStatus.setRole(node.getRole().name());
                healthStatus.setConnected(node.isConnected());
                
                // 检查节点连接状态
                healthStatus.setPingable(isNodePingable(node));
                
                healthStatusList.add(healthStatus);
            }
        } catch (Exception e) {
            log.error("Failed to get node health status", e);
        }
        
        return healthStatusList;
    }
    
    private boolean isNodePingable(RedisClusterNode node) {
        try {
            // 尝试ping节点
            RedisConnectionFactory factory = redisTemplate.getConnectionFactory();
            // 这里需要实现具体的ping逻辑
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    // 集群状态数据结构
    public static class ClusterStatus {
        private String clusterState;
        private int clusterSlotsAssigned;
        private int clusterSlotsOk;
        private int clusterSlotsFail;
        private int clusterKnownNodes;
        private int clusterSize;
        private List<RedisClusterNode> nodes;
        
        // getter和setter方法...
    }
    
    // 节点健康状态数据结构
    public static class NodeHealthStatus {
        private String nodeId;
        private String host;
        private int port;
        private String role;
        private boolean connected;
        private boolean pingable;
        
        // getter和setter方法...
    }
}
```

### 2. 集群维护

```java
// Redis Cluster维护操作
@Service
public class ClusterMaintenance {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 添加新节点
    public void addNode(String host, int port, boolean asMaster) {
        try {
            if (asMaster) {
                // 添加主节点
                redisTemplate.getConnectionFactory().getConnection()
                    .clusterAddSlots(new RedisClusterNode(host, port));
            } else {
                // 添加从节点
                // 需要指定主节点
            }
            
            log.info("Node added successfully: {}:{}", host, port);
        } catch (Exception e) {
            log.error("Failed to add node: " + host + ":" + port, e);
        }
    }
    
    // 删除节点
    public void removeNode(String nodeId) {
        try {
            // 检查节点是否可以安全删除
            if (canSafelyRemoveNode(nodeId)) {
                redisTemplate.getConnectionFactory().getConnection()
                    .clusterForget(nodeId);
                log.info("Node removed successfully: " + nodeId);
            } else {
                log.warn("Node cannot be safely removed: " + nodeId);
            }
        } catch (Exception e) {
            log.error("Failed to remove node: " + nodeId, e);
        }
    }
    
    // 重新分片数据
    public void reshardData(int slot, String targetNodeId) {
        try {
            redisTemplate.getConnectionFactory().getConnection()
                .clusterSetSlot(targetNodeId, slot, 
                              RedisClusterNode.SlotImportState.IMPORTING);
            log.info("Slot {} resharded to node {}", slot, targetNodeId);
        } catch (Exception e) {
            log.error("Failed to reshard slot " + slot + " to node " + targetNodeId, e);
        }
    }
    
    // 备份集群数据
    public void backupClusterData(String backupPath) {
        try {
            List<RedisClusterNode> nodes = redisTemplate.getConnectionFactory()
                .getConnection().clusterGetNodes();
            
            for (RedisClusterNode node : nodes) {
                if (node.getRole() == RedisClusterNode.NodeRole.MASTER) {
                    // 备份主节点数据
                    backupNodeData(node, backupPath);
                }
            }
            
            log.info("Cluster backup completed successfully");
        } catch (Exception e) {
            log.error("Failed to backup cluster data", e);
        }
    }
    
    private boolean canSafelyRemoveNode(String nodeId) {
        // 检查节点是否包含数据
        // 检查是否有从节点依赖该节点
        // 检查集群状态是否正常
        return true; // 简化实现
    }
    
    private void backupNodeData(RedisClusterNode node, String backupPath) {
        // 实现节点数据备份逻辑
    }
}
```

## 总结

Redis Cluster作为Redis官方提供的分布式解决方案，具有以下核心优势：

1. **高可用性**：通过主从复制和自动故障转移实现高可用
2. **水平扩展**：支持动态添加和删除节点，实现线性扩展
3. **无中心架构**：去中心化设计，无单点故障
4. **数据分片**：通过哈希槽机制实现数据均匀分布
5. **客户端透明**：客户端可以直接与集群交互

关键要点：

- 理解哈希槽机制是掌握Redis Cluster的基础
- 合理规划集群拓扑结构和节点配置
- 充分利用Redis Cluster的高可用特性
- 建立完善的监控和维护机制
- 根据业务需求选择合适的客户端和配置

通过深入理解和合理使用Redis Cluster，我们可以构建出高性能、高可用、可扩展的分布式缓存系统，为业务发展提供强有力的技术支撑。

至此，我们已经完成了第五章的所有内容。在下一章中，我们将深入探讨Memcached的实战应用，帮助读者掌握这一轻量级高速缓存技术。