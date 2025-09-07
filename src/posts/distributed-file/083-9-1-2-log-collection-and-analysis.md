---
title: "日志收集与分析:基于ELK/Loki的日志平台集成"
date: 2025-09-07
categories: "[DFS]"
tags: "[dfs, logging, elk, loki, log-analysis, observability]"
published: true
---
在分布式文件存储平台中，日志收集与分析是确保系统稳定性和可维护性的关键环节。随着系统规模的扩大和复杂性的增加，传统的日志管理方式已无法满足现代分布式系统的需求。一个完善的日志收集与分析平台不仅能够帮助我们快速定位问题，还能通过日志数据挖掘出系统的运行规律和潜在问题。

## 9.2.1 日志收集架构设计

分布式系统的日志收集面临着诸多挑战，包括日志量大、格式多样、实时性要求高等。因此，我们需要设计一个高效、可扩展的日志收集架构。

### 9.2.1.1 日志收集器设计

```python
# 分布式日志收集器实现
import logging
import json
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
import queue
import threading
import uuid

class LogEntry:
    """日志条目"""
    
    def __init__(self, level: str, message: str, component: str, 
                 node_id: str, context: Optional[Dict[str, Any]] = None):
        self.log_id = str(uuid.uuid4())
        self.timestamp = datetime.now()
        self.level = level.upper()
        self.message = message
        self.component = component
        self.node_id = node_id
        self.context = context or {}
        self.thread_id = threading.current_thread().ident

class DistributedLogCollector:
    """分布式日志收集器"""
    
    def __init__(self, node_id: str, buffer_size: int = 10000):
        self.node_id = node_id
        self.buffer_size = buffer_size
        self.log_queue = queue.Queue(maxsize=buffer_size)
        self.processing_thread = None
        self.running = False
        self.forwarders: List['LogForwarder'] = []
        
        # 配置本地日志记录器
        self.local_logger = logging.getLogger(f"dfs.{node_id}")
        self.local_logger.setLevel(logging.INFO)
        
        # 创建格式化器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.local_logger.addHandler(console_handler)
    
    def add_forwarder(self, forwarder: 'LogForwarder'):
        """添加日志转发器"""
        self.forwarders.append(forwarder)
    
    def start_collection(self):
        """启动日志收集"""
        self.running = True
        self.processing_thread = threading.Thread(target=self._process_logs)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        
        self.local_logger.info(f"日志收集器 {self.node_id} 已启动")
    
    def stop_collection(self):
        """停止日志收集"""
        self.running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
        
        self.local_logger.info(f"日志收集器 {self.node_id} 已停止")
    
    def log(self, level: str, message: str, component: str, 
            context: Optional[Dict[str, Any]] = None):
        """记录日志"""
        log_entry = LogEntry(level, message, component, self.node_id, context)
        
        try:
            self.log_queue.put_nowait(log_entry)
        except queue.Full:
            self.local_logger.warning("日志队列已满，丢弃日志条目")
    
    def _process_logs(self):
        """处理日志队列"""
        while self.running:
            try:
                log_entry = self.log_queue.get(timeout=1)
                self._forward_log(log_entry)
                self.log_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                self.local_logger.error(f"处理日志时出错: {e}")
    
    def _forward_log(self, log_entry: LogEntry):
        """转发日志"""
        # 发送到所有转发器
        for forwarder in self.forwarders:
            try:
                forwarder.forward_log(log_entry)
            except Exception as e:
                self.local_logger.error(f"转发日志到 {forwarder.name} 时出错: {e}")

class LogForwarder:
    """日志转发器基类"""
    
    def __init__(self, name: str):
        self.name = name
    
    def forward_log(self, log_entry: LogEntry):
        """转发日志条目"""
        raise NotImplementedError("子类必须实现 forward_log 方法")

class FileLogForwarder(LogForwarder):
    """文件日志转发器"""
    
    def __init__(self, name: str, file_path: str, max_file_size_mb: int = 100):
        super().__init__(name)
        self.file_path = file_path
        self.max_file_size_mb = max_file_size_mb
        self.current_file = None
        self.current_file_size = 0
        self._open_file()
    
    def _open_file(self):
        """打开日志文件"""
        if self.current_file:
            self.current_file.close()
        
        # 检查是否需要轮转文件
        try:
            import os
            if os.path.exists(self.file_path):
                file_size_mb = os.path.getsize(self.file_path) / (1024 * 1024)
                if file_size_mb > self.max_file_size_mb:
                    # 轮转文件
                    os.rename(self.file_path, f"{self.file_path}.{int(time.time())}")
        except Exception as e:
            print(f"文件轮转检查出错: {e}")
        
        self.current_file = open(self.file_path, 'a', encoding='utf-8')
        self.current_file_size = 0
    
    def forward_log(self, log_entry: LogEntry):
        """将日志写入文件"""
        log_dict = {
            "log_id": log_entry.log_id,
            "timestamp": log_entry.timestamp.isoformat(),
            "level": log_entry.level,
            "message": log_entry.message,
            "component": log_entry.component,
            "node_id": log_entry.node_id,
            "context": log_entry.context,
            "thread_id": log_entry.thread_id
        }
        
        log_line = json.dumps(log_dict, ensure_ascii=False) + '\n'
        log_line_bytes = len(log_line.encode('utf-8'))
        
        # 检查是否需要轮转文件
        if (self.current_file_size + log_line_bytes) / (1024 * 1024) > self.max_file_size_mb:
            self._open_file()
        
        self.current_file.write(log_line)
        self.current_file.flush()
        self.current_file_size += log_line_bytes

class NetworkLogForwarder(LogForwarder):
    """网络日志转发器"""
    
    def __init__(self, name: str, target_host: str, target_port: int):
        super().__init__(name)
        self.target_host = target_host
        self.target_port = target_port
        self.batch_size = 100
        self.batch_timeout_sec = 5
        self.log_buffer = []
        self.last_send_time = time.time()
        self.lock = threading.Lock()
        
        # 尝试导入网络库
        try:
            import socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((target_host, target_port))
        except Exception as e:
            print(f"网络连接失败: {e}")
            self.socket = None
    
    def forward_log(self, log_entry: LogEntry):
        """通过网络转发日志"""
        with self.lock:
            self.log_buffer.append(log_entry)
            
            # 检查是否需要发送
            current_time = time.time()
            if (len(self.log_buffer) >= self.batch_size or 
                current_time - self.last_send_time >= self.batch_timeout_sec):
                self._send_batch()
    
    def _send_batch(self):
        """发送日志批次"""
        if not self.log_buffer or not self.socket:
            return
        
        try:
            # 将日志条目转换为JSON并发送
            batch_data = []
            for log_entry in self.log_buffer:
                log_dict = {
                    "log_id": log_entry.log_id,
                    "timestamp": log_entry.timestamp.isoformat(),
                    "level": log_entry.level,
                    "message": log_entry.message,
                    "component": log_entry.component,
                    "node_id": log_entry.node_id,
                    "context": log_entry.context,
                    "thread_id": log_entry.thread_id
                }
                batch_data.append(log_dict)
            
            batch_json = json.dumps(batch_data, ensure_ascii=False)
            batch_bytes = batch_json.encode('utf-8')
            
            # 发送批次大小和数据
            size_bytes = len(batch_bytes).to_bytes(4, byteorder='big')
            self.socket.sendall(size_bytes)
            self.socket.sendall(batch_bytes)
            
            self.log_buffer.clear()
            self.last_send_time = time.time()
        except Exception as e:
            print(f"发送日志批次失败: {e}")

# 使用示例
def demonstrate_log_collection():
    """演示日志收集"""
    # 创建日志收集器
    collector = DistributedLogCollector("node-001", buffer_size=1000)
    
    # 添加转发器
    file_forwarder = FileLogForwarder("file-forwarder", "logs/node-001.log")
    collector.add_forwarder(file_forwarder)
    
    # 启动收集器
    collector.start_collection()
    
    # 记录一些日志
    collector.log("INFO", "系统启动完成", "system", {"version": "2.1.0"})
    collector.log("WARNING", "磁盘使用率超过80%", "storage", {"usage": 85.2})
    collector.log("ERROR", "数据库连接失败", "database", {"error": "connection timeout"})
    
    # 等待处理完成
    time.sleep(2)
    
    # 停止收集器
    collector.stop_collection()
    
    print("日志收集演示完成")

# 运行演示
# demonstrate_log_collection()
```

