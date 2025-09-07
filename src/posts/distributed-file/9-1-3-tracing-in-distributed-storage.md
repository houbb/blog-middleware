---
title: 链路追踪（Tracing）在分布式存储中的应用
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台中，请求往往需要经过多个服务和组件的协同处理，这使得问题定位和性能分析变得异常复杂。链路追踪（Distributed Tracing）作为一种重要的可观测性技术，能够帮助我们可视化请求在系统中的完整流转路径，识别性能瓶颈，快速定位故障点，从而显著提升系统的可维护性和稳定性。

## 9.3.1 分布式追踪基础概念

分布式追踪的核心思想是为每个请求分配一个全局唯一的追踪ID（Trace ID），并在请求流经各个服务时创建对应的跨度（Span），通过收集和分析这些跨度信息，构建出完整的请求调用链路。

### 9.3.1.1 追踪核心概念

```python
# 分布式追踪核心概念实现
import uuid
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum

class SpanKind(Enum):
    """跨度类型"""
    SERVER = "SERVER"      # 服务端接收请求
    CLIENT = "CLIENT"      # 客户端发起请求
    PRODUCER = "PRODUCER"  # 消息生产者
    CONSUMER = "CONSUMER"  # 消息消费者
    INTERNAL = "INTERNAL"  # 内部处理

class SpanStatus(Enum):
    """跨度状态"""
    UNSET = "UNSET"        # 未设置
    OK = "OK"              # 成功
    ERROR = "ERROR"        # 错误

class TraceContext:
    """追踪上下文"""
    
    def __init__(self, trace_id: str = None, span_id: str = None, 
                 parent_span_id: str = None):
        self.trace_id = trace_id or str(uuid.uuid4())
        self.span_id = span_id or str(uuid.uuid4())
        self.parent_span_id = parent_span_id

class Span:
    """追踪跨度"""
    
    def __init__(self, name: str, trace_context: TraceContext, 
                 span_kind: SpanKind = SpanKind.INTERNAL):
        self.span_id = trace_context.span_id
        self.trace_id = trace_context.trace_id
        self.parent_span_id = trace_context.parent_span_id
        self.name = name
        self.span_kind = span_kind
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.status = SpanStatus.UNSET
        self.attributes: Dict[str, Any] = {}
        self.events: List[Dict[str, Any]] = []
        self.links: List[TraceContext] = []
    
    def set_attribute(self, key: str, value: Any):
        """设置属性"""
        self.attributes[key] = value
    
    def add_event(self, name: str, timestamp: Optional[float] = None, 
                  attributes: Optional[Dict[str, Any]] = None):
        """添加事件"""
        event = {
            "name": name,
            "timestamp": timestamp or time.time(),
            "attributes": attributes or {}
        }
        self.events.append(event)
    
    def set_status(self, status: SpanStatus, description: Optional[str] = None):
        """设置状态"""
        self.status = status
        if description:
            self.attributes["status_description"] = description
    
    def end(self):
        """结束跨度"""
        if self.end_time is None:
            self.end_time = time.time()
    
    def duration_ms(self) -> float:
        """获取持续时间（毫秒）"""
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return (time.time() - self.start_time) * 1000
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "span_id": self.span_id,
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "span_kind": self.span_kind.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms(),
            "status": self.status.value,
            "attributes": self.attributes,
            "events": self.events,
            "links": [{"trace_id": link.trace_id, "span_id": link.span_id} 
                     for link in self.links]
        }

class Tracer:
    """追踪器"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.active_spans: Dict[str, Span] = {}
        self.finished_spans: List[Span] = []
    
    def start_span(self, name: str, parent_context: Optional[TraceContext] = None,
                   span_kind: SpanKind = SpanKind.INTERNAL) -> Span:
        """开始一个新的跨度"""
        if parent_context:
            trace_id = parent_context.trace_id
            parent_span_id = parent_context.span_id
        else:
            trace_id = str(uuid.uuid4())
            parent_span_id = None
        
        trace_context = TraceContext(trace_id, str(uuid.uuid4()), parent_span_id)
        span = Span(name, trace_context, span_kind)
        
        # 设置服务名称
        span.set_attribute("service.name", self.service_name)
        
        self.active_spans[span.span_id] = span
        return span
    
    def end_span(self, span: Span):
        """结束跨度"""
        span.end()
        if span.span_id in self.active_spans:
            del self.active_spans[span.span_id]
            self.finished_spans.append(span)
    
    def get_trace(self, trace_id: str) -> List[Span]:
        """获取完整的追踪链路"""
        all_spans = list(self.active_spans.values()) + self.finished_spans
        return [span for span in all_spans if span.trace_id == trace_id]
    
    def export_finished_spans(self) -> List[Dict[str, Any]]:
        """导出已完成的跨度"""
        spans_data = [span.to_dict() for span in self.finished_spans]
        self.finished_spans.clear()
        return spans_data

# 使用示例
def demonstrate_tracing_concepts():
    """演示追踪概念"""
    tracer = Tracer("dfs-storage-service")
    
    # 创建根跨度
    root_span = tracer.start_span("file_operation", span_kind=SpanKind.SERVER)
    root_span.set_attribute("file.path", "/data/file1.txt")
    root_span.set_attribute("operation.type", "read")
    
    # 模拟一些处理时间
    time.sleep(0.01)
    
    # 创建子跨度（元数据查询）
    metadata_context = TraceContext(root_span.trace_id, root_span.span_id)
    metadata_span = tracer.start_span("metadata_query", metadata_context, SpanKind.CLIENT)
    metadata_span.set_attribute("metadata.key", "/data/file1.txt")
    metadata_span.add_event("query_started")
    
    # 模拟元数据查询
    time.sleep(0.005)
    metadata_span.add_event("query_completed")
    metadata_span.set_status(SpanStatus.OK)
    
    tracer.end_span(metadata_span)
    
    # 创建另一个子跨度（数据读取）
    read_context = TraceContext(root_span.trace_id, root_span.span_id)
    read_span = tracer.start_span("data_read", read_context, SpanKind.CLIENT)
    read_span.set_attribute("data.size", 1024000)
    read_span.add_event("read_started")
    
    # 模拟数据读取
    time.sleep(0.02)
    read_span.add_event("read_completed")
    read_span.set_status(SpanStatus.OK)
    
    tracer.end_span(read_span)
    
    # 结束根跨度
    root_span.set_status(SpanStatus.OK)
    tracer.end_span(root_span)
    
    # 导出追踪数据
    finished_spans = tracer.export_finished_spans()
    
    print("追踪跨度数据:")
    for span_data in finished_spans:
        print(json.dumps(span_data, indent=2, default=str))

# 运行演示
# demonstrate_tracing_concepts()
```

### 9.3.1.2 追踪上下文传播

