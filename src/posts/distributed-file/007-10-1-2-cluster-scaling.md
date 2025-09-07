---
title: 集群扩缩容：弹性扩缩容流程与数据迁移影响控制
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台的运维生命周期中，随着业务的发展和需求的变化，存储集群的容量需求也会发生波动。为了应对这种变化，集群需要具备弹性扩缩容的能力，即能够根据实际需求动态地增加或减少节点资源。然而，扩缩容操作不仅涉及硬件资源的调整，更重要的是要确保在调整过程中数据的完整性和服务的连续性。

## 10.2.1 弹性扩缩容流程

弹性扩缩容是指根据系统负载、存储需求等指标自动或手动调整集群规模的过程。一个完善的扩缩容流程需要考虑资源准备、数据重新分布、服务重新配置等多个环节。

### 10.2.1.1 扩容流程设计

```python
# 扩容流程实现
import time
import threading
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime, timedelta
import random

class ClusterNode:
    """集群节点"""
    
    def __init__(self, node_id: str, node_type: str, capacity_gb: int):
        self.node_id = node_id
        self.node_type = node_type  # metadata, data, mixed
        self.capacity_gb = capacity_gb
        self.used_gb = 0
        self.status = "active"  # active, joining, leaving, inactive
        self.last_heartbeat = datetime.now()
        self.data_replicas = {}  # data_id -> replica_info

class DataPlacementManager:
    """数据放置管理器"""
    
    def __init__(self):
        self.nodes: Dict[str, ClusterNode] = {}
        self.data_objects: Dict[str, Dict[str, Any]] = {}  # data_id -> info
        self.placement_policy = "consistent_hashing"  # or "replication", "erasure_coding"
    
    def add_node(self, node: ClusterNode):
        """添加节点"""
        self.nodes[node.node_id] = node
        print(f"节点 {node.node_id} 已添加到集群")
    
    def remove_node(self, node_id: str) -> bool:
        """移除节点"""
        if node_id not in self.nodes:
            print(f"节点 {node_id} 不存在")
            return False
        
        node = self.nodes[node_id]
        if node.status != "active":
            print(f"节点 {node_id} 状态不正确: {node.status}")
            return False
        
        # 标记节点为离开状态
        node.status = "leaving"
        print(f"节点 {node_id} 标记为离开状态")
        
        # 迁移数据
        self._migrate_data_from_node(node_id)
        
        # 从集群中移除节点
        del self.nodes[node_id]
        print(f"节点 {node_id} 已从集群中移除")
        return True
    
    def scale_up(self, new_nodes: List[ClusterNode], 
                rebalance_timeout: int = 300) -> bool:
        """扩容集群"""
        print(f"开始扩容，新增 {len(new_nodes)} 个节点")
        
        # 1. 添加新节点
        for node in new_nodes:
            self.add_node(node)
            node.status = "joining"
        
        # 2. 等待节点准备就绪
        time.sleep(5)  # 模拟节点启动时间
        
        # 3. 将新节点标记为活动状态
        for node in new_nodes:
            node.status = "active"
        
        # 4. 重新平衡数据
        print("开始数据重新平衡...")
        self._rebalance_cluster(rebalance_timeout)
        
        print("集群扩容完成")
        return True
    
    def scale_down(self, node_ids: List[str], 
                  rebalance_timeout: int = 300) -> bool:
        """缩容集群"""
        print(f"开始缩容，移除 {len(node_ids)} 个节点: {node_ids}")
        
        # 1. 验证节点
        for node_id in node_ids:
            if node_id not in self.nodes:
                print(f"节点 {node_id} 不存在")
                return False
        
        # 2. 逐个移除节点
        for node_id in node_ids:
            self.remove_node(node_id)
        
        # 3. 重新平衡数据
        print("开始数据重新平衡...")
        self._rebalance_cluster(rebalance_timeout)
        
        print("集群缩容完成")
        return True
    
    def _migrate_data_from_node(self, node_id: str):
        """从节点迁移数据"""
        if node_id not in self.nodes:
            return
        
        node = self.nodes[node_id]
        print(f"开始从节点 {node_id} 迁移数据，共 {len(node.data_replicas)} 个副本")
        
        # 迁移每个数据副本
        migrated_count = 0
        for data_id, replica_info in list(node.data_replicas.items()):
            # 寻找目标节点
            target_node = self._find_target_node_for_data(data_id, exclude_node=node_id)
            if target_node:
                # 迁移数据
                self._migrate_data_replica(data_id, node_id, target_node.node_id)
                # 更新元数据
                del node.data_replicas[data_id]
                migrated_count += 1
            else:
                print(f"无法为数据 {data_id} 找到迁移目标节点")
        
        print(f"从节点 {node_id} 成功迁移 {migrated_count} 个数据副本")
    
    def _find_target_node_for_data(self, data_id: str, exclude_node: str) -> Optional[ClusterNode]:
        """为数据寻找目标节点"""
        # 简化实现：选择使用率最低的活动节点
        active_nodes = [node for node in self.nodes.values() 
                       if node.status == "active" and node.node_id != exclude_node]
        
        if not active_nodes:
            return None
        
        # 选择使用率最低的节点
        target_node = min(active_nodes, key=lambda n: n.used_gb / n.capacity_gb)
        
        # 检查容量是否足够
        data_size = self.data_objects.get(data_id, {}).get("size_gb", 1)
        if target_node.used_gb + data_size <= target_node.capacity_gb:
            return target_node
        
        return None
    
    def _migrate_data_replica(self, data_id: str, source_node_id: str, target_node_id: str):
        """迁移数据副本"""
        print(f"迁移数据 {data_id} 从节点 {source_node_id} 到节点 {target_node_id}")
        
        # 模拟数据迁移过程
        time.sleep(0.1)  # 模拟迁移时间
        
        # 更新目标节点的元数据
        if target_node_id in self.nodes:
            target_node = self.nodes[target_node_id]
            target_node.data_replicas[data_id] = {
                "source": source_node_id,
                "migrated_at": datetime.now()
            }
        
        # 更新数据对象的元数据
        if data_id in self.data_objects:
            if "replicas" not in self.data_objects[data_id]:
                self.data_objects[data_id]["replicas"] = []
            self.data_objects[data_id]["replicas"].append(target_node_id)
    
    def _rebalance_cluster(self, timeout: int):
        """重新平衡集群"""
        start_time = time.time()
        
        # 计算集群使用率
        total_capacity = sum(node.capacity_gb for node in self.nodes.values() 
                           if node.status == "active")
        total_used = sum(node.used_gb for node in self.nodes.values() 
                        if node.status == "active")
        
        if total_capacity == 0:
            print("集群容量为0，无法重新平衡")
            return
        
        target_utilization = total_used / total_capacity
        print(f"目标使用率: {target_utilization:.2%}")
        
        # 简化实现：这里只打印信息，实际实现会进行数据迁移
        print("执行数据重新平衡...")
        time.sleep(2)  # 模拟重新平衡时间
        
        print("集群重新平衡完成")
    
    def get_cluster_status(self) -> Dict[str, Any]:
        """获取集群状态"""
        active_nodes = [node for node in self.nodes.values() if node.status == "active"]
        
        total_capacity = sum(node.capacity_gb for node in active_nodes)
        total_used = sum(node.used_gb for node in active_nodes)
        
        return {
            "total_nodes": len(self.nodes),
            "active_nodes": len(active_nodes),
            "total_capacity_gb": total_capacity,
            "total_used_gb": total_used,
            "utilization": total_used / total_capacity if total_capacity > 0 else 0,
            "nodes": [
                {
                    "node_id": node.node_id,
                    "status": node.status,
                    "capacity_gb": node.capacity_gb,
                    "used_gb": node.used_gb,
                    "utilization": node.used_gb / node.capacity_gb if node.capacity_gb > 0 else 0
                }
                for node in self.nodes.values()
            ]
        }

class AutoScaler:
    """自动扩缩容器"""
    
    def __init__(self, placement_manager: DataPlacementManager):
        self.placement_manager = placement_manager
        self.scaling_policies: Dict[str, Dict[str, Any]] = {}
        self.monitoring = False
        self.monitor_thread: Optional[threading.Thread] = None
    
    def set_scaling_policy(self, policy_name: str, policy_config: Dict[str, Any]):
        """设置扩缩容策略"""
        self.scaling_policies[policy_name] = policy_config
        print(f"设置扩缩容策略: {policy_name}")
    
    def start_monitoring(self):
        """开始监控"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_cluster)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        print("自动扩缩容监控已启动")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        print("自动扩缩容监控已停止")
    
    def _monitor_cluster(self):
        """监控集群"""
        while self.monitoring:
            try:
                # 检查是否需要扩缩容
                self._check_scaling_needed()
                time.sleep(30)  # 每30秒检查一次
            except Exception as e:
                print(f"监控集群时出错: {e}")
    
    def _check_scaling_needed(self):
        """检查是否需要扩缩容"""
        cluster_status = self.placement_manager.get_cluster_status()
        
        # 检查扩容策略
        if "scale_up" in self.scaling_policies:
            scale_up_policy = self.scaling_policies["scale_up"]
            threshold = scale_up_policy.get("utilization_threshold", 0.8)
            
            if cluster_status["utilization"] > threshold:
                print(f"集群使用率 {cluster_status['utilization']:.2%} 超过扩容阈值 {threshold:.2%}")
                self._trigger_scale_up(scale_up_policy)
        
        # 检查缩容策略
        if "scale_down" in self.scaling_policies:
            scale_down_policy = self.scaling_policies["scale_down"]
            threshold = scale_down_policy.get("utilization_threshold", 0.3)
            
            if cluster_status["utilization"] < threshold:
                print(f"集群使用率 {cluster_status['utilization']:.2%} 低于缩容阈值 {threshold:.2%}")
                self._trigger_scale_down(scale_down_policy)
    
    def _trigger_scale_up(self, policy: Dict[str, Any]):
        """触发扩容"""
        # 简化实现，实际应根据策略创建新节点
        print("触发扩容操作")
        # 这里应该调用实际的节点创建和添加逻辑
    
    def _trigger_scale_down(self, policy: Dict[str, Any]):
        """触发缩容"""
        # 简化实现，实际应根据策略选择要移除的节点
        print("触发缩容操作")
        # 这里应该调用实际的节点移除逻辑

# 使用示例
def demonstrate_cluster_scaling():
    """演示集群扩缩容"""
    # 创建数据放置管理器
    placement_manager = DataPlacementManager()
    
    # 添加初始节点
    initial_nodes = [
        ClusterNode("node-001", "data", 1000),
        ClusterNode("node-002", "data", 1000),
        ClusterNode("node-003", "data", 1000),
    ]
    
    for node in initial_nodes:
        node.used_gb = 600  # 模拟已使用60%的容量
        placement_manager.add_node(node)
    
    # 显示初始状态
    status = placement_manager.get_cluster_status()
    print("初始集群状态:")
    print(f"  活动节点数: {status['active_nodes']}")
    print(f"  总容量: {status['total_capacity_gb']} GB")
    print(f"  已使用: {status['total_used_gb']} GB")
    print(f"  使用率: {status['utilization']:.2%}")
    
    # 扩容集群
    new_nodes = [
        ClusterNode("node-004", "data", 1000),
        ClusterNode("node-005", "data", 1000),
    ]
    
    placement_manager.scale_up(new_nodes, rebalance_timeout=120)
    
    # 显示扩容后状态
    status = placement_manager.get_cluster_status()
    print("\n扩容后集群状态:")
    print(f"  活动节点数: {status['active_nodes']}")
    print(f"  总容量: {status['total_capacity_gb']} GB")
    print(f"  已使用: {status['total_used_gb']} GB")
    print(f"  使用率: {status['utilization']:.2%}")
    
    # 缩容集群
    placement_manager.scale_down(["node-005"], rebalance_timeout=120)
    
    # 显示缩容后状态
    status = placement_manager.get_cluster_status()
    print("\n缩容后集群状态:")
    print(f"  活动节点数: {status['active_nodes']}")
    print(f"  总容量: {status['total_capacity_gb']} GB")
    print(f"  已使用: {status['total_used_gb']} GB")
    print(f"  使用率: {status['utilization']:.2%}")

# 运行演示
# demonstrate_cluster_scaling()
```

