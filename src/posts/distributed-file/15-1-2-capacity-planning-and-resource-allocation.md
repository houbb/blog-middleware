---
title: "容量规划与资源分配"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

容量规划与资源分配是分布式文件存储平台运营管理的核心环节，直接影响系统的性能、可用性和成本效益。通过科学的容量规划方法和智能化的资源分配策略，可以确保系统在满足业务需求的同时，实现资源的最优利用和成本控制。

## 15.1.2 容量规划方法论

容量规划需要基于历史数据、业务增长预测和系统性能模型，制定科学合理的资源规划方案。

### 15.1.2.1 容量预测模型

```python
# 容量预测模型
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import matplotlib.pyplot as plt

class CapacityPlanner:
    """容量规划器"""
    
    def __init__(self):
        self.historical_data = {}
        self.prediction_models = {}
        self.capacity_policies = {}
    
    def add_historical_data(self, resource_type: str, data: List[Dict[str, Any]]):
        """添加历史数据"""
        if resource_type not in self.historical_data:
            self.historical_data[resource_type] = []
        self.historical_data[resource_type].extend(data)
        print(f"添加 {resource_type} 历史数据，共 {len(data)} 条记录")
    
    def train_prediction_model(self, resource_type: str, model_type: str = "linear"):
        """训练预测模型"""
        if resource_type not in self.historical_data:
            raise ValueError(f"没有 {resource_type} 的历史数据")
        
        data = self.historical_data[resource_type]
        if len(data) < 10:
            raise ValueError(f"{resource_type} 历史数据不足，至少需要10条记录")
        
        # 准备训练数据
        timestamps = [datetime.fromisoformat(record["timestamp"]) for record in data]
        values = [record["value"] for record in data]
        
        # 转换时间为数值特征（相对于第一个时间点的天数）
        base_time = timestamps[0]
        time_features = [(ts - base_time).days for ts in timestamps]
        
        # 创建特征矩阵
        X = np.array(time_features).reshape(-1, 1)
        y = np.array(values)
        
        # 训练模型
        if model_type == "linear":
            model = LinearRegression()
        elif model_type == "random_forest":
            model = RandomForestRegressor(n_estimators=100, random_state=42)
        else:
            raise ValueError(f"不支持的模型类型: {model_type}")
        
        model.fit(X, y)
        self.prediction_models[resource_type] = model
        
        print(f"训练 {resource_type} 预测模型完成")
        return model
    
    def predict_capacity(self, resource_type: str, future_days: int = 30) -> Dict[str, Any]:
        """预测容量需求"""
        if resource_type not in self.prediction_models:
            raise ValueError(f"没有 {resource_type} 的预测模型")
        
        model = self.prediction_models[resource_type]
        
        # 获取历史数据的时间范围
        if resource_type not in self.historical_data:
            raise ValueError(f"没有 {resource_type} 的历史数据")
        
        data = self.historical_data[resource_type]
        timestamps = [datetime.fromisoformat(record["timestamp"]) for record in data]
        base_time = timestamps[0]
        last_time = timestamps[-1]
        
        # 预测未来时间点
        future_timestamps = [last_time + timedelta(days=i) for i in range(1, future_days + 1)]
        future_days_from_base = [(ts - base_time).days for ts in future_timestamps]
        
        # 进行预测
        X_future = np.array(future_days_from_base).reshape(-1, 1)
        predictions = model.predict(X_future)
        
        # 计算置信区间（简化实现）
        historical_values = [record["value"] for record in data]
        std_dev = np.std(historical_values)
        
        predictions_with_confidence = []
        for i, (timestamp, prediction) in enumerate(zip(future_timestamps, predictions)):
            predictions_with_confidence.append({
                "timestamp": timestamp.isoformat(),
                "predicted_value": float(prediction),
                "lower_bound": float(prediction - 1.96 * std_dev),
                "upper_bound": float(prediction + 1.96 * std_dev)
            })
        
        return {
            "resource_type": resource_type,
            "predictions": predictions_with_confidence,
            "prediction_period_days": future_days,
            "generated_at": datetime.now().isoformat()
        }
    
    def generate_capacity_plan(self, planning_horizon_days: int = 90) -> Dict[str, Any]:
        """生成容量规划方案"""
        capacity_plan = {
            "planning_horizon_days": planning_horizon_days,
            "resources": {},
            "recommendations": [],
            "risks": [],
            "generated_at": datetime.now().isoformat()
        }
        
        # 为每种资源类型生成预测
        for resource_type in self.historical_data.keys():
            try:
                if resource_type not in self.prediction_models:
                    self.train_prediction_model(resource_type)
                
                predictions = self.predict_capacity(resource_type, planning_horizon_days)
                capacity_plan["resources"][resource_type] = predictions
                
                # 生成推荐
                latest_prediction = predictions["predictions"][-1]
                current_capacity = self._get_current_capacity(resource_type)
                
                if latest_prediction["predicted_value"] > current_capacity * 0.8:
                    capacity_plan["recommendations"].append({
                        "resource_type": resource_type,
                        "action": "scale_up",
                        "required_capacity": latest_prediction["predicted_value"],
                        "current_capacity": current_capacity,
                        "urgency": "high" if latest_prediction["predicted_value"] > current_capacity * 0.9 else "medium"
                    })
                elif latest_prediction["predicted_value"] < current_capacity * 0.4:
                    capacity_plan["recommendations"].append({
                        "resource_type": resource_type,
                        "action": "scale_down",
                        "required_capacity": latest_prediction["predicted_value"],
                        "current_capacity": current_capacity,
                        "urgency": "low"
                    })
                
            except Exception as e:
                capacity_plan["risks"].append({
                    "resource_type": resource_type,
                    "error": str(e),
                    "impact": "无法生成准确的容量预测"
                })
        
        return capacity_plan
    
    def _get_current_capacity(self, resource_type: str) -> float:
        """获取当前容量"""
        # 简化实现，实际应该从配置或监控系统获取
        capacity_map = {
            "storage": 1000000,  # 1PB
            "bandwidth": 10000,  # 10Gbps
            "compute": 1000,     # 1000个CPU核心
            "memory": 100000     # 100TB内存
        }
        return capacity_map.get(resource_type, 1000)

class CapacityDataGenerator:
    """容量数据生成器（用于演示）"""
    
    @staticmethod
    def generate_storage_data(days: int = 365) -> List[Dict[str, Any]]:
        """生成存储容量历史数据"""
        data = []
        base_date = datetime.now() - timedelta(days=days)
        base_capacity = 500000  # 500TB
        
        for i in range(days):
            current_date = base_date + timedelta(days=i)
            # 模拟存储使用量增长（每年增长30%）
            growth_factor = (1.3 ** (i / 365))
            # 添加随机波动
            noise = np.random.normal(0, 0.02)
            capacity_used = base_capacity * growth_factor * (1 + noise)
            
            data.append({
                "timestamp": current_date.isoformat(),
                "value": float(capacity_used),
                "unit": "TB"
            })
        
        return data
    
    @staticmethod
    def generate_bandwidth_data(days: int = 365) -> List[Dict[str, Any]]:
        """生成带宽使用历史数据"""
        data = []
        base_date = datetime.now() - timedelta(days=days)
        base_bandwidth = 5000  # 5Gbps
        
        for i in range(days):
            current_date = base_date + timedelta(days=i)
            # 模拟带宽使用量周期性变化
            seasonal_factor = 1 + 0.3 * np.sin(2 * np.pi * i / 30)  # 月度周期
            trend_factor = 1 + 0.5 * (i / days)  # 长期增长趋势
            # 添加随机波动
            noise = np.random.normal(0, 0.05)
            bandwidth_used = base_bandwidth * seasonal_factor * trend_factor * (1 + noise)
            
            data.append({
                "timestamp": current_date.isoformat(),
                "value": float(bandwidth_used),
                "unit": "Mbps"
            })
        
        return data

# 使用示例
def demonstrate_capacity_planning():
    """演示容量规划"""
    # 创建容量规划器
    planner = CapacityPlanner()
    
    # 生成演示数据
    print("生成历史数据...")
    storage_data = CapacityDataGenerator.generate_storage_data(365)
    bandwidth_data = CapacityDataGenerator.generate_bandwidth_data(365)
    
    # 添加历史数据
    planner.add_historical_data("storage", storage_data[:300])  # 使用前300天数据训练
    planner.add_historical_data("bandwidth", bandwidth_data[:300])
    
    # 训练预测模型
    print("训练预测模型...")
    storage_model = planner.train_prediction_model("storage", "random_forest")
    bandwidth_model = planner.train_prediction_model("bandwidth", "random_forest")
    
    # 预测未来容量需求
    print("预测未来容量需求...")
    storage_prediction = planner.predict_capacity("storage", 30)
    bandwidth_prediction = planner.predict_capacity("bandwidth", 30)
    
    print(f"存储容量预测 (30天后): {storage_prediction['predictions'][-1]['predicted_value']:.2f} TB")
    print(f"带宽需求预测 (30天后): {bandwidth_prediction['predictions'][-1]['predicted_value']:.2f} Mbps")
    
    # 生成容量规划方案
    print("\n生成容量规划方案...")
    capacity_plan = planner.generate_capacity_plan(90)
    
    print("容量规划方案:")
    print(f"  规划周期: {capacity_plan['planning_horizon_days']} 天")
    print(f"  涉及资源类型: {list(capacity_plan['resources'].keys())}")
    print(f"  建议数量: {len(capacity_plan['recommendations'])}")
    print(f"  风险数量: {len(capacity_plan['risks'])}")
    
    for recommendation in capacity_plan['recommendations']:
        print(f"  - {recommendation['resource_type']}: {recommendation['action']}")
        print(f"    当前容量: {recommendation['current_capacity']:.2f}")
        print(f"    需要容量: {recommendation['required_capacity']:.2f}")
        print(f"    紧急程度: {recommendation['urgency']}")

# 运行演示
# demonstrate_capacity_planning()
```

