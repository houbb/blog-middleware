---
title: 监控与运维
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center]
published: true
---

在生产环境中，服务注册与配置中心的稳定运行至关重要。建立完善的监控体系和运维工具链，能够及时发现和处理问题，保障系统的高可用性。本章将深入探讨指标采集、日志管理、告警机制以及自动化运维工具链等监控与运维关键技术。

## 指标采集（QPS、延迟、可用率）

指标采集是监控体系的基础，通过收集关键性能指标，可以全面了解注册中心的运行状态。

### 核心指标定义

```java
// 注册中心核心指标
public class RegistryMetrics {
    
    // 服务注册相关指标
    public static final String SERVICE_REGISTER_COUNT = "registry.service.register.count";
    public static final String SERVICE_REGISTER_LATENCY = "registry.service.register.latency";
    public static final String SERVICE_REGISTER_ERROR_COUNT = "registry.service.register.error.count";
    
    // 服务发现相关指标
    public static final String SERVICE_DISCOVERY_COUNT = "registry.service.discovery.count";
    public static final String SERVICE_DISCOVERY_LATENCY = "registry.service.discovery.latency";
    public static final String SERVICE_DISCOVERY_ERROR_COUNT = "registry.service.discovery.error.count";
    
    // 配置管理相关指标
    public static final String CONFIG_PUBLISH_COUNT = "registry.config.publish.count";
    public static final String CONFIG_PUBLISH_LATENCY = "registry.config.publish.latency";
    public static final String CONFIG_QUERY_COUNT = "registry.config.query.count";
    public static final String CONFIG_QUERY_LATENCY = "registry.config.query.latency";
    
    // 系统健康相关指标
    public static final String SYSTEM_CPU_USAGE = "registry.system.cpu.usage";
    public static final String SYSTEM_MEMORY_USAGE = "registry.system.memory.usage";
    public static final String SYSTEM_DISK_USAGE = "registry.system.disk.usage";
    public static final String SYSTEM_GC_COUNT = "registry.system.gc.count";
    public static final String SYSTEM_GC_TIME = "registry.system.gc.time";
}
```

### 指标采集实现

```java
// 指标采集器
@Component
public class MetricsCollector {
    
    @Autowired
    private MeterRegistry meterRegistry;
    
    // 计数器指标
    private Counter serviceRegisterCounter;
    private Counter serviceRegisterErrorCounter;
    private Counter serviceDiscoveryCounter;
    private Counter serviceDiscoveryErrorCounter;
    
    // 计时器指标
    private Timer serviceRegisterTimer;
    private Timer serviceDiscoveryTimer;
    private Timer configPublishTimer;
    private Timer configQueryTimer;
    
    @PostConstruct
    public void initMetrics() {
        // 初始化计数器
        serviceRegisterCounter = Counter.builder(RegistryMetrics.SERVICE_REGISTER_COUNT)
            .description("Service register count")
            .register(meterRegistry);
            
        serviceRegisterErrorCounter = Counter.builder(RegistryMetrics.SERVICE_REGISTER_ERROR_COUNT)
            .description("Service register error count")
            .register(meterRegistry);
            
        serviceDiscoveryCounter = Counter.builder(RegistryMetrics.SERVICE_DISCOVERY_COUNT)
            .description("Service discovery count")
            .register(meterRegistry);
            
        serviceDiscoveryErrorCounter = Counter.builder(RegistryMetrics.SERVICE_DISCOVERY_ERROR_COUNT)
            .description("Service discovery error count")
            .register(meterRegistry);
        
        // 初始化计时器
        serviceRegisterTimer = Timer.builder(RegistryMetrics.SERVICE_REGISTER_LATENCY)
            .description("Service register latency")
            .register(meterRegistry);
            
        serviceDiscoveryTimer = Timer.builder(RegistryMetrics.SERVICE_DISCOVERY_LATENCY)
            .description("Service discovery latency")
            .register(meterRegistry);
            
        configPublishTimer = Timer.builder(RegistryMetrics.CONFIG_PUBLISH_LATENCY)
            .description("Config publish latency")
            .register(meterRegistry);
            
        configQueryTimer = Timer.builder(RegistryMetrics.CONFIG_QUERY_LATENCY)
            .description("Config query latency")
            .register(meterRegistry);
    }
    
    // 服务注册指标采集
    public <T> T recordServiceRegister(Supplier<T> operation) {
        serviceRegisterCounter.increment();
        return serviceRegisterTimer.record(operation);
    }
    
    public void recordServiceRegisterError() {
        serviceRegisterErrorCounter.increment();
    }
    
    // 服务发现指标采集
    public <T> T recordServiceDiscovery(Supplier<T> operation) {
        serviceDiscoveryCounter.increment();
        return serviceDiscoveryTimer.record(operation);
    }
    
    public void recordServiceDiscoveryError() {
        serviceDiscoveryErrorCounter.increment();
    }
    
    // 配置发布指标采集
    public <T> T recordConfigPublish(Supplier<T> operation) {
        return configPublishTimer.record(operation);
    }
    
    // 配置查询指标采集
    public <T> T recordConfigQuery(Supplier<T> operation) {
        return configQueryTimer.record(operation);
    }
}
```