### 9.2.1.2 日志格式标准化

```python
# 日志格式标准化实现
import json
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

class StandardizedLogFormatter:
    """标准化日志格式化器"""
    
    # 日志级别定义
    LOG_LEVELS = {
        "DEBUG": 10,
        "INFO": 20,
        "WARNING": 30,
        "ERROR": 40,
        "CRITICAL": 50
    }
    
    def __init__(self, service_name: str, version: str = "1.0"):
        self.service_name = service_name
        self.version = version
    
    def format_log(self, level: str, message: str, component: str,
                   node_id: str, trace_id: Optional[str] = None,
                   span_id: Optional[str] = None,
                   context: Optional[Dict[str, Any]] = None,
                   timestamp: Optional[datetime] = None) -> Dict[str, Any]:
        """格式化日志"""
        if timestamp is None:
            timestamp = datetime.now()
        
        # 标准化日志结构
        log_entry = {
            # 基本信息
            "timestamp": timestamp.isoformat(),
            "level": level.upper(),
            "message": message,
            "service": self.service_name,
            "version": self.version,
            
            # 位置信息
            "component": component,
            "node_id": node_id,
            
            # 追踪信息
            "trace_id": trace_id or str(uuid.uuid4()),
            "span_id": span_id or str(uuid.uuid4()),
            
            # 上下文信息
            "context": context or {},
            
            # 元数据
            "log_id": str(uuid.uuid4()),
            "severity": self.LOG_LEVELS.get(level.upper(), 0)
        }
        
        return log_entry
    
    def parse_log(self, log_json: str) -> Dict[str, Any]:
        """解析日志JSON"""
        try:
            return json.loads(log_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"无效的日志JSON格式: {e}")
    
    def validate_log(self, log_entry: Dict[str, Any]) -> bool:
        """验证日志格式"""
        required_fields = ["timestamp", "level", "message", "service", "component", "node_id"]
        
        for field in required_fields:
            if field not in log_entry:
                return False
        
        # 验证日志级别
        if log_entry["level"] not in self.LOG_LEVELS:
            return False
        
        # 验证时间戳格式
        try:
            datetime.fromisoformat(log_entry["timestamp"].replace('Z', '+00:00'))
        except ValueError:
            return False
        
        return True

class LogSchema:
    """日志模式定义"""
    
    # 标准字段定义
    STANDARD_FIELDS = {
        "timestamp": {"type": "string", "format": "iso8601", "required": True},
        "level": {"type": "string", "enum": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], "required": True},
        "message": {"type": "string", "required": True},
        "service": {"type": "string", "required": True},
        "version": {"type": "string", "required": False},
        "component": {"type": "string", "required": True},
        "node_id": {"type": "string", "required": True},
        "trace_id": {"type": "string", "required": False},
        "span_id": {"type": "string", "required": False},
        "context": {"type": "object", "required": False},
        "log_id": {"type": "string", "required": True},
        "severity": {"type": "integer", "required": True}
    }
    
    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        """获取日志模式"""
        return cls.STANDARD_FIELDS

# 使用示例
def demonstrate_log_formatting():
    """演示日志格式化"""
    formatter = StandardizedLogFormatter("dfs-storage-service", "2.1.0")
    
    # 格式化不同类型的日志
    logs = [
        formatter.format_log(
            level="INFO",
            message="文件读取成功",
            component="storage",
            node_id="node-001",
            context={"file_path": "/data/file1.txt", "size_bytes": 1024000}
        ),
        formatter.format_log(
            level="WARNING",
            message="磁盘使用率过高",
            component="storage",
            node_id="node-001",
            context={"usage_percent": 85.2, "free_space_gb": 150}
        ),
        formatter.format_log(
            level="ERROR",
            message="网络连接超时",
            component="network",
            node_id="node-001",
            trace_id="trace-12345",
            span_id="span-67890",
            context={"target_host": "192.168.1.100", "timeout_seconds": 30}
        )
    ]
    
    print("标准化日志格式示例:")
    for i, log in enumerate(logs, 1):
        print(f"\n日志 {i}:")
        print(json.dumps(log, indent=2, ensure_ascii=False))
        
        # 验证日志格式
        is_valid = formatter.validate_log(log)
        print(f"格式验证: {'通过' if is_valid else '失败'}")

# 运行演示
# demonstrate_log_formatting()
```

