---
title: 高可用与扩展性设计
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在前两章中，我们分别实现了最小可用调度器和分布式调度雏形。虽然这些实现能够满足基本的任务调度需求，但在生产环境中，我们还需要考虑系统的高可用性和扩展性。本文将深入探讨如何通过 Leader 选举、多节点容错与 Failover、动态扩缩容等机制，构建一个高可用、可扩展的分布式调度系统。

## Leader 选举（Zookeeper/Etcd 实现）

在分布式调度系统中，通常需要一个主节点（Leader）来协调各个工作节点（Worker）的工作。Leader 负责任务分配、状态监控、故障处理等核心功能。为了确保系统的高可用性，我们需要实现 Leader 选举机制，当主节点发生故障时，能够自动选举出新的主节点。

### 基于 Zookeeper 的 Leader 选举

Apache Zookeeper 是一个广泛使用的分布式协调服务，它提供了可靠的 Leader 选举机制。下面我们基于 Zookeeper 实现一个简单的 Leader 选举组件。

```java
import org.apache.zookeeper.*;
import org.apache.zookeeper.data.Stat;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class ZookeeperLeaderElection implements Watcher {
    private ZooKeeper zooKeeper;
    private String serverId;
    private String leaderPath;
    private String currentNode;
    private volatile boolean isLeader = false;
    private CountDownLatch connectLatch = new CountDownLatch(1);
    private CountDownLatch leaderLatch = new CountDownLatch(1);
    
    public ZookeeperLeaderElection(String zkConnectionString, String serverId) throws Exception {
        this.serverId = serverId;
        this.leaderPath = "/scheduler/leader";
        
        // 连接 Zookeeper
        this.zooKeeper = new ZooKeeper(zkConnectionString, 3000, this);
        connectLatch.await();
        
        // 创建 Leader 节点路径
        createPathIfNotExists("/scheduler");
        createPathIfNotExists(leaderPath);
    }
    
    @Override
    public void process(WatchedEvent event) {
        if (event.getState() == Watcher.Event.KeeperState.SyncConnected) {
            connectLatch.countDown();
        }
        
        if (event.getType() == Watcher.Event.EventType.NodeChildrenChanged) {
            // 子节点发生变化，重新检查 Leader
            checkLeader();
        }
    }
    
    /**
     * 参与 Leader 选举
     */
    public void electLeader() throws Exception {
        // 创建临时顺序节点
        String nodePath = leaderPath + "/candidate_";
        currentNode = zooKeeper.create(nodePath, serverId.getBytes(), 
                                      ZooDefs.Ids.OPEN_ACL_UNSAFE, 
                                      CreateMode.EPHEMERAL_SEQUENTIAL);
        
        System.out.println("Created node: " + currentNode);
        
        // 检查是否成为 Leader
        checkLeader();
    }
    
    /**
     * 检查是否成为 Leader
     */
    private void checkLeader() {
        try {
            // 获取所有候选节点
            List<String> children = zooKeeper.getChildren(leaderPath, true);
            Collections.sort(children);
            
            // 当前节点是否是最小的节点
            String thisNode = currentNode.substring(currentNode.lastIndexOf("/") + 1);
            if (children.isEmpty() || children.get(0).equals(thisNode)) {
                isLeader = true;
                leaderLatch.countDown();
                System.out.println("Server " + serverId + " became the leader");
            } else {
                isLeader = false;
                // 监听前一个节点的变化
                int index = children.indexOf(thisNode);
                if (index > 0) {
                    String previousNode = children.get(index - 1);
                    zooKeeper.exists(leaderPath + "/" + previousNode, true);
                }
            }
        } catch (Exception e) {
            System.err.println("Error checking leader: " + e.getMessage());
        }
    }
    
    /**
     * 等待成为 Leader
     */
    public void waitForLeadership() throws InterruptedException {
        leaderLatch.await();
    }
    
    /**
     * 判断是否是 Leader
     */
    public boolean isLeader() {
        return isLeader;
    }
    
    /**
     * 创建路径（如果不存在）
     */
    private void createPathIfNotExists(String path) throws Exception {
        Stat stat = zooKeeper.exists(path, false);
        if (stat == null) {
            zooKeeper.create(path, new byte[0], ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        }
    }
    
    /**
     * 关闭连接
     */
    public void close() throws InterruptedException {
        if (zooKeeper != null) {
            zooKeeper.close();
        }
    }
}
```