```python
# 追踪上下文传播实现
import json
from typing import Dict, Any, Optional

class TraceContextPropagator:
    """追踪上下文传播器"""
    
    @staticmethod
    def inject(trace_context: TraceContext) -> Dict[str, str]:
        """注入追踪上下文到HTTP头"""
        return {
            "traceparent": f"00-{trace_context.trace_id}-{trace_context.span_id}-01",
            "tracestate": ""
        }
    
    @staticmethod
    def extract(headers: Dict[str, str]) -> Optional[TraceContext]:
        """从HTTP头提取追踪上下文"""
        traceparent = headers.get("traceparent")
        if not traceparent:
            return None
        
        # 解析traceparent格式: 00-trace_id-span_id-trace_flags
        parts = traceparent.split("-")
        if len(parts) != 4:
            return None
        
        version, trace_id, span_id, trace_flags = parts
        
        # 验证格式
        if version != "00" or len(trace_id) != 32 or len(span_id) != 16:
            return None
        
        return TraceContext(trace_id, span_id)

class TraceContextSerializer:
    """追踪上下文序列化器"""
    
    @staticmethod
    def serialize(trace_context: TraceContext) -> str:
        """序列化追踪上下文"""
        context_dict = {
            "trace_id": trace_context.trace_id,
            "span_id": trace_context.span_id,
            "parent_span_id": trace_context.parent_span_id
        }
        return json.dumps(context_dict)
    
    @staticmethod
    def deserialize(context_str: str) -> TraceContext:
        """反序列化追踪上下文"""
        try:
            context_dict = json.loads(context_str)
            return TraceContext(
                context_dict["trace_id"],
                context_dict["span_id"],
                context_dict.get("parent_span_id")
            )
        except (json.JSONDecodeError, KeyError):
            return TraceContext()

# 使用示例
def demonstrate_context_propagation():
    """演示上下文传播"""
    # 创建追踪上下文
    context = TraceContext("trace-1234567890abcdef", "span-12345678", "parent-87654321")
    
    # 注入到HTTP头
    headers = TraceContextPropagator.inject(context)
    print("注入的HTTP头:")
    for key, value in headers.items():
        print(f"  {key}: {value}")
    
    # 从HTTP头提取
    extracted_context = TraceContextPropagator.extract(headers)
    if extracted_context:
        print(f"\n提取的追踪上下文:")
        print(f"  Trace ID: {extracted_context.trace_id}")
        print(f"  Span ID: {extracted_context.span_id}")
        print(f"  Parent Span ID: {extracted_context.parent_span_id}")
    
    # 序列化和反序列化
    serialized = TraceContextSerializer.serialize(context)
    print(f"\n序列化的上下文: {serialized}")
    
    deserialized = TraceContextSerializer.deserialize(serialized)
    print(f"反序列化的上下文:")
    print(f"  Trace ID: {deserialized.trace_id}")
    print(f"  Span ID: {deserialized.span_id}")
    print(f"  Parent Span ID: {deserialized.parent_span_id}")

# 运行演示
# demonstrate_context_propagation()
```

## 9.3.2 分布式存储追踪实现

在分布式文件存储平台中，追踪需要覆盖从客户端请求到数据存储的完整链路，包括元数据操作、数据读写、网络传输等关键环节。

### 9.3.2.1 存储操作追踪

```python
# 存储操作追踪实现
import time
from typing import Dict, Any, Optional
import uuid

class StorageTracer:
    """存储系统追踪器"""
    
    def __init__(self, tracer: Tracer):
        self.tracer = tracer
    
    def trace_file_operation(self, operation: str, file_path: str, 
                           file_size: int = 0, client_id: str = "") -> Span:
        """追踪文件操作"""
        span = self.tracer.start_span(f"file_{operation}", span_kind=SpanKind.SERVER)
        
        # 设置操作属性
        span.set_attribute("file.path", file_path)
        span.set_attribute("file.size", file_size)
        span.set_attribute("operation.type", operation)
        span.set_attribute("client.id", client_id)
        
        # 记录开始事件
        span.add_event("operation_started", attributes={
            "file_path": file_path,
            "operation": operation
        })
        
        return span
    
    def trace_metadata_operation(self, operation: str, key: str, 
                               span_context: TraceContext) -> Span:
        """追踪元数据操作"""
        span = self.tracer.start_span(f"metadata_{operation}", span_context, SpanKind.CLIENT)
        
        # 设置操作属性
        span.set_attribute("metadata.key", key)
        span.set_attribute("operation.type", operation)
        
        # 记录开始事件
        span.add_event("metadata_operation_started", attributes={
            "key": key,
            "operation": operation
        })
        
        return span
    
    def trace_data_operation(self, operation: str, data_size: int,
                           target_node: str, span_context: TraceContext) -> Span:
        """追踪数据操作"""
        span = self.tracer.start_span(f"data_{operation}", span_context, SpanKind.CLIENT)
        
        # 设置操作属性
        span.set_attribute("data.size", data_size)
        span.set_attribute("target.node", target_node)
        span.set_attribute("operation.type", operation)
        
        # 记录开始事件
        span.add_event("data_operation_started", attributes={
            "target_node": target_node,
            "operation": operation,
            "data_size": data_size
        })
        
        return span
    
    def trace_network_operation(self, operation: str, target_host: str,
                              data_size: int, span_context: TraceContext) -> Span:
        """追踪网络操作"""
        span = self.tracer.start_span(f"network_{operation}", span_context, SpanKind.CLIENT)
        
        # 设置操作属性
        span.set_attribute("network.target", target_host)
        span.set_attribute("network.data_size", data_size)
        span.set_attribute("operation.type", operation)
        
        # 记录开始事件
        span.add_event("network_operation_started", attributes={
            "target": target_host,
            "operation": operation,
            "data_size": data_size
        })
        
        return span

class DistributedFileStorage:
    """分布式文件存储模拟"""
    
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.tracer = Tracer(f"dfs-node-{node_id}")
        self.storage_tracer = StorageTracer(self.tracer)
    
    def read_file(self, file_path: str, client_id: str = "") -> bytes:
        """读取文件"""
        # 创建根跨度
        root_span = self.storage_tracer.trace_file_operation(
            "read", file_path, client_id=client_id
        )
        
        try:
            # 追踪元数据查询
            metadata_context = TraceContext(root_span.trace_id, root_span.span_id)
            metadata_span = self.storage_tracer.trace_metadata_operation(
                "get", file_path, metadata_context
            )
            
            # 模拟元数据查询
            time.sleep(0.01)  # 10ms
            file_metadata = {"size": 1024000, "blocks": ["block-1", "block-2"]}
            metadata_span.set_attribute("file.metadata", str(file_metadata))
            metadata_span.add_event("metadata_retrieved")
            metadata_span.set_status(SpanStatus.OK)
            self.tracer.end_span(metadata_span)
            
            # 追踪数据读取
            data_context = TraceContext(root_span.trace_id, root_span.span_id)
            data_span = self.storage_tracer.trace_data_operation(
                "read", file_metadata["size"], "node-002", data_context
            )
            
            # 模拟网络传输
            network_context = TraceContext(data_span.trace_id, data_span.span_id)
            network_span = self.storage_tracer.trace_network_operation(
                "transfer", "192.168.1.102", file_metadata["size"], network_context
            )
            
            # 模拟网络延迟
            time.sleep(0.05)  # 50ms
            network_span.set_attribute("network.bytes_transferred", file_metadata["size"])
            network_span.add_event("transfer_completed")
            network_span.set_status(SpanStatus.OK)
            self.tracer.end_span(network_span)
            
            # 模拟本地读取
            time.sleep(0.02)  # 20ms
            data_span.set_attribute("data.bytes_read", file_metadata["size"])
            data_span.add_event("data_read_completed")
            data_span.set_status(SpanStatus.OK)
            self.tracer.end_span(data_span)
            
            # 完成根跨度
            root_span.set_attribute("file.bytes_read", file_metadata["size"])
            root_span.add_event("file_read_completed")
            root_span.set_status(SpanStatus.OK)
            
            return b"file_content" * 100  # 模拟文件内容
            
        except Exception as e:
            root_span.set_status(SpanStatus.ERROR, str(e))
            root_span.add_event("operation_failed", attributes={"error": str(e)})
            raise
        finally:
            self.tracer.end_span(root_span)
    
    def write_file(self, file_path: str, data: bytes, client_id: str = ""):
        """写入文件"""
        file_size = len(data)
        
        # 创建根跨度
        root_span = self.storage_tracer.trace_file_operation(
            "write", file_path, file_size, client_id
        )
        
        try:
            # 追踪元数据更新
            metadata_context = TraceContext(root_span.trace_id, root_span.span_id)
            metadata_span = self.storage_tracer.trace_metadata_operation(
                "put", file_path, metadata_context
            )
            
            # 模拟元数据更新
            time.sleep(0.005)  # 5ms
            metadata_span.add_event("metadata_updated")
            metadata_span.set_status(SpanStatus.OK)
            self.tracer.end_span(metadata_span)
            
            # 追踪数据写入
            data_context = TraceContext(root_span.trace_id, root_span.span_id)
            data_span = self.storage_tracer.trace_data_operation(
                "write", file_size, "node-003", data_context
            )
            
            # 模拟网络传输
            network_context = TraceContext(data_span.trace_id, data_span.span_id)
            network_span = self.storage_tracer.trace_network_operation(
                "transfer", "192.168.1.103", file_size, network_context
            )
            
            # 模拟网络延迟
            time.sleep(0.03)  # 30ms
            network_span.set_attribute("network.bytes_transferred", file_size)
            network_span.add_event("transfer_completed")
            network_span.set_status(SpanStatus.OK)
            self.tracer.end_span(network_span)
            
            # 模拟本地写入
            time.sleep(0.015)  # 15ms
            data_span.set_attribute("data.bytes_written", file_size)
            data_span.add_event("data_write_completed")
            data_span.set_status(SpanStatus.OK)
            self.tracer.end_span(data_span)
            
            # 完成根跨度
            root_span.set_attribute("file.bytes_written", file_size)
            root_span.add_event("file_write_completed")
            root_span.set_status(SpanStatus.OK)
            
        except Exception as e:
            root_span.set_status(SpanStatus.ERROR, str(e))
            root_span.add_event("operation_failed", attributes={"error": str(e)})
            raise
        finally:
            self.tracer.end_span(root_span)

# 使用示例
def demonstrate_storage_tracing():
    """演示存储追踪"""
    storage = DistributedFileStorage("001")
    
    # 读取文件
    print("读取文件...")
    content = storage.read_file("/data/file1.txt", "client-123")
    print(f"读取完成，内容大小: {len(content)} 字节")
    
    # 写入文件
    print("\n写入文件...")
    storage.write_file("/data/file2.txt", b"Hello, World!" * 1000, "client-456")
    print("写入完成")
    
    # 导出追踪数据
    finished_spans = storage.tracer.export_finished_spans()
    
    print(f"\n完成的追踪跨度数量: {len(finished_spans)}")
    
    # 按操作分组显示
    operations = {}
    for span_data in finished_spans:
        operation = span_data["name"]
        if operation not in operations:
            operations[operation] = []
        operations[operation].append(span_data)
    
    for operation, spans in operations.items():
        print(f"\n{operation} 操作:")
        for span in spans:
            print(f"  - Span ID: {span['span_id'][:8]}... Duration: {span['duration_ms']:.2f}ms")

# 运行演示
# demonstrate_storage_tracing()
```