## 9.2.2 ELK Stack集成

ELK Stack（Elasticsearch, Logstash, Kibana）是业界广泛使用的日志收集和分析解决方案。在分布式文件存储平台中集成ELK Stack，可以实现高效的日志收集、存储和可视化。

### 9.2.2.1 Elasticsearch集成

```python
# Elasticsearch集成实现
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import time
import threading
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk

class ElasticsearchLogStore:
    """Elasticsearch日志存储"""
    
    def __init__(self, hosts: List[str], index_prefix: str = "dfs-logs"):
        self.hosts = hosts
        self.index_prefix = index_prefix
        self.es_client = None
        self.batch_size = 100
        self.batch_timeout_sec = 5
        self.log_buffer = []
        self.last_flush_time = time.time()
        self.lock = threading.Lock()
        self._connect()
    
    def _connect(self):
        """连接到Elasticsearch"""
        try:
            self.es_client = Elasticsearch(
                hosts=self.hosts,
                retry_on_timeout=True,
                max_retries=3
            )
            # 测试连接
            if self.es_client.ping():
                print("成功连接到Elasticsearch")
            else:
                print("无法连接到Elasticsearch")
        except Exception as e:
            print(f"Elasticsearch连接失败: {e}")
            self.es_client = None
    
    def store_log(self, log_entry: Dict[str, Any]):
        """存储单条日志"""
        with self.lock:
            self.log_buffer.append(log_entry)
            
            # 检查是否需要刷新
            current_time = time.time()
            if (len(self.log_buffer) >= self.batch_size or 
                current_time - self.last_flush_time >= self.batch_timeout_sec):
                self._flush_buffer()
    
    def _flush_buffer(self):
        """刷新日志缓冲区"""
        if not self.log_buffer or not self.es_client:
            return
        
        try:
            # 准备批量操作
            actions = []
            for log_entry in self.log_buffer:
                # 生成索引名称（按天分索引）
                index_date = datetime.fromisoformat(
                    log_entry["timestamp"].replace('Z', '+00:00')
                ).strftime("%Y.%m.%d")
                index_name = f"{self.index_prefix}-{index_date}"
                
                action = {
                    "_index": index_name,
                    "_source": log_entry
                }
                actions.append(action)
            
            # 执行批量插入
            success, failed = bulk(
                self.es_client,
                actions,
                max_retries=3,
                initial_backoff=2,
                max_backoff=600
            )
            
            print(f"成功存储 {success} 条日志")
            if failed:
                print(f"存储失败 {len(failed)} 条日志: {failed}")
            
            self.log_buffer.clear()
            self.last_flush_time = time.time()
        except Exception as e:
            print(f"刷新日志缓冲区失败: {e}")
    
    def search_logs(self, query: Dict[str, Any], 
                   index_pattern: Optional[str] = None,
                   size: int = 100) -> Dict[str, Any]:
        """搜索日志"""
        if not self.es_client:
            return {"error": "Elasticsearch客户端未初始化"}
        
        if index_pattern is None:
            index_pattern = f"{self.index_prefix}-*"
        
        try:
            result = self.es_client.search(
                index=index_pattern,
                body=query,
                size=size
            )
            return result
        except Exception as e:
            return {"error": f"搜索失败: {e}"}
    
    def get_log_statistics(self, time_range_hours: int = 24) -> Dict[str, Any]:
        """获取日志统计信息"""
        if not self.es_client:
            return {"error": "Elasticsearch客户端未初始化"}
        
        # 计算时间范围
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=time_range_hours)
        
        # 构建聚合查询
        query = {
            "size": 0,
            "aggs": {
                "log_levels": {
                    "terms": {"field": "level.keyword"}
                },
                "components": {
                    "terms": {"field": "component.keyword"}
                },
                "nodes": {
                    "terms": {"field": "node_id.keyword"}
                },
                "timeline": {
                    "date_histogram": {
                        "field": "timestamp",
                        "calendar_interval": "1h"
                    }
                }
            },
            "query": {
                "range": {
                    "timestamp": {
                        "gte": start_time.isoformat(),
                        "lte": end_time.isoformat()
                    }
                }
            }
        }
        
        index_pattern = f"{self.index_prefix}-*"
        try:
            result = self.es_client.search(index=index_pattern, body=query)
            return result
        except Exception as e:
            return {"error": f"统计查询失败: {e}"}

# 使用示例
def demonstrate_elasticsearch_integration():
    """演示Elasticsearch集成"""
    # 初始化Elasticsearch存储
    es_store = ElasticsearchLogStore(
        hosts=["localhost:9200"],
        index_prefix="dfs-logs"
    )
    
    # 模拟存储一些日志
    sample_logs = [
        {
            "timestamp": datetime.now().isoformat(),
            "level": "INFO",
            "message": "文件读取成功",
            "service": "dfs-storage",
            "component": "storage",
            "node_id": "node-001",
            "context": {"file_path": "/data/file1.txt", "size_bytes": 1024000}
        },
        {
            "timestamp": datetime.now().isoformat(),
            "level": "WARNING",
            "message": "磁盘使用率过高",
            "service": "dfs-storage",
            "component": "storage",
            "node_id": "node-001",
            "context": {"usage_percent": 85.2, "free_space_gb": 150}
        },
        {
            "timestamp": datetime.now().isoformat(),
            "level": "ERROR",
            "message": "网络连接超时",
            "service": "dfs-storage",
            "component": "network",
            "node_id": "node-001",
            "context": {"target_host": "192.168.1.100", "timeout_seconds": 30}
        }
    ]
    
    # 存储日志
    for log in sample_logs:
        es_store.store_log(log)
    
    # 等待刷新
    time.sleep(1)
    
    # 搜索日志
    search_query = {
        "query": {
            "match": {
                "level": "ERROR"
            }
        }
    }
    
    search_result = es_store.search_logs(search_query)
    print("错误日志搜索结果:")
    print(json.dumps(search_result, indent=2, default=str))
    
    # 获取统计信息
    stats = es_store.get_log_statistics(time_range_hours=24)
    print("\n日志统计信息:")
    print(json.dumps(stats, indent=2, default=str))

# 运行演示
# demonstrate_elasticsearch_integration()
```

