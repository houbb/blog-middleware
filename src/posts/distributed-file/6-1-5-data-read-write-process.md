---
title: 数据读写流程与并发控制
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台中，数据读写流程与并发控制是确保数据一致性、系统性能和用户体验的关键技术。随着并发访问量的增加和数据规模的扩大，如何高效地处理读写请求并保证数据的正确性成为系统设计的核心挑战。本章将深入探讨分布式文件存储系统中的数据读写流程、并发控制机制以及相关的优化技术。

## 6.1.5.1 数据读写流程概述

数据读写流程是分布式文件存储系统的核心操作，涉及客户端请求处理、元数据管理、数据传输和一致性保证等多个环节。

### 6.1.5.1.1 读写流程的基本架构

```python
# 数据读写流程基本架构
import time
import threading
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass

class OperationType(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"

class OperationStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class DataOperation:
    operation_id: str
    operation_type: OperationType
    file_path: str
    client_id: str
    timestamp: float
    status: OperationStatus
    priority: int
    metadata: Dict

class ReadWriteFlowManager:
    def __init__(self):
        self.operation_queue = []
        self.active_operations = {}
        self.completed_operations = {}
        self.operation_lock = threading.Lock()
        self.max_concurrent_operations = 1000
    
    def submit_operation(self, operation_type: OperationType, file_path: str, 
                        client_id: str, priority: int = 1, metadata: Dict = None) -> str:
        """
        提交数据操作请求
        :param operation_type: 操作类型
        :param file_path: 文件路径
        :param client_id: 客户端ID
        :param priority: 优先级
        :param metadata: 元数据
        :return: 操作ID
        """
        operation_id = f"op_{int(time.time() * 1000000)}_{client_id}"
        
        operation = DataOperation(
            operation_id=operation_id,
            operation_type=operation_type,
            file_path=file_path,
            client_id=client_id,
            timestamp=time.time(),
            status=OperationStatus.PENDING,
            priority=priority,
            metadata=metadata or {}
        )
        
        with self.operation_lock:
            # 检查并发限制
            if len(self.active_operations) >= self.max_concurrent_operations:
                # 操作排队等待
                self.operation_queue.append(operation)
                print(f"操作 {operation_id} 已排队等待，当前活跃操作数: {len(self.active_operations)}")
            else:
                # 立即处理操作
                self.active_operations[operation_id] = operation
                print(f"操作 {operation_id} 开始处理")
                # 启动处理线程
                threading.Thread(target=self._process_operation, args=(operation,), 
                               daemon=True).start()
        
        return operation_id
    
    def _process_operation(self, operation: DataOperation):
        """
        处理数据操作
        :param operation: 数据操作
        """
        try:
            operation.status = OperationStatus.PROCESSING
            
            # 模拟操作处理时间
            if operation.operation_type == OperationType.READ:
                time.sleep(0.05)  # 50ms读取延迟
                result = self._handle_read_operation(operation)
            elif operation.operation_type == OperationType.WRITE:
                time.sleep(0.1)   # 100ms写入延迟
                result = self._handle_write_operation(operation)
            elif operation.operation_type == OperationType.DELETE:
                time.sleep(0.02)  # 20ms删除延迟
                result = self._handle_delete_operation(operation)
            
            operation.status = OperationStatus.COMPLETED
            
            # 移动到完成列表
            with self.operation_lock:
                if operation.operation_id in self.active_operations:
                    completed_op = self.active_operations.pop(operation.operation_id)
                    self.completed_operations[operation.operation_id] = completed_op
            
            print(f"操作 {operation.operation_id} 处理完成")
            
            # 检查是否有排队的操作可以处理
            self._process_queued_operations()
            
        except Exception as e:
            operation.status = OperationStatus.FAILED
            print(f"操作 {operation.operation_id} 处理失败: {e}")
            
            # 移动到完成列表（标记为失败）
            with self.operation_lock:
                if operation.operation_id in self.active_operations:
                    failed_op = self.active_operations.pop(operation.operation_id)
                    self.completed_operations[operation.operation_id] = failed_op
            
            # 检查是否有排队的操作可以处理
            self._process_queued_operations()
    
    def _handle_read_operation(self, operation: DataOperation) -> Dict:
        """
        处理读取操作
        :param operation: 读取操作
        :return: 读取结果
        """
        # 1. 解析文件路径，获取元数据
        # 2. 定位数据块位置
        # 3. 从存储节点读取数据
        # 4. 组装数据并返回
        
        print(f"处理读取操作: {operation.file_path}")
        return {
            "status": "success",
            "data": f"content_of_{operation.file_path}",
            "size": len(operation.file_path),
            "timestamp": time.time()
        }
    
    def _handle_write_operation(self, operation: DataOperation) -> Dict:
        """
        处理写入操作
        :param operation: 写入操作
        :return: 写入结果
        """
        # 1. 验证写入权限
        # 2. 分配数据块位置
        # 3. 写入数据到存储节点
        # 4. 更新元数据
        # 5. 返回写入结果
        
        print(f"处理写入操作: {operation.file_path}")
        return {
            "status": "success",
            "file_path": operation.file_path,
            "size": len(operation.metadata.get("data", "")),
            "timestamp": time.time()
        }
    
    def _handle_delete_operation(self, operation: DataOperation) -> Dict:
        """
        处理删除操作
        :param operation: 删除操作
        :return: 删除结果
        """
        # 1. 验证删除权限
        # 2. 标记数据块为删除状态
        # 3. 更新元数据
        # 4. 返回删除结果
        
        print(f"处理删除操作: {operation.file_path}")
        return {
            "status": "success",
            "file_path": operation.file_path,
            "timestamp": time.time()
        }
    
    def _process_queued_operations(self):
        """处理排队的操作"""
        with self.operation_lock:
            while (self.operation_queue and 
                   len(self.active_operations) < self.max_concurrent_operations):
                # 取出优先级最高的操作
                self.operation_queue.sort(key=lambda x: x.priority, reverse=True)
                operation = self.operation_queue.pop(0)
                
                # 处理操作
                self.active_operations[operation.operation_id] = operation
                print(f"开始处理排队操作: {operation.operation_id}")
                threading.Thread(target=self._process_operation, args=(operation,), 
                               daemon=True).start()
    
    def get_operation_status(self, operation_id: str) -> Optional[Dict]:
        """
        获取操作状态
        :param operation_id: 操作ID
        :return: 操作状态信息
        """
        with self.operation_lock:
            # 检查活跃操作
            if operation_id in self.active_operations:
                op = self.active_operations[operation_id]
                return {
                    "operation_id": op.operation_id,
                    "status": op.status.value,
                    "operation_type": op.operation_type.value,
                    "file_path": op.file_path,
                    "client_id": op.client_id,
                    "duration": time.time() - op.timestamp
                }
            
            # 检查完成操作
            if operation_id in self.completed_operations:
                op = self.completed_operations[operation_id]
                return {
                    "operation_id": op.operation_id,
                    "status": op.status.value,
                    "operation_type": op.operation_type.value,
                    "file_path": op.file_path,
                    "client_id": op.client_id,
                    "duration": time.time() - op.timestamp
                }
            
            return None
    
    def get_system_stats(self) -> Dict:
        """
        获取系统统计信息
        :return: 统计信息
        """
        with self.operation_lock:
            pending_count = len(self.operation_queue)
            active_count = len(self.active_operations)
            completed_count = len(self.completed_operations)
            
            # 计算平均处理时间
            total_duration = 0
            completed_ops = list(self.completed_operations.values())[-100:]  # 最近100个完成的操作
            for op in completed_ops:
                total_duration += time.time() - op.timestamp
            
            avg_duration = total_duration / len(completed_ops) if completed_ops else 0
            
            return {
                "pending_operations": pending_count,
                "active_operations": active_count,
                "completed_operations": completed_count,
                "average_processing_time": avg_duration,
                "total_concurrent_capacity": self.max_concurrent_operations,
                "utilization_rate": active_count / self.max_concurrent_operations
            }

# 使用示例
print("=== 数据读写流程基本架构 ===")

# 创建读写流程管理器
flow_manager = ReadWriteFlowManager()

# 提交一些操作
print("提交测试操作...")
operations = []

# 提交读取操作
for i in range(5):
    op_id = flow_manager.submit_operation(
        operation_type=OperationType.READ,
        file_path=f"/data/file_{i}.txt",
        client_id=f"client_{i % 3}",
        priority=1
    )
    operations.append(op_id)
    print(f"  提交读取操作 {op_id}")

# 提交写入操作
for i in range(3):
    op_id = flow_manager.submit_operation(
        operation_type=OperationType.WRITE,
        file_path=f"/data/new_file_{i}.txt",
        client_id=f"client_write_{i}",
        priority=2,
        metadata={"data": f"content_{i}"}
    )
    operations.append(op_id)
    print(f"  提交写入操作 {op_id}")

# 提交删除操作
for i in range(2):
    op_id = flow_manager.submit_operation(
        operation_type=OperationType.DELETE,
        file_path=f"/data/old_file_{i}.txt",
        client_id="client_delete",
        priority=1
    )
    operations.append(op_id)
    print(f"  提交删除操作 {op_id}")

# 监控操作状态
print("\n监控操作状态...")
for _ in range(10):
    time.sleep(0.2)  # 等待操作处理
    
    stats = flow_manager.get_system_stats()
    print(f"系统状态 - 活跃: {stats['active_operations']}, "
          f"排队: {stats['pending_operations']}, "
          f"完成: {stats['completed_operations']}, "
          f"平均处理时间: {stats['average_processing_time']:.3f}s")
    
    # 检查特定操作状态
    if operations:
        status = flow_manager.get_operation_status(operations[0])
        if status:
            print(f"  操作 {status['operation_id']} 状态: {status['status']}")

# 获取最终统计信息
final_stats = flow_manager.get_system_stats()
print(f"\n最终系统统计:")
print(f"  总处理操作数: {final_stats['completed_operations']}")
print(f"  平均处理时间: {final_stats['average_processing_time']:.3f}s")
print(f"  系统利用率: {final_stats['utilization_rate']:.1%}")
```