### 10.2.1.2 缩容流程设计

```python
# 缩容流程设计
from typing import Dict, List, Set, Any, Optional
import time
from datetime import datetime, timedelta

class GracefulNodeRemoval:
    """优雅节点移除"""
    
    def __init__(self, placement_manager: DataPlacementManager):
        self.placement_manager = placement_manager
        self.removal_queue: List[str] = []
        self.removal_in_progress = False
    
    def queue_node_removal(self, node_id: str, grace_period_seconds: int = 300):
        """排队节点移除"""
        if node_id not in self.placement_manager.nodes:
            print(f"节点 {node_id} 不存在")
            return False
        
        self.removal_queue.append({
            "node_id": node_id,
            "queued_at": datetime.now(),
            "grace_period": grace_period_seconds,
            "status": "queued"
        })
        
        print(f"节点 {node_id} 已排队等待移除，宽限期 {grace_period_seconds} 秒")
        return True
    
    def start_graceful_removal(self):
        """开始优雅移除"""
        if self.removal_in_progress:
            print("节点移除已在进行中")
            return False
        
        self.removal_in_progress = True
        
        # 处理移除队列
        while self.removal_queue:
            removal_request = self.removal_queue.pop(0)
            node_id = removal_request["node_id"]
            grace_period = removal_request["grace_period"]
            
            print(f"开始移除节点 {node_id}")
            
            # 执行优雅移除
            if self._graceful_remove_node(node_id, grace_period):
                print(f"节点 {node_id} 移除成功")
            else:
                print(f"节点 {node_id} 移除失败")
        
        self.removal_in_progress = False
        return True
    
    def _graceful_remove_node(self, node_id: str, grace_period: int) -> bool:
        """优雅移除节点"""
        if node_id not in self.placement_manager.nodes:
            return False
        
        node = self.placement_manager.nodes[node_id]
        
        # 1. 标记节点为 draining 状态
        node.status = "draining"
        print(f"节点 {node_id} 进入 draining 状态")
        
        # 2. 等待宽限期
        print(f"等待 {grace_period} 秒宽限期...")
        time.sleep(min(grace_period, 10))  # 限制等待时间以避免演示过长
        
        # 3. 检查是否有活跃连接
        active_connections = self._check_active_connections(node_id)
        if active_connections > 0:
            print(f"节点 {node_id} 仍有 {active_connections} 个活跃连接")
            # 在实际实现中，可能需要等待连接完成或强制断开
        
        # 4. 迁移数据
        print(f"开始迁移节点 {node_id} 上的数据")
        self.placement_manager._migrate_data_from_node(node_id)
        
        # 5. 从集群中移除节点
        if node_id in self.placement_manager.nodes:
            del self.placement_manager.nodes[node_id]
            print(f"节点 {node_id} 已从集群中移除")
        
        return True
    
    def _check_active_connections(self, node_id: str) -> int:
        """检查节点上的活跃连接数"""
        # 简化实现，实际应检查真实的连接状态
        # 这里随机返回一个连接数用于演示
        return random.randint(0, 10)

class CapacityPlanner:
    """容量规划器"""
    
    def __init__(self, placement_manager: DataPlacementManager):
        self.placement_manager = placement_manager
        self.capacity_history: List[Dict[str, Any]] = []
    
    def plan_scaling(self, target_utilization: float = 0.7) -> Dict[str, Any]:
        """规划扩缩容"""
        cluster_status = self.placement_manager.get_cluster_status()
        current_utilization = cluster_status["utilization"]
        
        plan = {
            "current_utilization": current_utilization,
            "target_utilization": target_utilization,
            "recommendation": None,
            "nodes_to_add": 0,
            "nodes_to_remove": 0
        }
        
        if current_utilization > target_utilization * 1.1:  # 超过目标使用率10%
            # 需要扩容
            required_capacity = cluster_status["total_used_gb"] / target_utilization
            additional_capacity_needed = required_capacity - cluster_status["total_capacity_gb"]
            
            # 假设每个节点容量为1000GB
            nodes_to_add = max(1, int(additional_capacity_needed / 1000) + 1)
            plan["recommendation"] = "scale_up"
            plan["nodes_to_add"] = nodes_to_add
            
        elif current_utilization < target_utilization * 0.9:  # 低于目标使用率10%
            # 需要缩容
            target_capacity = cluster_status["total_used_gb"] / target_utilization
            capacity_to_remove = cluster_status["total_capacity_gb"] - target_capacity
            
            # 计算可移除的节点数
            nodes_to_remove = max(1, int(capacity_to_remove / 1000))
            plan["recommendation"] = "scale_down"
            plan["nodes_to_remove"] = nodes_to_remove
        else:
            plan["recommendation"] = "no_action"
        
        # 记录规划历史
        self.capacity_history.append({
            "timestamp": datetime.now(),
            "plan": plan
        })
        
        return plan
    
    def get_capacity_trend(self, hours: int = 24) -> Dict[str, Any]:
        """获取容量趋势"""
        if not self.capacity_history:
            return {"message": "暂无容量规划历史"}
        
        # 过滤指定时间范围内的历史记录
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_history = [
            record for record in self.capacity_history
            if record["timestamp"] >= cutoff_time
        ]
        
        if not recent_history:
            return {"message": f"最近 {hours} 小时内无容量规划历史"}
        
        # 分析趋势
        scale_up_count = sum(1 for record in recent_history 
                           if record["plan"]["recommendation"] == "scale_up")
        scale_down_count = sum(1 for record in recent_history 
                             if record["plan"]["recommendation"] == "scale_down")
        no_action_count = sum(1 for record in recent_history 
                            if record["plan"]["recommendation"] == "no_action")
        
        total_plans = len(recent_history)
        trend = "stable"
        if scale_up_count > no_action_count and scale_up_count > scale_down_count:
            trend = "growing"
        elif scale_down_count > no_action_count and scale_down_count > scale_up_count:
            trend = "shrinking"
        
        return {
            "time_range_hours": hours,
            "total_plans": total_plans,
            "scale_up_plans": scale_up_count,
            "scale_down_plans": scale_down_count,
            "no_action_plans": no_action_count,
            "trend": trend
        }

# 使用示例
def demonstrate_graceful_scaling():
    """演示优雅扩缩容"""
    # 创建组件
    placement_manager = DataPlacementManager()
    graceful_removal = GracefulNodeRemoval(placement_manager)
    capacity_planner = CapacityPlanner(placement_manager)
    
    # 添加节点
    nodes = [
        ClusterNode("node-001", "data", 1000),
        ClusterNode("node-002", "data", 1000),
        ClusterNode("node-003", "data", 1000),
        ClusterNode("node-004", "data", 1000),
    ]
    
    for node in nodes:
        node.used_gb = random.randint(400, 800)
        placement_manager.add_node(node)
    
    # 显示当前状态
    status = placement_manager.get_cluster_status()
    print("当前集群状态:")
    print(f"  总容量: {status['total_capacity_gb']} GB")
    print(f"  已使用: {status['total_used_gb']} GB")
    print(f"  使用率: {status['utilization']:.2%}")
    
    # 容量规划
    print("\n容量规划:")
    plan = capacity_planner.plan_scaling(target_utilization=0.7)
    print(f"  当前使用率: {plan['current_utilization']:.2%}")
    print(f"  目标使用率: {plan['target_utilization']:.2%}")
    print(f"  建议操作: {plan['recommendation']}")
    if plan["nodes_to_add"] > 0:
        print(f"  建议增加节点数: {plan['nodes_to_add']}")
    if plan["nodes_to_remove"] > 0:
        print(f"  建议移除节点数: {plan['nodes_to_remove']}")
    
    # 演示优雅移除
    print("\n演示优雅节点移除:")
    graceful_removal.queue_node_removal("node-004", grace_period_seconds=30)
    graceful_removal.start_graceful_removal()
    
    # 显示移除后状态
    status = placement_manager.get_cluster_status()
    print("\n移除节点后集群状态:")
    print(f"  活动节点数: {status['active_nodes']}")
    print(f"  总容量: {status['total_capacity_gb']} GB")
    print(f"  已使用: {status['total_used_gb']} GB")
    print(f"  使用率: {status['utilization']:.2%}")

# 运行演示
# demonstrate_graceful_scaling()
```