### 9.3.2.2 跨节点追踪

```python
# 跨节点追踪实现
import requests
import json
from typing import Dict, Any, Optional

class CrossNodeTracer:
    """跨节点追踪器"""
    
    def __init__(self, local_node_id: str, tracer: Tracer):
        self.local_node_id = local_node_id
        self.tracer = tracer
        self.session = requests.Session()
    
    def call_remote_node(self, target_url: str, operation: str, 
                        data: Dict[str, Any], parent_span: Span) -> Dict[str, Any]:
        """调用远程节点"""
        # 创建网络操作跨度
        network_context = TraceContext(parent_span.trace_id, parent_span.span_id)
        network_span = self.tracer.start_span(
            f"network_call_{operation}", network_context, SpanKind.CLIENT
        )
        
        network_span.set_attribute("network.target", target_url)
        network_span.set_attribute("network.operation", operation)
        network_span.add_event("network_call_started")
        
        try:
            # 注入追踪上下文到请求头
            trace_context = TraceContext(
                network_span.trace_id, 
                network_span.span_id,
                network_span.parent_span_id
            )
            headers = TraceContextPropagator.inject(trace_context)
            headers["Content-Type"] = "application/json"
            
            # 发送请求
            response = self.session.post(
                target_url,
                json=data,
                headers=headers,
                timeout=30
            )
            
            # 记录网络传输信息
            network_span.set_attribute("network.status_code", response.status_code)
            network_span.set_attribute("network.response_size", len(response.content))
            network_span.add_event("network_call_completed")
            
            if response.status_code == 200:
                network_span.set_status(SpanStatus.OK)
                return response.json()
            else:
                network_span.set_status(SpanStatus.ERROR, f"HTTP {response.status_code}")
                raise Exception(f"远程调用失败: {response.status_code}")
                
        except Exception as e:
            network_span.set_status(SpanStatus.ERROR, str(e))
            network_span.add_event("network_call_failed", attributes={"error": str(e)})
            raise
        finally:
            self.tracer.end_span(network_span)
    
    def handle_incoming_request(self, headers: Dict[str, str], 
                              operation: str) -> Span:
        """处理传入请求"""
        # 从请求头提取追踪上下文
        trace_context = TraceContextPropagator.extract(headers)
        if not trace_context:
            # 如果没有追踪上下文，创建新的
            trace_context = TraceContext()
        
        # 创建服务端跨度
        span = self.tracer.start_span(
            f"handle_{operation}", trace_context, SpanKind.SERVER
        )
        
        span.set_attribute("service.node", self.local_node_id)
        span.set_attribute("operation.type", operation)
        span.add_event("request_received")
        
        return span

class StorageNode:
    """存储节点"""
    
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.tracer = Tracer(f"dfs-node-{node_id}")
        self.cross_node_tracer = CrossNodeTracer(node_id, self.tracer)
    
    def handle_metadata_request(self, headers: Dict[str, str], 
                              request_data: Dict[str, Any]) -> Dict[str, Any]:
        """处理元数据请求"""
        # 处理传入请求
        span = self.cross_node_tracer.handle_incoming_request(headers, "metadata")
        
        try:
            key = request_data.get("key", "")
            operation = request_data.get("operation", "get")
            
            span.set_attribute("metadata.key", key)
            span.set_attribute("metadata.operation", operation)
            
            # 模拟元数据处理
            time.sleep(0.01)  # 10ms
            
            result = {
                "key": key,
                "exists": True,
                "size": 1024000,
                "blocks": ["block-1", "block-2"],
                "version": "v1"
            }
            
            span.set_attribute("metadata.result", str(result))
            span.add_event("metadata_processed")
            span.set_status(SpanStatus.OK)
            
            return result
            
        except Exception as e:
            span.set_status(SpanStatus.ERROR, str(e))
            span.add_event("processing_failed", attributes={"error": str(e)})
            raise
        finally:
            self.tracer.end_span(span)
    
    def handle_data_request(self, headers: Dict[str, str], 
                          request_data: Dict[str, Any]) -> Dict[str, Any]:
        """处理数据请求"""
        # 处理传入请求
        span = self.cross_node_tracer.handle_incoming_request(headers, "data")
        
        try:
            operation = request_data.get("operation", "read")
            data_size = request_data.get("size", 0)
            
            span.set_attribute("data.operation", operation)
            span.set_attribute("data.size", data_size)
            
            # 模拟数据处理
            time.sleep(0.02)  # 20ms
            
            result = {
                "operation": operation,
                "size": data_size,
                "status": "success",
                "processing_time_ms": 20
            }
            
            span.set_attribute("data.result", str(result))
            span.add_event("data_processed")
            span.set_status(SpanStatus.OK)
            
            return result
            
        except Exception as e:
            span.set_status(SpanStatus.ERROR, str(e))
            span.add_event("processing_failed", attributes={"error": str(e)})
            raise
        finally:
            self.tracer.end_span(span)

# 使用示例
def demonstrate_cross_node_tracing():
    """演示跨节点追踪"""
    # 创建两个存储节点
    node1 = StorageNode("001")
    node2 = StorageNode("002")
    
    # 模拟节点1调用节点2的元数据服务
    print("节点1调用节点2的元数据服务...")
    
    # 创建根跨度
    root_span = node1.tracer.start_span("cross_node_operation", span_kind=SpanKind.SERVER)
    root_span.set_attribute("operation", "metadata_lookup")
    
    try:
        # 准备请求数据
        request_data = {
            "key": "/data/file1.txt",
            "operation": "get"
        }
        
        # 注入追踪上下文
        trace_context = TraceContext(root_span.trace_id, root_span.span_id)
        headers = TraceContextPropagator.inject(trace_context)
        
        # 调用远程节点（这里模拟调用）
        # 在实际应用中，这里会是HTTP请求
        print("模拟发送HTTP请求到节点2...")
        time.sleep(0.01)
        
        # 节点2处理请求
        response = node2.handle_metadata_request(headers, request_data)
        print(f"收到响应: {response}")
        
        root_span.set_attribute("response", str(response))
        root_span.add_event("cross_node_call_completed")
        root_span.set_status(SpanStatus.OK)
        
    except Exception as e:
        root_span.set_status(SpanStatus.ERROR, str(e))
        root_span.add_event("operation_failed", attributes={"error": str(e)})
        print(f"跨节点调用失败: {e}")
    finally:
        node1.tracer.end_span(root_span)
    
    # 导出两个节点的追踪数据
    print("\n节点1的追踪数据:")
    spans1 = node1.tracer.export_finished_spans()
    for span in spans1:
        print(f"  - {span['name']}: {span['duration_ms']:.2f}ms")
    
    print("\n节点2的追踪数据:")
    spans2 = node2.tracer.export_finished_spans()
    for span in spans2:
        print(f"  - {span['name']}: {span['duration_ms']:.2f}ms")

# 运行演示
# demonstrate_cross_node_tracing()
```