### 6.1.5.1.2 读取操作流程详解

```python
# 读取操作流程详解
import hashlib
from typing import Dict, List, Optional

class ReadOperationProcessor:
    def __init__(self):
        self.cache = {}  # 简化的缓存
        self.cache_stats = {"hits": 0, "misses": 0}
    
    def process_read_request(self, file_path: str, offset: int = 0, 
                           length: int = -1) -> Dict:
        """
        处理读取请求
        :param file_path: 文件路径
        :param offset: 偏移量
        :param length: 读取长度(-1表示读取到文件末尾)
        :return: 读取结果
        """
        start_time = time.time()
        
        # 1. 权限验证
        permission_check = self._verify_read_permission(file_path)
        if not permission_check["allowed"]:
            return {
                "success": False,
                "error": "Permission denied",
                "error_code": "PERMISSION_DENIED",
                "processing_time": time.time() - start_time
            }
        
        # 2. 缓存查找
        cache_key = f"{file_path}:{offset}:{length}"
        if cache_key in self.cache:
            self.cache_stats["hits"] += 1
            cached_data = self.cache[cache_key]
            return {
                "success": True,
                "data": cached_data["data"],
                "size": len(cached_data["data"]),
                "from_cache": True,
                "cache_hit": True,
                "metadata": cached_data["metadata"],
                "processing_time": time.time() - start_time
            }
        else:
            self.cache_stats["misses"] += 1
        
        # 3. 元数据查询
        metadata_result = self._query_metadata(file_path)
        if not metadata_result["success"]:
            return {
                "success": False,
                "error": metadata_result["error"],
                "error_code": metadata_result["error_code"],
                "processing_time": time.time() - start_time
            }
        
        file_metadata = metadata_result["metadata"]
        
        # 4. 数据块定位
        block_locations = self._locate_data_blocks(file_metadata, offset, length)
        if not block_locations:
            return {
                "success": False,
                "error": "Failed to locate data blocks",
                "error_code": "BLOCK_LOCATION_FAILED",
                "processing_time": time.time() - start_time
            }
        
        # 5. 并行读取数据块
        data_blocks = self._read_data_blocks_parallel(block_locations)
        
        # 6. 数据组装
        assembled_data = self._assemble_data(data_blocks, offset, length)
        
        # 7. 缓存存储
        if len(assembled_data) <= 1024 * 1024:  # 只缓存1MB以下的数据
            self.cache[cache_key] = {
                "data": assembled_data,
                "metadata": file_metadata,
                "timestamp": time.time()
            }
        
        # 8. 返回结果
        return {
            "success": True,
            "data": assembled_data,
            "size": len(assembled_data),
            "from_cache": False,
            "cache_hit": False,
            "metadata": file_metadata,
            "block_count": len(data_blocks),
            "processing_time": time.time() - start_time
        }
    
    def _verify_read_permission(self, file_path: str) -> Dict:
        """
        验证读取权限
        :param file_path: 文件路径
        :return: 权限验证结果
        """
        # 模拟权限验证逻辑
        # 实际实现中应该检查用户权限、文件访问控制等
        time.sleep(0.001)  # 模拟权限检查延迟
        
        # 简化处理：假设所有文件都可以读取
        return {
            "allowed": True,
            "permissions": ["read"],
            "user_id": "default_user"
        }
    
    def _query_metadata(self, file_path: str) -> Dict:
        """
        查询文件元数据
        :param file_path: 文件路径
        :return: 元数据查询结果
        """
        # 模拟元数据查询
        time.sleep(0.005)  # 模拟元数据查询延迟
        
        # 模拟元数据
        metadata = {
            "file_path": file_path,
            "size": 1024 * 1024,  # 1MB
            "blocks": [
                {"id": f"block_{i}", "node": f"node_{i % 5}", "size": 204800}
                for i in range(5)
            ],
            "checksum": "abc123def456",
            "created_time": time.time() - 3600,
            "modified_time": time.time() - 1800,
            "replication_factor": 3
        }
        
        return {
            "success": True,
            "metadata": metadata
        }
    
    def _locate_data_blocks(self, metadata: Dict, offset: int, length: int) -> List[Dict]:
        """
        定位数据块
        :param metadata: 文件元数据
        :param offset: 偏移量
        :param length: 长度
        :return: 数据块位置信息
        """
        # 根据偏移量和长度计算需要的数据块
        block_size = metadata["blocks"][0]["size"] if metadata["blocks"] else 204800
        start_block = offset // block_size
        end_block = (offset + (length if length > 0 else metadata["size"])) // block_size
        
        # 返回需要的块信息
        required_blocks = metadata["blocks"][start_block:end_block+1]
        
        block_locations = []
        for block in required_blocks:
            block_locations.append({
                "block_id": block["id"],
                "node_id": block["node"],
                "offset_in_block": offset % block_size if block == required_blocks[0] else 0,
                "length_in_block": min(block["size"], length) if length > 0 else block["size"]
            })
        
        return block_locations
    
    def _read_data_blocks_parallel(self, block_locations: List[Dict]) -> List[Dict]:
        """
        并行读取数据块
        :param block_locations: 块位置信息
        :return: 读取的数据块
        """
        # 模拟并行读取
        data_blocks = []
        
        for location in block_locations:
            # 模拟从节点读取数据
            time.sleep(0.01)  # 模拟网络延迟
            
            # 生成模拟数据
            block_data = f"data_from_{location['node_id']}_block_{location['block_id']}".encode()
            
            data_blocks.append({
                "block_id": location["block_id"],
                "node_id": location["node_id"],
                "data": block_data,
                "size": len(block_data)
            })
        
        return data_blocks
    
    def _assemble_data(self, data_blocks: List[Dict], offset: int, length: int) -> bytes:
        """
        组装数据
        :param data_blocks: 数据块列表
        :param offset: 偏移量
        :param length: 长度
        :return: 组装后的数据
        """
        # 简单的数据组装
        assembled_data = b"".join([block["data"] for block in data_blocks])
        
        # 根据偏移量和长度截取数据
        if length > 0:
            assembled_data = assembled_data[offset:offset+length]
        elif offset > 0:
            assembled_data = assembled_data[offset:]
        
        return assembled_data
    
    def get_cache_stats(self) -> Dict:
        """
        获取缓存统计信息
        :return: 缓存统计
        """
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = self.cache_stats["hits"] / total_requests if total_requests > 0 else 0
        
        return {
            "cache_hits": self.cache_stats["hits"],
            "cache_misses": self.cache_stats["misses"],
            "total_requests": total_requests,
            "hit_rate": hit_rate,
            "cache_size": len(self.cache)
        }

# 使用示例
print("\n=== 读取操作流程详解 ===")

# 创建读取操作处理器
read_processor = ReadOperationProcessor()

# 处理读取请求
print("处理读取请求...")

# 测试1: 正常读取
result1 = read_processor.process_read_request("/data/test_file.txt", 0, 100)
print(f"测试1 - 正常读取:")
print(f"  成功: {result1['success']}")
print(f"  数据大小: {result1['size']} bytes")
print(f"  处理时间: {result1['processing_time']:.3f}s")
print(f"  来自缓存: {result1.get('from_cache', False)}")

# 测试2: 缓存命中
result2 = read_processor.process_read_request("/data/test_file.txt", 0, 100)
print(f"\n测试2 - 缓存命中:")
print(f"  成功: {result2['success']}")
print(f"  缓存命中: {result2.get('cache_hit', False)}")
print(f"  处理时间: {result2['processing_time']:.3f}s")

# 测试3: 大文件读取
result3 = read_processor.process_read_request("/data/large_file.txt", 1024, 2048)
print(f"\n测试3 - 大文件读取:")
print(f"  成功: {result3['success']}")
print(f"  数据大小: {result3['size']} bytes")
print(f"  读取块数: {result3.get('block_count', 0)}")
print(f"  处理时间: {result3['processing_time']:.3f}s")

# 获取缓存统计
cache_stats = read_processor.get_cache_stats()
print(f"\n缓存统计:")
print(f"  缓存命中率: {cache_stats['hit_rate']:.1%}")
print(f"  总请求数: {cache_stats['total_requests']}")
print(f"  缓存大小: {cache_stats['cache_size']}")
```

## 6.1.5.2 并发控制机制

并发控制是确保分布式文件存储系统中多个客户端同时访问数据时保持一致性的关键技术。

### 6.1.5.2.1 锁机制实现

