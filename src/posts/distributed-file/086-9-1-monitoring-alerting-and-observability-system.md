---
title: 监控、告警与可观测性体系
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台的运维生命周期中，监控、告警与可观测性体系是确保系统稳定运行和快速故障定位的关键基础设施。随着系统规模的扩大和复杂性的增加，传统的被动式运维模式已无法满足现代分布式系统的需求。一个完善的可观测性体系不仅能够实时反映系统的健康状态，还能通过数据驱动的方式帮助运维人员预测潜在问题，实现从被动响应到主动预防的转变。

## 9.1 监控指标体系建设：节点、集群、业务层面核心 metrics（容量、IOPS、吞吐、延迟）

监控指标是系统可观测性的基础，通过对关键指标的持续采集和分析，我们可以全面了解系统的运行状态。在分布式文件存储平台中，监控指标体系需要覆盖从底层硬件到上层业务的各个层面。

### 9.1.1 节点层面监控指标

```python
# 节点监控指标采集示例
import psutil
import time
from typing import Dict, Any
import json

class NodeMetricsCollector:
    """节点监控指标采集器"""
    
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.metrics = {}
    
    def collect_cpu_metrics(self) -> Dict[str, Any]:
        """采集CPU相关指标"""
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        return {
            "cpu_utilization": cpu_percent,
            "cpu_count": cpu_count,
            "cpu_frequency": cpu_freq.current if cpu_freq else 0,
            "cpu_max_frequency": cpu_freq.max if cpu_freq else 0
        }
    
    def collect_memory_metrics(self) -> Dict[str, Any]:
        """采集内存相关指标"""
        memory = psutil.virtual_memory()
        
        return {
            "memory_total_bytes": memory.total,
            "memory_available_bytes": memory.available,
            "memory_used_bytes": memory.used,
            "memory_utilization": memory.percent,
            "memory_cached_bytes": memory.cached,
            "memory_buffers_bytes": memory.buffers
        }
    
    def collect_disk_metrics(self) -> Dict[str, Any]:
        """采集磁盘相关指标"""
        disk_io = psutil.disk_io_counters()
        disk_usage = psutil.disk_usage("/")
        
        return {
            "disk_read_bytes": disk_io.read_bytes,
            "disk_write_bytes": disk_io.write_bytes,
            "disk_read_count": disk_io.read_count,
            "disk_write_count": disk_io.write_count,
            "disk_read_time_ms": disk_io.read_time,
            "disk_write_time_ms": disk_io.write_time,
            "disk_total_bytes": disk_usage.total,
            "disk_used_bytes": disk_usage.used,
            "disk_free_bytes": disk_usage.free,
            "disk_utilization": disk_usage.percent
        }
    
    def collect_network_metrics(self) -> Dict[str, Any]:
        """采集网络相关指标"""
        net_io = psutil.net_io_counters()
        
        return {
            "network_bytes_sent": net_io.bytes_sent,
            "network_bytes_recv": net_io.bytes_recv,
            "network_packets_sent": net_io.packets_sent,
            "network_packets_recv": net_io.packets_recv,
            "network_errin": net_io.errin,
            "network_errout": net_io.errout,
            "network_dropin": net_io.dropin,
            "network_dropout": net_io.dropout
        }
    
    def collect_all_metrics(self) -> Dict[str, Any]:
        """采集所有节点指标"""
        metrics = {
            "node_id": self.node_id,
            "timestamp": time.time(),
            "cpu": self.collect_cpu_metrics(),
            "memory": self.collect_memory_metrics(),
            "disk": self.collect_disk_metrics(),
            "network": self.collect_network_metrics()
        }
        
        self.metrics = metrics
        return metrics
    
    def export_metrics(self, format: str = "json") -> str:
        """导出指标数据"""
        if format.lower() == "json":
            return json.dumps(self.metrics, indent=2)
        else:
            return str(self.metrics)

# 使用示例
collector = NodeMetricsCollector("node-001")
metrics = collector.collect_all_metrics()
print(json.dumps(metrics, indent=2))
```

### 9.1.2 集群层面监控指标

