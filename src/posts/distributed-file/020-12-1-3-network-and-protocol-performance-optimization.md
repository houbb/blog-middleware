---
title: "网络与协议性能优化"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在网络密集型的分布式文件存储系统中，网络性能和协议效率是影响整体系统性能的关键因素。通过对网络架构的优化和协议层面的改进，我们可以显著提升数据传输效率，降低延迟，提高系统的并发处理能力。

## 12.1.3 网络性能分析与优化

网络性能优化需要从带宽利用率、延迟、丢包率等多个维度进行综合考虑。

### 12.1.3.1 网络性能监控与分析

```python
# 网络性能监控框架
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import socket
import struct

class NetworkPerformanceMonitor:
    """网络性能监控器"""
    
    def __init__(self, target_hosts: List[str], ports: List[int]):
        self.target_hosts = target_hosts
        self.ports = ports
        self.monitoring = False
        self.metrics_history = []
        self.alert_callbacks = []
    
    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """添加告警回调"""
        self.alert_callbacks.append(callback)
    
    def start_monitoring(self, interval: int = 5):
        """开始监控"""
        if self.monitoring:
            return
        
        self.monitoring = True
        monitor_thread = threading.Thread(target=self._monitoring_loop, args=(interval,))
        monitor_thread.daemon = True
        monitor_thread.start()
        print(f"网络性能监控已启动，监控间隔: {interval}秒")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        print("网络性能监控已停止")
    
    def _monitoring_loop(self, interval: int):
        """监控循环"""
        while self.monitoring:
            try:
                metrics = self._collect_network_metrics()
                self.metrics_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "metrics": metrics
                })
                
                # 检查是否需要告警
                self._check_alerts(metrics)
                
                time.sleep(interval)
            except Exception as e:
                print(f"网络监控出错: {e}")
    
    def _collect_network_metrics(self) -> Dict[str, Any]:
        """收集网络性能指标"""
        metrics = {
            "latency": {},
            "bandwidth": {},
            "packet_loss": {},
            "connection_status": {}
        }
        
        for host in self.target_hosts:
            for port in self.ports:
                key = f"{host}:{port}"
                
                # 测试延迟
                latency = self._test_latency(host, port)
                metrics["latency"][key] = latency
                
                # 测试连接状态
                is_connected = self._test_connection(host, port)
                metrics["connection_status"][key] = is_connected
                
                # 模拟带宽测试
                bandwidth = self._estimate_bandwidth(host, port)
                metrics["bandwidth"][key] = bandwidth
        
        return metrics
    
    def _test_latency(self, host: str, port: int) -> Optional[float]:
        """测试网络延迟"""
        try:
            start_time = time.time()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            end_time = time.time()
            sock.close()
            
            if result == 0:
                return (end_time - start_time) * 1000  # 转换为毫秒
            else:
                return None
        except Exception:
            return None
    
    def _test_connection(self, host: str, port: int) -> bool:
        """测试连接状态"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False
    
    def _estimate_bandwidth(self, host: str, port: int) -> float:
        """估算带宽（简化实现）"""
        # 在实际实现中，这里会进行更复杂的带宽测试
        # 这里使用模拟数据
        base_bandwidth = 100.0  # Mbps
        # 根据延迟调整带宽估算
        latency = self._test_latency(host, port)
        if latency:
            # 延迟越高，估算带宽越低
            adjustment = max(0.1, 1.0 - (latency / 1000.0))
            return base_bandwidth * adjustment
        return base_bandwidth
    
    def _check_alerts(self, metrics: Dict[str, Any]):
        """检查是否需要告警"""
        for key, latency in metrics["latency"].items():
            if latency and latency > 100:  # 延迟超过100ms告警
                alert_info = {
                    "type": "high_latency",
                    "target": key,
                    "latency": latency,
                    "threshold": 100,
                    "timestamp": datetime.now().isoformat()
                }
                for callback in self.alert_callbacks:
                    try:
                        callback(alert_info)
                    except Exception as e:
                        print(f"告警回调执行失败: {e}")
        
        for key, is_connected in metrics["connection_status"].items():
            if not is_connected:
                alert_info = {
                    "type": "connection_failure",
                    "target": key,
                    "timestamp": datetime.now().isoformat()
                }
                for callback in self.alert_callbacks:
                    try:
                        callback(alert_info)
                    except Exception as e:
                        print(f"告警回调执行失败: {e}")
    
    def get_performance_report(self, hours: int = 1) -> Dict[str, Any]:
        """获取性能报告"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_metrics = [
            entry for entry in self.metrics_history
            if datetime.fromisoformat(entry["timestamp"]) >= cutoff_time
        ]
        
        if not recent_metrics:
            return {"error": "没有足够的历史数据"}
        
        # 计算统计指标
        latency_stats = {}
        bandwidth_stats = {}
        
        for entry in recent_metrics:
            metrics = entry["metrics"]
            timestamp = entry["timestamp"]
            
            for key, latency in metrics["latency"].items():
                if key not in latency_stats:
                    latency_stats[key] = []
                if latency is not None:
                    latency_stats[key].append(latency)
            
            for key, bandwidth in metrics["bandwidth"].items():
                if key not in bandwidth_stats:
                    bandwidth_stats[key] = []
                bandwidth_stats[key].append(bandwidth)
        
        # 计算平均值和最大值
        avg_latencies = {}
        max_latencies = {}
        avg_bandwidths = {}
        min_bandwidths = {}
        
        for key, latencies in latency_stats.items():
            if latencies:
                avg_latencies[key] = sum(latencies) / len(latencies)
                max_latencies[key] = max(latencies)
        
        for key, bandwidths in bandwidth_stats.items():
            if bandwidths:
                avg_bandwidths[key] = sum(bandwidths) / len(bandwidths)
                min_bandwidths[key] = min(bandwidths)
        
        return {
            "period_hours": hours,
            "data_points": len(recent_metrics),
            "average_latencies": avg_latencies,
            "maximum_latencies": max_latencies,
            "average_bandwidths": avg_bandwidths,
            "minimum_bandwidths": min_bandwidths,
            "generated_at": datetime.now().isoformat()
        }

class NetworkOptimizer:
    """网络优化器"""
    
    def __init__(self, monitor: NetworkPerformanceMonitor):
        self.monitor = monitor
        self.optimization_strategies = []
    
    def add_optimization_strategy(self, name: str, strategy_func: Callable):
        """添加优化策略"""
        self.optimization_strategies.append({
            "name": name,
            "function": strategy_func
        })
    
    def apply_optimization(self, strategy_name: str, parameters: Dict[str, Any]) -> bool:
        """应用优化策略"""
        strategy = next((s for s in self.optimization_strategies if s["name"] == strategy_name), None)
        if not strategy:
            print(f"优化策略 {strategy_name} 不存在")
            return False
        
        try:
            print(f"应用网络优化策略: {strategy_name}")
            result = strategy["function"](parameters)
            print(f"优化结果: {result}")
            return True
        except Exception as e:
            print(f"应用优化策略 {strategy_name} 失败: {e}")
            return False
    
    def optimize_tcp_parameters(self, tcp_params: Dict[str, Any]) -> Dict[str, Any]:
        """优化TCP参数"""
        print("优化TCP参数...")
        # 在实际实现中，这里会修改系统TCP参数
        # 这里仅作为示例
        
        recommendations = {
            "tcp_window_size": tcp_params.get("window_size", 65536),
            "tcp_buffer_size": tcp_params.get("buffer_size", 131072),
            "tcp_nodelay": tcp_params.get("nodelay", True),
            "expected_improvement": "提升大文件传输性能"
        }
        
        return recommendations
    
    def optimize_network_topology(self, topology_config: Dict[str, Any]) -> Dict[str, Any]:
        """优化网络拓扑"""
        print("优化网络拓扑...")
        # 在实际实现中，这里会调整网络路由和负载均衡策略
        # 这里仅作为示例
        
        recommendations = {
            "load_balancing_algorithm": topology_config.get("algorithm", "round_robin"),
            "redundancy_paths": topology_config.get("redundancy", 2),
            "expected_improvement": "提升网络可靠性和负载分布"
        }
        
        return recommendations

# 使用示例
def on_network_alert(alert_info: Dict[str, Any]):
    """网络告警回调"""
    print(f"网络告警: {alert_info['type']} - {alert_info['target']}")
    if alert_info["type"] == "high_latency":
        print(f"  延迟: {alert_info['latency']:.2f}ms (阈值: {alert_info['threshold']}ms)")

def demonstrate_network_monitoring():
    """演示网络监控"""
    # 创建网络监控器
    monitor = NetworkPerformanceMonitor(
        target_hosts=["127.0.0.1", "localhost"],
        ports=[80, 443, 22]
    )
    
    # 添加告警回调
    monitor.add_alert_callback(on_network_alert)
    
    # 开始监控
    monitor.start_monitoring(interval=3)
    
    # 运行一段时间
    time.sleep(15)
    
    # 停止监控
    monitor.stop_monitoring()
    
    # 生成性能报告
    report = monitor.get_performance_report(hours=0.1)  # 最近6分钟
    print("\n网络性能报告:")
    print(f"  数据点数: {report.get('data_points', 0)}")
    print(f"  平均延迟: {report.get('average_latencies', {})}")
    print(f"  最大延迟: {report.get('maximum_latencies', {})}")

# 运行演示
# demonstrate_network_monitoring()
```