### 系统指标采集

```java
// 系统指标采集器
@Component
public class SystemMetricsCollector {
    
    @Autowired
    private MeterRegistry meterRegistry;
    
    private Gauge cpuUsageGauge;
    private Gauge memoryUsageGauge;
    private Gauge diskUsageGauge;
    
    @PostConstruct
    public void initSystemMetrics() {
        // CPU使用率
        cpuUsageGauge = Gauge.builder(RegistryMetrics.SYSTEM_CPU_USAGE)
            .description("System CPU usage")
            .register(meterRegistry, this, SystemMetricsCollector::getCpuUsage);
            
        // 内存使用率
        memoryUsageGauge = Gauge.builder(RegistryMetrics.SYSTEM_MEMORY_USAGE)
            .description("System memory usage")
            .register(meterRegistry, this, SystemMetricsCollector::getMemoryUsage);
            
        // 磁盘使用率
        diskUsageGauge = Gauge.builder(RegistryMetrics.SYSTEM_DISK_USAGE)
            .description("System disk usage")
            .register(meterRegistry, this, SystemMetricsCollector::getDiskUsage);
    }
    
    // 获取CPU使用率
    public double getCpuUsage() {
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);
            return osBean.getSystemCpuLoad() * 100;
        } catch (Exception e) {
            return -1;
        }
    }
    
    // 获取内存使用率
    public double getMemoryUsage() {
        try {
            MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
            MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
            return (double) heapUsage.getUsed() / heapUsage.getMax() * 100;
        } catch (Exception e) {
            return -1;
        }
    }
    
    // 获取磁盘使用率
    public double getDiskUsage() {
        try {
            File file = new File("/");
            long totalSpace = file.getTotalSpace();
            long freeSpace = file.getFreeSpace();
            return (double) (totalSpace - freeSpace) / totalSpace * 100;
        } catch (Exception e) {
            return -1;
        }
    }
}
```

### 自定义指标端点