```python
# 集群监控指标聚合示例
from typing import List, Dict, Any
import statistics
from datetime import datetime

class ClusterMetricsAggregator:
    """集群监控指标聚合器"""
    
    def __init__(self):
        self.node_metrics_history = {}
    
    def add_node_metrics(self, node_id: str, metrics: Dict[str, Any]):
        """添加节点指标"""
        if node_id not in self.node_metrics_history:
            self.node_metrics_history[node_id] = []
        
        self.node_metrics_history[node_id].append({
            "timestamp": datetime.now().timestamp(),
            "metrics": metrics
        })
        
        # 保留最近100条记录
        if len(self.node_metrics_history[node_id]) > 100:
            self.node_metrics_history[node_id].pop(0)
    
    def aggregate_cpu_metrics(self) -> Dict[str, Any]:
        """聚合CPU指标"""
        cpu_utils = []
        cpu_freqs = []
        
        for node_id, history in self.node_metrics_history.items():
            if history:
                latest_metrics = history[-1]["metrics"]
                cpu_utils.append(latest_metrics["cpu"]["cpu_utilization"])
                cpu_freqs.append(latest_metrics["cpu"]["cpu_frequency"])
        
        if not cpu_utils:
            return {}
        
        return {
            "avg_cpu_utilization": statistics.mean(cpu_utils),
            "max_cpu_utilization": max(cpu_utils),
            "min_cpu_utilization": min(cpu_utils),
            "cpu_utilization_stddev": statistics.stdev(cpu_utils) if len(cpu_utils) > 1 else 0,
            "avg_cpu_frequency": statistics.mean(cpu_freqs) if cpu_freqs else 0
        }
    
    def aggregate_memory_metrics(self) -> Dict[str, Any]:
        """聚合内存指标"""
        mem_utils = []
        mem_used_bytes = []
        
        for node_id, history in self.node_metrics_history.items():
            if history:
                latest_metrics = history[-1]["metrics"]
                mem_utils.append(latest_metrics["memory"]["memory_utilization"])
                mem_used_bytes.append(latest_metrics["memory"]["memory_used_bytes"])
        
        if not mem_utils:
            return {}
        
        return {
            "avg_memory_utilization": statistics.mean(mem_utils),
            "max_memory_utilization": max(mem_utils),
            "min_memory_utilization": min(mem_utils),
            "total_memory_used_bytes": sum(mem_used_bytes),
            "memory_utilization_stddev": statistics.stdev(mem_utils) if len(mem_utils) > 1 else 0
        }
    
    def aggregate_disk_metrics(self) -> Dict[str, Any]:
        """聚合磁盘指标"""
        disk_utils = []
        disk_iops = []
        disk_throughput_read = []
        disk_throughput_write = []
        
        for node_id, history in self.node_metrics_history.items():
            if len(history) >= 2:
                # 计算IOPS和吞吐量
                latest = history[-1]["metrics"]["disk"]
                previous = history[-2]["metrics"]["disk"]
                
                time_diff = history[-1]["timestamp"] - history[-2]["timestamp"]
                
                if time_diff > 0:
                    read_iops = (latest["disk_read_count"] - previous["disk_read_count"]) / time_diff
                    write_iops = (latest["disk_write_count"] - previous["disk_write_count"]) / time_diff
                    read_throughput = (latest["disk_read_bytes"] - previous["disk_read_bytes"]) / time_diff
                    write_throughput = (latest["disk_write_bytes"] - previous["disk_write_bytes"]) / time_diff
                    
                    disk_iops.append(read_iops + write_iops)
                    disk_throughput_read.append(read_throughput)
                    disk_throughput_write.append(write_throughput)
                
                disk_utils.append(latest["disk_utilization"])
        
        if not disk_utils:
            return {}
        
        return {
            "avg_disk_utilization": statistics.mean(disk_utils),
            "max_disk_utilization": max(disk_utils),
            "min_disk_utilization": min(disk_utils),
            "avg_total_iops": statistics.mean(disk_iops) if disk_iops else 0,
            "avg_read_iops": statistics.mean(disk_throughput_read) if disk_throughput_read else 0,
            "avg_write_iops": statistics.mean(disk_throughput_write) if disk_throughput_write else 0,
            "avg_read_throughput_bytes_per_sec": statistics.mean(disk_throughput_read) if disk_throughput_read else 0,
            "avg_write_throughput_bytes_per_sec": statistics.mean(disk_throughput_write) if disk_throughput_write else 0
        }
    
    def aggregate_network_metrics(self) -> Dict[str, Any]:
        """聚合网络指标"""
        network_throughput_in = []
        network_throughput_out = []
        
        for node_id, history in self.node_metrics_history.items():
            if len(history) >= 2:
                latest = history[-1]["metrics"]["network"]
                previous = history[-2]["metrics"]["network"]
                
                time_diff = history[-1]["timestamp"] - history[-2]["timestamp"]
                
                if time_diff > 0:
                    throughput_in = (latest["network_bytes_recv"] - previous["network_bytes_recv"]) / time_diff
                    throughput_out = (latest["network_bytes_sent"] - previous["network_bytes_sent"]) / time_diff
                    
                    network_throughput_in.append(throughput_in)
                    network_throughput_out.append(throughput_out)
        
        return {
            "avg_network_in_throughput_bytes_per_sec": statistics.mean(network_throughput_in) if network_throughput_in else 0,
            "avg_network_out_throughput_bytes_per_sec": statistics.mean(network_throughput_out) if network_throughput_out else 0,
            "total_network_in_bytes": sum([history[-1]["metrics"]["network"]["network_bytes_recv"] 
                                         for history in self.node_metrics_history.values() if history]),
            "total_network_out_bytes": sum([history[-1]["metrics"]["network"]["network_bytes_sent"] 
                                          for history in self.node_metrics_history.values() if history])
        }
    
    def get_cluster_health_summary(self) -> Dict[str, Any]:
        """获取集群健康摘要"""
        return {
            "timestamp": datetime.now().isoformat(),
            "node_count": len(self.node_metrics_history),
            "active_nodes": len([history for history in self.node_metrics_history.values() if history]),
            "cpu": self.aggregate_cpu_metrics(),
            "memory": self.aggregate_memory_metrics(),
            "disk": self.aggregate_disk_metrics(),
            "network": self.aggregate_network_metrics()
        }

# 使用示例
aggregator = ClusterMetricsAggregator()

# 模拟添加节点指标
sample_metrics_node1 = {
    "cpu": {"cpu_utilization": 45.2, "cpu_frequency": 2400},
    "memory": {"memory_utilization": 65.8, "memory_used_bytes": 8589934592},
    "disk": {
        "disk_utilization": 72.1,
        "disk_read_count": 1000000,
        "disk_write_count": 500000,
        "disk_read_bytes": 10737418240,
        "disk_write_bytes": 5368709120
    },
    "network": {
        "network_bytes_sent": 2147483648,
        "network_bytes_recv": 4294967296
    }
}

sample_metrics_node2 = {
    "cpu": {"cpu_utilization": 38.7, "cpu_frequency": 2300},
    "memory": {"memory_utilization": 58.3, "memory_used_bytes": 7516192768},
    "disk": {
        "disk_utilization": 65.4,
        "disk_read_count": 800000,
        "disk_write_count": 400000,
        "disk_read_bytes": 8589934592,
        "disk_write_bytes": 4294967296
    },
    "network": {
        "network_bytes_sent": 1073741824,
        "network_bytes_recv": 3221225472
    }
}

aggregator.add_node_metrics("node-001", sample_metrics_node1)
aggregator.add_node_metrics("node-002", sample_metrics_node2)

# 获取集群健康摘要
health_summary = aggregator.get_cluster_health_summary()
print(json.dumps(health_summary, indent=2))
```

### 9.1.3 业务层面监控指标