### 基于 Etcd 的 Leader 选举

Etcd 是另一个流行的分布式键值存储系统，同样可以用于实现 Leader 选举。以下是基于 Etcd 的实现：

```java
import io.etcd.jetcd.*;
import io.etcd.jetcd.options.PutOption;
import io.etcd.jetcd.options.GetOption;
import java.util.concurrent.atomic.AtomicBoolean;

public class EtcdLeaderElection {
    private Client client;
    private String serverId;
    private String leaderKey;
    private Lease lease;
    private AtomicBoolean isLeader = new AtomicBoolean(false);
    
    public EtcdLeaderElection(String endpoints, String serverId) {
        this.client = Client.builder().endpoints(endpoints.split(",")).build();
        this.serverId = serverId;
        this.leaderKey = "/scheduler/leader";
    }
    
    /**
     * 参与 Leader 选举
     */
    public void electLeader() throws Exception {
        // 创建租约（10秒）
        lease = client.getLeaseClient().grant(10).get();
        long leaseId = lease.getID();
        
        // 尝试成为 Leader
        PutOption putOption = PutOption.newBuilder()
                .withLeaseId(leaseId)
                .build();
        
        try {
            client.getKVClient()
                    .put(ByteSequence.from(leaderKey.getBytes()), 
                         ByteSequence.from(serverId.getBytes()), 
                         putOption)
                    .get();
            
            isLeader.set(true);
            System.out.println("Server " + serverId + " became the leader");
            
            // 保持租约活跃
            keepLeaseAlive(leaseId);
        } catch (Exception e) {
            isLeader.set(false);
            System.out.println("Server " + serverId + " is not the leader");
        }
    }
    
    /**
     * 保持租约活跃
     */
    private void keepLeaseAlive(long leaseId) {
        client.getLeaseClient().keepAlive(leaseId, response -> {
            // 租约续期响应处理
            System.out.println("Lease renewed: " + response.getID());
        });
    }
    
    /**
     * 监听 Leader 变化
     */
    public void watchLeader(Runnable onLeaderChange) {
        Watch.Listener listener = Watch.listener(response -> {
            for (WatchEvent event : response.getEvents()) {
                if (event.getEventType() == WatchEvent.EventType.DELETE) {
                    // Leader 节点被删除，重新选举
                    try {
                        electLeader();
                        onLeaderChange.run();
                    } catch (Exception e) {
                        System.err.println("Error during re-election: " + e.getMessage());
                    }
                }
            }
        });
        
        client.getWatchClient().watch(ByteSequence.from(leaderKey.getBytes()), listener);
    }
    
    /**
     * 判断是否是 Leader
     */
    public boolean isLeader() {
        return isLeader.get();
    }
    
    /**
     * 关闭连接
     */
    public void close() {
        if (client != null) {
            client.close();
        }
    }
}
```

## 多节点容错与 Failover

在分布式系统中，节点故障是不可避免的。我们需要设计容错机制，确保当某个节点发生故障时，系统能够自动进行故障转移（Failover），保证任务的正常执行。

### 节点健康检查

首先，我们需要实现节点健康检查机制，及时发现故障节点：