```java
// 自定义指标端点
@RestController
@RequestMapping("/actuator/metrics")
public class CustomMetricsEndpoint {
    
    @Autowired
    private MetricsCollector metricsCollector;
    
    // 获取服务注册QPS
    @GetMapping("/service-register/qps")
    public Map<String, Object> getServiceRegisterQPS() {
        Map<String, Object> result = new HashMap<>();
        
        // 计算最近1分钟的QPS
        double qps = calculateQPS(RegistryMetrics.SERVICE_REGISTER_COUNT, 60);
        result.put("qps", qps);
        
        // 计算平均延迟
        double avgLatency = calculateAvgLatency(RegistryMetrics.SERVICE_REGISTER_LATENCY);
        result.put("avgLatency", avgLatency);
        
        // 错误率
        double errorRate = calculateErrorRate(RegistryMetrics.SERVICE_REGISTER_COUNT, 
                                           RegistryMetrics.SERVICE_REGISTER_ERROR_COUNT);
        result.put("errorRate", errorRate);
        
        return result;
    }
    
    // 获取服务发现QPS
    @GetMapping("/service-discovery/qps")
    public Map<String, Object> getServiceDiscoveryQPS() {
        Map<String, Object> result = new HashMap<>();
        
        double qps = calculateQPS(RegistryMetrics.SERVICE_DISCOVERY_COUNT, 60);
        result.put("qps", qps);
        
        double avgLatency = calculateAvgLatency(RegistryMetrics.SERVICE_DISCOVERY_LATENCY);
        result.put("avgLatency", avgLatency);
        
        double errorRate = calculateErrorRate(RegistryMetrics.SERVICE_DISCOVERY_COUNT, 
                                           RegistryMetrics.SERVICE_DISCOVERY_ERROR_COUNT);
        result.put("errorRate", errorRate);
        
        return result;
    }
    
    private double calculateQPS(String metricName, int seconds) {
        // 实现QPS计算逻辑
        // 这里简化处理，实际应该查询监控系统的历史数据
        return 0.0;
    }
    
    private double calculateAvgLatency(String metricName) {
        // 实现平均延迟计算逻辑
        return 0.0;
    }
    
    private double calculateErrorRate(String totalCountMetric, String errorCountMetric) {
        // 实现错误率计算逻辑
        return 0.0;
    }
}
```

## 日志与告警

完善的日志管理和告警机制是保障系统稳定运行的重要手段。

### 结构化日志

```java
// 结构化日志记录器
@Component
public class StructuredLogger {
    
    private static final Logger logger = LoggerFactory.getLogger(StructuredLogger.class);
    
    // 服务注册日志
    public void logServiceRegister(String serviceId, String instanceId, String ip, int port, String result) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("eventType", "SERVICE_REGISTER");
        logData.put("serviceId", serviceId);
        logData.put("instanceId", instanceId);
        logData.put("ip", ip);
        logData.put("port", port);
        logData.put("result", result);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Service register event: {}", toJson(logData));
    }
    
    // 服务发现日志
    public void logServiceDiscovery(String serviceId, int instanceCount, String clientIp, String result) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("eventType", "SERVICE_DISCOVERY");
        logData.put("serviceId", serviceId);
        logData.put("instanceCount", instanceCount);
        logData.put("clientIp", clientIp);
        logData.put("result", result);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Service discovery event: {}", toJson(logData));
    }
    
    // 配置变更日志
    public void logConfigChange(String dataId, String group, String operator, String changeType) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("eventType", "CONFIG_CHANGE");
        logData.put("dataId", dataId);
        logData.put("group", group);
        logData.put("operator", operator);
        logData.put("changeType", changeType);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Config change event: {}", toJson(logData));
    }
    
    private String toJson(Map<String, Object> data) {
        try {
            return new ObjectMapper().writeValueAsString(data);
        } catch (Exception e) {
            return data.toString();
        }
    }
}
```

### 告警规则配置

