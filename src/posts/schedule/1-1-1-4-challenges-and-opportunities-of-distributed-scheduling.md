---
title: 1.4 分布式调度的挑战与机遇
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在前几节中，我们探讨了为什么需要分布式任务调度、分布式系统中的任务需求以及定时任务与实时任务的区别。现在，我们将深入探讨分布式调度系统面临的挑战与机遇，帮助读者更好地理解分布式调度系统的复杂性和发展前景。

## 分布式调度系统的核心挑战

### 1. 一致性与数据同步挑战

在分布式环境中，保持任务状态的一致性是最大的挑战之一。当多个调度节点同时操作同一个任务时，可能会出现数据不一致的问题。

```java
// 分布式任务状态管理示例
public class DistributedTaskManager {
    private final RedisTemplate<String, Object> redisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    
    // 使用Redis分布式锁保证一致性
    public boolean acquireTaskLock(String taskId, long expireTime) {
        String lockKey = "task_lock:" + taskId;
        String lockValue = UUID.randomUUID().toString();
        
        Boolean result = stringRedisTemplate.opsForValue().setIfAbsent(
            lockKey, lockValue, Duration.ofSeconds(expireTime));
            
        if (Boolean.TRUE.equals(result)) {
            // 设置锁的自动过期时间
            stringRedisTemplate.expire(lockKey, expireTime, TimeUnit.SECONDS);
            return true;
        }
        return false;
    }
    
    // 释放任务锁
    public void releaseTaskLock(String taskId) {
        String lockKey = "task_lock:" + taskId;
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                       "return redis.call('del', KEYS[1]) else return 0 end";
        stringRedisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(lockKey),
            getLockValue(taskId) // 存储的锁值
        );
    }
    
    // 更新任务状态
    public void updateTaskStatus(String taskId, TaskStatus status) {
        if (acquireTaskLock(taskId, 30)) {
            try {
                // 获取当前任务信息
                TaskInfo taskInfo = (TaskInfo) redisTemplate.opsForValue()
                    .get("task_info:" + taskId);
                
                if (taskInfo != null) {
                    taskInfo.setStatus(status);
                    taskInfo.setLastUpdateTime(System.currentTimeMillis());
                    
                    // 原子性更新任务信息
                    redisTemplate.opsForValue().set(
                        "task_info:" + taskId, taskInfo, Duration.ofHours(24));
                    
                    // 发布状态变更事件
                    publishTaskStatusChangeEvent(taskId, status);
                }
            } finally {
                releaseTaskLock(taskId);
            }
        } else {
            throw new RuntimeException("无法获取任务锁，任务可能正在被其他节点处理");
        }
    }
}
```

### 2. 容错与高可用性挑战

分布式调度系统必须具备强大的容错能力，能够在节点故障时保证任务的正常执行。

