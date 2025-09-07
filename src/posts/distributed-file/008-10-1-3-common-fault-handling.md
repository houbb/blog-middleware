---
title: "常见故障处理手册:磁盘故障、节点宕机、网络分区"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台的运维过程中，故障是不可避免的。无论是硬件故障、软件异常还是网络问题，都可能影响系统的稳定性和数据的完整性。一个成熟的分布式存储系统必须具备完善的故障检测、处理和恢复机制，以确保在发生故障时能够快速响应并恢复正常服务。

## 10.3.1 磁盘故障处理

磁盘故障是分布式存储系统中最常见的硬件故障之一。由于存储系统通常需要管理大量的磁盘设备，磁盘故障的发生概率相对较高。有效的磁盘故障处理机制能够最大限度地减少数据丢失和服务中断。

### 10.3.1.1 磁盘故障检测机制

```python
# 磁盘故障检测实现
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import hashlib
import random

class DiskHealthChecker:
    """磁盘健康检查器"""
    
    def __init__(self, check_interval: int = 30):
        self.check_interval = check_interval
        self.disks: Dict[str, Dict[str, Any]] = {}
        self.health_callbacks: List[Callable[[str, str], None]] = []
        self.check_thread: Optional[threading.Thread] = None
        self.checking = False
    
    def add_disk(self, disk_id: str, path: str, capacity_gb: int):
        """添加磁盘"""
        self.disks[disk_id] = {
            "path": path,
            "capacity_gb": capacity_gb,
            "status": "healthy",
            "last_check": None,
            "error_count": 0,
            "last_error": None
        }
        print(f"磁盘 {disk_id} 已添加: {path}")
    
    def add_health_callback(self, callback: Callable[[str, str], None]):
        """添加健康状态回调"""
        self.health_callbacks.append(callback)
    
    def start_health_check(self):
        """开始健康检查"""
        if self.checking:
            return
        
        self.checking = True
        self.check_thread = threading.Thread(target=self._health_check_loop)
        self.check_thread.daemon = True
        self.check_thread.start()
        print("磁盘健康检查已启动")
    
    def stop_health_check(self):
        """停止健康检查"""
        self.checking = False
        if self.check_thread:
            self.check_thread.join(timeout=5)
        print("磁盘健康检查已停止")
    
    def _health_check_loop(self):
        """健康检查循环"""
        while self.checking:
            try:
                self._perform_health_check()
                time.sleep(self.check_interval)
            except Exception as e:
                print(f"健康检查时出错: {e}")
    
    def _perform_health_check(self):
        """执行健康检查"""
        for disk_id, disk_info in self.disks.items():
            old_status = disk_info["status"]
            new_status = self._check_disk_health(disk_id, disk_info)
            
            # 更新状态
            disk_info["status"] = new_status
            disk_info["last_check"] = datetime.now()
            
            # 如果状态发生变化，调用回调函数
            if old_status != new_status:
                print(f"磁盘 {disk_id} 状态变化: {old_status} -> {new_status}")
                for callback in self.health_callbacks:
                    try:
                        callback(disk_id, new_status)
                    except Exception as e:
                        print(f"调用健康回调时出错: {e}")
    
    def _check_disk_health(self, disk_id: str, disk_info: Dict[str, Any]) -> str:
        """检查磁盘健康状态"""
        # 模拟磁盘健康检查
        # 实际实现中可能包括：
        # 1. SMART状态检查
        # 2. 读写测试
        # 3. 坏块检测
        # 4. 温度监控等
        
        # 模拟有一定概率出现故障
        if random.random() < 0.01:  # 1%概率出现故障
            disk_info["error_count"] += 1
            disk_info["last_error"] = datetime.now()
            return "failed"
        
        # 检查错误计数
        if disk_info["error_count"] > 5:
            return "degraded"
        
        return "healthy"
    
    def get_disk_status(self, disk_id: str) -> Dict[str, Any]:
        """获取磁盘状态"""
        if disk_id not in self.disks:
            return {"error": "磁盘不存在"}
        return self.disks[disk_id].copy()
    
    def get_all_disk_status(self) -> Dict[str, Dict[str, Any]]:
        """获取所有磁盘状态"""
        return {disk_id: info.copy() for disk_id, info in self.disks.items()}

class DiskFailureHandler:
    """磁盘故障处理器"""
    
    def __init__(self, health_checker: DiskHealthChecker):
        self.health_checker = health_checker
        self.failure_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        
        # 注册健康状态回调
        self.health_checker.add_health_callback(self._on_disk_health_change)
    
    def add_failure_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加故障回调"""
        self.failure_callbacks.append(callback)
    
    def _on_disk_health_change(self, disk_id: str, status: str):
        """磁盘健康状态变化处理"""
        if status == "failed":
            self._handle_disk_failure(disk_id)
        elif status == "degraded":
            self._handle_disk_degradation(disk_id)
    
    def _handle_disk_failure(self, disk_id: str):
        """处理磁盘故障"""
        disk_info = self.health_checker.get_disk_status(disk_id)
        if "error" in disk_info:
            return
        
        print(f"处理磁盘 {disk_id} 故障")
        
        # 执行故障处理流程
        failure_info = {
            "disk_id": disk_id,
            "failure_time": datetime.now(),
            "error_count": disk_info["error_count"],
            "last_error": disk_info["last_error"],
            "recovery_actions": []
        }
        
        # 1. 标记磁盘为不可用
        failure_info["recovery_actions"].append("标记磁盘为不可用")
        print(f"  1. 标记磁盘 {disk_id} 为不可用")
        
        # 2. 触发数据重建
        failure_info["recovery_actions"].append("触发数据重建流程")
        print(f"  2. 触发数据重建流程")
        self._trigger_data_rebuild(disk_id)
        
        # 3. 发送告警
        failure_info["recovery_actions"].append("发送故障告警")
        print(f"  3. 发送故障告警")
        self._send_failure_alert(disk_id, failure_info)
        
        # 4. 记录故障日志
        failure_info["recovery_actions"].append("记录故障日志")
        print(f"  4. 记录故障日志")
        
        # 调用故障回调
        for callback in self.failure_callbacks:
            try:
                callback(disk_id, failure_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
    
    def _handle_disk_degradation(self, disk_id: str):
        """处理磁盘降级"""
        print(f"磁盘 {disk_id} 状态降级，建议更换")
        # 发送降级告警
        self._send_degradation_alert(disk_id)
    
    def _trigger_data_rebuild(self, disk_id: str):
        """触发数据重建"""
        # 在实际实现中，这里会触发数据重建流程
        # 包括从其他副本或纠删码中恢复数据
        print(f"    触发磁盘 {disk_id} 上数据的重建流程")
        time.sleep(0.1)  # 模拟重建时间
    
    def _send_failure_alert(self, disk_id: str, failure_info: Dict[str, Any]):
        """发送故障告警"""
        print(f"    发送磁盘 {disk_id} 故障告警")
        # 实际实现中会发送告警到监控系统
    
    def _send_degradation_alert(self, disk_id: str):
        """发送降级告警"""
        print(f"    发送磁盘 {disk_id} 降级告警")

# 使用示例
def on_disk_failure(disk_id: str, failure_info: Dict[str, Any]):
    """磁盘故障回调"""
    print(f"收到磁盘 {disk_id} 故障通知")
    print(f"  故障时间: {failure_info['failure_time']}")
    print(f"  恢复动作: {failure_info['recovery_actions']}")

def demonstrate_disk_failure_handling():
    """演示磁盘故障处理"""
    # 创建健康检查器
    health_checker = DiskHealthChecker(check_interval=10)
    
    # 添加磁盘
    disks = [
        ("disk-001", "/data/disk1", 1000),
        ("disk-002", "/data/disk2", 1000),
        ("disk-003", "/data/disk3", 1000),
    ]
    
    for disk_id, path, capacity in disks:
        health_checker.add_disk(disk_id, path, capacity)
    
    # 创建故障处理器
    failure_handler = DiskFailureHandler(health_checker)
    failure_handler.add_failure_callback(on_disk_failure)
    
    # 启动健康检查
    health_checker.start_health_check()
    
    # 运行一段时间观察
    print("开始磁盘健康监控...")
    time.sleep(60)
    
    # 停止健康检查
    health_checker.stop_health_check()
    
    # 显示最终状态
    print("\n最终磁盘状态:")
    all_status = health_checker.get_all_disk_status()
    for disk_id, status in all_status.items():
        print(f"  {disk_id}: {status['status']} (错误计数: {status['error_count']})")

# 运行演示
# demonstrate_disk_failure_handling()
```

