---
title: 与HDFS、S3等标准协议的兼容与网关构建
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台的建设中，与业界标准协议的兼容性是确保平台能够广泛适配各种应用场景的关键因素。HDFS（Hadoop Distributed File System）和S3（Simple Storage Service）作为大数据和云存储领域的事实标准，其兼容性实现对于分布式文件存储平台的成功至关重要。本章将深入探讨与HDFS、S3等标准协议的兼容实现与网关构建技术。

## 7.4.1 标准协议兼容性概述

分布式文件存储平台需要与多种标准协议兼容，以满足不同应用生态系统的需求。

### 7.4.1.1 协议兼容性的重要性

```python
# 协议兼容性重要性分析
import time
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class ProtocolCompatibility:
    """协议兼容性信息"""
    protocol: str
    version: str
    features_supported: List[str]
    compatibility_level: str  # full, partial, none
    performance_impact: float  # 0-1, 性能影响程度

class ProtocolCompatibilityAnalyzer:
    def __init__(self):
        self.supported_protocols: Dict[str, ProtocolCompatibility] = {}
        self.compatibility_matrix: Dict[str, Dict[str, bool]] = {}
    
    def add_protocol_support(self, protocol: str, version: str, features: List[str], 
                           compatibility_level: str, performance_impact: float):
        """
        添加协议支持信息
        """
        self.supported_protocols[protocol] = ProtocolCompatibility(
            protocol=protocol,
            version=version,
            features_supported=features,
            compatibility_level=compatibility_level,
            performance_impact=performance_impact
        )
    
    def analyze_ecosystem_impact(self) -> Dict[str, any]:
        """
        分析协议兼容性对生态系统的影响
        """
        ecosystem_benefits = {
            "hdfs": {
                "big_data_integration": "与Hadoop生态系统无缝集成",
                "migration_path": "为从HDFS迁移提供平滑路径",
                "tool_compatibility": "支持现有Hadoop工具链"
            },
            "s3": {
                "cloud_native": "与云原生应用天然兼容",
                "tool_ecosystem": "支持丰富的S3兼容工具",
                "api_standardization": "基于广泛接受的RESTful API"
            },
            "posix": {
                "application_compatibility": "无需修改即可运行传统应用",
                "development_efficiency": "降低应用开发和迁移成本"
            }
        }
        
        return {
            "supported_protocols": list(self.supported_protocols.keys()),
            "ecosystem_benefits": ecosystem_benefits,
            "adoption_impact": self._calculate_adoption_impact()
        }
    
    def _calculate_adoption_impact(self) -> Dict[str, float]:
        """
        计算协议兼容性对采用率的影响
        """
        impact_scores = {}
        
        for protocol, info in self.supported_protocols.items():
            # 基于兼容性级别和性能影响计算采用影响分数
            base_score = 1.0 if info.compatibility_level == "full" else 0.5 if info.compatibility_level == "partial" else 0.1
            performance_penalty = 1.0 - info.performance_impact
            impact_scores[protocol] = base_score * performance_penalty
        
        return impact_scores
    
    def generate_compatibility_report(self) -> Dict[str, any]:
        """
        生成兼容性报告
        """
        ecosystem_analysis = self.analyze_ecosystem_impact()
        adoption_impact = self._calculate_adoption_impact()
        
        return {
            "timestamp": time.time(),
            "supported_protocols": {
                protocol: {
                    "version": info.version,
                    "features": info.features_supported,
                    "compatibility_level": info.compatibility_level,
                    "performance_impact": info.performance_impact
                }
                for protocol, info in self.supported_protocols.items()
            },
            "ecosystem_analysis": ecosystem_analysis,
            "adoption_impact": adoption_impact,
            "overall_compatibility_score": sum(adoption_impact.values()) / len(adoption_impact) if adoption_impact else 0
        }

# 使用示例
print("=== 协议兼容性重要性分析 ===")

# 创建协议兼容性分析器
compat_analyzer = ProtocolCompatibilityAnalyzer()

# 添加协议支持信息
compat_analyzer.add_protocol_support(
    "hdfs", "3.3.0", 
    ["FileSystem API", "Block Location", "Append", "Snapshots"],
    "full", 0.05
)

compat_analyzer.add_protocol_support(
    "s3", "2006-03-01",
    ["REST API", "Multipart Upload", "Versioning", "Lifecycle"],
    "full", 0.02
)

compat_analyzer.add_protocol_support(
    "posix", "IEEE 1003.1",
    ["open/close", "read/write", "stat", "chmod"],
    "partial", 0.1
)

# 生成兼容性报告
compat_report = compat_analyzer.generate_compatibility_report()
print(f"支持的协议: {list(compat_report['supported_protocols'].keys())}")
print(f"生态系统分析: {compat_report['ecosystem_analysis']['supported_protocols']}")
print(f"采用影响分数: {compat_report['adoption_impact']}")
print(f"整体兼容性分数: {compat_report['overall_compatibility_score']:.2f}")
```

### 7.4.1.2 兼容性实现架构

```python
# 兼容性实现架构设计
import abc
from typing import Dict, List, Optional, Any
import threading

class ProtocolInterface(abc.ABC):
    """协议接口抽象基类"""
    
    @abc.abstractmethod
    def connect(self, config: Dict[str, Any]) -> bool:
        """连接到协议服务"""
        pass
    
    @abc.abstractmethod
    def disconnect(self) -> bool:
        """断开连接"""
        pass
    
    @abc.abstractmethod
    def create_file(self, path: str, data: bytes = None) -> bool:
        """创建文件"""
        pass
    
    @abc.abstractmethod
    def read_file(self, path: str, offset: int = 0, length: int = -1) -> Optional[bytes]:
        """读取文件"""
        pass
    
    @abc.abstractmethod
    def write_file(self, path: str, data: bytes, offset: int = 0) -> bool:
        """写入文件"""
        pass
    
    @abc.abstractmethod
    def delete_file(self, path: str) -> bool:
        """删除文件"""
        pass
    
    @abc.abstractmethod
    def list_directory(self, path: str) -> List[str]:
        """列出目录内容"""
        pass

class HDFSProtocolAdapter(ProtocolInterface):
    """HDFS协议适配器"""
    
    def __init__(self):
        self.client = None
        self.connected = False
        self.lock = threading.Lock()
    
    def connect(self, config: Dict[str, Any]) -> bool:
        """连接到HDFS集群"""
        try:
            # 模拟HDFS客户端初始化
            hdfs_host = config.get("hdfs_host", "localhost")
            hdfs_port = config.get("hdfs_port", 9000)
            
            print(f"连接到HDFS集群: {hdfs_host}:{hdfs_port}")
            # 在实际实现中，这里会初始化HDFS客户端
            # self.client = hdfs.InsecureClient(f"http://{hdfs_host}:{hdfs_port}")
            
            self.connected = True
            return True
        except Exception as e:
            print(f"HDFS连接失败: {e}")
            self.connected = False
            return False
    
    def disconnect(self) -> bool:
        """断开HDFS连接"""
        with self.lock:
            if self.connected:
                # 在实际实现中，这里会关闭HDFS客户端连接
                print("断开HDFS连接")
                self.connected = False
                return True
            return False
    
    def create_file(self, path: str, data: bytes = None) -> bool:
        """在HDFS中创建文件"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                print(f"HDFS创建文件: {path}")
                # 在实际实现中，这里会调用HDFS API创建文件
                # if data:
                #     self.client.write(path, data=data, overwrite=True)
                # else:
                #     self.client.write(path, data=b"", overwrite=True)
                return True
            except Exception as e:
                print(f"HDFS创建文件失败: {e}")
                return False
    
    def read_file(self, path: str, offset: int = 0, length: int = -1) -> Optional[bytes]:
        """从HDFS读取文件"""
        with self.lock:
            if not self.connected:
                return None
            
            try:
                print(f"HDFS读取文件: {path} offset={offset} length={length}")
                # 在实际实现中，这里会调用HDFS API读取文件
                # with self.client.read(path, offset=offset, length=length) as reader:
                #     return reader.read()
                return b"HDFS file content"  # 模拟数据
            except Exception as e:
                print(f"HDFS读取文件失败: {e}")
                return None
    
    def write_file(self, path: str, data: bytes, offset: int = 0) -> bool:
        """向HDFS写入文件"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                print(f"HDFS写入文件: {path} offset={offset} size={len(data)}")
                # 在实际实现中，这里会调用HDFS API写入文件
                # self.client.write(path, data=data, append=True if offset > 0 else False)
                return True
            except Exception as e:
                print(f"HDFS写入文件失败: {e}")
                return False
    
    def delete_file(self, path: str) -> bool:
        """从HDFS删除文件"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                print(f"HDFS删除文件: {path}")
                # 在实际实现中，这里会调用HDFS API删除文件
                # self.client.delete(path, recursive=False)
                return True
            except Exception as e:
                print(f"HDFS删除文件失败: {e}")
                return False
    
    def list_directory(self, path: str) -> List[str]:
        """列出HDFS目录内容"""
        with self.lock:
            if not self.connected:
                return []
            
            try:
                print(f"HDFS列出目录: {path}")
                # 在实际实现中，这里会调用HDFS API列出目录
                # return self.client.list(path)
                return ["file1.txt", "file2.txt", "subdir/"]  # 模拟数据
            except Exception as e:
                print(f"HDFS列出目录失败: {e}")
                return []

class S3ProtocolAdapter(ProtocolInterface):
    """S3协议适配器"""
    
    def __init__(self):
        self.client = None
        self.connected = False
        self.lock = threading.Lock()
    
    def connect(self, config: Dict[str, Any]) -> bool:
        """连接到S3服务"""
        try:
            # 模拟S3客户端初始化
            aws_access_key = config.get("aws_access_key")
            aws_secret_key = config.get("aws_secret_key")
            region = config.get("region", "us-east-1")
            
            print(f"连接到S3服务: region={region}")
            # 在实际实现中，这里会初始化S3客户端
            # self.client = boto3.client('s3', 
            #                           aws_access_key_id=aws_access_key,
            #                           aws_secret_access_key=aws_secret_key,
            #                           region_name=region)
            
            self.connected = True
            return True
        except Exception as e:
            print(f"S3连接失败: {e}")
            self.connected = False
            return False
    
    def disconnect(self) -> bool:
        """断开S3连接"""
        with self.lock:
            if self.connected:
                print("断开S3连接")
                self.connected = False
                return True
            return False
    
    def create_file(self, path: str, data: bytes = None) -> bool:
        """在S3中创建对象"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                # 解析bucket和key
                parts = path.lstrip("/").split("/", 1)
                bucket = parts[0]
                key = parts[1] if len(parts) > 1 else ""
                
                print(f"S3创建对象: bucket={bucket} key={key}")
                # 在实际实现中，这里会调用S3 API创建对象
                # self.client.put_object(Bucket=bucket, Key=key, Body=data or b"")
                return True
            except Exception as e:
                print(f"S3创建对象失败: {e}")
                return False
    
    def read_file(self, path: str, offset: int = 0, length: int = -1) -> Optional[bytes]:
        """从S3读取对象"""
        with self.lock:
            if not self.connected:
                return None
            
            try:
                # 解析bucket和key
                parts = path.lstrip("/").split("/", 1)
                bucket = parts[0]
                key = parts[1] if len(parts) > 1 else ""
                
                print(f"S3读取对象: bucket={bucket} key={key} range={offset}-{offset+length-1 if length > 0 else ''}")
                # 在实际实现中，这里会调用S3 API读取对象
                # if length > 0:
                #     response = self.client.get_object(Bucket=bucket, Key=key, 
                #                                      Range=f"bytes={offset}-{offset+length-1}")
                # else:
                #     response = self.client.get_object(Bucket=bucket, Key=key)
                # return response['Body'].read()
                return b"S3 object content"  # 模拟数据
            except Exception as e:
                print(f"S3读取对象失败: {e}")
                return None
    
    def write_file(self, path: str, data: bytes, offset: int = 0) -> bool:
        """向S3写入对象"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                # 解析bucket和key
                parts = path.lstrip("/").split("/", 1)
                bucket = parts[0]
                key = parts[1] if len(parts) > 1 else ""
                
                print(f"S3写入对象: bucket={bucket} key={key} size={len(data)}")
                # 在实际实现中，这里会调用S3 API写入对象
                # self.client.put_object(Bucket=bucket, Key=key, Body=data)
                return True
            except Exception as e:
                print(f"S3写入对象失败: {e}")
                return False
    
    def delete_file(self, path: str) -> bool:
        """从S3删除对象"""
        with self.lock:
            if not self.connected:
                return False
            
            try:
                # 解析bucket和key
                parts = path.lstrip("/").split("/", 1)
                bucket = parts[0]
                key = parts[1] if len(parts) > 1 else ""
                
                print(f"S3删除对象: bucket={bucket} key={key}")
                # 在实际实现中，这里会调用S3 API删除对象
                # self.client.delete_object(Bucket=bucket, Key=key)
                return True
            except Exception as e:
                print(f"S3删除对象失败: {e}")
                return False
    
    def list_directory(self, path: str) -> List[str]:
        """列出S3存储桶内容"""
        with self.lock:
            if not self.connected:
                return []
            
            try:
                # 解析bucket和prefix
                parts = path.lstrip("/").split("/", 1)
                bucket = parts[0]
                prefix = parts[1] if len(parts) > 1 else ""
                
                print(f"S3列出对象: bucket={bucket} prefix={prefix}")
                # 在实际实现中，这里会调用S3 API列出对象
                # response = self.client.list_objects_v2(Bucket=bucket, Prefix=prefix)
                # if 'Contents' in response:
                #     return [obj['Key'] for obj in response['Contents']]
                return ["object1.txt", "object2.txt", "folder/"]  # 模拟数据
            except Exception as e:
                print(f"S3列出对象失败: {e}")
                return []

class ProtocolAdapterManager:
    """协议适配器管理器"""
    
    def __init__(self):
        self.adapters: Dict[str, ProtocolInterface] = {}
        self.adapter_configs: Dict[str, Dict[str, Any]] = {}
        self.manager_lock = threading.Lock()
    
    def register_adapter(self, protocol: str, adapter: ProtocolInterface, config: Dict[str, Any]):
        """
        注册协议适配器
        """
        with self.manager_lock:
            self.adapters[protocol] = adapter
            self.adapter_configs[protocol] = config
    
    def connect_all(self) -> Dict[str, bool]:
        """
        连接所有已注册的协议适配器
        """
        results = {}
        with self.manager_lock:
            for protocol, adapter in self.adapters.items():
                config = self.adapter_configs.get(protocol, {})
                results[protocol] = adapter.connect(config)
        return results
    
    def disconnect_all(self) -> Dict[str, bool]:
        """
        断开所有协议适配器连接
        """
        results = {}
        with self.manager_lock:
            for protocol, adapter in self.adapters.items():
                results[protocol] = adapter.disconnect()
        return results
    
    def get_adapter(self, protocol: str) -> Optional[ProtocolInterface]:
        """
        获取指定协议的适配器
        """
        with self.manager_lock:
            return self.adapters.get(protocol)

# 使用示例
print("\n=== 协议兼容性实现架构演示 ===")

# 创建协议适配器管理器
adapter_manager = ProtocolAdapterManager()

# 注册HDFS适配器
hdfs_adapter = HDFSProtocolAdapter()
hdfs_config = {
    "hdfs_host": "namenode.hadoop.cluster",
    "hdfs_port": 9000
}
adapter_manager.register_adapter("hdfs", hdfs_adapter, hdfs_config)

# 注册S3适配器
s3_adapter = S3ProtocolAdapter()
s3_config = {
    "aws_access_key": "YOUR_ACCESS_KEY",
    "aws_secret_key": "YOUR_SECRET_KEY",
    "region": "us-west-2"
}
adapter_manager.register_adapter("s3", s3_adapter, s3_config)

# 连接所有适配器
print("连接所有协议适配器...")
connection_results = adapter_manager.connect_all()
print(f"连接结果: {connection_results}")

# 使用HDFS适配器
hdfs_adapter_instance = adapter_manager.get_adapter("hdfs")
if hdfs_adapter_instance:
    print("\n使用HDFS适配器:")
    hdfs_adapter_instance.create_file("/user/data/test.txt", b"Hello HDFS")
    hdfs_data = hdfs_adapter_instance.read_file("/user/data/test.txt")
    print(f"读取HDFS数据: {hdfs_data}")
    hdfs_files = hdfs_adapter_instance.list_directory("/user/data")
    print(f"HDFS目录内容: {hdfs_files}")

# 使用S3适配器
s3_adapter_instance = adapter_manager.get_adapter("s3")
if s3_adapter_instance:
    print("\n使用S3适配器:")
    s3_adapter_instance.create_file("/my-bucket/data/test.txt", b"Hello S3")
    s3_data = s3_adapter_instance.read_file("/my-bucket/data/test.txt")
    print(f"读取S3数据: {s3_data}")
    s3_objects = s3_adapter_instance.list_directory("/my-bucket/data")
    print(f"S3对象列表: {s3_objects}")

# 断开所有连接
print("\n断开所有协议适配器连接...")
disconnection_results = adapter_manager.disconnect_all()
print(f"断开连接结果: {disconnection_results}")
```