```python
# 锁机制实现
import threading
import time
from typing import Dict, List, Optional
from enum import Enum
from contextlib import contextmanager

class LockType(Enum):
    READ = "read"
    WRITE = "write"

class LockMode(Enum):
    SHARED = "shared"  # 共享锁（读锁）
    EXCLUSIVE = "exclusive"  # 排他锁（写锁）

class LockStatus(Enum):
    ACQUIRED = "acquired"
    WAITING = "waiting"
    RELEASED = "released"
    TIMEOUT = "timeout"

class DistributedLock:
    def __init__(self, resource_id: str, lock_manager):
        self.resource_id = resource_id
        self.lock_manager = lock_manager
        self.lock = threading.RLock()  # 本地锁
        self.holders = {}  # 持有者信息 {client_id: lock_type}
        self.waiting_queue = []  # 等待队列 [(client_id, lock_type, timestamp)]
    
    def acquire(self, client_id: str, lock_type: LockType, timeout: float = 30.0) -> bool:
        """
        获取锁
        :param client_id: 客户端ID
        :param lock_type: 锁类型
        :param timeout: 超时时间（秒）
        :return: 是否成功获取锁
        """
        start_time = time.time()
        
        with self.lock:
            # 检查是否已经持有锁
            if client_id in self.holders:
                # 升级锁的情况
                if self.holders[client_id] == LockType.READ and lock_type == LockType.WRITE:
                    return self._upgrade_lock(client_id, timeout - (time.time() - start_time))
                else:
                    return True
            
            # 检查是否可以获取锁
            if self._can_acquire_lock(client_id, lock_type):
                self.holders[client_id] = lock_type
                return True
            else:
                # 加入等待队列
                self.waiting_queue.append((client_id, lock_type, time.time()))
                
                # 等待锁释放
                return self._wait_for_lock(client_id, lock_type, timeout - (time.time() - start_time))
    
    def _can_acquire_lock(self, client_id: str, lock_type: LockType) -> bool:
        """检查是否可以获取锁"""
        if lock_type == LockType.READ:
            # 读锁：没有写锁持有者即可
            return not any(lock_type == LockType.WRITE for lock_type in self.holders.values())
        else:
            # 写锁：没有任何锁持有者
            return len(self.holders) == 0
    
    def _upgrade_lock(self, client_id: str, timeout: float) -> bool:
        """升级锁（从读锁升级到写锁）"""
        with self.lock:
            # 检查是否只有当前客户端持有读锁
            if len(self.holders) == 1 and client_id in self.holders:
                self.holders[client_id] = LockType.WRITE
                return True
            else:
                # 需要等待其他读锁释放
                return self._wait_for_upgrade(client_id, timeout)
    
    def _wait_for_lock(self, client_id: str, lock_type: LockType, timeout: float) -> bool:
        """等待获取锁"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            time.sleep(0.01)  # 短暂休眠
            
            with self.lock:
                if self._can_acquire_lock(client_id, lock_type):
                    self.holders[client_id] = lock_type
                    # 从等待队列中移除
                    self.waiting_queue = [
                        item for item in self.waiting_queue 
                        if item[0] != client_id
                    ]
                    return True
        
        # 超时处理
        with self.lock:
            # 从等待队列中移除
            self.waiting_queue = [
                item for item in self.waiting_queue 
                if item[0] != client_id
            ]
        return False
    
    def _wait_for_upgrade(self, client_id: str, timeout: float) -> bool:
        """等待锁升级"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            time.sleep(0.01)  # 短暂休眠
            
            with self.lock:
                # 检查是否只有当前客户端持有读锁
                if len(self.holders) == 1 and client_id in self.holders:
                    self.holders[client_id] = LockType.WRITE
                    return True
        
        return False
    
    def release(self, client_id: str) -> bool:
        """
        释放锁
        :param client_id: 客户端ID
        :return: 是否成功释放
        """
        with self.lock:
            if client_id in self.holders:
                del self.holders[client_id]
                
                # 通知等待者
                self._notify_waiters()
                return True
            return False
    
    def _notify_waiters(self):
        """通知等待者"""
        # 检查等待队列中是否有可以获取锁的客户端
        i = 0
        while i < len(self.waiting_queue):
            client_id, lock_type, timestamp = self.waiting_queue[i]
            if self._can_acquire_lock(client_id, lock_type):
                # 可以获取锁
                self.holders[client_id] = lock_type
                self.waiting_queue.pop(i)
                # 唤醒等待的客户端（实际实现中需要信号机制）
                print(f"通知客户端 {client_id} 可以获取锁")
            else:
                i += 1

class LockManager:
    def __init__(self):
        self.locks = {}  # {resource_id: DistributedLock}
        self.manager_lock = threading.RLock()
    
    def get_lock(self, resource_id: str) -> DistributedLock:
        """
        获取资源锁
        :param resource_id: 资源ID
        :return: 分布式锁
        """
        with self.manager_lock:
            if resource_id not in self.locks:
                self.locks[resource_id] = DistributedLock(resource_id, self)
            return self.locks[resource_id]
    
    def acquire_lock(self, resource_id: str, client_id: str, 
                    lock_type: LockType, timeout: float = 30.0) -> bool:
        """
        获取资源锁
        :param resource_id: 资源ID
        :param client_id: 客户端ID
        :param lock_type: 锁类型
        :param timeout: 超时时间
        :return: 是否成功获取锁
        """
        lock = self.get_lock(resource_id)
        return lock.acquire(client_id, lock_type, timeout)
    
    def release_lock(self, resource_id: str, client_id: str) -> bool:
        """
        释放资源锁
        :param resource_id: 资源ID
        :param client_id: 客户端ID
        :return: 是否成功释放锁
        """
        with self.manager_lock:
            if resource_id in self.locks:
                return self.locks[resource_id].release(client_id)
            return False
    
    @contextmanager
    def lock_context(self, resource_id: str, client_id: str, 
                     lock_type: LockType, timeout: float = 30.0):
        """
        锁上下文管理器
        :param resource_id: 资源ID
        :param client_id: 客户端ID
        :param lock_type: 锁类型
        :param timeout: 超时时间
        """
        acquired = self.acquire_lock(resource_id, client_id, lock_type, timeout)
        if acquired:
            try:
                yield
            finally:
                self.release_lock(resource_id, client_id)
        else:
            raise Exception(f"Failed to acquire lock for {resource_id}")

# 使用示例
print("\n=== 锁机制实现 ===")

# 创建锁管理器
lock_manager = LockManager()

def simulate_client_operations(client_id: str, resource_id: str):
    """模拟客户端操作"""
    print(f"客户端 {client_id} 开始操作资源 {resource_id}")
    
    try:
        # 尝试获取读锁
        print(f"客户端 {client_id} 尝试获取读锁")
        with lock_manager.lock_context(resource_id, client_id, LockType.READ, timeout=5.0):
            print(f"客户端 {client_id} 获取读锁成功")
            time.sleep(1)  # 模拟读取操作
            
            # 尝试升级到写锁
            print(f"客户端 {client_id} 尝试升级到写锁")
            with lock_manager.lock_context(resource_id, client_id, LockType.WRITE, timeout=5.0):
                print(f"客户端 {client_id} 获取写锁成功")
                time.sleep(1)  # 模拟写入操作
                print(f"客户端 {client_id} 写入操作完成")
        
        print(f"客户端 {client_id} 操作完成")
        
    except Exception as e:
        print(f"客户端 {client_id} 操作失败: {e}")

# 模拟多个客户端并发操作
print("启动并发客户端操作...")

threads = []
for i in range(3):
    client_id = f"client_{i}"
    thread = threading.Thread(target=simulate_client_operations, 
                            args=(client_id, "resource_1"))
    threads.append(thread)
    thread.start()

# 等待所有线程完成
for thread in threads:
    thread.join()

print("所有客户端操作完成")
```

### 6.1.5.2.2 乐观并发控制