## 10.2.2 数据迁移影响控制

在集群扩缩容过程中，数据迁移是不可避免的环节。然而，数据迁移会对系统性能产生影响，特别是在大规模迁移时可能导致服务响应延迟增加、吞吐量下降等问题。因此，需要有效的机制来控制数据迁移对系统的影响。

### 10.2.2.1 迁移带宽控制

```python
# 迁移带宽控制
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import random

class MigrationTask:
    """迁移任务"""
    
    def __init__(self, task_id: str, data_id: str, source_node: str, target_node: str):
        self.task_id = task_id
        self.data_id = data_id
        self.source_node = source_node
        self.target_node = target_node
        self.status = "pending"  # pending, running, completed, failed
        self.priority = 1  # 1-10, 10为最高优先级
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.progress = 0.0  # 0.0 - 1.0
        self.throughput_mbps = 0.0
        self.error_message: Optional[str] = None

class MigrationImpactController:
    """迁移影响控制器"""
    
    def __init__(self, max_concurrent_migrations: int = 5, 
                 max_bandwidth_mbps: float = 100.0):
        self.max_concurrent_migrations = max_concurrent_migrations
        self.max_bandwidth_mbps = max_bandwidth_mbps
        self.migration_tasks: Dict[str, MigrationTask] = {}
        self.running_migrations: List[str] = []
        self.migration_queue: List[str] = []
        self.node_bandwidth_usage: Dict[str, float] = {}  # node_id -> mbps
        self.on_migration_complete: Optional[Callable[[MigrationTask], None]] = None
        self.monitor_thread: Optional[threading.Thread] = None
        self.monitoring = False
    
    def set_migration_complete_callback(self, callback: Callable[[MigrationTask], None]):
        """设置迁移完成回调"""
        self.on_migration_complete = callback
    
    def start_monitoring(self):
        """开始监控"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_migrations)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        print("迁移监控已启动")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        print("迁移监控已停止")
    
    def add_migration_task(self, task: MigrationTask) -> bool:
        """添加迁移任务"""
        if task.task_id in self.migration_tasks:
            print(f"迁移任务 {task.task_id} 已存在")
            return False
        
        self.migration_tasks[task.task_id] = task
        self.migration_queue.append(task.task_id)
        print(f"迁移任务 {task.task_id} 已添加到队列")
        return True
    
    def _monitor_migrations(self):
        """监控迁移任务"""
        while self.monitoring:
            try:
                self._process_migration_queue()
                self._update_running_migrations()
                time.sleep(1)  # 每秒检查一次
            except Exception as e:
                print(f"监控迁移时出错: {e}")
    
    def _process_migration_queue(self):
        """处理迁移队列"""
        # 检查是否可以启动新任务
        while (len(self.running_migrations) < self.max_concurrent_migrations and 
               self.migration_queue):
            task_id = self.migration_queue.pop(0)
            if task_id in self.migration_tasks:
                task = self.migration_tasks[task_id]
                if self._can_start_migration(task):
                    self._start_migration(task)
    
    def _can_start_migration(self, task: MigrationTask) -> bool:
        """检查是否可以启动迁移"""
        # 检查源节点和目标节点的带宽使用情况
        source_usage = self.node_bandwidth_usage.get(task.source_node, 0.0)
        target_usage = self.node_bandwidth_usage.get(task.target_node, 0.0)
        
        # 为每个迁移任务预留10MB/s带宽
        required_bandwidth = 10.0
        
        if (source_usage + required_bandwidth > self.max_bandwidth_mbps or
            target_usage + required_bandwidth > self.max_bandwidth_mbps):
            # 带宽不足，将任务重新放回队列前端
            self.migration_queue.insert(0, task.task_id)
            return False
        
        return True
    
    def _start_migration(self, task: MigrationTask):
        """启动迁移任务"""
        task.status = "running"
        task.started_at = datetime.now()
        self.running_migrations.append(task.task_id)
        
        # 更新带宽使用情况
        self.node_bandwidth_usage[task.source_node] = \
            self.node_bandwidth_usage.get(task.source_node, 0.0) + 10.0
        self.node_bandwidth_usage[task.target_node] = \
            self.node_bandwidth_usage.get(task.target_node, 0.0) + 10.0
        
        print(f"启动迁移任务 {task.task_id}: {task.data_id} 从 {task.source_node} 到 {task.target_node}")
        
        # 启动迁移线程
        migration_thread = threading.Thread(target=self._execute_migration, args=(task,))
        migration_thread.daemon = True
        migration_thread.start()
    
    def _execute_migration(self, task: MigrationTask):
        """执行迁移任务"""
        try:
            # 模拟迁移过程
            data_size_gb = random.uniform(1, 100)  # 随机数据大小
            migration_time_seconds = data_size_gb * 10  # 假设每GB需要10秒
            
            start_time = time.time()
            while time.time() - start_time < migration_time_seconds:
                if task.status == "failed":
                    break
                
                # 更新进度
                elapsed = time.time() - start_time
                task.progress = min(1.0, elapsed / migration_time_seconds)
                task.throughput_mbps = random.uniform(5, 15)  # 随机吞吐量
                
                time.sleep(1)
            
            # 完成迁移
            if task.status != "failed":
                task.status = "completed"
                task.completed_at = datetime.now()
                task.progress = 1.0
                print(f"迁移任务 {task.task_id} 完成")
                
                # 更新带宽使用情况
                self.node_bandwidth_usage[task.source_node] = \
                    max(0.0, self.node_bandwidth_usage.get(task.source_node, 0.0) - 10.0)
                self.node_bandwidth_usage[task.target_node] = \
                    max(0.0, self.node_bandwidth_usage.get(task.target_node, 0.0) - 10.0)
                
                # 从运行列表中移除
                if task.task_id in self.running_migrations:
                    self.running_migrations.remove(task.task_id)
                
                # 调用完成回调
                if self.on_migration_complete:
                    self.on_migration_complete(task)
        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            print(f"迁移任务 {task.task_id} 失败: {e}")
    
    def _update_running_migrations(self):
        """更新运行中的迁移任务"""
        # 移除已完成或失败的任务
        completed_tasks = [task_id for task_id in self.running_migrations 
                          if task_id in self.migration_tasks and 
                          self.migration_tasks[task_id].status in ["completed", "failed"]]
        
        for task_id in completed_tasks:
            self.running_migrations.remove(task_id)
    
    def get_migration_status(self) -> Dict[str, Any]:
        """获取迁移状态"""
        total_tasks = len(self.migration_tasks)
        completed_tasks = sum(1 for task in self.migration_tasks.values() 
                             if task.status == "completed")
        failed_tasks = sum(1 for task in self.migration_tasks.values() 
                          if task.status == "failed")
        running_tasks = len(self.running_migrations)
        pending_tasks = len(self.migration_queue)
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "running_tasks": running_tasks,
            "pending_tasks": pending_tasks,
            "progress": completed_tasks / total_tasks if total_tasks > 0 else 0,
            "node_bandwidth_usage": self.node_bandwidth_usage.copy()
        }
    
    def cancel_migration(self, task_id: str) -> bool:
        """取消迁移任务"""
        if task_id not in self.migration_tasks:
            print(f"迁移任务 {task_id} 不存在")
            return False
        
        task = self.migration_tasks[task_id]
        if task.status == "running":
            task.status = "failed"
            task.error_message = "任务被取消"
            print(f"迁移任务 {task_id} 已取消")
            return True
        elif task.status == "pending":
            self.migration_queue.remove(task_id)
            task.status = "failed"
            task.error_message = "任务被取消"
            print(f"迁移任务 {task_id} 已取消")
            return True
        else:
            print(f"迁移任务 {task_id} 无法取消，当前状态: {task.status}")
            return False

# 动态带宽调整
class DynamicBandwidthManager:
    """动态带宽管理器"""
    
    def __init__(self, impact_controller: MigrationImpactController):
        self.impact_controller = impact_controller
        self.original_max_bandwidth = impact_controller.max_bandwidth_mbps
        self.system_metrics_callback: Optional[Callable[[], Dict[str, Any]]] = None
        self.adjustment_thread: Optional[threading.Thread] = None
        self.adjusting = False
    
    def set_system_metrics_callback(self, callback: Callable[[], Dict[str, Any]]):
        """设置系统指标回调"""
        self.system_metrics_callback = callback
    
    def start_bandwidth_adjustment(self):
        """开始带宽调整"""
        if self.adjusting:
            return
        
        self.adjusting = True
        self.adjustment_thread = threading.Thread(target=self._adjust_bandwidth)
        self.adjustment_thread.daemon = True
        self.adjustment_thread.start()
        print("动态带宽调整已启动")
    
    def stop_bandwidth_adjustment(self):
        """停止带宽调整"""
        self.adjusting = False
        if self.adjustment_thread:
            self.adjustment_thread.join(timeout=5)
        print("动态带宽调整已停止")
    
    def _adjust_bandwidth(self):
        """调整带宽"""
        while self.adjusting:
            try:
                if self.system_metrics_callback:
                    metrics = self.system_metrics_callback()
                    self._adjust_based_on_metrics(metrics)
                time.sleep(30)  # 每30秒调整一次
            except Exception as e:
                print(f"调整带宽时出错: {e}")
    
    def _adjust_based_on_metrics(self, metrics: Dict[str, Any]):
        """根据指标调整带宽"""
        # 获取当前系统负载
        cpu_usage = metrics.get("cpu_usage", 50)
        memory_usage = metrics.get("memory_usage", 50)
        io_wait = metrics.get("io_wait", 10)
        
        # 计算调整因子
        adjustment_factor = 1.0
        
        # CPU使用率过高时降低带宽
        if cpu_usage > 80:
            adjustment_factor *= (80 / cpu_usage)
        
        # 内存使用率过高时降低带宽
        if memory_usage > 85:
            adjustment_factor *= (85 / memory_usage)
        
        # IO等待过高时降低带宽
        if io_wait > 30:
            adjustment_factor *= (30 / io_wait)
        
        # 确保调整因子在合理范围内
        adjustment_factor = max(0.1, min(1.0, adjustment_factor))
        
        # 调整最大带宽
        new_max_bandwidth = self.original_max_bandwidth * adjustment_factor
        self.impact_controller.max_bandwidth_mbps = new_max_bandwidth
        
        print(f"动态调整带宽: {self.original_max_bandwidth:.1f} MB/s -> {new_max_bandwidth:.1f} MB/s "
              f"(调整因子: {adjustment_factor:.2f})")

# 系统指标模拟函数
def simulate_system_metrics() -> Dict[str, Any]:
    """模拟系统指标"""
    return {
        "cpu_usage": random.uniform(30, 90),
        "memory_usage": random.uniform(40, 85),
        "io_wait": random.uniform(5, 50)
    }

# 迁移完成回调
def on_migration_complete(task: MigrationTask):
    """迁移完成回调"""
    if task.status == "completed":
        print(f"数据 {task.data_id} 迁移成功")
    else:
        print(f"数据 {task.data_id} 迁移失败: {task.error_message}")

# 使用示例
def demonstrate_migration_impact_control():
    """演示迁移影响控制"""
    # 创建迁移影响控制器
    controller = MigrationImpactController(max_concurrent_migrations=3, max_bandwidth_mbps=50.0)
    controller.set_migration_complete_callback(on_migration_complete)
    
    # 创建动态带宽管理器
    bandwidth_manager = DynamicBandwidthManager(controller)
    bandwidth_manager.set_system_metrics_callback(simulate_system_metrics)
    
    # 启动监控和带宽调整
    controller.start_monitoring()
    bandwidth_manager.start_bandwidth_adjustment()
    
    # 添加迁移任务
    tasks = [
        MigrationTask("mig-001", "data-001", "node-001", "node-004"),
        MigrationTask("mig-002", "data-002", "node-002", "node-004"),
        MigrationTask("mig-003", "data-003", "node-003", "node-005"),
        MigrationTask("mig-004", "data-004", "node-001", "node-005"),
        MigrationTask("mig-005", "data-005", "node-002", "node-005"),
    ]
    
    for task in tasks:
        controller.add_migration_task(task)
    
    # 等待一段时间观察迁移过程
    print("开始迁移过程...")
    time.sleep(30)
    
    # 显示迁移状态
    status = controller.get_migration_status()
    print("\n迁移状态:")
    print(f"  总任务数: {status['total_tasks']}")
    print(f"  已完成: {status['completed_tasks']}")
    print(f"  运行中: {status['running_tasks']}")
    print(f"  等待中: {status['pending_tasks']}")
    print(f"  进度: {status['progress']:.2%}")
    print(f"  节点带宽使用: {status['node_bandwidth_usage']}")
    
    # 停止监控和带宽调整
    controller.stop_monitoring()
    bandwidth_manager.stop_bandwidth_adjustment()

# 运行演示
# demonstrate_migration_impact_control()
```