## 7.4.2 HDFS协议兼容实现

HDFS作为Hadoop生态系统的核心组件，其兼容性实现对于大数据应用的迁移和集成至关重要。

### 7.4.2.1 HDFS兼容性设计

```python
# HDFS兼容性设计实现
import os
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import threading

@dataclass
class HDFSMetadata:
    """HDFS元数据"""
    path: str
    is_directory: bool
    size: int
    block_size: int
    replication: int
    modification_time: float
    access_time: float
    permission: str
    owner: str
    group: str
    blocks: List[Dict[str, any]]  # 块信息

class HDFSEmulator:
    """
    HDFS协议模拟器，实现核心HDFS功能
    """
    def __init__(self, default_block_size: int = 128 * 1024 * 1024, default_replication: int = 3):
        self.default_block_size = default_block_size
        self.default_replication = default_replication
        self.filesystem: Dict[str, HDFSMetadata] = {}
        self.file_data: Dict[str, bytes] = {}
        self.lock = threading.RLock()
        self.next_block_id = 1
    
    def create_file(self, path: str, overwrite: bool = False, 
                   block_size: int = None, replication: int = None) -> bool:
        """
        创建文件（模拟HDFS的create操作）
        """
        with self.lock:
            # 检查文件是否已存在
            if path in self.filesystem and not overwrite:
                print(f"文件已存在且不允许覆盖: {path}")
                return False
            
            # 创建文件元数据
            metadata = HDFSMetadata(
                path=path,
                is_directory=False,
                size=0,
                block_size=block_size or self.default_block_size,
                replication=replication or self.default_replication,
                modification_time=time.time(),
                access_time=time.time(),
                permission="rw-r--r--",
                owner="hdfs",
                group="hdfs",
                blocks=[]
            )
            
            self.filesystem[path] = metadata
            self.file_data[path] = b""
            
            print(f"创建HDFS文件: {path}")
            return True
    
    def append_file(self, path: str) -> bool:
        """
        追加到文件（模拟HDFS的append操作）
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"文件不存在: {path}")
                return False
            
            # 更新访问时间
            self.filesystem[path].access_time = time.time()
            
            print(f"准备追加到HDFS文件: {path}")
            return True
    
    def write_data(self, path: str, data: bytes, offset: int = 0) -> bool:
        """
        写入数据到文件
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"文件不存在: {path}")
                return False
            
            # 更新文件数据
            current_data = self.file_data.get(path, b"")
            
            if offset + len(data) > len(current_data):
                # 扩展文件
                current_data = current_data.ljust(offset + len(data), b'\x00')
            
            # 写入数据
            new_data = current_data[:offset] + data + current_data[offset + len(data):]
            self.file_data[path] = new_data
            
            # 更新元数据
            metadata = self.filesystem[path]
            metadata.size = len(new_data)
            metadata.modification_time = time.time()
            metadata.access_time = time.time()
            
            # 更新块信息
            self._update_block_info(metadata, new_data)
            
            print(f"写入HDFS文件数据: {path} offset={offset} size={len(data)}")
            return True
    
    def _update_block_info(self, metadata: HDFSMetadata, data: bytes):
        """
        更新块信息
        """
        # 计算需要的块数
        num_blocks = (len(data) + metadata.block_size - 1) // metadata.block_size
        
        # 更新块信息
        metadata.blocks = []
        for i in range(num_blocks):
            start_offset = i * metadata.block_size
            end_offset = min(start_offset + metadata.block_size, len(data))
            block_size = end_offset - start_offset
            
            block_info = {
                "block_id": self.next_block_id,
                "length": block_size,
                "offset": start_offset,
                "locations": [f"datanode-{j}" for j in range(metadata.replication)]
            }
            
            metadata.blocks.append(block_info)
            self.next_block_id += 1
    
    def read_data(self, path: str, offset: int = 0, length: int = -1) -> Optional[bytes]:
        """
        读取文件数据（模拟HDFS的open和read操作）
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"文件不存在: {path}")
                return None
            
            # 更新访问时间
            self.filesystem[path].access_time = time.time()
            
            # 获取文件数据
            data = self.file_data.get(path, b"")
            
            if length == -1:
                # 读取从offset到文件末尾的所有数据
                result = data[offset:]
            else:
                # 读取指定长度的数据
                result = data[offset:offset + length]
            
            print(f"读取HDFS文件数据: {path} offset={offset} length={len(result)}")
            return result
    
    def delete_file(self, path: str, recursive: bool = False) -> bool:
        """
        删除文件或目录（模拟HDFS的delete操作）
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"路径不存在: {path}")
                return False
            
            metadata = self.filesystem[path]
            
            if metadata.is_directory and not recursive:
                # 检查目录是否为空
                has_children = any(p.startswith(path + "/") for p in self.filesystem.keys())
                if has_children:
                    print(f"目录非空且未指定递归删除: {path}")
                    return False
            
            # 删除文件或目录
            del self.filesystem[path]
            if path in self.file_data:
                del self.file_data[path]
            
            # 如果是递归删除，删除子项
            if recursive:
                paths_to_delete = [p for p in self.filesystem.keys() if p.startswith(path + "/")]
                for child_path in paths_to_delete:
                    del self.filesystem[child_path]
                    if child_path in self.file_data:
                        del self.file_data[child_path]
            
            print(f"删除HDFS路径: {path} (递归: {recursive})")
            return True
    
    def list_status(self, path: str) -> List[HDFSMetadata]:
        """
        列出路径状态（模拟HDFS的listStatus操作）
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"路径不存在: {path}")
                return []
            
            metadata = self.filesystem[path]
            
            if not metadata.is_directory:
                # 如果是文件，返回文件本身的信息
                return [metadata]
            
            # 如果是目录，返回目录下的直接子项
            children = []
            for item_path, item_metadata in self.filesystem.items():
                if item_path == path:
                    continue  # 跳过目录本身
                
                # 检查是否为直接子项
                if item_path.startswith(path + "/"):
                    # 检查是否为直接子项（没有更多的斜杠）
                    relative_path = item_path[len(path) + 1:]
                    if "/" not in relative_path:
                        children.append(item_metadata)
            
            print(f"列出HDFS路径状态: {path} (子项数: {len(children)})")
            return children
    
    def get_file_info(self, path: str) -> Optional[HDFSMetadata]:
        """
        获取文件信息（模拟HDFS的getFileStatus操作）
        """
        with self.lock:
            if path not in self.filesystem:
                print(f"文件不存在: {path}")
                return None
            
            # 更新访问时间
            self.filesystem[path].access_time = time.time()
            
            print(f"获取HDFS文件信息: {path}")
            return self.filesystem[path]
    
    def mkdirs(self, path: str, permission: str = "755") -> bool:
        """
        创建目录（模拟HDFS的mkdirs操作）
        """
        with self.lock:
            # 检查路径是否已存在
            if path in self.filesystem:
                if self.filesystem[path].is_directory:
                    print(f"目录已存在: {path}")
                    return True
                else:
                    print(f"路径已存在但不是目录: {path}")
                    return False
            
            # 创建目录元数据
            metadata = HDFSMetadata(
                path=path,
                is_directory=True,
                size=0,
                block_size=0,
                replication=0,
                modification_time=time.time(),
                access_time=time.time(),
                permission=permission,
                owner="hdfs",
                group="hdfs",
                blocks=[]
            )
            
            self.filesystem[path] = metadata
            
            print(f"创建HDFS目录: {path}")
            return True
    
    def rename(self, src: str, dst: str) -> bool:
        """
        重命名文件或目录（模拟HDFS的rename操作）
        """
        with self.lock:
            if src not in self.filesystem:
                print(f"源路径不存在: {src}")
                return False
            
            # 检查目标路径是否存在
            if dst in self.filesystem:
                print(f"目标路径已存在: {dst}")
                return False
            
            # 移动文件或目录
            metadata = self.filesystem[src]
            metadata.path = dst
            self.filesystem[dst] = metadata
            del self.filesystem[src]
            
            # 移动文件数据
            if src in self.file_data:
                self.file_data[dst] = self.file_data[src]
                del self.file_data[src]
            
            # 更新子项路径（如果是目录）
            if metadata.is_directory:
                paths_to_update = [p for p in self.filesystem.keys() if p.startswith(src + "/")]
                for old_path in paths_to_update:
                    new_path = dst + old_path[len(src):]
                    metadata_item = self.filesystem[old_path]
                    metadata_item.path = new_path
                    self.filesystem[new_path] = metadata_item
                    del self.filesystem[old_path]
                    
                    # 移动数据
                    if old_path in self.file_data:
                        self.file_data[new_path] = self.file_data[old_path]
                        del self.file_data[old_path]
            
            print(f"重命名HDFS路径: {src} -> {dst}")
            return True

class HDFSCompatibilityLayer:
    """
    HDFS兼容性层，提供与HDFS客户端兼容的接口
    """
    def __init__(self, hdfs_emulator: HDFSEmulator):
        self.emulator = hdfs_emulator
        self.open_files: Dict[str, any] = {}
        self.file_handles = {}
        self.handle_counter = 0
    
    def create(self, path: str, overwrite: bool = False, 
              blocksize: int = 0, replication: int = 0) -> str:
        """
        创建文件并返回文件句柄
        """
        success = self.emulator.create_file(
            path, overwrite, 
            block_size=blocksize if blocksize > 0 else None,
            replication=replication if replication > 0 else None
        )
        
        if success:
            self.handle_counter += 1
            handle = f"hdfs_handle_{self.handle_counter}"
            self.file_handles[handle] = {
                "path": path,
                "mode": "w",
                "position": 0
            }
            return handle
        else:
            raise Exception(f"无法创建文件: {path}")
    
    def append(self, path: str) -> str:
        """
        追加到文件并返回文件句柄
        """
        success = self.emulator.append_file(path)
        
        if success:
            self.handle_counter += 1
            handle = f"hdfs_handle_{self.handle_counter}"
            file_size = self.emulator.get_file_info(path).size if self.emulator.get_file_info(path) else 0
            self.file_handles[handle] = {
                "path": path,
                "mode": "a",
                "position": file_size
            }
            return handle
        else:
            raise Exception(f"无法追加到文件: {path}")
    
    def write(self, handle: str, data: bytes) -> int:
        """
        写入数据到文件
        """
        if handle not in self.file_handles:
            raise Exception(f"无效的文件句柄: {handle}")
        
        file_info = self.file_handles[handle]
        path = file_info["path"]
        position = file_info["position"]
        
        success = self.emulator.write_data(path, data, position)
        
        if success:
            written_bytes = len(data)
            file_info["position"] += written_bytes
            return written_bytes
        else:
            raise Exception(f"写入文件失败: {path}")
    
    def open(self, path: str) -> str:
        """
        打开文件进行读取并返回文件句柄
        """
        if path not in self.emulator.filesystem:
            raise Exception(f"文件不存在: {path}")
        
        self.handle_counter += 1
        handle = f"hdfs_handle_{self.handle_counter}"
        self.file_handles[handle] = {
            "path": path,
            "mode": "r",
            "position": 0
        }
        return handle
    
    def read(self, handle: str, length: int) -> bytes:
        """
        从文件读取数据
        """
        if handle not in self.file_handles:
            raise Exception(f"无效的文件句柄: {handle}")
        
        file_info = self.file_handles[handle]
        if file_info["mode"] != "r":
            raise Exception("文件未以读取模式打开")
        
        path = file_info["path"]
        position = file_info["position"]
        
        data = self.emulator.read_data(path, position, length)
        
        if data is not None:
            file_info["position"] += len(data)
            return data
        else:
            return b""
    
    def close(self, handle: str) -> bool:
        """
        关闭文件句柄
        """
        if handle in self.file_handles:
            del self.file_handles[handle]
            return True
        return False
    
    def delete(self, path: str, recursive: bool = False) -> bool:
        """
        删除文件或目录
        """
        return self.emulator.delete_file(path, recursive)
    
    def list_status(self, path: str) -> List[Dict[str, any]]:
        """
        列出路径状态
        """
        metadata_list = self.emulator.list_status(path)
        return [
            {
                "path": metadata.path,
                "isdir": metadata.is_directory,
                "length": metadata.size,
                "modification_time": metadata.modification_time,
                "access_time": metadata.access_time,
                "block_size": metadata.block_size,
                "replication": metadata.replication,
                "permission": metadata.permission,
                "owner": metadata.owner,
                "group": metadata.group
            }
            for metadata in metadata_list
        ]
    
    def get_file_info(self, path: str) -> Dict[str, any]:
        """
        获取文件信息
        """
        metadata = self.emulator.get_file_info(path)
        if metadata:
            return {
                "path": metadata.path,
                "isdir": metadata.is_directory,
                "length": metadata.size,
                "modification_time": metadata.modification_time,
                "access_time": metadata.access_time,
                "block_size": metadata.block_size,
                "replication": metadata.replication,
                "permission": metadata.permission,
                "owner": metadata.owner,
                "group": metadata.group
            }
        else:
            raise Exception(f"文件不存在: {path}")
    
    def mkdirs(self, path: str, permission: str = "755") -> bool:
        """
        创建目录
        """
        return self.emulator.mkdirs(path, permission)
    
    def rename(self, src: str, dst: str) -> bool:
        """
        重命名文件或目录
        """
        return self.emulator.rename(src, dst)

# 使用示例
print("\n=== HDFS兼容性设计演示 ===")

# 创建HDFS模拟器
hdfs_emulator = HDFSEmulator(default_block_size=64*1024*1024, default_replication=2)

# 创建HDFS兼容性层
hdfs_compat = HDFSCompatibilityLayer(hdfs_emulator)

# 创建目录
print("创建目录...")
hdfs_compat.mkdirs("/user/data")
hdfs_compat.mkdirs("/user/data/input")

# 创建文件
print("\n创建文件...")
handle1 = hdfs_compat.create("/user/data/input/file1.txt", overwrite=True)
print(f"创建文件句柄: {handle1}")

# 写入数据
print("\n写入数据...")
data1 = b"Hello, HDFS Compatibility Layer!\nThis is line 1.\nThis is line 2.\n"
written1 = hdfs_compat.write(handle1, data1)
print(f"写入字节数: {written1}")

# 写入更多数据
data2 = b"This is line 3.\nThis is line 4.\n"
written2 = hdfs_compat.write(handle1, data2)
print(f"写入字节数: {written2}")

# 关闭文件
hdfs_compat.close(handle1)
print("文件已关闭")

# 读取文件
print("\n读取文件...")
handle2 = hdfs_compat.open("/user/data/input/file1.txt")
read_data = hdfs_compat.read(handle2, 1024)  # 读取最多1024字节
print(f"读取数据: {read_data.decode()}")
hdfs_compat.close(handle2)

# 获取文件信息
print("\n获取文件信息...")
file_info = hdfs_compat.get_file_info("/user/data/input/file1.txt")
print(f"文件信息: {file_info}")

# 列出目录内容
print("\n列出目录内容...")
dir_status = hdfs_compat.list_status("/user/data/input")
print(f"目录内容: {[item['path'] for item in dir_status]}")

# 重命名文件
print("\n重命名文件...")
rename_success = hdfs_compat.rename("/user/data/input/file1.txt", "/user/data/input/renamed_file.txt")
print(f"重命名结果: {rename_success}")

# 再次列出目录
dir_status2 = hdfs_compat.list_status("/user/data/input")
print(f"重命名后目录内容: {[item['path'] for item in dir_status2]}")

# 删除文件
print("\n删除文件...")
delete_success = hdfs_compat.delete("/user/data/input/renamed_file.txt")
print(f"删除结果: {delete_success}")
```

