---
title: 分布式协调机制
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，协调机制是确保系统正确性和一致性的核心组件。多个节点之间需要通过协调机制来共享状态、选举主节点、分配任务以及处理故障。本文将深入探讨分布式锁实现、心跳与任务抢占、一致性协议在调度中的应用等关键技术。

## 分布式锁实现（Zookeeper/Redis）

分布式锁是分布式系统中实现互斥访问共享资源的重要机制。在任务调度系统中，分布式锁用于确保同一时间只有一个节点执行特定任务，防止任务重复执行。

### 基于 Zookeeper 的分布式锁

Zookeeper 是实现分布式锁的常用方案之一，它通过临时顺序节点和 Watcher 机制来实现锁的获取和释放。

```java
public class ZookeeperDistributedLock {
    private ZooKeeper zooKeeper;
    private String lockBasePath;
    private String lockName;
    private CountDownLatch latch = new CountDownLatch(1);
    
    public ZookeeperDistributedLock(ZooKeeper zooKeeper, String lockBasePath, String lockName) {
        this.zooKeeper = zooKeeper;
        this.lockBasePath = lockBasePath;
        this.lockName = lockName;
    }
    
    /**
     * 获取分布式锁
     * @param timeout 超时时间（毫秒）
     * @return 是否成功获取锁
     */
    public boolean lock(long timeout) {
        try {
            // 创建锁节点路径
            String lockPath = lockBasePath + "/" + lockName;
            Stat stat = zooKeeper.exists(lockPath, false);
            if (stat == null) {
                zooKeeper.create(lockPath, new byte[0], ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
            }
            
            // 创建临时顺序节点
            String nodePath = zooKeeper.create(
                lockPath + "/lock_", 
                new byte[0], 
                ZooDefs.Ids.OPEN_ACL_UNSAFE, 
                CreateMode.EPHEMERAL_SEQUENTIAL
            );
            
            String currentNode = nodePath.substring(nodePath.lastIndexOf("/") + 1);
            
            // 检查是否获得锁
            while (true) {
                List<String> children = zooKeeper.getChildren(lockPath, false);
                Collections.sort(children);
                
                // 如果当前节点是最小的节点，则获得锁
                if (currentNode.equals(children.get(0))) {
                    return true;
                }
                
                // 找到前一个节点并监听
                String prevNode = findPrevNode(children, currentNode);
                if (prevNode != null) {
                    Stat prevStat = zooKeeper.exists(lockPath + "/" + prevNode, event -> {
                        if (event.getType() == Watcher.Event.EventType.NodeDeleted) {
                            latch.countDown();
                        }
                    });
                    
                    if (prevStat != null) {
                        // 等待前一个节点被删除或超时
                        if (latch.await(timeout, TimeUnit.MILLISECONDS)) {
                            continue; // 重新检查
                        } else {
                            // 超时，释放当前节点
                            zooKeeper.delete(nodePath, -1);
                            return false;
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("获取分布式锁失败: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 释放分布式锁
     */
    public void unlock() {
        try {
            // 删除临时节点
            String lockPath = lockBasePath + "/" + lockName;
            List<String> children = zooKeeper.getChildren(lockPath, false);
            
            for (String child : children) {
                if (child.startsWith("lock_")) {
                    zooKeeper.delete(lockPath + "/" + child, -1);
                }
            }
        } catch (Exception e) {
            System.err.println("释放分布式锁失败: " + e.getMessage());
        }
    }
    
    private String findPrevNode(List<String> children, String currentNode) {
        int index = children.indexOf(currentNode);
        return index > 0 ? children.get(index - 1) : null;
    }
}
```

### 基于 Redis 的分布式锁

Redis 也是实现分布式锁的常用方案，通过 SETNX 命令和 Lua 脚本来实现锁的获取和释放。