### 10.2.2.2 优先级迁移策略

```python
# 优先级迁移策略
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import heapq

class PriorityMigrationTask(MigrationTask):
    """优先级迁移任务"""
    
    def __init__(self, task_id: str, data_id: str, source_node: str, target_node: str,
                 priority: int = 1, deadline: Optional[datetime] = None):
        super().__init__(task_id, data_id, source_node, target_node)
        self.priority = priority  # 1-10, 10为最高优先级
        self.deadline = deadline
        self.importance_score = 0.0  # 综合重要性评分

class PriorityMigrationScheduler:
    """优先级迁移调度器"""
    
    def __init__(self, impact_controller: MigrationImpactController):
        self.impact_controller = impact_controller
        self.priority_queue: List[tuple] = []  # (优先级, 截止时间, 任务ID)
        self.tasks: Dict[str, PriorityMigrationTask] = {}
        self.scheduling_policy = "priority"  # priority, deadline, importance
    
    def add_priority_task(self, task: PriorityMigrationTask) -> bool:
        """添加优先级任务"""
        self.tasks[task.task_id] = task
        
        # 计算综合优先级
        priority_tuple = self._calculate_priority_tuple(task)
        heapq.heappush(self.priority_queue, priority_tuple)
        
        print(f"添加优先级迁移任务 {task.task_id} (优先级: {task.priority})")
        return True
    
    def _calculate_priority_tuple(self, task: PriorityMigrationTask) -> tuple:
        """计算优先级元组"""
        if self.scheduling_policy == "priority":
            # 基于优先级的调度 (负数用于实现最大堆)
            return (-task.priority, task.created_at, task.task_id)
        elif self.scheduling_policy == "deadline":
            # 基于截止时间的调度
            deadline_timestamp = task.deadline.timestamp() if task.deadline else float('inf')
            return (deadline_timestamp, -task.priority, task.created_at, task.task_id)
        else:  # importance
            # 基于重要性评分的调度
            return (-task.importance_score, -task.priority, task.created_at, task.task_id)
    
    def set_scheduling_policy(self, policy: str):
        """设置调度策略"""
        if policy in ["priority", "deadline", "importance"]:
            self.scheduling_policy = policy
            print(f"调度策略设置为: {policy}")
            # 重新排列优先级队列
            self._reorder_priority_queue()
        else:
            print(f"未知的调度策略: {policy}")
    
    def _reorder_priority_queue(self):
        """重新排列优先级队列"""
        # 重新计算所有任务的优先级
        new_queue = []
        for task_id in list(self.tasks.keys()):
            task = self.tasks[task_id]
            priority_tuple = self._calculate_priority_tuple(task)
            heapq.heappush(new_queue, priority_tuple)
        
        self.priority_queue = new_queue
    
    def get_next_task(self) -> Optional[PriorityMigrationTask]:
        """获取下一个任务"""
        while self.priority_queue:
            _, _, task_id = heapq.heappop(self.priority_queue)
            if task_id in self.tasks:
                return self.tasks[task_id]
        
        return None
    
    def calculate_importance_score(self, task: PriorityMigrationTask) -> float:
        """计算任务重要性评分"""
        score = 0.0
        
        # 基于优先级的评分
        score += task.priority * 10
        
        # 基于数据访问频率的评分 (模拟)
        access_frequency = getattr(task, 'access_frequency', 1.0)
        score += access_frequency * 5
        
        # 基于数据大小的评分 (大文件优先)
        data_size = getattr(task, 'data_size_gb', 1.0)
        score += min(data_size, 100) * 0.1  # 限制大文件的影响
        
        # 基于截止时间的评分
        if task.deadline:
            time_to_deadline = (task.deadline - datetime.now()).total_seconds()
            if time_to_deadline > 0:
                # 时间越紧迫，评分越高
                score += max(0, (3600 * 24 - time_to_deadline) / 3600)  # 最多加24分
        
        return score

class AdaptiveMigrationScheduler:
    """自适应迁移调度器"""
    
    def __init__(self, priority_scheduler: PriorityMigrationScheduler):
        self.priority_scheduler = priority_scheduler
        self.performance_history: List[Dict[str, Any]] = []
        self.adaptation_interval = 300  # 5分钟调整一次
        self.last_adaptation = datetime.now()
    
    def adapt_scheduling_policy(self):
        """自适应调整调度策略"""
        current_time = datetime.now()
        if (current_time - self.last_adaptation).seconds < self.adaptation_interval:
            return
        
        self.last_adaptation = current_time
        
        # 分析性能历史
        if len(self.performance_history) < 5:
            return
        
        # 计算不同策略下的平均性能
        policy_performance = self._analyze_policy_performance()
        
        # 选择最佳策略
        best_policy = max(policy_performance.items(), key=lambda x: x[1])[0]
        current_policy = self.priority_scheduler.scheduling_policy
        
        if best_policy != current_policy:
            print(f"自适应调整调度策略: {current_policy} -> {best_policy}")
            self.priority_scheduler.set_scheduling_policy(best_policy)
    
    def _analyze_policy_performance(self) -> Dict[str, float]:
        """分析策略性能"""
        # 简化实现，实际应基于历史性能数据计算
        performance = {
            "priority": random.uniform(0.7, 0.9),
            "deadline": random.uniform(0.6, 0.8),
            "importance": random.uniform(0.8, 1.0)
        }
        return performance
    
    def record_performance(self, metrics: Dict[str, Any]):
        """记录性能指标"""
        self.performance_history.append({
            "timestamp": datetime.now(),
            "metrics": metrics
        })
        
        # 保持最近100条记录
        if len(self.performance_history) > 100:
            self.performance_history = self.performance_history[-100:]

# 使用示例
def demonstrate_priority_migration():
    """演示优先级迁移"""
    # 创建组件
    impact_controller = MigrationImpactController(max_concurrent_migrations=2, max_bandwidth_mbps=30.0)
    priority_scheduler = PriorityMigrationScheduler(impact_controller)
    adaptive_scheduler = AdaptiveMigrationScheduler(priority_scheduler)
    
    # 创建优先级任务
    now = datetime.now()
    tasks = [
        PriorityMigrationTask(
            "mig-high-001", "critical-data-001", "node-001", "node-002",
            priority=10, deadline=now + timedelta(hours=1)
        ),
        PriorityMigrationTask(
            "mig-med-001", "normal-data-001", "node-002", "node-003",
            priority=5
        ),
        PriorityMigrationTask(
            "mig-low-001", "archive-data-001", "node-003", "node-001",
            priority=1, deadline=now + timedelta(days=1)
        ),
        PriorityMigrationTask(
            "mig-high-002", "critical-data-002", "node-001", "node-003",
            priority=9
        ),
    ]
    
    # 添加任务
    for task in tasks:
        # 设置额外属性用于重要性评分计算
        task.access_frequency = random.uniform(0.1, 10.0)
        task.data_size_gb = random.uniform(1, 500)
        task.importance_score = priority_scheduler.calculate_importance_score(task)
        priority_scheduler.add_priority_task(task)
    
    # 演示不同调度策略
    print("=== 基于优先级的调度 ===")
    priority_scheduler.set_scheduling_policy("priority")
    
    # 获取任务执行顺序
    execution_order = []
    temp_scheduler = PriorityMigrationScheduler(impact_controller)
    for task in tasks:
        temp_task = PriorityMigrationTask(
            task.task_id, task.data_id, task.source_node, task.target_node,
            task.priority, task.deadline
        )
        temp_task.importance_score = task.importance_score
        temp_scheduler.add_priority_task(temp_task)
    
    while True:
        task = temp_scheduler.get_next_task()
        if not task:
            break
        execution_order.append(task.task_id)
    
    print(f"任务执行顺序: {execution_order}")
    
    print("\n=== 基于截止时间的调度 ===")
    priority_scheduler.set_scheduling_policy("deadline")
    
    execution_order = []
    temp_scheduler = PriorityMigrationScheduler(impact_controller)
    for task in tasks:
        temp_task = PriorityMigrationTask(
            task.task_id, task.data_id, task.source_node, task.target_node,
            task.priority, task.deadline
        )
        temp_task.importance_score = task.importance_score
        temp_scheduler.add_priority_task(temp_task)
    
    while True:
        task = temp_scheduler.get_next_task()
        if not task:
            break
        execution_order.append(task.task_id)
    
    print(f"任务执行顺序: {execution_order}")
    
    print("\n=== 基于重要性的调度 ===")
    priority_scheduler.set_scheduling_policy("importance")
    
    execution_order = []
    temp_scheduler = PriorityMigrationScheduler(impact_controller)
    for task in tasks:
        temp_task = PriorityMigrationTask(
            task.task_id, task.data_id, task.source_node, task.target_node,
            task.priority, task.deadline
        )
        temp_task.importance_score = task.importance_score
        temp_scheduler.add_priority_task(temp_task)
    
    while True:
        task = temp_scheduler.get_next_task()
        if not task:
            break
        execution_order.append(task.task_id)
    
    print(f"任务执行顺序: {execution_order}")

# 运行演示
# demonstrate_priority_migration()
```

通过以上实现，我们构建了一个完整的集群扩缩容体系，包括弹性扩缩容流程和数据迁移影响控制机制。弹性扩缩容流程涵盖了从节点添加、数据重新平衡到优雅移除的完整过程，确保在调整集群规模时数据的完整性和服务的连续性。数据迁移影响控制机制则通过带宽控制、优先级调度和自适应调整等手段，有效降低了数据迁移对系统性能的影响，保障了用户体验。