### 10.3.1.2 数据恢复与重建策略

```python
# 数据恢复与重建策略
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import threading
import time
import random

class DataRebuilder:
    """数据重建器"""
    
    def __init__(self, max_concurrent_rebuilds: int = 5):
        self.max_concurrent_rebuilds = max_concurrent_rebuilds
        self.rebuild_queue: List[Dict[str, Any]] = []
        self.running_rebuilds: List[str] = []
        self.rebuild_lock = threading.Lock()
        self.rebuild_thread: Optional[threading.Thread] = None
        self.rebuilding = False
        self.rebuild_callbacks: List[Callable[[str, str, Dict[str, Any]], None]] = []
    
    def add_rebuild_callback(self, callback: Callable[[str, str, Dict[str, Any]], None]):
        """添加重建回调"""
        self.rebuild_callbacks.append(callback)
    
    def queue_rebuild_task(self, task_id: str, disk_id: str, data_blocks: List[str]):
        """排队重建任务"""
        task = {
            "task_id": task_id,
            "disk_id": disk_id,
            "data_blocks": data_blocks,
            "status": "queued",
            "priority": 1,
            "created_at": datetime.now(),
            "started_at": None,
            "completed_at": None,
            "progress": 0.0
        }
        
        with self.rebuild_lock:
            self.rebuild_queue.append(task)
        
        print(f"重建任务 {task_id} 已排队 (数据块数: {len(data_blocks)})")
        return True
    
    def start_rebuild_processor(self):
        """启动重建处理器"""
        if self.rebuilding:
            return
        
        self.rebuilding = True
        self.rebuild_thread = threading.Thread(target=self._rebuild_processor)
        self.rebuild_thread.daemon = True
        self.rebuild_thread.start()
        print("数据重建处理器已启动")
    
    def stop_rebuild_processor(self):
        """停止重建处理器"""
        self.rebuilding = False
        if self.rebuild_thread:
            self.rebuild_thread.join(timeout=5)
        print("数据重建处理器已停止")
    
    def _rebuild_processor(self):
        """重建处理循环"""
        while self.rebuilding:
            try:
                self._process_rebuild_queue()
                time.sleep(1)
            except Exception as e:
                print(f"重建处理时出错: {e}")
    
    def _process_rebuild_queue(self):
        """处理重建队列"""
        with self.rebuild_lock:
            # 检查是否可以启动新任务
            while (len(self.running_rebuilds) < self.max_concurrent_rebuilds and 
                   self.rebuild_queue):
                task = self.rebuild_queue.pop(0)
                if task["status"] == "queued":
                    self._start_rebuild_task(task)
    
    def _start_rebuild_task(self, task: Dict[str, Any]):
        """启动重建任务"""
        task["status"] = "running"
        task["started_at"] = datetime.now()
        self.running_rebuilds.append(task["task_id"])
        
        print(f"启动重建任务 {task['task_id']} (磁盘: {task['disk_id']})")
        
        # 启动重建线程
        rebuild_thread = threading.Thread(target=self._execute_rebuild, args=(task,))
        rebuild_thread.daemon = True
        rebuild_thread.start()
    
    def _execute_rebuild(self, task: Dict[str, Any]):
        """执行重建任务"""
        try:
            # 模拟重建过程
            total_blocks = len(task["data_blocks"])
            for i, block_id in enumerate(task["data_blocks"]):
                if not self.rebuilding:
                    break
                
                # 模拟重建时间
                time.sleep(random.uniform(0.1, 0.5))
                
                # 更新进度
                task["progress"] = (i + 1) / total_blocks
                
                # 模拟重建成功率
                if random.random() < 0.02:  # 2%概率重建失败
                    raise Exception(f"数据块 {block_id} 重建失败")
            
            # 完成重建
            task["status"] = "completed"
            task["completed_at"] = datetime.now()
            task["progress"] = 1.0
            
            print(f"重建任务 {task['task_id']} 完成")
            
            # 从运行列表中移除
            with self.rebuild_lock:
                if task["task_id"] in self.running_rebuilds:
                    self.running_rebuilds.remove(task["task_id"])
            
            # 调用完成回调
            for callback in self.rebuild_callbacks:
                try:
                    callback(task["task_id"], "completed", task)
                except Exception as e:
                    print(f"调用重建回调时出错: {e}")
                    
        except Exception as e:
            task["status"] = "failed"
            task["completed_at"] = datetime.now()
            error_info = {"error": str(e)}
            
            print(f"重建任务 {task['task_id']} 失败: {e}")
            
            # 从运行列表中移除
            with self.rebuild_lock:
                if task["task_id"] in self.running_rebuilds:
                    self.running_rebuilds.remove(task["task_id"])
            
            # 调用失败回调
            for callback in self.rebuild_callbacks:
                try:
                    callback(task["task_id"], "failed", {**task, **error_info})
                except Exception as e:
                    print(f"调用重建回调时出错: {e}")

class DiskReplacementManager:
    """磁盘更换管理器"""
    
    def __init__(self, data_rebuilder: DataRebuilder):
        self.data_rebuilder = data_rebuilder
        self.replacement_queue: List[Dict[str, Any]] = []
        self.replacement_lock = threading.Lock()
        self.replacement_thread: Optional[threading.Thread] = None
        self.replacing = False
    
    def queue_disk_replacement(self, disk_id: str, new_disk_info: Dict[str, Any]):
        """排队磁盘更换"""
        replacement = {
            "disk_id": disk_id,
            "new_disk_info": new_disk_info,
            "status": "queued",
            "created_at": datetime.now(),
            "started_at": None,
            "completed_at": None
        }
        
        with self.replacement_lock:
            self.replacement_queue.append(replacement)
        
        print(f"磁盘 {disk_id} 更换任务已排队")
        return True
    
    def start_replacement_processor(self):
        """启动更换处理器"""
        if self.replacing:
            return
        
        self.replacing = True
        self.replacement_thread = threading.Thread(target=self._replacement_processor)
        self.replacement_thread.daemon = True
        self.replacement_thread.start()
        print("磁盘更换处理器已启动")
    
    def stop_replacement_processor(self):
        """停止更换处理器"""
        self.replacing = False
        if self.replacement_thread:
            self.replacement_thread.join(timeout=5)
        print("磁盘更换处理器已停止")
    
    def _replacement_processor(self):
        """更换处理循环"""
        while self.replacing:
            try:
                self._process_replacement_queue()
                time.sleep(5)
            except Exception as e:
                print(f"更换处理时出错: {e}")
    
    def _process_replacement_queue(self):
        """处理更换队列"""
        with self.replacement_lock:
            if self.replacement_queue:
                replacement = self.replacement_queue.pop(0)
                self._execute_disk_replacement(replacement)
    
    def _execute_disk_replacement(self, replacement: Dict[str, Any]):
        """执行磁盘更换"""
        replacement["status"] = "running"
        replacement["started_at"] = datetime.now()
        
        disk_id = replacement["disk_id"]
        new_disk = replacement["new_disk_info"]
        
        print(f"开始更换磁盘 {disk_id}")
        
        # 1. 物理更换磁盘（模拟）
        print(f"  1. 物理安装新磁盘 {new_disk['path']}")
        time.sleep(2)  # 模拟更换时间
        
        # 2. 初始化新磁盘
        print(f"  2. 初始化新磁盘")
        time.sleep(1)
        
        # 3. 将新磁盘加入系统
        print(f"  3. 将新磁盘加入存储系统")
        time.sleep(1)
        
        # 4. 触发数据重建完成后的同步
        print(f"  4. 同步数据到新磁盘")
        time.sleep(2)
        
        # 完成更换
        replacement["status"] = "completed"
        replacement["completed_at"] = datetime.now()
        
        print(f"磁盘 {disk_id} 更换完成")

# 重建回调函数
def on_rebuild_complete(task_id: str, status: str, task_info: Dict[str, Any]):
    """重建完成回调"""
    if status == "completed":
        print(f"重建任务 {task_id} 成功完成")
    else:
        print(f"重建任务 {task_id} 失败: {task_info.get('error', '未知错误')}")

# 使用示例
def demonstrate_data_rebuild():
    """演示数据重建"""
    # 创建数据重建器
    rebuilder = DataRebuilder(max_concurrent_rebuilds=3)
    rebuilder.add_rebuild_callback(on_rebuild_complete)
    
    # 创建磁盘更换管理器
    replacement_manager = DiskReplacementManager(rebuilder)
    
    # 启动处理器
    rebuilder.start_rebuild_processor()
    replacement_manager.start_replacement_processor()
    
    # 添加重建任务
    for i in range(5):
        data_blocks = [f"block-{j}" for j in range(i*100, (i+1)*100)]
        rebuilder.queue_rebuild_task(f"rebuild-{i+1:03d}", f"disk-{(i%3)+1:03d}", data_blocks)
    
    # 运行一段时间观察
    print("开始数据重建过程...")
    time.sleep(30)
    
    # 停止处理器
    rebuilder.stop_rebuild_processor()
    replacement_manager.stop_replacement_processor()

# 运行演示
# demonstrate_data_rebuild()
```