```java
public class RedisDistributedLock {
    private Jedis jedis;
    private String lockKey;
    private String lockValue;
    private int expireTime;
    
    public RedisDistributedLock(Jedis jedis, String lockKey, int expireTime) {
        this.jedis = jedis;
        this.lockKey = lockKey;
        this.lockValue = UUID.randomUUID().toString();
        this.expireTime = expireTime;
    }
    
    /**
     * 获取分布式锁
     * @param timeout 超时时间（毫秒）
     * @return 是否成功获取锁
     */
    public boolean lock(long timeout) {
        long startTime = System.currentTimeMillis();
        
        while (System.currentTimeMillis() - startTime < timeout) {
            // 使用 SETNX 命令获取锁
            String result = jedis.set(lockKey, lockValue, "NX", "EX", expireTime);
            
            if ("OK".equals(result)) {
                return true;
            }
            
            // 等待一段时间后重试
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * 释放分布式锁
     * @return 是否成功释放锁
     */
    public boolean unlock() {
        // 使用 Lua 脚本原子性地释放锁
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                       "return redis.call('del', KEYS[1]) " +
                       "else return 0 end";
        
        Object result = jedis.eval(script, Collections.singletonList(lockKey), 
                                  Collections.singletonList(lockValue));
        
        return "1".equals(result.toString());
    }
    
    /**
     * 续期锁（防止锁过期）
     */
    public void renewLock() {
        jedis.expire(lockKey, expireTime);
    }
}
```

### 锁的使用示例

```java
public class JobExecutionService {
    private ZooKeeper zooKeeper;
    private Jedis jedis;
    
    public void executeJob(String jobId) {
        // 使用 Zookeeper 分布式锁
        ZookeeperDistributedLock zkLock = new ZookeeperDistributedLock(
            zooKeeper, "/locks", "job_" + jobId);
        
        if (zkLock.lock(5000)) { // 5秒超时
            try {
                // 执行任务逻辑
                performJobExecution(jobId);
            } finally {
                zkLock.unlock();
            }
        } else {
            System.out.println("获取锁失败，任务可能正在其他节点执行");
        }
        
        // 或者使用 Redis 分布式锁
        RedisDistributedLock redisLock = new RedisDistributedLock(
            jedis, "lock:job:" + jobId, 300); // 5分钟过期
        
        if (redisLock.lock(5000)) {
            try {
                // 执行任务逻辑
                performJobExecution(jobId);
                
                // 定期续期锁
                ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
                scheduler.scheduleAtFixedRate(redisLock::renewLock, 240, 240, TimeUnit.SECONDS);
                
                // 任务执行完成后关闭调度器
                scheduler.shutdown();
            } finally {
                redisLock.unlock();
            }
        }
    }
    
    private void performJobExecution(String jobId) {
        System.out.println("执行任务: " + jobId);
        // 实际任务执行逻辑
    }
}
```

## 心跳与任务抢占

在分布式调度系统中，心跳机制用于检测节点的存活状态，任务抢占机制用于在节点故障时重新分配任务。

### 心跳检测实现

```java
public class HeartbeatManager {
    private ZooKeeper zooKeeper;
    private String nodePath;
    private ScheduledExecutorService scheduler;
    private volatile boolean running = true;
    
    public HeartbeatManager(ZooKeeper zooKeeper, String nodeId) {
        this.zooKeeper = zooKeeper;
        this.nodePath = "/nodes/" + nodeId;
        this.scheduler = Executors.newScheduledThreadPool(1);
    }
    
    /**
     * 启动心跳
     */
    public void startHeartbeat() {
        // 创建节点
        try {
            zooKeeper.create(nodePath, 
                           getNodeInfo().getBytes(), 
                           ZooDefs.Ids.OPEN_ACL_UNSAFE, 
                           CreateMode.EPHEMERAL);
        } catch (Exception e) {
            System.err.println("创建节点失败: " + e.getMessage());
        }
        
        // 定期更新心跳
        scheduler.scheduleAtFixedRate(this::updateHeartbeat, 0, 30, TimeUnit.SECONDS);
    }
    
    /**
     * 更新心跳
     */
    private void updateHeartbeat() {
        if (!running) return;
        
        try {
            zooKeeper.setData(nodePath, getNodeInfo().getBytes(), -1);
        } catch (Exception e) {
            System.err.println("更新心跳失败: " + e.getMessage());
        }
    }
    
    /**
     * 获取节点信息
     */
    private String getNodeInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("timestamp", System.currentTimeMillis());
        info.put("ip", getLocalIP());
        info.put("status", "active");
        return JSON.toJSONString(info);
    }
    
    /**
     * 获取本地IP
     */
    private String getLocalIP() {
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch (UnknownHostException e) {
            return "127.0.0.1";
        }
    }
    
    /**
     * 停止心跳
     */
    public void stopHeartbeat() {
        running = false;
        scheduler.shutdown();
        
        try {
            zooKeeper.delete(nodePath, -1);
        } catch (Exception e) {
            System.err.println("删除节点失败: " + e.getMessage());
        }
    }
}
```