```python
# 业务监控指标实现示例
from typing import Dict, List, Any
import time
import statistics

class BusinessMetricsCollector:
    """业务监控指标采集器"""
    
    def __init__(self):
        self.request_metrics = []
        self.storage_metrics = {}
        self.client_metrics = {}
    
    def record_request(self, operation: str, duration_ms: float, success: bool = True, 
                      bytes_transferred: int = 0):
        """记录请求指标"""
        self.request_metrics.append({
            "operation": operation,
            "duration_ms": duration_ms,
            "success": success,
            "bytes_transferred": bytes_transferred,
            "timestamp": time.time()
        })
        
        # 保留最近10000条记录
        if len(self.request_metrics) > 10000:
            self.request_metrics = self.request_metrics[-10000:]
    
    def update_storage_metrics(self, total_capacity_bytes: int, used_capacity_bytes: int,
                              file_count: int, directory_count: int):
        """更新存储指标"""
        self.storage_metrics = {
            "total_capacity_bytes": total_capacity_bytes,
            "used_capacity_bytes": used_capacity_bytes,
            "free_capacity_bytes": total_capacity_bytes - used_capacity_bytes,
            "utilization_percent": (used_capacity_bytes / total_capacity_bytes * 100) if total_capacity_bytes > 0 else 0,
            "file_count": file_count,
            "directory_count": directory_count,
            "timestamp": time.time()
        }
    
    def update_client_metrics(self, active_connections: int, total_connections: int,
                            failed_connections: int, avg_session_duration_sec: float):
        """更新客户端指标"""
        self.client_metrics = {
            "active_connections": active_connections,
            "total_connections": total_connections,
            "failed_connections": failed_connections,
            "connection_success_rate": ((total_connections - failed_connections) / total_connections * 100) 
                                     if total_connections > 0 else 0,
            "avg_session_duration_sec": avg_session_duration_sec,
            "timestamp": time.time()
        }
    
    def get_request_metrics_summary(self, operation: str = None, 
                                  time_window_sec: int = 300) -> Dict[str, Any]:
        """获取请求指标摘要"""
        current_time = time.time()
        cutoff_time = current_time - time_window_sec
        
        # 过滤时间窗口内的指标
        recent_metrics = [
            m for m in self.request_metrics 
            if m["timestamp"] >= cutoff_time and (operation is None or m["operation"] == operation)
        ]
        
        if not recent_metrics:
            return {}
        
        # 按操作类型分组
        operation_metrics = {}
        for metric in recent_metrics:
            op = metric["operation"]
            if op not in operation_metrics:
                operation_metrics[op] = []
            operation_metrics[op].append(metric)
        
        # 计算每个操作类型的指标
        summary = {}
        for op, metrics in operation_metrics.items():
            durations = [m["duration_ms"] for m in metrics]
            successes = [m["success"] for m in metrics]
            bytes_transferred = [m["bytes_transferred"] for m in metrics if m["bytes_transferred"] > 0]
            
            op_summary = {
                "operation": op,
                "request_count": len(metrics),
                "success_rate": (sum(successes) / len(successes)) * 100,
                "avg_latency_ms": statistics.mean(durations),
                "p50_latency_ms": statistics.median(durations),
                "p95_latency_ms": self._percentile(durations, 95),
                "p99_latency_ms": self._percentile(durations, 99),
                "max_latency_ms": max(durations),
                "min_latency_ms": min(durations),
                "total_bytes_transferred": sum(bytes_transferred),
                "avg_throughput_bytes_per_sec": sum(bytes_transferred) / time_window_sec if bytes_transferred else 0
            }
            
            summary[op] = op_summary
        
        return summary
    
    def get_storage_metrics_summary(self) -> Dict[str, Any]:
        """获取存储指标摘要"""
        return self.storage_metrics
    
    def get_client_metrics_summary(self) -> Dict[str, Any]:
        """获取客户端指标摘要"""
        return self.client_metrics
    
    def get_business_health_summary(self, time_window_sec: int = 300) -> Dict[str, Any]:
        """获取业务健康摘要"""
        return {
            "timestamp": time.time(),
            "requests": self.get_request_metrics_summary(time_window_sec=time_window_sec),
            "storage": self.get_storage_metrics_summary(),
            "clients": self.get_client_metrics_summary()
        }
    
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
collector = BusinessMetricsCollector()

# 模拟记录一些请求
collector.record_request("read", 15.2, True, 1024000)
collector.record_request("read", 12.8, True, 2048000)
collector.record_request("write", 25.7, True, 512000)
collector.record_request("read", 18.3, False, 0)  # 失败的请求
collector.record_request("delete", 8.1, True, 0)

# 更新存储指标
collector.update_storage_metrics(
    total_capacity_bytes=1099511627776,  # 1TB
    used_capacity_bytes=751619276800,    # 700GB
    file_count=1000000,
    directory_count=50000
)

# 更新客户端指标
collector.update_client_metrics(
    active_connections=150,
    total_connections=200,
    failed_connections=5,
    avg_session_duration_sec=1800  # 30分钟
)

# 获取业务健康摘要
business_summary = collector.get_business_health_summary()
print(json.dumps(business_summary, indent=2))
```

## 9.2 日志收集与分析：基于ELK/Loki的日志平台集成

日志是系统运行状态的重要记录，通过有效的日志收集和分析，我们可以深入了解系统的内部行为，快速定位问题根源。在分布式文件存储平台中，日志收集需要考虑高并发、大容量和实时性等挑战。

### 9.2.1 日志收集架构设计

```python
# 日志收集器实现示例
import logging
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
import queue
import threading

class DistributedLogCollector:
    """分布式日志收集器"""
    
    def __init__(self, node_id: str, collector_id: str):
        self.node_id = node_id
        self.collector_id = collector_id
        self.log_queue = queue.Queue(maxsize=10000)
        self.processing_thread = None
        self.running = False
        
        # 配置日志格式
        self.logger = logging.getLogger(f"dfs.{node_id}.{collector_id}")
        self.logger.setLevel(logging.INFO)
        
        # 创建格式化器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
    
    def start_collection(self):
        """启动日志收集"""
        self.running = True
        self.processing_thread = threading.Thread(target=self._process_logs)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        
        self.logger.info(f"日志收集器 {self.collector_id} 已启动")
    
    def stop_collection(self):
        """停止日志收集"""
        self.running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
        
        self.logger.info(f"日志收集器 {self.collector_id} 已停止")
    
    def collect_log(self, level: str, message: str, component: str, 
                   context: Optional[Dict[str, Any]] = None):
        """收集日志"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "node_id": self.node_id,
            "collector_id": self.collector_id,
            "level": level.upper(),
            "component": component,
            "message": message,
            "context": context or {},
            "thread_id": threading.current_thread().ident
        }
        
        try:
            self.log_queue.put_nowait(log_entry)
        except queue.Full:
            self.logger.warning("日志队列已满，丢弃日志条目")
    
    def _process_logs(self):
        """处理日志队列"""
        while self.running:
            try:
                log_entry = self.log_queue.get(timeout=1)
                self._send_log(log_entry)
                self.log_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                self.logger.error(f"处理日志时出错: {e}")
    
    def _send_log(self, log_entry: Dict[str, Any]):
        """发送日志到收集系统"""
        # 这里简化实现，实际可以发送到ELK、Loki或其他日志收集系统
        formatted_log = json.dumps(log_entry, ensure_ascii=False)
        
        # 根据日志级别记录到不同级别的日志中
        level = log_entry["level"].upper()
        if level == "ERROR":
            self.logger.error(formatted_log)
        elif level == "WARNING":
            self.logger.warning(formatted_log)
        elif level == "INFO":
            self.logger.info(formatted_log)
        elif level == "DEBUG":
            self.logger.debug(formatted_log)
        else:
            self.logger.info(formatted_log)

# 日志发送器实现
class LogForwarder:
    """日志转发器"""
    
    def __init__(self, target_system: str = "elk"):
        self.target_system = target_system
        self.batch_size = 100
        self.batch_timeout_sec = 5
        self.log_buffer = []
        self.last_send_time = time.time()
        
        self.logger = logging.getLogger("dfs.log_forwarder")
        self.logger.setLevel(logging.INFO)
    
    def add_log(self, log_entry: Dict[str, Any]):
        """添加日志到缓冲区"""
        self.log_buffer.append(log_entry)
        
        # 检查是否需要发送
        current_time = time.time()
        if (len(self.log_buffer) >= self.batch_size or 
            current_time - self.last_send_time >= self.batch_timeout_sec):
            self._send_batch()
    
    def _send_batch(self):
        """发送日志批次"""
        if not self.log_buffer:
            return
        
        try:
            if self.target_system.lower() == "elk":
                self._send_to_elk(self.log_buffer)
            elif self.target_system.lower() == "loki":
                self._send_to_loki(self.log_buffer)
            else:
                self._send_to_default(self.log_buffer)
            
            self.logger.info(f"成功发送 {len(self.log_buffer)} 条日志到 {self.target_system}")
            self.log_buffer.clear()
            self.last_send_time = time.time()
        except Exception as e:
            self.logger.error(f"发送日志批次失败: {e}")
    
    def _send_to_elk(self, logs: List[Dict[str, Any]]):
        """发送到ELK系统"""
        # 这里简化实现，实际需要使用Elasticsearch客户端
        bulk_data = []
        for log in logs:
            bulk_data.append({
                "index": {
                    "_index": f"dfs-logs-{datetime.now().strftime('%Y.%m.%d')}",
                    "_type": "_doc"
                }
            })
            bulk_data.append(log)
        
        # 实际实现示例：
        # from elasticsearch import Elasticsearch
        # es = Elasticsearch(['localhost:9200'])
        # es.bulk(body=bulk_data)
        
        self.logger.debug(f"准备发送 {len(bulk_data)} 条记录到ELK")
    
    def _send_to_loki(self, logs: List[Dict[str, Any]]):
        """发送到Loki系统"""
        # 这里简化实现，实际需要使用Loki API
        # 实际实现示例：
        # import requests
        # streams = []
        # for log in logs:
        #     stream = {
        #         "stream": {
        #             "job": "dfs",
        #             "node": log["node_id"],
        #             "level": log["level"]
        #         },
        #         "values": [[str(int(time.time() * 1e9)), json.dumps(log)]]
        #     }
        #     streams.append(stream)
        # 
        # payload = {"streams": streams}
        # requests.post("http://loki:3100/loki/api/v1/push", json=payload)
        
        self.logger.debug(f"准备发送 {len(logs)} 条记录到Loki")
    
    def _send_to_default(self, logs: List[Dict[str, Any]]):
        """发送到默认系统（文件或标准输出）"""
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))

# 使用示例
collector = DistributedLogCollector("node-001", "main-collector")
collector.start_collection()

# 模拟收集一些日志
collector.collect_log("INFO", "系统启动完成", "system", {"version": "2.1.0"})
collector.collect_log("WARNING", "磁盘使用率超过80%", "storage", {"usage": 85.2})
collector.collect_log("ERROR", "数据库连接失败", "database", {"error": "connection timeout"})

# 等待一段时间让日志处理完成
time.sleep(2)

collector.stop_collection()
```