### 9.2.2.2 Logstash配置

```python
# Logstash配置示例
logstash_config = """
# 分布式文件存储平台 Logstash 配置

input {
  # TCP输入用于接收日志
  tcp {
    port => 5000
    codec => json
  }
  
  # 文件输入用于读取本地日志文件
  file {
    path => "/var/log/dfs/*.log"
    start_position => "beginning"
    sincedb_path => "/dev/null"
    codec => json
  }
  
  # Beats输入用于接收Filebeat发送的日志
  beats {
    port => 5044
  }
}

filter {
  # 解析时间戳
  date {
    match => [ "timestamp", "ISO8601" ]
    target => "@timestamp"
  }
  
  # 添加地理信息（如果日志包含IP地址）
  if [context][client_ip] {
    geoip {
      source => "[context][client_ip]"
      target => "geoip"
    }
  }
  
  # 用户代理解析
  if [context][user_agent] {
    useragent {
      source => "[context][user_agent]"
      target => "user_agent"
    }
  }
  
  # 文件大小转换
  if [context][size_bytes] {
    mutate {
      convert => { "[context][size_bytes]" => "integer" }
    }
    
    # 添加文件大小分类
    if [context][size_bytes] < 1048576 {
      mutate { add_field => { "[context][size_category]" => "small" } }
    } else if [context][size_bytes] < 104857600 {
      mutate { add_field => { "[context][size_category]" => "medium" } }
    } else {
      mutate { add_field => { "[context][size_category]" => "large" } }
    }
  }
  
  # 添加系统负载信息
  if [context][cpu_usage] {
    mutate {
      convert => { "[context][cpu_usage]" => "float" }
    }
  }
  
  if [context][memory_usage] {
    mutate {
      convert => { "[context][memory_usage]" => "float" }
    }
  }
}

output {
  # 输出到Elasticsearch
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "dfs-logs-%{+YYYY.MM.dd}"
    document_type => "_doc"
    template_name => "dfs-logs"
    template => "/etc/logstash/templates/dfs-logs-template.json"
    template_overwrite => true
  }
  
  # 输出到文件（用于备份）
  file {
    path => "/var/log/dfs/processed/%{+YYYY-MM-dd}/dfs-logs.log"
    codec => line { format => "%{message}" }
  }
  
  # 输出到标准输出（调试用）
  stdout {
    codec => rubydebug
  }
}
"""

# Elasticsearch索引模板
elasticsearch_template = {
    "index_patterns": ["dfs-logs-*"],
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "refresh_interval": "30s"
    },
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "level": {"type": "keyword"},
            "message": {"type": "text"},
            "service": {"type": "keyword"},
            "version": {"type": "keyword"},
            "component": {"type": "keyword"},
            "node_id": {"type": "keyword"},
            "trace_id": {"type": "keyword"},
            "span_id": {"type": "keyword"},
            "context": {
                "type": "object",
                "dynamic": True
            },
            "log_id": {"type": "keyword"},
            "severity": {"type": "integer"},
            "@timestamp": {"type": "date"}
        }
    }
}

print("Logstash配置示例:")
print(logstash_config)
print("\nElasticsearch索引模板:")
print(json.dumps(elasticsearch_template, indent=2))
```

## 9.2.3 Loki集成

Loki是Grafana Labs开发的轻量级日志聚合系统，专为云原生环境设计。相比ELK Stack，Loki更加轻量级，适合资源受限的环境。

### 9.2.3.1 Loki客户端实现