## 9.3.3 追踪数据收集与存储

追踪数据的收集和存储是实现分布式追踪的关键环节，需要考虑数据量大、实时性要求高等挑战。

### 9.3.3.1 追踪数据收集器

```python
# 追踪数据收集器实现
import threading
import queue
import time
from typing import Dict, Any, List, Optional
import json

class TraceDataCollector:
    """追踪数据收集器"""
    
    def __init__(self, buffer_size: int = 10000):
        self.buffer_size = buffer_size
        self.trace_queue = queue.Queue(maxsize=buffer_size)
        self.processing_thread = None
        self.running = False
        self.exporters: List['TraceExporter'] = []
        self.batch_size = 100
        self.batch_timeout_sec = 5
        self.current_batch = []
        self.last_export_time = time.time()
        self.lock = threading.Lock()
    
    def add_exporter(self, exporter: 'TraceExporter'):
        """添加导出器"""
        self.exporters.append(exporter)
    
    def collect_span(self, span_data: Dict[str, Any]):
        """收集跨度数据"""
        try:
            self.trace_queue.put_nowait(span_data)
        except queue.Full:
            print("追踪队列已满，丢弃跨度数据")
    
    def start_collection(self):
        """启动收集"""
        self.running = True
        self.processing_thread = threading.Thread(target=self._process_spans)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        print("追踪数据收集器已启动")
    
    def stop_collection(self):
        """停止收集"""
        self.running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
        print("追踪数据收集器已停止")
    
    def _process_spans(self):
        """处理跨度数据"""
        while self.running:
            try:
                span_data = self.trace_queue.get(timeout=1)
                self._add_to_batch(span_data)
                self.trace_queue.task_done()
            except queue.Empty:
                # 检查是否需要导出批次
                self._check_batch_export()
                continue
            except Exception as e:
                print(f"处理跨度数据时出错: {e}")
        
        # 停止时导出剩余数据
        self._export_batch()
    
    def _add_to_batch(self, span_data: Dict[str, Any]):
        """添加到批次"""
        with self.lock:
            self.current_batch.append(span_data)
            
            # 检查是否需要导出
            if len(self.current_batch) >= self.batch_size:
                self._export_batch()
            else:
                # 检查超时
                current_time = time.time()
                if current_time - self.last_export_time >= self.batch_timeout_sec:
                    self._export_batch()
    
    def _check_batch_export(self):
        """检查批次导出"""
        with self.lock:
            current_time = time.time()
            if (self.current_batch and 
                current_time - self.last_export_time >= self.batch_timeout_sec):
                self._export_batch()
    
    def _export_batch(self):
        """导出批次"""
        with self.lock:
            if not self.current_batch:
                return
            
            batch_data = self.current_batch.copy()
            self.current_batch.clear()
            self.last_export_time = time.time()
        
        # 导出到所有导出器
        for exporter in self.exporters:
            try:
                exporter.export_spans(batch_data)
            except Exception as e:
                print(f"导出到 {exporter.name} 时出错: {e}")

class TraceExporter:
    """追踪数据导出器基类"""
    
    def __init__(self, name: str):
        self.name = name
    
    def export_spans(self, spans: List[Dict[str, Any]]):
        """导出跨度数据"""
        raise NotImplementedError("子类必须实现 export_spans 方法")

class ConsoleTraceExporter(TraceExporter):
    """控制台追踪导出器"""
    
    def __init__(self):
        super().__init__("console-exporter")
    
    def export_spans(self, spans: List[Dict[str, Any]]):
        """导出到控制台"""
        print(f"\n--- 导出 {len(spans)} 个跨度到控制台 ---")
        for span in spans:
            print(f"Span: {span['name']} | Duration: {span['duration_ms']:.2f}ms | "
                  f"Status: {span['status']}")

class FileTraceExporter(TraceExporter):
    """文件追踪导出器"""
    
    def __init__(self, file_path: str):
        super().__init__("file-exporter")
        self.file_path = file_path
        self.file_handle = None
        self._open_file()
    
    def _open_file(self):
        """打开文件"""
        try:
            self.file_handle = open(self.file_path, 'a', encoding='utf-8')
        except Exception as e:
            print(f"打开文件失败: {e}")
    
    def export_spans(self, spans: List[Dict[str, Any]]):
        """导出到文件"""
        if not self.file_handle:
            return
        
        try:
            for span in spans:
                line = json.dumps(span, ensure_ascii=False) + '\n'
                self.file_handle.write(line)
            self.file_handle.flush()
        except Exception as e:
            print(f"写入文件失败: {e}")

class OTLPTraceExporter(TraceExporter):
    """OTLP追踪导出器"""
    
    def __init__(self, endpoint: str):
        super().__init__("otlp-exporter")
        self.endpoint = endpoint
        self.session = requests.Session()
    
    def export_spans(self, spans: List[Dict[str, Any]]):
        """导出到OTLP端点"""
        try:
            # 构建OTLP格式数据
            otlp_data = {
                "resourceSpans": [{
                    "resource": {
                        "attributes": [{
                            "key": "service.name",
                            "value": {"stringValue": "dfs-storage"}
                        }]
                    },
                    "scopeSpans": [{
                        "spans": spans
                    }]
                }]
            }
            
            # 发送到OTLP端点
            response = self.session.post(
                f"{self.endpoint}/v1/traces",
                json=otlp_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                print(f"OTLP导出失败: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"OTLP导出异常: {e}")

# 使用示例
def demonstrate_trace_collection():
    """演示追踪收集"""
    # 创建收集器
    collector = TraceDataCollector(buffer_size=1000)
    
    # 添加导出器
    console_exporter = ConsoleTraceExporter()
    file_exporter = FileTraceExporter("traces.log")
    collector.add_exporter(console_exporter)
    collector.add_exporter(file_exporter)
    
    # 启动收集器
    collector.start_collection()
    
    # 模拟收集一些跨度数据
    sample_spans = [
        {
            "span_id": "span-001",
            "trace_id": "trace-123",
            "name": "file_read",
            "duration_ms": 75.2,
            "status": "OK",
            "attributes": {"file.path": "/data/file1.txt"}
        },
        {
            "span_id": "span-002",
            "trace_id": "trace-124",
            "name": "metadata_query",
            "duration_ms": 12.5,
            "status": "OK",
            "attributes": {"metadata.key": "/data/file1.txt"}
        },
        {
            "span_id": "span-003",
            "trace_id": "trace-125",
            "name": "data_transfer",
            "duration_ms": 45.8,
            "status": "ERROR",
            "attributes": {"error": "timeout"}
        }
    ]
    
    # 收集跨度数据
    for span in sample_spans:
        collector.collect_span(span)
    
    # 等待处理完成
    time.sleep(2)
    
    # 停止收集器
    collector.stop_collection()
    
    print("追踪数据收集演示完成")

# 运行演示
# demonstrate_trace_collection()
```