```java
// 告警规则管理器
@Component
public class AlertRuleManager {
    
    // 告警规则配置
    private List<AlertRule> alertRules = new ArrayList<>();
    
    @PostConstruct
    public void initAlertRules() {
        // 服务注册失败率告警
        AlertRule registerErrorRateRule = AlertRule.builder()
            .name("high_service_register_error_rate")
            .metric(RegistryMetrics.SERVICE_REGISTER_ERROR_COUNT)
            .operator(AlertOperator.GREATER_THAN)
            .threshold(0.05) // 错误率超过5%
            .duration("5m") // 持续5分钟
            .severity(AlertSeverity.CRITICAL)
            .summary("High service register error rate detected")
            .description("Service register error rate exceeded 5% for 5 minutes")
            .build();
            
        // 服务发现延迟告警
        AlertRule discoveryLatencyRule = AlertRule.builder()
            .name("high_service_discovery_latency")
            .metric(RegistryMetrics.SERVICE_DISCOVERY_LATENCY)
            .operator(AlertOperator.GREATER_THAN)
            .threshold(1000.0) // 延迟超过1秒
            .duration("1m") // 持续1分钟
            .severity(AlertSeverity.WARNING)
            .summary("High service discovery latency detected")
            .description("Service discovery latency exceeded 1 second for 1 minute")
            .build();
            
        // 系统CPU使用率告警
        AlertRule cpuUsageRule = AlertRule.builder()
            .name("high_cpu_usage")
            .metric(RegistryMetrics.SYSTEM_CPU_USAGE)
            .operator(AlertOperator.GREATER_THAN)
            .threshold(80.0) // CPU使用率超过80%
            .duration("2m") // 持续2分钟
            .severity(AlertSeverity.WARNING)
            .summary("High CPU usage detected")
            .description("System CPU usage exceeded 80% for 2 minutes")
            .build();
            
        alertRules.addAll(Arrays.asList(registerErrorRateRule, discoveryLatencyRule, cpuUsageRule));
    }
    
    // 评估告警规则
    public List<Alert> evaluateAlerts() {
        List<Alert> triggeredAlerts = new ArrayList<>();
        
        for (AlertRule rule : alertRules) {
            double currentValue = getCurrentMetricValue(rule.getMetric());
            if (rule.evaluate(currentValue)) {
                Alert alert = new Alert();
                alert.setRuleName(rule.getName());
                alert.setSeverity(rule.getSeverity());
                alert.setSummary(rule.getSummary());
                alert.setDescription(rule.getDescription());
                alert.setTimestamp(System.currentTimeMillis());
                triggeredAlerts.add(alert);
            }
        }
        
        return triggeredAlerts;
    }
    
    private double getCurrentMetricValue(String metricName) {
        // 实现获取当前指标值的逻辑
        // 这里简化处理，实际应该查询监控系统
        return 0.0;
    }
}
```

### 告警通知

```java
// 告警通知管理器
@Component
public class AlertNotificationManager {
    
    // 通知渠道
    @Autowired
    private EmailNotifier emailNotifier;
    
    @Autowired
    private SmsNotifier smsNotifier;
    
    @Autowired
    private WebhookNotifier webhookNotifier;
    
    // 告警通知
    public void notifyAlert(Alert alert) {
        // 根据告警级别选择通知方式
        switch (alert.getSeverity()) {
            case CRITICAL:
                // 关键告警：邮件+短信+Webhook
                emailNotifier.sendCriticalAlert(alert);
                smsNotifier.sendCriticalAlert(alert);
                webhookNotifier.sendAlert(alert);
                break;
                
            case WARNING:
                // 警告告警：邮件+Webhook
                emailNotifier.sendWarningAlert(alert);
                webhookNotifier.sendAlert(alert);
                break;
                
            case INFO:
                // 信息告警：仅Webhook
                webhookNotifier.sendAlert(alert);
                break;
        }
    }
    
    // 告警抑制
    public void suppressAlert(String alertName, long suppressDuration) {
        // 实现告警抑制逻辑
        // 避免告警风暴
    }
    
    // 告警升级
    public void escalateAlert(Alert alert) {
        // 实现告警升级逻辑
        // 如果告警持续未处理，则升级通知级别
    }
}
```

## 自动化运维工具链

构建完善的自动化运维工具链，能够显著提升运维效率和系统稳定性。

### 健康检查工具