```python
# 乐观并发控制实现
import hashlib
import time
from typing import Dict, Optional
from dataclasses import dataclass

@dataclass
class VersionedData:
    data: bytes
    version: int
    timestamp: float
    checksum: str

class OptimisticConcurrencyControl:
    def __init__(self):
        self.data_store = {}  # {key: VersionedData}
        self.store_lock = threading.RLock()
    
    def read_data(self, key: str) -> Optional[Dict]:
        """
        读取数据（乐观读取）
        :param key: 数据键
        :return: 数据和版本信息
        """
        with self.store_lock:
            if key in self.data_store:
                versioned_data = self.data_store[key]
                return {
                    "data": versioned_data.data,
                    "version": versioned_data.version,
                    "timestamp": versioned_data.timestamp,
                    "checksum": versioned_data.checksum
                }
            return None
    
    def write_data_optimistic(self, key: str, data: bytes, 
                            expected_version: int = None) -> Dict:
        """
        乐观写入数据
        :param key: 数据键
        :param data: 数据
        :param expected_version: 期望的版本号
        :return: 写入结果
        """
        start_time = time.time()
        
        with self.store_lock:
            # 计算数据校验和
            checksum = hashlib.md5(data).hexdigest()
            
            # 检查数据是否存在
            if key in self.data_store:
                current_data = self.data_store[key]
                
                # 检查版本冲突
                if expected_version is not None and current_data.version != expected_version:
                    return {
                        "success": False,
                        "error": "Version conflict",
                        "error_code": "VERSION_CONFLICT",
                        "current_version": current_data.version,
                        "expected_version": expected_version,
                        "processing_time": time.time() - start_time
                    }
                
                # 检查数据是否实际发生变化
                if current_data.data == data and current_data.checksum == checksum:
                    return {
                        "success": True,
                        "version": current_data.version,
                        "timestamp": current_data.timestamp,
                        "changed": False,
                        "processing_time": time.time() - start_time
                    }
                
                # 更新数据
                new_version = current_data.version + 1
                self.data_store[key] = VersionedData(
                    data=data,
                    version=new_version,
                    timestamp=time.time(),
                    checksum=checksum
                )
                
                return {
                    "success": True,
                    "version": new_version,
                    "timestamp": time.time(),
                    "changed": True,
                    "processing_time": time.time() - start_time
                }
            else:
                # 新数据
                self.data_store[key] = VersionedData(
                    data=data,
                    version=1,
                    timestamp=time.time(),
                    checksum=checksum
                )
                
                return {
                    "success": True,
                    "version": 1,
                    "timestamp": time.time(),
                    "changed": True,
                    "processing_time": time.time() - start_time
                }
    
    def compare_and_swap(self, key: str, old_data: bytes, new_data: bytes) -> Dict:
        """
        比较并交换操作
        :param key: 数据键
        :param old_data: 期望的旧数据
        :param new_data: 新数据
        :return: 操作结果
        """
        start_time = time.time()
        
        with self.store_lock:
            # 计算校验和
            old_checksum = hashlib.md5(old_data).hexdigest()
            new_checksum = hashlib.md5(new_data).hexdigest()
            
            # 检查数据是否存在
            if key in self.data_store:
                current_data = self.data_store[key]
                
                # 检查数据是否匹配
                if current_data.data == old_data and current_data.checksum == old_checksum:
                    # 执行交换
                    new_version = current_data.version + 1
                    self.data_store[key] = VersionedData(
                        data=new_data,
                        version=new_version,
                        timestamp=time.time(),
                        checksum=new_checksum
                    )
                    
                    return {
                        "success": True,
                        "version": new_version,
                        "timestamp": time.time(),
                        "swapped": True,
                        "processing_time": time.time() - start_time
                    }
                else:
                    return {
                        "success": False,
                        "error": "Data mismatch",
                        "error_code": "DATA_MISMATCH",
                        "current_checksum": current_data.checksum,
                        "expected_checksum": old_checksum,
                        "processing_time": time.time() - start_time
                    }
            else:
                return {
                    "success": False,
                    "error": "Data not found",
                    "error_code": "DATA_NOT_FOUND",
                    "processing_time": time.time() - start_time
                }
    
    def get_data_stats(self) -> Dict:
        """
        获取数据存储统计信息
        :return: 统计信息
        """
        with self.store_lock:
            total_items = len(self.data_store)
            total_size = sum(len(item.data) for item in self.data_store.values())
            
            # 计算平均版本号
            if total_items > 0:
                avg_version = sum(item.version for item in self.data_store.values()) / total_items
            else:
                avg_version = 0
            
            return {
                "total_items": total_items,
                "total_size_bytes": total_size,
                "average_version": avg_version,
                "total_size_mb": total_size / (1024 * 1024)
            }

# 使用示例
print("\n=== 乐观并发控制 ===")

# 创建乐观并发控制实例
occ = OptimisticConcurrencyControl()

# 测试数据读写
print("测试乐观并发控制...")

# 1. 写入初始数据
print("1. 写入初始数据")
result1 = occ.write_data_optimistic("test_key", b"initial_data")
print(f"   写入结果: {result1['success']}, 版本: {result1['version']}")

# 2. 读取数据
print("2. 读取数据")
read_result = occ.read_data("test_key")
if read_result:
    print(f"   读取结果: {read_result['data']}, 版本: {read_result['version']}")

# 3. 无冲突写入
print("3. 无冲突写入")
result2 = occ.write_data_optimistic("test_key", b"updated_data", expected_version=1)
print(f"   写入结果: {result2['success']}, 版本: {result2['version']}")

# 4. 版本冲突写入
print("4. 版本冲突写入")
result3 = occ.write_data_optimistic("test_key", b"conflict_data", expected_version=1)  # 错误版本
print(f"   写入结果: {result3['success']}")
if not result3['success']:
    print(f"   错误: {result3['error']}, 当前版本: {result3['current_version']}")

# 5. 比较并交换操作
print("5. 比较并交换操作")
result4 = occ.compare_and_swap("test_key", b"updated_data", b"cas_updated_data")
print(f"   CAS结果: {result4['success']}")
if result4['success']:
    print(f"   版本: {result4['version']}, 交换: {result4['swapped']}")

# 6. 数据统计
print("6. 数据存储统计")
stats = occ.get_data_stats()
print(f"   总项目数: {stats['total_items']}")
print(f"   总大小: {stats['total_size_bytes']} bytes ({stats['total_size_mb']:.2f} MB)")
print(f"   平均版本: {stats['average_version']:.1f}")

# 模拟并发写入场景
print("\n模拟并发写入场景...")

def concurrent_writer(writer_id: int, key: str, iterations: int):
    """并发写入者"""
    successes = 0
    conflicts = 0
    
    for i in range(iterations):
        # 读取当前数据和版本
        read_result = occ.read_data(key)
        if read_result:
            current_data = read_result["data"]
            current_version = read_result["version"]
            
            # 尝试写入新数据
            new_data = f"writer_{writer_id}_iteration_{i}".encode()
            write_result = occ.write_data_optimistic(key, new_data, current_version)
            
            if write_result["success"]:
                successes += 1
            else:
                conflicts += 1
        else:
            # 首次写入
            new_data = f"writer_{writer_id}_initial".encode()
            write_result = occ.write_data_optimistic(key, new_data)
            if write_result["success"]:
                successes += 1
    
    print(f"写入者 {writer_id}: 成功 {successes}, 冲突 {conflicts}")

# 启动多个并发写入者
concurrent_threads = []
for i in range(3):
    thread = threading.Thread(target=concurrent_writer, args=(i, "concurrent_key", 10))
    concurrent_threads.append(thread)
    thread.start()

# 等待所有线程完成
for thread in concurrent_threads:
    thread.join()

# 检查最终结果
final_result = occ.read_data("concurrent_key")
if final_result:
    print(f"\n最终数据: {final_result['data']}")
    print(f"最终版本: {final_result['version']}")
    
stats = occ.get_data_stats()
print(f"最终统计 - 项目数: {stats['total_items']}, 平均版本: {stats['average_version']:.1f}")
```

## 6.1.5.3 性能优化技术

性能优化是提升分布式文件存储系统读写效率和用户体验的关键手段。

### 6.1.5.3.1 缓存优化策略