### 9.3.3.2 追踪数据存储

```python
# 追踪数据存储实现
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import sqlite3

class TraceStorage:
    """追踪数据存储"""
    
    def __init__(self, db_path: str = "traces.db"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """初始化数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建跨度表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS spans (
                span_id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                parent_span_id TEXT,
                name TEXT NOT NULL,
                span_kind TEXT,
                start_time REAL NOT NULL,
                end_time REAL,
                duration_ms REAL,
                status TEXT,
                attributes TEXT,
                events TEXT,
                service_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_trace_id ON spans(trace_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_service_name ON spans(service_name)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_status ON spans(status)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_created_at ON spans(created_at)
        ''')
        
        conn.commit()
        conn.close()
    
    def store_span(self, span_data: Dict[str, Any]):
        """存储跨度数据"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO spans (
                    span_id, trace_id, parent_span_id, name, span_kind,
                    start_time, end_time, duration_ms, status, attributes,
                    events, service_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                span_data["span_id"],
                span_data["trace_id"],
                span_data.get("parent_span_id"),
                span_data["name"],
                span_data.get("span_kind"),
                span_data["start_time"],
                span_data.get("end_time"),
                span_data.get("duration_ms"),
                span_data.get("status"),
                json.dumps(span_data.get("attributes", {})),
                json.dumps(span_data.get("events", [])),
                span_data.get("attributes", {}).get("service.name", "unknown")
            ))
            
            conn.commit()
        except Exception as e:
            print(f"存储跨度数据失败: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def store_spans_batch(self, spans: List[Dict[str, Any]]):
        """批量存储跨度数据"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            for span_data in spans:
                cursor.execute('''
                    INSERT OR REPLACE INTO spans (
                        span_id, trace_id, parent_span_id, name, span_kind,
                        start_time, end_time, duration_ms, status, attributes,
                        events, service_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    span_data["span_id"],
                    span_data["trace_id"],
                    span_data.get("parent_span_id"),
                    span_data["name"],
                    span_data.get("span_kind"),
                    span_data["start_time"],
                    span_data.get("end_time"),
                    span_data.get("duration_ms"),
                    span_data.get("status"),
                    json.dumps(span_data.get("attributes", {})),
                    json.dumps(span_data.get("events", [])),
                    span_data.get("attributes", {}).get("service.name", "unknown")
                ))
            
            conn.commit()
        except Exception as e:
            print(f"批量存储跨度数据失败: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_trace(self, trace_id: str) -> List[Dict[str, Any]]:
        """获取完整追踪链路"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT span_id, trace_id, parent_span_id, name, span_kind,
                       start_time, end_time, duration_ms, status, attributes,
                       events, service_name
                FROM spans
                WHERE trace_id = ?
                ORDER BY start_time
            ''', (trace_id,))
            
            rows = cursor.fetchall()
            spans = []
            
            for row in rows:
                span = {
                    "span_id": row[0],
                    "trace_id": row[1],
                    "parent_span_id": row[2],
                    "name": row[3],
                    "span_kind": row[4],
                    "start_time": row[5],
                    "end_time": row[6],
                    "duration_ms": row[7],
                    "status": row[8],
                    "attributes": json.loads(row[9]) if row[9] else {},
                    "events": json.loads(row[10]) if row[10] else [],
                    "service_name": row[11]
                }
                spans.append(span)
            
            return spans
        except Exception as e:
            print(f"查询追踪链路失败: {e}")
            return []
        finally:
            conn.close()
    
    def search_traces(self, service_name: Optional[str] = None,
                     status: Optional[str] = None,
                     start_time: Optional[datetime] = None,
                     end_time: Optional[datetime] = None,
                     limit: int = 100) -> List[Dict[str, Any]]:
        """搜索追踪数据"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # 构建查询条件
            conditions = []
            params = []
            
            if service_name:
                conditions.append("service_name = ?")
                params.append(service_name)
            
            if status:
                conditions.append("status = ?")
                params.append(status)
            
            if start_time:
                conditions.append("start_time >= ?")
                params.append(start_time.timestamp())
            
            if end_time:
                conditions.append("start_time <= ?")
                params.append(end_time.timestamp())
            
            where_clause = ""
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)
            
            query = f'''
                SELECT span_id, trace_id, parent_span_id, name, span_kind,
                       start_time, end_time, duration_ms, status, attributes,
                       events, service_name
                FROM spans
                {where_clause}
                ORDER BY start_time DESC
                LIMIT ?
            '''
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            spans = []
            for row in rows:
                span = {
                    "span_id": row[0],
                    "trace_id": row[1],
                    "parent_span_id": row[2],
                    "name": row[3],
                    "span_kind": row[4],
                    "start_time": row[5],
                    "end_time": row[6],
                    "duration_ms": row[7],
                    "status": row[8],
                    "attributes": json.loads(row[9]) if row[9] else {},
                    "events": json.loads(row[10]) if row[10] else [],
                    "service_name": row[11]
                }
                spans.append(span)
            
            return spans
        except Exception as e:
            print(f"搜索追踪数据失败: {e}")
            return []
        finally:
            conn.close()
    
    def get_trace_statistics(self, hours: int = 24) -> Dict[str, Any]:
        """获取追踪统计信息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # 计算时间范围
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)
            
            # 获取统计信息
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_spans,
                    COUNT(DISTINCT trace_id) as total_traces,
                    AVG(duration_ms) as avg_duration,
                    MIN(duration_ms) as min_duration,
                    MAX(duration_ms) as max_duration,
                    COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_spans
                FROM spans
                WHERE start_time >= ? AND start_time <= ?
            ''', (start_time.timestamp(), end_time.timestamp()))
            
            row = cursor.fetchone()
            if row:
                return {
                    "total_spans": row[0],
                    "total_traces": row[1],
                    "avg_duration_ms": row[2],
                    "min_duration_ms": row[3],
                    "max_duration_ms": row[4],
                    "error_spans": row[5],
                    "error_rate": (row[5] / row[0] * 100) if row[0] > 0 else 0
                }
            
            return {}
        except Exception as e:
            print(f"获取追踪统计信息失败: {e}")
            return {}
        finally:
            conn.close()

# 使用示例
def demonstrate_trace_storage():
    """演示追踪存储"""
    # 创建存储
    storage = TraceStorage("demo_traces.db")
    
    # 存储一些示例数据
    sample_spans = [
        {
            "span_id": "span-001",
            "trace_id": "trace-123",
            "name": "file_read",
            "start_time": time.time() - 0.1,
            "end_time": time.time() - 0.05,
            "duration_ms": 50,
            "status": "OK",
            "attributes": {
                "service.name": "dfs-storage",
                "file.path": "/data/file1.txt",
                "file.size": 1024000
            },
            "events": [{"name": "read_started", "timestamp": time.time() - 0.1}]
        },
        {
            "span_id": "span-002",
            "trace_id": "trace-123",
            "parent_span_id": "span-001",
            "name": "metadata_query",
            "start_time": time.time() - 0.08,
            "end_time": time.time() - 0.07,
            "duration_ms": 10,
            "status": "OK",
            "attributes": {
                "service.name": "dfs-metadata",
                "metadata.key": "/data/file1.txt"
            },
            "events": []
        },
        {
            "span_id": "span-003",
            "trace_id": "trace-124",
            "name": "file_write",
            "start_time": time.time() - 0.2,
            "end_time": time.time() - 0.15,
            "duration_ms": 50,
            "status": "ERROR",
            "attributes": {
                "service.name": "dfs-storage",
                "file.path": "/data/file2.txt",
                "error": "disk full"
            },
            "events": [{"name": "write_failed", "timestamp": time.time() - 0.15}]
        }
    ]
    
    # 存储跨度数据
    storage.store_spans_batch(sample_spans)
    print("跨度数据已存储")
    
    # 查询完整追踪链路
    trace_spans = storage.get_trace("trace-123")
    print(f"\n追踪 trace-123 的跨度数量: {len(trace_spans)}")
    for span in trace_spans:
        print(f"  - {span['name']}: {span['duration_ms']:.2f}ms")
    
    # 搜索追踪数据
    search_results = storage.search_traces(
        service_name="dfs-storage",
        status="ERROR",
        limit=10
    )
    print(f"\n搜索结果数量: {len(search_results)}")
    for span in search_results:
        print(f"  - {span['name']}: {span['status']} ({span['duration_ms']:.2f}ms)")
    
    # 获取统计信息
    stats = storage.get_trace_statistics(hours=1)
    print(f"\n统计信息:")
    for key, value in stats.items():
        print(f"  - {key}: {value}")

# 运行演示
# demonstrate_trace_storage()
```