```python
# Loki客户端实现
import requests
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
import threading

class LokiLogClient:
    """Loki日志客户端"""
    
    def __init__(self, loki_url: str, job_name: str = "dfs"):
        self.loki_url = loki_url.rstrip('/')
        self.job_name = job_name
        self.batch_size = 100
        self.batch_timeout_sec = 5
        self.log_buffer = []
        self.last_send_time = time.time()
        self.lock = threading.Lock()
        self.session = requests.Session()
    
    def push_log(self, labels: Dict[str, str], log_line: str, 
                 timestamp: Optional[datetime] = None):
        """推送日志到Loki"""
        if timestamp is None:
            timestamp = datetime.now()
        
        log_entry = {
            "labels": labels,
            "line": log_line,
            "timestamp": timestamp
        }
        
        with self.lock:
            self.log_buffer.append(log_entry)
            
            # 检查是否需要发送
            current_time = time.time()
            if (len(self.log_buffer) >= self.batch_size or 
                current_time - self.last_send_time >= self.batch_timeout_sec):
                self._send_batch()
    
    def _send_batch(self):
        """发送日志批次到Loki"""
        if not self.log_buffer:
            return
        
        try:
            # 构建Loki推送请求
            streams = {}
            
            # 按标签分组日志
            for entry in self.log_buffer:
                # 创建标签字符串
                label_pairs = []
                for key, value in entry["labels"].items():
                    label_pairs.append(f'{key}="{value}"')
                labels_str = "{" + ",".join(label_pairs) + "}"
                
                # 按标签分组
                if labels_str not in streams:
                    streams[labels_str] = {
                        "stream": entry["labels"],
                        "values": []
                    }
                
                # 添加日志值 (纳秒时间戳, 日志内容)
                timestamp_ns = int(entry["timestamp"].timestamp() * 1e9)
                streams[labels_str]["values"].append([
                    str(timestamp_ns),
                    entry["line"]
                ])
            
            # 构建推送数据
            payload = {
                "streams": list(streams.values())
            }
            
            # 发送到Loki
            response = self.session.post(
                f"{self.loki_url}/loki/api/v1/push",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 204:
                print(f"成功推送 {len(self.log_buffer)} 条日志到Loki")
            else:
                print(f"Loki推送失败: {response.status_code} - {response.text}")
            
            self.log_buffer.clear()
            self.last_send_time = time.time()
        except Exception as e:
            print(f"发送日志批次到Loki失败: {e}")
    
    def query_logs(self, query: str, 
                   start_time: Optional[datetime] = None,
                   end_time: Optional[datetime] = None,
                   limit: int = 100) -> Dict[str, Any]:
        """查询Loki日志"""
        try:
            # 构建查询参数
            params = {
                "query": query,
                "limit": limit
            }
            
            if start_time:
                params["start"] = int(start_time.timestamp() * 1e9)
            
            if end_time:
                params["end"] = int(end_time.timestamp() * 1e9)
            
            # 发送查询请求
            response = self.session.get(
                f"{self.loki_url}/loki/api/v1/query_range",
                params=params
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"查询失败: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"查询Loki日志失败: {e}"}
    
    def get_label_values(self, label_name: str) -> Dict[str, Any]:
        """获取标签值"""
        try:
            response = self.session.get(
                f"{self.loki_url}/loki/api/v1/label/{label_name}/values"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"获取标签值失败: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"获取标签值失败: {e}"}

class DistributedLokiLogger:
    """分布式Loki日志记录器"""
    
    def __init__(self, loki_client: LokiLogClient, node_id: str, service_name: str):
        self.loki_client = loki_client
        self.node_id = node_id
        self.service_name = service_name
    
    def log(self, level: str, message: str, component: str, 
            context: Optional[Dict[str, Any]] = None):
        """记录日志"""
        # 构建标签
        labels = {
            "job": self.loki_client.job_name,
            "service": self.service_name,
            "node_id": self.node_id,
            "component": component,
            "level": level.upper()
        }
        
        # 构建日志行
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "level": level.upper(),
            "message": message,
            "context": context or {}
        }
        
        log_line = json.dumps(log_data, ensure_ascii=False)
        
        # 推送到Loki
        self.loki_client.push_log(labels, log_line)

# 使用示例
def demonstrate_loki_integration():
    """演示Loki集成"""
    # 初始化Loki客户端
    loki_client = LokiLogClient("http://localhost:3100", "dfs")
    
    # 创建分布式日志记录器
    logger = DistributedLokiLogger(loki_client, "node-001", "dfs-storage")
    
    # 记录一些日志
    logger.log("INFO", "系统启动完成", "system", {"version": "2.1.0"})
    logger.log("WARNING", "磁盘使用率超过80%", "storage", {"usage": 85.2})
    logger.log("ERROR", "数据库连接失败", "database", {"error": "connection timeout"})
    
    # 等待发送完成
    time.sleep(2)
    
    # 查询日志
    query = '{job="dfs", level="ERROR"}'
    start_time = datetime.now() - timedelta(hours=1)
    
    result = loki_client.query_logs(query, start_time=start_time)
    print("Loki日志查询结果:")
    print(json.dumps(result, indent=2, default=str))
    
    # 获取标签值
    components = loki_client.get_label_values("component")
    print("\n组件标签值:")
    print(json.dumps(components, indent=2, default=str))

# 运行演示
# demonstrate_loki_integration()
```

### 9.2.3.2 Promtail配置

```python
# Promtail配置示例
promtail_config = """
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # 分布式文件存储日志收集
  - job_name: dfs-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: dfs
          __path__: /var/log/dfs/*.log
          service: dfs-storage
    
    pipeline_stages:
      # 解析JSON日志
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            component: component
            node_id: node_id
            context: context
    
      # 设置时间戳
      - timestamp:
          source: timestamp
          format: RFC3339
    
      # 提取上下文标签
      - labels:
          level:
          component:
          node_id:
    
      # 输出格式化
      - output:
          source: message

  # 系统日志收集
  - job_name: system-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: system
          __path__: /var/log/syslog
          service: system
    
    pipeline_stages:
      - regex:
          expression: '.*(?P<timestamp>(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z?))\\s+(?P<level>\\w+)\\s+(?P<message>.*)'
      - timestamp:
          source: timestamp
          format: RFC3339
      - labels:
          level:

# 全局配置
limits_config:
  readline_rate: 10000
  readline_rate_burst: 100000
  readline_rate_drop: true

"""

print("Promtail配置示例:")
print(promtail_config)
```

## 9.2.4 日志分析与告警

日志分析和告警是日志平台的重要功能，能够帮助我们及时发现系统异常并采取相应措施。

### 9.2.4.1 日志分析器