```python
# 缓存优化策略
import time
from typing import Dict, List, Optional, Any
from collections import OrderedDict
import threading

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()
        self.lock = threading.RLock()
        self.stats = {"hits": 0, "misses": 0, "evictions": 0}
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存项"""
        with self.lock:
            if key in self.cache:
                # 移动到末尾（最近使用）
                value = self.cache.pop(key)
                self.cache[key] = value
                self.stats["hits"] += 1
                return value
            else:
                self.stats["misses"] += 1
                return None
    
    def put(self, key: str, value: Any, ttl: float = 300.0) -> None:
        """放入缓存项"""
        with self.lock:
            if key in self.cache:
                # 更新现有项
                self.cache.pop(key)
            elif len(self.cache) >= self.capacity:
                # 移除最久未使用的项
                oldest_key = next(iter(self.cache))
                self.cache.pop(oldest_key)
                self.stats["evictions"] += 1
            
            # 添加新项
            self.cache[key] = {
                "value": value,
                "timestamp": time.time(),
                "expires_at": time.time() + ttl
            }
    
    def cleanup_expired(self) -> int:
        """清理过期项"""
        with self.lock:
            current_time = time.time()
            expired_keys = [
                key for key, item in self.cache.items() 
                if item["expires_at"] < current_time
            ]
            
            for key in expired_keys:
                self.cache.pop(key)
            
            return len(expired_keys)
    
    def get_stats(self) -> Dict:
        """获取缓存统计"""
        with self.lock:
            total_requests = self.stats["hits"] + self.stats["misses"]
            hit_rate = self.stats["hits"] / total_requests if total_requests > 0 else 0
            
            return {
                "hits": self.stats["hits"],
                "misses": self.stats["misses"],
                "evictions": self.stats["evictions"],
                "total_requests": total_requests,
                "hit_rate": hit_rate,
                "current_size": len(self.cache),
                "capacity": self.capacity,
                "utilization": len(self.cache) / self.capacity
            }

class MultiLevelCache:
    def __init__(self, l1_capacity: int = 1000, l2_capacity: int = 10000):
        # 多级缓存：L1内存缓存，L2分布式缓存（简化为本地缓存）
        self.l1_cache = LRUCache(l1_capacity)  # 一级缓存（内存）
        self.l2_cache = LRUCache(l2_capacity)  # 二级缓存（模拟分布式缓存）
        self.cache_lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Any]:
        """多级缓存获取"""
        # 1. 检查L1缓存
        value = self.l1_cache.get(key)
        if value is not None:
            return value["value"]
        
        # 2. 检查L2缓存
        l2_value = self.l2_cache.get(key)
        if l2_value is not None:
            # 提升到L1缓存
            self.l1_cache.put(key, l2_value["value"], 
                            l2_value["expires_at"] - time.time())
            return l2_value["value"]
        
        return None
    
    def put(self, key: str, value: Any, ttl: float = 300.0) -> None:
        """多级缓存存储"""
        # 同时存储到L1和L2缓存
        self.l1_cache.put(key, value, ttl)
        self.l2_cache.put(key, value, ttl)
    
    def get_cache_stats(self) -> Dict:
        """获取多级缓存统计"""
        return {
            "l1_cache": self.l1_cache.get_stats(),
            "l2_cache": self.l2_cache.get_stats()
        }

class CacheOptimizer:
    def __init__(self):
        self.multi_level_cache = MultiLevelCache()
        self.access_patterns = {}  # 访问模式统计
        self.pattern_lock = threading.RLock()
    
    def optimized_get(self, key: str) -> Optional[Any]:
        """优化的缓存获取"""
        # 记录访问模式
        self._record_access_pattern(key)
        
        # 执行多级缓存获取
        return self.multi_level_cache.get(key)
    
    def optimized_put(self, key: str, value: Any, ttl: float = 300.0) -> None:
        """优化的缓存存储"""
        # 根据访问模式调整TTL
        adjusted_ttl = self._adjust_ttl_based_on_pattern(key, ttl)
        
        # 执行多级缓存存储
        self.multi_level_cache.put(key, value, adjusted_ttl)
    
    def _record_access_pattern(self, key: str) -> None:
        """记录访问模式"""
        with self.pattern_lock:
            if key not in self.access_patterns:
                self.access_patterns[key] = {
                    "access_count": 0,
                    "last_access": time.time(),
                    "access_intervals": []
                }
            
            pattern = self.access_patterns[key]
            current_time = time.time()
            
            # 记录访问间隔
            if pattern["access_count"] > 0:
                interval = current_time - pattern["last_access"]
                pattern["access_intervals"].append(interval)
                # 保持最近10个间隔
                if len(pattern["access_intervals"]) > 10:
                    pattern["access_intervals"].pop(0)
            
            pattern["access_count"] += 1
            pattern["last_access"] = current_time
    
    def _adjust_ttl_based_on_pattern(self, key: str, base_ttl: float) -> float:
        """根据访问模式调整TTL"""
        with self.pattern_lock:
            if key not in self.access_patterns:
                return base_ttl
            
            pattern = self.access_patterns[key]
            
            # 如果访问频率很高，增加TTL
            if pattern["access_count"] > 10:
                # 计算平均访问间隔
                if pattern["access_intervals"]:
                    avg_interval = sum(pattern["access_intervals"]) / len(pattern["access_intervals"])
                    # 如果访问间隔很短，增加TTL
                    if avg_interval < 60:  # 1分钟内访问
                        return base_ttl * 2
            
            # 如果很久没有访问，减少TTL
            time_since_last = time.time() - pattern["last_access"]
            if time_since_last > 3600:  # 1小时未访问
                return base_ttl * 0.5
            
            return base_ttl
    
    def get_optimization_stats(self) -> Dict:
        """获取优化统计信息"""
        with self.pattern_lock:
            # 计算热点数据
            hot_data = []
            for key, pattern in self.access_patterns.items():
                if pattern["access_count"] > 5:
                    hot_data.append({
                        "key": key,
                        "access_count": pattern["access_count"],
                        "last_access": pattern["last_access"]
                    })
            
            hot_data.sort(key=lambda x: x["access_count"], reverse=True)
            
            return {
                "cache_stats": self.multi_level_cache.get_cache_stats(),
                "hot_data": hot_data[:10],  # 前10个热点数据
                "total_patterns_tracked": len(self.access_patterns)
            }

# 使用示例
print("\n=== 缓存优化策略 ===")

# 创建缓存优化器
cache_optimizer = CacheOptimizer()

# 模拟缓存使用
print("模拟缓存使用...")

# 1. 存储一些数据
test_data = {
    "file_1.txt": b"content of file 1",
    "file_2.txt": b"content of file 2",
    "file_3.txt": b"content of file 3",
    "hot_file.txt": b"this is a hot file that will be accessed frequently"
}

for key, value in test_data.items():
    cache_optimizer.optimized_put(key, value, ttl=600)  # 10分钟TTL
    print(f"存储到缓存: {key}")

# 2. 模拟频繁访问热点数据
print("\n模拟热点数据访问...")
for i in range(20):
    # 频繁访问热点文件
    result = cache_optimizer.optimized_get("hot_file.txt")
    if i % 5 == 0:  # 每5次访问报告一次
        print(f"  访问 hot_file.txt (第{i+1}次): {'命中' if result else '未命中'}")
    
    # 偶尔访问其他文件
    if i % 7 == 0:
        result = cache_optimizer.optimized_get("file_1.txt")
        print(f"  访问 file_1.txt: {'命中' if result else '未命中'}")
    
    time.sleep(0.1)  # 模拟访问间隔

# 3. 访问不存在的数据
print("\n访问不存在的数据:")
result = cache_optimizer.optimized_get("non_existent_file.txt")
print(f"  访问 non_existent_file.txt: {'命中' if result else '未命中'}")

# 4. 获取缓存统计信息
print("\n缓存统计信息:")
stats = cache_optimizer.get_optimization_stats()

print("缓存层级统计:")
print(f"  L1缓存 - 命中率: {stats['cache_stats']['l1_cache']['hit_rate']:.1%}, "
      f"利用率: {stats['cache_stats']['l1_cache']['utilization']:.1%}")
print(f"  L2缓存 - 命中率: {stats['cache_stats']['l2_cache']['hit_rate']:.1%}, "
      f"利用率: {stats['cache_stats']['l2_cache']['utilization']:.1%}")

print(f"\n热点数据 (前{len(stats['hot_data'])}个):")
for item in stats['hot_data']:
    print(f"  {item['key']}: 访问 {item['access_count']} 次")

print(f"\n总计跟踪模式数: {stats['total_patterns_tracked']}")
```

### 6.1.5.3.2 批量处理优化