```java
// 健康检查管理器
@Component
public class HealthCheckManager {
    
    // 健康检查项
    private List<HealthChecker> healthCheckers = new ArrayList<>();
    
    @PostConstruct
    public void initHealthCheckers() {
        healthCheckers.add(new ServiceRegistryHealthChecker());
        healthCheckers.add(new ConfigCenterHealthChecker());
        healthCheckers.add(new DatabaseHealthChecker());
        healthCheckers.add(new NetworkHealthChecker());
    }
    
    // 执行健康检查
    public HealthCheckReport performHealthCheck() {
        HealthCheckReport report = new HealthCheckReport();
        report.setTimestamp(System.currentTimeMillis());
        
        List<HealthCheckResult> results = new ArrayList<>();
        boolean overallHealthy = true;
        
        for (HealthChecker checker : healthCheckers) {
            try {
                HealthCheckResult result = checker.check();
                results.add(result);
                
                if (result.getStatus() == HealthStatus.DOWN) {
                    overallHealthy = false;
                }
            } catch (Exception e) {
                HealthCheckResult errorResult = new HealthCheckResult();
                errorResult.setName(checker.getName());
                errorResult.setStatus(HealthStatus.DOWN);
                errorResult.setMessage("Health check failed: " + e.getMessage());
                results.add(errorResult);
                overallHealthy = false;
            }
        }
        
        report.setResults(results);
        report.setOverallStatus(overallHealthy ? HealthStatus.UP : HealthStatus.DOWN);
        
        return report;
    }
    
    // 定期健康检查
    @Scheduled(fixedRate = 30000) // 每30秒检查一次
    public void scheduledHealthCheck() {
        HealthCheckReport report = performHealthCheck();
        
        // 记录健康检查结果
        logHealthCheckResult(report);
        
        // 如果不健康，触发告警
        if (report.getOverallStatus() == HealthStatus.DOWN) {
            triggerHealthAlert(report);
        }
    }
}

// 健康检查接口
public interface HealthChecker {
    String getName();
    HealthCheckResult check() throws Exception;
}

// 服务注册健康检查器
public class ServiceRegistryHealthChecker implements HealthChecker {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    @Override
    public String getName() {
        return "ServiceRegistry";
    }
    
    @Override
    public HealthCheckResult check() throws Exception {
        HealthCheckResult result = new HealthCheckResult();
        result.setName(getName());
        
        try {
            // 检查服务注册功能
            boolean registryHealthy = serviceRegistry.isHealthy();
            result.setStatus(registryHealthy ? HealthStatus.UP : HealthStatus.DOWN);
            result.setMessage(registryHealthy ? "Service registry is healthy" : "Service registry is unhealthy");
        } catch (Exception e) {
            result.setStatus(HealthStatus.DOWN);
            result.setMessage("Service registry health check failed: " + e.getMessage());
        }
        
        return result;
    }
}
```

### 自动故障恢复