```python
# 节点健康检查与故障转移示例
import asyncio
import aiohttp
import json
from typing import Dict, List, Optional
import time

class NodeHealthChecker:
    def __init__(self, nodes: List[str], check_interval: int = 30):
        self.nodes = nodes
        self.check_interval = check_interval
        self.node_status: Dict[str, Dict] = {}
        self.failed_nodes: List[str] = []
        self.healthy_nodes: List[str] = []
        
    async def check_node_health(self, node_url: str) -> bool:
        """检查节点健康状态"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{node_url}/health", timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("status") == "healthy"
        except Exception as e:
            print(f"检查节点 {node_url} 健康状态时出错: {e}")
        return False
    
    async def monitor_nodes(self):
        """持续监控节点状态"""
        while True:
            try:
                # 并发检查所有节点
                tasks = [self.check_node_health(node) for node in self.nodes]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                current_time = time.time()
                new_healthy_nodes = []
                new_failed_nodes = []
                
                for i, result in enumerate(results):
                    node_url = self.nodes[i]
                    is_healthy = isinstance(result, bool) and result
                    
                    # 更新节点状态
                    self.node_status[node_url] = {
                        "healthy": is_healthy,
                        "last_check": current_time,
                        "error": str(result) if not isinstance(result, bool) else None
                    }
                    
                    if is_healthy:
                        new_healthy_nodes.append(node_url)
                    else:
                        new_failed_nodes.append(node_url)
                
                # 更新健康和故障节点列表
                self.healthy_nodes = new_healthy_nodes
                self.failed_nodes = new_failed_nodes
                
                print(f"健康节点: {len(self.healthy_nodes)}, 故障节点: {len(self.failed_nodes)}")
                
                # 如果有节点故障，触发故障转移
                if self.failed_nodes:
                    await self.handle_node_failures()
                
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                print(f"节点监控过程中出错: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def handle_node_failures(self):
        """处理节点故障"""
        print(f"检测到 {len(self.failed_nodes)} 个节点故障，开始故障转移...")
        
        # 重新分配故障节点上的任务
        for failed_node in self.failed_nodes:
            await self.reassign_tasks_from_node(failed_node)
    
    async def reassign_tasks_from_node(self, failed_node: str):
        """重新分配指定节点上的任务"""
        try:
            # 获取故障节点上的任务列表
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{failed_node}/tasks") as response:
                    if response.status == 200:
                        tasks = await response.json()
                        
                        # 将任务重新分配给健康节点
                        for task in tasks:
                            await self.assign_task_to_healthy_node(task)
        except Exception as e:
            print(f"重新分配 {failed_node} 上的任务时出错: {e}")
    
    async def assign_task_to_healthy_node(self, task: Dict):
        """将任务分配给健康节点"""
        if not self.healthy_nodes:
            print("没有可用的健康节点来接管任务")
            return
        
        # 简单的负载均衡策略：选择任务数最少的节点
        target_node = await self.select_least_loaded_node()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{target_node}/tasks",
                    json=task,
                    timeout=10
                ) as response:
                    if response.status == 200:
                        print(f"任务 {task.get('id')} 已成功转移到节点 {target_node}")
                    else:
                        print(f"任务转移失败，状态码: {response.status}")
        except Exception as e:
            print(f"任务转移过程中出错: {e}")
    
    async def select_least_loaded_node(self) -> Optional[str]:
        """选择负载最少的节点"""
        if not self.healthy_nodes:
            return None
        
        try:
            load_info = {}
            async with aiohttp.ClientSession() as session:
                for node in self.healthy_nodes:
                    try:
                        async with session.get(f"{node}/load") as response:
                            if response.status == 200:
                                data = await response.json()
                                load_info[node] = data.get("task_count", 0)
                    except Exception:
                        load_info[node] = float('inf')  # 无法获取负载信息的节点设为最高负载
            
            # 返回任务数最少的节点
            return min(load_info, key=load_info.get) if load_info else self.healthy_nodes[0]
        except Exception as e:
            print(f"选择负载最少节点时出错: {e}")
            return self.healthy_nodes[0] if self.healthy_nodes else None

# 使用示例
async def main():
    nodes = [
        "http://scheduler-node-1:8080",
        "http://scheduler-node-2:8080",
        "http://scheduler-node-3:8080"
    ]
    
    health_checker = NodeHealthChecker(nodes)
    
    # 启动节点监控
    await health_checker.monitor_nodes()

# 运行监控
# asyncio.run(main())
```

### 3. 性能与扩展性挑战

随着任务数量的增长，调度系统的性能和扩展性成为关键挑战。