### 9.2.2 日志分析与告警

```python
# 日志分析器实现示例
import re
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import statistics

class LogAnalyzer:
    """日志分析器"""
    
    def __init__(self):
        self.error_patterns = [
            (r"ERROR", "error"),
            (r"CRITICAL", "critical"),
            (r"FATAL", "fatal"),
            (r"exception", "exception"),
            (r"timeout", "timeout"),
            (r"connection refused", "connection_error")
        ]
        
        self.warning_patterns = [
            (r"WARNING", "warning"),
            (r"disk usage.*[8-9]\d%", "high_disk_usage"),
            (r"memory usage.*[8-9]\d%", "high_memory_usage"),
            (r"high latency", "high_latency")
        ]
    
    def analyze_logs(self, logs: List[Dict[str, Any]], 
                    time_window_hours: int = 1) -> Dict[str, Any]:
        """分析日志"""
        cutoff_time = datetime.now() - timedelta(hours=time_window_hours)
        
        # 过滤时间窗口内的日志
        recent_logs = [
            log for log in logs 
            if datetime.fromisoformat(log["timestamp"].replace('Z', '+00:00')) >= cutoff_time
        ]
        
        if not recent_logs:
            return {"message": "时间窗口内无日志"}
        
        # 分析错误和警告
        error_analysis = self._analyze_errors(recent_logs)
        warning_analysis = self._analyze_warnings(recent_logs)
        
        # 分析组件活跃度
        component_analysis = self._analyze_components(recent_logs)
        
        # 分析节点健康状况
        node_analysis = self._analyze_nodes(recent_logs)
        
        return {
            "time_window_hours": time_window_hours,
            "total_logs": len(recent_logs),
            "errors": error_analysis,
            "warnings": warning_analysis,
            "components": component_analysis,
            "nodes": node_analysis,
            "analysis_time": datetime.now().isoformat()
        }
    
    def _analyze_errors(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析错误日志"""
        error_logs = [log for log in logs if log["level"] in ["ERROR", "CRITICAL", "FATAL"]]
        
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
            
            if log["level"] == "ERROR":
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
            
            if log["level"] == "ERROR":
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
    
    def _get_top_components(self, logs: List[Dict[str, Any]], top_n: int = 5) -> List[Tuple[str, int]]:
        """获取日志最多的组件"""
        component_counts = {}
        for log in logs:
            component = log["component"]
            component_counts[component] = component_counts.get(component, 0) + 1
        
        return sorted(component_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]

# 使用示例
analyzer = LogAnalyzer()

# 模拟一些日志数据
sample_logs = [
    {
        "timestamp": (datetime.now() - timedelta(minutes=30)).isoformat(),
        "node_id": "node-001",
        "level": "INFO",
        "component": "storage",
        "message": "文件读取成功"
    },
    {
        "timestamp": (datetime.now() - timedelta(minutes=25)).isoformat(),
        "node_id": "node-001",
        "level": "WARNING",
        "component": "storage",
        "message": "磁盘使用率超过85%"
    },
    {
        "timestamp": (datetime.now() - timedelta(minutes=20)).isoformat(),
        "node_id": "node-002",
        "level": "ERROR",
        "component": "database",
        "message": "数据库连接超时"
    },
    {
        "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat(),
        "node_id": "node-001",
        "level": "ERROR",
        "component": "network",
        "message": "网络连接被拒绝"
    },
    {
        "timestamp": (datetime.now() - timedelta(minutes=10)).isoformat(),
        "node_id": "node-003",
        "level": "WARNING",
        "component": "memory",
        "message": "内存使用率过高"
    }
]

# 分析日志
analysis_result = analyzer.analyze_logs(sample_logs, time_window_hours=1)
print(json.dumps(analysis_result, indent=2, ensure_ascii=False))
```

## 9.3 链路追踪（Tracing）在分布式存储中的应用

链路追踪是分布式系统可观测性的重要组成部分，它能够帮助我们理解请求在系统中的完整流转路径，识别性能瓶颈和故障点。

### 9.3.1 分布式追踪实现