```java
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class NodeHealthChecker {
    private JobDao jobDao;
    private ScheduledExecutorService scheduler;
    private long heartbeatTimeout = 90000; // 90秒超时
    
    public NodeHealthChecker(JobDao jobDao) {
        this.jobDao = jobDao;
        this.scheduler = Executors.newScheduledThreadPool(1);
    }
    
    /**
     * 启动健康检查
     */
    public void start() {
        scheduler.scheduleAtFixedRate(this::checkNodeHealth, 0, 30, TimeUnit.SECONDS);
    }
    
    /**
     * 检查节点健康状态
     */
    private void checkNodeHealth() {
        try {
            List<SchedulerNode> nodes = jobDao.getAllNodes();
            LocalDateTime now = LocalDateTime.now();
            
            for (SchedulerNode node : nodes) {
                long timeDiff = java.time.Duration.between(node.getLastHeartbeat(), now).toMillis();
                
                if (timeDiff > heartbeatTimeout) {
                    // 节点超时，标记为离线
                    if (node.getStatus() != NodeStatus.OFFLINE) {
                        jobDao.updateNodeStatus(node.getId(), NodeStatus.OFFLINE);
                        System.out.println("Node " + node.getId() + " marked as offline");
                        
                        // 触发故障转移
                        handleNodeFailure(node);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error checking node health: " + e.getMessage());
        }
    }
    
    /**
     * 处理节点故障
     */
    private void handleNodeFailure(SchedulerNode failedNode) {
        try {
            // 查找该节点上正在运行的任务
            List<JobExecutionLog> runningJobs = jobDao.getRunningJobsByNode(failedNode.getId());
            
            // 重新分配这些任务
            for (JobExecutionLog jobLog : runningJobs) {
                // 取消原任务执行
                jobDao.updateJobExecutionStatus(jobLog.getId(), ExecutionStatus.FAILED, 
                                              "Node failure: " + failedNode.getId());
                
                // 重新调度任务
                rescheduleJob(jobLog.getJobId());
            }
            
            System.out.println("Handled failure of node " + failedNode.getId() + 
                             ", rescheduled " + runningJobs.size() + " jobs");
        } catch (Exception e) {
            System.err.println("Error handling node failure: " + e.getMessage());
        }
    }
    
    /**
     * 重新调度任务
     */
    private void rescheduleJob(String jobId) {
        try {
            Job job = jobDao.getJobById(jobId);
            if (job != null && job.getStatus() == JobStatus.ACTIVE) {
                // 寻找可用节点重新执行任务
                SchedulerNode availableNode = findAvailableNode();
                if (availableNode != null) {
                    // 这里应该触发任务在新节点上的执行
                    System.out.println("Rescheduling job " + jobId + " on node " + availableNode.getId());
                }
            }
        } catch (Exception e) {
            System.err.println("Error rescheduling job " + jobId + ": " + e.getMessage());
        }
    }
    
    /**
     * 查找可用节点
     */
    private SchedulerNode findAvailableNode() {
        try {
            List<SchedulerNode> nodes = jobDao.getOnlineNodes();
            if (!nodes.isEmpty()) {
                // 简单的负载均衡：返回第一个节点
                return nodes.get(0);
            }
        } catch (Exception e) {
            System.err.println("Error finding available node: " + e.getMessage());
        }
        return null;
    }
    
    /**
     * 停止健康检查
     */
    public void stop() {
        scheduler.shutdown();
    }
}
```

### 任务故障转移实现

当节点发生故障时，我们需要将该节点上的任务转移到其他健康节点上执行：