## 9.3.4 追踪数据分析与可视化

追踪数据的价值在于通过分析和可视化，帮助我们理解系统行为，识别性能瓶颈，优化系统架构。

### 9.3.4.1 追踪数据分析

```python
# 追踪数据分析实现
import statistics
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta

class TraceAnalyzer:
    """追踪数据分析器"""
    
    def __init__(self, storage: TraceStorage):
        self.storage = storage
    
    def analyze_service_performance(self, service_name: str, 
                                  hours: int = 24) -> Dict[str, Any]:
        """分析服务性能"""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # 获取服务的跨度数据
        spans = self.storage.search_traces(
            service_name=service_name,
            start_time=start_time,
            end_time=end_time
        )
        
        if not spans:
            return {"message": f"服务 {service_name} 在指定时间范围内无数据"}
        
        # 按操作类型分组
        operations = {}
        for span in spans:
            operation = span["name"]
            if operation not in operations:
                operations[operation] = []
            operations[operation].append(span)
        
        # 分析每个操作的性能
        operation_stats = {}
        for operation, op_spans in operations.items():
            durations = [span["duration_ms"] for span in op_spans]
            error_spans = [span for span in op_spans if span["status"] == "ERROR"]
            
            operation_stats[operation] = {
                "count": len(op_spans),
                "error_count": len(error_spans),
                "error_rate": len(error_spans) / len(op_spans) * 100,
                "duration_stats": {
                    "avg": statistics.mean(durations),
                    "min": min(durations),
                    "max": max(durations),
                    "median": statistics.median(durations),
                    "p95": self._percentile(durations, 95),
                    "p99": self._percentile(durations, 99)
                }
            }
        
        return {
            "service_name": service_name,
            "time_range_hours": hours,
            "total_spans": len(spans),
            "operations": operation_stats
        }
    
    def analyze_trace_latency(self, trace_id: str) -> Dict[str, Any]:
        """分析追踪延迟"""
        spans = self.storage.get_trace(trace_id)
        
        if not spans:
            return {"message": f"追踪 {trace_id} 无数据"}
        
        # 构建跨度树
        span_tree = self._build_span_tree(spans)
        
        # 计算关键路径
        critical_path = self._find_critical_path(span_tree)
        
        # 计算各部分延迟
        total_duration = spans[0]["duration_ms"] if spans else 0
        component_latencies = {}
        
        for span in spans:
            component = span["attributes"].get("service.name", "unknown")
            if component not in component_latencies:
                component_latencies[component] = 0
            component_latencies[component] += span["duration_ms"]
        
        return {
            "trace_id": trace_id,
            "total_duration_ms": total_duration,
            "critical_path": critical_path,
            "component_latencies": component_latencies,
            "span_count": len(spans)
        }
    
    def identify_performance_bottlenecks(self, hours: int = 24) -> List[Dict[str, Any]]:
        """识别性能瓶颈"""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # 获取所有跨度数据
        all_spans = self.storage.search_traces(
            start_time=start_time,
            end_time=end_time
        )
        
        if not all_spans:
            return []
        
        # 按服务和操作分组
        service_operations = {}
        for span in all_spans:
            service = span["attributes"].get("service.name", "unknown")
            operation = span["name"]
            key = f"{service}.{operation}"
            
            if key not in service_operations:
                service_operations[key] = []
            service_operations[key].append(span)
        
        # 识别高延迟操作
        bottlenecks = []
        for key, spans in service_operations.items():
            if len(spans) < 10:  # 至少需要10个样本
                continue
            
            durations = [span["duration_ms"] for span in spans]
            avg_duration = statistics.mean(durations)
            
            # 如果平均延迟超过100ms，标记为潜在瓶颈
            if avg_duration > 100:
                service, operation = key.split(".", 1)
                bottlenecks.append({
                    "type": "high_latency",
                    "service": service,
                    "operation": operation,
                    "avg_duration_ms": avg_duration,
                    "sample_count": len(spans),
                    "severity": "high" if avg_duration > 500 else "medium"
                })
        
        # 识别高错误率操作
        for key, spans in service_operations.items():
            error_spans = [span for span in spans if span["status"] == "ERROR"]
            error_rate = len(error_spans) / len(spans) * 100
            
            if error_rate > 5:  # 错误率超过5%
                service, operation = key.split(".", 1)
                bottlenecks.append({
                    "type": "high_error_rate",
                    "service": service,
                    "operation": operation,
                    "error_rate": error_rate,
                    "error_count": len(error_spans),
                    "severity": "high" if error_rate > 20 else "medium"
                })
        
        # 按严重程度排序
        bottlenecks.sort(key=lambda x: x["severity"], reverse=True)
        
        return bottlenecks
    
    def _build_span_tree(self, spans: List[Dict[str, Any]]) -> Dict[str, Any]:
        """构建跨度树"""
        # 创建跨度映射
        span_map = {span["span_id"]: span for span in spans}
        
        # 构建父子关系
        tree = {}
        for span in spans:
            span_id = span["span_id"]
            parent_id = span["parent_span_id"]
            
            if parent_id and parent_id in span_map:
                if parent_id not in tree:
                    tree[parent_id] = []
                tree[parent_id].append(span_id)
            elif not parent_id:  # 根跨度
                tree["root"] = span_id
        
        return tree
    
    def _find_critical_path(self, span_tree: Dict[str, Any]) -> List[str]:
        """查找关键路径"""
        # 简化实现，实际应用中需要更复杂的算法
        critical_path = []
        current = span_tree.get("root")
        
        while current:
            critical_path.append(current)
            children = span_tree.get(current, [])
            if children:
                # 选择持续时间最长的子跨度
                current = children[0]  # 简化处理
            else:
                break
        
        return critical_path
    
    def _percentile(self, data: List[float], percentile: float) -> float:
        """计算百分位数"""
        if not data:
            return 0
        
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        
        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower_index = int(index)
            upper_index = lower_index + 1
            weight = index - lower_index
            return sorted_data[lower_index] * (1 - weight) + sorted_data[upper_index] * weight

# 使用示例
def demonstrate_trace_analysis():
    """演示追踪分析"""
    # 创建存储和分析器
    storage = TraceStorage(":memory:")  # 使用内存数据库
    analyzer = TraceAnalyzer(storage)
    
    # 存储示例数据
    sample_spans = [
        {
            "span_id": "span-001",
            "trace_id": "trace-123",
            "name": "file_read",
            "start_time": time.time() - 0.2,
            "end_time": time.time() - 0.1,
            "duration_ms": 100,
            "status": "OK",
            "attributes": {
                "service.name": "dfs-storage",
                "file.path": "/data/file1.txt"
            },
            "events": []
        },
        {
            "span_id": "span-002",
            "trace_id": "trace-123",
            "parent_span_id": "span-001",
            "name": "metadata_query",
            "start_time": time.time() - 0.18,
            "end_time": time.time() - 0.17,
            "duration_ms": 10,
            "status": "OK",
            "attributes": {
                "service.name": "dfs-metadata",
                "metadata.key": "/data/file1.txt"
            },
            "events": []
        },
        {
            "span_id": "span-003",
            "trace_id": "trace-123",
            "parent_span_id": "span-001",
            "name": "data_read",
            "start_time": time.time() - 0.17,
            "end_time": time.time() - 0.12,
            "duration_ms": 50,
            "status": "OK",
            "attributes": {
                "service.name": "dfs-data",
                "data.size": 1024000
            },
            "events": []
        }
    ]
    
    storage.store_spans_batch(sample_spans)
    
    # 分析服务性能
    perf_stats = analyzer.analyze_service_performance("dfs-storage")
    print("服务性能分析:")
    print(json.dumps(perf_stats, indent=2, default=str))
    
    # 分析追踪延迟
    latency_analysis = analyzer.analyze_trace_latency("trace-123")
    print("\n追踪延迟分析:")
    print(json.dumps(latency_analysis, indent=2, default=str))
    
    # 识别性能瓶颈
    bottlenecks = analyzer.identify_performance_bottlenecks()
    print("\n识别到的性能瓶颈:")
    for bottleneck in bottlenecks:
        print(f"  - {bottleneck['service']}.{bottleneck['operation']}: "
              f"{bottleneck['type']} ({bottleneck['severity']})")

# 运行演示
# demonstrate_trace_analysis()
```