```go
// 高性能任务调度器示例
package scheduler

import (
    "context"
    "sync"
    "time"
    "github.com/redis/go-redis/v9"
    "go.uber.org/zap"
)

type HighPerformanceScheduler struct {
    redisClient *redis.Client
    logger      *zap.Logger
    taskQueue   chan *Task
    workerPool  chan chan *Task
    maxWorkers  int
    quit        chan bool
    wg          sync.WaitGroup
}

type Task struct {
    ID          string            `json:"id"`
    Name        string            `json:"name"`
    CronExpr    string            `json:"cron_expr"`
    Payload     map[string]interface{} `json:"payload"`
    NextRunTime time.Time         `json:"next_run_time"`
    Status      string            `json:"status"`
}

func NewHighPerformanceScheduler(
    redisClient *redis.Client,
    logger *zap.Logger,
    maxWorkers int,
) *HighPerformanceScheduler {
    return &HighPerformanceScheduler{
        redisClient: redisClient,
        logger:      logger,
        taskQueue:   make(chan *Task, 10000),
        workerPool:  make(chan chan *Task, maxWorkers),
        maxWorkers:  maxWorkers,
        quit:        make(chan bool),
    }
}

// 启动调度器
func (s *HighPerformanceScheduler) Start() {
    // 启动工作池
    for i := 0; i < s.maxWorkers; i++ {
        worker := NewWorker(s.workerPool, s.redisClient, s.logger)
        worker.Start()
    }
    
    // 启动任务分发器
    go s.dispatch()
    
    // 启动任务扫描器
    go s.scanTasks()
    
    s.logger.Info("高性能调度器已启动", zap.Int("workers", s.maxWorkers))
}

// 任务分发
func (s *HighPerformanceScheduler) dispatch() {
    for {
        select {
        case task := <-s.taskQueue:
            // 等待可用的工作通道
            workerChannel := <-s.workerPool
            // 将任务发送给工作协程
            workerChannel <- task
        case <-s.quit:
            return
        }
    }
}

// 扫描待执行任务
func (s *HighPerformanceScheduler) scanTasks() {
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            s.scanDueTasks()
        case <-s.quit:
            return
        }
    }
}

// 扫描到期任务
func (s *HighPerformanceScheduler) scanDueTasks() {
    ctx := context.Background()
    
    // 使用Redis ZSet存储任务，score为下次执行时间
    now := time.Now().Unix()
    tasks, err := s.redisClient.ZRangeByScore(ctx, "scheduled_tasks", &redis.ZRangeBy{
        Min: "0",
        Max: fmt.Sprintf("%d", now),
        Offset: 0,
        Count: 1000, // 每次最多处理1000个任务
    }).Result()
    
    if err != nil {
        s.logger.Error("扫描到期任务失败", zap.Error(err))
        return
    }
    
    for _, taskID := range tasks {
        // 异步处理任务
        go s.processTask(taskID)
    }
}

// 处理单个任务
func (s *HighPerformanceScheduler) processTask(taskID string) {
    ctx := context.Background()
    
    // 获取任务详情
    taskData, err := s.redisClient.HGetAll(ctx, "task:"+taskID).Result()
    if err != nil {
        s.logger.Error("获取任务详情失败", zap.String("task_id", taskID), zap.Error(err))
        return
    }
    
    if len(taskData) == 0 {
        s.logger.Warn("任务不存在", zap.String("task_id", taskID))
        return
    }
    
    // 解析任务数据
    task := &Task{
        ID:      taskData["id"],
        Name:    taskData["name"],
        CronExpr: taskData["cron_expr"],
        Status:  taskData["status"],
    }
    
    // 将任务放入队列等待处理
    select {
    case s.taskQueue <- task:
        s.logger.Debug("任务已加入处理队列", zap.String("task_id", taskID))
    default:
        s.logger.Warn("任务队列已满，任务被丢弃", zap.String("task_id", taskID))
    }
}

// 工作协程
type Worker struct {
    workerPool  chan chan *Task
    taskChannel chan *Task
    redisClient *redis.Client
    logger      *zap.Logger
    quit        chan bool
}

func NewWorker(workerPool chan chan *Task, redisClient *redis.Client, logger *zap.Logger) *Worker {
    return &Worker{
        workerPool:  workerPool,
        taskChannel: make(chan *Task),
        redisClient: redisClient,
        logger:      logger,
        quit:        make(chan bool),
    }
}

func (w *Worker) Start() {
    go func() {
        for {
            // 将自己的任务通道注册到工作池
            w.workerPool <- w.taskChannel
            
            select {
            case task := <-w.taskChannel:
                w.executeTask(task)
            case <-w.quit:
                return
            }
        }
    }()
}

func (w *Worker) executeTask(task *Task) {
    w.logger.Info("开始执行任务", zap.String("task_id", task.ID), zap.String("task_name", task.Name))
    
    // 更新任务状态为执行中
    ctx := context.Background()
    err := w.redisClient.HSet(ctx, "task:"+task.ID, "status", "running").Err()
    if err != nil {
        w.logger.Error("更新任务状态失败", zap.String("task_id", task.ID), zap.Error(err))
        return
    }
    
    // 执行任务逻辑（这里简化处理）
    startTime := time.Now()
    
    // 模拟任务执行
    time.Sleep(100 * time.Millisecond)
    
    executionTime := time.Since(startTime)
    
    // 更新任务状态为已完成
    err = w.redisClient.HMSet(ctx, "task:"+task.ID, map[string]interface{}{
        "status": "completed",
        "last_execution_time": executionTime.String(),
        "last_run_time": time.Now().Format(time.RFC3339),
    }).Err()
    
    if err != nil {
        w.logger.Error("更新任务完成状态失败", zap.String("task_id", task.ID), zap.Error(err))
        return
    }
    
    w.logger.Info("任务执行完成", 
        zap.String("task_id", task.ID), 
        zap.String("task_name", task.Name),
        zap.Duration("execution_time", executionTime))
}

// 停止调度器
func (s *HighPerformanceScheduler) Stop() {
    close(s.quit)
    s.wg.Wait()
    s.logger.Info("高性能调度器已停止")
}
```