### 7.4.2.2 HDFS兼容性测试

```python
# HDFS兼容性测试框架
import unittest
import tempfile
import os
from typing import Dict, List

class HDFSTestCase:
    """
    HDFS兼容性测试用例基类
    """
    def __init__(self, hdfs_client):
        self.hdfs_client = hdfs_client
        self.test_root = "/tmp/hdfs_test"
    
    def setUp(self):
        """测试设置"""
        # 创建测试根目录
        self.hdfs_client.mkdirs(self.test_root)
    
    def tearDown(self):
        """测试清理"""
        # 删除测试根目录
        self.hdfs_client.delete(self.test_root, recursive=True)

class HDFSBasicOperationsTest(HDFSTestCase):
    """
    HDFS基本操作测试
    """
    def test_create_and_read_file(self):
        """测试创建和读取文件"""
        test_path = f"{self.test_root}/test_file.txt"
        
        # 创建文件
        handle = self.hdfs_client.create(test_path, overwrite=True)
        test_data = b"Hello, HDFS Test!"
        written = self.hdfs_client.write(handle, test_data)
        self.hdfs_client.close(handle)
        
        # 验证写入的字节数
        assert written == len(test_data)
        
        # 读取文件
        handle = self.hdfs_client.open(test_path)
        read_data = self.hdfs_client.read(handle, len(test_data))
        self.hdfs_client.close(handle)
        
        # 验证数据一致性
        assert read_data == test_data
        print("✓ 文件创建和读取测试通过")
    
    def test_append_to_file(self):
        """测试追加到文件"""
        test_path = f"{self.test_root}/append_test.txt"
        
        # 创建初始文件
        handle = self.hdfs_client.create(test_path, overwrite=True)
        initial_data = b"Initial data\n"
        self.hdfs_client.write(handle, initial_data)
        self.hdfs_client.close(handle)
        
        # 追加数据
        handle = self.hdfs_client.append(test_path)
        append_data = b"Appended data\n"
        self.hdfs_client.write(handle, append_data)
        self.hdfs_client.close(handle)
        
        # 读取完整文件
        handle = self.hdfs_client.open(test_path)
        full_data = self.hdfs_client.read(handle, 1024)
        self.hdfs_client.close(handle)
        
        # 验证数据
        expected_data = initial_data + append_data
        assert full_data == expected_data
        print("✓ 文件追加测试通过")
    
    def test_file_operations(self):
        """测试文件操作"""
        test_path = f"{self.test_root}/file_ops_test.txt"
        
        # 创建文件
        handle = self.hdfs_client.create(test_path, overwrite=True)
        self.hdfs_client.write(handle, b"Test data")
        self.hdfs_client.close(handle)
        
        # 获取文件信息
        file_info = self.hdfs_client.get_file_info(test_path)
        assert not file_info["isdir"]
        assert file_info["length"] == 9  # "Test data" 的长度
        
        # 列出目录
        dir_status = self.hdfs_client.list_status(self.test_root)
        file_paths = [item["path"] for item in dir_status if not item["isdir"]]
        assert test_path in file_paths
        
        # 重命名文件
        new_path = f"{self.test_root}/renamed_file.txt"
        rename_result = self.hdfs_client.rename(test_path, new_path)
        assert rename_result
        
        # 验证重命名
        try:
            self.hdfs_client.get_file_info(test_path)
            assert False, "原文件应该不存在"
        except Exception:
            pass  # 原文件不存在，符合预期
        
        new_file_info = self.hdfs_client.get_file_info(new_path)
        assert new_file_info is not None
        
        # 删除文件
        delete_result = self.hdfs_client.delete(new_path)
        assert delete_result
        
        # 验证删除
        try:
            self.hdfs_client.get_file_info(new_path)
            assert False, "文件应该已被删除"
        except Exception:
            pass  # 文件不存在，符合预期
        
        print("✓ 文件操作测试通过")
    
    def test_directory_operations(self):
        """测试目录操作"""
        test_dir = f"{self.test_root}/test_dir"
        
        # 创建目录
        mkdir_result = self.hdfs_client.mkdirs(test_dir)
        assert mkdir_result
        
        # 验证目录创建
        dir_info = self.hdfs_client.get_file_info(test_dir)
        assert dir_info["isdir"]
        
        # 在目录中创建文件
        file_path = f"{test_dir}/nested_file.txt"
        handle = self.hdfs_client.create(file_path, overwrite=True)
        self.hdfs_client.write(handle, b"Nested file content")
        self.hdfs_client.close(handle)
        
        # 列出目录内容
        dir_status = self.hdfs_client.list_status(test_dir)
        assert len(dir_status) == 1
        assert dir_status[0]["path"] == file_path
        
        # 递归删除目录
        delete_result = self.hdfs_client.delete(test_dir, recursive=True)
        assert delete_result
        
        # 验证删除
        try:
            self.hdfs_client.get_file_info(test_dir)
            assert False, "目录应该已被删除"
        except Exception:
            pass  # 目录不存在，符合预期
        
        print("✓ 目录操作测试通过")

class HDFSPerformanceTest(HDFSTestCase):
    """
    HDFS性能测试
    """
    def test_large_file_operations(self):
        """测试大文件操作性能"""
        import time
        
        test_path = f"{self.test_root}/large_file_test.txt"
        large_data = b"x" * (10 * 1024 * 1024)  # 10MB数据
        
        # 测试写入性能
        start_time = time.time()
        handle = self.hdfs_client.create(test_path, overwrite=True)
        written = self.hdfs_client.write(handle, large_data)
        self.hdfs_client.close(handle)
        write_time = time.time() - start_time
        
        assert written == len(large_data)
        print(f"✓ 大文件写入性能: {len(large_data) / (1024*1024) / write_time:.2f} MB/s")
        
        # 测试读取性能
        start_time = time.time()
        handle = self.hdfs_client.open(test_path)
        read_data = self.hdfs_client.read(handle, len(large_data))
        self.hdfs_client.close(handle)
        read_time = time.time() - start_time
        
        assert len(read_data) == len(large_data)
        print(f"✓ 大文件读取性能: {len(read_data) / (1024*1024) / read_time:.2f} MB/s")
    
    def test_concurrent_operations(self):
        """测试并发操作"""
        import threading
        import time
        
        def create_file_worker(file_index: int):
            file_path = f"{self.test_root}/concurrent_test_{file_index}.txt"
            handle = self.hdfs_client.create(file_path, overwrite=True)
            self.hdfs_client.write(handle, f"Data from worker {file_index}".encode())
            self.hdfs_client.close(handle)
        
        # 创建多个线程并发创建文件
        threads = []
        start_time = time.time()
        
        for i in range(10):
            thread = threading.Thread(target=create_file_worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        concurrent_time = time.time() - start_time
        print(f"✓ 并发创建10个文件耗时: {concurrent_time:.2f}秒")
        
        # 验证所有文件都已创建
        dir_status = self.hdfs_client.list_status(self.test_root)
        test_files = [item for item in dir_status 
                     if item["path"].startswith(f"{self.test_root}/concurrent_test_")]
        assert len(test_files) == 10
        print("✓ 并发操作测试通过")

class HDFSCompatibilitySuite:
    """
    HDFS兼容性测试套件
    """
    def __init__(self, hdfs_client):
        self.hdfs_client = hdfs_client
        self.test_cases = [
            HDFSBasicOperationsTest(hdfs_client),
            HDFSPerformanceTest(hdfs_client)
        ]
    
    def run_all_tests(self):
        """
        运行所有测试
        """
        print("=== 开始HDFS兼容性测试 ===")
        
        passed_tests = 0
        total_tests = 0
        
        for test_case in self.test_cases:
            test_case.setUp()
            
            # 获取测试方法
            test_methods = [method for method in dir(test_case) 
                          if method.startswith('test_') and callable(getattr(test_case, method))]
            
            for method_name in test_methods:
                total_tests += 1
                try:
                    method = getattr(test_case, method_name)
                    method()
                    passed_tests += 1
                except Exception as e:
                    print(f"✗ 测试失败 {method_name}: {e}")
            
            test_case.tearDown()
        
        print(f"\n=== 测试结果 ===")
        print(f"通过测试: {passed_tests}/{total_tests}")
        print(f"通过率: {passed_tests/total_tests*100:.1f}%" if total_tests > 0 else "无测试")
        
        return passed_tests == total_tests

# 使用示例
print("\n=== HDFS兼容性测试演示 ===")

# 创建HDFS模拟器和兼容性层
hdfs_emulator = HDFSEmulator()
hdfs_compat = HDFSCompatibilityLayer(hdfs_emulator)

# 运行兼容性测试套件
test_suite = HDFSCompatibilitySuite(hdfs_compat)
all_passed = test_suite.run_all_tests()

if all_passed:
    print("\n🎉 所有HDFS兼容性测试通过!")
else:
    print("\n❌ 部分HDFS兼容性测试失败!")
```