## 10.3.2 节点宕机处理

节点宕机是分布式系统中的另一种常见故障，可能是由于硬件故障、电源问题、操作系统崩溃或网络中断等原因引起。有效的节点宕机处理机制能够确保系统在部分节点失效时仍能继续提供服务。

### 10.3.2.1 节点故障检测与隔离

```python
# 节点故障检测与隔离
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import random

class NodeHealthMonitor:
    """节点健康监控器"""
    
    def __init__(self, heartbeat_timeout: int = 30, check_interval: int = 5):
        self.heartbeat_timeout = heartbeat_timeout
        self.check_interval = check_interval
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.health_callbacks: List[Callable[[str, str], None]] = []
        self.monitor_thread: Optional[threading.Thread] = None
        self.monitoring = False
    
    def add_node(self, node_id: str, node_info: Dict[str, Any]):
        """添加节点"""
        self.nodes[node_id] = {
            "info": node_info,
            "status": "online",
            "last_heartbeat": datetime.now(),
            "error_count": 0,
            "last_error": None
        }
        print(f"节点 {node_id} 已添加到监控列表")
    
    def add_health_callback(self, callback: Callable[[str, str], None]):
        """添加健康状态回调"""
        self.health_callbacks.append(callback)
    
    def receive_heartbeat(self, node_id: str):
        """接收心跳"""
        if node_id in self.nodes:
            self.nodes[node_id]["last_heartbeat"] = datetime.now()
            # 如果节点之前是离线状态，现在恢复为在线
            if self.nodes[node_id]["status"] == "offline":
                self.nodes[node_id]["status"] = "online"
                print(f"节点 {node_id} 恢复在线")
                for callback in self.health_callbacks:
                    try:
                        callback(node_id, "online")
                    except Exception as e:
                        print(f"调用健康回调时出错: {e}")
    
    def start_monitoring(self):
        """开始监控"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        print("节点健康监控已启动")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        print("节点健康监控已停止")
    
    def _monitor_loop(self):
        """监控循环"""
        while self.monitoring:
            try:
                self._check_node_health()
                time.sleep(self.check_interval)
            except Exception as e:
                print(f"节点监控时出错: {e}")
    
    def _check_node_health(self):
        """检查节点健康状态"""
        current_time = datetime.now()
        timeout_threshold = current_time - timedelta(seconds=self.heartbeat_timeout)
        
        for node_id, node_info in self.nodes.items():
            old_status = node_info["status"]
            
            # 检查心跳超时
            if node_info["last_heartbeat"] < timeout_threshold:
                if old_status == "online":
                    node_info["status"] = "offline"
                    node_info["error_count"] += 1
                    node_info["last_error"] = current_time
                    print(f"节点 {node_id} 心跳超时，标记为离线")
                    
                    # 调用健康状态回调
                    for callback in self.health_callbacks:
                        try:
                            callback(node_id, "offline")
                        except Exception as e:
                            print(f"调用健康回调时出错: {e}")
            # 检查节点是否恢复（通过其他方式检测到节点在线）
            elif old_status == "offline" and random.random() < 0.1:
                # 模拟节点恢复检测
                node_info["status"] = "online"
                print(f"节点 {node_id} 检测到已恢复，在线")
                
                # 调用健康状态回调
                for callback in self.health_callbacks:
                    try:
                        callback(node_id, "online")
                    except Exception as e:
                        print(f"调用健康回调时出错: {e}")

class NodeFailureHandler:
    """节点故障处理器"""
    
    def __init__(self, health_monitor: NodeHealthMonitor):
        self.health_monitor = health_monitor
        self.failure_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        
        # 注册健康状态回调
        self.health_monitor.add_health_callback(self._on_node_health_change)
    
    def add_failure_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加故障回调"""
        self.failure_callbacks.append(callback)
    
    def _on_node_health_change(self, node_id: str, status: str):
        """节点健康状态变化处理"""
        if status == "offline":
            self._handle_node_failure(node_id)
        elif status == "online":
            self._handle_node_recovery(node_id)
    
    def _handle_node_failure(self, node_id: str):
        """处理节点故障"""
        node_info = self.health_monitor.nodes.get(node_id, {})
        if not node_info:
            return
        
        print(f"处理节点 {node_id} 故障")
        
        failure_info = {
            "node_id": node_id,
            "failure_time": datetime.now(),
            "node_info": node_info["info"],
            "error_count": node_info["error_count"],
            "last_error": node_info["last_error"],
            "recovery_actions": []
        }
        
        # 1. 标记节点为故障状态
        failure_info["recovery_actions"].append("标记节点为故障状态")
        print(f"  1. 标记节点 {node_id} 为故障状态")
        
        # 2. 触发故障转移
        failure_info["recovery_actions"].append("触发故障转移流程")
        print(f"  2. 触发故障转移流程")
        self._trigger_failover(node_id)
        
        # 3. 重新分配任务
        failure_info["recovery_actions"].append("重新分配节点任务")
        print(f"  3. 重新分配节点任务")
        self._reallocate_tasks(node_id)
        
        # 4. 发送告警
        failure_info["recovery_actions"].append("发送故障告警")
        print(f"  4. 发送故障告警")
        self._send_failure_alert(node_id, failure_info)
        
        # 调用故障回调
        for callback in self.failure_callbacks:
            try:
                callback(node_id, failure_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
    
    def _handle_node_recovery(self, node_id: str):
        """处理节点恢复"""
        print(f"处理节点 {node_id} 恢复")
        
        recovery_info = {
            "node_id": node_id,
            "recovery_time": datetime.now(),
            "recovery_actions": []
        }
        
        # 1. 检查节点状态
        recovery_info["recovery_actions"].append("检查节点服务状态")
        print(f"  1. 检查节点 {node_id} 服务状态")
        
        # 2. 重新加入集群
        recovery_info["recovery_actions"].append("将节点重新加入集群")
        print(f"  2. 将节点 {node_id} 重新加入集群")
        self._rejoin_cluster(node_id)
        
        # 3. 恢复任务分配
        recovery_info["recovery_actions"].append("恢复节点任务分配")
        print(f"  3. 恢复节点 {node_id} 任务分配")
        self._restore_task_allocation(node_id)
        
        # 4. 发送恢复通知
        recovery_info["recovery_actions"].append("发送恢复通知")
        print(f"  4. 发送节点 {node_id} 恢复通知")
        self._send_recovery_notification(node_id, recovery_info)
    
    def _trigger_failover(self, node_id: str):
        """触发故障转移"""
        print(f"    触发节点 {node_id} 的故障转移")
        time.sleep(0.1)  # 模拟故障转移时间
    
    def _reallocate_tasks(self, node_id: str):
        """重新分配任务"""
        print(f"    重新分配节点 {node_id} 上的任务")
        time.sleep(0.1)  # 模拟任务重新分配时间
    
    def _send_failure_alert(self, node_id: str, failure_info: Dict[str, Any]):
        """发送故障告警"""
        print(f"    发送节点 {node_id} 故障告警")
        # 实际实现中会发送告警到监控系统
    
    def _rejoin_cluster(self, node_id: str):
        """重新加入集群"""
        print(f"    将节点 {node_id} 重新加入集群")
        time.sleep(0.1)  # 模拟重新加入时间
    
    def _restore_task_allocation(self, node_id: str):
        """恢复任务分配"""
        print(f"    恢复节点 {node_id} 的任务分配")
        time.sleep(0.1)  # 模拟任务恢复时间
    
    def _send_recovery_notification(self, node_id: str, recovery_info: Dict[str, Any]):
        """发送恢复通知"""
        print(f"    发送节点 {node_id} 恢复通知")

# 节点故障回调函数
def on_node_failure(node_id: str, failure_info: Dict[str, Any]):
    """节点故障回调"""
    print(f"收到节点 {node_id} 故障通知")
    print(f"  故障时间: {failure_info['failure_time']}")
    print(f"  恢复动作: {failure_info['recovery_actions']}")

# 使用示例
def demonstrate_node_failure_handling():
    """演示节点故障处理"""
    # 创建健康监控器
    health_monitor = NodeHealthMonitor(heartbeat_timeout=10, check_interval=3)
    
    # 添加节点
    nodes = [
        ("node-001", {"role": "metadata", "ip": "192.168.1.101"}),
        ("node-002", {"role": "data", "ip": "192.168.1.102"}),
        ("node-003", {"role": "data", "ip": "192.168.1.103"}),
        ("node-004", {"role": "data", "ip": "192.168.1.104"}),
    ]
    
    for node_id, node_info in nodes:
        health_monitor.add_node(node_id, node_info)
    
    # 创建故障处理器
    failure_handler = NodeFailureHandler(health_monitor)
    failure_handler.add_failure_callback(on_node_failure)
    
    # 启动监控
    health_monitor.start_monitoring()
    
    # 模拟正常的心跳
    print("开始节点健康监控...")
    for i in range(60):  # 运行60个周期
        # 定期发送心跳（除了node-002，模拟它宕机）
        for node_id, _ in nodes:
            if node_id != "node-002" and random.random() < 0.8:  # 80%概率发送心跳
                health_monitor.receive_heartbeat(node_id)
        
        # 模拟node-002在某些时候恢复
        if i > 30 and random.random() < 0.1:
            health_monitor.receive_heartbeat("node-002")
        
        time.sleep(1)
    
    # 停止监控
    health_monitor.stop_monitoring()
    
    # 显示最终状态
    print("\n最终节点状态:")
    for node_id, node_info in health_monitor.nodes.items():
        print(f"  {node_id}: {node_info['status']} (错误计数: {node_info['error_count']})")

# 运行演示
# demonstrate_node_failure_handling()
```