```python
# 分布式追踪实现示例
import uuid
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import threading

class TraceContext:
    """追踪上下文"""
    
    def __init__(self, trace_id: str = None, span_id: str = None, 
                 parent_span_id: str = None, service_name: str = ""):
        self.trace_id = trace_id or str(uuid.uuid4())
        self.span_id = span_id or str(uuid.uuid4())
        self.parent_span_id = parent_span_id
        self.service_name = service_name
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.tags: Dict[str, Any] = {}
        self.logs: List[Dict[str, Any]] = []
        self.finished = False
    
    def set_tag(self, key: str, value: Any):
        """设置标签"""
        self.tags[key] = value
    
    def log_event(self, event: str, payload: Optional[Dict[str, Any]] = None):
        """记录事件"""
        self.logs.append({
            "timestamp": time.time(),
            "event": event,
            "payload": payload or {}
        })
    
    def finish(self):
        """结束追踪"""
        if not self.finished:
            self.end_time = time.time()
            self.finished = True
    
    def duration_ms(self) -> float:
        """获取持续时间（毫秒）"""
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return (time.time() - self.start_time) * 1000
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "service_name": self.service_name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms(),
            "tags": self.tags,
            "logs": self.logs,
            "finished": self.finished
        }

class Tracer:
    """追踪器"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.active_spans: Dict[str, TraceContext] = {}
        self.finished_spans: List[TraceContext] = []
        self.lock = threading.Lock()
    
    def start_span(self, operation_name: str, 
                   parent_context: Optional[TraceContext] = None) -> TraceContext:
        """开始一个新的追踪跨度"""
        with self.lock:
            if parent_context:
                trace_id = parent_context.trace_id
                parent_span_id = parent_context.span_id
            else:
                trace_id = str(uuid.uuid4())
                parent_span_id = None
            
            span = TraceContext(
                trace_id=trace_id,
                span_id=str(uuid.uuid4()),
                parent_span_id=parent_span_id,
                service_name=self.service_name
            )
            
            span.set_tag("operation", operation_name)
            self.active_spans[span.span_id] = span
            
            return span
    
    def finish_span(self, span: TraceContext):
        """结束追踪跨度"""
        with self.lock:
            span.finish()
            if span.span_id in self.active_spans:
                del self.active_spans[span.span_id]
                self.finished_spans.append(span)
    
    def get_trace(self, trace_id: str) -> List[TraceContext]:
        """获取完整的追踪链路"""
        with self.lock:
            all_spans = list(self.active_spans.values()) + self.finished_spans
            return [span for span in all_spans if span.trace_id == trace_id]
    
    def export_finished_spans(self) -> List[Dict[str, Any]]:
        """导出已完成的跨度"""
        with self.lock:
            spans_data = [span.to_dict() for span in self.finished_spans]
            self.finished_spans.clear()
            return spans_data

# 分布式存储追踪示例
class StorageTracer:
    """存储系统追踪器"""
    
    def __init__(self, tracer: Tracer):
        self.tracer = tracer
    
    def trace_file_operation(self, operation: str, file_path: str, 
                           file_size: int = 0) -> TraceContext:
        """追踪文件操作"""
        span = self.tracer.start_span(f"file_{operation}")
        
        # 设置操作标签
        span.set_tag("file.path", file_path)
        span.set_tag("file.size", file_size)
        span.set_tag("operation.type", operation)
        
        # 记录开始事件
        span.log_event("operation_started", {
            "file_path": file_path,
            "operation": operation
        })
        
        return span
    
    def trace_metadata_operation(self, operation: str, key: str) -> TraceContext:
        """追踪元数据操作"""
        span = self.tracer.start_span(f"metadata_{operation}")
        
        # 设置操作标签
        span.set_tag("metadata.key", key)
        span.set_tag("operation.type", operation)
        
        # 记录开始事件
        span.log_event("metadata_operation_started", {
            "key": key,
            "operation": operation
        })
        
        return span
    
    def trace_network_operation(self, operation: str, target_node: str, 
                              data_size: int = 0) -> TraceContext:
        """追踪网络操作"""
        span = self.tracer.start_span(f"network_{operation}")
        
        # 设置操作标签
        span.set_tag("network.target", target_node)
        span.set_tag("network.data_size", data_size)
        span.set_tag("operation.type", operation)
        
        # 记录开始事件
        span.log_event("network_operation_started", {
            "target": target_node,
            "operation": operation,
            "data_size": data_size
        })
        
        return span

# 使用示例
tracer = Tracer("dfs-storage-service")
storage_tracer = StorageTracer(tracer)

# 模拟一个文件读取操作的追踪
def simulate_file_read():
    # 开始文件读取追踪
    read_span = storage_tracer.trace_file_operation("read", "/data/file1.txt", 1024000)
    
    try:
        # 模拟元数据查询
        metadata_span = storage_tracer.trace_metadata_operation("get", "/data/file1.txt")
        time.sleep(0.01)  # 模拟元数据查询耗时
        metadata_span.log_event("metadata_retrieved")
        tracer.finish_span(metadata_span)
        
        # 模拟网络传输
        network_span = storage_tracer.trace_network_operation("transfer", "node-002", 1024000)
        time.sleep(0.05)  # 模拟网络传输耗时
        network_span.set_tag("network.bytes_transferred", 1024000)
        network_span.log_event("transfer_completed")
        tracer.finish_span(network_span)
        
        # 模拟本地读取
        time.sleep(0.02)  # 模拟本地读取耗时
        read_span.set_tag("file.bytes_read", 1024000)
        read_span.log_event("file_read_completed")
        
    except Exception as e:
        read_span.set_tag("error", True)
        read_span.log_event("operation_failed", {"error": str(e)})
        raise
    finally:
        tracer.finish_span(read_span)

# 执行模拟操作
simulate_file_read()

# 导出追踪数据
finished_spans = tracer.export_finished_spans()
print("完成的追踪跨度:")
for span_data in finished_spans:
    print(json.dumps(span_data, indent=2, ensure_ascii=False))
```

### 9.3.2 追踪数据分析