## 分布式调度系统的发展机遇

### 1. 云原生技术融合

随着云原生技术的快速发展，分布式调度系统有了更多创新机会：

```yaml
# Kubernetes 自定义调度器配置示例
apiVersion: v1
kind: Pod
metadata:
  name: custom-scheduler
  labels:
    component: scheduler
spec:
  serviceAccountName: custom-scheduler
  containers:
  - name: custom-scheduler
    image: custom-scheduler:latest
    imagePullPolicy: IfNotPresent
    args:
      - --scheduler-name=custom-scheduler
      - --leader-elect=true
      - --leader-elect-lease-duration=15s
      - --leader-elect-renew-deadline=10s
      - --leader-elect-retry-period=2s
    resources:
      requests:
        cpu: "50m"
        memory: "100Mi"
      limits:
        cpu: "100m"
        memory: "200Mi"
    livenessProbe:
      httpGet:
        path: /healthz
        port: 10259
        scheme: HTTPS
      initialDelaySeconds: 15
    readinessProbe:
      httpGet:
        path: /healthz
        port: 10259
        scheme: HTTPS
---
# 自定义调度策略配置
apiVersion: kubescheduler.config.k8s.io/v1beta3
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: custom-scheduler
  plugins:
    queueSort:
      enabled:
      - name: PrioritySort
    preFilter:
      enabled:
      - name: NodeResourcesFit
      - name: NodePorts
      - name: VolumeRestrictions
    filter:
      enabled:
      - name: NodeResourcesFit
      - name: NodePorts
      - name: VolumeRestrictions
      - name: NodeAffinity
      - name: NodeUnschedulable
      - name: TaintToleration
      - name: PodTopologySpread
    preScore:
      enabled:
      - name: SelectorSpread
      - name: NodeResourcesFit
    score:
      enabled:
      - name: NodeResourcesFit
        weight: 1
      - name: ImageLocality
        weight: 1
      - name: SelectorSpread
        weight: 1
      - name: NodeAffinity
        weight: 1
      - name: PodTopologySpread
        weight: 2
  pluginConfig:
  - name: NodeResourcesFit
    args:
      scoringStrategy:
        type: LeastAllocated
        resources:
        - name: cpu
          weight: 1
        - name: memory
          weight: 1
```

### 2. AI 驱动的智能调度

人工智能技术为调度系统带来了智能化的机遇：