### 10.3.2.2 故障转移与数据一致性保障

```python
# 故障转移与数据一致性保障
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import threading
import time
import random

class FailoverManager:
    """故障转移管理器"""
    
    def __init__(self):
        self.failover_groups: Dict[str, Dict[str, Any]] = {}
        self.failover_lock = threading.Lock()
        self.failover_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
    
    def add_failover_group(self, group_id: str, primary_node: str, 
                          backup_nodes: List[str], data_resources: List[str]):
        """添加故障转移组"""
        self.failover_groups[group_id] = {
            "primary_node": primary_node,
            "backup_nodes": backup_nodes,
            "data_resources": data_resources,
            "current_primary": primary_node,
            "status": "active",
            "failover_history": []
        }
        print(f"故障转移组 {group_id} 已创建")
        print(f"  主节点: {primary_node}")
        print(f"  备份节点: {backup_nodes}")
        print(f"  数据资源: {len(data_resources)} 个")
    
    def add_failover_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加故障转移回调"""
        self.failover_callbacks.append(callback)
    
    def handle_node_failure(self, failed_node: str) -> bool:
        """处理节点故障并执行故障转移"""
        failover_performed = False
        
        with self.failover_lock:
            for group_id, group_info in self.failover_groups.items():
                # 检查故障节点是否是当前主节点
                if group_info["current_primary"] == failed_node:
                    print(f"检测到故障转移组 {group_id} 的主节点 {failed_node} 故障")
                    
                    # 执行故障转移
                    success = self._perform_failover(group_id, failed_node)
                    if success:
                        failover_performed = True
        
        return failover_performed
    
    def _perform_failover(self, group_id: str, failed_node: str) -> bool:
        """执行故障转移"""
        group_info = self.failover_groups[group_id]
        
        # 记录故障转移事件
        failover_event = {
            "timestamp": datetime.now(),
            "failed_node": failed_node,
            "previous_primary": group_info["current_primary"],
            "new_primary": None,
            "status": "in_progress"
        }
        
        # 寻找可用的备份节点
        new_primary = None
        for backup_node in group_info["backup_nodes"]:
            # 在实际实现中，这里会检查节点的健康状态
            # 简化实现，假设第一个备份节点可用
            new_primary = backup_node
            break
        
        if not new_primary:
            print(f"故障转移组 {group_id} 没有可用的备份节点")
            failover_event["status"] = "failed"
            failover_event["error"] = "没有可用的备份节点"
            group_info["failover_history"].append(failover_event)
            return False
        
        print(f"将故障转移组 {group_id} 的主节点从 {failed_node} 切换到 {new_primary}")
        
        # 执行故障转移步骤
        failover_event["new_primary"] = new_primary
        
        # 1. 停止故障节点的服务（如果还能通信）
        print(f"  1. 停止故障节点 {failed_node} 的服务")
        time.sleep(0.5)
        
        # 2. 确保数据一致性
        print(f"  2. 确保数据一致性")
        if not self._ensure_data_consistency(group_id, failed_node, new_primary):
            failover_event["status"] = "failed"
            failover_event["error"] = "数据一致性检查失败"
            group_info["failover_history"].append(failover_event)
            return False
        
        # 3. 切换主节点
        print(f"  3. 切换主节点到 {new_primary}")
        group_info["current_primary"] = new_primary
        time.sleep(0.5)
        
        # 4. 更新服务配置
        print(f"  4. 更新服务配置指向新主节点")
        self._update_service_configuration(group_id, new_primary)
        time.sleep(0.5)
        
        # 5. 启动新主节点服务
        print(f"  5. 启动新主节点 {new_primary} 的服务")
        self._start_new_primary_service(new_primary)
        time.sleep(0.5)
        
        # 完成故障转移
        failover_event["status"] = "completed"
        group_info["failover_history"].append(failover_event)
        
        print(f"故障转移组 {group_id} 故障转移完成")
        
        # 调用故障转移回调
        for callback in self.failover_callbacks:
            try:
                callback(group_id, {
                    "event": "failover_completed",
                    "failed_node": failed_node,
                    "new_primary": new_primary,
                    "timestamp": datetime.now()
                })
            except Exception as e:
                print(f"调用故障转移回调时出错: {e}")
        
        return True
    
    def _ensure_data_consistency(self, group_id: str, failed_node: str, new_primary: str) -> bool:
        """确保数据一致性"""
        print(f"    检查 {group_id} 组数据一致性")
        # 在实际实现中，这里会执行复杂的数据一致性检查
        # 包括日志同步、数据校验等
        time.sleep(1)  # 模拟一致性检查时间
        
        # 模拟一致性检查结果
        consistency_ok = random.random() > 0.05  # 95%概率一致性正常
        if consistency_ok:
            print(f"    数据一致性检查通过")
        else:
            print(f"    数据一致性检查失败")
        
        return consistency_ok
    
    def _update_service_configuration(self, group_id: str, new_primary: str):
        """更新服务配置"""
        print(f"    更新服务配置指向 {new_primary}")
        time.sleep(0.2)  # 模拟配置更新时间
    
    def _start_new_primary_service(self, new_primary: str):
        """启动新主节点服务"""
        print(f"    启动 {new_primary} 上的服务")
        time.sleep(0.3)  # 模拟服务启动时间
    
    def get_failover_group_status(self, group_id: str) -> Dict[str, Any]:
        """获取故障转移组状态"""
        if group_id not in self.failover_groups:
            return {"error": "故障转移组不存在"}
        return self.failover_groups[group_id].copy()
    
    def get_all_failover_status(self) -> Dict[str, Dict[str, Any]]:
        """获取所有故障转移组状态"""
        return {group_id: info.copy() for group_id, info in self.failover_groups.items()}

class ConsistencyManager:
    """一致性管理器"""
    
    def __init__(self):
        self.data_replicas: Dict[str, List[str]] = {}  # data_id -> [node_ids]
        self.consistency_callbacks: List[Callable[[str, str, bool], None]] = []
    
    def add_data_replicas(self, data_id: str, node_ids: List[str]):
        """添加数据副本信息"""
        self.data_replicas[data_id] = node_ids.copy()
        print(f"数据 {data_id} 副本信息已记录: {node_ids}")
    
    def check_data_consistency(self, data_id: str) -> Dict[str, Any]:
        """检查数据一致性"""
        if data_id not in self.data_replicas:
            return {"error": "数据不存在"}
        
        node_ids = self.data_replicas[data_id]
        print(f"检查数据 {data_id} 在 {len(node_ids)} 个节点上的一致性")
        
        # 模拟一致性检查
        consistency_results = {}
        for node_id in node_ids:
            # 模拟检查结果
            is_consistent = random.random() > 0.02  # 98%概率一致
            consistency_results[node_id] = is_consistent
        
        # 计算一致性状态
        consistent_nodes = [node for node, is_consistent in consistency_results.items() 
                           if is_consistent]
        inconsistent_nodes = [node for node, is_consistent in consistency_results.items() 
                             if not is_consistent]
        
        overall_consistent = len(inconsistent_nodes) == 0
        
        result = {
            "data_id": data_id,
            "total_replicas": len(node_ids),
            "consistent_replicas": len(consistent_nodes),
            "inconsistent_replicas": len(inconsistent_nodes),
            "consistent_nodes": consistent_nodes,
            "inconsistent_nodes": inconsistent_nodes,
            "overall_consistent": overall_consistent,
            "timestamp": datetime.now()
        }
        
        print(f"  一致性检查结果: {result['consistent_replicas']}/{result['total_replicas']} 一致")
        
        # 调用一致性回调
        for callback in self.consistency_callbacks:
            try:
                callback(data_id, "check_completed", overall_consistent)
            except Exception as e:
                print(f"调用一致性回调时出错: {e}")
        
        return result
    
    def repair_data_consistency(self, data_id: str) -> bool:
        """修复数据一致性"""
        if data_id not in self.data_replicas:
            return False
        
        print(f"修复数据 {data_id} 的一致性")
        
        # 1. 找到正确的数据源
        print(f"  1. 确定正确的数据源")
        time.sleep(0.5)
        
        # 2. 同步数据到不一致的节点
        print(f"  2. 同步数据到不一致的节点")
        time.sleep(1)
        
        # 3. 验证修复结果
        print(f"  3. 验证修复结果")
        time.sleep(0.5)
        
        print(f"数据 {data_id} 一致性修复完成")
        
        # 调用一致性回调
        for callback in self.consistency_callbacks:
            try:
                callback(data_id, "repair_completed", True)
            except Exception as e:
                print(f"调用一致性回调时出错: {e}")
        
        return True
    
    def add_consistency_callback(self, callback: Callable[[str, str, bool], None]):
        """添加一致性回调"""
        self.consistency_callbacks.append(callback)

# 故障转移回调函数
def on_failover_event(group_id: str, event_info: Dict[str, Any]):
    """故障转移事件回调"""
    if event_info["event"] == "failover_completed":
        print(f"故障转移组 {group_id} 完成故障转移")
        print(f"  故障节点: {event_info['failed_node']}")
        print(f"  新主节点: {event_info['new_primary']}")

# 一致性回调函数
def on_consistency_event(data_id: str, event_type: str, is_consistent: bool):
    """一致性事件回调"""
    if event_type == "check_completed":
        status = "一致" if is_consistent else "不一致"
        print(f"数据 {data_id} 一致性检查完成: {status}")
    elif event_type == "repair_completed":
        print(f"数据 {data_id} 一致性修复完成")

# 使用示例
def demonstrate_failover_and_consistency():
    """演示故障转移与一致性保障"""
    # 创建故障转移管理器
    failover_manager = FailoverManager()
    failover_manager.add_failover_callback(on_failover_event)
    
    # 创建一致性管理器
    consistency_manager = ConsistencyManager()
    consistency_manager.add_consistency_callback(on_consistency_event)
    
    # 添加故障转移组
    failover_manager.add_failover_group(
        "metadata-group-1",
        "node-001",
        ["node-002", "node-003"],
        ["metadata-shard-1", "metadata-shard-2"]
    )
    
    failover_manager.add_failover_group(
        "data-group-1",
        "node-004",
        ["node-005", "node-006"],
        ["data-shard-1", "data-shard-2", "data-shard-3"]
    )
    
    # 添加数据副本信息
    consistency_manager.add_data_replicas("metadata-shard-1", ["node-001", "node-002"])
    consistency_manager.add_data_replicas("metadata-shard-2", ["node-001", "node-003"])
    consistency_manager.add_data_replicas("data-shard-1", ["node-004", "node-005", "node-006"])
    
    # 模拟节点故障
    print("模拟节点 node-001 故障...")
    failover_manager.handle_node_failure("node-001")
    
    # 检查数据一致性
    print("\n检查数据一致性...")
    consistency_manager.check_data_consistency("metadata-shard-1")
    consistency_manager.check_data_consistency("metadata-shard-2")
    consistency_manager.check_data_consistency("data-shard-1")
    
    # 显示故障转移组状态
    print("\n故障转移组状态:")
    all_status = failover_manager.get_all_failover_status()
    for group_id, status in all_status.items():
        print(f"  {group_id}:")
        print(f"    当前主节点: {status['current_primary']}")
        print(f"    故障转移历史: {len(status['failover_history'])} 次")

# 运行演示
# demonstrate_failover_and_consistency()
```