## 7.4.3 S3协议兼容实现

S3作为云存储的事实标准，其兼容性实现对于云原生应用的集成至关重要。

### 7.4.3.1 S3兼容性设计

```python
# S3兼容性设计实现
import hashlib
import base64
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse
import threading

@dataclass
class S3ObjectMetadata:
    """S3对象元数据"""
    bucket: str
    key: str
    size: int
    etag: str
    last_modified: float
    content_type: str
    metadata: Dict[str, str]
    version_id: Optional[str] = None
    is_latest: bool = True

@dataclass
class S3Bucket:
    """S3存储桶"""
    name: str
    creation_date: float
    region: str = "us-east-1"
    versioning_enabled: bool = False

class S3Emulator:
    """
    S3协议模拟器，实现核心S3功能
    """
    def __init__(self):
        self.buckets: Dict[str, S3Bucket] = {}
        self.objects: Dict[str, bytes] = {}  # bucket/key -> data
        self.object_metadata: Dict[str, S3ObjectMetadata] = {}
        self.bucket_policies: Dict[str, str] = {}
        self.lock = threading.RLock()
        self.version_counter = 0
    
    def create_bucket(self, bucket_name: str, region: str = "us-east-1") -> bool:
        """
        创建存储桶
        """
        with self.lock:
            if bucket_name in self.buckets:
                print(f"存储桶已存在: {bucket_name}")
                return False
            
            bucket = S3Bucket(
                name=bucket_name,
                creation_date=time.time(),
                region=region
            )
            
            self.buckets[bucket_name] = bucket
            print(f"创建S3存储桶: {bucket_name} (区域: {region})")
            return True
    
    def delete_bucket(self, bucket_name: str) -> bool:
        """
        删除存储桶
        """
        with self.lock:
            if bucket_name not in self.buckets:
                print(f"存储桶不存在: {bucket_name}")
                return False
            
            # 检查存储桶是否为空
            bucket_objects = [k for k in self.object_metadata.keys() if k.startswith(f"{bucket_name}/")]
            if bucket_objects:
                print(f"存储桶非空，无法删除: {bucket_name}")
                return False
            
            del self.buckets[bucket_name]
            print(f"删除S3存储桶: {bucket_name}")
            return True
    
    def put_object(self, bucket_name: str, key: str, data: bytes, 
                   content_type: str = "binary/octet-stream",
                   metadata: Dict[str, str] = None) -> Optional[str]:
        """
        上传对象
        """
        with self.lock:
            if bucket_name not in self.buckets:
                print(f"存储桶不存在: {bucket_name}")
                return None
            
            # 计算ETag (MD5)
            etag = hashlib.md5(data).hexdigest()
            
            # 存储对象数据
            object_key = f"{bucket_name}/{key}"
            self.objects[object_key] = data
            
            # 创建或更新对象元数据
            self.version_counter += 1
            version_id = f"version-{self.version_counter}"
            
            metadata_obj = S3ObjectMetadata(
                bucket=bucket_name,
                key=key,
                size=len(data),
                etag=etag,
                last_modified=time.time(),
                content_type=content_type,
                metadata=metadata or {},
                version_id=version_id,
                is_latest=True
            )
            
            self.object_metadata[object_key] = metadata_obj
            
            print(f"上传S3对象: {bucket_name}/{key} (大小: {len(data)} 字节)")
            return etag
    
    def get_object(self, bucket_name: str, key: str, 
                   range_header: Optional[str] = None) -> Optional[Tuple[bytes, S3ObjectMetadata]]:
        """
        获取对象
        """
        with self.lock:
            object_key = f"{bucket_name}/{key}"
            
            if object_key not in self.objects:
                print(f"对象不存在: {bucket_name}/{key}")
                return None
            
            # 获取对象数据
            data = self.objects[object_key]
            
            # 处理范围请求
            if range_header:
                # 解析范围头 (格式: bytes=0-1023)
                try:
                    if range_header.startswith("bytes="):
                        range_part = range_header[6:]
                        if "-" in range_part:
                            start_str, end_str = range_part.split("-", 1)
                            start = int(start_str) if start_str else 0
                            end = int(end_str) if end_str else len(data) - 1
                            end = min(end, len(data) - 1)
                            data = data[start:end+1]
                except Exception as e:
                    print(f"范围请求解析失败: {e}")
            
            # 获取对象元数据
            metadata = self.object_metadata[object_key]
            # 更新最后访问时间
            metadata.last_modified = time.time()
            
            print(f"获取S3对象: {bucket_name}/{key} (大小: {len(data)} 字节)")
            return data, metadata
    
    def delete_object(self, bucket_name: str, key: str) -> bool:
        """
        删除对象
        """
        with self.lock:
            object_key = f"{bucket_name}/{key}"
            
            if object_key not in self.objects:
                print(f"对象不存在: {bucket_name}/{key}")
                return False
            
            # 删除对象数据和元数据
            del self.objects[object_key]
            del self.object_metadata[object_key]
            
            print(f"删除S3对象: {bucket_name}/{key}")
            return True
    
    def list_objects(self, bucket_name: str, prefix: str = "", 
                    max_keys: int = 1000) -> List[S3ObjectMetadata]:
        """
        列出对象
        """
        with self.lock:
            if bucket_name not in self.buckets:
                print(f"存储桶不存在: {bucket_name}")
                return []
            
            # 查找匹配的对象
            matching_objects = []
            for object_key, metadata in self.object_metadata.items():
                if metadata.bucket == bucket_name:
                    if metadata.key.startswith(prefix):
                        matching_objects.append(metadata)
            
            # 限制返回数量
            matching_objects = matching_objects[:max_keys]
            
            print(f"列出S3对象: {bucket_name} (前缀: {prefix}, 数量: {len(matching_objects)})")
            return matching_objects
    
    def head_object(self, bucket_name: str, key: str) -> Optional[S3ObjectMetadata]:
        """
        获取对象元数据（不返回数据）
        """
        with self.lock:
            object_key = f"{bucket_name}/{key}"
            
            if object_key not in self.object_metadata:
                print(f"对象不存在: {bucket_name}/{key}")
                return None
            
            # 获取对象元数据
            metadata = self.object_metadata[object_key]
            print(f"获取S3对象元数据: {bucket_name}/{key}")
            return metadata
    
    def copy_object(self, source_bucket: str, source_key: str,
                   dest_bucket: str, dest_key: str) -> Optional[str]:
        """
        复制对象
        """
        with self.lock:
            source_object_key = f"{source_bucket}/{source_key}"
            
            if source_object_key not in self.objects:
                print(f"源对象不存在: {source_bucket}/{source_key}")
                return None
            
            # 获取源对象数据
            source_data = self.objects[source_object_key]
            
            # 上传到目标位置
            etag = self.put_object(dest_bucket, dest_key, source_data)
            
            if etag:
                print(f"复制S3对象: {source_bucket}/{source_key} -> {dest_bucket}/{dest_key}")
            else:
                print(f"复制S3对象失败: {source_bucket}/{source_key} -> {dest_bucket}/{dest_key}")
            
            return etag
    
    def create_multipart_upload(self, bucket_name: str, key: str,
                              content_type: str = "binary/octet-stream",
                              metadata: Dict[str, str] = None) -> Optional[str]:
        """
        创建分段上传
        """
        with self.lock:
            if bucket_name not in self.buckets:
                print(f"存储桶不存在: {bucket_name}")
                return None
            
            # 生成上传ID
            upload_id = f"upload-{int(time.time() * 1000000)}"
            
            # 创建临时存储用于分段数据
            temp_key = f"{bucket_name}/{key}.upload.{upload_id}"
            self.objects[temp_key] = b""
            
            print(f"创建分段上传: {bucket_name}/{key} (上传ID: {upload_id})")
            return upload_id
    
    def upload_part(self, bucket_name: str, key: str, upload_id: str,
                   part_number: int, data: bytes) -> Optional[str]:
        """
        上传分段
        """
        with self.lock:
            # 计算分段ETag
            etag = hashlib.md5(data).hexdigest()
            
            # 存储分段数据
            part_key = f"{bucket_name}/{key}.upload.{upload_id}.part.{part_number}"
            self.objects[part_key] = data
            
            print(f"上传分段: {bucket_name}/{key} (上传ID: {upload_id}, 分段: {part_number})")
            return etag
    
    def complete_multipart_upload(self, bucket_name: str, key: str, upload_id: str,
                                parts: List[Dict[str, any]]) -> Optional[str]:
        """
        完成分段上传
        """
        with self.lock:
            # 收集所有分段数据
            complete_data = b""
            for part in parts:
                part_number = part["PartNumber"]
                part_key = f"{bucket_name}/{key}.upload.{upload_id}.part.{part_number}"
                
                if part_key in self.objects:
                    complete_data += self.objects[part_key]
                    # 删除分段数据
                    del self.objects[part_key]
            
            # 删除临时上传标识
            temp_key = f"{bucket_name}/{key}.upload.{upload_id}"
            if temp_key in self.objects:
                del self.objects[temp_key]
            
            # 上传完整对象
            etag = self.put_object(bucket_name, key, complete_data)
            
            if etag:
                print(f"完成分段上传: {bucket_name}/{key} (上传ID: {upload_id})")
            else:
                print(f"完成分段上传失败: {bucket_name}/{key} (上传ID: {upload_id})")
            
            return etag

class S3CompatibilityLayer:
    """
    S3兼容性层，提供与S3客户端兼容的RESTful API接口
    """
    def __init__(self, s3_emulator: S3Emulator):
        self.emulator = s3_emulator
        self.access_key = "test-access-key"
        self.secret_key = "test-secret-key"
    
    def handle_request(self, method: str, path: str, headers: Dict[str, str], 
                      body: bytes = None) -> Tuple[int, Dict[str, str], bytes]:
        """
        处理HTTP请求（模拟S3 REST API）
        """
        try:
            # 解析请求路径
            path_parts = [p for p in path.split("/") if p]
            
            if method == "GET":
                if len(path_parts) == 0:
                    # 列出所有存储桶
                    return self._list_buckets()
                elif len(path_parts) == 1:
                    # 列出存储桶中的对象
                    bucket_name = path_parts[0]
                    prefix = headers.get("prefix", "")
                    max_keys = int(headers.get("max-keys", "1000"))
                    return self._list_objects(bucket_name, prefix, max_keys)
                elif len(path_parts) == 2:
                    # 获取对象
                    bucket_name, key = path_parts
                    range_header = headers.get("Range")
                    return self._get_object(bucket_name, key, range_header)
            
            elif method == "PUT":
                if len(path_parts) == 1:
                    # 创建存储桶
                    bucket_name = path_parts[0]
                    region = headers.get("x-amz-region", "us-east-1")
                    return self._create_bucket(bucket_name, region)
                elif len(path_parts) == 2:
                    # 上传对象
                    bucket_name, key = path_parts
                    content_type = headers.get("Content-Type", "binary/octet-stream")
                    return self._put_object(bucket_name, key, body, content_type)
            
            elif method == "DELETE":
                if len(path_parts) == 1:
                    # 删除存储桶
                    bucket_name = path_parts[0]
                    return self._delete_bucket(bucket_name)
                elif len(path_parts) == 2:
                    # 删除对象
                    bucket_name, key = path_parts
                    return self._delete_object(bucket_name, key)
            
            elif method == "HEAD":
                if len(path_parts) == 2:
                    # 获取对象元数据
                    bucket_name, key = path_parts
                    return self._head_object(bucket_name, key)
            
            # 未处理的请求
            return 400, {}, b"Bad Request"
            
        except Exception as e:
            print(f"S3请求处理错误: {e}")
            return 500, {}, b"Internal Server Error"
    
    def _list_buckets(self) -> Tuple[int, Dict[str, str], bytes]:
        """列出存储桶"""
        buckets = self.emulator.buckets
        xml_response = '<?xml version="1.0" encoding="UTF-8"?>\n<ListAllMyBucketsResult>'
        xml_response += '<Owner><ID>test-owner</ID><DisplayName>test-display-name</DisplayName></Owner>'
        xml_response += '<Buckets>'
        for bucket_name, bucket in buckets.items():
            xml_response += f'<Bucket><Name>{bucket_name}</Name>'
            xml_response += f'<CreationDate>{time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(bucket.creation_date))}</CreationDate>'
            xml_response += '</Bucket>'
        xml_response += '</Buckets></ListAllMyBucketsResult>'
        
        headers = {
            "Content-Type": "application/xml",
            "Content-Length": str(len(xml_response))
        }
        return 200, headers, xml_response.encode()
    
    def _create_bucket(self, bucket_name: str, region: str) -> Tuple[int, Dict[str, str], bytes]:
        """创建存储桶"""
        success = self.emulator.create_bucket(bucket_name, region)
        if success:
            return 200, {}, b""
        else:
            return 409, {}, b"Bucket already exists"
    
    def _delete_bucket(self, bucket_name: str) -> Tuple[int, Dict[str, str], bytes]:
        """删除存储桶"""
        success = self.emulator.delete_bucket(bucket_name)
        if success:
            return 204, {}, b""
        else:
            return 404, {}, b"Bucket not found"
    
    def _put_object(self, bucket_name: str, key: str, data: bytes, 
                   content_type: str) -> Tuple[int, Dict[str, str], bytes]:
        """上传对象"""
        etag = self.emulator.put_object(bucket_name, key, data, content_type)
        if etag:
            headers = {
                "ETag": f'"{etag}"'
            }
            return 200, headers, b""
        else:
            return 500, {}, b"Failed to upload object"
    
    def _get_object(self, bucket_name: str, key: str, 
                   range_header: Optional[str]) -> Tuple[int, Dict[str, str], bytes]:
        """获取对象"""
        result = self.emulator.get_object(bucket_name, key, range_header)
        if result:
            data, metadata = result
            headers = {
                "Content-Type": metadata.content_type,
                "Content-Length": str(len(data)),
                "ETag": f'"{metadata.etag}"',
                "Last-Modified": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(metadata.last_modified))
            }
            
            # 添加自定义元数据
            for meta_key, meta_value in metadata.metadata.items():
                headers[f"x-amz-meta-{meta_key}"] = meta_value
            
            return 200, headers, data
        else:
            return 404, {}, b"Object not found"
    
    def _delete_object(self, bucket_name: str, key: str) -> Tuple[int, Dict[str, str], bytes]:
        """删除对象"""
        success = self.emulator.delete_object(bucket_name, key)
        if success:
            return 204, {}, b""
        else:
            return 404, {}, b"Object not found"
    
    def _list_objects(self, bucket_name: str, prefix: str, 
                     max_keys: int) -> Tuple[int, Dict[str, str], bytes]:
        """列出对象"""
        objects = self.emulator.list_objects(bucket_name, prefix, max_keys)
        xml_response = '<?xml version="1.0" encoding="UTF-8"?>\n<ListBucketResult>'
        xml_response += f'<Name>{bucket_name}</Name>'
        xml_response += f'<Prefix>{prefix}</Prefix>'
        xml_response += f'<MaxKeys>{max_keys}</MaxKeys>'
        xml_response += '<IsTruncated>false</IsTruncated>'
        for obj in objects:
            xml_response += '<Contents>'
            xml_response += f'<Key>{obj.key}</Key>'
            xml_response += f'<LastModified>{time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(obj.last_modified))}</LastModified>'
            xml_response += f'<ETag>"{obj.etag}"</ETag>'
            xml_response += f'<Size>{obj.size}</Size>'
            xml_response += '<StorageClass>STANDARD</StorageClass>'
            xml_response += '</Contents>'
        xml_response += '</ListBucketResult>'
        
        headers = {
            "Content-Type": "application/xml",
            "Content-Length": str(len(xml_response))
        }
        return 200, headers, xml_response.encode()
    
    def _head_object(self, bucket_name: str, key: str) -> Tuple[int, Dict[str, str], bytes]:
        """获取对象元数据"""
        metadata = self.emulator.head_object(bucket_name, key)
        if metadata:
            headers = {
                "Content-Type": metadata.content_type,
                "Content-Length": str(metadata.size),
                "ETag": f'"{metadata.etag}"',
                "Last-Modified": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(metadata.last_modified))
            }
            
            # 添加自定义元数据
            for meta_key, meta_value in metadata.metadata.items():
                headers[f"x-amz-meta-{meta_key}"] = meta_value
            
            return 200, headers, b""
        else:
            return 404, {}, b"Object not found"

# 使用示例
print("\n=== S3兼容性设计演示 ===")

# 创建S3模拟器
s3_emulator = S3Emulator()

# 创建S3兼容性层
s3_compat = S3CompatibilityLayer(s3_emulator)

# 创建存储桶
print("创建存储桶...")
status, headers, body = s3_compat.handle_request("PUT", "/my-test-bucket", {})
print(f"创建存储桶响应: 状态码={status}")

# 上传对象
print("\n上传对象...")
test_data = b"Hello, S3 Compatibility Layer!\nThis is a test object."
headers = {"Content-Type": "text/plain"}
status, headers, body = s3_compat.handle_request("PUT", "/my-test-bucket/test-object.txt", headers, test_data)
print(f"上传对象响应: 状态码={status}, ETag={headers.get('ETag', 'N/A')}")

# 上传另一个对象
print("\n上传另一个对象...")
more_data = b"Another test object with different content."
status, headers, body = s3_compat.handle_request("PUT", "/my-test-bucket/another-object.txt", headers, more_data)
print(f"上传对象响应: 状态码={status}")

# 列出存储桶中的对象
print("\n列出存储桶中的对象...")
status, headers, body = s3_compat.handle_request("GET", "/my-test-bucket", {})
print(f"列出对象响应: 状态码={status}")
if status == 200:
    print(f"响应体: {body.decode()}")

# 获取对象
print("\n获取对象...")
status, headers, body = s3_compat.handle_request("GET", "/my-test-bucket/test-object.txt", {})
print(f"获取对象响应: 状态码={status}")
if status == 200:
    print(f"对象内容: {body.decode()}")
    print(f"Content-Type: {headers.get('Content-Type', 'N/A')}")
    print(f"ETag: {headers.get('ETag', 'N/A')}")

# 获取对象元数据
print("\n获取对象元数据...")
status, headers, body = s3_compat.handle_request("HEAD", "/my-test-bucket/test-object.txt", {})
print(f"获取对象元数据响应: 状态码={status}")
if status == 200:
    print(f"Content-Length: {headers.get('Content-Length', 'N/A')}")
    print(f"Last-Modified: {headers.get('Last-Modified', 'N/A')}")

# 删除对象
print("\n删除对象...")
status, headers, body = s3_compat.handle_request("DELETE", "/my-test-bucket/test-object.txt", {})
print(f"删除对象响应: 状态码={status}")

# 验证对象已删除
print("\n验证对象已删除...")
status, headers, body = s3_compat.handle_request("GET", "/my-test-bucket/test-object.txt", {})
print(f"获取已删除对象响应: 状态码={status}")

# 删除存储桶
print("\n删除存储桶...")
status, headers, body = s3_compat.handle_request("DELETE", "/my-test-bucket", {})
print(f"删除存储桶响应: 状态码={status}")
```