```java
public class JobFailoverManager {
    private JobDao jobDao;
    private JobExecutor jobExecutor;
    private NodeRegistry nodeRegistry;
    
    public JobFailoverManager(JobDao jobDao, JobExecutor jobExecutor, NodeRegistry nodeRegistry) {
        this.jobDao = jobDao;
        this.jobExecutor = jobExecutor;
        this.nodeRegistry = nodeRegistry;
    }
    
    /**
     * 处理任务故障转移
     */
    public void handleJobFailover(String failedNodeId) {
        try {
            // 获取故障节点上正在运行的任务
            List<JobExecutionLog> failedExecutions = jobDao.getRunningJobsByNode(failedNodeId);
            
            for (JobExecutionLog execution : failedExecutions) {
                // 更新原任务执行状态
                jobDao.updateJobExecutionStatus(execution.getId(), ExecutionStatus.FAILED, 
                                              "Node failure");
                
                // 重新调度任务
                Job job = jobDao.getJobById(execution.getJobId());
                if (job != null && job.getStatus() == JobStatus.ACTIVE) {
                    // 查找可用节点
                    String newNodeId = selectNodeForJob(job);
                    if (newNodeId != null) {
                        // 在新节点上执行任务
                        jobExecutor.executeJob(job, newNodeId);
                        System.out.println("Job " + job.getId() + " failover to node " + newNodeId);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error in job failover: " + e.getMessage());
        }
    }
    
    /**
     * 为任务选择执行节点
     */
    private String selectNodeForJob(Job job) {
        try {
            List<SchedulerNode> onlineNodes = jobDao.getOnlineNodes();
            if (onlineNodes.isEmpty()) {
                return null;
            }
            
            // 简单的轮询负载均衡
            // 在实际应用中，可以实现更复杂的负载均衡算法
            return onlineNodes.get(0).getId();
        } catch (Exception e) {
            System.err.println("Error selecting node for job: " + e.getMessage());
            return null;
        }
    }
}
```

## 动态扩缩容

在生产环境中，任务负载可能会动态变化，我们需要支持调度节点的动态扩缩容，以适应不同的负载需求。

### 节点注册与发现

首先，我们需要实现节点的自动注册与发现机制：

```java
public class NodeRegistry {
    private JobDao jobDao;
    private String nodeId;
    private String host;
    private int port;
    private ScheduledExecutorService heartbeatScheduler;
    
    public NodeRegistry(JobDao jobDao, String host, int port) {
        this.jobDao = jobDao;
        this.nodeId = UUID.randomUUID().toString();
        this.host = host;
        this.port = port;
        this.heartbeatScheduler = Executors.newScheduledThreadPool(1);
    }
    
    /**
     * 注册当前节点
     */
    public void registerNode() throws Exception {
        SchedulerNode node = new SchedulerNode();
        node.setId(nodeId);
        node.setHost(host);
        node.setPort(port);
        node.setStatus(NodeStatus.ONLINE);
        node.setLastHeartbeat(LocalDateTime.now());
        
        jobDao.saveNode(node);
        System.out.println("Node registered: " + nodeId);
        
        // 启动心跳
        startHeartbeat();
    }
    
    /**
     * 启动心跳机制
     */
    private void startHeartbeat() {
        heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                jobDao.updateNodeHeartbeat(nodeId, LocalDateTime.now());
            } catch (Exception e) {
                System.err.println("Error updating heartbeat: " + e.getMessage());
            }
        }, 0, 30, TimeUnit.SECONDS);
    }
    
    /**
     * 注销当前节点
     */
    public void unregisterNode() {
        try {
            jobDao.updateNodeStatus(nodeId, NodeStatus.OFFLINE);
            heartbeatScheduler.shutdown();
            System.out.println("Node unregistered: " + nodeId);
        } catch (Exception e) {
            System.err.println("Error unregistering node: " + e.getMessage());
        }
    }
    
    /**
     * 获取所有在线节点
     */
    public List<SchedulerNode> getOnlineNodes() throws Exception {
        return jobDao.getOnlineNodes();
    }
    
    public String getNodeId() {
        return nodeId;
    }
}
```

### 负载感知的扩缩容策略

为了实现智能的扩缩容，我们需要监控系统负载并根据负载情况动态调整节点数量：