```python
# 追踪数据分析示例
from typing import Dict, List, Any, Tuple
import statistics
from datetime import datetime

class TraceAnalyzer:
    """追踪数据分析器"""
    
    def __init__(self):
        self.operation_stats = {}
    
    def analyze_traces(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析追踪数据"""
        if not traces:
            return {"message": "无追踪数据"}
        
        # 按操作类型分组
        operations = {}
        for trace in traces:
            operation = trace["tags"].get("operation.type", "unknown")
            if operation not in operations:
                operations[operation] = []
            operations[operation].append(trace)
        
        # 分析每个操作类型的性能
        operation_analysis = {}
        for operation, traces in operations.items():
            operation_analysis[operation] = self._analyze_operation(traces)
        
        # 整体性能分析
        overall_analysis = self._analyze_overall_performance(traces)
        
        return {
            "total_traces": len(traces),
            "operation_analysis": operation_analysis,
            "overall_performance": overall_analysis,
            "analysis_time": datetime.now().isoformat()
        }
    
    def _analyze_operation(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析单个操作类型"""
        durations = [trace["duration_ms"] for trace in traces]
        error_traces = [trace for trace in traces if trace["tags"].get("error")]
        
        # 计算基本统计信息
        stats = {
            "count": len(traces),
            "error_count": len(error_traces),
            "error_rate": len(error_traces) / len(traces) * 100 if traces else 0,
            "avg_duration_ms": statistics.mean(durations) if durations else 0,
            "min_duration_ms": min(durations) if durations else 0,
            "max_duration_ms": max(durations) if durations else 0,
            "p50_duration_ms": statistics.median(durations) if durations else 0,
            "p95_duration_ms": self._percentile(durations, 95) if durations else 0,
            "p99_duration_ms": self._percentile(durations, 99) if durations else 0
        }
        
        # 分析标签分布
        tag_analysis = self._analyze_tags(traces)
        stats["tag_analysis"] = tag_analysis
        
        return stats
    
    def _analyze_overall_performance(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析整体性能"""
        durations = [trace["duration_ms"] for trace in traces]
        error_traces = [trace for trace in traces if trace["tags"].get("error")]
        
        return {
            "total_requests": len(traces),
            "total_errors": len(error_traces),
            "error_rate": len(error_traces) / len(traces) * 100 if traces else 0,
            "avg_response_time_ms": statistics.mean(durations) if durations else 0,
            "median_response_time_ms": statistics.median(durations) if durations else 0,
            "p95_response_time_ms": self._percentile(durations, 95) if durations else 0,
            "p99_response_time_ms": self._percentile(durations, 99) if durations else 0,
            "throughput_rps": len(traces) / (max(durations) / 1000) if durations else 0
        }
    
    def _analyze_tags(self, traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析标签分布"""
        tag_stats = {}
        
        for trace in traces:
            for key, value in trace["tags"].items():
                if key not in tag_stats:
                    tag_stats[key] = {}
                
                value_str = str(value)
                tag_stats[key][value_str] = tag_stats[key].get(value_str, 0) + 1
        
        return tag_stats
    
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
    
    def identify_performance_bottlenecks(self, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """识别性能瓶颈"""
        bottlenecks = []
        
        # 按操作类型分析
        operations = {}
        for trace in traces:
            operation = trace["tags"].get("operation.type", "unknown")
            if operation not in operations:
                operations[operation] = []
            operations[operation].append(trace)
        
        # 识别高延迟操作
        for operation, op_traces in operations.items():
            durations = [trace["duration_ms"] for trace in op_traces]
            avg_duration = statistics.mean(durations) if durations else 0
            
            # 如果平均延迟超过阈值，标记为潜在瓶颈
            if avg_duration > 100:  # 100ms阈值
                bottlenecks.append({
                    "type": "high_latency",
                    "operation": operation,
                    "avg_duration_ms": avg_duration,
                    "count": len(op_traces),
                    "severity": "high" if avg_duration > 500 else "medium"
                })
        
        # 识别高错误率操作
        for operation, op_traces in operations.items():
            error_traces = [trace for trace in op_traces if trace["tags"].get("error")]
            error_rate = len(error_traces) / len(op_traces) * 100 if op_traces else 0
            
            if error_rate > 5:  # 5%错误率阈值
                bottlenecks.append({
                    "type": "high_error_rate",
                    "operation": operation,
                    "error_rate": error_rate,
                    "count": len(op_traces),
                    "severity": "high" if error_rate > 20 else "medium"
                })
        
        return bottlenecks

# 使用示例
analyzer = TraceAnalyzer()

# 模拟一些追踪数据
sample_traces = [
    {
        "trace_id": "trace-001",
        "span_id": "span-001",
        "service_name": "dfs-storage",
        "start_time": time.time() - 0.1,
        "end_time": time.time() - 0.05,
        "duration_ms": 50,
        "tags": {
            "operation.type": "file_read",
            "file.path": "/data/file1.txt",
            "file.size": 1024000
        },
        "logs": [],
        "finished": True
    },
    {
        "trace_id": "trace-002",
        "span_id": "span-002",
        "service_name": "dfs-storage",
        "start_time": time.time() - 0.2,
        "end_time": time.time() - 0.02,
        "duration_ms": 180,
        "tags": {
            "operation.type": "file_write",
            "file.path": "/data/file2.txt",
            "file.size": 2048000,
            "error": True
        },
        "logs": [{"event": "write_failed", "payload": {"error": "disk full"}}],
        "finished": True
    },
    {
        "trace_id": "trace-003",
        "span_id": "span-003",
        "service_name": "dfs-metadata",
        "start_time": time.time() - 0.05,
        "end_time": time.time() - 0.01,
        "duration_ms": 40,
        "tags": {
            "operation.type": "metadata_get",
            "metadata.key": "/data/file1.txt"
        },
        "logs": [],
        "finished": True
    }
]

# 分析追踪数据
analysis_result = analyzer.analyze_traces(sample_traces)
print("追踪数据分析结果:")
print(json.dumps(analysis_result, indent=2, ensure_ascii=False))

# 识别性能瓶颈
bottlenecks = analyzer.identify_performance_bottlenecks(sample_traces)
print("\n识别到的性能瓶颈:")
for bottleneck in bottlenecks:
    print(json.dumps(bottleneck, indent=2, ensure_ascii=False))
```

## 9.4 智能告警：阈值设定、告警收敛、根因分析

智能告警系统是分布式文件存储平台稳定性保障的重要组成部分，它能够及时发现系统异常并通知相关人员处理。

### 9.4.1 告警规则引擎