### 12.1.3.2 协议性能优化技术

```python
# 协议性能优化实现
from typing import Dict, List, Any, Optional
import asyncio
import json

class ProtocolOptimizer:
    """协议优化器"""
    
    def __init__(self):
        self.optimized_protocols = {}
        self.protocol_metrics = {}
    
    def optimize_http_protocol(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """优化HTTP协议"""
        print("优化HTTP协议...")
        
        optimizations = {
            "connection_pooling": config.get("enable_connection_pooling", True),
            "keep_alive": config.get("enable_keep_alive", True),
            "compression": config.get("enable_compression", True),
            "pipelining": config.get("enable_pipelining", False),
            "http_version": config.get("version", "HTTP/1.1")
        }
        
        # 根据配置计算预期性能提升
        improvement_factors = []
        if optimizations["connection_pooling"]:
            improvement_factors.append(1.3)  # 30%提升
        if optimizations["keep_alive"]:
            improvement_factors.append(1.2)  # 20%提升
        if optimizations["compression"]:
            improvement_factors.append(1.25)  # 25%提升
        
        expected_improvement = 1.0
        for factor in improvement_factors:
            expected_improvement *= factor
        
        return {
            "protocol": "HTTP",
            "optimizations": optimizations,
            "expected_improvement": expected_improvement,
            "description": "通过连接池、Keep-Alive和压缩优化HTTP性能"
        }
    
    def optimize_grpc_protocol(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """优化gRPC协议"""
        print("优化gRPC协议...")
        
        optimizations = {
            "connection_reuse": config.get("enable_connection_reuse", True),
            "message_compression": config.get("enable_message_compression", True),
            "load_balancing": config.get("enable_load_balancing", True),
            "streaming": config.get("enable_streaming", True),
            "timeout_config": config.get("timeout_config", {"default": 30})
        }
        
        # 计算预期性能提升
        improvement_factors = []
        if optimizations["connection_reuse"]:
            improvement_factors.append(1.4)  # 40%提升
        if optimizations["message_compression"]:
            improvement_factors.append(1.3)  # 30%提升
        if optimizations["streaming"]:
            improvement_factors.append(1.35)  # 35%提升
        
        expected_improvement = 1.0
        for factor in improvement_factors:
            expected_improvement *= factor
        
        return {
            "protocol": "gRPC",
            "optimizations": optimizations,
            "expected_improvement": expected_improvement,
            "description": "通过连接复用、消息压缩和流式传输优化gRPC性能"
        }
    
    def optimize_custom_protocol(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """优化自定义协议"""
        print("优化自定义协议...")
        
        optimizations = {
            "binary_encoding": config.get("enable_binary_encoding", True),
            "batch_processing": config.get("enable_batch_processing", True),
            "async_processing": config.get("enable_async_processing", True),
            "header_compression": config.get("enable_header_compression", True),
            "zero_copy": config.get("enable_zero_copy", False)
        }
        
        # 计算预期性能提升
        improvement_factors = []
        if optimizations["binary_encoding"]:
            improvement_factors.append(1.5)  # 50%提升
        if optimizations["batch_processing"]:
            improvement_factors.append(1.4)  # 40%提升
        if optimizations["async_processing"]:
            improvement_factors.append(1.3)  # 30%提升
        if optimizations["header_compression"]:
            improvement_factors.append(1.2)  # 20%提升
        if optimizations["zero_copy"]:
            improvement_factors.append(1.25)  # 25%提升
        
        expected_improvement = 1.0
        for factor in improvement_factors:
            expected_improvement *= factor
        
        return {
            "protocol": "Custom",
            "optimizations": optimizations,
            "expected_improvement": expected_improvement,
            "description": "通过二进制编码、批处理和异步处理优化自定义协议"
        }

class ProtocolBenchmark:
    """协议性能基准测试"""
    
    def __init__(self):
        self.test_results = {}
    
    async def benchmark_protocol(self, protocol_name: str, test_func: Callable, 
                              iterations: int = 1000) -> Dict[str, Any]:
        """基准测试协议性能"""
        print(f"开始 {protocol_name} 协议基准测试...")
        
        durations = []
        successes = 0
        
        for i in range(iterations):
            try:
                start_time = time.time()
                await test_func()
                end_time = time.time()
                
                durations.append(end_time - start_time)
                successes += 1
            except Exception as e:
                print(f"测试迭代 {i} 失败: {e}")
        
        if not durations:
            return {"error": "所有测试都失败了"}
        
        avg_duration = sum(durations) / len(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        # 计算吞吐量 (请求/秒)
        throughput = 1.0 / avg_duration if avg_duration > 0 else 0
        
        result = {
            "protocol": protocol_name,
            "iterations": iterations,
            "successes": successes,
            "success_rate": successes / iterations,
            "avg_duration": avg_duration,
            "min_duration": min_duration,
            "max_duration": max_duration,
            "throughput_rps": throughput,
            "tested_at": datetime.now().isoformat()
        }
        
        self.test_results[protocol_name] = result
        return result
    
    async def compare_protocols(self, protocol_tests: Dict[str, Callable]) -> Dict[str, Any]:
        """比较多种协议性能"""
        results = {}
        
        for protocol_name, test_func in protocol_tests.items():
            result = await self.benchmark_protocol(protocol_name, test_func)
            results[protocol_name] = result
        
        # 找出最佳性能协议
        best_protocol = None
        best_throughput = 0
        
        for protocol_name, result in results.items():
            if "throughput_rps" in result and result["throughput_rps"] > best_throughput:
                best_throughput = result["throughput_rps"]
                best_protocol = protocol_name
        
        return {
            "results": results,
            "best_protocol": best_protocol,
            "best_throughput": best_throughput,
            "comparison_timestamp": datetime.now().isoformat()
        }

# 模拟协议测试函数
async def test_http_protocol():
    """模拟HTTP协议测试"""
    await asyncio.sleep(0.001 + random.random() * 0.002)  # 1-3ms延迟

async def test_grpc_protocol():
    """模拟gRPC协议测试"""
    await asyncio.sleep(0.0005 + random.random() * 0.001)  # 0.5-1.5ms延迟

async def test_custom_protocol():
    """模拟自定义协议测试"""
    await asyncio.sleep(0.0002 + random.random() * 0.0005)  # 0.2-0.7ms延迟

# 使用示例
def demonstrate_protocol_optimization():
    """演示协议优化"""
    # 创建协议优化器
    protocol_optimizer = ProtocolOptimizer()
    
    # 优化不同协议
    http_config = {
        "enable_connection_pooling": True,
        "enable_keep_alive": True,
        "enable_compression": True,
        "version": "HTTP/1.1"
    }
    http_optimization = protocol_optimizer.optimize_http_protocol(http_config)
    print(f"HTTP优化: {http_optimization['expected_improvement']:.2f}x 性能提升")
    
    grpc_config = {
        "enable_connection_reuse": True,
        "enable_message_compression": True,
        "enable_streaming": True
    }
    grpc_optimization = protocol_optimizer.optimize_grpc_protocol(grpc_config)
    print(f"gRPC优化: {grpc_optimization['expected_improvement']:.2f}x 性能提升")
    
    custom_config = {
        "enable_binary_encoding": True,
        "enable_batch_processing": True,
        "enable_async_processing": True,
        "enable_header_compression": True
    }
    custom_optimization = protocol_optimizer.optimize_custom_protocol(custom_config)
    print(f"自定义协议优化: {custom_optimization['expected_improvement']:.2f}x 性能提升")
    
    # 协议性能基准测试
    print("\n进行协议性能基准测试...")
    benchmark = ProtocolBenchmark()
    
    protocol_tests = {
        "HTTP": test_http_protocol,
        "gRPC": test_grpc_protocol,
        "Custom": test_custom_protocol
    }
    
    # 运行基准测试
    comparison_result = asyncio.run(benchmark.compare_protocols(protocol_tests))
    
    print("\n协议性能比较结果:")
    for protocol_name, result in comparison_result["results"].items():
        if "error" not in result:
            print(f"  {protocol_name}:")
            print(f"    平均延迟: {result['avg_duration']*1000:.2f}ms")
            print(f"    吞吐量: {result['throughput_rps']:.2f} 请求/秒")
            print(f"    成功率: {result['success_rate']:.2%}")
    
    print(f"\n最佳协议: {comparison_result['best_protocol']}")
    print(f"最佳吞吐量: {comparison_result['best_throughput']:.2f} 请求/秒")

# 运行演示
# demonstrate_protocol_optimization()
```