```python
# 日志分析器实现
import re
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import json
import statistics

class LogAnalyzer:
    """日志分析器"""
    
    def __init__(self):
        # 错误模式定义
        self.error_patterns = [
            (r"ERROR", "error"),
            (r"CRITICAL", "critical"),
            (r"FATAL", "fatal"),
            (r"exception", "exception"),
            (r"timeout", "timeout"),
            (r"connection refused", "connection_error"),
            (r"out of memory", "oom"),
            (r"disk full", "disk_full")
        ]
        
        # 警告模式定义
        self.warning_patterns = [
            (r"WARNING", "warning"),
            (r"disk usage.*[8-9]\d%", "high_disk_usage"),
            (r"memory usage.*[8-9]\d%", "high_memory_usage"),
            (r"high latency", "high_latency"),
            (r"slow query", "slow_query")
        ]
        
        # 性能模式定义
        self.performance_patterns = [
            (r"latency: (\d+)ms", "latency"),
            (r"response_time: (\d+)ms", "response_time"),
            (r"throughput: (\d+) ops/sec", "throughput")
        ]
    
    def analyze_logs(self, logs: List[Dict[str, Any]], 
                    time_window_hours: int = 1) -> Dict[str, Any]:
        """分析日志"""
        if not logs:
            return {"message": "无日志数据"}
        
        # 过滤时间窗口内的日志
        cutoff_time = datetime.now() - timedelta(hours=time_window_hours)
        recent_logs = [
            log for log in logs 
            if datetime.fromisoformat(log["timestamp"].replace('Z', '+00:00')) >= cutoff_time
        ]
        
        if not recent_logs:
            return {"message": "时间窗口内无日志"}
        
        # 分析错误和警告
        error_analysis = self._analyze_errors(recent_logs)
        warning_analysis = self._analyze_warnings(recent_logs)
        
        # 分析性能指标
        performance_analysis = self._analyze_performance(recent_logs)
        
        # 分析组件活跃度
        component_analysis = self._analyze_components(recent_logs)
        
        # 分析节点健康状况
        node_analysis = self._analyze_nodes(recent_logs)
        
        return {
            "time_window_hours": time_window_hours,
            "total_logs": len(recent_logs),
            "errors": error_analysis,
            "warnings": warning_analysis,
            "performance": performance_analysis,
            "components": component_analysis,
            "nodes": node_analysis,
            "analysis_time": datetime.now().isoformat()
        }
    
    def _analyze_errors(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析错误日志"""
        error_logs = [log for log in logs if self._is_error_level(log)]
        
        # 按错误类型分类
        error_types = {}
        for log in error_logs:
            message = log["message"].lower()
            matched = False
            
            for pattern, error_type in self.error_patterns:
                if re.search(pattern, message, re.IGNORECASE):
                    error_types[error_type] = error_types.get(error_type, 0) + 1
                    matched = True
            
            if not matched:
                error_types["other"] = error_types.get("other", 0) + 1
        
        return {
            "total_errors": len(error_logs),
            "error_rate": len(error_logs) / len(logs) * 100,
            "error_types": error_types,
            "top_error_components": self._get_top_components(error_logs)
        }
    
    def _analyze_warnings(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析警告日志"""
        warning_logs = [log for log in logs if log["level"] == "WARNING"]
        
        # 按警告类型分类
        warning_types = {}
        for log in warning_logs:
            message = log["message"].lower()
            matched = False
            
            for pattern, warning_type in self.warning_patterns:
                if re.search(pattern, message, re.IGNORECASE):
                    warning_types[warning_type] = warning_types.get(warning_type, 0) + 1
                    matched = True
            
            if not matched:
                warning_types["other"] = warning_types.get("other", 0) + 1
        
        return {
            "total_warnings": len(warning_logs),
            "warning_rate": len(warning_logs) / len(logs) * 100,
            "warning_types": warning_types,
            "top_warning_components": self._get_top_components(warning_logs)
        }
    
    def _analyze_performance(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析性能相关日志"""
        performance_data = {
            "latencies": [],
            "response_times": [],
            "throughputs": []
        }
        
        for log in logs:
            message = log["message"]
            
            # 提取延迟数据
            latency_match = re.search(r"latency: (\d+)ms", message)
            if latency_match:
                performance_data["latencies"].append(int(latency_match.group(1)))
            
            # 提取响应时间数据
            response_match = re.search(r"response_time: (\d+)ms", message)
            if response_match:
                performance_data["response_times"].append(int(response_match.group(1)))
            
            # 提取吞吐量数据
            throughput_match = re.search(r"throughput: (\d+) ops/sec", message)
            if throughput_match:
                performance_data["throughputs"].append(int(throughput_match.group(1)))
        
        # 计算统计信息
        stats = {}
        for metric_name, values in performance_data.items():
            if values:
                stats[metric_name] = {
                    "count": len(values),
                    "avg": statistics.mean(values),
                    "min": min(values),
                    "max": max(values),
                    "median": statistics.median(values)
                }
        
        return stats
    
    def _analyze_components(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析组件活跃度"""
        component_stats = {}
        
        for log in logs:
            component = log["component"]
            if component not in component_stats:
                component_stats[component] = {
                    "total_logs": 0,
                    "errors": 0,
                    "warnings": 0,
                    "info": 0
                }
            
            component_stats[component]["total_logs"] += 1
            
            if self._is_error_level(log):
                component_stats[component]["errors"] += 1
            elif log["level"] == "WARNING":
                component_stats[component]["warnings"] += 1
            elif log["level"] == "INFO":
                component_stats[component]["info"] += 1
        
        # 计算健康分数
        for component, stats in component_stats.items():
            error_rate = stats["errors"] / stats["total_logs"] if stats["total_logs"] > 0 else 0
            warning_rate = stats["warnings"] / stats["total_logs"] if stats["total_logs"] > 0 else 0
            stats["health_score"] = max(0, 100 - (error_rate * 50 + warning_rate * 25))
        
        return component_stats
    
    def _analyze_nodes(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析节点健康状况"""
        node_stats = {}
        
        for log in logs:
            node_id = log["node_id"]
            if node_id not in node_stats:
                node_stats[node_id] = {
                    "total_logs": 0,
                    "errors": 0,
                    "warnings": 0,
                    "components": set()
                }
            
            node_stats[node_id]["total_logs"] += 1
            node_stats[node_id]["components"].add(log["component"])
            
            if self._is_error_level(log):
                node_stats[node_id]["errors"] += 1
            elif log["level"] == "WARNING":
                node_stats[node_id]["warnings"] += 1
        
        # 计算节点健康分数
        for node_id, stats in node_stats.items():
            error_rate = stats["errors"] / stats["total_logs"] if stats["total_logs"] > 0 else 0
            warning_rate = stats["warnings"] / stats["total_logs"] if stats["total_logs"] > 0 else 0
            stats["health_score"] = max(0, 100 - (error_rate * 50 + warning_rate * 25))
            stats["component_count"] = len(stats["components"])
            del stats["components"]  # 删除集合以便JSON序列化
        
        return node_stats
    
    def _is_error_level(self, log: Dict[str, Any]) -> bool:
        """判断是否为错误级别日志"""
        return log["level"] in ["ERROR", "CRITICAL", "FATAL"]
    
    def _get_top_components(self, logs: List[Dict[str, Any]], top_n: int = 5) -> List[Tuple[str, int]]:
        """获取日志最多的组件"""
        component_counts = {}
        for log in logs:
            component = log["component"]
            component_counts[component] = component_counts.get(component, 0) + 1
        
        return sorted(component_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
    
    def generate_report(self, analysis_result: Dict[str, Any]) -> str:
        """生成分析报告"""
        report = []
        report.append("# 日志分析报告")
        report.append(f"## 分析时间: {analysis_result.get('analysis_time', 'N/A')}")
        report.append(f"## 时间窗口: {analysis_result.get('time_window_hours', 0)} 小时")
        report.append(f"## 总日志数: {analysis_result.get('total_logs', 0)}")
        
        # 错误分析
        errors = analysis_result.get("errors", {})
        if errors:
            report.append("\n## 错误分析")
            report.append(f"- 总错误数: {errors.get('total_errors', 0)}")
            report.append(f"- 错误率: {errors.get('error_rate', 0):.2f}%")
            report.append("- 错误类型分布:")
            for error_type, count in errors.get("error_types", {}).items():
                report.append(f"  - {error_type}: {count}")
        
        # 警告分析
        warnings = analysis_result.get("warnings", {})
        if warnings:
            report.append("\n## 警告分析")
            report.append(f"- 总警告数: {warnings.get('total_warnings', 0)}")
            report.append(f"- 警告率: {warnings.get('warning_rate', 0):.2f}%")
            report.append("- 警告类型分布:")
            for warning_type, count in warnings.get("warning_types", {}).items():
                report.append(f"  - {warning_type}: {count}")
        
        # 性能分析
        performance = analysis_result.get("performance", {})
        if performance:
            report.append("\n## 性能分析")
            for metric, stats in performance.items():
                report.append(f"- {metric}:")
                report.append(f"  - 平均值: {stats.get('avg', 0):.2f}")
                report.append(f"  - 最小值: {stats.get('min', 0)}")
                report.append(f"  - 最大值: {stats.get('max', 0)}")
                report.append(f"  - 中位数: {stats.get('median', 0)}")
        
        # 组件分析
        components = analysis_result.get("components", {})
        if components:
            report.append("\n## 组件健康状况")
            for component, stats in components.items():
                report.append(f"- {component}:")
                report.append(f"  - 健康分数: {stats.get('health_score', 0):.2f}")
                report.append(f"  - 总日志数: {stats.get('total_logs', 0)}")
                report.append(f"  - 错误数: {stats.get('errors', 0)}")
                report.append(f"  - 警告数: {stats.get('warnings', 0)}")
        
        return "\n".join(report)

# 使用示例
def demonstrate_log_analysis():
    """演示日志分析"""
    analyzer = LogAnalyzer()
    
    # 模拟一些日志数据
    sample_logs = [
        {
            "timestamp": (datetime.now() - timedelta(minutes=30)).isoformat(),
            "level": "INFO",
            "message": "文件读取成功",
            "component": "storage",
            "node_id": "node-001"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=25)).isoformat(),
            "level": "WARNING",
            "message": "磁盘使用率超过85%",
            "component": "storage",
            "node_id": "node-001"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=20)).isoformat(),
            "level": "ERROR",
            "message": "数据库连接超时",
            "component": "database",
            "node_id": "node-002"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat(),
            "level": "ERROR",
            "message": "网络连接被拒绝",
            "component": "network",
            "node_id": "node-001"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=10)).isoformat(),
            "level": "WARNING",
            "message": "内存使用率过高",
            "component": "memory",
            "node_id": "node-003"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(),
            "level": "INFO",
            "message": "latency: 45ms, response_time: 65ms, throughput: 1200 ops/sec",
            "component": "api",
            "node_id": "node-001"
        }
    ]
    
    # 分析日志
    analysis_result = analyzer.analyze_logs(sample_logs, time_window_hours=1)
    print("日志分析结果:")
    print(json.dumps(analysis_result, indent=2, ensure_ascii=False))
    
    # 生成报告
    report = analyzer.generate_report(analysis_result)
    print("\n分析报告:")
    print(report)

# 运行演示
# demonstrate_log_analysis()
```