```python
# 告警规则引擎实现示例
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime, timedelta
import time
import threading
import json

class AlertRule:
    """告警规则"""
    
    def __init__(self, rule_id: str, name: str, description: str,
                 metric_name: str, condition: str, threshold: float,
                 duration_sec: int = 60, severity: str = "warning",
                 enabled: bool = True):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.metric_name = metric_name
        self.condition = condition  # >, <, >=, <=, ==, !=
        self.threshold = threshold
        self.duration_sec = duration_sec
        self.severity = severity  # info, warning, error, critical
        self.enabled = enabled
        self.last_evaluation = None
        self.last_alert_time = None
        self.alert_count = 0

class Alert:
    """告警实例"""
    
    def __init__(self, rule_id: str, metric_value: float, 
                 timestamp: datetime, message: str, severity: str):
        self.alert_id = str(uuid.uuid4())
        self.rule_id = rule_id
        self.metric_value = metric_value
        self.timestamp = timestamp
        self.message = message
        self.severity = severity
        self.status = "firing"  # firing, resolved, suppressed
        self.resolved_time: Optional[datetime] = None

class AlertManager:
    """告警管理器"""
    
    def __init__(self):
        self.rules: Dict[str, AlertRule] = {}
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        self.notification_callbacks: List[Callable] = []
        self.evaluation_interval_sec = 30
        self.running = False
        self.evaluation_thread = None
        self.metric_sources = {}
    
    def add_rule(self, rule: AlertRule):
        """添加告警规则"""
        self.rules[rule.rule_id] = rule
        print(f"告警规则已添加: {rule.name}")
    
    def remove_rule(self, rule_id: str):
        """移除告警规则"""
        if rule_id in self.rules:
            del self.rules[rule_id]
            print(f"告警规则已移除: {rule_id}")
    
    def register_metric_source(self, metric_name: str, source_func: Callable):
        """注册指标数据源"""
        self.metric_sources[metric_name] = source_func
    
    def add_notification_callback(self, callback: Callable):
        """添加通知回调"""
        self.notification_callbacks.append(callback)
    
    def start_evaluation(self):
        """启动告警评估"""
        self.running = True
        self.evaluation_thread = threading.Thread(target=self._evaluation_loop)
        self.evaluation_thread.daemon = True
        self.evaluation_thread.start()
        print("告警评估已启动")
    
    def stop_evaluation(self):
        """停止告警评估"""
        self.running = False
        if self.evaluation_thread:
            self.evaluation_thread.join(timeout=5)
        print("告警评估已停止")
    
    def _evaluation_loop(self):
        """告警评估循环"""
        while self.running:
            try:
                self._evaluate_rules()
                time.sleep(self.evaluation_interval_sec)
            except Exception as e:
                print(f"告警评估出错: {e}")
    
    def _evaluate_rules(self):
        """评估所有规则"""
        current_time = datetime.now()
        
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            
            # 获取指标值
            if rule.metric_name not in self.metric_sources:
                continue
            
            try:
                metric_value = self.metric_sources[rule.metric_name]()
                
                # 检查条件
                condition_met = self._check_condition(
                    metric_value, rule.condition, rule.threshold
                )
                
                # 更新规则评估时间
                rule.last_evaluation = current_time
                
                # 处理告警状态
                self._handle_alert_state(rule, metric_value, condition_met, current_time)
                
            except Exception as e:
                print(f"评估规则 {rule.name} 时出错: {e}")
    
    def _check_condition(self, value: float, condition: str, threshold: float) -> bool:
        """检查条件"""
        if condition == ">":
            return value > threshold
        elif condition == ">=":
            return value >= threshold
        elif condition == "<":
            return value < threshold
        elif condition == "<=":
            return value <= threshold
        elif condition == "==":
            return value == threshold
        elif condition == "!=":
            return value != threshold
        else:
            return False
    
    def _handle_alert_state(self, rule: AlertRule, metric_value: float, 
                          condition_met: bool, current_time: datetime):
        """处理告警状态"""
        alert_key = f"{rule.rule_id}"
        
        if condition_met:
            # 条件满足，可能需要触发告警
            if alert_key not in self.active_alerts:
                # 新告警
                if self._should_trigger_alert(rule, current_time):
                    self._trigger_alert(rule, metric_value, current_time)
            else:
                # 已存在的告警，更新计数
                rule.alert_count += 1
        else:
            # 条件不满足，可能需要解决告警
            if alert_key in self.active_alerts:
                self._resolve_alert(rule, alert_key, current_time)
    
    def _should_trigger_alert(self, rule: AlertRule, current_time: datetime) -> bool:
        """判断是否应该触发告警"""
        # 检查是否在静默期内
        if rule.last_alert_time:
            time_since_last_alert = current_time - rule.last_alert_time
            if time_since_last_alert.total_seconds() < rule.duration_sec:
                return False
        
        return True
    
    def _trigger_alert(self, rule: AlertRule, metric_value: float, 
                      current_time: datetime):
        """触发告警"""
        alert_key = f"{rule.rule_id}"
        
        # 创建告警实例
        alert = Alert(
            rule_id=rule.rule_id,
            metric_value=metric_value,
            timestamp=current_time,
            message=f"{rule.name}: {rule.metric_name} = {metric_value} {rule.condition} {rule.threshold}",
            severity=rule.severity
        )
        
        # 添加到活动告警
        self.active_alerts[alert_key] = alert
        
        # 更新规则状态
        rule.last_alert_time = current_time
        rule.alert_count += 1
        
        # 添加到历史记录
        self.alert_history.append(alert)
        
        # 通知
        self._notify_alert(alert)
        
        print(f"告警已触发: {alert.message}")
    
    def _resolve_alert(self, rule: AlertRule, alert_key: str, 
                      current_time: datetime):
        """解决告警"""
        alert = self.active_alerts[alert_key]
        alert.status = "resolved"
        alert.resolved_time = current_time
        
        # 从活动告警中移除
        del self.active_alerts[alert_key]
        
        # 通知告警已解决
        self._notify_alert_resolved(alert)
        
        print(f"告警已解决: {rule.name}")
    
    def _notify_alert(self, alert: Alert):
        """通知告警"""
        for callback in self.notification_callbacks:
            try:
                callback(alert)
            except Exception as e:
                print(f"告警通知回调出错: {e}")
    
    def _notify_alert_resolved(self, alert: Alert):
        """通知告警已解决"""
        # 可以实现不同的解决通知逻辑
        pass
    
    def get_active_alerts(self) -> List[Alert]:
        """获取活动告警"""
        return list(self.active_alerts.values())
    
    def get_alert_history(self, hours: int = 24) -> List[Alert]:
        """获取告警历史"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [alert for alert in self.alert_history 
                if alert.timestamp >= cutoff_time]

# 使用示例
def mock_metric_source_cpu_utilization():
    """模拟CPU使用率指标源"""
    import random
    return random.uniform(0, 100)

def mock_metric_source_disk_usage():
    """模拟磁盘使用率指标源"""
    import random
    return random.uniform(0, 100)

def mock_notification_callback(alert: Alert):
    """模拟通知回调"""
    print(f"[{alert.severity.upper()}] {alert.message}")

# 创建告警管理器
alert_manager = AlertManager()

# 注册指标源
alert_manager.register_metric_source("cpu_utilization", mock_metric_source_cpu_utilization)
alert_manager.register_metric_source("disk_usage", mock_metric_source_disk_usage)

# 添加通知回调
alert_manager.add_notification_callback(mock_notification_callback)

# 添加告警规则
cpu_rule = AlertRule(
    rule_id="high_cpu_usage",
    name="高CPU使用率",
    description="CPU使用率超过阈值",
    metric_name="cpu_utilization",
    condition=">",
    threshold=80,
    duration_sec=60,
    severity="warning"
)

disk_rule = AlertRule(
    rule_id="high_disk_usage",
    name="高磁盘使用率",
    description="磁盘使用率超过阈值",
    metric_name="disk_usage",
    condition=">",
    threshold=85,
    duration_sec=300,
    severity="error"
)

alert_manager.add_rule(cpu_rule)
alert_manager.add_rule(disk_rule)

# 启动告警评估（在实际使用中启动）
# alert_manager.start_evaluation()

# 等待一段时间观察告警（模拟）
# time.sleep(10)

# 停止告警评估
# alert_manager.stop_evaluation()

# 查看活动告警
active_alerts = alert_manager.get_active_alerts()
print(f"活动告警数量: {len(active_alerts)}")
```

### 9.4.2 告警收敛与根因分析