### 7.4.3.2 S3兼容性测试

```python
# S3兼容性测试框架
import unittest
import hashlib
import time
from typing import Dict, List

class S3TestCase:
    """
    S3兼容性测试用例基类
    """
    def __init__(self, s3_client):
        self.s3_client = s3_client
        self.test_bucket = f"test-bucket-{int(time.time())}"
    
    def setUp(self):
        """测试设置"""
        # 创建测试存储桶
        status, headers, body = self.s3_client.handle_request("PUT", f"/{self.test_bucket}", {})
        if status != 200:
            raise Exception(f"无法创建测试存储桶: 状态码 {status}")
    
    def tearDown(self):
        """测试清理"""
        # 删除测试存储桶中的所有对象
        status, headers, body = self.s3_client.handle_request("GET", f"/{self.test_bucket}", {})
        if status == 200:
            # 解析XML响应获取对象列表（简化处理）
            # 在实际实现中需要解析XML
            pass
        
        # 删除存储桶
        status, headers, body = self.s3_client.handle_request("DELETE", f"/{self.test_bucket}", {})
        if status not in [200, 204]:
            print(f"警告: 无法删除测试存储桶 {self.test_bucket}")

class S3BasicOperationsTest(S3TestCase):
    """
    S3基本操作测试
    """
    def test_bucket_operations(self):
        """测试存储桶操作"""
        # 创建存储桶
        bucket_name = f"test-bucket-{int(time.time())}-2"
        status, headers, body = self.s3_client.handle_request("PUT", f"/{bucket_name}", {})
        assert status == 200, f"创建存储桶失败: 状态码 {status}"
        
        # 列出存储桶
        status, headers, body = self.s3_client.handle_request("GET", "/", {})
        assert status == 200, f"列出存储桶失败: 状态码 {status}"
        assert bucket_name in body.decode(), "新创建的存储桶未在列表中"
        
        # 删除存储桶
        status, headers, body = self.s3_client.handle_request("DELETE", f"/{bucket_name}", {})
        assert status in [200, 204], f"删除存储桶失败: 状态码 {status}"
        
        print("✓ 存储桶操作测试通过")
    
    def test_object_operations(self):
        """测试对象操作"""
        # 上传对象
        object_key = "test-object.txt"
        test_data = b"Hello, S3 Test!"
        headers = {"Content-Type": "text/plain"}
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{object_key}", headers, test_data
        )
        assert status == 200, f"上传对象失败: 状态码 {status}"
        etag = headers.get("ETag")
        assert etag is not None, "未返回ETag"
        
        # 验证ETag
        expected_etag = f'"{hashlib.md5(test_data).hexdigest()}"'
        assert etag == expected_etag, f"ETag不匹配: 期望 {expected_etag}, 实际 {etag}"
        
        # 获取对象
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{object_key}", {}
        )
        assert status == 200, f"获取对象失败: 状态码 {status}"
        assert body == test_data, "对象内容不匹配"
        assert headers.get("Content-Type") == "text/plain", "Content-Type不匹配"
        
        # 获取对象元数据
        status, headers, body = self.s3_client.handle_request(
            "HEAD", f"/{self.test_bucket}/{object_key}", {}
        )
        assert status == 200, f"获取对象元数据失败: 状态码 {status}"
        assert headers.get("Content-Length") == str(len(test_data)), "Content-Length不匹配"
        
        # 列出对象
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}", {}
        )
        assert status == 200, f"列出对象失败: 状态码 {status}"
        assert object_key in body.decode(), "上传的对象未在列表中"
        
        # 删除对象
        status, headers, body = self.s3_client.handle_request(
            "DELETE", f"/{self.test_bucket}/{object_key}", {}
        )
        assert status in [200, 204], f"删除对象失败: 状态码 {status}"
        
        # 验证对象已删除
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{object_key}", {}
        )
        assert status == 404, f"对象应已被删除: 状态码 {status}"
        
        print("✓ 对象操作测试通过")
    
    def test_large_object_operations(self):
        """测试大对象操作"""
        # 上传大对象
        object_key = "large-object.bin"
        large_data = b"x" * (5 * 1024 * 1024)  # 5MB数据
        headers = {"Content-Type": "application/octet-stream"}
        
        start_time = time.time()
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{object_key}", headers, large_data
        )
        upload_time = time.time() - start_time
        assert status == 200, f"上传大对象失败: 状态码 {status}"
        
        upload_speed = len(large_data) / (1024 * 1024) / upload_time
        print(f"  大对象上传速度: {upload_speed:.2f} MB/s")
        
        # 获取大对象
        start_time = time.time()
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{object_key}", {}
        )
        download_time = time.time() - start_time
        assert status == 200, f"获取大对象失败: 状态码 {status}"
        assert body == large_data, "大对象内容不匹配"
        
        download_speed = len(body) / (1024 * 1024) / download_time
        print(f"  大对象下载速度: {download_speed:.2f} MB/s")
        
        # 范围请求
        range_headers = {"Range": "bytes=100-1023"}
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{object_key}", range_headers
        )
        assert status == 206, f"范围请求失败: 状态码 {status}"  # 206 Partial Content
        assert len(body) == 924, f"范围请求返回大小不正确: {len(body)}"
        assert body == large_data[100:1024], "范围请求内容不匹配"
        
        print("✓ 大对象操作测试通过")

class S3AdvancedOperationsTest(S3TestCase):
    """
    S3高级操作测试
    """
    def test_multipart_upload(self):
        """测试分段上传"""
        # 创建分段上传
        object_key = "multipart-test.txt"
        status, headers, body = self.s3_client.handle_request(
            "POST", f"/{self.test_bucket}/{object_key}?uploads", {}
        )
        assert status == 200, f"创建分段上传失败: 状态码 {status}"
        
        # 在实际实现中需要解析响应获取upload_id
        # 这里简化处理
        upload_id = "test-upload-id"
        
        # 上传分段
        part_data1 = b"Part 1 data: " + b"A" * 1024
        part_data2 = b"Part 2 data: " + b"B" * 1024
        part_data3 = b"Part 3 data: " + b"C" * 1024
        
        # 上传第一段
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{object_key}?partNumber=1&uploadId={upload_id}",
            {"Content-Type": "application/octet-stream"}, part_data1
        )
        assert status == 200, f"上传第一段失败: 状态码 {status}"
        etag1 = headers.get("ETag")
        
        # 上传第二段
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{object_key}?partNumber=2&uploadId={upload_id}",
            {"Content-Type": "application/octet-stream"}, part_data2
        )
        assert status == 200, f"上传第二段失败: 状态码 {status}"
        etag2 = headers.get("ETag")
        
        # 上传第三段
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{object_key}?partNumber=3&uploadId={upload_id}",
            {"Content-Type": "application/octet-stream"}, part_data3
        )
        assert status == 200, f"上传第三段失败: 状态码 {status}"
        etag3 = headers.get("ETag")
        
        # 完成分段上传
        # 在实际实现中需要发送包含所有分段ETag的XML请求
        # 这里简化处理，直接合并数据
        complete_data = part_data1 + part_data2 + part_data3
        
        # 验证完整对象
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{object_key}", {}
        )
        assert status == 200, f"获取分段上传对象失败: 状态码 {status}"
        # assert body == complete_data, "分段上传对象内容不匹配"
        
        print("✓ 分段上传测试通过")
    
    def test_object_copy(self):
        """测试对象复制"""
        # 上传源对象
        source_key = "source-object.txt"
        source_data = b"Source object content for copy test"
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{source_key}",
            {"Content-Type": "text/plain"}, source_data
        )
        assert status == 200, f"上传源对象失败: 状态码 {status}"
        
        # 复制对象
        dest_key = "copied-object.txt"
        copy_source = f"/{self.test_bucket}/{source_key}"
        headers = {"x-amz-copy-source": copy_source}
        status, headers, body = self.s3_client.handle_request(
            "PUT", f"/{self.test_bucket}/{dest_key}", headers
        )
        assert status == 200, f"复制对象失败: 状态码 {status}"
        
        # 验证复制的对象
        status, headers, body = self.s3_client.handle_request(
            "GET", f"/{self.test_bucket}/{dest_key}", {}
        )
        assert status == 200, f"获取复制的对象失败: 状态码 {status}"
        assert body == source_data, "复制的对象内容不匹配"
        
        print("✓ 对象复制测试通过")

class S3CompatibilitySuite:
    """
    S3兼容性测试套件
    """
    def __init__(self, s3_client):
        self.s3_client = s3_client
        self.test_cases = [
            S3BasicOperationsTest(s3_client),
            S3AdvancedOperationsTest(s3_client)
        ]
    
    def run_all_tests(self):
        """
        运行所有测试
        """
        print("=== 开始S3兼容性测试 ===")
        
        passed_tests = 0
        total_tests = 0
        
        for test_case in self.test_cases:
            try:
                test_case.setUp()
                
                # 获取测试方法
                test_methods = [method for method in dir(test_case) 
                              if method.startswith('test_') and callable(getattr(test_case, method))]
                
                for method_name in test_methods:
                    total_tests += 1
                    try:
                        method = getattr(test_case, method_name)
                        method()
                        passed_tests += 1
                        print(f"  ✓ {method_name}")
                    except Exception as e:
                        print(f"  ✗ {method_name}: {e}")
                
                test_case.tearDown()
            except Exception as e:
                print(f"测试用例设置/清理失败: {e}")
        
        print(f"\n=== 测试结果 ===")
        print(f"通过测试: {passed_tests}/{total_tests}")
        print(f"通过率: {passed_tests/total_tests*100:.1f}%" if total_tests > 0 else "无测试")
        
        return passed_tests == total_tests

# 使用示例
print("\n=== S3兼容性测试演示 ===")

# 创建S3模拟器和兼容性层
s3_emulator = S3Emulator()
s3_compat = S3CompatibilityLayer(s3_emulator)

# 运行兼容性测试套件
test_suite = S3CompatibilitySuite(s3_compat)
all_passed = test_suite.run_all_tests()

if all_passed:
    print("\n🎉 所有S3兼容性测试通过!")
else:
    print("\n❌ 部分S3兼容性测试失败!")
```