### 任务抢占机制

```java
public class TaskPreemptionManager {
    private ZooKeeper zooKeeper;
    private String nodeId;
    
    public TaskPreemptionManager(ZooKeeper zooKeeper, String nodeId) {
        this.zooKeeper = zooKeeper;
        this.nodeId = nodeId;
    }
    
    /**
     * 监听任务节点变化，实现任务抢占
     */
    public void watchTaskNodes() {
        try {
            zooKeeper.getChildren("/tasks", event -> {
                if (event.getType() == Watcher.Event.EventType.NodeChildrenChanged) {
                    // 任务节点发生变化，检查是否有可抢占的任务
                    checkAndPreemptTasks();
                }
            });
        } catch (Exception e) {
            System.err.println("监听任务节点失败: " + e.getMessage());
        }
    }
    
    /**
     * 检查并抢占任务
     */
    private void checkAndPreemptTasks() {
        try {
            List<String> tasks = zooKeeper.getChildren("/tasks", false);
            
            for (String taskName : tasks) {
                String taskPath = "/tasks/" + taskName;
                byte[] data = zooKeeper.getData(taskPath, false, null);
                String taskInfo = new String(data);
                
                JSONObject taskJson = JSON.parseObject(taskInfo);
                String status = taskJson.getString("status");
                String assignedNode = taskJson.getString("assignedNode");
                
                // 如果任务未分配或分配的节点已失效，则尝试抢占
                if ("pending".equals(status) || isNodeFailed(assignedNode)) {
                    preemptTask(taskPath, taskName);
                }
            }
        } catch (Exception e) {
            System.err.println("检查任务失败: " + e.getMessage());
        }
    }
    
    /**
     * 抢占任务
     */
    private void preemptTask(String taskPath, String taskName) {
        try {
            // 使用乐观锁更新任务状态
            Stat stat = new Stat();
            byte[] data = zooKeeper.getData(taskPath, false, stat);
            String taskInfo = new String(data);
            JSONObject taskJson = JSON.parseObject(taskInfo);
            
            // 更新任务状态为已分配
            taskJson.put("status", "assigned");
            taskJson.put("assignedNode", nodeId);
            taskJson.put("assignTime", System.currentTimeMillis());
            
            // 原子性更新
            zooKeeper.setData(taskPath, taskJson.toJSONString().getBytes(), stat.getVersion());
            
            System.out.println("节点 " + nodeId + " 抢占任务: " + taskName);
        } catch (KeeperException.BadVersionException e) {
            // 版本冲突，说明任务已被其他节点抢占
            System.out.println("任务已被其他节点抢占: " + taskName);
        } catch (Exception e) {
            System.err.println("抢占任务失败: " + e.getMessage());
        }
    }
    
    /**
     * 检查节点是否失效
     */
    private boolean isNodeFailed(String nodeId) {
        try {
            String nodePath = "/nodes/" + nodeId;
            Stat stat = zooKeeper.exists(nodePath, false);
            return stat == null;
        } catch (Exception e) {
            return true;
        }
    }
}
```

## 一致性协议（Raft/Paxos）在调度中的应用

一致性协议是分布式系统中保证数据一致性的核心机制。在任务调度系统中，一致性协议用于确保任务状态、节点信息等关键数据在所有节点间保持一致。

### Raft 协议简介

Raft 是一种易于理解的一致性算法，它将一致性问题分解为领导者选举、日志复制和安全性三个子问题。