```python
# 告警收敛与根因分析实现示例
from typing import Dict, List, Set, Tuple
from datetime import datetime, timedelta
import json

class AlertCorrelationEngine:
    """告警关联引擎"""
    
    def __init__(self, alert_manager: AlertManager):
        self.alert_manager = alert_manager
        self.correlation_rules = []
        self.alert_groups = {}  # 告警组
        self.dependency_graph = {}  # 依赖关系图
    
    def add_correlation_rule(self, rule: Dict[str, Any]):
        """添加关联规则"""
        self.correlation_rules.append(rule)
    
    def correlate_alerts(self, alerts: List[Alert]) -> List[Dict[str, Any]]:
        """关联告警"""
        correlated_groups = []
        processed_alerts = set()
        
        for i, alert1 in enumerate(alerts):
            if alert1.alert_id in processed_alerts:
                continue
            
            # 查找相关的告警
            related_alerts = [alert1]
            processed_alerts.add(alert1.alert_id)
            
            for j, alert2 in enumerate(alerts[i+1:], i+1):
                if alert2.alert_id in processed_alerts:
                    continue
                
                # 检查是否相关
                if self._are_alerts_related(alert1, alert2):
                    related_alerts.append(alert2)
                    processed_alerts.add(alert2.alert_id)
            
            # 创建告警组
            if len(related_alerts) > 1:
                group = self._create_alert_group(related_alerts)
                correlated_groups.append(group)
            else:
                # 单独的告警
                group = {
                    "group_id": str(uuid.uuid4()),
                    "alerts": [alert1],
                    "root_cause": self._identify_root_cause([alert1]),
                    "severity": alert1.severity,
                    "timestamp": alert1.timestamp
                }
                correlated_groups.append(group)
        
        return correlated_groups
    
    def _are_alerts_related(self, alert1: Alert, alert2: Alert) -> bool:
        """判断两个告警是否相关"""
        # 时间相关性（10分钟内）
        time_diff = abs((alert1.timestamp - alert2.timestamp).total_seconds())
        if time_diff > 600:  # 10分钟
            return False
        
        # 规则相关性
        rule1 = self.alert_manager.rules.get(alert1.rule_id)
        rule2 = self.alert_manager.rules.get(alert2.rule_id)
        
        if not rule1 or not rule2:
            return False
        
        # 如果是同一节点的相似告警，则相关
        # 这里简化实现，实际可以根据标签、节点等信息判断
        
        return True
    
    def _create_alert_group(self, alerts: List[Alert]) -> Dict[str, Any]:
        """创建告警组"""
        # 确定根因
        root_cause = self._identify_root_cause(alerts)
        
        # 确定严重程度
        severity = self._determine_group_severity(alerts)
        
        # 确定时间戳（最早的告警时间）
        timestamp = min(alert.timestamp for alert in alerts)
        
        return {
            "group_id": str(uuid.uuid4()),
            "alerts": alerts,
            "root_cause": root_cause,
            "severity": severity,
            "timestamp": timestamp,
            "alert_count": len(alerts)
        }
    
    def _identify_root_cause(self, alerts: List[Alert]) -> str:
        """识别根因"""
        # 简化实现，实际可以根据告警类型、指标关系等进行分析
        
        if len(alerts) == 1:
            alert = alerts[0]
            rule = self.alert_manager.rules.get(alert.rule_id)
            if rule:
                if "cpu" in rule.metric_name.lower():
                    return "CPU资源不足"
                elif "disk" in rule.metric_name.lower():
                    return "磁盘空间不足"
                elif "memory" in rule.metric_name.lower():
                    return "内存资源不足"
                else:
                    return "未知原因"
        
        # 多个告警的情况，分析可能的根因
        metric_types = set()
        for alert in alerts:
            rule = self.alert_manager.rules.get(alert.rule_id)
            if rule:
                if "cpu" in rule.metric_name.lower():
                    metric_types.add("cpu")
                elif "disk" in rule.metric_name.lower():
                    metric_types.add("disk")
                elif "memory" in rule.metric_name.lower():
                    metric_types.add("memory")
                elif "network" in rule.metric_name.lower():
                    metric_types.add("network")
        
        # 根据指标类型推断根因
        if "disk" in metric_types and len(metric_types) > 1:
            return "磁盘I/O瓶颈导致系统性能下降"
        elif "network" in metric_types:
            return "网络问题导致服务异常"
        elif len(metric_types) > 2:
            return "系统资源全面紧张"
        else:
            return "多因素综合影响"
    
    def _determine_group_severity(self, alerts: List[Alert]) -> str:
        """确定告警组的严重程度"""
        severities = [alert.severity for alert in alerts]
        
        # 严重程度优先级：critical > error > warning > info
        severity_priority = {"critical": 4, "error": 3, "warning": 2, "info": 1}
        
        max_priority = max(severity_priority.get(s, 0) for s in severities)
        
        # 根据优先级返回严重程度
        for severity, priority in severity_priority.items():
            if priority == max_priority:
                return severity
        
        return "warning"

class AlertSuppressionManager:
    """告警抑制管理器"""
    
    def __init__(self):
        self.suppression_rules = []
        self.active_suppressions = {}
    
    def add_suppression_rule(self, rule: Dict[str, Any]):
        """添加抑制规则"""
        self.suppression_rules.append(rule)
    
    def should_suppress_alert(self, alert: Alert) -> bool:
        """判断是否应该抑制告警"""
        current_time = datetime.now()
        
        # 检查现有的抑制规则
        for rule in self.suppression_rules:
            if self._matches_suppression_rule(alert, rule):
                # 检查抑制是否仍在有效期内
                suppression_key = f"{rule['rule_id']}_{rule.get('target', 'all')}"
                if suppression_key in self.active_suppressions:
                    suppression_end = self.active_suppressions[suppression_key]
                    if current_time < suppression_end:
                        return True
        
        return False
    
    def _matches_suppression_rule(self, alert: Alert, rule: Dict[str, Any]) -> bool:
        """判断告警是否匹配抑制规则"""
        # 检查规则ID
        if rule.get("rule_id") and rule["rule_id"] != alert.rule_id:
            return False
        
        # 检查目标（如特定节点、服务等）
        target = rule.get("target")
        if target and target != "all":
            # 这里简化实现，实际可以根据告警的标签等信息判断
            pass
        
        # 检查时间窗口
        start_time = rule.get("start_time")
        end_time = rule.get("end_time")
        current_time = datetime.now()
        
        if start_time and current_time < start_time:
            return False
        if end_time and current_time > end_time:
            return False
        
        return True
    
    def suppress_alerts(self, rule_id: str, duration_minutes: int, 
                       target: str = "all", reason: str = ""):
        """手动抑制告警"""
        suppression_end = datetime.now() + timedelta(minutes=duration_minutes)
        suppression_key = f"{rule_id}_{target}"
        self.active_suppressions[suppression_key] = suppression_end
        
        print(f"告警抑制已设置: {rule_id} for {duration_minutes} minutes (target: {target})")

# 使用示例
# 创建告警关联引擎
correlation_engine = AlertCorrelationEngine(alert_manager)

# 添加关联规则（简化示例）
correlation_engine.add_correlation_rule({
    "name": "CPU和内存告警关联",
    "conditions": [
        {"metric": "cpu_utilization", "operator": ">", "threshold": 80},
        {"metric": "memory_utilization", "operator": ">", "threshold": 80}
    ]
})

# 创建告警抑制管理器
suppression_manager = AlertSuppressionManager()

# 模拟一些告警数据进行关联分析
sample_alerts = [
    Alert("high_cpu_usage", 85.2, datetime.now(), "CPU使用率过高", "warning"),
    Alert("high_memory_usage", 88.1, datetime.now(), "内存使用率过高", "warning"),
    Alert("high_disk_usage", 92.3, datetime.now(), "磁盘使用率过高", "error")
]

# 关联告警
correlated_groups = correlation_engine.correlate_alerts(sample_alerts)

print("告警关联结果:")
for group in correlated_groups:
    print(f"告警组 {group['group_id']}:")
    print(f"  根因: {group['root_cause']}")
    print(f"  严重程度: {group['severity']}")
    print(f"  告警数量: {group['alert_count']}")
    for alert in group['alerts']:
        print(f"    - {alert.message}")

# 检查告警抑制
alert_to_check = sample_alerts[0]
if suppression_manager.should_suppress_alert(alert_to_check):
    print(f"告警 {alert_to_check.rule_id} 被抑制")
else:
    print(f"告警 {alert_to_check.rule_id} 未被抑制")

# 手动设置告警抑制
suppression_manager.suppress_alerts("high_cpu_usage", 30, "node-001", "计划内维护")