```python
# 批量处理优化
import asyncio
import time
from typing import Dict, List, Tuple, Callable
from concurrent.futures import ThreadPoolExecutor
import threading

class BatchProcessor:
    def __init__(self, batch_size: int = 100, batch_timeout: float = 0.1):
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.pending_operations = []
        self.batch_lock = threading.Lock()
        self.batch_executor = ThreadPoolExecutor(max_workers=4)
        self.processing_stats = {
            "batches_processed": 0,
            "operations_processed": 0,
            "average_batch_size": 0,
            "average_processing_time": 0
        }
    
    def submit_operation(self, operation: Dict) -> asyncio.Future:
        """
        提交操作到批处理队列
        :param operation: 操作数据
        :return: 异步结果Future
        """
        future = asyncio.Future()
        
        with self.batch_lock:
            self.pending_operations.append((operation, future))
            
            # 检查是否需要立即处理批次
            if len(self.pending_operations) >= self.batch_size:
                # 立即处理批次
                self._process_batch()
            elif len(self.pending_operations) == 1:
                # 启动定时器
                threading.Timer(self.batch_timeout, self._process_batch_timeout).start()
        
        return future
    
    def _process_batch(self):
        """处理批次操作"""
        with self.batch_lock:
            if not self.pending_operations:
                return
            
            # 获取当前批次的操作
            batch_operations = self.pending_operations[:self.batch_size]
            self.pending_operations = self.pending_operations[self.batch_size:]
        
        # 在线程池中处理批次
        future = self.batch_executor.submit(self._execute_batch, batch_operations)
        future.add_done_callback(self._batch_completed)
    
    def _process_batch_timeout(self):
        """超时处理批次"""
        with self.batch_lock:
            if self.pending_operations:
                self._process_batch()
    
    def _execute_batch(self, batch_operations: List[Tuple[Dict, asyncio.Future]]) -> List[Dict]:
        """
        执行批次操作
        :param batch_operations: 批次操作列表
        :return: 处理结果列表
        """
        start_time = time.time()
        
        # 模拟批次处理
        results = []
        for operation, _ in batch_operations:
            # 模拟操作处理时间
            time.sleep(0.001)  # 1ms per operation
            
            # 生成处理结果
            result = {
                "operation_id": operation.get("id", "unknown"),
                "status": "success",
                "result": f"processed_{operation.get('data', 'no_data')}",
                "processing_time": time.time() - start_time
            }
            results.append(result)
        
        return results
    
    def _batch_completed(self, future):
        """批次处理完成回调"""
        try:
            results = future.result()
            
            # 更新统计信息
            with self.batch_lock:
                self.processing_stats["batches_processed"] += 1
                self.processing_stats["operations_processed"] += len(results)
                
                # 更新平均批次大小
                if self.processing_stats["batches_processed"] > 0:
                    total_ops = self.processing_stats["operations_processed"]
                    batches = self.processing_stats["batches_processed"]
                    self.processing_stats["average_batch_size"] = total_ops / batches
            
            # 设置各个操作的结果
            # 注意：这里简化处理，实际应该按操作ID匹配结果
            print(f"批次处理完成，处理了 {len(results)} 个操作")
            
        except Exception as e:
            print(f"批次处理失败: {e}")
    
    def get_processing_stats(self) -> Dict:
        """获取处理统计信息"""
        with self.batch_lock:
            return self.processing_stats.copy()

class OptimizedReadWriteManager:
    def __init__(self):
        self.batch_processor = BatchProcessor(batch_size=50, batch_timeout=0.05)
        self.operation_counter = 0
        self.manager_lock = threading.Lock()
    
    async def async_read_operation(self, file_path: str, offset: int = 0, 
                                 length: int = -1) -> Dict:
        """
        异步读取操作
        :param file_path: 文件路径
        :param offset: 偏移量
        :param length: 长度
        :return: 读取结果
        """
        with self.manager_lock:
            self.operation_counter += 1
            operation_id = f"read_{self.operation_counter}"
        
        operation = {
            "id": operation_id,
            "type": "read",
            "file_path": file_path,
            "offset": offset,
            "length": length,
            "timestamp": time.time()
        }
        
        # 提交到批处理
        future = self.batch_processor.submit_operation(operation)
        try:
            # 等待结果
            result = await future
            return result
        except Exception as e:
            return {
                "operation_id": operation_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def async_write_operation(self, file_path: str, data: bytes) -> Dict:
        """
        异步写入操作
        :param file_path: 文件路径
        :param data: 数据
        :return: 写入结果
        """
        with self.manager_lock:
            self.operation_counter += 1
            operation_id = f"write_{self.operation_counter}"
        
        operation = {
            "id": operation_id,
            "type": "write",
            "file_path": file_path,
            "data": data,
            "timestamp": time.time()
        }
        
        # 提交到批处理
        future = self.batch_processor.submit_operation(operation)
        try:
            # 等待结果
            result = await future
            return result
        except Exception as e:
            return {
                "operation_id": operation_id,
                "status": "failed",
                "error": str(e)
            }
    
    def get_batch_stats(self) -> Dict:
        """获取批处理统计"""
        return self.batch_processor.get_processing_stats()

# 使用示例
print("\n=== 批量处理优化 ===")

# 创建优化的读写管理器
async def test_batch_processing():
    read_write_manager = OptimizedReadWriteManager()
    
    print("开始批量处理测试...")
    
    # 1. 并发提交多个读取操作
    print("1. 并发提交读取操作")
    read_tasks = []
    for i in range(100):
        task = read_write_manager.async_read_operation(
            f"/data/file_{i}.txt", 
            offset=0, 
            length=1024
        )
        read_tasks.append(task)
    
    # 等待所有读取操作完成
    read_results = await asyncio.gather(*read_tasks, return_exceptions=True)
    successful_reads = sum(1 for result in read_results if isinstance(result, dict) and result.get("status") == "success")
    print(f"   成功读取操作: {successful_reads}/{len(read_tasks)}")
    
    # 2. 并发提交写入操作
    print("2. 并发提交写入操作")
    write_tasks = []
    for i in range(50):
        task = read_write_manager.async_write_operation(
            f"/data/output_{i}.txt",
            f"output_data_{i}".encode()
        )
        write_tasks.append(task)
    
    # 等待所有写入操作完成
    write_results = await asyncio.gather(*write_tasks, return_exceptions=True)
    successful_writes = sum(1 for result in write_results if isinstance(result, dict) and result.get("status") == "success")
    print(f"   成功写入操作: {successful_writes}/{len(write_tasks)}")
    
    # 3. 获取批处理统计
    print("3. 批处理统计信息")
    stats = read_write_manager.get_batch_stats()
    print(f"   处理批次数: {stats['batches_processed']}")
    print(f"   处理操作数: {stats['operations_processed']}")
    if stats['batches_processed'] > 0:
        print(f"   平均批次大小: {stats['average_batch_size']:.1f}")
    
    # 4. 模拟不同负载下的性能
    print("4. 性能测试")
    
    # 测试小批量操作
    start_time = time.time()
    small_tasks = [
        read_write_manager.async_read_operation(f"/test/small_{i}.txt")
        for i in range(10)
    ]
    await asyncio.gather(*small_tasks, return_exceptions=True)
    small_batch_time = time.time() - start_time
    print(f"   小批量(10个操作): {small_batch_time:.3f}s")
    
    # 测试大批量操作
    start_time = time.time()
    large_tasks = [
        read_write_manager.async_read_operation(f"/test/large_{i}.txt")
        for i in range(100)
    ]
    await asyncio.gather(*large_tasks, return_exceptions=True)
    large_batch_time = time.time() - start_time
    print(f"   大批量(100个操作): {large_batch_time:.3f}s")
    
    print(f"   批量处理效率提升: {small_batch_time/(large_batch_time/10):.1f}x")

# 运行异步测试
print("运行异步批处理测试...")
asyncio.run(test_batch_processing())
```

## 6.1.5.4 一致性保证机制

在分布式文件存储系统中，确保数据一致性是至关重要的，特别是在并发访问和系统故障的情况下。

### 6.1.5.4.1 分布式一致性协议