```java
// 自动故障恢复管理器
@Component
public class AutoRecoveryManager {
    
    // 故障恢复策略
    private Map<String, RecoveryStrategy> recoveryStrategies = new HashMap<>();
    
    @PostConstruct
    public void initRecoveryStrategies() {
        recoveryStrategies.put("ServiceRegistry", new ServiceRegistryRecoveryStrategy());
        recoveryStrategies.put("ConfigCenter", new ConfigCenterRecoveryStrategy());
        recoveryStrategies.put("Database", new DatabaseRecoveryStrategy());
    }
    
    // 自动恢复故障
    public RecoveryResult autoRecover(HealthCheckResult failedCheck) {
        RecoveryStrategy strategy = recoveryStrategies.get(failedCheck.getName());
        if (strategy != null) {
            return strategy.recover(failedCheck);
        }
        
        RecoveryResult result = new RecoveryResult();
        result.setComponent(failedCheck.getName());
        result.setStatus(RecoveryStatus.FAILED);
        result.setMessage("No recovery strategy found for component: " + failedCheck.getName());
        return result;
    }
    
    // 故障恢复调度
    @EventListener
    public void handleHealthAlert(HealthAlertEvent event) {
        HealthCheckReport report = event.getReport();
        
        // 对于不健康的组件，尝试自动恢复
        for (HealthCheckResult result : report.getResults()) {
            if (result.getStatus() == HealthStatus.DOWN) {
                CompletableFuture.supplyAsync(() -> autoRecover(result))
                    .thenAccept(this::handleRecoveryResult);
            }
        }
    }
    
    private void handleRecoveryResult(RecoveryResult result) {
        if (result.getStatus() == RecoveryStatus.SUCCESS) {
            logger.info("Auto recovery successful for component: {}", result.getComponent());
            // 发送恢复通知
            notificationManager.sendRecoveryNotification(result);
        } else {
            logger.error("Auto recovery failed for component: {}, reason: {}", 
                        result.getComponent(), result.getMessage());
            // 升级告警
            alertManager.escalateAlert(result.getComponent(), result.getMessage());
        }
    }
}

// 恢复策略接口
public interface RecoveryStrategy {
    RecoveryResult recover(HealthCheckResult failedCheck);
}

// 服务注册恢复策略
public class ServiceRegistryRecoveryStrategy implements RecoveryStrategy {
    
    @Override
    public RecoveryResult recover(HealthCheckResult failedCheck) {
        RecoveryResult result = new RecoveryResult();
        result.setComponent("ServiceRegistry");
        
        try {
            // 1. 清理过期的服务实例
            cleanupExpiredInstances();
            
            // 2. 重新加载服务列表
            reloadServiceList();
            
            // 3. 检查网络连接
            checkNetworkConnectivity();
            
            result.setStatus(RecoveryStatus.SUCCESS);
            result.setMessage("Service registry recovered successfully");
        } catch (Exception e) {
            result.setStatus(RecoveryStatus.FAILED);
            result.setMessage("Service registry recovery failed: " + e.getMessage());
        }
        
        return result;
    }
    
    private void cleanupExpiredInstances() {
        // 实现清理过期实例的逻辑
    }
    
    private void reloadServiceList() {
        // 实现重新加载服务列表的逻辑
    }
    
    private void checkNetworkConnectivity() {
        // 实现网络连接检查的逻辑
    }
}
```

### 运维脚本工具