## 12.1.4 网络服务质量(QoS)保障

在网络资源有限的情况下，通过QoS机制可以确保关键业务流量的优先级和服务质量。

### 12.1.4.1 流量分类与优先级管理

```python
# QoS实现
from typing import Dict, List, Any, Optional
from enum import Enum
import heapq

class TrafficClass(Enum):
    """流量类别"""
    CRITICAL = 1    # 关键业务流量
    HIGH = 2        # 高优先级流量
    NORMAL = 3      # 普通流量
    LOW = 4         # 低优先级流量

class QoSPolicy:
    """QoS策略"""
    
    def __init__(self, name: str):
        self.name = name
        self.traffic_classes = {}
        self.bandwidth_allocation = {}
        self.latency_requirements = {}
    
    def set_traffic_class(self, traffic_type: str, traffic_class: TrafficClass):
        """设置流量类别"""
        self.traffic_classes[traffic_type] = traffic_class
    
    def set_bandwidth_allocation(self, traffic_class: TrafficClass, percentage: float):
        """设置带宽分配"""
        self.bandwidth_allocation[traffic_class] = percentage
    
    def set_latency_requirement(self, traffic_class: TrafficClass, max_latency_ms: int):
        """设置延迟要求"""
        self.latency_requirements[traffic_class] = max_latency_ms

class TrafficShaper:
    """流量整形器"""
    
    def __init__(self, qos_policy: QoSPolicy):
        self.qos_policy = qos_policy
        self.traffic_queues = {cls: [] for cls in TrafficClass}
        self.bandwidth_limits = {}
        self.bytes_sent = {cls: 0 for cls in TrafficClass}
    
    def classify_traffic(self, traffic_data: Dict[str, Any]) -> TrafficClass:
        """分类流量"""
        traffic_type = traffic_data.get("type", "unknown")
        return self.qos_policy.traffic_classes.get(traffic_type, TrafficClass.NORMAL)
    
    def enqueue_traffic(self, traffic_data: Dict[str, Any]):
        """将流量加入队列"""
        traffic_class = self.classify_traffic(traffic_data)
        # 使用优先队列，优先级高的排在前面
        priority = traffic_class.value
        heapq.heappush(self.traffic_queues[traffic_class], (priority, traffic_data))
    
    def shape_traffic(self, available_bandwidth: int) -> List[Dict[str, Any]]:
        """流量整形"""
        # 根据QoS策略分配带宽
        allocated_bandwidth = {}
        total_percentage = sum(self.qos_policy.bandwidth_allocation.values())
        
        for traffic_class, percentage in self.qos_policy.bandwidth_allocation.items():
            allocated_bandwidth[traffic_class] = int(
                available_bandwidth * (percentage / total_percentage)
            )
        
        shaped_traffic = []
        
        # 按优先级处理流量
        for traffic_class in TrafficClass:
            if traffic_class in self.traffic_queues and self.traffic_queues[traffic_class]:
                limit = allocated_bandwidth.get(traffic_class, 0)
                processed_bytes = 0
                
                while (self.traffic_queues[traffic_class] and 
                       processed_bytes < limit):
                    priority, traffic_data = heapq.heappop(self.traffic_queues[traffic_class])
                    traffic_size = traffic_data.get("size", 1024)  # 默认1KB
                    
                    if processed_bytes + traffic_size <= limit:
                        shaped_traffic.append(traffic_data)
                        processed_bytes += traffic_size
                        self.bytes_sent[traffic_class] += traffic_size
                    else:
                        # 重新加入队列
                        heapq.heappush(self.traffic_queues[traffic_class], (priority, traffic_data))
                        break
        
        return shaped_traffic
    
    def get_traffic_statistics(self) -> Dict[str, Any]:
        """获取流量统计信息"""
        return {
            "bytes_sent_by_class": {cls.name: bytes for cls, bytes in self.bytes_sent.items()},
            "queue_lengths": {cls.name: len(queue) for cls, queue in self.traffic_queues.items()},
            "timestamp": datetime.now().isoformat()
        }

# 使用示例
def demonstrate_qos():
    """演示QoS功能"""
    # 创建QoS策略
    qos_policy = QoSPolicy("StorageSystemQoS")
    
    # 设置流量分类
    qos_policy.set_traffic_class("metadata", TrafficClass.CRITICAL)
    qos_policy.set_traffic_class("read_request", TrafficClass.HIGH)
    qos_policy.set_traffic_class("write_request", TrafficClass.HIGH)
    qos_policy.set_traffic_class("background_sync", TrafficClass.LOW)
    qos_policy.set_traffic_class("log_upload", TrafficClass.LOW)
    
    # 设置带宽分配
    qos_policy.set_bandwidth_allocation(TrafficClass.CRITICAL, 40)  # 40%
    qos_policy.set_bandwidth_allocation(TrafficClass.HIGH, 35)      # 35%
    qos_policy.set_bandwidth_allocation(TrafficClass.NORMAL, 20)    # 20%
    qos_policy.set_bandwidth_allocation(TrafficClass.LOW, 5)        # 5%
    
    # 设置延迟要求
    qos_policy.set_latency_requirement(TrafficClass.CRITICAL, 10)   # 10ms
    qos_policy.set_latency_requirement(TrafficClass.HIGH, 50)       # 50ms
    qos_policy.set_latency_requirement(TrafficClass.NORMAL, 100)    # 100ms
    qos_policy.set_latency_requirement(TrafficClass.LOW, 500)       # 500ms
    
    # 创建流量整形器
    traffic_shaper = TrafficShaper(qos_policy)
    
    # 模拟流量
    test_traffic = [
        {"type": "metadata", "size": 1024, "data": "meta1"},
        {"type": "read_request", "size": 2048, "data": "read1"},
        {"type": "write_request", "size": 4096, "data": "write1"},
        {"type": "background_sync", "size": 8192, "data": "sync1"},
        {"type": "log_upload", "size": 1024, "data": "log1"},
        {"type": "metadata", "size": 512, "data": "meta2"},
        {"type": "read_request", "size": 1024, "data": "read2"},
    ]
    
    # 将流量加入队列
    for traffic in test_traffic:
        traffic_shaper.enqueue_traffic(traffic)
    
    # 执行流量整形 (假设可用带宽为10000字节)
    shaped_traffic = traffic_shaper.shape_traffic(10000)
    
    print(f"整形后的流量数: {len(shaped_traffic)}")
    for traffic in shaped_traffic:
        print(f"  处理流量: {traffic['type']} ({traffic['size']} 字节)")
    
    # 获取统计信息
    stats = traffic_shaper.get_traffic_statistics()
    print(f"\n流量统计:")
    for class_name, bytes_sent in stats["bytes_sent_by_class"].items():
        print(f"  {class_name}: {bytes_sent} 字节")

# 运行演示
# demonstrate_qos()
```

通过实施全面的网络与协议性能优化策略，我们能够显著提升分布式文件存储平台的网络传输效率，为用户提供更快速、更可靠的数据服务。