## 10.3.3 网络分区处理

网络分区（Network Partition）是分布式系统中的一个严重问题，它会导致集群被分割成多个无法相互通信的子集。在这种情况下，系统需要有明确的策略来处理分区，以确保数据一致性和服务可用性。

### 10.3.3.1 网络分区检测机制

```python
# 网络分区检测机制
import time
import threading
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
import random

class NetworkPartitionDetector:
    """网络分区检测器"""
    
    def __init__(self, check_interval: int = 5, partition_timeout: int = 30):
        self.check_interval = check_interval
        self.partition_timeout = partition_timeout
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.node_connections: Dict[str, Set[str]] = {}  # node_id -> set of connected nodes
        self.partition_callbacks: List[Callable[[List[Set[str]]], None]] = []
        self.detect_thread: Optional[threading.Thread] = None
        self.detecting = False
        self.last_partition_state: List[Set[str]] = []
    
    def add_node(self, node_id: str, node_info: Dict[str, Any]):
        """添加节点"""
        self.nodes[node_id] = {
            "info": node_info,
            "last_heartbeat": datetime.now(),
            "status": "online"
        }
        self.node_connections[node_id] = set()
        print(f"节点 {node_id} 已添加到网络分区检测器")
    
    def update_node_connections(self, node_id: str, connected_nodes: List[str]):
        """更新节点连接信息"""
        if node_id in self.nodes:
            self.node_connections[node_id] = set(connected_nodes)
            self.nodes[node_id]["last_heartbeat"] = datetime.now()
    
    def add_partition_callback(self, callback: Callable[[List[Set[str]]], None]):
        """添加分区回调"""
        self.partition_callbacks.append(callback)
    
    def start_detection(self):
        """开始分区检测"""
        if self.detecting:
            return
        
        self.detecting = True
        self.detect_thread = threading.Thread(target=self._detection_loop)
        self.detect_thread.daemon = True
        self.detect_thread.start()
        print("网络分区检测已启动")
    
    def stop_detection(self):
        """停止分区检测"""
        self.detecting = False
        if self.detect_thread:
            self.detect_thread.join(timeout=5)
        print("网络分区检测已停止")
    
    def _detection_loop(self):
        """检测循环"""
        while self.detecting:
            try:
                self._detect_partitions()
                time.sleep(self.check_interval)
            except Exception as e:
                print(f"分区检测时出错: {e}")
    
    def _detect_partitions(self):
        """检测网络分区"""
        # 更新节点状态（超时的节点标记为离线）
        current_time = datetime.now()
        timeout_threshold = current_time - timedelta(seconds=self.partition_timeout)
        
        for node_id, node_info in self.nodes.items():
            if node_info["last_heartbeat"] < timeout_threshold:
                if node_info["status"] == "online":
                    node_info["status"] = "offline"
                    print(f"节点 {node_id} 网络超时，标记为离线")
            else:
                if node_info["status"] == "offline":
                    node_info["status"] = "online"
                    print(f"节点 {node_id} 网络恢复，在线")
        
        # 检测分区
        partitions = self._find_partitions()
        
        # 如果分区状态发生变化，调用回调函数
        if partitions != self.last_partition_state:
            print(f"网络分区状态变化: {len(partitions)} 个分区")
            self.last_partition_state = partitions
            
            for callback in self.partition_callbacks:
                try:
                    callback(partitions)
                except Exception as e:
                    print(f"调用分区回调时出错: {e}")
    
    def _find_partitions(self) -> List[Set[str]]:
        """查找网络分区"""
        # 使用图的连通性算法查找分区
        online_nodes = {node_id for node_id, info in self.nodes.items() 
                       if info["status"] == "online"}
        
        if len(online_nodes) <= 1:
            return [online_nodes] if online_nodes else []
        
        partitions = []
        visited = set()
        
        for node_id in online_nodes:
            if node_id not in visited:
                # 使用BFS查找连通分量
                partition = self._bfs_connected_component(node_id, online_nodes, visited)
                partitions.append(partition)
        
        return partitions
    
    def _bfs_connected_component(self, start_node: str, online_nodes: Set[str], 
                               visited: Set[str]) -> Set[str]:
        """BFS查找连通分量"""
        queue = [start_node]
        component = set()
        
        while queue:
            current_node = queue.pop(0)
            if current_node in visited or current_node not in online_nodes:
                continue
            
            visited.add(current_node)
            component.add(current_node)
            
            # 添加所有连接的节点到队列
            for connected_node in self.node_connections.get(current_node, set()):
                if connected_node in online_nodes and connected_node not in visited:
                    queue.append(connected_node)
        
        return component

class PartitionHandler:
    """分区处理器"""
    
    def __init__(self, partition_detector: NetworkPartitionDetector):
        self.partition_detector = partition_detector
        self.partition_handler_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        
        # 注册分区回调
        self.partition_detector.add_partition_callback(self._on_partition_detected)
    
    def add_partition_handler_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加分区处理回调"""
        self.partition_handler_callbacks.append(callback)
    
    def _on_partition_detected(self, partitions: List[Set[str]]):
        """分区检测回调"""
        if len(partitions) > 1:
            self._handle_network_partition(partitions)
        elif len(partitions) == 1 and len(partitions[0]) == len(self.partition_detector.nodes):
            self._handle_partition_recovery(partitions[0])
    
    def _handle_network_partition(self, partitions: List[Set[str]]):
        """处理网络分区"""
        print(f"检测到网络分区: {len(partitions)} 个分区")
        
        # 分析分区信息
        partition_info = {
            "timestamp": datetime.now(),
            "partition_count": len(partitions),
            "partitions": [list(partition) for partition in partitions],
            "actions": []
        }
        
        # 为每个分区选择领导者
        for i, partition in enumerate(partitions):
            leader = self._elect_leader(list(partition))
            print(f"  分区 {i+1} ({len(partition)} 个节点): 选举 {leader} 为领导者")
            partition_info["actions"].append(f"分区 {i+1} 选举 {leader} 为领导者")
        
        # 确定主分区（包含大多数节点的分区）
        total_nodes = len(self.partition_detector.nodes)
        majority_partition = None
        for partition in partitions:
            if len(partition) > total_nodes // 2:
                majority_partition = partition
                break
        
        if majority_partition:
            print(f"  主分区确定: {len(majority_partition)} 个节点")
            partition_info["actions"].append(f"确定主分区包含 {len(majority_partition)} 个节点")
            
            # 主分区继续提供服务
            self._enable_majority_services(majority_partition)
            partition_info["actions"].append("主分区继续提供服务")
            
            # 非主分区进入只读模式或停止服务
            for partition in partitions:
                if partition != majority_partition:
                    print(f"  非主分区 ({len(partition)} 个节点) 进入只读模式")
                    self._enable_readonly_mode(partition)
                    partition_info["actions"].append(f"非主分区进入只读模式")
        else:
            print("  没有主分区（脑裂情况）")
            partition_info["actions"].append("检测到脑裂情况")
            
            # 在脑裂情况下，所有分区都进入安全模式
            for partition in partitions:
                print(f"  分区 ({len(partition)} 个节点) 进入安全模式")
                self._enable_safe_mode(partition)
                partition_info["actions"].append(f"分区进入安全模式")
        
        # 发送分区告警
        self._send_partition_alert(partition_info)
        
        # 调用分区处理回调
        for callback in self.partition_handler_callbacks:
            try:
                callback("partition_detected", partition_info)
            except Exception as e:
                print(f"调用分区处理回调时出错: {e}")
    
    def _handle_partition_recovery(self, recovered_partition: Set[str]):
        """处理分区恢复"""
        print("网络分区已恢复")
        
        recovery_info = {
            "timestamp": datetime.now(),
            "recovered_nodes": list(recovered_partition),
            "actions": []
        }
        
        # 1. 检查数据一致性
        print("  1. 检查数据一致性")
        self._check_data_consistency_after_partition()
        recovery_info["actions"].append("检查数据一致性")
        
        # 2. 同步数据
        print("  2. 同步分区期间产生的数据")
        self._sync_partition_data()
        recovery_info["actions"].append("同步分区期间数据")
        
        # 3. 恢复正常服务
        print("  3. 恢复正常服务")
        self._resume_normal_services()
        recovery_info["actions"].append("恢复正常服务")
        
        # 4. 发送恢复通知
        print("  4. 发送分区恢复通知")
        self._send_recovery_notification(recovery_info)
        recovery_info["actions"].append("发送恢复通知")
        
        # 调用分区处理回调
        for callback in self.partition_handler_callbacks:
            try:
                callback("partition_recovered", recovery_info)
            except Exception as e:
                print(f"调用分区处理回调时出错: {e}")
    
    def _elect_leader(self, nodes: List[str]) -> str:
        """选举领导者（简化实现）"""
        # 在实际实现中，可能使用更复杂的选举算法
        # 如Raft、Paxos等
        return min(nodes)  # 简化为选择节点ID最小的作为领导者
    
    def _enable_majority_services(self, majority_partition: Set[str]):
        """启用主分区服务"""
        print(f"    启用主分区服务")
        time.sleep(0.1)
    
    def _enable_readonly_mode(self, partition: Set[str]):
        """启用只读模式"""
        print(f"    启用只读模式")
        time.sleep(0.1)
    
    def _enable_safe_mode(self, partition: Set[str]):
        """启用安全模式"""
        print(f"    启用安全模式")
        time.sleep(0.1)
    
    def _send_partition_alert(self, partition_info: Dict[str, Any]):
        """发送分区告警"""
        print(f"    发送网络分区告警")
        time.sleep(0.1)
    
    def _check_data_consistency_after_partition(self):
        """分区后检查数据一致性"""
        print(f"    检查分区期间数据一致性")
        time.sleep(0.5)
    
    def _sync_partition_data(self):
        """同步分区数据"""
        print(f"    同步分区期间产生的数据")
        time.sleep(1)
    
    def _resume_normal_services(self):
        """恢复服务"""
        print(f"    恢复正常服务")
        time.sleep(0.2)
    
    def _send_recovery_notification(self, recovery_info: Dict[str, Any]):
        """发送恢复通知"""
        print(f"    发送恢复通知")
        time.sleep(0.1)

# 分区处理回调函数
def on_partition_event(event_type: str, event_info: Dict[str, Any]):
    """分区事件回调"""
    if event_type == "partition_detected":
        print(f"网络分区检测事件:")
        print(f"  分区数量: {event_info['partition_count']}")
        print(f"  处理动作: {event_info['actions']}")
    elif event_type == "partition_recovered":
        print(f"网络分区恢复事件:")
        print(f"  恢复节点: {len(event_info['recovered_nodes'])} 个")
        print(f"  恢复动作: {event_info['actions']}")

# 使用示例
def demonstrate_network_partition_handling():
    """演示网络分区处理"""
    # 创建分区检测器
    partition_detector = NetworkPartitionDetector(check_interval=3, partition_timeout=15)
    
    # 添加节点
    nodes = [
        ("node-001", {"role": "metadata", "ip": "192.168.1.101"}),
        ("node-002", {"role": "metadata", "ip": "192.168.1.102"}),
        ("node-003", {"role": "data", "ip": "192.168.1.103"}),
        ("node-004", {"role": "data", "ip": "192.168.1.104"}),
        ("node-005", {"role": "data", "ip": "192.168.1.105"}),
    ]
    
    for node_id, node_info in nodes:
        partition_detector.add_node(node_id, node_info)
    
    # 创建分区处理器
    partition_handler = PartitionHandler(partition_detector)
    partition_handler.add_partition_handler_callback(on_partition_event)
    
    # 启动分区检测
    partition_detector.start_detection()
    
    # 模拟正常网络状态
    print("模拟正常网络状态...")
    for i in range(10):
        # 更新节点连接信息
        for j, (node_id, _) in enumerate(nodes):
            # 每个节点连接到其他所有节点（正常情况）
            connected_nodes = [n[0] for k, n in enumerate(nodes) if k != j]
            partition_detector.update_node_connections(node_id, connected_nodes)
        
        time.sleep(1)
    
    # 模拟网络分区（node-001, node-002 在一个分区，node-003, node-004, node-005 在另一个分区）
    print("\n模拟网络分区...")
    for i in range(20):
        if i < 10:
            # 分区1: node-001, node-002 相互连接
            partition_detector.update_node_connections("node-001", ["node-002"])
            partition_detector.update_node_connections("node-002", ["node-001"])
            
            # 分区2: node-003, node-004, node-005 相互连接
            partition_detector.update_node_connections("node-003", ["node-004", "node-005"])
            partition_detector.update_node_connections("node-004", ["node-003", "node-005"])
            partition_detector.update_node_connections("node-005", ["node-003", "node-004"])
        else:
            # 模拟网络恢复
            for j, (node_id, _) in enumerate(nodes):
                connected_nodes = [n[0] for k, n in enumerate(nodes) if k != j]
                partition_detector.update_node_connections(node_id, connected_nodes)
        
        time.sleep(1)
    
    # 停止分区检测
    partition_detector.stop_detection()

# 运行演示
# demonstrate_network_partition_handling()
```