```bash
#!/bin/bash
# 注册中心运维工具脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
REGISTRY_HOST=${REGISTRY_HOST:-"localhost"}
REGISTRY_PORT=${REGISTRY_PORT:-8848}
HEALTH_CHECK_ENDPOINT="/actuator/health"

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 健康检查
health_check() {
    log_info "Performing health check..."
    
    local response
    response=$(curl -s -w "%{http_code}" "http://${REGISTRY_HOST}:${REGISTRY_PORT}${HEALTH_CHECK_ENDPOINT}" -o /dev/null)
    
    if [ "$response" -eq 200 ]; then
        log_info "Health check passed"
        return 0
    else
        log_error "Health check failed with status code: $response"
        return 1
    fi
}

# 服务列表查询
list_services() {
    log_info "Listing registered services..."
    
    local services
    services=$(curl -s "http://${REGISTRY_HOST}:${REGISTRY_PORT}/nacos/v1/ns/service/list?pageNo=1&pageSize=100")
    
    if [ $? -eq 0 ]; then
        echo "$services" | jq '.doms[]' 2>/dev/null || echo "$services"
    else
        log_error "Failed to list services"
        return 1
    fi
}

# 配置列表查询
list_configs() {
    log_info "Listing configurations..."
    
    local configs
    configs=$(curl -s "http://${REGISTRY_HOST}:${REGISTRY_PORT}/nacos/v1/cs/configs?pageNo=1&pageSize=100")
    
    if [ $? -eq 0 ]; then
        echo "$configs" | jq '.' 2>/dev/null || echo "$configs"
    else
        log_error "Failed to list configurations"
        return 1
    fi
}

# 备份配置
backup_configs() {
    local backup_dir=${1:-"/tmp/nacos-backup"}
    local timestamp=$(date +"%Y%m%d-%H%M%S")
    local backup_file="${backup_dir}/nacos-configs-${timestamp}.json"
    
    log_info "Backing up configurations to ${backup_file}..."
    
    mkdir -p "$backup_dir"
    
    local configs
    configs=$(curl -s "http://${REGISTRY_HOST}:${REGISTRY_PORT}/nacos/v1/cs/configs?pageNo=1&pageSize=1000")
    
    if [ $? -eq 0 ]; then
        echo "$configs" > "$backup_file"
        log_info "Backup completed successfully"
        return 0
    else
        log_error "Failed to backup configurations"
        return 1
    fi
}

# 恢复配置
restore_configs() {
    local backup_file=$1
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Backup file not provided or not found"
        return 1
    fi
    
    log_info "Restoring configurations from ${backup_file}..."
    
    # 这里应该实现配置恢复逻辑
    # 注意：恢复配置是一个危险操作，需要谨慎处理
    log_warn "Configuration restore is not implemented in this script for safety reasons"
    return 1
}

# 性能测试
performance_test() {
    local test_duration=${1:-60} # 默认测试60秒
    local concurrent_requests=${2:-10} # 默认并发10个请求
    
    log_info "Running performance test for ${test_duration} seconds with ${concurrent_requests} concurrent requests..."
    
    # 使用ab (Apache Bench) 进行性能测试
    if command -v ab >/dev/null 2>&1; then
        ab -n 1000 -c "$concurrent_requests" -t "$test_duration" \
           "http://${REGISTRY_HOST}:${REGISTRY_PORT}/actuator/health" > /tmp/performance-test.log 2>&1
        
        if [ $? -eq 0 ]; then
            log_info "Performance test completed"
            echo "Results:"
            grep -E "(Requests per second|Time per request|Transfer rate)" /tmp/performance-test.log
            return 0
        else
            log_error "Performance test failed"
            return 1
        fi
    else
        log_error "Apache Bench (ab) not found. Please install apache2-utils package."
        return 1
    fi
}

# 主菜单
show_menu() {
    echo "=================================="
    echo "  Nacos Registry Operations Tool  "
    echo "=================================="
    echo "1. Health Check"
    echo "2. List Services"
    echo "3. List Configurations"
    echo "4. Backup Configurations"
    echo "5. Restore Configurations"
    echo "6. Performance Test"
    echo "7. Exit"
    echo "=================================="
}

# 主循环
main() {
    while true; do
        show_menu
        read -p "Please select an option (1-7): " choice
        
        case $choice in
            1)
                health_check
                ;;
            2)
                list_services
                ;;
            3)
                list_configs
                ;;
            4)
                read -p "Enter backup directory (default: /tmp/nacos-backup): " backup_dir
                backup_configs "$backup_dir"
                ;;
            5)
                read -p "Enter backup file path: " backup_file
                restore_configs "$backup_file"
                ;;
            6)
                read -p "Enter test duration in seconds (default: 60): " test_duration
                read -p "Enter concurrent requests (default: 10): " concurrent_requests
                performance_test "${test_duration:-60}" "${concurrent_requests:-10}"
                ;;
            7)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option. Please select 1-7."
                ;;
        esac
        
        echo
        read -p "Press Enter to continue..."
        clear
    done
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

## 总结

完善的监控与运维体系是保障注册中心稳定运行的关键：

1. **指标采集**：建立全面的指标采集体系，包括QPS、延迟、可用率等关键指标
2. **日志管理**：采用结构化日志记录关键事件，便于问题排查和分析
3. **告警机制**：配置合理的告警规则和通知机制，及时发现和处理问题
4. **自动化工具**：构建自动化运维工具链，包括健康检查、故障恢复和运维脚本

通过这些监控与运维措施，能够显著提升注册中心的稳定性和可维护性，为业务系统的稳定运行提供有力保障。