```java
// 简化的 Raft 节点状态
public class RaftNode {
    private int nodeId;
    private RaftState state; // Follower, Candidate, Leader
    private int currentTerm;
    private int votedFor;
    private List<LogEntry> log;
    private int commitIndex;
    private int lastApplied;
    private Map<Integer, Integer> nextIndex;
    private Map<Integer, Integer> matchIndex;
    
    // 选举超时时间（毫秒）
    private long electionTimeout;
    private long lastHeartbeat;
    
    public RaftNode(int nodeId) {
        this.nodeId = nodeId;
        this.state = RaftState.FOLLOWER;
        this.currentTerm = 0;
        this.log = new ArrayList<>();
        this.nextIndex = new HashMap<>();
        this.matchIndex = new HashMap<>();
        this.electionTimeout = 150 + new Random().nextInt(150); // 150-300ms
    }
    
    /**
     * 处理选举超时
     */
    public void handleElectionTimeout() {
        if (state == RaftState.FOLLOWER || state == RaftState.CANDIDATE) {
            System.out.println("节点 " + nodeId + " 选举超时，开始选举");
            startElection();
        }
    }
    
    /**
     * 开始选举
     */
    private void startElection() {
        state = RaftState.CANDIDATE;
        currentTerm++;
        votedFor = nodeId;
        int votesReceived = 1; // 自己的一票
        
        // 向其他节点发送投票请求
        RequestVoteRequest request = new RequestVoteRequest(
            currentTerm, nodeId, log.size() - 1, getLastLogTerm());
        
        // 发送投票请求给其他节点（简化实现）
        // 在实际实现中，需要通过网络发送请求并处理响应
    }
    
    /**
     * 处理投票请求
     */
    public RequestVoteResponse handleRequestVote(RequestVoteRequest request) {
        // 检查任期
        if (request.getTerm() < currentTerm) {
            return new RequestVoteResponse(currentTerm, false);
        }
        
        // 更新任期
        if (request.getTerm() > currentTerm) {
            currentTerm = request.getTerm();
            state = RaftState.FOLLOWER;
            votedFor = -1;
        }
        
        // 检查是否已经投票
        if (votedFor == -1 || votedFor == request.getCandidateId()) {
            // 检查日志是否足够新
            if (isLogUpToDate(request.getLastLogIndex(), request.getLastLogTerm())) {
                votedFor = request.getCandidateId();
                return new RequestVoteResponse(currentTerm, true);
            }
        }
        
        return new RequestVoteResponse(currentTerm, false);
    }
    
    /**
     * 检查日志是否足够新
     */
    private boolean isLogUpToDate(int lastLogIndex, int lastLogTerm) {
        int localLastLogIndex = log.size() - 1;
        int localLastLogTerm = localLastLogIndex >= 0 ? log.get(localLastLogIndex).getTerm() : 0;
        
        if (lastLogTerm != localLastLogTerm) {
            return lastLogTerm > localLastLogTerm;
        }
        return lastLogIndex >= localLastLogIndex;
    }
    
    /**
     * 获取最后一条日志的任期
     */
    private int getLastLogTerm() {
        return log.isEmpty() ? 0 : log.get(log.size() - 1).getTerm();
    }
}

// Raft 状态枚举
enum RaftState {
    FOLLOWER, CANDIDATE, LEADER
}

// 投票请求
class RequestVoteRequest {
    private int term;
    private int candidateId;
    private int lastLogIndex;
    private int lastLogTerm;
    
    public RequestVoteRequest(int term, int candidateId, int lastLogIndex, int lastLogTerm) {
        this.term = term;
        this.candidateId = candidateId;
        this.lastLogIndex = lastLogIndex;
        this.lastLogTerm = lastLogTerm;
    }
    
    // getters and setters
    public int getTerm() { return term; }
    public int getCandidateId() { return candidateId; }
    public int getLastLogIndex() { return lastLogIndex; }
    public int getLastLogTerm() { return lastLogTerm; }
}

// 投票响应
class RequestVoteResponse {
    private int term;
    private boolean voteGranted;
    
    public RequestVoteResponse(int term, boolean voteGranted) {
        this.term = term;
        this.voteGranted = voteGranted;
    }
    
    // getters and setters
    public int getTerm() { return term; }
    public boolean isVoteGranted() { return voteGranted; }
}

// 日志条目
class LogEntry {
    private int term;
    private String command;
    
    public LogEntry(int term, String command) {
        this.term = term;
        this.command = command;
    }
    
    // getters and setters
    public int getTerm() { return term; }
    public String getCommand() { return command; }
}
```