```python
# 基于机器学习的任务调度优化示例
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import pandas as pd
import joblib
from typing import Dict, List, Tuple

class IntelligentTaskScheduler:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_columns = [
            'task_complexity', 'resource_demand', 'historical_execution_time',
            'system_load', 'node_count', 'memory_usage', 'cpu_usage'
        ]
    
    def prepare_features(self, task_history: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """准备训练特征和标签"""
        features = []
        labels = []
        
        for record in task_history:
            # 特征向量
            feature_vector = [
                record.get('complexity', 1),  # 任务复杂度
                record.get('resource_demand', 1),  # 资源需求
                record.get('avg_execution_time', 0),  # 平均执行时间
                record.get('system_load', 0.5),  # 系统负载
                record.get('available_nodes', 1),  # 可用节点数
                record.get('memory_usage', 0.5),  # 内存使用率
                record.get('cpu_usage', 0.5),  # CPU使用率
            ]
            
            features.append(feature_vector)
            labels.append(record.get('actual_execution_time', 0))
        
        return np.array(features), np.array(labels)
    
    def train(self, task_history: List[Dict]):
        """训练智能调度模型"""
        if not task_history:
            raise ValueError("任务历史数据不能为空")
        
        X, y = self.prepare_features(task_history)
        
        # 特征标准化
        X_scaled = self.scaler.fit_transform(X)
        
        # 训练模型
        self.model.fit(X_scaled, y)
        self.is_trained = True
        
        print(f"模型训练完成，使用了 {len(task_history)} 条历史记录")
    
    def predict_execution_time(self, task_features: Dict) -> float:
        """预测任务执行时间"""
        if not self.is_trained:
            raise RuntimeError("模型尚未训练")
        
        # 构造特征向量
        feature_vector = np.array([[
            task_features.get('complexity', 1),
            task_features.get('resource_demand', 1),
            task_features.get('avg_execution_time', 0),
            task_features.get('system_load', 0.5),
            task_features.get('available_nodes', 1),
            task_features.get('memory_usage', 0.5),
            task_features.get('cpu_usage', 0.5),
        ]])
        
        # 特征标准化
        feature_scaled = self.scaler.transform(feature_vector)
        
        # 预测执行时间
        predicted_time = self.model.predict(feature_scaled)[0]
        return max(0, predicted_time)  # 确保预测时间为非负数
    
    def optimize_scheduling(self, tasks: List[Dict], nodes: List[Dict]) -> List[Dict]:
        """优化任务调度"""
        if not self.is_trained:
            raise RuntimeError("模型尚未训练")
        
        # 为每个任务预测执行时间
        for task in tasks:
            task_features = {
                'complexity': task.get('complexity', 1),
                'resource_demand': task.get('resource_demand', 1),
                'avg_execution_time': task.get('avg_execution_time', 0),
                'system_load': self.calculate_system_load(nodes),
                'available_nodes': len([n for n in nodes if n.get('status') == 'healthy']),
                'memory_usage': self.calculate_avg_memory_usage(nodes),
                'cpu_usage': self.calculate_avg_cpu_usage(nodes),
            }
            
            predicted_time = self.predict_execution_time(task_features)
            task['predicted_execution_time'] = predicted_time
        
        # 根据预测执行时间排序任务
        tasks.sort(key=lambda x: x['predicted_execution_time'])
        
        # 分配任务到节点
        scheduled_tasks = self.assign_tasks_to_nodes(tasks, nodes)
        return scheduled_tasks
    
    def calculate_system_load(self, nodes: List[Dict]) -> float:
        """计算系统负载"""
        if not nodes:
            return 0.0
        
        total_load = sum(node.get('load', 0) for node in nodes)
        return total_load / len(nodes)
    
    def calculate_avg_memory_usage(self, nodes: List[Dict]) -> float:
        """计算平均内存使用率"""
        if not nodes:
            return 0.0
        
        total_memory = sum(node.get('memory_usage', 0) for node in nodes)
        return total_memory / len(nodes)
    
    def calculate_avg_cpu_usage(self, nodes: List[Dict]) -> float:
        """计算平均CPU使用率"""
        if not nodes:
            return 0.0
        
        total_cpu = sum(node.get('cpu_usage', 0) for node in nodes)
        return total_cpu / len(nodes)
    
    def assign_tasks_to_nodes(self, tasks: List[Dict], nodes: List[Dict]) -> List[Dict]:
        """将任务分配到节点"""
        scheduled_tasks = []
        
        # 按节点负载排序
        nodes.sort(key=lambda x: x.get('load', 0))
        
        for task in tasks:
            # 选择负载最低的健康节点
            target_node = None
            for node in nodes:
                if node.get('status') == 'healthy':
                    target_node = node
                    break
            
            if target_node:
                scheduled_task = task.copy()
                scheduled_task['assigned_node'] = target_node.get('id')
                scheduled_task['scheduled_time'] = time.time()
                scheduled_tasks.append(scheduled_task)
                
                # 更新节点负载
                target_node['load'] = target_node.get('load', 0) + 1
            else:
                # 如果没有可用节点，将任务标记为待调度
                pending_task = task.copy()
                pending_task['status'] = 'pending'
                scheduled_tasks.append(pending_task)
        
        return scheduled_tasks
    
    def save_model(self, filepath: str):
        """保存训练好的模型"""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'is_trained': self.is_trained,
            'feature_columns': self.feature_columns
        }
        joblib.dump(model_data, filepath)
        print(f"模型已保存到 {filepath}")
    
    def load_model(self, filepath: str):
        """加载训练好的模型"""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.is_trained = model_data['is_trained']
        self.feature_columns = model_data['feature_columns']
        print(f"模型已从 {filepath} 加载")

# 使用示例
def example_usage():
    # 创建调度器实例
    scheduler = IntelligentTaskScheduler()
    
    # 模拟历史任务数据
    task_history = [
        {
            'complexity': 2,
            'resource_demand': 1,
            'avg_execution_time': 10.5,
            'system_load': 0.3,
            'available_nodes': 3,
            'memory_usage': 0.4,
            'cpu_usage': 0.35,
            'actual_execution_time': 12.1
        },
        # ... 更多历史数据
    ]
    
    # 训练模型
    scheduler.train(task_history)
    
    # 保存模型
    scheduler.save_model('task_scheduler_model.pkl')
    
    # 预测新任务的执行时间
    new_task_features = {
        'complexity': 3,
        'resource_demand': 2,
        'avg_execution_time': 15.2,
        'system_load': 0.45,
        'available_nodes': 2,
        'memory_usage': 0.6,
        'cpu_usage': 0.5
    }
    
    predicted_time = scheduler.predict_execution_time(new_task_features)
    print(f"预测任务执行时间: {predicted_time:.2f} 秒")

# example_usage()
```