### 10.3.3.2 分区恢复与数据同步

```python
# 分区恢复与数据同步
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
import threading
import time
import random
import hashlib

class PartitionRecoveryManager:
    """分区恢复管理器"""
    
    def __init__(self):
        self.recovery_tasks: Dict[str, Dict[str, Any]] = {}
        self.recovery_lock = threading.Lock()
        self.recovery_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
    
    def add_recovery_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加恢复回调"""
        self.recovery_callbacks.append(callback)
    
    def start_partition_recovery(self, partition_id: str, 
                               isolated_nodes: List[str], 
                               connected_nodes: List[str]) -> str:
        """开始分区恢复"""
        task_id = f"recovery-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        recovery_task = {
            "task_id": task_id,
            "partition_id": partition_id,
            "isolated_nodes": isolated_nodes,
            "connected_nodes": connected_nodes,
            "status": "pending",
            "start_time": datetime.now(),
            "end_time": None,
            "steps": [],
            "progress": 0.0
        }
        
        with self.recovery_lock:
            self.recovery_tasks[task_id] = recovery_task
        
        print(f"启动分区恢复任务 {task_id}")
        print(f"  隔离节点: {isolated_nodes}")
        print(f"  连接节点: {connected_nodes}")
        
        # 启动恢复线程
        recovery_thread = threading.Thread(target=self._execute_recovery, args=(task_id,))
        recovery_thread.daemon = True
        recovery_thread.start()
        
        return task_id
    
    def _execute_recovery(self, task_id: str):
        """执行恢复任务"""
        with self.recovery_lock:
            if task_id not in self.recovery_tasks:
                return
            task = self.recovery_tasks[task_id]
            task["status"] = "running"
        
        try:
            # 执行恢复步骤
            steps = [
                self._establish_communication,
                self._sync_metadata,
                self._sync_data,
                self._validate_consistency,
                self._resume_services
            ]
            
            total_steps = len(steps)
            for i, step in enumerate(steps):
                if task["status"] == "cancelled":
                    break
                
                step_name = step.__name__.replace("_", " ").title()
                print(f"  执行步骤 {i+1}/{total_steps}: {step_name}")
                
                with self.recovery_lock:
                    task["steps"].append({
                        "step": i+1,
                        "name": step_name,
                        "status": "running",
                        "start_time": datetime.now()
                    })
                
                # 执行步骤
                try:
                    step(task)
                    step_status = "completed"
                except Exception as e:
                    step_status = "failed"
                    print(f"    步骤失败: {e}")
                    raise e
                finally:
                    with self.recovery_lock:
                        task["steps"][-1]["status"] = step_status
                        task["steps"][-1]["end_time"] = datetime.now()
                
                # 更新进度
                with self.recovery_lock:
                    task["progress"] = (i + 1) / total_steps
            
            # 完成恢复
            with self.recovery_lock:
                task["status"] = "completed"
                task["end_time"] = datetime.now()
                task["progress"] = 1.0
            
            print(f"分区恢复任务 {task_id} 完成")
            
            # 调用恢复回调
            for callback in self.recovery_callbacks:
                try:
                    callback(task_id, {"status": "completed", "task": task})
                except Exception as e:
                    print(f"调用恢复回调时出错: {e}")
                    
        except Exception as e:
            with self.recovery_lock:
                task["status"] = "failed"
                task["end_time"] = datetime.now()
                task["error"] = str(e)
            
            print(f"分区恢复任务 {task_id} 失败: {e}")
            
            # 调用恢复回调
            for callback in self.recovery_callbacks:
                try:
                    callback(task_id, {"status": "failed", "task": task, "error": str(e)})
                except Exception as e:
                    print(f"调用恢复回调时出错: {e}")
    
    def _establish_communication(self, task: Dict[str, Any]):
        """建立通信"""
        print(f"    建立隔离节点与连接节点间的通信")
        time.sleep(1)  # 模拟建立通信时间
        
        # 模拟通信建立成功率
        if random.random() < 0.05:  # 5%概率失败
            raise Exception("无法建立节点间通信")
    
    def _sync_metadata(self, task: Dict[str, Any]):
        """同步元数据"""
        print(f"    同步元数据")
        time.sleep(2)  # 模拟元数据同步时间
        
        # 模拟元数据同步成功率
        if random.random() < 0.02:  # 2%概率失败
            raise Exception("元数据同步失败")
    
    def _sync_data(self, task: Dict[str, Any]):
        """同步数据"""
        print(f"    同步数据")
        isolated_nodes = task["isolated_nodes"]
        connected_nodes = task["connected_nodes"]
        
        # 模拟数据同步过程
        total_data_blocks = len(isolated_nodes) * 100
        for i in range(total_data_blocks):
            # 模拟同步进度
            if i % 20 == 0:
                progress = (i + 1) / total_data_blocks
                print(f"      数据同步进度: {progress:.1%}")
            
            time.sleep(0.01)  # 模拟同步时间
            
            # 模拟同步失败
            if random.random() < 0.001:  # 0.1%概率失败
                raise Exception(f"数据块 {i+1} 同步失败")
    
    def _validate_consistency(self, task: Dict[str, Any]):
        """验证一致性"""
        print(f"    验证数据一致性")
        time.sleep(1.5)  # 模拟一致性验证时间
        
        # 模拟一致性验证结果
        if random.random() < 0.03:  # 3%概率不一致
            raise Exception("数据一致性验证失败")
    
    def _resume_services(self, task: Dict[str, Any]):
        """恢复服务"""
        print(f"    恢复隔离节点服务")
        time.sleep(1)  # 模拟服务恢复时间
    
    def get_recovery_status(self, task_id: str) -> Dict[str, Any]:
        """获取恢复任务状态"""
        with self.recovery_lock:
            if task_id not in self.recovery_tasks:
                return {"error": "恢复任务不存在"}
            return self.recovery_tasks[task_id].copy()
    
    def cancel_recovery(self, task_id: str) -> bool:
        """取消恢复任务"""
        with self.recovery_lock:
            if task_id not in self.recovery_tasks:
                return False
            
            task = self.recovery_tasks[task_id]
            if task["status"] in ["completed", "failed"]:
                return False
            
            task["status"] = "cancelled"
            task["end_time"] = datetime.now()
            return True

class DataConsistencyValidator:
    """数据一致性验证器"""
    
    def __init__(self):
        self.data_checksums: Dict[str, str] = {}  # data_id -> checksum
        self.validation_results: Dict[str, Dict[str, Any]] = {}
    
    def calculate_data_checksum(self, data: bytes) -> str:
        """计算数据校验和"""
        return hashlib.md5(data).hexdigest()
    
    def record_data_checksum(self, data_id: str, checksum: str):
        """记录数据校验和"""
        self.data_checksums[data_id] = checksum
    
    def validate_data_consistency(self, data_id: str, data: bytes, 
                               nodes: List[str]) -> Dict[str, Any]:
        """验证数据一致性"""
        print(f"验证数据 {data_id} 在 {len(nodes)} 个节点上的一致性")
        
        # 计算当前数据的校验和
        current_checksum = self.calculate_data_checksum(data)
        
        # 获取记录的校验和
        recorded_checksum = self.data_checksums.get(data_id)
        
        if not recorded_checksum:
            # 如果没有记录的校验和，使用当前的作为基准
            self.record_data_checksum(data_id, current_checksum)
            recorded_checksum = current_checksum
        
        # 验证一致性
        is_consistent = current_checksum == recorded_checksum
        
        result = {
            "data_id": data_id,
            "current_checksum": current_checksum,
            "recorded_checksum": recorded_checksum,
            "is_consistent": is_consistent,
            "nodes_checked": nodes,
            "timestamp": datetime.now()
        }
        
        self.validation_results[data_id] = result
        
        status = "一致" if is_consistent else "不一致"
        print(f"  数据 {data_id} 一致性验证: {status}")
        
        return result
    
    def repair_inconsistent_data(self, data_id: str, correct_data: bytes, 
                               inconsistent_nodes: List[str]) -> bool:
        """修复不一致的数据"""
        print(f"修复节点 {inconsistent_nodes} 上的数据 {data_id}")
        
        # 模拟数据修复过程
        for node in inconsistent_nodes:
            print(f"  向节点 {node} 同步正确数据")
            time.sleep(0.1)  # 模拟同步时间
        
        # 更新校验和记录
        new_checksum = self.calculate_data_checksum(correct_data)
        self.record_data_checksum(data_id, new_checksum)
        
        print(f"数据 {data_id} 修复完成")
        return True
    
    def get_validation_history(self, data_id: str) -> List[Dict[str, Any]]:
        """获取验证历史"""
        return self.validation_results.get(data_id, [])

class ConflictResolver:
    """冲突解决器"""
    
    def __init__(self):
        self.conflict_resolution_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
    
    def add_conflict_resolution_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加冲突解决回调"""
        self.conflict_resolution_callbacks.append(callback)
    
    def resolve_timestamp_conflict(self, data_id: str, 
                                 versions: Dict[str, Dict[str, Any]]) -> str:
        """基于时间戳解决冲突"""
        print(f"基于时间戳解决数据 {data_id} 的冲突")
        
        # 选择时间戳最新的版本
        latest_version = None
        latest_timestamp = None
        
        for node, version_info in versions.items():
            timestamp = version_info.get("timestamp")
            if latest_timestamp is None or timestamp > latest_timestamp:
                latest_timestamp = timestamp
                latest_version = node
        
        print(f"  选择节点 {latest_version} 的版本（时间戳: {latest_timestamp}）")
        
        # 调用冲突解决回调
        resolution_info = {
            "data_id": data_id,
            "resolution": "timestamp_based",
            "selected_version": latest_version,
            "selected_timestamp": latest_timestamp,
            "conflicting_versions": list(versions.keys())
        }
        
        for callback in self.conflict_resolution_callbacks:
            try:
                callback(data_id, resolution_info)
            except Exception as e:
                print(f"调用冲突解决回调时出错: {e}")
        
        return latest_version
    
    def resolve_version_vector_conflict(self, data_id: str, 
                                      versions: Dict[str, Dict[str, Any]]) -> str:
        """基于版本向量解决冲突"""
        print(f"基于版本向量解决数据 {data_id} 的冲突")
        
        # 简化实现：选择因果关系最新的版本
        # 在实际实现中，会使用向量时钟算法
        causal_latest = None
        max_causal_value = -1
        
        for node, version_info in versions.items():
            causal_value = version_info.get("causal_value", 0)
            if causal_value > max_causal_value:
                max_causal_value = causal_value
                causal_latest = node
        
        print(f"  选择节点 {causal_latest} 的版本（因果值: {max_causal_value}）")
        
        # 调用冲突解决回调
        resolution_info = {
            "data_id": data_id,
            "resolution": "version_vector_based",
            "selected_version": causal_latest,
            "selected_causal_value": max_causal_value,
            "conflicting_versions": list(versions.keys())
        }
        
        for callback in self.conflict_resolution_callbacks:
            try:
                callback(data_id, resolution_info)
            except Exception as e:
                print(f"调用冲突解决回调时出错: {e}")
        
        return causal_latest

# 恢复回调函数
def on_recovery_event(task_id: str, event_info: Dict[str, Any]):
    """恢复事件回调"""
    status = event_info["status"]
    if status == "completed":
        print(f"恢复任务 {task_id} 完成")
        task = event_info["task"]
        print(f"  总步骤: {len(task['steps'])}")
        print(f"  耗时: {task['end_time'] - task['start_time']}")
    elif status == "failed":
        print(f"恢复任务 {task_id} 失败: {event_info.get('error', '未知错误')}")

# 冲突解决回调函数
def on_conflict_resolved(data_id: str, resolution_info: Dict[str, Any]):
    """冲突解决回调"""
    print(f"数据 {data_id} 冲突已解决")
    print(f"  解决方式: {resolution_info['resolution']}")
    print(f"  选择版本: {resolution_info['selected_version']}")

# 使用示例
def demonstrate_partition_recovery():
    """演示分区恢复"""
    # 创建恢复管理器
    recovery_manager = PartitionRecoveryManager()
    recovery_manager.add_recovery_callback(on_recovery_event)
    
    # 创建一致性验证器
    consistency_validator = DataConsistencyValidator()
    
    # 创建冲突解决器
    conflict_resolver = ConflictResolver()
    conflict_resolver.add_conflict_resolution_callback(on_conflict_resolved)
    
    # 开始分区恢复任务
    task_id = recovery_manager.start_partition_recovery(
        "partition-001",
        ["node-001", "node-002"],  # 隔离节点
        ["node-003", "node-004", "node-005"]  # 连接节点
    )
    
    # 模拟一些数据一致性验证
    print("\n模拟数据一致性验证...")
    test_data = b"test data for consistency validation"
    nodes = ["node-001", "node-002", "node-003", "node-004", "node-005"]
    
    # 验证数据一致性
    consistency_validator.validate_data_consistency("data-001", test_data, nodes)
    
    # 模拟冲突解决
    print("\n模拟冲突解决...")
    versions = {
        "node-001": {"timestamp": datetime.now(), "causal_value": 10},
        "node-003": {"timestamp": datetime.now(), "causal_value": 15}
    }
    
    conflict_resolver.resolve_timestamp_conflict("data-001", versions)
    conflict_resolver.resolve_version_vector_conflict("data-001", versions)
    
    # 观察恢复进度
    print("\n观察恢复进度...")
    for i in range(30):
        status = recovery_manager.get_recovery_status(task_id)
        if status.get("status") in ["completed", "failed", "cancelled"]:
            break
        
        progress = status.get("progress", 0)
        print(f"  恢复进度: {progress:.1%}")
        time.sleep(1)
    
    # 显示最终状态
    final_status = recovery_manager.get_recovery_status(task_id)
    print(f"\n最终恢复状态: {final_status['status']}")

# 运行演示
# demonstrate_partition_recovery()
```

通过以上实现，我们构建了一个完整的常见故障处理手册，涵盖了磁盘故障、节点宕机和网络分区三种主要故障类型。每种故障类型都包含了详细的检测机制、处理策略和恢复流程，并提供了相应的代码实现示例。

这些故障处理机制能够帮助分布式文件存储平台在面对各种故障时保持系统的稳定性和数据的完整性，确保服务的持续可用。