### 15.1.2.2 资源分配策略

```java
// 资源分配策略实现
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

public class ResourceAllocator {
    
    private final Map<String, ResourcePool> resourcePools;
    private final AllocationStrategy allocationStrategy;
    private final Map<String, TenantQuota> tenantQuotas;
    private final AtomicLong allocationCounter;
    
    public ResourceAllocator(AllocationStrategy strategy) {
        this.resourcePools = new ConcurrentHashMap<>();
        this.allocationStrategy = strategy;
        this.tenantQuotas = new ConcurrentHashMap<>();
        this.allocationCounter = new AtomicLong(0);
    }
    
    /**
     * 添加资源池
     * @param poolName 资源池名称
     * @param resources 资源列表
     */
    public void addResourcePool(String poolName, List<Resource> resources) {
        ResourcePool pool = new ResourcePool(poolName, resources);
        resourcePools.put(poolName, pool);
        System.out.println("添加资源池: " + poolName + ", 资源数: " + resources.size());
    }
    
    /**
     * 设置租户配额
     * @param tenantId 租户ID
     * @param quota 配额
     */
    public void setTenantQuota(String tenantId, TenantQuota quota) {
        tenantQuotas.put(tenantId, quota);
        System.out.println("设置租户配额: " + tenantId);
    }
    
    /**
     * 分配资源
     * @param tenantId 租户ID
     * @param request 资源请求
     * @return 分配结果
     */
    public AllocationResult allocateResource(String tenantId, ResourceRequest request) {
        long allocationId = allocationCounter.incrementAndGet();
        
        try {
            // 检查租户配额
            if (!checkTenantQuota(tenantId, request)) {
                return new AllocationResult(allocationId, false, "超出租户配额限制", null);
            }
            
            // 选择合适的资源池
            ResourcePool selectedPool = allocationStrategy.selectPool(
                resourcePools.values(), request);
            
            if (selectedPool == null) {
                return new AllocationResult(allocationId, false, "没有合适的资源池", null);
            }
            
            // 在选定的资源池中分配资源
            Resource allocatedResource = selectedPool.allocateResource(request);
            
            if (allocatedResource == null) {
                return new AllocationResult(allocationId, false, "资源池中没有可用资源", null);
            }
            
            // 记录分配信息
            AllocationRecord record = new AllocationRecord(
                allocationId, tenantId, request, allocatedResource, LocalDateTime.now());
            
            // 更新租户使用情况
            updateTenantUsage(tenantId, request);
            
            System.out.println("成功分配资源: " + allocatedResource.getId() + 
                             " 给租户: " + tenantId);
            
            return new AllocationResult(allocationId, true, "分配成功", record);
            
        } catch (Exception e) {
            return new AllocationResult(allocationId, false, "分配过程中发生错误: " + e.getMessage(), null);
        }
    }
    
    /**
     * 检查租户配额
     * @param tenantId 租户ID
     * @param request 资源请求
     * @return 是否符合配额
     */
    private boolean checkTenantQuota(String tenantId, ResourceRequest request) {
        TenantQuota quota = tenantQuotas.get(tenantId);
        if (quota == null) {
            return true; // 没有配额限制
        }
        
        // 检查各类资源配额
        if (request.getCpuCores() > quota.getMaxCpuCores()) {
            return false;
        }
        
        if (request.getMemoryGb() > quota.getMaxMemoryGb()) {
            return false;
        }
        
        if (request.getStorageGb() > quota.getMaxStorageGb()) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 更新租户使用情况
     * @param tenantId 租户ID
     * @param request 资源请求
     */
    private void updateTenantUsage(String tenantId, ResourceRequest request) {
        // 在实际实现中，这里会更新租户的资源使用统计
        System.out.println("更新租户 " + tenantId + " 的资源使用情况");
    }
    
    /**
     * 释放资源
     * @param allocationId 分配ID
     * @return 是否成功释放
     */
    public boolean releaseResource(long allocationId) {
        // 在实际实现中，这里会查找对应的分配记录并释放资源
        System.out.println("释放资源分配: " + allocationId);
        return true;
    }
    
    /**
     * 获取资源池状态
     * @param poolName 资源池名称
     * @return 资源池状态
     */
    public PoolStatus getPoolStatus(String poolName) {
        ResourcePool pool = resourcePools.get(poolName);
        if (pool == null) {
            return null;
        }
        return pool.getStatus();
    }
    
    /**
     * 获取所有资源池状态
     * @return 资源池状态列表
     */
    public List<PoolStatus> getAllPoolStatus() {
        List<PoolStatus> statuses = new ArrayList<>();
        for (ResourcePool pool : resourcePools.values()) {
            statuses.add(pool.getStatus());
        }
        return statuses;
    }
}

// 资源分配策略接口
interface AllocationStrategy {
    ResourcePool selectPool(Iterable<ResourcePool> pools, ResourceRequest request);
}

// 基于资源利用率的分配策略
class UtilizationBasedAllocationStrategy implements AllocationStrategy {
    
    @Override
    public ResourcePool selectPool(Iterable<ResourcePool> pools, ResourceRequest request) {
        ResourcePool bestPool = null;
        double bestScore = Double.MAX_VALUE;
        
        for (ResourcePool pool : pools) {
            // 检查资源池是否有足够资源
            if (!pool.hasSufficientResources(request)) {
                continue;
            }
            
            // 计算资源池评分（基于利用率）
            double score = calculatePoolScore(pool, request);
            if (score < bestScore) {
                bestScore = score;
                bestPool = pool;
            }
        }
        
        return bestPool;
    }
    
    private double calculatePoolScore(ResourcePool pool, ResourceRequest request) {
        PoolStatus status = pool.getStatus();
        
        // 计算综合评分，考虑各种资源的利用率
        double cpuUtilization = (double) status.getUsedCpuCores() / status.getTotalCpuCores();
        double memoryUtilization = (double) status.getUsedMemoryGb() / status.getTotalMemoryGb();
        double storageUtilization = (double) status.getUsedStorageGb() / status.getTotalStorageGb();
        
        // 优先选择利用率较低的资源池，以实现负载均衡
        return (cpuUtilization + memoryUtilization + storageUtilization) / 3;
    }
}

// 基于位置亲和性的分配策略
class AffinityBasedAllocationStrategy implements AllocationStrategy {
    
    private final String preferredLocation;
    
    public AffinityBasedAllocationStrategy(String preferredLocation) {
        this.preferredLocation = preferredLocation;
    }
    
    @Override
    public ResourcePool selectPool(Iterable<ResourcePool> pools, ResourceRequest request) {
        ResourcePool preferredPool = null;
        ResourcePool fallbackPool = null;
        
        for (ResourcePool pool : pools) {
            // 检查资源池是否有足够资源
            if (!pool.hasSufficientResources(request)) {
                continue;
            }
            
            // 优先选择指定位置的资源池
            if (pool.getLocation().equals(preferredLocation)) {
                if (preferredPool == null || 
                    pool.getStatus().getAvailableResources() > preferredPool.getStatus().getAvailableResources()) {
                    preferredPool = pool;
                }
            } else {
                // 备选资源池
                if (fallbackPool == null || 
                    pool.getStatus().getAvailableResources() > fallbackPool.getStatus().getAvailableResources()) {
                    fallbackPool = pool;
                }
            }
        }
        
        // 优先返回指定位置的资源池
        return preferredPool != null ? preferredPool : fallbackPool;
    }
}

// 资源池类
class ResourcePool {
    private final String name;
    private final List<Resource> resources;
    private final String location;
    private final Map<String, Boolean> resourceAvailability;
    
    public ResourcePool(String name, List<Resource> resources) {
        this.name = name;
        this.resources = new ArrayList<>(resources);
        this.location = resources.isEmpty() ? "unknown" : resources.get(0).getLocation();
        this.resourceAvailability = new ConcurrentHashMap<>();
        
        // 初始化资源可用性
        for (Resource resource : resources) {
            resourceAvailability.put(resource.getId(), true);
        }
    }
    
    public Resource allocateResource(ResourceRequest request) {
        synchronized (this) {
            for (Resource resource : resources) {
                if (resourceAvailability.getOrDefault(resource.getId(), false) &&
                    resource.canSatisfyRequest(request)) {
                    
                    resourceAvailability.put(resource.getId(), false);
                    return resource;
                }
            }
            return null;
        }
    }
    
    public boolean hasSufficientResources(ResourceRequest request) {
        int availableCount = 0;
        for (Boolean available : resourceAvailability.values()) {
            if (available) availableCount++;
        }
        return availableCount > 0;
    }
    
    public PoolStatus getStatus() {
        int totalCpu = 0, usedCpu = 0;
        long totalMemory = 0, usedMemory = 0;
        long totalStorage = 0, usedStorage = 0;
        
        for (Resource resource : resources) {
            totalCpu += resource.getCpuCores();
            totalMemory += resource.getMemoryGb();
            totalStorage += resource.getStorageGb();
            
            if (!resourceAvailability.getOrDefault(resource.getId(), true)) {
                usedCpu += resource.getCpuCores();
                usedMemory += resource.getMemoryGb();
                usedStorage += resource.getStorageGb();
            }
        }
        
        return new PoolStatus(name, location, totalCpu, usedCpu, totalMemory, 
                            usedMemory, totalStorage, usedStorage, resources.size());
    }
    
    public String getName() { return name; }
    public String getLocation() { return location; }
    public int getAvailableResources() { 
        return (int) resourceAvailability.values().stream().filter(Boolean::booleanValue).count();
    }
}

// 资源类
class Resource {
    private final String id;
    private final String location;
    private final int cpuCores;
    private final long memoryGb;
    private final long storageGb;
    private final Map<String, String> attributes;
    
    public Resource(String id, String location, int cpuCores, long memoryGb, long storageGb) {
        this.id = id;
        this.location = location;
        this.cpuCores = cpuCores;
        this.memoryGb = memoryGb;
        this.storageGb = storageGb;
        this.attributes = new ConcurrentHashMap<>();
    }
    
    public boolean canSatisfyRequest(ResourceRequest request) {
        return this.cpuCores >= request.getCpuCores() &&
               this.memoryGb >= request.getMemoryGb() &&
               this.storageGb >= request.getStorageGb();
    }
    
    // Getters
    public String getId() { return id; }
    public String getLocation() { return location; }
    public int getCpuCores() { return cpuCores; }
    public long getMemoryGb() { return memoryGb; }
    public long getStorageGb() { return storageGb; }
    public Map<String, String> getAttributes() { return attributes; }
}

// 资源请求类
class ResourceRequest {
    private final int cpuCores;
    private final long memoryGb;
    private final long storageGb;
    private final String requiredLocation;
    private final Map<String, String> attributes;
    
    public ResourceRequest(int cpuCores, long memoryGb, long storageGb) {
        this.cpuCores = cpuCores;
        this.memoryGb = memoryGb;
        this.storageGb = storageGb;
        this.requiredLocation = null;
        this.attributes = new ConcurrentHashMap<>();
    }
    
    // Getters
    public int getCpuCores() { return cpuCores; }
    public long getMemoryGb() { return memoryGb; }
    public long getStorageGb() { return storageGb; }
    public String getRequiredLocation() { return requiredLocation; }
    public Map<String, String> getAttributes() { return attributes; }
}

// 租户配额类
class TenantQuota {
    private final int maxCpuCores;
    private final long maxMemoryGb;
    private final long maxStorageGb;
    private final int maxResourceCount;
    
    public TenantQuota(int maxCpuCores, long maxMemoryGb, long maxStorageGb, int maxResourceCount) {
        this.maxCpuCores = maxCpuCores;
        this.maxMemoryGb = maxMemoryGb;
        this.maxStorageGb = maxStorageGb;
        this.maxResourceCount = maxResourceCount;
    }
    
    // Getters
    public int getMaxCpuCores() { return maxCpuCores; }
    public long getMaxMemoryGb() { return maxMemoryGb; }
    public long getMaxStorageGb() { return maxStorageGb; }
    public int getMaxResourceCount() { return maxResourceCount; }
}

// 资源池状态类
class PoolStatus {
    private final String poolName;
    private final String location;
    private final int totalCpuCores;
    private final int usedCpuCores;
    private final long totalMemoryGb;
    private final long usedMemoryGb;
    private final long totalStorageGb;
    private final long usedStorageGb;
    private final int totalResources;
    
    public PoolStatus(String poolName, String location, int totalCpuCores, int usedCpuCores,
                     long totalMemoryGb, long usedMemoryGb, long totalStorageGb, 
                     long usedStorageGb, int totalResources) {
        this.poolName = poolName;
        this.location = location;
        this.totalCpuCores = totalCpuCores;
        this.usedCpuCores = usedCpuCores;
        this.totalMemoryGb = totalMemoryGb;
        this.usedMemoryGb = usedMemoryGb;
        this.totalStorageGb = totalStorageGb;
        this.usedStorageGb = usedStorageGb;
        this.totalResources = totalResources;
    }
    
    // Getters
    public String getPoolName() { return poolName; }
    public String getLocation() { return location; }
    public int getTotalCpuCores() { return totalCpuCores; }
    public int getUsedCpuCores() { return usedCpuCores; }
    public long getTotalMemoryGb() { return totalMemoryGb; }
    public long getUsedMemoryGb() { return usedMemoryGb; }
    public long getTotalStorageGb() { return totalStorageGb; }
    public long getUsedStorageGb() { return usedStorageGb; }
    public int getTotalResources() { return totalResources; }
    public int getAvailableResources() { return totalResources - getUsedResources(); }
    public int getUsedResources() { 
        // 简化计算，实际应该基于具体分配情况
        return (int)(usedCpuCores > 0 ? totalResources * usedCpuCores / totalCpuCores : 0);
    }
}

// 分配记录类
class AllocationRecord {
    private final long allocationId;
    private final String tenantId;
    private final ResourceRequest request;
    private final Resource allocatedResource;
    private final LocalDateTime allocationTime;
    private LocalDateTime releaseTime;
    
    public AllocationRecord(long allocationId, String tenantId, ResourceRequest request, 
                          Resource allocatedResource, LocalDateTime allocationTime) {
        this.allocationId = allocationId;
        this.tenantId = tenantId;
        this.request = request;
        this.allocatedResource = allocatedResource;
        this.allocationTime = allocationTime;
    }
    
    // Getters and Setters
    public long getAllocationId() { return allocationId; }
    public String getTenantId() { return tenantId; }
    public ResourceRequest getRequest() { return request; }
    public Resource getAllocatedResource() { return allocatedResource; }
    public LocalDateTime getAllocationTime() { return allocationTime; }
    public LocalDateTime getReleaseTime() { return releaseTime; }
    public void setReleaseTime(LocalDateTime releaseTime) { this.releaseTime = releaseTime; }
    
    public long getUsageDurationMinutes() {
        LocalDateTime end = releaseTime != null ? releaseTime : LocalDateTime.now();
        return ChronoUnit.MINUTES.between(allocationTime, end);
    }
}

// 分配结果类
class AllocationResult {
    private final long allocationId;
    private final boolean success;
    private final String message;
    private final AllocationRecord record;
    
    public AllocationResult(long allocationId, boolean success, String message, AllocationRecord record) {
        this.allocationId = allocationId;
        this.success = success;
        this.message = message;
        this.record = record;
    }
    
    // Getters
    public long getAllocationId() { return allocationId; }
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public AllocationRecord getRecord() { return record; }
}
```