### 3. 边缘计算调度机遇

边缘计算为分布式调度带来了新的应用场景：

```javascript
// 边缘计算环境下的任务调度示例
class EdgeTaskScheduler {
    constructor() {
        this.edgeNodes = new Map(); // 边缘节点信息
        this.tasks = new Map();     // 任务队列
        this.networkTopology = {};  // 网络拓扑结构
    }
    
    // 注册边缘节点
    registerEdgeNode(nodeId, capabilities) {
        this.edgeNodes.set(nodeId, {
            id: nodeId,
            capabilities: capabilities,
            status: 'online',
            load: 0,
            lastHeartbeat: Date.now(),
            location: capabilities.location || { lat: 0, lng: 0 }
        });
        
        console.log(`边缘节点 ${nodeId} 已注册`);
    }
    
    // 节点心跳检测
    heartbeat(nodeId) {
        const node = this.edgeNodes.get(nodeId);
        if (node) {
            node.lastHeartbeat = Date.now();
            node.status = 'online';
        }
    }
    
    // 检查节点状态
    checkNodeStatus() {
        const now = Date.now();
        const timeout = 30000; // 30秒超时
        
        for (const [nodeId, node] of this.edgeNodes) {
            if (now - node.lastHeartbeat > timeout) {
                node.status = 'offline';
                console.warn(`边缘节点 ${nodeId} 已离线`);
                
                // 重新调度该节点上的任务
                this.reassignTasksFromNode(nodeId);
            }
        }
    }
    
    // 提交边缘任务
    submitEdgeTask(taskId, requirements, constraints) {
        const task = {
            id: taskId,
            requirements: requirements,
            constraints: constraints,
            status: 'pending',
            submitTime: Date.now(),
            assignedNode: null
        };
        
        this.tasks.set(taskId, task);
        
        // 尝试调度任务
        this.scheduleTask(taskId);
        
        return task;
    }
    
    // 智能调度任务
    scheduleTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'pending') {
            return;
        }
        
        // 查找合适的边缘节点
        const suitableNodes = this.findSuitableNodes(task);
        
        if (suitableNodes.length === 0) {
            console.warn(`没有找到适合任务 ${taskId} 的边缘节点`);
            return;
        }
        
        // 选择最优节点
        const bestNode = this.selectBestNode(suitableNodes, task);
        
        if (bestNode) {
            // 分配任务到节点
            this.assignTaskToNode(taskId, bestNode.id);
        }
    }
    
    // 查找合适的节点
    findSuitableNodes(task) {
        const suitableNodes = [];
        
        for (const [nodeId, node] of this.edgeNodes) {
            // 检查节点状态
            if (node.status !== 'online') {
                continue;
            }
            
            // 检查资源能力
            if (!this.checkNodeCapabilities(node, task.requirements)) {
                continue;
            }
            
            // 检查约束条件
            if (!this.checkConstraints(node, task.constraints)) {
                continue;
            }
            
            suitableNodes.push(node);
        }
        
        return suitableNodes;
    }
    
    // 检查节点能力
    checkNodeCapabilities(node, requirements) {
        // 检查计算能力
        if (requirements.cpu && node.capabilities.cpu < requirements.cpu) {
            return false;
        }
        
        // 检查内存
        if (requirements.memory && node.capabilities.memory < requirements.memory) {
            return false;
        }
        
        // 检查存储
        if (requirements.storage && node.capabilities.storage < requirements.storage) {
            return false;
        }
        
        // 检查网络
        if (requirements.bandwidth && node.capabilities.bandwidth < requirements.bandwidth) {
            return false;
        }
        
        return true;
    }
    
    // 检查约束条件
    checkConstraints(node, constraints) {
        if (!constraints) {
            return true;
        }
        
        // 检查地理位置约束
        if (constraints.location) {
            const distance = this.calculateDistance(
                node.location, 
                constraints.location
            );
            
            if (distance > (constraints.maxDistance || 100000)) {
                return false;
            }
        }
        
        // 检查延迟约束
        if (constraints.maxLatency) {
            const latency = this.estimateLatency(node.id);
            if (latency > constraints.maxLatency) {
                return false;
            }
        }
        
        return true;
    }
    
    // 选择最佳节点
    selectBestNode(nodes, task) {
        // 基于多个因素评分
        const scoredNodes = nodes.map(node => {
            const score = this.calculateNodeScore(node, task);
            return { node, score };
        });
        
        // 按分数排序
        scoredNodes.sort((a, b) => b.score - a.score);
        
        return scoredNodes.length > 0 ? scoredNodes[0].node : null;
    }
    
    // 计算节点评分
    calculateNodeScore(node, task) {
        let score = 0;
        
        // 负载因子 (负载越低分数越高)
        score += (1 - node.load / 100) * 30;
        
        // 能力匹配因子
        if (task.requirements.cpu) {
            score += (node.capabilities.cpu / task.requirements.cpu) * 20;
        }
        
        if (task.requirements.memory) {
            score += (node.capabilities.memory / task.requirements.memory) * 20;
        }
        
        // 地理位置因子 (距离越近分数越高)
        if (task.constraints && task.constraints.location) {
            const distance = this.calculateDistance(
                node.location, 
                task.constraints.location
            );
            score += (1 - Math.min(distance / 100000, 1)) * 20;
        }
        
        // 网络质量因子
        const latency = this.estimateLatency(node.id);
        score += (1 - Math.min(latency / 1000, 1)) * 10;
        
        return score;
    }
    
    // 分配任务到节点
    assignTaskToNode(taskId, nodeId) {
        const task = this.tasks.get(taskId);
        const node = this.edgeNodes.get(nodeId);
        
        if (!task || !node) {
            return false;
        }
        
        task.status = 'assigned';
        task.assignedNode = nodeId;
        task.assignTime = Date.now();
        
        node.load += 1;
        
        console.log(`任务 ${taskId} 已分配到边缘节点 ${nodeId}`);
        
        // 通知节点执行任务
        this.notifyNodeToExecuteTask(nodeId, task);
        
        return true;
    }
    
    // 通知节点执行任务
    async notifyNodeToExecuteTask(nodeId, task) {
        try {
            const response = await fetch(`http://${nodeId}:8080/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(task)
            });
            
            if (response.ok) {
                console.log(`节点 ${nodeId} 已接收任务 ${task.id}`);
            } else {
                console.error(`节点 ${nodeId} 任务接收失败: ${response.status}`);
                // 重新调度任务
                task.status = 'pending';
                task.assignedNode = null;
                this.scheduleTask(task.id);
            }
        } catch (error) {
            console.error(`通知节点 ${nodeId} 执行任务时出错:`, error);
            // 重新调度任务
            task.status = 'pending';
            task.assignedNode = null;
            this.scheduleTask(task.id);
        }
    }
    
    // 重新分配节点上的任务
    reassignTasksFromNode(nodeId) {
        for (const [taskId, task] of this.tasks) {
            if (task.assignedNode === nodeId && task.status === 'assigned') {
                console.log(`重新调度节点 ${nodeId} 上的任务 ${taskId}`);
                task.status = 'pending';
                task.assignedNode = null;
                this.scheduleTask(taskId);
            }
        }
    }
    
    // 计算地理位置距离
    calculateDistance(loc1, loc2) {
        const R = 6371e3; // 地球半径（米）
        const φ1 = loc1.lat * Math.PI/180;
        const φ2 = loc2.lat * Math.PI/180;
        const Δφ = (loc2.lat-loc1.lat) * Math.PI/180;
        const Δλ = (loc2.lng-loc1.lng) * Math.PI/180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    // 估算网络延迟
    estimateLatency(nodeId) {
        // 简化的延迟估算，实际应用中可能需要更复杂的算法
        const node = this.edgeNodes.get(nodeId);
        if (!node) return 1000;
        
        // 基于地理位置估算延迟
        const centralLocation = { lat: 39.9042, lng: 116.4074 }; // 北京
        const distance = this.calculateDistance(node.location, centralLocation);
        
        // 假设光速传播，每1000公里增加10ms延迟
        return Math.max(10, distance / 100000 * 10);
    }
    
    // 启动调度器
    start() {
        // 定期检查节点状态
        setInterval(() => {
            this.checkNodeStatus();
        }, 10000); // 每10秒检查一次
        
        // 定期调度待处理任务
        setInterval(() => {
            for (const [taskId, task] of this.tasks) {
                if (task.status === 'pending') {
                    this.scheduleTask(taskId);
                }
            }
        }, 5000); // 每5秒检查一次待处理任务
        
        console.log('边缘任务调度器已启动');
    }
}