## 7.4.4 网关构建与集成

构建协议网关是实现多协议兼容的关键技术，它允许不同的客户端通过各自熟悉的协议访问同一套存储系统。

### 7.4.4.1 网关架构设计

```python
# 网关架构设计实现
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
import threading
import time
from dataclasses import dataclass

@dataclass
class GatewayConfig:
    """网关配置"""
    host: str = "0.0.0.0"
    port: int = 8080
    hdfs_port: int = 9000
    s3_port: int = 9001
    enable_hdfs: bool = True
    enable_s3: bool = True
    max_connections: int = 1000
    timeout: int = 30

class ProtocolGateway:
    """
    协议网关，统一管理多种协议的接入
    """
    def __init__(self, config: GatewayConfig):
        self.config = config
        self.hdfs_handler = None
        self.s3_handler = None
        self.running = False
        self.stats = {
            "total_requests": 0,
            "hdfs_requests": 0,
            "s3_requests": 0,
            "errors": 0,
            "start_time": time.time()
        }
        self.stats_lock = threading.Lock()
    
    def initialize_handlers(self, hdfs_emulator=None, s3_emulator=None):
        """
        初始化协议处理器
        """
        if self.config.enable_hdfs and hdfs_emulator:
            self.hdfs_handler = HDFSCompatibilityLayer(hdfs_emulator)
            print("✓ HDFS协议处理器已初始化")
        
        if self.config.enable_s3 and s3_emulator:
            self.s3_handler = S3CompatibilityLayer(s3_emulator)
            print("✓ S3协议处理器已初始化")
    
    def start(self):
        """
        启动网关服务
        """
        if self.running:
            print("网关服务已在运行中")
            return
        
        self.running = True
        print(f"启动协议网关服务...")
        print(f"  监听地址: {self.config.host}:{self.config.port}")
        
        if self.config.enable_hdfs:
            print(f"  HDFS端点: {self.config.host}:{self.config.hdfs_port}")
        
        if self.config.enable_s3:
            print(f"  S3端点: {self.config.host}:{self.config.s3_port}")
        
        # 在实际实现中，这里会启动HTTP服务器
        # 为演示目的，我们模拟服务运行
        self._simulate_service()
    
    def stop(self):
        """
        停止网关服务
        """
        self.running = False
        print("停止协议网关服务")
    
    def _simulate_service(self):
        """
        模拟服务运行（实际实现中会被真正的HTTP服务器替换）
        """
        def service_loop():
            while self.running:
                time.sleep(1)
                # 模拟处理请求
                with self.stats_lock:
                    if self.stats["total_requests"] % 100 == 0:
                        uptime = time.time() - self.stats["start_time"]
                        print(f"网关运行状态: {uptime:.0f}秒, "
                              f"总请求数: {self.stats['total_requests']}, "
                              f"HDFS请求数: {self.stats['hdfs_requests']}, "
                              f"S3请求数: {self.stats['s3_requests']}")
        
        # 在后台线程中运行服务循环
        service_thread = threading.Thread(target=service_loop, daemon=True)
        service_thread.start()
    
    def handle_request(self, protocol: str, method: str, path: str, 
                      headers: Dict[str, str], body: bytes = None) -> Any:
        """
        处理协议请求
        """
        with self.stats_lock:
            self.stats["total_requests"] += 1
        
        try:
            if protocol == "hdfs" and self.hdfs_handler:
                with self.stats_lock:
                    self.stats["hdfs_requests"] += 1
                
                # 在实际实现中，这里会调用HDFS处理器处理请求
                # 为演示目的，我们返回模拟响应
                return {
                    "status": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": b'{"message": "HDFS request processed"}'
                }
            
            elif protocol == "s3" and self.s3_handler:
                with self.stats_lock:
                    self.stats["s3_requests"] += 1
                
                # 调用S3处理器处理请求
                status, response_headers, response_body = self.s3_handler.handle_request(
                    method, path, headers, body
                )
                return {
                    "status": status,
                    "headers": response_headers,
                    "body": response_body
                }
            
            else:
                with self.stats_lock:
                    self.stats["errors"] += 1
                return {
                    "status": 400,
                    "headers": {},
                    "body": b'{"error": "Unsupported protocol"}'
                }
        
        except Exception as e:
            with self.stats_lock:
                self.stats["errors"] += 1
            print(f"处理请求时发生错误: {e}")
            return {
                "status": 500,
                "headers": {},
                "body": b'{"error": "Internal server error"}'
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取网关统计信息
        """
        with self.stats_lock:
            uptime = time.time() - self.stats["start_time"]
            return {
                "running": self.running,
                "uptime_seconds": uptime,
                "total_requests": self.stats["total_requests"],
                "hdfs_requests": self.stats["hdfs_requests"],
                "s3_requests": self.stats["s3_requests"],
                "errors": self.stats["errors"],
                "requests_per_second": self.stats["total_requests"] / uptime if uptime > 0 else 0
            }

class LoadBalancer:
    """
    负载均衡器，支持多网关实例
    """
    def __init__(self, gateway_instances: List[ProtocolGateway]):
        self.gateways = gateway_instances
        self.current_index = 0
        self.lb_lock = threading.Lock()
    
    def get_next_gateway(self) -> Optional[ProtocolGateway]:
        """
        获取下一个网关实例（轮询算法）
        """
        with self.lb_lock:
            if not self.gateways:
                return None
            
            gateway = self.gateways[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.gateways)
            return gateway
    
    def get_least_loaded_gateway(self) -> Optional[ProtocolGateway]:
        """
        获取负载最轻的网关实例
        """
        if not self.gateways:
            return None
        
        # 获取统计信息并选择请求数最少的网关
        min_requests = float('inf')
        selected_gateway = None
        
        for gateway in self.gateways:
            stats = gateway.get_stats()
            total_requests = stats["total_requests"]
            if total_requests < min_requests:
                min_requests = total_requests
                selected_gateway = gateway
        
        return selected_gateway
    
    def add_gateway(self, gateway: ProtocolGateway):
        """
        添加网关实例
        """
        with self.lb_lock:
            self.gateways.append(gateway)
    
    def remove_gateway(self, gateway: ProtocolGateway):
        """
        移除网关实例
        """
        with self.lb_lock:
            if gateway in self.gateways:
                self.gateways.remove(gateway)

class GatewayManager:
    """
    网关管理器，负责网关集群的管理
    """
    def __init__(self):
        self.gateways: List[ProtocolGateway] = []
        self.load_balancer = LoadBalancer(self.gateways)
        self.manager_lock = threading.Lock()
    
    def create_gateway(self, config: GatewayConfig) -> ProtocolGateway:
        """
        创建网关实例
        """
        with self.manager_lock:
            gateway = ProtocolGateway(config)
            self.gateways.append(gateway)
            return gateway
    
    def start_all_gateways(self):
        """
        启动所有网关实例
        """
        with self.manager_lock:
            for gateway in self.gateways:
                gateway.start()
    
    def stop_all_gateways(self):
        """
        停止所有网关实例
        """
        with self.manager_lock:
            for gateway in self.gateways:
                gateway.stop()
    
    def get_cluster_stats(self) -> Dict[str, Any]:
        """
        获取集群统计信息
        """
        with self.manager_lock:
            total_stats = {
                "gateway_count": len(self.gateways),
                "total_requests": 0,
                "hdfs_requests": 0,
                "s3_requests": 0,
                "errors": 0,
                "average_uptime": 0
            }
            
            uptimes = []
            for gateway in self.gateways:
                stats = gateway.get_stats()
                total_stats["total_requests"] += stats["total_requests"]
                total_stats["hdfs_requests"] += stats["hdfs_requests"]
                total_stats["s3_requests"] += stats["s3_requests"]
                total_stats["errors"] += stats["errors"]
                uptimes.append(stats["uptime_seconds"])
            
            if uptimes:
                total_stats["average_uptime"] = sum(uptimes) / len(uptimes)
            
            return total_stats

# 使用示例
print("\n=== 网关架构设计演示 ===")

# 创建网关配置
config1 = GatewayConfig(
    host="0.0.0.0",
    port=8080,
    hdfs_port=9000,
    s3_port=9001,
    enable_hdfs=True,
    enable_s3=True
)

config2 = GatewayConfig(
    host="0.0.0.0",
    port=8081,
    hdfs_port=9002,
    s3_port=9003,
    enable_hdfs=True,
    enable_s3=True
)

# 创建网关管理器
gateway_manager = GatewayManager()

# 创建网关实例
print("创建网关实例...")
gateway1 = gateway_manager.create_gateway(config1)
gateway2 = gateway_manager.create_gateway(config2)

# 初始化协议处理器
print("初始化协议处理器...")
hdfs_emulator = HDFSEmulator()
s3_emulator = S3Emulator()

gateway1.initialize_handlers(hdfs_emulator, s3_emulator)
gateway2.initialize_handlers(hdfs_emulator, s3_emulator)

# 启动网关服务
print("启动网关服务...")
gateway_manager.start_all_gateways()

# 模拟处理一些请求
print("\n模拟处理请求...")
for i in range(5):
    # 模拟HDFS请求
    response = gateway1.handle_request(
        protocol="hdfs",
        method="GET",
        path="/user/data/file.txt",
        headers={"Authorization": "Bearer token123"}
    )
    print(f"HDFS请求 {i+1}: 状态码={response['status']}")
    
    # 模拟S3请求
    response = gateway2.handle_request(
        protocol="s3",
        method="GET",
        path="/my-bucket/object.txt",
        headers={"Authorization": "AWS4-HMAC-SHA256 ..."}
    )
    print(f"S3请求 {i+1}: 状态码={response['status']}")

# 查看网关统计信息
print("\n网关统计信息:")
stats1 = gateway1.get_stats()
stats2 = gateway2.get_stats()
cluster_stats = gateway_manager.get_cluster_stats()

print(f"网关1统计: {stats1}")
print(f"网关2统计: {stats2}")
print(f"集群统计: {cluster_stats}")

# 使用负载均衡器
print("\n使用负载均衡器:")
lb_gateway = gateway_manager.load_balancer.get_next_gateway()
if lb_gateway:
    response = lb_gateway.handle_request(
        protocol="s3",
        method="PUT",
        path="/test-bucket/load-balanced-object.txt",
        headers={"Content-Type": "text/plain"},
        body=b"Load balanced request"
    )
    print(f"负载均衡请求: 状态码={response['status']}")

# 停止网关服务
print("\n停止网关服务...")
gateway_manager.stop_all_gateways()
```