### 9.3.4.2 追踪数据可视化

```python
# 追踪数据可视化实现
import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, Any, List
import base64
from io import BytesIO

class TraceVisualizer:
    """追踪数据可视化器"""
    
    def __init__(self, analyzer: TraceAnalyzer):
        self.analyzer = analyzer
        plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
        plt.rcParams['axes.unicode_minus'] = False    # 用来正常显示负号
    
    def plot_service_performance(self, service_name: str, 
                               hours: int = 24) -> str:
        """绘制服务性能图表"""
        # 获取性能数据
        perf_data = self.analyzer.analyze_service_performance(service_name, hours)
        
        if "operations" not in perf_data:
            return "无性能数据"
        
        operations = perf_data["operations"]
        operation_names = list(operations.keys())
        avg_durations = [stats["duration_stats"]["avg"] for stats in operations.values()]
        error_rates = [stats["error_rate"] for stats in operations.values()]
        
        # 创建图表
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # 平均延迟图表
        bars1 = ax1.bar(range(len(operation_names)), avg_durations, color='skyblue')
        ax1.set_xlabel('操作类型')
        ax1.set_ylabel('平均延迟 (ms)')
        ax1.set_title(f'{service_name} - 平均操作延迟')
        ax1.set_xticks(range(len(operation_names)))
        ax1.set_xticklabels(operation_names, rotation=45, ha='right')
        
        # 添加数值标签
        for bar, duration in zip(bars1, avg_durations):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                    f'{duration:.1f}', ha='center', va='bottom')
        
        # 错误率图表
        bars2 = ax2.bar(range(len(operation_names)), error_rates, color='lightcoral')
        ax2.set_xlabel('操作类型')
        ax2.set_ylabel('错误率 (%)')
        ax2.set_title(f'{service_name} - 操作错误率')
        ax2.set_xticks(range(len(operation_names)))
        ax2.set_xticklabels(operation_names, rotation=45, ha='right')
        
        # 添加数值标签
        for bar, error_rate in zip(bars2, error_rates):
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                    f'{error_rate:.1f}%', ha='center', va='bottom')
        
        plt.tight_layout()
        
        # 保存为base64字符串
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        return f"data:image/png;base64,{image_base64}"
    
    def plot_trace_timeline(self, trace_id: str) -> str:
        """绘制追踪时间线图表"""
        # 获取追踪数据
        spans = self.analyzer.storage.get_trace(trace_id)
        
        if not spans:
            return "无追踪数据"
        
        # 按开始时间排序
        spans.sort(key=lambda x: x["start_time"])
        
        # 准备数据
        span_names = [span["name"] for span in spans]
        start_times = [span["start_time"] for span in spans]
        durations = [span["duration_ms"] for span in spans]
        services = [span["attributes"].get("service.name", "unknown") for span in spans]
        
        # 创建颜色映射
        unique_services = list(set(services))
        colors = plt.cm.Set3(np.linspace(0, 1, len(unique_services)))
        service_color_map = dict(zip(unique_services, colors))
        span_colors = [service_color_map[service] for service in services]
        
        # 创建图表
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # 绘制甘特图
        y_positions = range(len(span_names))
        bars = ax.barh(y_positions, durations, left=start_times, 
                      color=span_colors, alpha=0.7, height=0.5)
        
        # 设置标签
        ax.set_yticks(y_positions)
        ax.set_yticklabels(span_names)
        ax.set_xlabel('时间 (相对时间戳)')
        ax.set_ylabel('跨度')
        ax.set_title(f'追踪 {trace_id} - 时间线视图')
        
        # 添加图例
        legend_elements = [plt.Rectangle((0,0),1,1, facecolor=service_color_map[service]) 
                          for service in unique_services]
        ax.legend(legend_elements, unique_services, title="服务")
        
        # 添加持续时间标签
        for i, (bar, duration) in enumerate(zip(bars, durations)):
            ax.text(bar.get_x() + bar.get_width() + max(durations) * 0.01, 
                   bar.get_y() + bar.get_height()/2, 
                   f'{duration:.1f}ms', 
                   va='center', ha='left', fontsize=8)
        
        plt.tight_layout()
        
        # 保存为base64字符串
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        return f"data:image/png;base64,{image_base64}"
    
    def plot_bottleneck_analysis(self, hours: int = 24) -> str:
        """绘制瓶颈分析图表"""
        # 获取瓶颈数据
        bottlenecks = self.analyzer.identify_performance_bottlenecks(hours)
        
        if not bottlenecks:
            return "无瓶颈数据"
        
        # 分离高延迟和高错误率瓶颈
        latency_bottlenecks = [b for b in bottlenecks if b["type"] == "high_latency"]
        error_bottlenecks = [b for b in bottlenecks if b["type"] == "high_error_rate"]
        
        # 创建图表
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # 高延迟瓶颈图表
        if latency_bottlenecks:
            latency_labels = [f"{b['service']}.{b['operation']}" for b in latency_bottlenecks]
            latency_values = [b["avg_duration_ms"] for b in latency_bottlenecks]
            
            bars1 = ax1.barh(range(len(latency_labels)), latency_values, color='orange')
            ax1.set_yticks(range(len(latency_labels)))
            ax1.set_yticklabels(latency_labels)
            ax1.set_xlabel('平均延迟 (ms)')
            ax1.set_ylabel('服务.操作')
            ax1.set_title('高延迟瓶颈')
            
            # 添加数值标签
            for bar, value in zip(bars1, latency_values):
                ax1.text(bar.get_width() + max(latency_values) * 0.01, 
                        bar.get_y() + bar.get_height()/2, 
                        f'{value:.1f}ms', 
                        va='center', ha='left')
        else:
            ax1.text(0.5, 0.5, '无高延迟瓶颈', ha='center', va='center', 
                    transform=ax1.transAxes)
            ax1.set_title('高延迟瓶颈')
        
        # 高错误率瓶颈图表
        if error_bottlenecks:
            error_labels = [f"{b['service']}.{b['operation']}" for b in error_bottlenecks]
            error_values = [b["error_rate"] for b in error_bottlenecks]
            
            bars2 = ax2.barh(range(len(error_labels)), error_values, color='red')
            ax2.set_yticks(range(len(error_labels)))
            ax2.set_yticklabels(error_labels)
            ax2.set_xlabel('错误率 (%)')
            ax2.set_ylabel('服务.操作')
            ax2.set_title('高错误率瓶颈')
            
            # 添加数值标签
            for bar, value in zip(bars2, error_values):
                ax2.text(bar.get_width() + max(error_values) * 0.01, 
                        bar.get_y() + bar.get_height()/2, 
                        f'{value:.1f}%', 
                        va='center', ha='left')
        else:
            ax2.text(0.5, 0.5, '无高错误率瓶颈', ha='center', va='center', 
                    transform=ax2.transAxes)
            ax2.set_title('高错误率瓶颈')
        
        plt.tight_layout()
        
        # 保存为base64字符串
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()
        
        return f"data:image/png;base64,{image_base64}"

# 使用示例
def demonstrate_trace_visualization():
    """演示追踪可视化"""
    # 创建存储、分析器和可视化器
    storage = TraceStorage(":memory:")
    analyzer = TraceAnalyzer(storage)
    visualizer = TraceVisualizer(analyzer)
    
    # 存储示例数据
    sample_spans = [
        {
            "span_id": "span-001",
            "trace_id": "trace-123",
            "name": "file_read",
            "start_time": time.time() - 0.3,
            "end_time": time.time() - 0.1,
            "duration_ms": 200,
            "status": "OK",
            "attributes": {"service.name": "dfs-storage"},
            "events": []
        },
        {
            "span_id": "span-002",
            "trace_id": "trace-123",
            "parent_span_id": "span-001",
            "name": "metadata_query",
            "start_time": time.time() - 0.28,
            "end_time": time.time() - 0.25,
            "duration_ms": 30,
            "status": "OK",
            "attributes": {"service.name": "dfs-metadata"},
            "events": []
        },
        {
            "span_id": "span-003",
            "trace_id": "trace-124",
            "name": "file_write",
            "start_time": time.time() - 0.2,
            "end_time": time.time() - 0.1,
            "duration_ms": 100,
            "status": "ERROR",
            "attributes": {"service.name": "dfs-storage", "error": "disk full"},
            "events": []
        }
    ]
    
    storage.store_spans_batch(sample_spans)
    
    # 生成服务性能图表
    try:
        perf_chart = visualizer.plot_service_performance("dfs-storage")
        print("服务性能图表已生成")
        # 在实际应用中，可以将base64字符串嵌入HTML中显示
    except Exception as e:
        print(f"生成服务性能图表失败: {e}")
    
    # 生成追踪时间线图表
    try:
        timeline_chart = visualizer.plot_trace_timeline("trace-123")
        print("追踪时间线图表已生成")
    except Exception as e:
        print(f"生成追踪时间线图表失败: {e}")
    
    # 生成瓶颈分析图表
    try:
        bottleneck_chart = visualizer.plot_bottleneck_analysis()
        print("瓶颈分析图表已生成")
    except Exception as e:
        print(f"生成瓶颈分析图表失败: {e}")

# 运行演示
# demonstrate_trace_visualization()
```

## 总结

链路追踪在分布式文件存储平台中发挥着至关重要的作用，它不仅帮助我们理解请求在系统中的完整流转路径，还能通过深入分析识别性能瓶颈，快速定位故障点。通过本文的介绍，我们了解了：

1. **分布式追踪的核心概念**：包括追踪ID、跨度、跨度上下文等基本概念，以及它们在分布式系统中的作用。

2. **存储操作的追踪实现**：从文件读写到元数据查询，再到跨节点调用，展示了如何在分布式存储系统中实现全面的追踪覆盖。

3. **追踪数据的收集与存储**：通过高效的收集器和持久化存储方案，确保追踪数据能够被有效收集、存储和检索。

4. **追踪数据的分析与可视化**：通过对追踪数据的深入分析和直观可视化，帮助运维人员快速发现系统问题并进行优化。

在实际部署中，建议根据系统规模和性能要求选择合适的追踪系统，如Jaeger、Zipkin或商业APM解决方案。同时，要注意追踪数据的采样策略，避免对系统性能造成过大影响。