```python
# 分布式一致性协议实现
import hashlib
import time
from typing import Dict, List, Optional
from enum import Enum
import threading
import random

class ConsistencyLevel(Enum):
    STRONG = "strong"      # 强一致性
    SEQUENTIAL = "sequential"  # 顺序一致性
    EVENTUAL = "eventual"  # 最终一致性

class ProposalState(Enum):
    PREPARE = "prepare"
    PROMISE = "promise"
    ACCEPT = "accept"
    ACCEPTED = "accepted"
    COMMIT = "commit"
    COMMITTED = "committed"

class PaxosProposal:
    def __init__(self, proposal_id: int, value: any, proposer_id: str):
        self.proposal_id = proposal_id
        self.value = value
        self.proposer_id = proposer_id
        self.state = ProposalState.PREPARE
        self.promises = {}  # {acceptor_id: promise}
        self.accepts = {}   # {acceptor_id: accepted_value}
        self.timestamp = time.time()

class Acceptor:
    def __init__(self, acceptor_id: str):
        self.acceptor_id = acceptor_id
        self.promised_proposal_id = 0
        self.accepted_proposal_id = 0
        self.accepted_value = None
        self.lock = threading.RLock()
    
    def prepare(self, proposal_id: int) -> Optional[Dict]:
        """
        Prepare阶段
        :param proposal_id: 提案ID
        :return: Promise响应
        """
        with self.lock:
            if proposal_id > self.promised_proposal_id:
                self.promised_proposal_id = proposal_id
                return {
                    "proposal_id": proposal_id,
                    "promised": True,
                    "accepted_proposal_id": self.accepted_proposal_id,
                    "accepted_value": self.accepted_value
                }
            else:
                return {
                    "proposal_id": proposal_id,
                    "promised": False,
                    "reason": "Proposal ID too low"
                }
    
    def accept(self, proposal_id: int, value: any) -> Dict:
        """
        Accept阶段
        :param proposal_id: 提案ID
        :param value: 提案值
        :return: Accept响应
        """
        with self.lock:
            if proposal_id >= self.promised_proposal_id:
                self.promised_proposal_id = proposal_id
                self.accepted_proposal_id = proposal_id
                self.accepted_value = value
                return {
                    "proposal_id": proposal_id,
                    "accepted": True,
                    "value": value
                }
            else:
                return {
                    "proposal_id": proposal_id,
                    "accepted": False,
                    "reason": "Proposal ID not promised"
                }

class PaxosLearner:
    def __init__(self, learner_id: str, quorum_size: int):
        self.learner_id = learner_id
        self.quorum_size = quorum_size
        self.accepted_proposals = {}  # {proposal_id: {acceptor_id: value}}
        self.learned_values = {}      # {proposal_id: value}
        self.lock = threading.RLock()
    
    def receive_accepted(self, proposal_id: int, acceptor_id: str, value: any) -> Optional[any]:
        """
        接收Accepted消息
        :param proposal_id: 提案ID
        :param acceptor_id: 接受者ID
        :param value: 接受的值
        :return: 如果学到值则返回，否则返回None
        """
        with self.lock:
            if proposal_id not in self.accepted_proposals:
                self.accepted_proposals[proposal_id] = {}
            
            self.accepted_proposals[proposal_id][acceptor_id] = value
            
            # 检查是否达到法定人数
            if len(self.accepted_proposals[proposal_id]) >= self.quorum_size:
                # 检查是否所有接受的值都相同
                values = list(self.accepted_proposals[proposal_id].values())
                if all(v == values[0] for v in values):
                    learned_value = values[0]
                    self.learned_values[proposal_id] = learned_value
                    return learned_value
            
            return None

class SimplePaxos:
    def __init__(self, acceptors: List[Acceptor], learners: List[PaxosLearner]):
        self.acceptors = acceptors
        self.learners = learners
        self.proposal_counter = 0
        self.paxos_lock = threading.RLock()
    
    def propose(self, value: any, proposer_id: str) -> Optional[any]:
        """
        提出提案
        :param value: 提案值
        :param proposer_id: 提案者ID
        :return: 学到的值，如果失败返回None
        """
        with self.paxos_lock:
            self.proposal_counter += 1
            proposal_id = self.proposal_counter
            
            # Phase 1: Prepare
            promises = []
            for acceptor in self.acceptors:
                promise = acceptor.prepare(proposal_id)
                if promise["promised"]:
                    promises.append(promise)
            
            # 检查是否获得多数派承诺
            if len(promises) < len(self.acceptors) // 2 + 1:
                return None
            
            # 如果有接受者已经接受了值，使用最大的提案ID的值
            accepted_values = [
                p for p in promises 
                if p["accepted_proposal_id"] > 0 and p["accepted_value"] is not None
            ]
            
            if accepted_values:
                # 选择提案ID最大的值
                accepted_values.sort(key=lambda x: x["accepted_proposal_id"], reverse=True)
                value = accepted_values[0]["accepted_value"]
            
            # Phase 2: Accept
            accepts = []
            for acceptor in self.acceptors:
                accept = acceptor.accept(proposal_id, value)
                if accept["accepted"]:
                    accepts.append(accept)
            
            # 检查是否获得多数派接受
            if len(accepts) < len(self.acceptors) // 2 + 1:
                return None
            
            # 通知学习者
            learned_value = None
            for learner in self.learners:
                for accept in accepts:
                    learned = learner.receive_accepted(
                        proposal_id, 
                        accept.get("acceptor_id", "unknown"), 
                        accept["value"]
                    )
                    if learned is not None:
                        learned_value = learned
            
            return learned_value

class ConsistencyManager:
    def __init__(self, node_count: int = 5):
        self.node_count = node_count
        self.quorum_size = node_count // 2 + 1
        
        # 创建接受者和学习者
        self.acceptors = [Acceptor(f"acceptor_{i}") for i in range(node_count)]
        self.learners = [PaxosLearner(f"learner_{i}", self.quorum_size) for i in range(2)]
        
        # 创建Paxos实例
        self.paxos = SimplePaxos(self.acceptors, self.learners)
        
        # 数据存储
        self.data_store = {}
        self.consistency_lock = threading.RLock()
    
    def write_with_consistency(self, key: str, value: any, 
                             consistency_level: ConsistencyLevel = ConsistencyLevel.STRONG) -> Dict:
        """
        带一致性保证的写入
        :param key: 键
        :param value: 值
        :param consistency_level: 一致性级别
        :return: 写入结果
        """
        start_time = time.time()
        
        if consistency_level == ConsistencyLevel.STRONG:
            # 使用Paxos协议确保强一致性
            proposal_value = {"key": key, "value": value, "timestamp": time.time()}
            learned_value = self.paxos.propose(proposal_value, "proposer_1")
            
            if learned_value:
                with self.consistency_lock:
                    self.data_store[key] = value
                
                return {
                    "success": True,
                    "consistency_level": "strong",
                    "processing_time": time.time() - start_time,
                    "value": learned_value
                }
            else:
                return {
                    "success": False,
                    "consistency_level": "strong",
                    "processing_time": time.time() - start_time,
                    "error": "Failed to reach consensus"
                }
        else:
            # 最终一致性或顺序一致性（简化处理）
            with self.consistency_lock:
                self.data_store[key] = value
            
            return {
                "success": True,
                "consistency_level": consistency_level.value,
                "processing_time": time.time() - start_time,
                "value": value
            }
    
    def read_with_consistency(self, key: str, 
                            consistency_level: ConsistencyLevel = ConsistencyLevel.EVENTUAL) -> Dict:
        """
        带一致性保证的读取
        :param key: 键
        :param consistency_level: 一致性级别
        :return: 读取结果
        """
        start_time = time.time()
        
        with self.consistency_lock:
            if key in self.data_store:
                value = self.data_store[key]
                return {
                    "success": True,
                    "key": key,
                    "value": value,
                    "consistency_level": consistency_level.value,
                    "processing_time": time.time() - start_time
                }
            else:
                return {
                    "success": False,
                    "key": key,
                    "consistency_level": consistency_level.value,
                    "processing_time": time.time() - start_time,
                    "error": "Key not found"
                }
    
    def get_consistency_stats(self) -> Dict:
        """获取一致性统计信息"""
        return {
            "node_count": self.node_count,
            "quorum_size": self.quorum_size,
            "acceptor_count": len(self.acceptors),
            "learner_count": len(self.learners),
            "data_items": len(self.data_store)
        }

# 使用示例
print("\n=== 分布式一致性协议 ===")

# 创建一致性管理器
consistency_manager = ConsistencyManager(node_count=5)

print("测试不同一致性级别的操作...")

# 1. 强一致性写入
print("1. 强一致性写入测试")
result1 = consistency_manager.write_with_consistency(
    "strong_key", 
    "strong_consistency_value", 
    ConsistencyLevel.STRONG
)
print(f"   写入结果: {result1['success']}")
print(f"   一致性级别: {result1['consistency_level']}")
print(f"   处理时间: {result1['processing_time']:.3f}s")

# 2. 最终一致性写入
print("2. 最终一致性写入测试")
result2 = consistency_manager.write_with_consistency(
    "eventual_key", 
    "eventual_consistency_value", 
    ConsistencyLevel.EVENTUAL
)
print(f"   写入结果: {result2['success']}")
print(f"   一致性级别: {result2['consistency_level']}")
print(f"   处理时间: {result2['processing_time']:.3f}s")

# 3. 读取测试
print("3. 读取测试")
read_result1 = consistency_manager.read_with_consistency("strong_key", ConsistencyLevel.STRONG)
print(f"   强一致性读取: {read_result1['success']}, 值: {read_result1.get('value')}")

read_result2 = consistency_manager.read_with_consistency("eventual_key", ConsistencyLevel.EVENTUAL)
print(f"   最终一致性读取: {read_result2['success']}, 值: {read_result2.get('value')}")

# 4. 一致性统计
print("4. 一致性统计信息")
stats = consistency_manager.get_consistency_stats()
print(f"   节点数: {stats['node_count']}")
print(f"   法定人数: {stats['quorum_size']}")
print(f"   数据项数: {stats['data_items']}")

# 5. 并发一致性测试
print("5. 并发一致性测试")

def concurrent_writer(writer_id: int, key: str, iterations: int):
    """并发写入测试"""
    successes = 0
    failures = 0
    
    for i in range(iterations):
        value = f"writer_{writer_id}_value_{i}"
        result = consistency_manager.write_with_consistency(
            key, 
            value, 
            ConsistencyLevel.STRONG
        )
        
        if result["success"]:
            successes += 1
        else:
            failures += 1
        
        # 随机延迟
        time.sleep(random.uniform(0.001, 0.01))
    
    print(f"   写入者 {writer_id}: 成功 {successes}, 失败 {failures}")

# 启动并发写入测试
concurrent_threads = []
for i in range(3):
    thread = threading.Thread(
        target=concurrent_writer, 
        args=(i, "concurrent_test_key", 20)
    )
    concurrent_threads.append(thread)
    thread.start()

# 等待所有线程完成
for thread in concurrent_threads:
    thread.join()

# 检查最终结果
final_read = consistency_manager.read_with_consistency("concurrent_test_key")
print(f"   最终读取结果: {final_read['success']}")
if final_read['success']:
    print(f"   最终值: {final_read['value']}")

# 6. 性能对比测试
print("6. 性能对比测试")

# 强一致性写入性能测试
start_time = time.time()
for i in range(10):
    consistency_manager.write_with_consistency(
        f"perf_strong_{i}", 
        f"value_{i}", 
        ConsistencyLevel.STRONG
    )
strong_time = time.time() - start_time

# 最终一致性写入性能测试
start_time = time.time()
for i in range(10):
    consistency_manager.write_with_consistency(
        f"perf_eventual_{i}", 
        f"value_{i}", 
        ConsistencyLevel.EVENTUAL
    )
eventual_time = time.time() - start_time

print(f"   强一致性写入10次: {strong_time:.3f}s")
print(f"   最终一致性写入10次: {eventual_time:.3f}s")
print(f"   性能差异: {strong_time/eventual_time:.1f}x")
```

### 6.1.5.4.2 版本向量与冲突解决