### 9.2.4.2 日志告警系统

```python
# 日志告警系统实现
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime, timedelta
import time
import threading
import json

class LogAlertRule:
    """日志告警规则"""
    
    def __init__(self, rule_id: str, name: str, description: str,
                 pattern: str, severity: str = "warning",
                 threshold: int = 1, time_window_sec: int = 300,
                 enabled: bool = True):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.pattern = pattern
        self.severity = severity
        self.threshold = threshold
        self.time_window_sec = time_window_sec
        self.enabled = enabled
        self.trigger_count = 0
        self.last_trigger_time: Optional[datetime] = None

class LogAlert:
    """日志告警"""
    
    def __init__(self, rule_id: str, message: str, 
                 severity: str, timestamp: datetime,
                 matched_logs: List[Dict[str, Any]]):
        self.alert_id = str(uuid.uuid4())
        self.rule_id = rule_id
        self.message = message
        self.severity = severity
        self.timestamp = timestamp
        self.matched_logs = matched_logs
        self.status = "firing"  # firing, resolved, suppressed

class LogAlertManager:
    """日志告警管理器"""
    
    def __init__(self):
        self.rules: Dict[str, LogAlertRule] = {}
        self.active_alerts: Dict[str, LogAlert] = {}
        self.alert_history: List[LogAlert] = []
        self.notification_callbacks: List[Callable] = []
        self.log_buffer: List[Dict[str, Any]] = []
        self.buffer_lock = threading.Lock()
        self.evaluation_interval_sec = 60
        self.running = False
        self.evaluation_thread = None
    
    def add_rule(self, rule: LogAlertRule):
        """添加告警规则"""
        self.rules[rule.rule_id] = rule
        print(f"日志告警规则已添加: {rule.name}")
    
    def remove_rule(self, rule_id: str):
        """移除告警规则"""
        if rule_id in self.rules:
            del self.rules[rule_id]
            print(f"日志告警规则已移除: {rule_id}")
    
    def add_notification_callback(self, callback: Callable):
        """添加通知回调"""
        self.notification_callbacks.append(callback)
    
    def ingest_log(self, log_entry: Dict[str, Any]):
        """摄入日志条目"""
        with self.buffer_lock:
            self.log_buffer.append(log_entry)
            
            # 限制缓冲区大小
            if len(self.log_buffer) > 10000:
                self.log_buffer = self.log_buffer[-10000:]
    
    def start_evaluation(self):
        """启动告警评估"""
        self.running = True
        self.evaluation_thread = threading.Thread(target=self._evaluation_loop)
        self.evaluation_thread.daemon = True
        self.evaluation_thread.start()
        print("日志告警评估已启动")
    
    def stop_evaluation(self):
        """停止告警评估"""
        self.running = False
        if self.evaluation_thread:
            self.evaluation_thread.join(timeout=5)
        print("日志告警评估已停止")
    
    def _evaluation_loop(self):
        """告警评估循环"""
        while self.running:
            try:
                self._evaluate_rules()
                time.sleep(self.evaluation_interval_sec)
            except Exception as e:
                print(f"日志告警评估出错: {e}")
    
    def _evaluate_rules(self):
        """评估所有规则"""
        current_time = datetime.now()
        
        with self.buffer_lock:
            # 创建缓冲区副本以避免锁定期间的修改
            buffer_copy = self.log_buffer.copy()
        
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            
            # 过滤时间窗口内的日志
            cutoff_time = current_time - timedelta(seconds=rule.time_window_sec)
            recent_logs = [
                log for log in buffer_copy
                if datetime.fromisoformat(log["timestamp"].replace('Z', '+00:00')) >= cutoff_time
            ]
            
            # 匹配规则模式
            matched_logs = []
            for log in recent_logs:
                if re.search(rule.pattern, log["message"], re.IGNORECASE):
                    matched_logs.append(log)
            
            # 检查是否触发告警
            if len(matched_logs) >= rule.threshold:
                self._trigger_alert(rule, matched_logs, current_time)
    
    def _trigger_alert(self, rule: LogAlertRule, matched_logs: List[Dict[str, Any]], 
                      current_time: datetime):
        """触发告警"""
        # 检查是否在静默期内
        if rule.last_trigger_time:
            time_since_last = (current_time - rule.last_trigger_time).total_seconds()
            if time_since_last < rule.time_window_sec:
                return
        
        # 创建告警
        alert_message = f"日志告警: {rule.name} - 匹配到 {len(matched_logs)} 条日志"
        alert = LogAlert(
            rule_id=rule.rule_id,
            message=alert_message,
            severity=rule.severity,
            timestamp=current_time,
            matched_logs=matched_logs
        )
        
        # 添加到活动告警
        self.active_alerts[alert.alert_id] = alert
        
        # 更新规则状态
        rule.trigger_count += 1
        rule.last_trigger_time = current_time
        
        # 添加到历史记录
        self.alert_history.append(alert)
        
        # 通知
        self._notify_alert(alert)
        
        print(f"日志告警已触发: {alert.message}")
    
    def _notify_alert(self, alert: LogAlert):
        """通知告警"""
        for callback in self.notification_callbacks:
            try:
                callback(alert)
            except Exception as e:
                print(f"日志告警通知回调出错: {e}")
    
    def get_active_alerts(self) -> List[LogAlert]:
        """获取活动告警"""
        return list(self.active_alerts.values())
    
    def get_alert_history(self, hours: int = 24) -> List[LogAlert]:
        """获取告警历史"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [alert for alert in self.alert_history 
                if alert.timestamp >= cutoff_time]

# 使用示例
def demonstrate_log_alerting():
    """演示日志告警"""
    # 创建告警管理器
    alert_manager = LogAlertManager()
    
    # 添加告警规则
    error_rule = LogAlertRule(
        rule_id="error_logs",
        name="错误日志告警",
        description="检测到大量错误日志",
        pattern=r"ERROR|CRITICAL|FATAL",
        severity="error",
        threshold=5,
        time_window_sec=300
    )
    
    disk_warning_rule = LogAlertRule(
        rule_id="disk_warning",
        name="磁盘警告告警",
        description="检测到磁盘使用率警告",
        pattern=r"disk usage.*[8-9]\d%",
        severity="warning",
        threshold=3,
        time_window_sec=600
    )
    
    alert_manager.add_rule(error_rule)
    alert_manager.add_rule(disk_warning_rule)
    
    # 添加通知回调
    def notification_callback(alert: LogAlert):
        print(f"[{alert.severity.upper()}] {alert.message}")
        print(f"匹配日志数: {len(alert.matched_logs)}")
    
    alert_manager.add_notification_callback(notification_callback)
    
    # 模拟摄入一些日志
    sample_logs = [
        {
            "timestamp": (datetime.now() - timedelta(minutes=2)).isoformat(),
            "level": "ERROR",
            "message": "数据库连接失败",
            "component": "database",
            "node_id": "node-001"
        },
        {
            "timestamp": (datetime.now() - timedelta(minutes=1)).isoformat(),
            "level": "ERROR",
            "message": "网络超时",
            "component": "network",
            "node_id": "node-002"
        },
        {
            "timestamp": datetime.now().isoformat(),
            "level": "WARNING",
            "message": "磁盘使用率超过85%",
            "component": "storage",
            "node_id": "node-001"
        }
    ]
    
    for log in sample_logs:
        alert_manager.ingest_log(log)
    
    # 启动评估（实际使用中会持续运行）
    alert_manager.start_evaluation()
    
    # 等待一段时间观察告警
    time.sleep(2)
    
    # 停止评估
    alert_manager.stop_evaluation()
    
    # 查看活动告警
    active_alerts = alert_manager.get_active_alerts()
    print(f"\n活动告警数量: {len(active_alerts)}")

# 运行演示
# demonstrate_log_alerting()
```

## 总结

日志收集与分析是分布式文件存储平台可观测性体系的重要组成部分。通过集成ELK或Loki等日志平台，我们可以实现：

1. **统一的日志收集**：从各个节点和组件收集日志，确保日志的完整性和一致性。

2. **高效的日志存储**：利用Elasticsearch或Loki的高性能存储能力，支持大规模日志数据的存储和检索。

3. **强大的日志分析**：通过日志分析器，我们可以发现系统中的异常模式、性能瓶颈和潜在问题。

4. **及时的告警机制**：基于日志内容的告警规则，能够及时发现并通知系统异常。

在实际部署中，需要根据系统的规模、性能要求和资源限制选择合适的日志平台方案。ELK Stack功能强大但资源消耗较大，适合大型系统；Loki轻量级且云原生友好，适合资源受限的环境。