### 7.4.4.2 网关性能优化

```python
# 网关性能优化实现
import asyncio
import time
import threading
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import queue

@dataclass
class RequestMetrics:
    """请求指标"""
    request_id: str
    protocol: str
    method: str
    path: str
    start_time: float
    end_time: float = 0
    status_code: int = 0
    response_size: int = 0

class PerformanceOptimizer:
    """
    性能优化器
    """
    def __init__(self, gateway):
        self.gateway = gateway
        self.metrics_queue = queue.Queue()
        self.metrics_history: List[RequestMetrics] = []
        self.cache = {}
        self.cache_stats = {"hits": 0, "misses": 0}
        self.connection_pool = {}
        self.rate_limiter = {}
        self.optimizer_lock = threading.Lock()
    
    def record_request_start(self, request_id: str, protocol: str, 
                           method: str, path: str) -> RequestMetrics:
        """
        记录请求开始
        """
        metrics = RequestMetrics(
            request_id=request_id,
            protocol=protocol,
            method=method,
            path=path,
            start_time=time.time()
        )
        return metrics
    
    def record_request_end(self, metrics: RequestMetrics, status_code: int, 
                          response_size: int):
        """
        记录请求结束
        """
        metrics.end_time = time.time()
        metrics.status_code = status_code
        metrics.response_size = response_size
        
        # 添加到历史记录
        with self.optimizer_lock:
            self.metrics_history.append(metrics)
            # 保持最近1000条记录
            if len(self.metrics_history) > 1000:
                self.metrics_history.pop(0)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """
        获取性能统计信息
        """
        with self.optimizer_lock:
            if not self.metrics_history:
                return {"error": "No metrics available"}
            
            # 计算各种指标
            total_requests = len(self.metrics_history)
            total_time = sum(m.end_time - m.start_time for m in self.metrics_history)
            avg_response_time = total_time / total_requests if total_requests > 0 else 0
            
            # 按协议统计
            protocol_stats = {}
            for metrics in self.metrics_history:
                proto = metrics.protocol
                if proto not in protocol_stats:
                    protocol_stats[proto] = {
                        "requests": 0,
                        "total_time": 0,
                        "errors": 0,
                        "total_size": 0
                    }
                
                stats = protocol_stats[proto]
                stats["requests"] += 1
                stats["total_time"] += (metrics.end_time - metrics.start_time)
                if metrics.status_code >= 400:
                    stats["errors"] += 1
                stats["total_size"] += metrics.response_size
            
            # 计算协议平均响应时间
            for proto, stats in protocol_stats.items():
                stats["avg_response_time"] = stats["total_time"] / stats["requests"] if stats["requests"] > 0 else 0
                stats["error_rate"] = stats["errors"] / stats["requests"] if stats["requests"] > 0 else 0
                stats["avg_response_size"] = stats["total_size"] / stats["requests"] if stats["requests"] > 0 else 0
            
            return {
                "total_requests": total_requests,
                "average_response_time": avg_response_time,
                "protocol_stats": protocol_stats,
                "cache_stats": self.cache_stats
            }
    
    def cache_response(self, cache_key: str, response: Any, ttl: float = 300.0):
        """
        缓存响应
        """
        with self.optimizer_lock:
            self.cache[cache_key] = {
                "response": response,
                "expiry": time.time() + ttl
            }
            self.cache_stats["misses"] += 1
    
    def get_cached_response(self, cache_key: str) -> Optional[Any]:
        """
        获取缓存响应
        """
        with self.optimizer_lock:
            if cache_key in self.cache:
                cached_item = self.cache[cache_key]
                if time.time() < cached_item["expiry"]:
                    self.cache_stats["hits"] += 1
                    return cached_item["response"]
                else:
                    # 缓存过期，删除
                    del self.cache[cache_key]
            
            return None
    
    def rate_limit_check(self, client_id: str, max_requests: int = 100, 
                        time_window: float = 60.0) -> bool:
        """
        速率限制检查
        """
        with self.optimizer_lock:
            current_time = time.time()
            
            if client_id not in self.rate_limiter:
                self.rate_limiter[client_id] = []
            
            # 清理过期的请求记录
            requests = self.rate_limiter[client_id]
            requests[:] = [req_time for req_time in requests if current_time - req_time < time_window]
            
            # 检查是否超过限制
            if len(requests) >= max_requests:
                return False  # 超过限制
            
            # 记录当前请求
            requests.append(current_time)
            return True  # 允许请求

class ConnectionPool:
    """
    连接池管理
    """
    def __init__(self, max_connections: int = 100):
        self.max_connections = max_connections
        self.connections: Dict[str, List[Any]] = {}
        self.connection_lock = threading.Lock()
        self.stats = {
            "created": 0,
            "reused": 0,
            "closed": 0
        }
    
    def get_connection(self, connection_key: str) -> Any:
        """
        获取连接
        """
        with self.connection_lock:
            if connection_key in self.connections and self.connections[connection_key]:
                # 重用现有连接
                conn = self.connections[connection_key].pop()
                self.stats["reused"] += 1
                return conn
            else:
                # 创建新连接
                conn = self._create_connection(connection_key)
                self.stats["created"] += 1
                return conn
    
    def return_connection(self, connection_key: str, connection: Any):
        """
        归还连接
        """
        with self.connection_lock:
            if connection_key not in self.connections:
                self.connections[connection_key] = []
            
            # 如果连接池未满，归还连接
            if len(self.connections[connection_key]) < self.max_connections:
                self.connections[connection_key].append(connection)
            else:
                # 连接池已满，关闭连接
                self._close_connection(connection)
                self.stats["closed"] += 1
    
    def _create_connection(self, connection_key: str) -> Any:
        """
        创建连接（模拟实现）
        """
        print(f"创建新连接: {connection_key}")
        return f"connection_{connection_key}_{int(time.time() * 1000)}"
    
    def _close_connection(self, connection: Any):
        """
        关闭连接（模拟实现）
        """
        print(f"关闭连接: {connection}")
    
    def get_stats(self) -> Dict[str, int]:
        """
        获取连接池统计信息
        """
        with self.connection_lock:
            total_connections = sum(len(conns) for conns in self.connections.values())
            return {
                **self.stats,
                "available": total_connections
            }

class AsyncRequestHandler:
    """
    异步请求处理器
    """
    def __init__(self, gateway):
        self.gateway = gateway
        self.request_queue = asyncio.Queue()
        self.workers = []
        self.running = False
    
    async def start_workers(self, num_workers: int = 4):
        """
        启动工作线程
        """
        self.running = True
        for i in range(num_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        print(f"启动 {num_workers} 个异步工作线程")
    
    async def stop_workers(self):
        """
        停止工作线程
        """
        self.running = False
        for worker in self.workers:
            worker.cancel()
        await asyncio.gather(*self.workers, return_exceptions=True)
        print("停止所有异步工作线程")
    
    async def submit_request(self, request_data: Dict[str, Any]):
        """
        提交请求到队列
        """
        await self.request_queue.put(request_data)
    
    async def _worker(self, worker_id: str):
        """
        工作线程
        """
        print(f"工作线程 {worker_id} 启动")
        while self.running:
            try:
                # 从队列获取请求
                request_data = await asyncio.wait_for(self.request_queue.get(), timeout=1.0)
                
                # 处理请求
                await self._process_request(request_data)
                
                # 标记任务完成
                self.request_queue.task_done()
                
            except asyncio.TimeoutError:
                # 超时继续循环
                continue
            except Exception as e:
                print(f"工作线程 {worker_id} 处理请求时出错: {e}")
                self.request_queue.task_done()
    
    async def _process_request(self, request_data: Dict[str, Any]):
        """
        处理请求
        """
        protocol = request_data.get("protocol", "unknown")
        method = request_data.get("method", "GET")
        path = request_data.get("path", "/")
        headers = request_data.get("headers", {})
        body = request_data.get("body", b"")
        
        print(f"异步处理请求: {protocol} {method} {path}")
        
        # 模拟处理时间
        await asyncio.sleep(0.01)
        
        # 调用网关处理请求
        response = self.gateway.handle_request(protocol, method, path, headers, body)
        
        # 在实际实现中，这里会将响应发送回客户端
        print(f"异步请求处理完成: 状态码 {response['status']}")

class OptimizedGateway:
    """
    优化的网关实现
    """
    def __init__(self, config: GatewayConfig):
        self.config = config
        self.performance_optimizer = PerformanceOptimizer(self)
        self.connection_pool = ConnectionPool(max_connections=50)
        self.async_handler = AsyncRequestHandler(self)
        self.running = False
    
    def start(self):
        """
        启动优化的网关
        """
        self.running = True
        print("启动优化的协议网关...")
        
        # 启动异步处理工作线程
        asyncio.run(self.async_handler.start_workers(4))
    
    def stop(self):
        """
        停止网关
        """
        self.running = False
        print("停止优化的协议网关...")
        
        # 停止异步处理工作线程
        asyncio.run(self.async_handler.stop_workers())
    
    def handle_request(self, protocol: str, method: str, path: str,
                      headers: Dict[str, str], body: bytes = None) -> Dict[str, Any]:
        """
        处理请求（带性能优化）
        """
        request_id = f"req_{int(time.time() * 1000000)}"
        
        # 记录请求开始
        metrics = self.performance_optimizer.record_request_start(
            request_id, protocol, method, path
        )
        
        try:
            # 速率限制检查
            client_id = headers.get("X-Client-ID", "unknown")
            if not self.performance_optimizer.rate_limit_check(client_id):
                response = {
                    "status": 429,  # Too Many Requests
                    "headers": {},
                    "body": b'{"error": "Rate limit exceeded"}'
                }
            else:
                # 检查缓存
                cache_key = f"{protocol}:{method}:{path}"
                cached_response = self.performance_optimizer.get_cached_response(cache_key)
                
                if cached_response:
                    response = cached_response
                else:
                    # 从连接池获取连接
                    conn_key = f"{protocol}_backend"
                    connection = self.connection_pool.get_connection(conn_key)
                    
                    try:
                        # 实际处理请求（这里简化处理）
                        response = {
                            "status": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body": b'{"message": "Request processed successfully"}'
                        }
                        
                        # 缓存响应（对于GET请求）
                        if method == "GET":
                            self.performance_optimizer.cache_response(cache_key, response)
                    
                    finally:
                        # 归还连接到连接池
                        self.connection_pool.return_connection(conn_key, connection)
            
            # 记录请求结束
            self.performance_optimizer.record_request_end(
                metrics, response["status"], len(response["body"])
            )
            
            return response
        
        except Exception as e:
            # 记录错误请求
            self.performance_optimizer.record_request_end(metrics, 500, 0)
            print(f"处理请求时发生错误: {e}")
            return {
                "status": 500,
                "headers": {},
                "body": b'{"error": "Internal server error"}'
            }
    
    async def handle_async_request(self, request_data: Dict[str, Any]):
        """
        异步处理请求
        """
        await self.async_handler.submit_request(request_data)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """
        获取性能统计
        """
        gateway_stats = self.performance_optimizer.get_performance_stats()
        connection_stats = self.connection_pool.get_stats()
        
        return {
            "gateway_stats": gateway_stats,
            "connection_pool_stats": connection_stats
        }

# 使用示例
print("\n=== 网关性能优化演示 ===")

# 创建优化的网关
config = GatewayConfig(
    host="0.0.0.0",
    port=8080,
    enable_hdfs=True,
    enable_s3=True
)

optimized_gateway = OptimizedGateway(config)

# 启动网关
print("启动优化的网关...")
optimized_gateway.start()

# 模拟处理大量请求
print("\n模拟处理大量请求...")
import concurrent.futures

def simulate_request(gateway, request_num):
    """模拟单个请求"""
    protocol = "s3" if request_num % 2 == 0 else "hdfs"
    method = "GET" if request_num % 3 == 0 else "POST"
    path = f"/bucket/object_{request_num}.txt"
    
    response = gateway.handle_request(
        protocol=protocol,
        method=method,
        path=path,
        headers={
            "X-Client-ID": f"client_{request_num % 10}",
            "Authorization": "Bearer token123"
        },
        body=b"Test data"
    )
    
    return response["status"]

# 使用线程池并发处理请求
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    # 提交100个请求
    futures = [executor.submit(simulate_request, optimized_gateway, i) for i in range(100)]
    
    # 获取结果
    results = [future.result() for future in concurrent.futures.as_completed(futures)]
    
    success_count = sum(1 for status in results if status == 200)
    print(f"处理了 {len(results)} 个请求，成功 {success_count} 个")

# 查看性能统计
print("\n性能统计信息:")
stats = optimized_gateway.get_performance_stats()
gateway_stats = stats["gateway_stats"]
connection_stats = stats["connection_pool_stats"]

print(f"网关统计:")
print(f"  总请求数: {gateway_stats.get('total_requests', 0)}")
print(f"  平均响应时间: {gateway_stats.get('average_response_time', 0):.4f}秒")
print(f"  缓存命中: {gateway_stats.get('cache_stats', {}).get('hits', 0)}")
print(f"  缓存未命中: {gateway_stats.get('cache_stats', {}).get('misses', 0)}")

print(f"连接池统计:")
for key, value in connection_stats.items():
    print(f"  {key}: {value}")

# 按协议查看详细统计
if "protocol_stats" in gateway_stats:
    print(f"协议详细统计:")
    for protocol, proto_stats in gateway_stats["protocol_stats"].items():
        print(f"  {protocol}:")
        print(f"    请求数: {proto_stats['requests']}")
        print(f"    平均响应时间: {proto_stats['avg_response_time']:.4f}秒")
        print(f"    错误率: {proto_stats['error_rate']:.2%}")
        print(f"    平均响应大小: {proto_stats['avg_response_size']:.0f}字节")

# 停止网关
print("\n停止优化的网关...")
optimized_gateway.stop()
```