```python
# 版本向量与冲突解决
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import threading

@dataclass
class VersionVector:
    versions: Dict[str, int] = field(default_factory=dict)
    
    def increment(self, node_id: str) -> None:
        """增加指定节点的版本号"""
        self.versions[node_id] = self.versions.get(node_id, 0) + 1
    
    def merge(self, other: 'VersionVector') -> None:
        """合并版本向量"""
        for node_id, version in other.versions.items():
            self.versions[node_id] = max(self.versions.get(node_id, 0), version)
    
    def compare(self, other: 'VersionVector') -> int:
        """
        比较版本向量
        :return: 1 if self > other, -1 if self < other, 0 if concurrent
        """
        self_greater = True
        other_greater = True
        
        # 收集所有节点ID
        all_nodes = set(self.versions.keys()) | set(other.versions.keys())
        
        for node_id in all_nodes:
            self_version = self.versions.get(node_id, 0)
            other_version = other.versions.get(node_id, 0)
            
            if self_version < other_version:
                self_greater = False
            elif self_version > other_version:
                other_greater = False
        
        if self_greater and not other_greater:
            return 1
        elif other_greater and not self_greater:
            return -1
        else:
            return 0  # 并发
    
    def __str__(self) -> str:
        return str(dict(sorted(self.versions.items())))

@dataclass
class VersionedValue:
    value: any
    version_vector: VersionVector
    timestamp: float
    node_id: str

class VectorClockManager:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.local_version = 0
        self.version_vector = VersionVector()
        self.lock = threading.RLock()
    
    def increment_local(self) -> VersionVector:
        """增加本地版本"""
        with self.lock:
            self.local_version += 1
            self.version_vector.increment(self.node_id)
            return VersionVector(self.version_vector.versions.copy())
    
    def merge_version(self, other_vector: VersionVector) -> VersionVector:
        """合并版本向量"""
        with self.lock:
            self.version_vector.merge(other_vector)
            return VersionVector(self.version_vector.versions.copy())

class ConflictResolver:
    def __init__(self):
        self.resolver_lock = threading.RLock()
    
    def resolve_conflict(self, values: List[VersionedValue]) -> Optional[VersionedValue]:
        """
        解决版本冲突
        :param values: 冲突的版本值列表
        :return: 解决后的值
        """
        if not values:
            return None
        
        if len(values) == 1:
            return values[0]
        
        # 使用版本向量比较来解决冲突
        # 1. 找到最新的版本
        latest_values = []
        for value in values:
            is_latest = True
            for other in values:
                if value != other:
                    comparison = value.version_vector.compare(other.version_vector)
                    if comparison == -1:  # value < other
                        is_latest = False
                        break
            if is_latest:
                latest_values.append(value)
        
        # 2. 如果有多个最新版本，使用时间戳解决
        if len(latest_values) > 1:
            latest_values.sort(key=lambda x: x.timestamp, reverse=True)
            return latest_values[0]
        elif latest_values:
            return latest_values[0]
        else:
            # 所有版本都并发，选择时间戳最新的
            values.sort(key=lambda x: x.timestamp, reverse=True)
            return values[0]
    
    def merge_values(self, values: List[VersionedValue]) -> Optional[VersionedValue]:
        """
        合并多个值（适用于可合并的数据类型）
        :param values: 要合并的值列表
        :return: 合并后的值
        """
        if not values:
            return None
        
        if len(values) == 1:
            return values[0]
        
        # 创建合并后的版本向量
        merged_vector = VersionVector()
        for value in values:
            merged_vector.merge(value.version_vector)
        
        # 根据值类型进行合并
        first_value = values[0].value
        if isinstance(first_value, dict):
            # 合并字典
            merged_value = {}
            for value in values:
                if isinstance(value.value, dict):
                    merged_value.update(value.value)
        elif isinstance(first_value, list):
            # 合并列表
            merged_value = []
            for value in values:
                if isinstance(value.value, list):
                    merged_value.extend(value.value)
        elif isinstance(first_value, str):
            # 连接字符串
            merged_value = "".join(str(value.value) for value in values)
        else:
            # 使用最新的值
            values.sort(key=lambda x: x.timestamp, reverse=True)
            merged_value = values[0].value
        
        return VersionedValue(
            value=merged_value,
            version_vector=merged_vector,
            timestamp=time.time(),
            node_id="merged"
        )

class EventualConsistencyStore:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.vector_clock = VectorClockManager(node_id)
        self.conflict_resolver = ConflictResolver()
        self.data_store = defaultdict(list)  # {key: [VersionedValue, ...]}
        self.store_lock = threading.RLock()
    
    def put(self, key: str, value: any) -> VersionVector:
        """
        存储值
        :param key: 键
        :param value: 值
        :return: 版本向量
        """
        with self.store_lock:
            # 增加本地版本
            version_vector = self.vector_clock.increment_local()
            
            # 创建版本化值
            versioned_value = VersionedValue(
                value=value,
                version_vector=version_vector,
                timestamp=time.time(),
                node_id=self.node_id
            )
            
            # 存储值
            self.data_store[key].append(versioned_value)
            
            return version_vector
    
    def get(self, key: str) -> Optional[any]:
        """
        获取值（解决冲突）
        :param key: 键
        :return: 值
        """
        with self.store_lock:
            if key not in self.data_store or not self.data_store[key]:
                return None
            
            # 解决冲突
            resolved = self.conflict_resolver.resolve_conflict(self.data_store[key])
            return resolved.value if resolved else None
    
    def get_with_context(self, key: str) -> Optional[Tuple[any, VersionVector]]:
        """
        获取值和版本向量
        :param key: 键
        :return: (值, 版本向量)
        """
        with self.store_lock:
            if key not in self.data_store or not self.data_store[key]:
                return None
            
            # 解决冲突
            resolved = self.conflict_resolver.resolve_conflict(self.data_store[key])
            if resolved:
                return (resolved.value, resolved.version_vector)
            return None
    
    def merge_remote_value(self, key: str, value: any, version_vector: VersionVector) -> None:
        """
        合并远程值
        :param key: 键
        :param value: 值
        :param version_vector: 版本向量
        """
        with self.store_lock:
            # 合并版本向量
            self.vector_clock.merge_version(version_vector)
            
            # 创建版本化值
            versioned_value = VersionedValue(
                value=value,
                version_vector=version_vector,
                timestamp=time.time(),
                node_id="remote"
            )
            
            # 存储值
            self.data_store[key].append(versioned_value)
    
    def sync_with_node(self, other_store: 'EventualConsistencyStore') -> None:
        """
        与另一个节点同步
        :param other_store: 其他节点的存储
        """
        with self.store_lock:
            for key, values in other_store.data_store.items():
                for value in values:
                    self.merge_remote_value(key, value.value, value.version_vector)

# 使用示例
print("\n=== 版本向量与冲突解决 ===")

# 创建多个节点
node1 = EventualConsistencyStore("node1")
node2 = EventualConsistencyStore("node2")
node3 = EventualConsistencyStore("node3")

print("测试版本向量和冲突解决...")

# 1. 基本版本向量操作
print("1. 基本版本向量操作")
vv1 = VersionVector()
vv1.increment("node1")
vv1.increment("node1")
vv1.increment("node2")
print(f"   版本向量1: {vv1}")

vv2 = VersionVector()
vv2.increment("node1")
vv2.increment("node3")
print(f"   版本向量2: {vv2}")

# 合并版本向量
vv1.merge(vv2)
print(f"   合并后: {vv1}")

# 2. 在不同节点上写入数据
print("2. 多节点写入测试")
node1.put("shared_key", "value_from_node1")
print("   节点1写入: value_from_node1")

node2.put("shared_key", "value_from_node2")
print("   节点2写入: value_from_node2")

node3.put("shared_key", "value_from_node3")
print("   节点3写入: value_from_node3")

# 3. 各节点读取数据（应该解决冲突）
print("3. 冲突解决测试")
value1 = node1.get("shared_key")
value2 = node2.get("shared_key")
value3 = node3.get("shared_key")

print(f"   节点1读取: {value1}")
print(f"   节点2读取: {value2}")
print(f"   节点3读取: {value3}")

# 4. 节点间同步
print("4. 节点同步测试")
print("   同步前节点1版本向量:", node1.vector_clock.version_vector)
print("   同步前节点2版本向量:", node2.vector_clock.version_vector)

# 节点1和节点2同步
node1.sync_with_node(node2)
node2.sync_with_node(node1)

print("   同步后节点1版本向量:", node1.vector_clock.version_vector)
print("   同步后节点2版本向量:", node2.vector_clock.version_vector)

# 同步后再次读取
synced_value1 = node1.get("shared_key")
synced_value2 = node2.get("shared_key")
print(f"   同步后节点1读取: {synced_value1}")
print(f"   同步后节点2读取: {synced_value2}")

# 5. 版本向量比较测试
print("5. 版本向量比较测试")
vv_a = VersionVector({"node1": 2, "node2": 1})
vv_b = VersionVector({"node1": 1, "node2": 2})
vv_c = VersionVector({"node1": 2, "node2": 2})

print(f"   {vv_a} vs {vv_b}: {vv_a.compare(vv_b)}")  # 应该是并发
print(f"   {vv_a} vs {vv_c}: {vv_a.compare(vv_c)}")  # 应该是小于
print(f"   {vv_c} vs {vv_a}: {vv_c.compare(vv_a)}")  # 应该是大于

# 6. 性能测试
print("6. 性能测试")
start_time = time.time()
for i in range(1000):
    node1.put(f"perf_key_{i}", f"perf_value_{i}")
end_time = time.time()
print(f"   写入1000个键值对: {end_time - start_time:.3f}s")

start_time = time.time()
for i in range(1000):
    node1.get(f"perf_key_{i}")
end_time = time.time()
print(f"   读取1000个键值对: {end_time - start_time:.3f}s")
```

## 总结

数据读写流程与并发控制是分布式文件存储平台的核心技术，直接影响系统的性能、一致性和用户体验。通过本章的深入探讨，我们了解了以下关键内容：

1. **数据读写流程**：从客户端请求到数据存储的完整流程，包括权限验证、元数据查询、数据定位、并行读写和结果组装等环节。

2. **并发控制机制**：包括基于锁的并发控制（读写锁、分布式锁）和乐观并发控制（版本号、CAS操作），确保多客户端并发访问时的数据一致性。

3. **性能优化技术**：通过多级缓存、访问模式分析、批量处理等技术显著提升系统性能，降低延迟。

4. **一致性保证机制**：使用Paxos等分布式一致性协议确保强一致性，通过版本向量和冲突解决机制实现最终一致性。

在实际工程应用中，需要根据具体业务需求选择合适的技术方案：

- **强一致性场景**：如金融交易、配置管理等，需要使用Paxos等强一致性协议。
- **高性能场景**：如内容分发、日志存储等，可以采用最终一致性模型配合缓存优化。
- **混合场景**：根据不同数据的重要性和访问模式，采用不同的

一致性级别和优化策略。

通过合理设计和实现这些机制，分布式文件存储平台能够在保证数据一致性和可靠性的同时，提供高性能的数据访问服务。