// 使用示例
const scheduler = new EdgeTaskScheduler();

// 注册边缘节点
scheduler.registerEdgeNode('edge-001', {
    cpu: 4,
    memory: 8192,
    storage: 128000,
    bandwidth: 100,
    location: { lat: 39.9042, lng: 116.4074 }
});

scheduler.registerEdgeNode('edge-002', {
    cpu: 2,
    memory: 4096,
    storage: 64000,
    bandwidth: 50,
    location: { lat: 31.2304, lng: 121.4737 }
});

// 启动调度器
scheduler.start();

// 提交任务
scheduler.submitEdgeTask('task-001', {
    cpu: 2,
    memory: 2048
}, {
    location: { lat: 39.9042, lng: 116.4074 },
    maxDistance: 50000 // 50公里
});
```

## 总结与展望

分布式调度系统在面临一致性、容错性、性能扩展等挑战的同时，也迎来了云原生融合、AI智能化、边缘计算等发展机遇。未来的分布式调度系统将更加智能、高效和可靠。

关键要点包括：

1. **核心技术挑战**：一致性保证、容错机制、性能优化是分布式调度系统的核心挑战
2. **发展机遇**：云原生技术、人工智能、边缘计算为调度系统带来了新的发展机遇
3. **发展趋势**：智能化、自适应、多环境融合是未来调度系统的发展方向

在下一节中，我们将探讨任务调度的核心概念，包括任务、调度器、执行器等基本组件，以及时间表达式、执行模式等关键要素。