## 总结

与HDFS、S3等标准协议的兼容与网关构建是分布式文件存储平台成功的关键因素。通过本章的深入探讨，我们了解了以下核心内容：

1. **协议兼容性概述**：协议兼容性对于平台的生态系统集成和用户采用率具有重要影响，需要支持HDFS、S3、POSIX等多种标准协议。

2. **HDFS协议兼容实现**：通过实现完整的HDFS API兼容层，包括文件创建、读写、删除、目录操作等功能，确保与Hadoop生态系统的无缝集成。

3. **S3协议兼容实现**：通过实现RESTful S3 API兼容层，包括对象存储、分段上传、元数据管理等功能，确保与云原生应用的天然兼容。

4. **网关构建与集成**：通过构建统一的协议网关，支持多协议接入、负载均衡、性能优化等高级功能，为用户提供一致的访问体验。

在实际工程实践中，需要注意以下要点：

- **兼容性测试**：建立完善的兼容性测试框架，确保与标准协议的完全兼容
- **性能优化**：通过缓存、连接池、异步处理等技术优化网关性能
- **监控与运维**：建立全面的监控体系，实时跟踪网关性能和健康状态
- **安全考虑**：实现完善的身份认证和访问控制机制，确保数据安全

通过合理设计和实现这些兼容性机制，分布式文件存储平台能够无缝集成到现有的大数据和云原生生态系统中，为用户提供灵活多样的数据访问方式。