### 在调度系统中的应用

在任务调度系统中，可以使用 Raft 协议来维护任务状态的一致性：

```java
public class RaftBasedScheduler {
    private RaftNode raftNode;
    private Map<String, TaskInfo> taskRegistry;
    
    public RaftBasedScheduler(int nodeId) {
        this.raftNode = new RaftNode(nodeId);
        this.taskRegistry = new ConcurrentHashMap<>();
    }
    
    /**
     * 提交任务创建请求
     */
    public boolean submitTaskCreation(String taskId, TaskInfo taskInfo) {
        if (raftNode.getState() != RaftState.LEADER) {
            // 只有领导者才能处理写请求
            return false;
        }
        
        // 创建日志条目
        String command = "CREATE_TASK:" + taskId + ":" + JSON.toJSONString(taskInfo);
        LogEntry entry = new LogEntry(raftNode.getCurrentTerm(), command);
        
        // 将日志条目添加到本地日志
        raftNode.getLog().add(entry);
        
        // 复制日志到其他节点
        replicateLog(entry);
        
        return true;
    }
    
    /**
     * 复制日志到其他节点
     */
    private void replicateLog(LogEntry entry) {
        // 在实际实现中，需要将日志条目发送给其他节点
        // 并等待大多数节点确认后才提交
        System.out.println("复制日志条目: " + entry.getCommand());
    }
    
    /**
     * 应用已提交的日志条目
     */
    public void applyCommittedEntries() {
        int commitIndex = raftNode.getCommitIndex();
        int lastApplied = raftNode.getLastApplied();
        
        for (int i = lastApplied + 1; i <= commitIndex; i++) {
            LogEntry entry = raftNode.getLog().get(i);
            applyLogEntry(entry);
        }
        
        raftNode.setLastApplied(commitIndex);
    }
    
    /**
     * 应用单个日志条目
     */
    private void applyLogEntry(LogEntry entry) {
        String command = entry.getCommand();
        if (command.startsWith("CREATE_TASK:")) {
            String[] parts = command.split(":", 3);
            String taskId = parts[1];
            String taskInfoJson = parts[2];
            
            TaskInfo taskInfo = JSON.parseObject(taskInfoJson, TaskInfo.class);
            taskRegistry.put(taskId, taskInfo);
            
            System.out.println("应用任务创建: " + taskId);
        }
        // 处理其他类型的命令
    }
}

// 任务信息
class TaskInfo {
    private String id;
    private String name;
    private String cronExpression;
    private String jobClass;
    private Map<String, String> parameters;
    
    // constructors, getters and setters
    public TaskInfo() {}
    
    public TaskInfo(String id, String name, String cronExpression, String jobClass) {
        this.id = id;
        this.name = name;
        this.cronExpression = cronExpression;
        this.jobClass = jobClass;
        this.parameters = new HashMap<>();
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    
    public String getJobClass() { return jobClass; }
    public void setJobClass(String jobClass) { this.jobClass = jobClass; }
    
    public Map<String, String> getParameters() { return parameters; }
    public void setParameters(Map<String, String> parameters) { this.parameters = parameters; }
}
```

## 总结

分布式协调机制是构建高可用、一致性的任务调度系统的关键技术。通过合理运用分布式锁、心跳检测、任务抢占和一致性协议，我们可以构建出稳定可靠的分布式调度系统。

1. **分布式锁**：通过 Zookeeper 或 Redis 实现互斥访问，防止任务重复执行
2. **心跳机制**：通过定期心跳检测节点存活状态，及时发现故障节点
3. **任务抢占**：在节点故障时，其他节点可以抢占未完成的任务，保证任务执行
4. **一致性协议**：通过 Raft 或 Paxos 等协议保证关键数据在所有节点间的一致性

在实际应用中，需要根据具体的业务需求和系统规模选择合适的协调机制，并在实现过程中充分考虑性能、可靠性和可维护性等因素。

在下一章中，我们将探讨任务依赖与工作流调度，了解如何处理复杂的任务依赖关系和构建工作流引擎。