## 15.1.3 智能资源调度

基于实时监控数据和预测模型，实现智能化的资源调度和负载均衡。

### 15.1.3.1 动态资源调度算法

```go
// 动态资源调度算法实现
package main

import (
    "time"
    "sync"
    "math"
    "sort"
    "log"
)

// 资源调度器
type ResourceScheduler struct {
    clusters       map[string]*Cluster
    schedulerLock  sync.RWMutex
    schedulingInterval time.Duration
    ticker         *time.Ticker
    running        bool
}

// 集群信息
type Cluster struct {
    ID          string
    Nodes       []*Node
    TotalCPU    int
    UsedCPU     int
    TotalMemory int64
    UsedMemory  int64
    TotalStorage int64
    UsedStorage int64
}

// 节点信息
type Node struct {
    ID          string
    ClusterID   string
    CPU         int
    Memory      int64
    Storage     int64
    UsedCPU     int
    UsedMemory  int64
    UsedStorage int64
    Status      string // "healthy", "warning", "error"
    LastUpdated time.Time
}

// 调度请求
type SchedulingRequest struct {
    ID          string
    CPU         int
    Memory      int64
    Storage     int64
    Priority    int // 1-10, 10为最高优先级
    Affinity    []string // 亲和性要求
    AntiAffinity []string // 反亲和性要求
}

// 调度决策
type SchedulingDecision struct {
    RequestID   string
    NodeID      string
    ClusterID   string
    Score       float64
    Reason      string
}

// 新建资源调度器
func NewResourceScheduler(interval time.Duration) *ResourceScheduler {
    return &ResourceScheduler{
        clusters: make(map[string]*Cluster),
        schedulingInterval: interval,
        running: false,
    }
}

// 添加集群
func (rs *ResourceScheduler) AddCluster(cluster *Cluster) {
    rs.schedulerLock.Lock()
    defer rs.schedulerLock.Unlock()
    
    rs.clusters[cluster.ID] = cluster
    log.Printf("添加集群: %s", cluster.ID)
}

// 更新节点状态
func (rs *ResourceScheduler) UpdateNodeStatus(node *Node) {
    rs.schedulerLock.Lock()
    defer rs.schedulerLock.Unlock()
    
    cluster, exists := rs.clusters[node.ClusterID]
    if !exists {
        log.Printf("集群不存在: %s", node.ClusterID)
        return
    }
    
    // 查找并更新节点
    for i, n := range cluster.Nodes {
        if n.ID == node.ID {
            // 更新集群资源使用情况
            cluster.UsedCPU = cluster.UsedCPU - n.UsedCPU + node.UsedCPU
            cluster.UsedMemory = cluster.UsedMemory - n.UsedMemory + node.UsedMemory
            cluster.UsedStorage = cluster.UsedStorage - n.UsedStorage + node.UsedStorage
            
            // 更新节点
            cluster.Nodes[i] = node
            node.LastUpdated = time.Now()
            return
        }
    }
    
    // 添加新节点
    cluster.Nodes = append(cluster.Nodes, node)
    cluster.TotalCPU += node.CPU
    cluster.TotalMemory += node.Memory
    cluster.TotalStorage += node.Storage
    cluster.UsedCPU += node.UsedCPU
    cluster.UsedMemory += node.UsedMemory
    cluster.UsedStorage += node.UsedStorage
    node.LastUpdated = time.Now()
    
    log.Printf("添加节点: %s 到集群: %s", node.ID, node.ClusterID)
}

// 调度资源
func (rs *ResourceScheduler) Schedule(request *SchedulingRequest) *SchedulingDecision {
    rs.schedulerLock.RLock()
    defer rs.schedulerLock.RUnlock()
    
    // 收集所有可用节点
    var availableNodes []*Node
    for _, cluster := range rs.clusters {
        for _, node := range cluster.Nodes {
            if node.Status == "healthy" && rs.canNodeAccommodate(node, request) {
                availableNodes = append(availableNodes, node)
            }
        }
    }
    
    if len(availableNodes) == 0 {
        return &SchedulingDecision{
            RequestID: request.ID,
            NodeID:    "",
            ClusterID: "",
            Score:     0,
            Reason:    "没有足够的资源满足请求",
        }
    }
    
    // 评分所有可用节点
    scoredNodes := rs.scoreNodes(availableNodes, request)
    
    // 选择得分最高的节点
    sort.Slice(scoredNodes, func(i, j int) bool {
        return scoredNodes[i].Score > scoredNodes[j].Score
    })
    
    bestNode := availableNodes[0]
    return &SchedulingDecision{
        RequestID: request.ID,
        NodeID:    bestNode.ID,
        ClusterID: bestNode.ClusterID,
        Score:     scoredNodes[0].Score,
        Reason:    "找到最优节点",
    }
}

// 检查节点是否能容纳请求
func (rs *ResourceScheduler) canNodeAccommodate(node *Node, request *SchedulingRequest) bool {
    return (node.CPU-node.UsedCPU) >= request.CPU &&
           (node.Memory-node.UsedMemory) >= request.Memory &&
           (node.Storage-node.UsedStorage) >= request.Storage
}

// 为节点评分
func (rs *ResourceScheduler) scoreNodes(nodes []*Node, request *SchedulingRequest) []*SchedulingDecision {
    decisions := make([]*SchedulingDecision, len(nodes))
    
    for i, node := range nodes {
        score := rs.calculateNodeScore(node, request)
        decisions[i] = &SchedulingDecision{
            NodeID:  node.ID,
            Score:   score,
            Reason:  "节点评分",
        }
    }
    
    return decisions
}

// 计算节点评分
func (rs *ResourceScheduler) calculateNodeScore(node *Node, request *SchedulingRequest) float64 {
    // 基础资源利用率评分
    cpuUtilization := float64(node.UsedCPU) / float64(node.CPU)
    memoryUtilization := float64(node.UsedMemory) / float64(node.Memory)
    storageUtilization := float64(node.UsedStorage) / float64(node.Storage)
    
    // 利用率越低得分越高（保留资源空间）
    cpuScore := 1.0 - cpuUtilization
    memoryScore := 1.0 - memoryUtilization
    storageScore := 1.0 - storageUtilization
    
    // 综合评分
    baseScore := (cpuScore + memoryScore + storageScore) / 3.0
    
    // 亲和性调整
    affinityScore := rs.calculateAffinityScore(node, request)
    
    // 优先级调整
    priorityScore := float64(request.Priority) / 10.0
    
    // 最终评分
    finalScore := baseScore * 0.6 + affinityScore * 0.3 + priorityScore * 0.1
    
    // 确保评分在0-1之间
    return math.Max(0.0, math.Min(1.0, finalScore))
}

// 计算亲和性评分
func (rs *ResourceScheduler) calculateAffinityScore(node *Node, request *SchedulingRequest) float64 {
    // 简化实现，实际应该考虑标签匹配、位置亲和性等因素
    if len(request.Affinity) == 0 && len(request.AntiAffinity) == 0 {
        return 0.5 // 中性评分
    }
    
    // 检查反亲和性
    for _, anti := range request.AntiAffinity {
        // 这里应该检查节点是否已经有相同标签的实例
        // 简化实现，假设没有冲突
        _ = anti
    }
    
    // 检查亲和性
    affinityMatch := 0
    for _, affinity := range request.Affinity {
        // 这里应该检查节点是否满足亲和性要求
        // 简化实现，假设部分匹配
        _ = affinity
        affinityMatch++
    }
    
    // 计算亲和性得分
    if len(request.Affinity) > 0 {
        return float64(affinityMatch) / float64(len(request.Affinity))
    }
    
    return 0.5
}

// 启动调度器
func (rs *ResourceScheduler) Start() {
    rs.schedulerLock.Lock()
    if rs.running {
        rs.schedulerLock.Unlock()
        return
    }
    rs.running = true
    rs.schedulerLock.Unlock()
    
    rs.ticker = time.NewTicker(rs.schedulingInterval)
    
    go func() {
        for range rs.ticker.C {
            rs.performScheduledTasks()
        }
    }()
    
    log.Println("资源调度器已启动")
}

// 停止调度器
func (rs *ResourceScheduler) Stop() {
    rs.schedulerLock.Lock()
    defer rs.schedulerLock.Unlock()
    
    if !rs.running {
        return
    }
    
    rs.running = false
    if rs.ticker != nil {
        rs.ticker.Stop()
    }
    
    log.Println("资源调度器已停止")
}

// 执行计划任务
func (rs *ResourceScheduler) performScheduledTasks() {
    rs.schedulerLock.RLock()
    defer rs.schedulerLock.RUnlock()
    
    log.Println("执行计划调度任务")
    
    // 这里可以实现负载均衡、故障恢复等定期任务
    for _, cluster := range rs.clusters {
        rs.checkClusterHealth(cluster)
    }
}

// 检查集群健康状态
func (rs *ResourceScheduler) checkClusterHealth(cluster *Cluster) {
    unhealthyNodes := 0
    for _, node := range cluster.Nodes {
        if node.Status != "healthy" {
            unhealthyNodes++
        }
        
        // 检查节点是否长时间未更新
        if time.Since(node.LastUpdated) > 5*time.Minute {
            log.Printf("节点 %s 长时间未更新", node.ID)
        }
    }
    
    if unhealthyNodes > 0 {
        log.Printf("集群 %s 有 %d 个不健康节点", cluster.ID, unhealthyNodes)
    }
}

// 使用示例
func demonstrateResourceScheduling() {
    // 创建资源调度器
    scheduler := NewResourceScheduler(30 * time.Second)
    
    // 创建集群和节点
    cluster1 := &Cluster{
        ID: "cluster-1",
    }
    
    node1 := &Node{
        ID:          "node-1",
        ClusterID:   "cluster-1",
        CPU:         32,
        Memory:      128 * 1024 * 1024 * 1024, // 128GB
        Storage:     2 * 1024 * 1024 * 1024 * 1024, // 2TB
        UsedCPU:     8,
        UsedMemory:  32 * 1024 * 1024 * 1024, // 32GB
        UsedStorage: 500 * 1024 * 1024 * 1024, // 500GB
        Status:      "healthy",
    }
    
    node2 := &Node{
        ID:          "node-2",
        ClusterID:   "cluster-1",
        CPU:         16,
        Memory:      64 * 1024 * 1024 * 1024, // 64GB
        Storage:     1 * 1024 * 1024 * 1024 * 1024, // 1TB
        UsedCPU:     4,
        UsedMemory:  16 * 1024 * 1024 * 1024, // 16GB
        UsedStorage: 200 * 1024 * 1024 * 1024, // 200GB
        Status:      "healthy",
    }
    
    // 添加集群和节点
    scheduler.AddCluster(cluster1)
    scheduler.UpdateNodeStatus(node1)
    scheduler.UpdateNodeStatus(node2)
    
    // 创建调度请求
    request := &SchedulingRequest{
        ID:       "request-1",
        CPU:      4,
        Memory:   16 * 1024 * 1024 * 1024, // 16GB
        Storage:  100 * 1024 * 1024 * 1024, // 100GB
        Priority: 5,
    }
    
    // 执行调度
    decision := scheduler.Schedule(request)
    log.Printf("调度决策: %+v", decision)
    
    // 启动调度器
    scheduler.Start()
    
    // 运行一段时间
    time.Sleep(5 * time.Second)
    
    // 停止调度器
    scheduler.Stop()
    
    fmt.Println("资源调度演示完成")
}

// func main() {
//     demonstrateResourceScheduling()
// }
```

通过建立科学的容量规划方法和智能化的资源分配策略，分布式文件存储平台能够实现资源的最优配置，在满足业务需求的同时最大化资源利用率和成本效益。