```java
public class AutoScaler {
    private JobDao jobDao;
    private NodeRegistry nodeRegistry;
    private int minNodes = 1;
    private int maxNodes = 10;
    private double scaleUpThreshold = 0.8;  // 80% 负载时扩容
    private double scaleDownThreshold = 0.3; // 30% 负载时缩容
    
    public AutoScaler(JobDao jobDao, NodeRegistry nodeRegistry) {
        this.jobDao = jobDao;
        this.nodeRegistry = nodeRegistry;
    }
    
    /**
     * 检查是否需要扩缩容
     */
    public void checkScaling() {
        try {
            List<SchedulerNode> nodes = nodeRegistry.getOnlineNodes();
            int currentNodeCount = nodes.size();
            
            if (currentNodeCount < minNodes) {
                // 节点数低于最小值，需要扩容
                scaleUp(minNodes - currentNodeCount);
                return;
            }
            
            if (currentNodeCount > maxNodes) {
                // 节点数超过最大值，需要缩容
                scaleDown(currentNodeCount - maxNodes);
                return;
            }
            
            // 计算平均负载
            double avgLoad = calculateAverageLoad(nodes);
            
            if (avgLoad > scaleUpThreshold && currentNodeCount < maxNodes) {
                // 负载过高，需要扩容
                scaleUp(1);
            } else if (avgLoad < scaleDownThreshold && currentNodeCount > minNodes) {
                // 负载过低，可以缩容
                scaleDown(1);
            }
        } catch (Exception e) {
            System.err.println("Error checking scaling: " + e.getMessage());
        }
    }
    
    /**
     * 计算平均负载
     */
    private double calculateAverageLoad(List<SchedulerNode> nodes) {
        try {
            double totalLoad = 0;
            for (SchedulerNode node : nodes) {
                double nodeLoad = getNodeLoad(node.getId());
                totalLoad += nodeLoad;
            }
            return nodes.isEmpty() ? 0 : totalLoad / nodes.size();
        } catch (Exception e) {
            System.err.println("Error calculating load: " + e.getMessage());
            return 0;
        }
    }
    
    /**
     * 获取节点负载
     */
    private double getNodeLoad(String nodeId) throws Exception {
        // 这里应该从监控系统获取节点的实际负载数据
        // 为简化示例，返回随机负载值
        return Math.random();
    }
    
    /**
     * 扩容
     */
    private void scaleUp(int count) {
        System.out.println("Scaling up by " + count + " nodes");
        // 实际应用中，这里应该启动新的调度节点实例
        // 可以通过容器编排系统（如 Kubernetes）或云服务 API 实现
    }
    
    /**
     * 缩容
     */
    private void scaleDown(int count) {
        System.out.println("Scaling down by " + count + " nodes");
        // 实际应用中，这里应该优雅地停止部分调度节点实例
        // 需要确保这些节点上的任务已经完成或已转移
    }
}
```

## 高可用架构设计要点

在设计高可用的分布式调度系统时，需要考虑以下几个关键要点：

### 1. 数据一致性

确保所有节点访问的数据是一致的，使用分布式数据库或具备一致性保证的存储系统。

### 2. 状态同步

各个节点需要及时同步系统状态，包括任务状态、节点状态等。

### 3. 故障检测

实现快速准确的故障检测机制，及时发现节点故障。

### 4. 自动恢复

当故障发生时，系统应能自动进行恢复，包括任务重新调度、节点重新选举等。

### 5. 负载均衡

合理分配任务负载，避免某些节点过载而其他节点空闲。

### 6. 平滑扩缩容

支持节点的动态加入和退出，确保扩缩容过程中不影响现有任务的执行。

## 总结

通过本文的探讨，我们了解了如何构建一个高可用、可扩展的分布式调度系统。关键的技术点包括：

1. **Leader 选举**：使用 Zookeeper 或 Etcd 实现可靠的主节点选举机制
2. **容错与 Failover**：通过节点健康检查和任务故障转移机制保证系统的可靠性
3. **动态扩缩容**：根据系统负载动态调整节点数量，提高资源利用率

这些机制共同构成了分布式调度系统的高可用架构，确保了系统在面对节点故障、负载变化等挑战时仍能稳定运行。

在实际的生产环境中，还需要考虑更多的细节，如网络分区处理、数据备份与恢复、安全认证等。但通过本文的学习，我们已经掌握了构建高可用分布式调度系统的核心原理和实现方法。

在下一章中，我们将深入分析主流的分布式调度框架，了解它们是如何实现这些高可用特性的，以及在实际应用中的优势和局限性。